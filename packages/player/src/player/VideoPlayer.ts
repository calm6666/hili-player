/**
 * ============================================
 * 视频播放器核心类
 * ============================================
 * 实现播放器的所有核心功能和状态管理
 */

import type {
  PlayerConfig,
  PlayerState,
  PlayerStateData,
  PlayerMethods,
  PlayerEvents,
  QualitySource,
  ComponentInstance,
  VNode,
} from '@/types';
// @ts-ignore - SCSS side-effect import
import '@/hili-player/styles/index.scss'

import { PlayerState as PlayerStateEnum, QualityLevel, PlayMode } from '@/types';
import { h, mount, destroy, createStateManager, createEventBus } from '@/core';
import type { StateManager, EventBus } from '@/core';
import type { Plugin } from '@/hili-player/core/plugin';
import { PlayerEventEnum, PlayerMethodEnum, PlayerStateKeyEnum } from '@/core/events';
import { PluginManager } from '@/hili-player/core/pluginManager';
import { createPlayerStore } from '@/hili-player/store';
import type { PlayerStore } from '@/hili-player/store';
import { formatTime, isServer, createSSRConfig, type SSRConfig } from '@/utils';
import { createLogger, loggerManager, LogLevel } from '@/utils';
import { EventEmitter, fullscreen, pip, clamp } from '../utils';
import { PlayerDocker, type PlayerDockerProps } from '@/hili-player/components/PlayerDocker';

const logger = createLogger('VideoPlayer');

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
  if (el.tagName === 'VIDEO') {
    const container = el.closest('.hili-player-container');
    if (!(container instanceof HTMLElement)) return undefined;
    return playerInstanceMap.get(container);
  }
  return playerInstanceMap.get(el);
}

/**
 * 默认配置
 */
const defaultConfig: PlayerConfig = {
  src: '',
  container: undefined,
  autoplay: false,
  playerName: '嗨哩播放器',
  muted: false,
  volume: 1,
  playbackRate: 1,
  controls: true,
  loop: false,
  preload: 'metadata',
  poster: '',
  defaultQuality: QualityLevel.AUTO,
  playMode: PlayMode.ORDER,
  keyboard: true,
  pip: true,
  fullscreen: true,
  subtitles: [],
  danmaku: {
    enabled: false,
    source: '',
    opacity: 0.8,
    speed: 1,
    visible: true,
  },
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
export class VideoPlayer implements ComponentInstance<PlayerConfig>, PlayerMethods {
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
   * 状态管理器
   * 提供运行时状态存储（内存状态，不持久化）
   */
  state: StateManager;

  /**
   * 持久化状态存储
   * 提供持久化状态管理（localStorage）
   */
  store: PlayerStore;

  /**
   * 事件总线
   * 提供跨组件/插件的事件通信
   */
  events: EventBus;

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
   * SSR 配置
   */
  private ssrConfig: SSRConfig;

  /**
   * 插件管理器
   */
  private pluginManager: PluginManager | null = null;

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
     * 初始化 SSR 配置
     */
    this.ssrConfig = createSSRConfig(this.props.ssr);

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
      persistKey: 'hili_player_state',
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
     */
    this.state = createStateManager({
      player: {
        state: PlayerStateEnum.IDLE,
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
      },
      video: {
        width: 0,
        height: 0,
        videoWidth: 0,
        videoHeight: 0,
      },
      error: {
        code: 0,
        message: '',
      },
    });

    /**
     * 初始化事件总线
     */
    this.events = createEventBus();

    /**
     * 初始化插件管理器
     */
    this.pluginManager = new PluginManager(this);

    /**
     * 自动注册配置的插件
     */
    this.registerPlugins();
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
   * 处理视频源配置
   * 支持字符串 URL、URL 数组（备用源）或多清晰度源数组
   */
  private processSources(): void {
    const src = this.props.src;

    if (typeof src === 'string') {
      // 单个 URL
      this.sources = [{
        quality: QualityLevel.AUTO,
        url: src,
        name: '默认',
      }];
    } else if (Array.isArray(src) && src.length > 0) {
      // 判断是字符串数组（备用源）还是 QualitySource 数组（多清晰度）
      if (typeof src[0] === 'string') {
        // URL 数组 - 第一个作为主源，其余作为备用源
        const urlArray = src.filter((item): item is string => typeof item === 'string');
        this.sources = urlArray.map((url, index) => ({
          quality: index === 0 ? QualityLevel.AUTO : QualityLevel.P1080,
          url,
          name: index === 0 ? '默认' : `备用${index}`,
        }));
      } else {
        // QualitySource 数组 - 多清晰度源
        const qualityArray = src.filter((item): item is QualitySource => typeof item === 'object' && 'url' in item && 'quality' in item);
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
    // if (isServer() && this.ssrConfig.enabled) {
    //   return 
    // }

    // 使用 PlayerDocker 组件渲染播放器 UI
    return h(PlayerDocker, {
      src: this.getCurrentSourceUrl(),
      playerName: this.props.playerName,
      autoplay: this.props.autoplay,
      volume: this.props.volume,
      muted: this.props.muted,
      onMounted: (elements: NonNullable<PlayerDockerProps['onMounted']> extends (e: infer E) => void ? E : never) => {
        // 保存 video 元素引用
        this.videoEl = elements.video;
        this.containerEl = elements.container;
        this.el = elements.container;

        // 注册到 WeakMap
        if (this.containerEl) {
          playerInstanceMap.set(this.containerEl, this);
        }

        // 绑定视频事件 - 同步运行时状态到 Store
        if (this.videoEl) {
          // 视频加载开始 → 设置加载中状态
          this.videoEl.addEventListener('loadstart', () => {
            this.store.setLoading(true);
            this.state.set(PlayerStateKeyEnum.IS_LOADING, true);
            this.setState(PlayerStateEnum.LOADING);
          });

          // 视频元数据加载完成 → 清除加载状态，更新时长
          this.videoEl.addEventListener('loadedmetadata', () => {
            this.store.setLoading(false);
            this.store.setDuration(this.videoEl?.duration || 0);
            this.state.set(PlayerStateKeyEnum.IS_LOADING, false);
            this.state.set(PlayerStateKeyEnum.DURATION, this.videoEl?.duration || 0);
            this.setState(PlayerStateEnum.IDLE);
          });

          // 视频可播放 → 清除等待状态
          this.videoEl.addEventListener('canplay', () => {
            this.store.setWaiting(false);
            this.events.emit(PlayerEventEnum.CAN_PLAY, undefined);
          });

          // 视频缓冲中 → 设置等待状态
          this.videoEl.addEventListener('waiting', () => {
            this.store.setWaiting(true);
            this.events.emit(PlayerEventEnum.WAITING, undefined);
          });

          // 视频播放结束 → 同步结束状态
          this.videoEl.addEventListener('ended', () => {
            this.store.setPlaying(false);
            this.store.setEnded(true);
            this.setState(PlayerStateEnum.ENDED);
            this.events.emit(PlayerEventEnum.ENDED, undefined);
          });

          // 进度更新 → 同步缓冲进度
          this.videoEl.addEventListener('progress', () => {
            if (this.videoEl && this.videoEl.buffered.length > 0) {
              const bufferedEnd = this.videoEl.buffered.end(this.videoEl.buffered.length - 1);
              this.store.setBuffered(bufferedEnd);
              this.state.set(PlayerStateKeyEnum.BUFFERED, bufferedEnd);
            }
          });

          // 时间更新 → 同步当前播放时间（高频更新，仅更新运行时StateManager）
          this.videoEl.addEventListener('timeupdate', () => {
            const currentTime = this.videoEl?.currentTime || 0;
            this.state.set(PlayerStateKeyEnum.CURRENT_TIME, currentTime);
            this.events.emit(PlayerEventEnum.TIME_UPDATE, { time: currentTime });
          });

          // 视频错误事件 - 用于备用源切换
          this.videoEl.addEventListener('error', () => this.handleVideoError());

          // 全屏变化监听（浏览器原生全屏事件）
          document.addEventListener('fullscreenchange', () => {
            const isFullscreen = !!document.fullscreenElement;
            this.state.set(PlayerStateKeyEnum.IS_FULLSCREEN, isFullscreen);
            this.store.setScreenMode(isFullscreen ? 'fullscreen' : 'normal');
            this.events.emit(PlayerEventEnum.FULLSCREEN_CHANGE, { isFullscreen });
          });
        }

        // 触发 ready 事件
        this.emitter.emit('ready');
        this.events.emit(PlayerEventEnum.READY, undefined);
        const currentState = this.state.get<PlayerState>(PlayerStateKeyEnum.STATE);
        if (currentState) {
          this.emitter.emit('statechange', currentState);
        }

        // 触发插件挂载事件
        this.events.emit(PlayerEventEnum.MOUNTED, {
          container: this.containerEl,
          video: this.videoEl,
        });

        // 自动播放
        if (this.props.autoplay) {
          void this.play();
        }
      },
    });
  }

  /**
   * 获取当前视频源 URL
   */
  private getCurrentSourceUrl(): string {
    if (this.sources.length === 0) return '';
    return this.sources[this.currentSourceIndex]?.url || this.sources[0].url;
  }

  /**
   * 获取可用画质列表
   */
  private getAvailableQualities(): QualityLevel[] {
    const qualities = this.sources.map(s => s.quality);
    if (qualities.length > 1 && !qualities.includes(QualityLevel.AUTO)) {
      return [QualityLevel.AUTO, ...qualities];
    }
    return qualities;
  }

  /**
   * 切换到下一个备用源
   * 当当前视频源加载失败时调用
   * @returns 是否成功切换到备用源
   */
  private switchToNextBackupSource(): boolean {
    // 检查是否还有备用源可用
    if (this.currentBackupIndex >= this.sources.length - 1) {
      logger.error('所有备用源都已尝试，无法播放');
      this.events.emit(PlayerEventEnum.ERROR, {
        code: 'ALL_SOURCES_FAILED',
        message: '所有视频源都无法播放',
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
          code: error.code,
          message: error.message || '视频加载失败',
        });
      }
    } else {
      // 其他错误直接触发错误事件
      this.events.emit(PlayerEventEnum.ERROR, {
        code: error.code,
        message: error.message || '视频播放错误',
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
      this.emitter.emit('statechange', state);
      // 使用枚举替代字符串
      this.events.emit(PlayerEventEnum.STATE_CHANGE, state);
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
      logger.error('插件管理器未初始化');
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
      this.events.emit(PlayerEventEnum.PLAY, undefined);
      await this.videoEl.play();

      // 同步运行时状态到 Store：播放中
      this.store.setPlaying(true);
      this.store.setPaused(false);
      this.store.setEnded(false);
      this.setState(PlayerStateEnum.PLAYING);
    } catch (error) {
      logger.error('播放失败:', error);
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
    this.setState(PlayerStateEnum.PAUSED);
    this.events.emit(PlayerEventEnum.PAUSE, undefined);
  }

  /**
   * 切换播放/暂停
   */
  toggle(): void {
    const currentState = this.state.get(PlayerStateKeyEnum.STATE);
    if (currentState === PlayerStateEnum.PLAYING) {
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
    const duration = this.state.get<number>(PlayerStateKeyEnum.DURATION);
    if (!duration || !isFinite(duration)) return;

    const clampedTime = clamp(time, 0, duration);
    const prevTime = this.state.get<number>(PlayerStateKeyEnum.CURRENT_TIME) ?? 0;

    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.TIME_UPDATE, {
      time: clampedTime,
      previousTime: prevTime,
    });
    this.videoEl.currentTime = clampedTime;
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
    this.events.emit(PlayerEventEnum.VOLUME_CHANGE, { volume: clampedVolume, muted: isMuted });
  }

  /**
   * 切换静音
   */
  toggleMute(): void {
    const currentVolume = this.state.get<number>(PlayerStateKeyEnum.VOLUME) ?? 1;
    const currentMuted = this.state.get<boolean>(PlayerStateKeyEnum.MUTED) ?? false;
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
    this.store.setScreenMode(isNowFullscreen ? 'fullscreen' : 'normal');
    this.state.set(PlayerStateKeyEnum.IS_FULLSCREEN, isNowFullscreen);
    this.events.emit(PlayerEventEnum.FULLSCREEN_CHANGE, { isFullscreen: isNowFullscreen });
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
    const currentQuality = this.state.get<QualityLevel>(PlayerStateKeyEnum.QUALITY);
    if (quality === currentQuality) return;

    const wasPlaying = this.state.get(PlayerStateKeyEnum.STATE) === PlayerStateEnum.PLAYING;
    const currentTime = this.state.get<number>(PlayerStateKeyEnum.CURRENT_TIME) ?? 0;

    // 更新运行时状态
    this.state.set(PlayerStateKeyEnum.QUALITY, quality);

    /**
     * 找到对应画质的视频源
     */
    if (quality === QualityLevel.AUTO) {
      this.currentSourceIndex = 0;
    } else {
      const index = this.sources.findIndex(s => s.quality === quality);
      if (index !== -1) {
        this.currentSourceIndex = index;
      }
    }

    /**
     * 切换视频源
     */
    if (this.videoEl) {
      this.videoEl.src = this.getCurrentSourceUrl();
      this.videoEl.currentTime = currentTime;

      if (wasPlaying) {
        void this.play();
      }
    }

    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.QUALITY_CHANGE, quality);
  }

  /**
   * 重新加载视频
   * 重置错误状态和加载状态，重新加载视频源
   */
  reload(): void {
    if (!this.videoEl) return;
    // 重置错误状态
    this.state.set(PlayerStateKeyEnum.ERROR_CODE, 0);
    this.state.set(PlayerStateKeyEnum.ERROR_MESSAGE, '');
    // 同步 Store：进入加载状态
    this.store.setLoading(true);
    this.store.setEnded(false);
    this.videoEl.load();
    this.setState(PlayerStateEnum.IDLE);
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
    const playerState = this.state.get<Record<string, unknown>>('player') ?? {};
    const videoState = this.state.get<Record<string, unknown>>('video') ?? {};

    // 类型谓词
    const isNumber = (v: unknown): v is number => typeof v === 'number';
    const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
    const isQualityLevel = (v: unknown): v is QualityLevel => typeof v === 'string' && (Object.values(QualityLevel) as string[]).includes(v);

    // 计算宽高比
    const videoWidth = videoState.videoWidth;
    const videoHeight = videoState.videoHeight;
    const aspectRatio = isNumber(videoWidth) && isNumber(videoHeight)
      ? videoWidth / videoHeight
      : 16 / 9;

    // 安全获取 PlayerState
    const getPlayerState = (value: unknown): PlayerState => {
      if (value === PlayerStateEnum.PLAYING) return PlayerStateEnum.PLAYING;
      if (value === PlayerStateEnum.PAUSED) return PlayerStateEnum.PAUSED;
      if (value === PlayerStateEnum.ENDED) return PlayerStateEnum.ENDED;
      if (value === PlayerStateEnum.ERROR) return PlayerStateEnum.ERROR;
      if (value === PlayerStateEnum.LOADING) return PlayerStateEnum.LOADING;
      return PlayerStateEnum.IDLE;
    };

    return {
      state: getPlayerState(playerState.state),
      currentTime: isNumber(playerState.currentTime) ? playerState.currentTime : 0,
      duration: isNumber(playerState.duration) ? playerState.duration : 0,
      volume: isNumber(playerState.volume) ? playerState.volume : 1,
      muted: isBoolean(playerState.muted) ? playerState.muted : false,
      playbackRate: isNumber(playerState.playbackRate) ? playerState.playbackRate : 1,
      quality: isQualityLevel(playerState.quality) ? playerState.quality : QualityLevel.AUTO,
      isFullscreen: isBoolean(playerState.isFullscreen) ? playerState.isFullscreen : false,
      isPip: isBoolean(playerState.isPip) ? playerState.isPip : false,
      buffered: playerState.buffered instanceof TimeRanges ? playerState.buffered : null,
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
