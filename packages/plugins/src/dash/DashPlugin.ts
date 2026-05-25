/**
 * ============================================
 * DASH 流媒体插件 (DashPlugin)
 * ============================================
 * 基于 dash.js 的 DASH 格式流媒体播放器插件
 *
 * 功能：
 * - 动态加载 dash.js 库
 * - 支持自适应码率切换 (ABR)
 * - 提供缓冲、码率、帧率等实时统计信息
 * - 通过事件总线与播放器和其他插件通信
 * - 自动检测浏览器兼容性
 *
 * 使用方式：
 * import { DashPlugin } from '@hili-player/plugins';
 * const player = new VideoPlayer({
 *   plugins: [DashPlugin({ autoplay: true })]
 * });
 */

import type { Plugin } from '@hili-player/player';
import type { VideoPlayer } from '@hili-player/player';
import type { StreamPlugin, StreamConfig, BufferInfo, StreamStats } from '../stream/types';
import type { EventBus } from '@/core/eventBus';
import { StreamPluginTypeEnum, StreamPluginEventEnum } from '../stream/enums';
import { BrowserCapabilityDetector } from '@/hili-player/utils/browserCapabilityDetector';
import { createLogger } from '@/utils';

const logger = createLogger('DashPlugin');

/**
 * DASH.js 播放器实例接口
 * 定义 dash.js MediaPlayer 的核心 API
 */
interface DashJsPlayer {
  /** 初始化播放器，绑定视频元素和源 */
  initialize(video: HTMLVideoElement, source: string, autoplay: boolean): void;
  /** 重置播放器状态 */
  reset(): void;
  /** 销毁播放器实例 */
  destroy(): void;
  /** 跳转到指定时间 */
  seek(time: number): void;
  /** 绑定事件监听 */
  on(event: string, callback: (data: unknown) => void): void;
  /** 移除事件监听 */
  off(event: string, callback: (data: unknown) => void): void;
  /** 获取指定类型的码率信息列表 */
  getBitrateInfoListFor(type: 'video' | 'audio'): Array<{
    bitrate: number;
    width: number;
    height: number;
  }>;
  /** 获取当前画质索引 */
  getQualityFor(type: 'video' | 'audio'): number;
  /** 设置画质 */
  setQualityFor(type: 'video' | 'audio', quality: number): void;
  /** 更新播放器设置 */
  updateSettings(settings: Record<string, unknown>): void;
}

/**
 * DASH.js 模块接口
 * 定义 dash.js 模块的静态结构
 */
interface DashJsModule {
  MediaPlayer: {
    /** 创建 MediaPlayer 实例 */
    create(): DashJsPlayer;
  };
}

/**
 * DASH 插件配置
 */
interface DashJsConfig {
  /** 是否自动播放，默认 true */
  autoplay?: boolean;
  /** ABR 自适应码率配置 */
  streaming?: {
    abr?: {
      /** 是否自动切换码率 */
      autoSwitchBitrate?: boolean;
    };
    buffer?: {
      /** 是否启用快速切换 */
      fastSwitchEnabled?: boolean;
    };
  };
}

/**
 * DASH 流媒体插件类
 * 实现 Plugin 和 StreamPlugin 接口
 * 基于 dash.js 提供 DASH 格式视频播放能力
 */

/**
 * 类型谓词函数：验证动态导入的模块是否符合 DashJsModule 接口
 * @param mod - 动态导入的模块
 * @returns 是否为 DashJsModule 类型
 */
function isDashJsModule(mod: unknown): mod is DashJsModule {
  return (
    mod !== null &&
    typeof mod === 'object' &&
    'MediaPlayer' in mod &&
    mod.MediaPlayer !== null &&
    typeof mod.MediaPlayer === 'object' &&
    'create' in mod.MediaPlayer &&
    typeof mod.MediaPlayer.create === 'function'
  );
}

export class DashPlugin implements Plugin, StreamPlugin {
  /** 插件名称（必须唯一） */
  readonly name = 'dash';
  /** 插件版本号 */
  readonly version = '1.0.0';
  /** 插件描述 */
  readonly description = 'DASH 格式流媒体播放器插件，基于 dash.js';
  /** 插件类型 */
  readonly type = StreamPluginTypeEnum.DASH;

  /** dash.js 播放器实例 */
  private dashPlayer: DashJsPlayer | null = null;

  /** dash.js 模块引用（动态导入后缓存） */
  private dashjs: DashJsModule | null = null;

  /** 视频元素（从播放器获取） */
  videoElement: HTMLVideoElement | null = null;

  /** 事件总线（从播放器获取） */
  eventBus: EventBus | null = null;

  /** 播放器实例引用 */
  private player: VideoPlayer | null = null;

  /** 当前流媒体配置 */
  private config: StreamConfig | null = null;

  /** 插件自定义配置 */
  private pluginConfig: DashJsConfig;

  /** 统计信息缓存 */
  private stats: Partial<StreamStats> = {};

  /** 上次卡顿开始时间（用于计算卡顿总时长） */
  private lastStallTime = 0;

  /** 浏览器能力检测结果 */
  private browserCapability: ReturnType<typeof BrowserCapabilityDetector.getFullCapabilityResult> | null = null;

  /**
   * 构造函数
   * @param config - DASH 插件配置
   */
  constructor(config?: DashJsConfig) {
    this.pluginConfig = {
      autoplay: true,
      streaming: {
        abr: {
          autoSwitchBitrate: true,
        },
        buffer: {
          fastSwitchEnabled: true,
        },
      },
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

    // 检测浏览器能力（DASH 依赖 MSE）
    this.browserCapability = BrowserCapabilityDetector.getFullCapabilityResult();
    logger.info(
      `浏览器能力检测: DASH支持=${this.browserCapability.dashSupported}, ` +
      `MSE支持=${this.browserCapability.mseSupported}, ` +
      `浏览器=${this.browserCapability.browserName} ${this.browserCapability.browserVersion}`
    );

    // 如果浏览器不支持 DASH，发出警告但仍然安装（允许后续降级处理）
    if (!this.browserCapability.dashSupported) {
      logger.warn(
        '当前浏览器不支持 DASH 协议（缺少 MSE 支持），' +
        '插件已安装但可能无法正常工作'
      );
    }

    // 监听播放器挂载完成事件，获取视频元素
    player.events.on('player:mounted', (data: unknown) => {
      if (data !== null && typeof data === 'object' && 'video' in data) {
        const video = data.video;
        if (video instanceof HTMLVideoElement) {
          this.videoElement = video;
          logger.info('已获取视频元素');
        }
      }
    });

    logger.info('插件已安装');
  }

  /**
   * 卸载插件
   * 清理所有资源：销毁 dash.js 实例、释放引用
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
   * 检查浏览器是否支持 DASH 播放
   * 优先使用缓存的检测结果，否则实时检测
   *
   * @returns 是否支持 DASH
   */
  isSupported(): boolean {
    // 优先使用安装时缓存的检测结果
    if (this.browserCapability) {
      return this.browserCapability.dashSupported;
    }
    // 降级：实时检测
    return BrowserCapabilityDetector.isDASHSupported();
  }

  /**
   * 加载 DASH 流媒体
   * 动态导入 dash.js 库，创建播放器实例并绑定到视频元素
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

    // 检查浏览器兼容性
    if (!this.isSupported()) {
      const msg = `当前浏览器不支持 DASH 播放（${this.browserCapability?.browserName || '未知'} ${this.browserCapability?.browserVersion || ''}），需要 MSE 支持`;
      logger.error(msg);
      this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      return;
    }

    // 动态导入 dash.js（按需加载，减小初始包体积）
    import('dashjs')
      .then((dashjs) => {
        // 验证模块结构并缓存引用
        if (!isDashJsModule(dashjs)) {
          const msg = '动态导入的 dash.js 模块结构不符合预期';
          logger.error(msg);
          this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
          return;
        }
        this.dashjs = dashjs;

        if (!this.videoElement) {
          const msg = '视频元素已被移除，无法加载';
          logger.error(msg);
          this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
          return;
        }

        // 保存配置
        this.config = config;

        // 创建 dash.js 播放器实例
        this.dashPlayer = this.dashjs.MediaPlayer.create();

        // 应用用户自定义设置
        if (this.pluginConfig.streaming) {
          this.dashPlayer.updateSettings({
            streaming: this.pluginConfig.streaming,
          });
        }

        // 绑定 dash.js 内置事件
        this.bindEvents();

        // 初始化播放器（绑定视频元素、设置源、自动播放）
        this.dashPlayer.initialize(
          this.videoElement,
          config.url,
          this.pluginConfig.autoplay ?? true
        );

        // 通知外部：加载完成
        this.eventBus?.emit(StreamPluginEventEnum.LOAD_COMPLETE, { url: config.url });

        // 如果指定了起始时间，跳转到对应位置
        if (config.startTime && config.startTime > 0) {
          this.seek(config.startTime);
        }

        logger.info('DASH 流加载成功:', config.url);
      })
      .catch((err) => {
        const msg = `加载 dash.js 失败: ${err instanceof Error ? err.message : String(err)}`;
        logger.error(msg);
        this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: msg });
      });
  }

  /**
   * 绑定 dash.js 核心事件
   * 将 dash.js 的内部事件转换为统一的 StreamPlugin 事件
   */
  private bindEvents(): void {
    if (!this.dashPlayer) return;

    // 流初始化完成 → 元数据就绪
    this.dashPlayer.on('streamInitialized', () => {
      logger.info('流初始化完成');
      this.eventBus?.emit(StreamPluginEventEnum.METADATA_LOADED, {});
    });

    // 缓冲停滞开始 → 记录卡顿开始时间
    this.dashPlayer.on('bufferStalled', () => {
      this.lastStallTime = Date.now();
      this.eventBus?.emit(StreamPluginEventEnum.BUFFER_START, {});
    });

    // 缓冲加载完成 → 计算卡顿时长
    this.dashPlayer.on('bufferLoaded', () => {
      if (this.lastStallTime > 0) {
        const stallDuration = Date.now() - this.lastStallTime;
        this.stats.totalStallTime = (this.stats.totalStallTime || 0) + stallDuration;
        this.stats.totalStallCount = (this.stats.totalStallCount || 0) + 1;
        this.lastStallTime = 0;
      }
      this.eventBus?.emit(StreamPluginEventEnum.BUFFER_END, {});
    });

    // 播放器错误处理
    this.dashPlayer.on('error', (data: unknown) => {
      if (
        data !== null &&
        typeof data === 'object' &&
        'error' in data && typeof data.error === 'string' &&
        'event' in data && typeof data.event === 'string'
      ) {
        const errorData = { error: data.error, event: data.event };
        logger.error('播放器错误:', errorData);
        this.eventBus?.emit(StreamPluginEventEnum.ERROR, errorData);
      } else {
        logger.error('播放器错误:', data);
        this.eventBus?.emit(StreamPluginEventEnum.ERROR, { message: String(data) });
      }
    });

    // 画质切换完成 → 更新统计信息
    this.dashPlayer.on('qualityChangeRendered', () => {
      this.eventBus?.emit(StreamPluginEventEnum.STATS_UPDATE, this.getStats());
    });

    // 片段加载完成 → 更新统计信息
    this.dashPlayer.on('fragmentLoadingCompleted', (_data: unknown) => {
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
   * 使用 dash.js 的 seek 方法确保精确跳转
   *
   * @param time - 目标时间（秒）
   */
  seek(time: number): void {
    if (this.dashPlayer) {
      this.dashPlayer.seek(time);
    }
  }

  /**
   * 销毁播放器实例
   * 重置并销毁 dash.js 播放器，清理所有引用
   */
  destroy(): void {
    if (this.dashPlayer) {
      this.dashPlayer.reset();
      this.dashPlayer.destroy();
      this.dashPlayer = null;
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
    const videoQuality = this.dashPlayer?.getQualityFor('video');
    const bitrates = this.dashPlayer?.getBitrateInfoListFor('video');
    const currentBitrate = bitrates?.[videoQuality ?? 0];

    return {
      ...this.stats,
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      bufferLength: bufferInfo.length,
      firstFrameTime: 0,
      totalStallCount: this.stats.totalStallCount || 0,
      totalStallTime: this.stats.totalStallTime || 0,
      videoBitrate: currentBitrate?.bitrate,
      resolution: currentBitrate?.width && currentBitrate?.height
        ? { width: currentBitrate.width, height: currentBitrate.height }
        : undefined,
    };
  }

  /**
   * 获取可用画质列表
   * 从 dash.js 获取所有可用的视频码率/分辨率列表
   *
   * @returns 画质列表（码率 + 分辨率）
   */
  getQualities(): Array<{ bitrate: number; width: number; height: number }> {
    return this.dashPlayer?.getBitrateInfoListFor('video') ?? [];
  }

  /**
   * 设置播放画质
   * 切换到指定索引的码率层级
   *
   * @param quality - 画质索引
   */
  setQuality(quality: number): void {
    if (this.dashPlayer) {
      this.dashPlayer.setQualityFor('video', quality);
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
 * DASH 插件工厂函数
 * 创建并返回一个新的 DashPlugin 实例
 *
 * @param config - DASH 插件配置
 * @returns DashPlugin 实例
 *
 * @example
 * // 基本用法
 * player.use(DashPlugin());
 *
 * @example
 * // 自定义配置
 * player.use(DashPlugin({
 *   autoplay: false,
 *   streaming: {
 *     abr: { autoSwitchBitrate: true }
 *   }
 * }));
 */
export function createDashPlugin(config?: DashJsConfig): DashPlugin {
  return new DashPlugin(config);
}
