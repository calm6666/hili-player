/**
 * ============================================
 * HLS 流媒体插件 (HlsPlugin)
 * ============================================
 * 基于 hls.js 的 HLS 格式流媒体播放器插件
 *
 * 功能：
 * - 动态加载 hls.js 库
 * - 支持自适应码率切换 (ABR)
 * - 支持直播和点播模式
 * - 提供缓冲、码率、帧率等实时统计信息
 * - 通过事件总线与播放器和其他插件通信
 * - 自动检测浏览器兼容性（含 iOS/macOS Safari 特殊处理）
 *
 * 使用方式：
 * import { HlsPlugin } from '@hili-player/plugins';
 * const player = new VideoPlayer({
 *   plugins: [HlsPlugin({ autoplay: true })]
 * });
 */

import type { Plugin } from '@hili-player/player';
import type { VideoPlayer } from '@hili-player/player';
import type { StreamPlugin, StreamConfig, BufferInfo, StreamStats } from '../stream/types';
import type { EventBus } from '@/core/eventBus';
import { StreamPluginTypeEnum, StreamPluginEventEnum } from '../stream/enums';
import { BrowserCapabilityDetector } from '@/hili-player/utils/browserCapabilityDetector';
import { createLogger } from '@/utils';

const logger = createLogger('HlsPlugin');

/**
 * HLS.js 播放器实例接口
 * 定义 hls.js Hls 实例的核心 API
 */
interface HlsJsPlayer {
  /** 绑定视频元素 */
  attachMedia(video: HTMLVideoElement): void;
  /** 加载 HLS 源 */
  loadSource(url: string): void;
  /** 开始加载片段 */
  startLoad(startPosition?: number): void;
  /** 停止加载片段 */
  stopLoad(): void;
  /** 销毁实例 */
  destroy(): void;
  /** 尝试恢复媒体错误 */
  recoverMediaError(): void;
  /** 监听 hls.js 事件 */
  on(event: string, callback: (event: string, data: unknown) => void): void;
  /** 取消监听 hls.js 事件 */
  off(event: string, callback: (event: string, data: unknown) => void): void;
  /** 可用画质列表（只读） */
  readonly levels: Array<{
    bitrate: number;
    width: number;
    height: number;
  }>;
  /** 当前播放画质索引 */
  currentLevel: number;
  /** 即将切换到的画质索引 */
  readonly nextLevel: number;
  /** 是否启用自动画质选择 */
  readonly autoLevelEnabled: boolean;
  /** 自动画质上限 */
  readonly autoLevelCapping: number;
}

/**
 * HLS.js 模块接口
 * 定义 hls.js 模块的静态结构
 */
interface HlsJsModule {
  /** 构造函数，创建 Hls 实例 */
  new (config?: Record<string, unknown>): HlsJsPlayer;
  /** 检测浏览器是否支持 HLS */
  isSupported(): boolean;
  /** 事件常量映射 */
  Events: Record<string, string>;
  /** 错误类型常量映射 */
  ErrorTypes: Record<string, string>;
  /** 错误详情常量映射 */
  ErrorDetails: Record<string, string>;
}

/**
 * 类型谓词：判断模块是否为合法的 HlsJsModule
 * 用于动态导入 hls.js 后的类型安全验证
 */
function isHlsJsModule(mod: unknown): mod is HlsJsModule {
  if (mod == null) return false;
  if (typeof mod !== 'function') return false;
  return (
    'isSupported' in mod && typeof mod.isSupported === 'function' &&
    'Events' in mod && typeof mod.Events === 'object' && mod.Events !== null &&
    'ErrorTypes' in mod && typeof mod.ErrorTypes === 'object' && mod.ErrorTypes !== null &&
    'ErrorDetails' in mod && typeof mod.ErrorDetails === 'object' && mod.ErrorDetails !== null
  );
}

/**
 * HLS 插件配置
 */
interface HlsJsConfig {
  /** 是否自动播放，默认 true */
  autoplay?: boolean;
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
}

/**
 * HLS 流媒体插件类
 * 实现 Plugin 和 StreamPlugin 接口
 * 基于 hls.js 提供 HLS 格式视频播放能力
 */
export class HlsPlugin implements Plugin, StreamPlugin {
  /** 插件名称（必须唯一） */
  readonly name = 'hls';
  /** 插件版本号 */
  readonly version = '1.0.0';
  /** 插件描述 */
  readonly description = 'HLS 格式流媒体播放器插件，基于 hls.js';
  /** 插件类型 */
  readonly type = StreamPluginTypeEnum.HLS;

  /** hls.js 播放器实例 */
  private hlsPlayer: HlsJsPlayer | null = null;

  /** hls.js 模块引用（动态导入后缓存） */
  private hlsjs: HlsJsModule | null = null;

  /** 视频元素（从播放器获取） */
  videoElement: HTMLVideoElement | null = null;

  /** 事件总线（从播放器获取） */
  eventBus: EventBus | null = null;

  /** 播放器实例引用 */
  private player: VideoPlayer | null = null;

  /** 当前流媒体配置 */
  private config: StreamConfig | null = null;

  /** 插件自定义配置 */
  private pluginConfig: HlsJsConfig;

  /** 统计信息缓存 */
  private stats: Partial<StreamStats> = {};

  /** 上次卡顿开始时间（用于计算卡顿总时长） */
  private lastStallTime = 0;

  /** 浏览器能力检测结果 */
  private browserCapability: ReturnType<typeof BrowserCapabilityDetector.getFullCapabilityResult> | null = null;

  /**
   * 构造函数
   * @param config - HLS 插件配置
   */
  constructor(config?: HlsJsConfig) {
    this.pluginConfig = {
      autoplay: true,
      startLevel: -1,          // -1 表示自动选择画质
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
    // 保存播放器实例引用
    this.player = player;

    // 从播放器获取事件总线（公共属性）
    this.eventBus = player.events;

    // 检测浏览器能力（HLS 在 iOS 上使用原生播放，在桌面端依赖 MSE）
    this.browserCapability = BrowserCapabilityDetector.getFullCapabilityResult();
    const hlsSupport = BrowserCapabilityDetector.checkHlsjsSupport();
    logger.info(
      `浏览器能力检测: HLS支持=${hlsSupport.supported}, ` +
      `详情=${hlsSupport.detail}, ` +
      `浏览器=${this.browserCapability.browserName} ${this.browserCapability.browserVersion}, ` +
      `系统=${this.browserCapability.osName} ${this.browserCapability.osVersion}`
    );

    // 监听播放器挂载完成事件，获取视频元素
    player.events.on('player:mounted', (data: unknown) => {
      if (data && typeof data === 'object' && 'video' in data && data.video instanceof HTMLVideoElement) {
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
    return this.hlsjs?.isSupported() ?? false;
  }

  /**
   * 加载 HLS 流媒体
   * 动态导入 hls.js 库，创建播放器实例并绑定到视频元素
   *
   * @param config - 流媒体配置（包含 URL、格式等）
   */
  load(config: StreamConfig): void {
    // 验证视频元素是否存在
    if (!this.videoElement) {
      const msg = '视频元素未设置，请确保播放器已挂载到 DOM';
      logger.error(msg);
      this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      return;
    }

    // 动态导入 hls.js（按需加载，减小初始包体积）
    import('hls.js')
      .then((hlsjs) => {
        // hls.js 的默认导出是 Hls 构造函数
        if (!isHlsJsModule(hlsjs.default)) {
          const msg = 'hls.js 模块结构不符合预期';
          logger.error(msg);
          this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
          return;
        }
        this.hlsjs = hlsjs.default;

        // 检查 hls.js 自身是否支持当前浏览器
        if (!this.hlsjs.isSupported()) {
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

        // 保存配置
        this.config = config;

        // 创建 hls.js 播放器实例（传入详细配置）
        this.hlsPlayer = new this.hlsjs({
          startLevel: this.pluginConfig.startLevel,
          abrEwmaFastLive: this.pluginConfig.abrEwmaFastLive,
          abrEwmaSlowLive: this.pluginConfig.abrEwmaSlowLive,
          maxBufferLength: this.pluginConfig.maxBufferLength,
          maxMaxBufferLength: this.pluginConfig.maxMaxBufferLength,
          liveSyncDurationCount: this.pluginConfig.liveSyncDurationCount,
          fragLoadingTimeOut: this.pluginConfig.fragLoadingTimeOut,
        });

        // 绑定 hls.js 内置事件
        this.bindEvents();

        // 加载 HLS 源并绑定到视频元素
        this.hlsPlayer.loadSource(config.url);
        this.hlsPlayer.attachMedia(this.videoElement);

        // 通知外部：加载完成
        this.eventBus?.emit(StreamPluginEventEnum.LOAD_COMPLETE, { url: config.url });

        // 自动播放
        if (this.pluginConfig.autoplay) {
          this.play();
        }

        // 如果指定了起始时间，跳转到对应位置
        if (config.startTime && config.startTime > 0) {
          this.seek(config.startTime);
        }

        logger.info('HLS 流加载成功:', config.url);
      })
      .catch((err) => {
        const msg = `加载 hls.js 失败: ${err instanceof Error ? err.message : String(err)}`;
        logger.error(msg);
        this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      });
  }

  /**
   * 绑定 hls.js 核心事件
   * 将 hls.js 的内部事件转换为统一的 StreamPlugin 事件
   */
  private bindEvents(): void {
    if (!this.hlsPlayer || !this.hlsjs) return;

    const Events = this.hlsjs.Events;

    // 媒体附加完成
    this.hlsPlayer.on(Events.MEDIA_ATTACHED, () => {
      logger.info('媒体已附加到视频元素');
    });

    // 清单解析完成 → 获取可用画质信息
    this.hlsPlayer.on(Events.MANIFEST_PARSED, (_event: unknown, data: unknown) => {
      if (data && typeof data === 'object' && 'levels' in data && Array.isArray(data.levels)) {
        logger.info('清单解析完成，可用画质:', data.levels.length);
        this.eventBus?.emit(StreamPluginEventEnum.METADATA_LOADED, data);
      }
    });

    // 播放器错误处理（区分致命/非致命错误）
    this.hlsPlayer.on(Events.ERROR, (_event: unknown, data: unknown) => {
      if (
        data && typeof data === 'object' &&
        'type' in data && typeof data.type === 'string' &&
        'details' in data && typeof data.details === 'string' &&
        'fatal' in data && typeof data.fatal === 'boolean'
      ) {
        logger.error('播放器错误:', data);

        if (data.fatal) {
          // 致命错误：根据类型发出不同事件
          switch (data.type) {
            case this.hlsjs!.ErrorTypes.NETWORK_ERROR:
              this.eventBus?.emit(StreamPluginEventEnum.NETWORK_ERROR, data);
              // 尝试自动恢复
              this.hlsPlayer?.recoverMediaError();
              break;
            case this.hlsjs!.ErrorTypes.MEDIA_ERROR:
              this.eventBus?.emit(StreamPluginEventEnum.DECODE_ERROR, data);
              this.hlsPlayer?.recoverMediaError();
              break;
            default:
              this.eventBus?.emit(StreamPluginEventEnum.ERROR, data);
              break;
          }
        }
      }
    });

    // 缓冲停滞开始 → 记录卡顿开始时间
    this.hlsPlayer.on(Events.BUFFER_STALLED, () => {
      this.lastStallTime = Date.now();
      this.eventBus?.emit(StreamPluginEventEnum.BUFFER_START, {});
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
    this.hlsPlayer.on(Events.FRAG_LOADED, (_event: unknown, data: unknown) => {
      if (
        data && typeof data === 'object' && 'stats' in data &&
        data.stats !== null && typeof data.stats === 'object' &&
        'loaded' in data.stats && typeof data.stats.loaded === 'number' &&
        'total' in data.stats && typeof data.stats.total === 'number'
      ) {
        this.stats.downloadSpeed = data.stats.loaded;
      }
      this.eventBus?.emit(StreamPluginEventEnum.STATS_UPDATE, this.getStats());
    });

    // 画质级别切换
    this.hlsPlayer.on(Events.LEVEL_SWITCHED, (_event: unknown, data: unknown) => {
      if (data && typeof data === 'object' && 'level' in data && typeof data.level === 'number') {
        logger.info('画质切换至级别:', data.level);
      }
      this.eventBus?.emit(StreamPluginEventEnum.STATS_UPDATE, this.getStats());
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
        .catch((err) => {
          const msg = `播放失败: ${err instanceof Error ? err.message : String(err)}`;
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
    if (this.hlsPlayer) {
      this.hlsPlayer.stopLoad();
      this.hlsPlayer.destroy();
      this.hlsPlayer = null;
    }
    this.config = null;
    this.stats = {};
    this.lastStallTime = 0;
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

    // 无缓冲数据时返回空值
    if (!video || !buffered || buffered.length === 0) {
      return { start: 0, end: 0, length: 0 };
    }

    const currentTime = video.currentTime || 0;
    let bufferEnd = 0;

    // 查找包含当前播放位置的缓冲区间
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
   * 收集当前播放器状态，包括播放时间、缓冲长度、码率、分辨率等
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
      firstFrameTime: 0,
      totalStallCount: this.stats.totalStallCount || 0,
      totalStallTime: this.stats.totalStallTime || 0,
      videoBitrate: currentLevel?.bitrate,
      resolution: currentLevel?.width && currentLevel?.height
        ? { width: currentLevel.width, height: currentLevel.height }
        : undefined,
    };
  }

  /**
   * 获取可用画质列表
   * 从 hls.js 获取所有可用的码率/分辨率级别
   *
   * @returns 画质列表（码率 + 分辨率）
   */
  getQualities(): Array<{ bitrate: number; width: number; height: number }> {
    return this.hlsPlayer?.levels ?? [];
  }

  /**
   * 设置播放画质
   * 切换到指定索引的码率层级（-1 表示自动选择）
   *
   * @param level - 画质级别索引
   */
  setQuality(level: number): void {
    if (this.hlsPlayer) {
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
 * player.use(HlsPlugin());
 *
 * @example
 * // 自定义缓冲配置
 * player.use(HlsPlugin({
 *   maxBufferLength: 60,
 *   autoplay: false
 * }));
 */
export function createHlsPlugin(config?: HlsJsConfig): HlsPlugin {
  return new HlsPlugin(config);
}
