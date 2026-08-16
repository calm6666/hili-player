/**
 * ============================================
 * HLS 流媒体插件 (HlsPlugin)
 * ============================================
 * 基于 fork 版本 hls.js 的 HLS 格式流媒体播放器插件
 *
 * 功能：
 * - 静态导入 fork 版本 hls.js 库（支持对象注入模式）
 * - 支持自适应码率切换 (ABR)
 * - 支持直播和点播模式
 * - 支持 URL 字符串和清单对象两种加载方式
 * - fork 版本通过 loadManifest() 支持对象注入模式
 * - useLocalHls 选项支持 Safari 原生 HLS 回退
 * - 提供缓冲、码率、帧率等实时统计信息
 * - 通过事件总线与播放器和其他插件通信
 * - 自动检测浏览器兼容性（含 iOS/macOS Safari 特殊处理）
 * - 致命错误自动恢复（recoverMediaError）
 * - 首帧时间追踪
 *
 * 使用方式：
 * import { createHlsPlugin } from '@hili-player/plugins';
 * const player = new VideoPlayer({
 *   plugins: [createHlsPlugin({ autoplay: true })]
 * });
 */

import Hls from 'hls.js';
import type { ManifestVariant, ManifestAudioGroup, ManifestParsedData, ErrorData, LevelSwitchedData } from 'hls.js';
import type { MediaManifest } from '../vendor/types';
import { manifestToHls } from '../vendor/manifest-to-hls';
import type { VideoPlayer } from '@hili-player/player';
import { StreamPluginTypeEnum, StreamPluginEventEnum } from '@/types/streamPlugin';
import type { StreamPlugin, StreamConfig, StreamStats, BufferInfo, QualityLevel, MediaManifestSource } from '@/types/streamPlugin';
import type { PluginOptions } from '@/types/plugin';
import type { PlayerEventBus } from '../../../player/src/core/plugin';
import { BrowserCapabilityDetector } from '@/hili-player/utils/browserCapabilityDetector';
import { createLogger } from '@/utils';

const logger = createLogger('HlsPlugin');

/**
 * 清单源对象类型（直接传入 ManifestVariant[] + ManifestAudioGroup[]）
 */
interface ManifestSourceObject {
  variants: ManifestVariant[];
  audioGroups?: ManifestAudioGroup[];
  [key: string]: string | number | boolean | ManifestVariant[] | ManifestAudioGroup[] | undefined;
}

/**
 * 类型谓词：判断源是否为 URL 字符串
 */
function isUrlString(source: string | MediaManifestSource): source is string {
  return typeof source === 'string';
}

/**
 * 类型谓词：判断源是否为 MediaManifest 对象
 * MediaManifest 具有 duration 和 video 字段
 */
function isMediaManifest(source: string | MediaManifestSource): source is MediaManifest {
  return (
    typeof source === 'object' &&
    source !== null &&
    'duration' in source &&
    'video' in source
  );
}

/**
 * 类型谓词：判断源是否为普通对象（ManifestSourceObject）
 */
function isManifestObject(source: string | MediaManifestSource): source is ManifestSourceObject {
  return typeof source === 'object' && source !== null;
}

/**
 * HLS 插件配置
 */
interface HlsPluginConfig {
  /** 是否自动播放，默认 true */
  autoplay?: boolean;
  /** 是否使用浏览器原生 HLS 支持（如 Safari），默认 false */
  useLocalHls?: boolean;
  /** 初始画质级别（-1 为自动） */
  startLevel?: number;
  /** ABR 快速直播权重 */
  abrEwmaFastLive?: number;
  /** ABR 慢速直播权重 */
  abrEwmaSlowLive?: number;
  /** 最大缓冲长度（秒） */
  maxBufferLength?: number;
  /** 最大最大缓冲长度（秒，用于自动暂停的硬限制） */
  maxMaxBufferLength?: number;
  /** 直播同步时长计数 */
  liveSyncDurationCount?: number;
  /** 片段加载超时（毫秒） */
  fragLoadingTimeOut?: number;
  /** 插件选项 */
  options?: PluginOptions;
}

/**
 * HLS 流媒体插件类
 * 实现 StreamPlugin 接口（StreamPlugin 继承 Plugin）
 * 基于 fork 版本 hls.js 提供 HLS 格式视频播放能力
 *
 * 支持三种加载模式：
 * 1. URL 字符串模式：new Hls() → attachMedia() → loadSource(url)
 * 2. 对象注入模式：new Hls({ autoStartLoad: false }) → attachMedia() → 等待 MEDIA_ATTACHED → manifestToHls(source) → loadManifest(variants, audioGroups) → startLoad()
 * 3. Safari 原生 HLS：直接设置 video.src
 */
export class HlsPlugin implements StreamPlugin {
  /** 插件名称（必须唯一） */
  readonly name = 'hls';
  /** 插件版本号 */
  readonly version = '1.0.0';
  /** 插件描述 */
  readonly description = 'HLS 格式流媒体播放器插件，基于 fork 版本 hls.js';
  /** 插件类型 */
  readonly type: StreamPluginTypeEnum = StreamPluginTypeEnum.HLS;

  /** hls.js 播放器实例 */
  private hlsPlayer: Hls | null = null;

  /** 视频元素（从播放器获取） */
  videoElement: HTMLVideoElement | null = null;

  /** 事件总线（从播放器获取） */
  eventBus: PlayerEventBus | null = null;

  /** 播放器实例引用 */
  private player: VideoPlayer | null = null;

  /** 当前流媒体配置 */
  private config: StreamConfig | null = null;

  /** 插件自定义配置 */
  private pluginConfig: HlsPluginConfig;

  /** 统计信息缓存 */
  private stats: Partial<StreamStats> = {};

  /** 上次卡顿开始时间（用于计算卡顿总时长） */
  private lastStallTime = 0;

  /** 加载开始时间戳（用于计算首帧时间） */
  private loadStartTime = 0;

  /** 是否已记录首帧时间 */
  private firstFrameRecorded = false;

  /** 首帧时间（毫秒） */
  private firstFrameTime = 0;

  /** 浏览器能力检测结果 */
  private browserCapability: ReturnType<typeof BrowserCapabilityDetector.getFullCapabilityResult> | null = null;

  /** 首帧事件处理器引用（用于移除监听） */
  private firstFrameHandler: (() => void) | null = null;

  /**
   * 构造函数
   * @param config - HLS 插件配置
   */
  constructor(config?: HlsPluginConfig) {
    this.pluginConfig = {
      autoplay: true,
      useLocalHls: false,
      startLevel: -1,
      abrEwmaFastLive: 3.0,
      abrEwmaSlowLive: 9.0,
      maxBufferLength: 30,
      maxMaxBufferLength: 600,
      liveSyncDurationCount: 3,
      fragLoadingTimeOut: 20000,
      ...config,
    };
  }

  /**
   * ============================================
   * Plugin 接口实现
   * ============================================
   */

  /**
   * 安装插件
   * 当插件被注册到播放器时调用
   * 在此阶段完成：浏览器能力检测、播放器引用保存、事件总线和视频元素获取
   *
   * @param player - 播放器实例
   */
  install(player: VideoPlayer): void {
    // 1. 保存播放器实例引用
    this.player = player;
    // 2. 从播放器获取事件总线（公共属性）
    this.eventBus = player.events;
    // 3. 检测浏览器能力（HLS 在 iOS 上使用原生播放，在桌面端依赖 MSE）
    this.browserCapability = BrowserCapabilityDetector.getFullCapabilityResult();
    const hlsSupport = BrowserCapabilityDetector.checkHlsjsSupport();
    logger.info(
      `浏览器能力检测: HLS支持=${hlsSupport.supported}, ` +
      `详情=${hlsSupport.detail}, ` +
      `浏览器=${this.browserCapability.browserName} ${this.browserCapability.browserVersion}, ` +
      `系统=${this.browserCapability.osName} ${this.browserCapability.osVersion}`
    );
    // 4. 监听播放器挂载完成事件，获取视频元素
    player.events.on('player:mounted', (data) => {
      if (data && data.video instanceof HTMLVideoElement) {
        this.videoElement = data.video;
        logger.info('已获取视频元素');
      }
    });

    logger.info('插件已安装');
  }

  /**
   * 卸载插件
   * 清理所有资源：销毁 hls.js 实例、释放引用
   *
   * @param _player - 播放器实例（此处不需要）
   */
  uninstall(_player?: VideoPlayer): void {
    this.destroy();
    this.player = null;
    this.eventBus = null;
    this.videoElement = null;
    this.browserCapability = null;
    this.firstFrameRecorded = false;
    this.firstFrameTime = 0;
    logger.info('插件已卸载');
  }

  /**
   * ============================================
   * StreamPlugin 接口实现
   * ============================================
   */

  /**
   * 检查浏览器是否支持 hls.js 播放
   * 优先使用缓存的检测结果，否则实时检测
   *
   * @returns 是否支持 hls.js
   */
  isSupported(): boolean {
    // 优先使用安装时缓存的检测结果
    if (this.browserCapability) {
      return this.browserCapability.hlsjsSupported;
    }
    // 降级：实时检测
    if (typeof window === 'undefined') return false;
    return Hls.isSupported();
  }

  /**
   * 加载 HLS 流媒体
   * 使用 fork 版本 hls.js 创建播放器实例
   *
   * 支持三种加载模式：
   * 1. URL 字符串模式：new Hls() → attachMedia() → loadSource(url)
   * 2. 对象注入模式：new Hls({ autoStartLoad: false }) → attachMedia() → 等待 MEDIA_ATTACHED → manifestToHls(source) → loadManifest(variants, audioGroups) → startLoad()
   * 3. Safari 原生 HLS：直接设置 video.src
   *
   * @param config - 流媒体配置（包含 URL 或清单对象、格式等）
   */
  load(config: StreamConfig): void {
    if (!this.videoElement) {
      const msg = '视频元素未设置，请确保播放器已挂载到 DOM';
      logger.error(msg);
      this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      return;
    }

    this.config = config;
    this.loadStartTime = Date.now();
    this.firstFrameRecorded = false;
    this.firstFrameTime = 0;

    // 注册首帧时间追踪
    this.registerFirstFrameTracking();

    const source = config.url;

    // Safari 原生 HLS 支持：useLocalHls 且浏览器原生支持 HLS 且源为 URL 字符串
    if (
      this.pluginConfig.useLocalHls &&
      isUrlString(source) &&
      this.videoElement.canPlayType('application/vnd.apple.mpegurl')
    ) {
      this.videoElement.src = source;
      this.eventBus?.emit(StreamPluginEventEnum.LOAD_COMPLETE, { url: source });

      if (this.pluginConfig.autoplay) {
        this.play();
      }
      if (config.startTime && config.startTime > 0) {
        this.seek(config.startTime);
      }

      logger.info('使用原生 HLS 支持:', source);
      return;
    }

    // 检查浏览器是否支持 hls.js
    if (!Hls.isSupported()) {
      const msg = `hls.js 检测到当前浏览器不支持 HLS 播放（${this.browserCapability?.browserName || '未知'} ${this.browserCapability?.browserVersion || ''}）`;
      logger.error(msg);
      this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      return;
    }

    if (!this.videoElement) {
      const msg = '视频元素已被移除，无法加载';
      logger.error(msg);
      this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      return;
    }

    // 根据源类型选择加载方式
    if (isUrlString(source) && source.split('?')[0].toLowerCase().endsWith('.json')) {
      // ============================================
      // JSON Manifest 模式
      // ============================================
      // 先 fetch JSON，再转换为 hls.js 清单对象注入
      this.loadJsonManifest(source);
    } else if (isUrlString(source)) {
      // ============================================
      // URL 字符串模式
      // ============================================
      // 1. 创建 Hls 实例（autoStartLoad 默认 true）
      this.hlsPlayer = new Hls({
        startLevel: this.pluginConfig.startLevel,
        abrEwmaFastLive: this.pluginConfig.abrEwmaFastLive,
        abrEwmaSlowLive: this.pluginConfig.abrEwmaSlowLive,
        maxBufferLength: this.pluginConfig.maxBufferLength,
        maxMaxBufferLength: this.pluginConfig.maxMaxBufferLength,
        liveSyncDurationCount: this.pluginConfig.liveSyncDurationCount,
        fragLoadingTimeOut: this.pluginConfig.fragLoadingTimeOut,
      });

      // 2. 绑定视频元素
      this.hlsPlayer.attachMedia(this.videoElement);

      // 3. 加载 URL 源
      this.hlsPlayer.loadSource(source);

      // 4. 绑定 hls.js 事件
      this.bindEvents();

      logger.info('HLS 流加载成功:', source);
    } else if (isMediaManifest(source)) {
      // ============================================
      // 对象注入模式（MediaManifest）
      // ============================================
      // 1. 创建 Hls 实例，autoStartLoad 必须设为 false
      this.hlsPlayer = new Hls({
        autoStartLoad: false,
        startLevel: this.pluginConfig.startLevel,
        abrEwmaFastLive: this.pluginConfig.abrEwmaFastLive,
        abrEwmaSlowLive: this.pluginConfig.abrEwmaSlowLive,
        maxBufferLength: this.pluginConfig.maxBufferLength,
        maxMaxBufferLength: this.pluginConfig.maxMaxBufferLength,
        liveSyncDurationCount: this.pluginConfig.liveSyncDurationCount,
        fragLoadingTimeOut: this.pluginConfig.fragLoadingTimeOut,
      });

      // 2. 绑定视频元素
      this.hlsPlayer.attachMedia(this.videoElement);

      // 3. 绑定 hls.js 事件（在 MEDIA_ATTACHED 之前绑定，确保不遗漏事件）
      this.bindEvents();

      // 4. 等待 MEDIA_ATTACHED 事件后，转换清单并注入
      const doManifestInjection = (): void => {
        if (!this.hlsPlayer) return;

        // 4a. 转换清单对象
        const hlsData = manifestToHls(source as MediaManifest);

        // 5. 加载清单
        this.hlsPlayer.loadManifest(hlsData.variants, hlsData.audioGroups);

        // 6. 开始加载片段
        this.hlsPlayer.startLoad();

        logger.info('HLS 流加载成功（对象注入模式）');
      };

      // 等待 MEDIA_ATTACHED 事件
      this.hlsPlayer.once(Hls.Events.MEDIA_ATTACHED, () => {
        doManifestInjection();
      });
    } else if (isManifestObject(source)) {
      // ============================================
      // 对象注入模式（直接传入 ManifestVariant[] + ManifestAudioGroup[]）
      // ============================================
      // 1. 创建 Hls 实例，autoStartLoad 必须设为 false
      this.hlsPlayer = new Hls({
        autoStartLoad: false,
        startLevel: this.pluginConfig.startLevel,
        abrEwmaFastLive: this.pluginConfig.abrEwmaFastLive,
        abrEwmaSlowLive: this.pluginConfig.abrEwmaSlowLive,
        maxBufferLength: this.pluginConfig.maxBufferLength,
        maxMaxBufferLength: this.pluginConfig.maxMaxBufferLength,
        liveSyncDurationCount: this.pluginConfig.liveSyncDurationCount,
        fragLoadingTimeOut: this.pluginConfig.fragLoadingTimeOut,
      });

      // 2. 绑定视频元素
      this.hlsPlayer.attachMedia(this.videoElement);

      // 3. 绑定 hls.js 事件
      this.bindEvents();

      // 4. 等待 MEDIA_ATTACHED 事件后，直接注入 variants 和 audioGroups
      const doDirectInjection = (): void => {
        if (!this.hlsPlayer) return;

        const manifestSource = source as ManifestSourceObject;
        if (manifestSource.variants && Array.isArray(manifestSource.variants)) {
          // 5. 加载清单
          this.hlsPlayer.loadManifest(
            manifestSource.variants,
            manifestSource.audioGroups,
          );

          // 6. 开始加载片段
          this.hlsPlayer.startLoad();

          logger.info('HLS 流加载成功（对象注入模式 - 直接传入）');
        } else {
          const msg = '清单对象缺少 variants 字段';
          logger.error(msg);
          this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
          return;
        }
      };

      // 等待 MEDIA_ATTACHED 事件
      this.hlsPlayer.once(Hls.Events.MEDIA_ATTACHED, () => {
        doDirectInjection();
      });
    } else {
      const msg = '不支持的源类型';
      logger.error(msg);
      this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      return;
    }

    this.eventBus?.emit(StreamPluginEventEnum.LOAD_COMPLETE, { url: source });

    if (this.pluginConfig.autoplay) {
      this.play();
    }
    if (config.startTime && config.startTime > 0) {
      this.seek(config.startTime);
    }
  }

  /**
   * 加载 JSON Manifest 文件
   * 先 fetch JSON，解析为 MediaManifest 对象，再转换为 hls.js 清单注入
   *
   * @param url - JSON manifest 文件 URL
   */
  private async loadJsonManifest(url: string): Promise<void> {
    try {
      logger.info('正在获取 JSON Manifest:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const manifest = await response.json();

      if (!isMediaManifest(manifest)) {
        throw new Error('JSON 格式不是有效的 MediaManifest（缺少 duration 或 video 字段）');
      }

      // 创建 Hls 实例（autoStartLoad 必须设为 false）
      this.hlsPlayer = new Hls({
        autoStartLoad: false,
        startLevel: this.pluginConfig.startLevel,
        abrEwmaFastLive: this.pluginConfig.abrEwmaFastLive,
        abrEwmaSlowLive: this.pluginConfig.abrEwmaSlowLive,
        maxBufferLength: this.pluginConfig.maxBufferLength,
        maxMaxBufferLength: this.pluginConfig.maxMaxBufferLength,
        liveSyncDurationCount: this.pluginConfig.liveSyncDurationCount,
        fragLoadingTimeOut: this.pluginConfig.fragLoadingTimeOut,
      });

      this.hlsPlayer.attachMedia(this.videoElement!);
      this.bindEvents();

      // 转换清单对象
      const hlsData = manifestToHls(manifest);

      // 加载清单
      this.hlsPlayer.loadManifest(hlsData.variants, hlsData.audioGroups);
      this.hlsPlayer.startLoad();

      logger.info('HLS 流加载成功 (JSON Manifest模式)');
      this.eventBus?.emit(StreamPluginEventEnum.LOAD_COMPLETE, { url });
    } catch (err) {
      const msg = `加载 JSON Manifest 失败: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(msg);
      this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
    }
  }

  /**
   * 注册首帧时间追踪
   * 监听视频元素的 playing 事件，记录从加载开始到首帧渲染的时间
   */
  private registerFirstFrameTracking(): void {
    this.removeFirstFrameTracking();

    const video = this.videoElement;
    if (!video) return;

    this.firstFrameHandler = (): void => {
      if (!this.firstFrameRecorded) {
        this.firstFrameRecorded = true;
        this.firstFrameTime = Date.now() - this.loadStartTime;
        this.stats.firstFrameTime = this.firstFrameTime;
        logger.info(`首帧时间: ${this.firstFrameTime}ms`);
        this.eventBus?.emit(StreamPluginEventEnum.STATS_UPDATE, this.getStats());
      }
    };

    video.addEventListener('playing', this.firstFrameHandler);
  }

  /**
   * 移除首帧时间追踪监听
   */
  private removeFirstFrameTracking(): void {
    if (this.firstFrameHandler && this.videoElement) {
      this.videoElement.removeEventListener('playing', this.firstFrameHandler);
      this.firstFrameHandler = null;
    }
  }

  /**
   * 绑定 hls.js 核心事件
   * 将 hls.js 的内部事件转换为统一的 StreamPlugin 事件
   *
   * 绑定事件列表：
   * - MEDIA_ATTACHED: 媒体附加完成
   * - MANIFEST_PARSED: 清单解析完成
   * - ERROR: 播放器错误（区分致命/非致命）
   * - FRAG_LOADED: 片段加载完成
   * - LEVEL_SWITCHED: 画质级别切换
   * - BUFFER_APPENDED: 片段缓冲追加完成
   */
  private bindEvents(): void {
    if (!this.hlsPlayer) return;

    const Events = Hls.Events;

    // 媒体附加完成
    this.hlsPlayer.on(Events.MEDIA_ATTACHED, () => {
      logger.info('媒体已附加到视频元素');
    });

    // 清单解析完成 → 获取可用画质信息
    this.hlsPlayer.on(Events.MANIFEST_PARSED, (_event: string, data: ManifestParsedData) => {
      if (data && 'levels' in data && Array.isArray(data.levels)) {
        logger.info('清单解析完成，可用画质:', data.levels.length);
        this.eventBus?.emit(StreamPluginEventEnum.METADATA_LOADED, data);
      }
    });

    // 播放器错误处理（区分致命/非致命错误）
    this.hlsPlayer.on(Events.ERROR, (_event: string, data: ErrorData) => {
      logger.error('播放器错误:', data);

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this.eventBus?.emit(StreamPluginEventEnum.NETWORK_ERROR, data);
            // 网络错误：尝试重新加载
            this.hlsPlayer?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            this.eventBus?.emit(StreamPluginEventEnum.DECODE_ERROR, data);
            // 媒体错误：尝试恢复
            this.hlsPlayer?.recoverMediaError();
            break;
          default:
            this.eventBus?.emit(StreamPluginEventEnum.ERROR, data);
            break;
        }
      }
    });

    // 缓冲追加完成 → 计算卡顿时长
    this.hlsPlayer.on(Events.BUFFER_APPENDED, () => {
      if (this.lastStallTime > 0) {
        const stallDuration = Date.now() - this.lastStallTime;
        this.stats.totalStallTime = (this.stats.totalStallTime || 0) + stallDuration;
        this.stats.totalStallCount = (this.stats.totalStallCount || 0) + 1;
        this.lastStallTime = 0;
      }
      this.eventBus?.emit(StreamPluginEventEnum.BUFFER_END, {});
    });

    // 片段加载完成 → 更新下载速度统计
    this.hlsPlayer.on(Events.FRAG_LOADED, () => {
      this.eventBus?.emit(StreamPluginEventEnum.STATS_UPDATE, this.getStats());
    });

    // 画质级别切换
    this.hlsPlayer.on(Events.LEVEL_SWITCHED, (_event: string, data: LevelSwitchedData) => {
      logger.info('画质切换至级别:', data.level);
      this.eventBus?.emit(StreamPluginEventEnum.STATS_UPDATE, this.getStats());
      const stats = this.getStats();
      if (stats.resolution) {
        const isAuto = this.hlsPlayer?.currentLevel === -1;
        this.eventBus?.emit(StreamPluginEventEnum.QUALITY_CHANGE, {
          width: stats.resolution.width,
          height: stats.resolution.height,
          bitrate: stats.videoBitrate,
          isAuto,
        });
      }
    });
  }

  /**
   * 开始播放
   * 直接调用视频元素的 play 方法
   */
  play(): void {
    if (this.videoElement) {
      this.videoElement.play()
        .then(() => {
          this.eventBus?.emit(StreamPluginEventEnum.PLAY_START, {});
        })
        .catch((err: Error) => {
          const msg = `播放失败: ${err.message}`;
          logger.error(msg);
          this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
        });
    }
  }

  /**
   * 暂停播放
   * 直接调用视频元素的 pause 方法
   */
  pause(): void {
    if (this.videoElement) {
      this.videoElement.pause();
      this.eventBus?.emit(StreamPluginEventEnum.PLAY_PAUSE, {});
    }
  }

  /**
   * 跳转到指定时间
   * 直接设置视频元素的 currentTime（hls.js 会自动处理缓冲）
   *
   * @param time - 目标时间（秒）
   */
  seek(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  /**
   * 销毁播放器实例
   * 停止加载、销毁 hls.js 实例，清理所有引用
   */
  destroy(): void {
    this.removeFirstFrameTracking();
    if (this.hlsPlayer) {
      this.hlsPlayer.stopLoad();
      this.hlsPlayer.destroy();
      this.hlsPlayer = null;
    }
    this.config = null;
    this.stats = {};
    this.lastStallTime = 0;
    this.loadStartTime = 0;
    this.firstFrameRecorded = false;
    this.firstFrameTime = 0;
  }

  /**
   * 获取缓冲信息
   * 计算当前播放位置到缓冲区末尾的时长
   *
   * @returns 缓冲信息（起始时间、结束时间、缓冲长度）
   */
  getBufferInfo(): BufferInfo {
    const video = this.videoElement;
    const buffered = video?.buffered;

    if (!video || !buffered || buffered.length === 0) {
      return { start: 0, end: 0, length: 0 };
    }

    const currentTime = video.currentTime || 0;
    let bufferEnd = 0;

    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && buffered.end(i) >= currentTime) {
        bufferEnd = buffered.end(i);
        break;
      }
    }

    const bufferLength = bufferEnd - currentTime;

    return {
      start: currentTime,
      end: bufferEnd,
      length: Math.max(0, bufferLength),
    };
  }

  /**
   * 获取统计信息
   * 收集当前播放器状态，包括播放时间、缓冲长度、码率、分辨率、首帧时间等
   *
   * @returns 流媒体统计信息
   */
  getStats(): Partial<StreamStats> {
    const video = this.videoElement;
    const bufferInfo = this.getBufferInfo();
    const currentLevel = this.hlsPlayer?.levels[this.hlsPlayer?.currentLevel ?? 0];

    return {
      ...this.stats,
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      bufferLength: bufferInfo.length,
      firstFrameTime: this.firstFrameTime,
      totalStallCount: this.stats.totalStallCount || 0,
      totalStallTime: this.stats.totalStallTime || 0,
      videoBitrate: currentLevel?.bitrate,
      downloadSpeed: this.stats.downloadSpeed || 0,
      resolution: currentLevel?.width && currentLevel?.height
        ? { width: currentLevel.width, height: currentLevel.height }
        : undefined,
    };
  }

  /**
   * 获取可用画质列表
   * 从 hls.js 获取所有可用的码率/分辨率级别
   *
   * @returns 画质列表（id + label + 码率 + 分辨率）
   */
  getQualities(): QualityLevel[] {
    if (!this.hlsPlayer) return [];
    return this.hlsPlayer.levels.map((level, index) => ({
      id: String(index),
      label: level.height ? `${level.height}p` : `Level ${index}`,
      width: level.width,
      height: level.height,
      bitrate: level.bitrate,
    }));
  }

  /**
   * 设置播放画质
   * 切换到指定索引的码率层级（'-1' 或 'auto' 表示自动选择）
   *
   * @param quality - 画质标识（级别索引字符串，或 'auto'）
   */
  setQuality(quality: string): void {
    if (this.hlsPlayer) {
      const level = quality === 'auto' ? -1 : Number(quality);
      this.hlsPlayer.currentLevel = level;
    }
  }

  /**
   * 获取浏览器能力检测结果
   * 返回插件安装时检测的浏览器兼容性信息
   *
   * @returns 浏览器能力检测结果，未安装返回 null
   */
  getBrowserCapability(): ReturnType<typeof BrowserCapabilityDetector.getFullCapabilityResult> | null {
    return this.browserCapability;
  }

  /**
   * 获取当前流媒体配置
   * @returns 流媒体配置，未加载返回 null
   */
  getConfig(): StreamConfig | null {
    return this.config;
  }

  /**
   * 获取播放器实例引用
   * @returns 播放器实例，未安装返回 null
   */
  getPlayer(): VideoPlayer | null {
    return this.player;
  }
}

/**
 * HLS 插件工厂函数
 * 创建并返回一个新的 HlsPlugin 实例
 *
 * @param config - HLS 插件配置
 * @returns HlsPlugin 实例
 *
 * @example
 * // 基本用法
 * player.use(createHlsPlugin());
 *
 * @example
 * // 自定义缓冲配置
 * player.use(createHlsPlugin({
 *   maxBufferLength: 60,
 *   autoplay: false
 * }));
 *
 * @example
 * // 使用 Safari 原生 HLS 回退
 * player.use(createHlsPlugin({
 *   useLocalHls: true
 * }));
 */
export function createHlsPlugin(config?: HlsPluginConfig): HlsPlugin {
  return new HlsPlugin(config);
}
