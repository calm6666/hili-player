/**
 * ============================================
 * 视频播放器核心类
 * ============================================
 * 实现播放器的所有核心功能和状态管理
 */

import type {
  PlayerConfig,
  PlayerStateData,
  PlayerMethods,
  PlayerEvents,
  QualitySource,
  ComponentInstance,
  VNode,
  EventListeners,
} from "@/types";
import { PlayerState, QualityLevel, PlayMode } from "@/types";
import "../styles/index.scss";

import {
  h,
  mount,
  destroy,
  createTypedStateManager,
  createTypedEventBus,
} from "@/core";
import type { TypedStateManager, TypedEventBus } from "@/core";
import type { Plugin } from "@/hili-player/core/plugin";
import { PlayerEventEnum, PlayerEventMap } from "@/core/events";
import {
  PlayerStateKeyEnum,
  PlayerStateMap,
  StateContext,
  ConfigContext,
  defaultControlConfig,
} from "@/store/runtimeState";
import { PluginManager } from "@/hili-player/core/pluginManager";
import { createPlayerStore } from "@/hili-player/store";
import type { PlayerStore } from "@/hili-player/store";
import { createLogger, loggerManager, LogLevel } from "@/utils";
import { EventEmitter, fullscreen, pip, clamp } from "../utils";
import { PlayerDocker } from "@/hili-player/components/PlayerDocker";
import { StreamMiddleware, PlayerMode } from "../utils/media/streamMiddleware";
import { StreamFormatEnum } from "@/types/streamPlugin";
import type { StreamPlugin } from "@/types/streamPlugin";

/**
 * 类型守卫：判断插件是否为流媒体插件
 * @param plugin - 插件实例
 * @returns 是否为 StreamPlugin
 */
function isStreamPlugin(plugin: Plugin): plugin is Plugin & StreamPlugin {
  return "load" in plugin && typeof plugin.load === "function";
}
import { BrowserCapabilityDetector } from "../utils/browserCapabilityDetector";
import type { BrowserCapabilityResult } from "../utils/browserCapabilityDetector";

const logger = createLogger("VideoPlayer");

/**
 * 播放器实例映射表
 * 使用 WeakMap 存储，当 DOM 元素被销毁时自动释放引用
 * 避免内存泄漏，同时便于通过 DOM 元素查找播放器实例
 */
const playerInstanceMap = new WeakMap<HTMLElement, VideoPlayer>();

/**
 * 通过 DOM 元素获取播放器实例
 *
 * @param el - 播放器根元素或视频元素
 * @returns 播放器实例，如果不存在则返回 undefined
 */
export function getPlayerInstance(el: HTMLElement): VideoPlayer | undefined {
  // 如果是视频元素，向上查找容器
  if (el.tagName === "VIDEO") {
    const container = el.closest(".hili-player-container");
    if (!(container instanceof HTMLElement)) return undefined;
    return playerInstanceMap.get(container);
  }
  return playerInstanceMap.get(el);
}

/**
 * 默认配置
 */
const defaultConfig: PlayerConfig = {
  src: "",
  container: undefined,
  autoplay: false,
  playerName: "嗨哩播放器",
  muted: false,
  volume: 1,
  playbackRate: 1,
  loop: false,
  poster: "",
  defaultQuality: QualityLevel.AUTO,
  playMode: PlayMode.ORDER,
  keyboard: true,
  subtitles: [],
  danmaku: {
    enabled: false,
    source: "",
    opacity: 0.8,
    speed: 1,
    visible: true,
  },
  progressSegments: [
    {
      startTime: 0,
      endTime: 90,
      pointText: "待填写",
    },
  ],
  ssr: {
    enabled: false,
    deferHydration: false,
  },
  plugins: [],
  debug: false,
};

/**
 * 视频播放器类
 * 实现 ComponentInstance 接口，可作为组件使用
 */
export class VideoPlayer
  implements ComponentInstance<PlayerConfig>, PlayerMethods
{
  /**
   * 播放器配置
   */
  props: PlayerConfig;

  /**
   * 播放器根元素
   */
  el?: HTMLElement;

  /**
   * 视频元素
   */
  private videoEl: HTMLVideoElement | null = null;

  /**
   * 播放器容器元素
   */
  private containerEl: HTMLElement | null = null;

  /**
   * 事件发射器（内部使用）
   */
  private emitter = new EventEmitter<PlayerEvents>();

  /**
   * fullscreenchange 事件处理函数引用（用于清理）
   */
  private fullscreenChangeHandler: (() => void) | null = null;

  /**
   * 状态管理器
   * 提供运行时状态存储（内存状态，不持久化）
   * 类型安全：路径和值类型由 PlayerStateMap 约束
   */
  state: TypedStateManager<PlayerStateMap>;

  /**
   * 持久化状态存储
   * 提供持久化状态管理（localStorage）
   */
  store: PlayerStore;

  /**
   * 事件总线
   * 提供跨组件/插件的事件通信（类型安全）
   */
  events: TypedEventBus<PlayerEventMap>;

  /**
   * 视频源列表
   */
  private sources: QualitySource[] = [];

  /**
   * 当前播放的视频源索引
   */
  private currentSourceIndex = 0;

  /**
   * 当前尝试的备用源索引（用于错误恢复）
   */
  private currentBackupIndex = 0;

  /**
   * 是否正在切换备用源
   */
  private isSwitchingBackup = false;

  /**
   * 虚拟节点引用
   */
  private vnode: VNode | null = null;

  /**
   * 插件管理器
   */
  private pluginManager: PluginManager | null = null;

  /**
   * 流媒体中间件
   * 统一管理 Native 和 Streaming 两种播放模式
   */
  streamMiddleware: StreamMiddleware | null = null;

  /**
   * 浏览器能力检测结果
   */
  private browserCapability: BrowserCapabilityResult | null = null;

  /**
   * 用户回调函数
   */
  private callbacks: EventListeners;

  /**
   * 构造函数
   *
   * @param config - 播放器配置
   */
  constructor(config: PlayerConfig) {
    /**
     * 合并默认配置和用户配置
     */
    this.props = { ...defaultConfig, ...config };

    /**
     * 根据调试模式设置日志级别
     * debug=true → DEBUG 级别（输出所有日志）
     * debug=false → SILENT 级别（不输出任何日志）
     */
    loggerManager.setLevel(this.props.debug ? LogLevel.DEBUG : LogLevel.SILENT);

    /**
     * 处理视频源
     */
    this.processSources();

    /**
     * 初始化持久化状态存储
     * 从 localStorage 读取用户偏好设置
     */
    this.store = createPlayerStore({
      persist: true,
      persistKey: "hili_player_state",
    });

    /**
     * 从持久化存储恢复音量设置
     * 如果配置中未指定，使用存储的值
     */
    const persistentState = this.store.getPersistentState();
    if (this.props.volume === defaultConfig.volume) {
      this.props.volume = persistentState.volume;
    }
    if (this.props.muted === defaultConfig.muted) {
      this.props.muted = persistentState.isMuted;
    }
    if (this.props.playbackRate === defaultConfig.playbackRate) {
      this.props.playbackRate = persistentState.playbackRate;
    }

    /**
     * 初始化运行时状态管理器
     * 管理播放过程中的运行时状态（不持久化）
     * 状态路径与 PlayerStateKeyEnum 枚举值一致（如 'player.volume'）
     */
    this.state = createTypedStateManager<PlayerStateMap>({
      player: {
        state: PlayerState.IDLE,
        currentTime: 0,
        duration: 0,
        volume: this.props.volume,
        muted: this.props.muted,
        playbackRate: this.props.playbackRate,
        buffered: 0,
        isFullscreen: false,
        isPip: false,
        isSeeking: false,
        quality: this.props.defaultQuality,
        playMode: this.props.playMode,
        isLoading: false,
        loadProgress: 0,
        controlsVisible: true,
        controlsHover: false,
        danmakuVisible: true,
        danmakuOpacity: 1,
        danmakuSpeed: 1,
        danmakuDensity: 0.5,
        subtitleVisible: true,
        subtitleLang: "zh-CN",
        errorCode: 0,
        errorMessage: "",
        isWebFullscreen: false,
        isWideScreen: false,
      },
      video: {
        width: 0,
        height: 0,
        aspectRatio: 0,
      },
    });

    /**
     * 初始化事件总线
     */
    this.events = createTypedEventBus<PlayerEventMap>();

    /**
     * 初始化插件管理器
     */
    this.pluginManager = new PluginManager(this);

    /**
     * 存储用户回调函数
     */
    this.callbacks = this.props.callbacks ?? {};

    /**
     * 自动注册配置的插件
     */
    this.registerPlugins();

    /**
     * 检测浏览器能力
     */
    this.detectCapability();
  }

  /**
   * 注册配置的插件
   * 从 PlayerConfig.plugins 中读取插件列表并注册
   */
  private registerPlugins(): void {
    const plugins = this.props.plugins;
    if (!plugins || plugins.length === 0) return;

    plugins.forEach((plugin: Plugin) => {
      this.use(plugin);
    });
  }

  /**
   * 检测浏览器能力
   * 在客户端环境下检测浏览器对流媒体的支持情况
   */
  private detectCapability(): void {
    if (typeof window === "undefined") return;
    this.browserCapability =
      BrowserCapabilityDetector.getFullCapabilityResult();
    this.state.set("browser", this.browserCapability);
  }

  /**
   * SSR 水合
   * 将服务端渲染的 DOM 与播放器实例关联
   * 复用已有 DOM，绑定事件和 ref
   *
   * @param container - 服务端渲染的容器元素
   */
  hydrate(container: HTMLElement): void {
    this.containerEl = container;
    this.el = container;

    /** 查找或创建 video 元素 */
    const existingVideo = container.querySelector("video");
    if (existingVideo instanceof HTMLVideoElement) {
      this.videoEl = existingVideo;
    } else {
      this.videoEl = document.createElement("video");
      const videoWrap = container.querySelector(".player-video-wrap");
      if (videoWrap) {
        videoWrap.appendChild(this.videoEl);
      }
    }

    /** 注册到 WeakMap */
    playerInstanceMap.set(container, this);

    /** 创建流媒体中间件 */
    if (this.videoEl) {
      this.streamMiddleware = new StreamMiddleware(this.videoEl);
    }

    /** 绑定视频事件 */
    this.bindVideoEvents();

    /** 注册插件 */
    this.registerPlugins();

    /** 检测浏览器能力 */
    this.detectCapability();

    /** 触发 ready 事件 */
    this.emitter.emit("ready");
    this.events.emit(PlayerEventEnum.READY);
  }

  /**
   * 处理视频源配置
   * 支持字符串 URL、URL 数组（备用源）或多清晰度源数组
   */
  private processSources(): void {
    const src = this.props.src;

    if (typeof src === "string") {
      // 单个 URL
      this.sources = [
        {
          quality: QualityLevel.AUTO,
          url: src,
          name: "默认",
        },
      ];
    } else if (Array.isArray(src) && src.length > 0) {
      // 判断是字符串数组（备用源）还是 QualitySource 数组（多清晰度）
      if (typeof src[0] === "string") {
        // URL 数组 - 第一个作为主源，其余作为备用源
        const urlArray = src.filter(
          (item): item is string => typeof item === "string",
        );
        this.sources = urlArray.map((url, index) => ({
          quality: index === 0 ? QualityLevel.AUTO : QualityLevel.P1080,
          url,
          name: index === 0 ? "默认" : `备用${index}`,
        }));
      } else {
        // QualitySource 数组 - 多清晰度源
        const qualityArray = src.filter(
          (item): item is QualitySource =>
            typeof item === "object" && "url" in item && "quality" in item,
        );
        this.sources = qualityArray;
      }
    } else {
      this.sources = [];
    }
  }

  /**
   * 渲染播放器
   * 在 SSR 环境下渲染占位符或简化版本
   *
   * @returns 虚拟节点
   */
  render(): VNode {
    /**
     * SSR 环境下渲染占位符
     * 避免在服务端创建视频元素
     */
    return h(PlayerDocker, {
      src: this.getCurrentSourceUrl(),
      playerName: this.props.playerName,
      autoplay: this.props.autoplay,
      volume: this.props.volume,
      muted: this.props.muted,
      events: this.events,
      __providers: [
        { contextId: StateContext.id, value: this.state },
        {
          contextId: ConfigContext.id,
          value:
            typeof this.props.controls === "object"
              ? this.props.controls
              : defaultControlConfig,
        },
      ],
      onMounted: (elements) => {
        // 保存 video 元素引用
        this.videoEl = elements.video;
        this.containerEl = elements.container;
        this.el = elements.container;

        // 注册到 WeakMap
        if (this.containerEl) {
          playerInstanceMap.set(this.containerEl, this);
        }

        // 创建流媒体中间件
        if (this.videoEl) {
          this.streamMiddleware = new StreamMiddleware(this.videoEl);

          // 将已安装的流媒体插件注册到中间件
          // （插件 install 在构造函数中执行，此时 streamMiddleware 尚未创建）
          this.pluginManager?.forEachPlugin((plugin) => {
            if (isStreamPlugin(plugin)) {
              this.streamMiddleware!.registerStreamPlugin(plugin);
            }
          });
        }

        // 绑定视频事件
        this.bindVideoEvents();

        // 触发 ready 事件
        this.emitter.emit("ready");
        this.events.emit(PlayerEventEnum.READY);
        const currentState = this.state.get(PlayerStateKeyEnum.STATE);
        if (currentState !== undefined) {
          this.emitter.emit("statechange", currentState);
        }

        // 触发插件挂载事件（使用插件约定的 'player:mounted' 事件名）
        this.events.emit("player:mounted", {
          container: this.containerEl,
          video: this.videoEl,
          sendingArea: elements.sendingArea,
        });
        // 同时触发标准 MOUNTED 事件
        this.events.emit(PlayerEventEnum.MOUNTED, {
          container: this.containerEl,
          video: this.videoEl,
          sendingArea: elements.sendingArea,
        });

        // 如果有流媒体插件，通过中间件加载源
        if (
          this.streamMiddleware &&
          this.streamMiddleware.getMode() !== PlayerMode.NATIVE
        ) {
          const sourceUrl = this.getCurrentSourceUrl();
          if (sourceUrl) {
            const format = this.detectStreamFormat(sourceUrl);
            this.streamMiddleware.load({ url: sourceUrl, format });
          }
        }

        // 自动播放
        if (this.props.autoplay) {
          void this.play();
        }
      },
    });
  }

  /**
   * 绑定视频元素事件
   * 同步运行时状态到 Store，并触发用户回调
   */
  private bindVideoEvents(): void {
    if (!this.videoEl) return;

    // 视频加载开始 → 设置加载中状态
    this.videoEl.addEventListener("loadstart", () => {
      this.store.setLoading(true);
      this.state.set(PlayerStateKeyEnum.IS_LOADING, true);
      this.setState(PlayerState.LOADING);
    });

    // 视频元数据加载完成 → 清除加载状态，更新时长
    this.videoEl.addEventListener("loadedmetadata", () => {
      this.store.setLoading(false);
      this.store.setDuration(this.videoEl?.duration || 0);
      this.state.set(PlayerStateKeyEnum.IS_LOADING, false);
      this.state.set(PlayerStateKeyEnum.DURATION, this.videoEl?.duration || 0);
      this.setState(PlayerState.IDLE);
    });

    // 视频可播放 → 清除等待状态
    this.videoEl.addEventListener("canplay", () => {
      this.store.setWaiting(false);
      this.events.emit(PlayerEventEnum.CAN_PLAY);
      this.callbacks.canplay?.();
    });

    // 视频缓冲中 → 设置等待状态
    this.videoEl.addEventListener("waiting", () => {
      this.store.setWaiting(true);
      this.events.emit(PlayerEventEnum.WAITING);
      this.callbacks.waiting?.();
    });

    // 视频播放结束 → 同步结束状态
    this.videoEl.addEventListener("ended", () => {
      this.store.setPlaying(false);
      this.store.setEnded(true);
      this.setState(PlayerState.ENDED);
      this.events.emit(PlayerEventEnum.ENDED);
      this.callbacks.ended?.();
    });

    // 进度更新 → 同步缓冲进度
    this.videoEl.addEventListener("progress", () => {
      if (this.videoEl && this.videoEl.buffered.length > 0) {
        const bufferedEnd = this.videoEl.buffered.end(
          this.videoEl.buffered.length - 1,
        );
        this.store.setBuffered(bufferedEnd);
        this.state.set(PlayerStateKeyEnum.BUFFERED, bufferedEnd);
        this.callbacks.progress?.(this.videoEl.buffered);
      }
    });

    // 时间更新 → 同步当前播放时间（高频更新，仅更新运行时StateManager）
    this.videoEl.addEventListener("timeupdate", () => {
      const currentTime = this.videoEl?.currentTime || 0;
      const duration = this.videoEl?.duration || 0;
      this.state.set(PlayerStateKeyEnum.CURRENT_TIME, currentTime);
      this.events.emit(PlayerEventEnum.TIME_UPDATE, { time: currentTime });
      this.callbacks.timeupdate?.(currentTime, duration);
    });

    // 视频错误事件 - 用于备用源切换
    this.videoEl.addEventListener("error", () => this.handleVideoError());

    // 全屏变化监听（浏览器原生全屏事件）
    this.fullscreenChangeHandler = (): void => {
      const isFullscreen = !!document.fullscreenElement;
      this.state.set(PlayerStateKeyEnum.IS_FULLSCREEN, isFullscreen);
      this.store.setScreenMode(isFullscreen ? "fullscreen" : "normal");
      this.events.emit(PlayerEventEnum.FULLSCREEN_CHANGE, { isFullscreen });
      this.callbacks.fullscreenchange?.(isFullscreen);
    };
    document.addEventListener("fullscreenchange", this.fullscreenChangeHandler);
  }

  /**
   * 获取当前视频源 URL
   */
  private getCurrentSourceUrl(): string {
    if (this.sources.length === 0) return "";
    return this.sources[this.currentSourceIndex]?.url || this.sources[0].url;
  }

  /**
   * 根据源 URL 推断流媒体格式
   * @param url - 视频/流媒体源 URL
   * @returns 对应的 StreamFormatEnum 值
   */
  private detectStreamFormat(url: string): StreamFormatEnum {
    const lower = url.split("?")[0].toLowerCase();
    if (lower.endsWith(".m3u8") || /hls/i.test(url))
      return StreamFormatEnum.HLS;
    if (lower.endsWith(".mpd") || /dash/i.test(url))
      return StreamFormatEnum.DASH;
    if (lower.endsWith(".flv") || /flv/i.test(url)) return StreamFormatEnum.FLV;
    // JSON manifest 默认按 DASH 处理（HLS manifest 文件名中含 hls）
    if (lower.endsWith(".json"))
      return /hls/i.test(url) ? StreamFormatEnum.HLS : StreamFormatEnum.DASH;
    return StreamFormatEnum.MP4;
  }

  /**
   * 切换到下一个备用源
   * 当当前视频源加载失败时调用
   * @returns 是否成功切换到备用源
   */
  private switchToNextBackupSource(): boolean {
    // 检查是否还有备用源可用
    if (this.currentBackupIndex >= this.sources.length - 1) {
      logger.error("所有备用源都已尝试，无法播放");
      this.events.emit(PlayerEventEnum.ERROR, {
        error: "ALL_SOURCES_FAILED",
        code: undefined,
        message: "所有视频源都无法播放",
      });
      return false;
    }

    // 切换到下一个备用源
    this.currentBackupIndex++;
    this.isSwitchingBackup = true;

    const backupSource = this.sources[this.currentBackupIndex];
    logger.info(`切换到备用源 ${this.currentBackupIndex}: ${backupSource.url}`);

    // 保存当前播放状态
    const wasPlaying = this.videoEl ? !this.videoEl.paused : false;
    const currentTime = this.videoEl ? this.videoEl.currentTime : 0;

    // 更新当前源索引
    this.currentSourceIndex = this.currentBackupIndex;

    // 更新视频源
    if (this.videoEl) {
      this.videoEl.src = backupSource.url;
      this.videoEl.load();

      // 恢复播放位置
      this.videoEl.currentTime = currentTime;

      // 恢复播放状态
      if (wasPlaying) {
        void this.videoEl.play().catch(() => {
          // 播放失败，继续尝试下一个备用源
          this.switchToNextBackupSource();
        });
      }
    }

    this.isSwitchingBackup = false;

    // 触发源切换事件
    this.events.emit(PlayerEventEnum.QUALITY_CHANGE, {
      quality: backupSource.quality,
      name: backupSource.name,
      isBackup: true,
    });

    return true;
  }

  /**
   * 处理视频错误事件
   * 尝试切换到备用源
   */
  private handleVideoError(): void {
    if (!this.videoEl || this.isSwitchingBackup) return;

    const error = this.videoEl.error;
    if (!error) return;

    // 重置加载状态，防止播放按钮被永久禁用（pointer-events: none）
    this.store.setLoading(false);
    this.state.set(PlayerStateKeyEnum.IS_LOADING, false);

    // 错误码说明：
    // 1 = MEDIA_ERR_ABORTED - 获取过程被用户中止
    // 2 = MEDIA_ERR_NETWORK - 网络错误
    // 3 = MEDIA_ERR_DECODE - 解码错误
    // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED - 不支持的视频格式

    logger.error(`视频错误: ${error.code} - ${error.message}`);

    // 网络错误或源不支持时尝试切换备用源
    if (error.code === 2 || error.code === 4) {
      const switched = this.switchToNextBackupSource();
      if (!switched) {
        // 所有备用源都失败，触发错误事件
        this.events.emit(PlayerEventEnum.ERROR, {
          error,
          code: error.code,
          message: error.message || "视频加载失败",
        });
      }
    } else {
      this.events.emit(PlayerEventEnum.ERROR, {
        error,
        code: error.code,
        message: error.message || "视频播放错误",
      });
    }
  }

  /**
   * 挂载播放器到容器
   *
   * @param container - 容器元素
   */
  mount(container: HTMLElement): void {
    /**
     * 渲染虚拟节点
     */
    this.vnode = this.render();

    /**
     * 挂载到容器
     */
    mount(this.vnode, container);

    // 注意：初始化逻辑已移到 PlayerDocker 的 onMounted 回调中
  }

  /**
   * 设置播放器状态
   *
   * @param state - 新状态
   */
  private setState(state: PlayerState): void {
    const prevState = this.state.get(PlayerStateKeyEnum.STATE);
    if (prevState !== state) {
      this.state.set(PlayerStateKeyEnum.STATE, state);
      this.emitter.emit("statechange", state);
      // 使用枚举替代字符串
      this.events.emit(PlayerEventEnum.STATE_CHANGE, state);
      this.callbacks.statechange?.(state);
    }
  }

  // ============================================
  // 公共 API 方法
  // ============================================

  /**
   * 使用插件（支持链式调用）
   *
   * @param plugin - 插件实例
   * @returns 当前播放器实例，支持链式调用
   *
   * @example
   * // 单个插件
   * player.use(DanmakuPlugin({ renderMode: RenderMode.DOM }))
   *
   * @example
   * // 链式调用多个插件
   * player
   *   .use(DanmakuPlugin({ renderMode: RenderMode.DOM }))
   *   .use(StatsPlugin())
   */
  use(plugin: Plugin): VideoPlayer {
    if (!this.pluginManager) {
      logger.error("插件管理器未初始化");
      return this;
    }
    this.pluginManager.install(plugin);
    return this;
  }

  /**
   * 获取已安装的插件
   *
   * @param name - 插件名称
   * @returns 插件实例，未安装则返回 undefined
   */
  getPlugin<T extends Plugin>(name: string): T | undefined {
    return this.pluginManager?.get<T>(name);
  }

  /**
   * 获取已安装插件的完整 API
   * 与 getPlugin 不同，此方法返回插件的完整 API 接口
   * 例如：player.getPluginAPI<DanmakuPluginAPI>('danmaku') 可获取弹幕插件的全部方法
   *
   * @param name - 插件名称
   * @returns 插件 API 实例，未安装则返回 undefined
   *
   * @example
   * const danmaku = player.getPluginAPI<DanmakuPluginAPI>('danmaku');
   * danmaku?.send({ text: '你好', time: 0, type: 1, id: 1 });
   * danmaku?.setOpacity(0.8);
   */
  getPluginAPI<T extends Plugin>(name: string): T | undefined {
    return this.pluginManager?.get<T>(name);
  }

  /**
   * 卸载插件
   *
   * @param name - 插件名称
   */
  uninstallPlugin(name: string): void {
    this.pluginManager?.uninstall(name);
  }

  /**
   * 播放视频
   * 同步更新运行时状态（isPlaying/isPaused/isEnded）到 Store
   */
  async play(): Promise<void> {
    if (!this.videoEl) return;
    try {
      await this.videoEl.play();

      // 播放成功后再发事件和更新状态
      this.store.setPlaying(true);
      this.store.setPaused(false);
      this.store.setEnded(false);
      this.setState(PlayerState.PLAYING);
      this.events.emit(PlayerEventEnum.PLAY);
      this.callbacks.play?.();
    } catch (error) {
      logger.error("播放失败:", error);
      this.events.emit(PlayerEventEnum.ERROR, { error });
    }
  }

  /**
   * 暂停视频
   * 同步更新运行时状态（isPlaying/isPaused）到 Store
   */
  pause(): void {
    if (!this.videoEl) return;
    this.videoEl.pause();

    // 同步运行时状态到 Store：已暂停
    this.store.setPlaying(false);
    this.store.setPaused(true);
    this.setState(PlayerState.PAUSED);
    this.events.emit(PlayerEventEnum.PAUSE);
    this.callbacks.pause?.();
  }

  /**
   * 切换播放/暂停
   */
  toggle(): void {
    const currentState = this.state.get(PlayerStateKeyEnum.STATE);
    if (currentState === PlayerState.PLAYING) {
      this.pause();
    } else {
      void this.play();
    }
  }

  /**
   * 跳转到指定时间
   *
   * @param time - 目标时间（秒）
   */
  seek(time: number): void {
    if (!this.videoEl) return;
    const duration = this.state.get(PlayerStateKeyEnum.DURATION);
    if (!duration || !isFinite(duration)) return;

    const clampedTime = clamp(time, 0, duration);
    const prevTime = this.state.get(PlayerStateKeyEnum.CURRENT_TIME) ?? 0;

    // 发出 SEEK_START 事件
    this.events.emit(PlayerEventEnum.SEEK_START, {
      time: clampedTime,
      previousTime: prevTime,
    });
    this.videoEl.currentTime = clampedTime;

    // 发出 SEEK_END 事件（video seeking 事件会在实际 seek 完成后触发，这里发出主动 seek 的通知）
    this.events.emit(PlayerEventEnum.SEEK_END, {
      time: clampedTime,
      previousTime: prevTime,
    });
  }

  /**
   * 设置音量
   *
   * @param volume - 音量值 (0-1)
   */
  setVolume(volume: number): void {
    const clampedVolume = clamp(volume, 0, 1);
    const isMuted = clampedVolume === 0;

    // 更新运行时状态
    this.state.set(PlayerStateKeyEnum.VOLUME, clampedVolume);
    this.state.set(PlayerStateKeyEnum.MUTED, isMuted);

    // 更新持久化状态
    this.store.setVolume(clampedVolume);
    this.store.setMuted(isMuted);

    if (this.videoEl) {
      this.videoEl.volume = clampedVolume;
      this.videoEl.muted = isMuted;
    }

    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.VOLUME_CHANGE, {
      volume: clampedVolume,
      muted: isMuted,
    });
    this.callbacks.volumechange?.(clampedVolume, isMuted);
  }

  /**
   * 切换静音
   */
  toggleMute(): void {
    const currentVolume = this.state.get(PlayerStateKeyEnum.VOLUME) ?? 1;
    const currentMuted = this.state.get(PlayerStateKeyEnum.MUTED) ?? false;
    this.setVolume(currentVolume);
    this.setMuted(!currentMuted);
  }

  /**
   * 设置静音状态
   *
   * @param muted - 是否静音
   */
  setMuted(muted: boolean): void {
    // 更新运行时状态
    this.state.set(PlayerStateKeyEnum.MUTED, muted);

    // 更新持久化状态
    this.store.setMuted(muted);

    if (this.videoEl) {
      this.videoEl.muted = muted;
    }

    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.MUTED_CHANGE, muted);
  }

  /**
   * 设置播放速度
   *
   * @param rate - 播放速度
   */
  setPlaybackRate(rate: number): void {
    // 更新运行时状态
    this.state.set(PlayerStateKeyEnum.PLAYBACK_RATE, rate);

    // 更新持久化状态
    this.store.setPlaybackRate(rate);

    if (this.videoEl) {
      this.videoEl.playbackRate = rate;
    }

    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.RATE_CHANGE, rate);
    this.callbacks.ratechange?.(rate);
  }

  /**
   * 切换全屏
   * 同步屏幕模式到 Store（normal / fullscreen）
   */
  async toggleFullscreen(): Promise<void> {
    if (!this.containerEl) return;
    const wasFullscreen = fullscreen.isActive();
    await fullscreen.toggle(this.containerEl);
    const isNowFullscreen = !wasFullscreen;

    // 同步屏幕模式到 Store
    this.store.setScreenMode(isNowFullscreen ? "fullscreen" : "normal");
    this.state.set(PlayerStateKeyEnum.IS_FULLSCREEN, isNowFullscreen);
    this.events.emit(PlayerEventEnum.FULLSCREEN_CHANGE, {
      isFullscreen: isNowFullscreen,
    });
  }

  /**
   * 切换画中画
   * 同步画中画状态到 Store
   */
  async togglePip(): Promise<void> {
    if (!this.videoEl) return;
    const wasPip = pip.isActive();
    await pip.toggle(this.videoEl);
    const isNowPip = !wasPip;

    // 同步画中画状态到 Store
    this.store.setPip(isNowPip);
    this.state.set(PlayerStateKeyEnum.IS_PIP, isNowPip);
    this.events.emit(PlayerEventEnum.PIP_CHANGE, { isPip: isNowPip });
  }

  /**
   * 切换画质
   *
   * @param quality - 目标画质
   */
  setQuality(quality: QualityLevel): void {
    const currentQuality = this.state.get(PlayerStateKeyEnum.QUALITY);
    if (quality === currentQuality) return;

    const wasPlaying =
      this.state.get(PlayerStateKeyEnum.STATE) === PlayerState.PLAYING;
    const currentTime = this.state.get(PlayerStateKeyEnum.CURRENT_TIME) ?? 0;

    this.state.set(PlayerStateKeyEnum.QUALITY, quality);

    if (quality === QualityLevel.AUTO) {
      this.currentSourceIndex = 0;
    } else {
      const index = this.sources.findIndex((s) => s.quality === quality);
      if (index !== -1) {
        this.currentSourceIndex = index;
      }
    }

    if (this.videoEl) {
      this.videoEl.src = this.getCurrentSourceUrl();
      this.videoEl.currentTime = currentTime;

      if (wasPlaying) {
        void this.play();
      }
    }

    this.events.emit(PlayerEventEnum.QUALITY_CHANGE, quality);
    this.callbacks.qualitychange?.(quality);

    const currentSource = this.sources[this.currentSourceIndex];
    if (currentSource && currentSource.width && currentSource.height) {
      this.events.emit(PlayerEventEnum.STREAM_QUALITY_CHANGE, {
        width: currentSource.width,
        height: currentSource.height,
        bitrate: currentSource.bitrate,
        isAuto: false,
      });
    }
  }

  /**
   * 重新加载视频
   * 重置错误状态和加载状态，重新加载视频源
   */
  reload(): void {
    if (!this.videoEl) return;
    // 重置错误状态
    this.state.set(PlayerStateKeyEnum.ERROR_CODE, 0);
    this.state.set(PlayerStateKeyEnum.ERROR_MESSAGE, "");
    // 同步 Store：进入加载状态
    this.store.setLoading(true);
    this.store.setEnded(false);
    this.videoEl.load();
    this.setState(PlayerState.IDLE);
  }

  /**
   * 销毁播放器
   * 暂停播放、销毁插件、移除事件监听、清理所有引用
   * 同步重置 Store 的运行时状态
   */
  destroy(): void {
    // 暂停播放
    this.pause();

    // 重置 Store 运行时状态
    this.store.setPlaying(false);
    this.store.setPaused(true);
    this.store.setEnded(false);
    this.store.setLoading(false);
    this.store.setWaiting(false);

    // 销毁插件管理器
    this.pluginManager?.destroy();
    this.pluginManager = null;

    // 移除事件监听
    this.emitter.removeAllListeners();

    // 移除全屏变化监听
    if (this.fullscreenChangeHandler) {
      document.removeEventListener(
        "fullscreenchange",
        this.fullscreenChangeHandler,
      );
      this.fullscreenChangeHandler = null;
    }

    /**
     * 销毁虚拟节点
     */
    if (this.vnode) {
      destroy(this.vnode);
    }

    /**
     * 从 WeakMap 中移除
     * 虽然 WeakMap 会自动清理，但显式移除更明确
     */
    if (this.containerEl) {
      playerInstanceMap.delete(this.containerEl);
    }

    /**
     * 清理引用
     */
    this.videoEl = null;
    this.containerEl = null;
    this.vnode = null;
  }

  /**
   * 获取当前状态
   *
   * @returns 播放器状态数据
   */
  getState(): PlayerStateData {
    const fullState = this.state.getState();
    const isRecord = (val: unknown): val is Record<string, unknown> =>
      typeof val === "object" && val !== null && !Array.isArray(val);
    const playerState: Record<string, unknown> = isRecord(fullState.player)
      ? fullState.player
      : {};
    const videoState: Record<string, unknown> = isRecord(fullState.video)
      ? fullState.video
      : {};

    // 类型谓词
    const isNumber = (v: unknown): v is number => typeof v === "number";
    const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";
    const qualityLevelValues: ReadonlySet<string> = new Set(
      Object.values(QualityLevel),
    );
    const isQualityLevel = (v: unknown): v is QualityLevel =>
      typeof v === "string" && qualityLevelValues.has(v);

    // 计算宽高比
    const videoWidth = videoState.videoWidth;
    const videoHeight = videoState.videoHeight;
    const aspectRatio =
      isNumber(videoWidth) && isNumber(videoHeight)
        ? videoWidth / videoHeight
        : 16 / 9;

    // 安全获取 PlayerState
    const getPlayerState = (value: unknown): PlayerState => {
      if (value === PlayerState.PLAYING) return PlayerState.PLAYING;
      if (value === PlayerState.PAUSED) return PlayerState.PAUSED;
      if (value === PlayerState.ENDED) return PlayerState.ENDED;
      if (value === PlayerState.ERROR) return PlayerState.ERROR;
      if (value === PlayerState.LOADING) return PlayerState.LOADING;
      return PlayerState.IDLE;
    };

    return {
      state: getPlayerState(playerState.state),
      currentTime: isNumber(playerState.currentTime)
        ? playerState.currentTime
        : 0,
      duration: isNumber(playerState.duration) ? playerState.duration : 0,
      volume: isNumber(playerState.volume) ? playerState.volume : 1,
      muted: isBoolean(playerState.muted) ? playerState.muted : false,
      playbackRate: isNumber(playerState.playbackRate)
        ? playerState.playbackRate
        : 1,
      quality: isQualityLevel(playerState.quality)
        ? playerState.quality
        : QualityLevel.AUTO,
      isFullscreen: isBoolean(playerState.isFullscreen)
        ? playerState.isFullscreen
        : false,
      isPip: isBoolean(playerState.isPip) ? playerState.isPip : false,
      buffered:
        playerState.buffered instanceof TimeRanges
          ? playerState.buffered
          : null,
      aspectRatio,
    };
  }

  /**
   * 注册事件监听
   *
   * @param event - 事件名
   * @param callback - 回调函数
   */
  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
    this.emitter.on(event, callback);
  }

  /**
   * 移除事件监听
   *
   * @param event - 事件名
   * @param callback - 回调函数
   */
  off<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
    this.emitter.off(event, callback);
  }

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 挂载前钩子
   */
  onBeforeMount(): void {
    // 可以在这里进行预处理
  }

  /**
   * 挂载完成钩子
   */
  onMounted(): void {
    // 可以在这里进行初始化后的处理
  }

  /**
   * 销毁前钩子
   */
  onBeforeDestroy(): void {
    this.pause();
  }

  /**
   * 销毁完成钩子
   */
  onDestroyed(): void {
    // 清理工作已在 destroy 方法中完成
  }
}
