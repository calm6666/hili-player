/**
 * ============================================
 * 视频播放器核心类型定义模块
 * ============================================
 * 定义播放器所需的所有类型、接口和枚举
 */

// ============================================
// 虚拟节点相关类型
// ============================================

/**
 * 生命周期钩子接口
 * 定义组件在挂载和销毁时的回调函数
 */
export interface Lifecycle {
  /** 挂载前钩子，在 DOM 插入之前调用 */
  onBeforeMount?: () => void;
  /** 挂载完成钩子，在 DOM 插入之后调用 */
  onMounted?: () => void;
  /** 销毁前钩子，在 DOM 移除之前调用 */
  onBeforeDestroy?: () => void;
  /** 销毁完成钩子，在 DOM 移除之后调用 */
  onDestroyed?: () => void;
}

/**
 * 回调函数类型
 */
export type CallbackFunction = (...args: unknown[]) => void;

/**
 * 组件内部回调接口
 * 允许组件内部触发函数回调通知外部
 */
export interface ComponentCallbacks {
  /** 回调函数映射表 */
  [key: string]: CallbackFunction;
}

/**
 * 扩展的生命周期接口，包含内部回调支持
 */
export interface ComponentLifecycle extends Lifecycle {
  /** 内部回调函数映射表 */
  _callbacks?: ComponentCallbacks;
  /** 注册回调函数 */
  on?: (event: string, callback: CallbackFunction) => void;
  /** 触发回调函数 */
  emit?: (event: string, ...args: unknown[]) => void;
}

/**
 * 虚拟节点属性类型
 */
export type VNodeAttrs = Record<string, unknown>;

/**
 * 虚拟节点子元素类型
 */
export type VNodeChild = VNode | string;

/**
 * 虚拟节点接口
 * 描述 DOM 结构的纯数据对象
 */
export interface VNode {
  /** 标签名或组件函数/类 */
  tag: string | Component<unknown>;
  /** 属性对象，包含 HTML 属性、事件、指令等 */
  attrs: VNodeAttrs;
  /** 子节点数组，可以是 VNode 或字符串 */
  children: VNodeChild[];
  /** 挂载后对应的真实 DOM 节点引用 */
  el?: HTMLElement | Text;
  /** 生命周期对象引用（扩展版本，支持内部回调） */
  lifecycle?: ComponentLifecycle;
  /** 清理函数数组，用于移除事件监听和指令 */
  _cleanups?: (() => void)[];
  /** 内部使用的命名空间标记（用于 SVG） */
  __ns?: string;
}

// ============================================
// 组件相关类型
// ============================================

/**
 * 函数组件类型
 * 接收 props 返回 VNode 的纯函数
 */
export type FnComponent<P = unknown> = (props: P) => VNode;

/**
 * 类组件构造函数类型
 */
export interface ClassComponent<P = unknown> {
  /** 构造函数签名 */
  new (props: P): ComponentInstance<P>;
}

/**
 * 组件实例接口
 * 类组件必须实现的接口
 */
export interface ComponentInstance<P = unknown> {
  /** 组件接收的属性 */
  props: P;
  /** 组件根元素引用 */
  el?: HTMLElement;
  /** 渲染方法，返回虚拟节点 */
  render(): VNode;
  /** 挂载前生命周期钩子 */
  onBeforeMount?(): void;
  /** 挂载完成生命周期钩子 */
  onMounted?(): void;
  /** 销毁前生命周期钩子 */
  onBeforeDestroy?(): void;
  /** 销毁完成生命周期钩子 */
  onDestroyed?(): void;
}

/**
 * 组件类型联合
 * 可以是函数组件或类组件
 */
export type Component<P = unknown> = FnComponent<P> | ClassComponent<P>;

/**
 * 通用组件类型
 * 用于 h 函数接收任意 props 的组件
 */
export type GenericComponent = FnComponent<unknown> | ClassComponent<unknown>;

// ============================================
// 指令相关类型
// ============================================

/**
 * 指令函数类型
 * 接收元素和值，可选返回清理函数
 */
export type Directive<T = unknown> = (el: HTMLElement, value: T) => (() => void) | void;

/**
 * 指令元组类型
 * 用于在 attrs.directives 中定义指令
 */
export type DirectiveTuple<T = unknown> = [Directive<T>, T];

// ============================================
// 播放器状态枚举
// ============================================

/**
 * 播放器状态枚举
 * 表示视频播放的各种状态
 */
export enum PlayerState {
  /** 初始状态，尚未加载 */
  IDLE = 'idle',
  /** 正在加载视频 */
  LOADING = 'loading',
  /** 已加载，准备播放 */
  READY = 'ready',
  /** 正在播放 */
  PLAYING = 'playing',
  /** 暂停状态 */
  PAUSED = 'paused',
  /** 播放结束 */
  ENDED = 'ended',
  /** 发生错误 */
  ERROR = 'error',
  /** 正在缓冲 */
  BUFFERING = 'buffering',
}

/**
 * 播放模式枚举
 */
export enum PlayMode {
  /** 顺序播放 */
  ORDER = 'order',
  /** 列表循环 */
  LOOP = 'loop',
  /** 单曲循环 */
  SINGLE_LOOP = 'singleLoop',
  /** 随机播放 */
  RANDOM = 'random',
}

/**
 * 画质等级枚举
 */
export enum QualityLevel {
  /** 自动选择 */
  AUTO = 'auto',
  /** 4K 超清 */
  P4K = '4k',
  /** 1080P 高清 */
  P1080 = '1080p',
  /** 720P 标清 */
  P720 = '720p',
  /** 480P 流畅 */
  P480 = '480p',
  /** 360P 省流 */
  P360 = '360p',
}

import type { Plugin } from '@/hili-player/core/plugin';

// ============================================
// 播放器配置接口
// ============================================

/**
 * 播放器配置接口
 * 初始化播放器时的配置选项
 */
export interface PlayerConfig {
  /** 容器元素或选择器 */
  container?: HTMLElement | string;
  /** 视频源 URL、URL 数组（备用源）或多清晰度源数组 */
  src: string | string[] | QualitySource[];
  /** 自动播放 */
  autoplay?: boolean;
  /** 默认静音 */
  muted?: boolean;
  /** 默认音量 (0-1) */
  volume?: number;
  /** 默认播放速度 */
  playbackRate?: number;
  /** 是否显示控制条 */
  controls?: boolean;
  /** 是否循环播放 */
  loop?: boolean;
  /** 是否预加载 */
  preload?: 'none' | 'metadata' | 'auto';
  /** 封面图 URL */
  poster?: string;
  /** 默认画质 */
  defaultQuality?: QualityLevel;
  /** 播放模式 */
  playMode?: PlayMode;
  /** 是否启用键盘快捷键 */
  keyboard?: boolean;
  /** 是否启用画中画 */
  pip?: boolean;
  /** 是否启用全屏 */
  fullscreen?: boolean;

  /** 播放器名称 */
  playerName?: string;
  /** 字幕配置 */
  subtitles?: SubtitleConfig[];
  /** 弹幕配置 */
  danmaku?: DanmakuConfig;
  /** SSR 配置 */
  ssr?: SSRConfig;
  /** 插件配置列表 */
  /** 插件列表 */
  plugins?: Plugin[];
  /** 是否开启调试模式（开启后输出详细日志，关闭则静默） */
  debug?: boolean;
}

/**
 * SSR 配置接口
 * 用于服务端渲染时的配置选项
 */
export interface SSRConfig {
  /** 是否启用 SSR 模式 */
  enabled: boolean;
  /** 是否延迟 hydration（客户端激活） */
  deferHydration?: boolean;
}

/**
 * 多清晰度视频源
 */
export interface QualitySource {
  /** 清晰度等级 */
  quality: QualityLevel;
  /** 视频 URL */
  url: string;
  /** 显示名称 */
  name: string;
}

/**
 * 字幕配置
 */
export interface SubtitleConfig {
  /** 字幕语言代码 */
  lang: string;
  /** 显示名称 */
  label: string;
  /** 字幕文件 URL (WebVTT 格式) */
  src: string;
  /** 是否默认启用 */
  default?: boolean;
}

/**
 * 弹幕配置
 */
export interface DanmakuConfig {
  /** 是否启用弹幕 */
  enabled: boolean;
  /** 弹幕数据源 URL 或 WebSocket 地址 */
  source: string;
  /** 弹幕透明度 (0-1) */
  opacity?: number;
  /** 弹幕速度倍率 */
  speed?: number;
  /** 是否显示弹幕 */
  visible?: boolean;
}

// ============================================
// 播放器事件接口
// ============================================

/**
 * 播放器事件映射
 * 定义所有可监听的事件及其回调参数
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PlayerEvents extends Record<string, (...args: any[]) => void> {
  /** 播放器初始化完成 */
  ready: () => void;
  /** 播放开始 */
  play: () => void;
  /** 播放暂停 */
  pause: () => void;
  /** 播放结束 */
  ended: () => void;
  /** 播放进度更新 */
  timeupdate: (currentTime: number, duration: number) => void;
  /** 音量变化 */
  volumechange: (volume: number, muted: boolean) => void;
  /** 播放速度变化 */
  ratechange: (rate: number) => void;
  /** 画质切换 */
  qualitychange: (quality: QualityLevel) => void;
  /** 进入全屏 */
  fullscreenchange: (isFullscreen: boolean) => void;
  /** 进入画中画 */
  pipchange: (isPip: boolean) => void;
  /** 缓冲状态变化 */
  waiting: () => void;
  /** 缓冲完成，可以继续播放 */
  canplay: () => void;
  /** 加载进度更新 */
  progress: (buffered: TimeRanges) => void;
  /** 发生错误 */
  error: (error: MediaError) => void;
  /** 状态变化 */
  statechange: (state: PlayerState) => void;
  /** 点击播放器 */
  click: (event: MouseEvent) => void;
  /** 双击播放器 */
  dblclick: (event: MouseEvent) => void;
}

/**
 * 播放器状态数据
 * 当前播放器的完整状态快照
 */
export interface PlayerStateData {
  /** 当前播放状态 */
  state: PlayerState;
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 视频总时长（秒） */
  duration: number;
  /** 当前音量 (0-1) */
  volume: number;
  /** 是否静音 */
  muted: boolean;
  /** 当前播放速度 */
  playbackRate: number;
  /** 当前画质 */
  quality: QualityLevel;
  /** 是否全屏 */
  isFullscreen: boolean;
  /** 是否画中画 */
  isPip: boolean;
  /** 缓冲范围 */
  buffered: TimeRanges | null;
  /** 视频宽高比 */
  aspectRatio: number;
}

// ============================================
// UI 组件属性接口
// ============================================

/**
 * 进度条组件属性
 */
export interface ProgressBarProps {
  /** 当前时间 */
  currentTime: number;
  /** 总时长（用于显示） */
  duration: number;
  /** 获取最新总时长的回调（用于计算，解决响应式问题） */
  getDuration?: () => number;
  /** 缓冲范围 */
  buffered: TimeRanges | null;
  /** 是否正在拖拽 */
  isDragging?: boolean;
  /** 进度变化回调 */
  onChange: (time: number) => void;
  /** 开始拖拽回调 */
  onDragStart?: () => void;
  /** 结束拖拽回调 */
  onDragEnd?: () => void;
}

/**
 * 音量控制组件属性
 */
export interface VolumeProps {
  /** 当前音量 (0-1) */
  volume: number;
  /** 是否静音 */
  muted: boolean;
  /** 音量变化回调 */
  onChange: (volume: number, muted: boolean) => void;
  /** 静音切换回调 */
  onMuteToggle?: () => void;
  /** 音量条显示回调 */
  onShow?: () => void;
  /** 音量条隐藏回调 */
  onHide?: () => void;
}

/**
 * 播放按钮组件属性
 */
export interface PlayButtonProps {
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 当前播放状态 */
  state: PlayerState;
  /** 点击回调 */
  onClick: () => void;
  /** 鼠标进入回调 */
  onMouseEnter?: () => void;
  /** 鼠标离开回调 */
  onMouseLeave?: () => void;
  /** 获得焦点回调 */
  onFocus?: () => void;
  /** 失去焦点回调 */
  onBlur?: () => void;
}

/**
 * 时间显示组件属性
 */
export interface TimeDisplayProps {
  /** 当前时间（秒） */
  currentTime: number;
  /** 总时长（秒） */
  duration: number;
  /** 点击回调（可用于切换剩余时间显示） */
  onClick?: () => void;
  /** 鼠标进入回调 */
  onMouseEnter?: () => void;
  /** 鼠标离开回调 */
  onMouseLeave?: () => void;
}

/**
 * 加载动画组件属性
 */
export interface LoadingProps {
  /** 是否显示 */
  visible: boolean;
  /** 加载提示文字 */
  text?: string;
  /** 显示回调 */
  onShow?: () => void;
  /** 隐藏回调 */
  onHide?: () => void;
}

/**
 * 错误提示组件属性
 */
export interface ErrorProps {
  /** 错误代码 */
  code: number;
  /** 错误信息 */
  message: string;
  /** 重试回调 */
  onRetry?: () => void;
  /** 显示回调 */
  onShow?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 画质选择组件属性
 */
export interface QualitySelectorProps {
  /** 当前画质 */
  current: QualityLevel;
  /** 可用画质列表 */
  qualities: QualityLevel[];
  /** 画质切换回调 */
  onChange: (quality: QualityLevel) => void;
  /** 下拉菜单打开回调 */
  onOpen?: () => void;
  /** 下拉菜单关闭回调 */
  onClose?: () => void;
}

/**
 * 控制条组件属性
 */
export interface ControlBarProps {
  /** 是否显示 */
  visible: boolean;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 当前时间 */
  currentTime: number;
  /** 总时长 */
  duration: number;
  /** 缓冲范围 */
  buffered: TimeRanges | null;
  /** 当前音量 */
  volume: number;
  /** 是否静音 */
  muted: boolean;
  /** 播放速度 */
  playbackRate: number;
  /** 当前画质 */
  quality: QualityLevel;
  /** 可用画质列表 */
  qualities: QualityLevel[];
  /** 播放模式 */
  playMode: PlayMode;
  /** 是否全屏 */
  isFullscreen: boolean;
  /** 播放/暂停回调 */
  onPlayPause: () => void;
  /** 进度跳转回调 */
  onSeek: (time: number) => void;
  /** 开始拖拽进度条回调 */
  onSeekStart?: () => void;
  /** 结束拖拽进度条回调 */
  onSeekEnd?: () => void;
  /** 获取最新总时长（用于解决响应式问题） */
  getDuration?: () => number;
  /** 音量变化回调 */
  onVolumeChange: (volume: number, muted: boolean) => void;
  /** 速度变化回调 */
  onRateChange: (rate: number) => void;
  /** 画质切换回调 */
  onQualityChange: (quality: QualityLevel) => void;
  /** 播放模式切换回调 */
  onPlayModeChange: (mode: PlayMode) => void;
  /** 全屏切换回调 */
  onFullscreenToggle: () => void;
  /** 画中画切换回调 */
  onPipToggle: () => void;
  /** 鼠标进入控制条回调 */
  onMouseEnter?: () => void;
  /** 鼠标离开控制条回调 */
  onMouseLeave?: () => void;
  /** 设置按钮点击回调 */
  onSettingsClick?: () => void;
  /** 字幕按钮点击回调 */
  onSubtitleClick?: () => void;
  /** 弹幕按钮点击回调 */
  onDanmakuClick?: () => void;
}

// ============================================
// 工具类型
// ============================================

/**
 * 事件监听器映射类型
 */
export type EventListeners = {
  [K in keyof PlayerEvents]?: PlayerEvents[K];
};

/**
 * 播放器方法接口
 * 播放器实例暴露的所有方法
 */
export interface PlayerMethods {
  /** 播放视频 */
  play(): Promise<void>;
  /** 暂停视频 */
  pause(): void;
  /** 切换播放/暂停 */
  toggle(): void;
  /** 跳转到指定时间 */
  seek(time: number): void;
  /** 设置音量 */
  setVolume(volume: number): void;
  /** 切换静音 */
  toggleMute(): void;
  /** 设置播放速度 */
  setPlaybackRate(rate: number): void;
  /** 切换全屏 */
  toggleFullscreen(): void;
  /** 切换画中画 */
  togglePip(): void;
  /** 切换画质 */
  setQuality(quality: QualityLevel): void;
  /** 销毁播放器 */
  destroy(): void;
  /** 获取当前状态 */
  getState(): PlayerStateData;
  /** 注册事件监听 */
  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void;
  /** 移除事件监听 */
  off<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void;
}
