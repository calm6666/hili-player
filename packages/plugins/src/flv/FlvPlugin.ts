/**
 * ============================================
 * FLV 流媒体插件 (FlvPlugin)
 * ============================================
 * 基于 flv.js 的 FLV 格式流媒体播放器插件
 *
 * 功能：
 * - 动态加载 flv.js 库
 * - 支持直播和点播模式
 * - 支持 HTTP-FLV 协议
 * - 提供缓冲、码率等实时统计信息
 * - 通过事件总线与播放器和其他插件通信
 * - 自动检测浏览器兼容性（依赖 MSE）
 *
 * 使用方式：
 * import { FlvPlugin } from '@hili-player/plugins';
 * const player = new VideoPlayer({
 *   plugins: [FlvPlugin({ isLive: true })]
 * });
 */

import type { Plugin } from '@hili-player/player';
import type { VideoPlayer } from '@hili-player/player';
import type { StreamPlugin, StreamConfig, BufferInfo, StreamStats } from '../stream/types';
import type { EventBus } from '@/core/eventBus';
import { StreamPluginTypeEnum, StreamPluginEventEnum } from '../stream/enums';
import { BrowserCapabilityDetector } from '@/hili-player/utils/browserCapabilityDetector';
import { createLogger } from '@/utils';

const logger = createLogger('FlvPlugin');

/**
 * FLV.js 播放器实例接口
 * 定义 flv.js FlvPlayer 的核心 API
 */
interface FlvJsPlayer {
  /** 绑定视频元素 */
  attachMediaElement(video: HTMLVideoElement): void;
  /** 加载 FLV 流 */
  load(): void;
  /** 开始播放 */
  play(): Promise<void>;
  /** 暂停播放 */
  pause(): void;
  /** 卸载流 */
  unload(): void;
  /** 销毁实例 */
  destroy(): void;
  /** 跳转到指定时间 */
  seek(time: number): void;
  /** 绑定事件监听 */
  on(event: string, listener: (...args: unknown[]) => void): void;
  /** 移除事件监听 */
  off(event: string, listener: (...args: unknown[]) => void): void;
  /** 当前缓冲区间（只读） */
  readonly buffered: TimeRanges | null;
  /** 视频总时长（只读） */
  readonly duration: number;
  /** 当前音量（只读） */
  readonly volume: number;
  /** 是否静音（只读） */
  readonly muted: boolean;
  /** 当前播放时间（只读） */
  readonly currentTime: number;
  /** 媒体信息（编码、分辨率等） */
  mediaInfo?: {
    width?: number;
    height?: number;
    fps?: number;
    profile?: string;
    level?: string;
    chromaFormat?: string;
    audiocodec?: string;
    videocodec?: string;
  };
}

/**
 * FLV.js 模块接口
 * 定义 flv.js 模块的静态结构
 */
interface FlvJsModule {
  /** 创建 FLV 播放器实例 */
  createPlayer(config: {
    type: 'flv';
    url: string;
    isLive?: boolean;
    hasAudio?: boolean;
    hasVideo?: boolean;
    enableStashBuffer?: boolean;
    stashInitialSize?: number;
    lazyLoadMaxDuration?: number;
  }): FlvJsPlayer;
  /** 检测浏览器是否支持 flv.js */
  isSupported(): boolean;
  /** 获取特性列表 */
  getFeatureList(): {
    mseLivePlayback: boolean;
    msePlayback: boolean;
  };
  /** 事件常量映射 */
  Events: {
    LOADING_COMPLETE: string;
    RECOVERED_EARLY_EOF: string;
    MEDIA_INFO: string;
    METADATA_ARRIVED: string;
    SCRIPTDATA_ARRIVED: string;
    STATISTICS_INFO: string;
    BUFFER_EOS: string;
    ERROR: string;
  };
}

/**
 * FLV 插件配置
 */
interface FlvJsConfig {
  /** 是否自动播放，默认 true */
  autoplay?: boolean;
  /** 是否直播模式，默认 false */
  isLive?: boolean;
  /** 是否启用隐藏缓冲区（用于 seek 后恢复） */
  enableStashBuffer?: boolean;
  /** 隐藏缓冲区的初始大小（KB） */
  stashInitialSize?: number;
  /** 懒加载最大时长（秒，点播模式有效） */
  lazyLoadMaxDuration?: number;
}

/**
 * 类型谓词：检查 player:mounted 事件数据是否包含有效的 HTMLVideoElement
 */
function isMountedDataWithVideo(data: unknown): data is { video: HTMLVideoElement } {
  if (data === null || typeof data !== 'object') return false;
  if (!('video' in data)) return false;
  const video = data.video;
  return video instanceof HTMLVideoElement;
}

/**
 * 类型谓词：检查动态导入的模块是否符合 FlvJsModule 接口
 */
function isFlvJsModule(mod: unknown): mod is FlvJsModule {
  return (
    mod !== null &&
    typeof mod === 'object' &&
    'createPlayer' in mod &&
    'isSupported' in mod &&
    'Events' in mod
  );
}

/**
 * 类型谓词：检查对象是否为包含 StreamStats 部分字段的对象
 */
function isPartialStreamStats(value: unknown): value is Partial<StreamStats> {
  if (value === null || typeof value !== 'object') return false;
  const obj = value;
  const knownKeys: (keyof StreamStats)[] = [
    'downloadSpeed', 'videoBitrate', 'audioBitrate', 'dropRate',
    'bufferLength', 'currentTime', 'duration', 'firstFrameTime',
    'totalStallCount', 'totalStallTime', 'videoCodec', 'audioCodec', 'resolution',
  ];
  return knownKeys.some((key) => key in obj);
}

/**
 * FLV 流媒体插件类
 * 实现 Plugin 和 StreamPlugin 接口
 * 基于 flv.js 提供 FLV 格式视频播放能力
 */
export class FlvPlugin implements Plugin, StreamPlugin {
  /** 插件名称（必须唯一） */
  readonly name = 'flv';
  /** 插件版本号 */
  readonly version = '1.0.0';
  /** 插件描述 */
  readonly description = 'FLV 格式流媒体播放器插件，基于 flv.js';
  /** 插件类型 */
  readonly type = StreamPluginTypeEnum.FLV;

  /** flv.js 播放器实例 */
  private flvPlayer: FlvJsPlayer | null = null;

  /** flv.js 模块引用（动态导入后缓存） */
  private flvjs: FlvJsModule | null = null;

  /** 视频元素（从播放器获取） */
  videoElement: HTMLVideoElement | null = null;

  /** 事件总线（从播放器获取） */
  eventBus: EventBus | null = null;

  /** 播放器实例引用 */
  private player: VideoPlayer | null = null;

  /** 当前流媒体配置 */
  private config: StreamConfig | null = null;

  /** 插件自定义配置 */
  private pluginConfig: FlvJsConfig;

  /** 统计信息缓存 */
  private stats: Partial<StreamStats> = {};

  /** 上次卡顿开始时间（用于计算卡顿总时长） */
  private lastStallTime = 0;

  /** 浏览器能力检测结果 */
  private browserCapability: ReturnType<typeof BrowserCapabilityDetector.getFullCapabilityResult> | null = null;

  /**
   * 构造函数
   * @param config - FLV 插件配置
   */
  constructor(config?: FlvJsConfig) {
    this.pluginConfig = {
      autoplay: true,
      isLive: false,
      enableStashBuffer: true,
      stashInitialSize: 128,       // 128KB 隐藏缓冲区
      lazyLoadMaxDuration: 3 * 60, // 点播模式最多懒加载 3 分钟
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

    // 检测浏览器能力（FLV 依赖 MSE）
    this.browserCapability = BrowserCapabilityDetector.getFullCapabilityResult();
    logger.info(
      `浏览器能力检测: FLV支持=${this.browserCapability.flvjsSupported}, ` +
      `MSE支持=${this.browserCapability.mseSupported}, ` +
      `浏览器=${this.browserCapability.browserName} ${this.browserCapability.browserVersion}`
    );

    // 如果浏览器不支持 FLV（缺少 MSE），发出警告
    if (!this.browserCapability.flvjsSupported) {
      logger.warn(
        '当前浏览器不支持 FLV 协议（缺少 MSE 支持），' +
        '插件已安装但可能无法正常工作'
      );
    }

    // 监听播放器挂载完成事件，获取视频元素
    player.events.on('player:mounted', (data: unknown) => {
      if (isMountedDataWithVideo(data)) {
        this.videoElement = data.video;
        logger.info('已获取视频元素');
      }
    });

    logger.info('插件已安装');
  }

  /**
   * 卸载插件
   * 清理所有资源：销毁 flv.js 实例、释放引用
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
   * 检查浏览器是否支持 flv.js 播放
   * 优先使用缓存的检测结果，否则实时检测
   *
   * @returns 是否支持 flv.js
   */
  isSupported(): boolean {
    // 优先使用安装时缓存的检测结果
    if (this.browserCapability) {
      return this.browserCapability.flvjsSupported;
    }
    // 降级：实时检测
    if (typeof window === 'undefined') return false;
    return BrowserCapabilityDetector.isFlvjsSupported();
  }

  /**
   * 加载 FLV 流媒体
   * 动态导入 flv.js 库，创建播放器实例并绑定到视频元素
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

    // 动态导入 flv.js（按需加载，减小初始包体积）
    import('flv.js')
      .then((flvjs) => {
        // flv.js 的默认导出是 flvjs 对象
        if (!isFlvJsModule(flvjs)) {
          const msg = '动态导入的 flv.js 模块结构不符合预期';
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

        // 创建 flv.js 播放器实例（传入详细配置）
        this.flvPlayer = this.flvjs.createPlayer({
          type: 'flv',
          url: config.url,
          isLive: config.isLive ?? this.pluginConfig.isLive,
          hasAudio: true,
          hasVideo: true,
          enableStashBuffer: this.pluginConfig.enableStashBuffer,
          stashInitialSize: this.pluginConfig.stashInitialSize,
          lazyLoadMaxDuration: this.pluginConfig.lazyLoadMaxDuration,
        });

        // 绑定 flv.js 内置事件
        this.bindEvents();

        // 绑定到视频元素并加载
        this.flvPlayer.attachMediaElement(this.videoElement);
        this.flvPlayer.load();

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

        logger.info('FLV 流加载成功:', config.url);
      })
      .catch((err) => {
        const msg = `加载 flv.js 失败: ${err instanceof Error ? err.message : String(err)}`;
        logger.error(msg);
        this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      });
  }

  /**
   * 绑定 flv.js 核心事件
   * 将 flv.js 的内部事件转换为统一的 StreamPlugin 事件
   */
  private bindEvents(): void {
    if (!this.flvPlayer || !this.flvjs) return;

    const Events = this.flvjs.Events;

    // 播放器错误处理
    this.flvPlayer.on(Events.ERROR, (...args: unknown[]) => {
      const [first, second] = args;
      const errorType = typeof first === 'string' ? first : String(first);
      const errorDetail = typeof second === 'string' ? second : String(second);
      logger.error('播放器错误:', errorType, errorDetail);
      this.eventBus?.emit(StreamPluginEventEnum.ERROR, {
        type: errorType,
        detail: errorDetail,
      });
    });

    // 媒体信息就绪 → 获取编码、分辨率等信息
    this.flvPlayer.on(Events.MEDIA_INFO, () => {
      const mediaInfo = this.flvPlayer?.mediaInfo;
      logger.info('媒体信息:', mediaInfo);
      this.eventBus?.emit(StreamPluginEventEnum.METADATA_LOADED, mediaInfo);
    });

    // 元数据到达（如脚本数据、SEI 等）
    this.flvPlayer.on(Events.METADATA_ARRIVED, (metadata: unknown) => {
      logger.info('元数据到达:', metadata);
    });

    // 加载完成 → 记录缓冲开始
    this.flvPlayer.on(Events.LOADING_COMPLETE, () => {
      this.lastStallTime = Date.now();
      this.eventBus?.emit(StreamPluginEventEnum.BUFFER_START, {});
    });

    // 缓冲结束 → 计算卡顿时长
    this.flvPlayer.on(Events.BUFFER_EOS, () => {
      if (this.lastStallTime > 0) {
        const stallDuration = Date.now() - this.lastStallTime;
        this.stats.totalStallTime = (this.stats.totalStallTime || 0) + stallDuration;
        this.stats.totalStallCount = (this.stats.totalStallCount || 0) + 1;
        this.lastStallTime = 0;
      }
      this.eventBus?.emit(StreamPluginEventEnum.BUFFER_END, {});
    });

    // 统计信息定期更新 → 更新下载速度等指标
    this.flvPlayer.on(Events.STATISTICS_INFO, (stats: unknown) => {
      if (isPartialStreamStats(stats)) {
        this.stats = { ...this.stats, ...stats };
      }
      this.eventBus?.emit(StreamPluginEventEnum.STATS_UPDATE, this.getStats());
    });

    // 提前结束恢复
    this.flvPlayer.on(Events.RECOVERED_EARLY_EOF, () => {
      logger.info('提前结束已恢复');
    });
  }

  /**
   * 开始播放
   * 使用 flv.js 的 play 方法（确保流正确启动）
   */
  play(): void {
    if (this.flvPlayer) {
      this.flvPlayer.play()
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
   * 使用 flv.js 的 pause 方法（同时暂停内部数据拉取）
   */
  pause(): void {
    if (this.flvPlayer) {
      this.flvPlayer.pause();
      this.eventBus?.emit(StreamPluginEventEnum.PLAY_PAUSE, {});
    }
  }

  /**
   * 跳转到指定时间
   * 使用 flv.js 的 seek 方法确保精确跳转
   *
   * @param time - 目标时间（秒）
   */
  seek(time: number): void {
    if (this.flvPlayer) {
      this.flvPlayer.seek(time);
    }
  }

  /**
   * 销毁播放器实例
   * 暂停、卸载、销毁 flv.js 实例，清理所有引用
   */
  destroy(): void {
    if (this.flvPlayer) {
      this.flvPlayer.pause();
      this.flvPlayer.unload();
      this.flvPlayer.destroy();
      this.flvPlayer = null;
    }
    this.config = null;
    this.stats = {};
    this.lastStallTime = 0;
  }

  /**
   * 获取缓冲信息
   * 优先使用 flv.js 的内部缓冲区间，否则降级使用 video.buffered
   *
   * @returns 缓冲信息（起始时间、结束时间、缓冲长度）
   */
  getBufferInfo(): BufferInfo {
    const video = this.videoElement;
    // 优先使用 flv.js 内部维护的缓冲区间
    const buffered = this.flvPlayer?.buffered;

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
   * 收集当前播放器状态，包括播放时间、缓冲长度、编码信息等
   *
   * @returns 流媒体统计信息
   */
  getStats(): Partial<StreamStats> {
    const video = this.videoElement;
    const bufferInfo = this.getBufferInfo();
    const mediaInfo = this.flvPlayer?.mediaInfo;

    return {
      ...this.stats,
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      bufferLength: bufferInfo.length,
      firstFrameTime: 0,
      totalStallCount: this.stats.totalStallCount || 0,
      totalStallTime: this.stats.totalStallTime || 0,
      videoCodec: mediaInfo?.videocodec,
      audioCodec: mediaInfo?.audiocodec,
      resolution: mediaInfo?.width && mediaInfo?.height
        ? { width: mediaInfo.width, height: mediaInfo.height }
        : undefined,
    };
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
 * FLV 插件工厂函数
 * 创建并返回一个新的 FlvPlugin 实例
 *
 * @param config - FLV 插件配置
 * @returns FlvPlugin 实例
 *
 * @example
 * // 基本用法（点播）
 * player.use(FlvPlugin());
 *
 * @example
 * // 直播模式
 * player.use(FlvPlugin({
 *   isLive: true,
 *   autoplay: true
 * }));
 */
export function createFlvPlugin(config?: FlvJsConfig): FlvPlugin {
  return new FlvPlugin(config);
}
