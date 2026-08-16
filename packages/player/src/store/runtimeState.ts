import type { PlayerState } from "@/types";

/**
 * ============================================
 * 运行时状态管理器
 * ============================================
 * 管理播放器的运行时状态，包括高频更新的数据
 */

import { createTypedStateManager } from "@/core/state";
import type { TypedStateManager } from "@/core/state";
import { createContext } from "@/core/context";
import type { ControlConfig } from "@/hili-player/types";

export type { TypedStateManager };

/**
 * 播放器状态枚举
 */
export enum PlayerStateEnum {
  IDLE = "IDLE",
  LOADING = "LOADING",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  ENDED = "ENDED",
  ERROR = "ERROR",
}

/**
 * 播放器状态键枚举
 * 用于状态管理器的路径定义
 */
export enum PlayerStateKeyEnum {
  // 播放状态
  STATE = "player.state",
  CURRENT_TIME = "player.currentTime",
  DURATION = "player.duration",
  BUFFERED = "player.buffered",

  // 音量状态
  VOLUME = "player.volume",
  MUTED = "player.muted",

  // 播放属性
  PLAYBACK_RATE = "player.playbackRate",
  QUALITY = "player.quality",

  // 显示状态
  IS_FULLSCREEN = "player.isFullscreen",
  IS_PIP = "player.isPip",
  IS_WEB_FULLSCREEN = "player.isWebFullscreen",
  IS_WIDE_SCREEN = "player.isWideScreen",

  // 视频属性
  VIDEO_WIDTH = "video.width",
  VIDEO_HEIGHT = "video.height",
  ASPECT_RATIO = "video.aspectRatio",

  // 错误状态
  ERROR_CODE = "player.errorCode",
  ERROR_MESSAGE = "player.errorMessage",

  // 加载状态
  IS_LOADING = "player.isLoading",
  LOAD_PROGRESS = "player.loadProgress",

  // 控制栏状态
  CONTROLS_VISIBLE = "player.controlsVisible",
  CONTROLS_HOVER = "player.controlsHover",

  // 弹幕状态
  DANMAKU_VISIBLE = "player.danmakuVisible",
  DANMAKU_OPACITY = "player.danmakuOpacity",
  DANMAKU_SPEED = "player.danmakuSpeed",
  DANMAKU_DENSITY = "player.danmakuDensity",

  // 字幕状态
  SUBTITLE_VISIBLE = "player.subtitleVisible",
  SUBTITLE_LANG = "player.subtitleLang",
}

/**
 * 播放器状态路径到类型的映射
 * 用于 TypedStateManager 的类型安全访问
 * key 为 PlayerStateKeyEnum 的枚举值（路径式字符串），value 为对应的数据类型
 *
 * 使用 type 交叉而非 interface + 索引签名：
 * interface { [key: string]: unknown; 'player.volume': number; }
 * → TypeScript 将 'player.volume' 的类型也视为 unknown（索引签名覆盖）
 *
 * type 交叉 { 'player.volume': number; } & Record<string, unknown>
 * → TypeScript 保留具体属性的类型为 number，索引签名仅用于动态访问
 */
export type PlayerStateMap = {
  "player.state": PlayerState;
  "player.currentTime": number;
  "player.duration": number;
  "player.buffered": number;
  "player.volume": number;
  "player.muted": boolean;
  "player.playbackRate": number;
  "player.quality": string;
  "player.isFullscreen": boolean;
  "player.isPip": boolean;
  "player.isWebFullscreen": boolean;
  "player.isWideScreen": boolean;
  "video.width": number;
  "video.height": number;
  "video.aspectRatio": number;
  "player.errorCode": number;
  "player.errorMessage": string;
  "player.isLoading": boolean;
  "player.loadProgress": number;
  "player.controlsVisible": boolean;
  "player.controlsHover": boolean;
  "player.danmakuVisible": boolean;
  "player.danmakuOpacity": number;
  "player.danmakuSpeed": number;
  "player.danmakuDensity": number;
  "player.subtitleVisible": boolean;
  "player.subtitleLang": string;
  browser: object;
} & Record<string, object>;

/**
 * 运行时状态接口
 */
export interface RuntimeState {
  // 播放状态
  state: PlayerStateEnum;
  currentTime: number;
  duration: number;
  buffered: TimeRanges | null;

  // 音量状态
  volume: number;
  muted: boolean;

  // 播放属性
  playbackRate: number;
  quality: number;

  // 显示状态
  isFullscreen: boolean;
  isPip: boolean;
  isWebFullscreen: boolean;
  isWideScreen: boolean;

  // 视频属性
  videoWidth: number;
  videoHeight: number;

  // 错误状态
  errorCode: number;
  errorMessage: string;

  // 加载状态
  isLoading: boolean;
  loadProgress: number;

  // 控制栏状态
  controlsVisible: boolean;
  controlsHover: boolean;

  // 弹幕状态
  danmakuVisible: boolean;
  danmakuOpacity: number;
  danmakuSpeed: number;
  danmakuDensity: number;

  // 字幕状态
  subtitleVisible: boolean;
  subtitleLang: string;
}

/**
 * 默认运行时状态
 */
export const defaultRuntimeState: RuntimeState = {
  state: PlayerStateEnum.IDLE,
  currentTime: 0,
  duration: 0,
  buffered: null,
  volume: 1,
  muted: false,
  playbackRate: 1,
  quality: 0,
  isFullscreen: false,
  isPip: false,
  isWebFullscreen: false,
  isWideScreen: false,
  videoWidth: 0,
  videoHeight: 0,
  errorCode: 0,
  errorMessage: "",
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
};

/**
 * 创建运行时状态管理器
 * @param initialState - 初始状态
 * @returns 类型安全的运行时状态管理器
 */
export function createRuntimeStateManager(
  initialState: Partial<RuntimeState> = {},
): TypedStateManager<PlayerStateMap> {
  const state: Record<string, unknown> = {
    // 播放状态
    [PlayerStateKeyEnum.STATE]: initialState.state ?? defaultRuntimeState.state,
    [PlayerStateKeyEnum.CURRENT_TIME]:
      initialState.currentTime ?? defaultRuntimeState.currentTime,
    [PlayerStateKeyEnum.DURATION]:
      initialState.duration ?? defaultRuntimeState.duration,
    [PlayerStateKeyEnum.BUFFERED]:
      initialState.buffered ?? defaultRuntimeState.buffered,

    // 音量状态
    [PlayerStateKeyEnum.VOLUME]:
      initialState.volume ?? defaultRuntimeState.volume,
    [PlayerStateKeyEnum.MUTED]: initialState.muted ?? defaultRuntimeState.muted,

    // 播放属性
    [PlayerStateKeyEnum.PLAYBACK_RATE]:
      initialState.playbackRate ?? defaultRuntimeState.playbackRate,
    [PlayerStateKeyEnum.QUALITY]:
      initialState.quality ?? defaultRuntimeState.quality,

    // 显示状态
    [PlayerStateKeyEnum.IS_FULLSCREEN]:
      initialState.isFullscreen ?? defaultRuntimeState.isFullscreen,
    [PlayerStateKeyEnum.IS_PIP]:
      initialState.isPip ?? defaultRuntimeState.isPip,
    [PlayerStateKeyEnum.IS_WEB_FULLSCREEN]:
      initialState.isWebFullscreen ?? defaultRuntimeState.isWebFullscreen,
    [PlayerStateKeyEnum.IS_WIDE_SCREEN]:
      initialState.isWideScreen ?? defaultRuntimeState.isWideScreen,

    // 视频属性
    [PlayerStateKeyEnum.VIDEO_WIDTH]:
      initialState.videoWidth ?? defaultRuntimeState.videoWidth,
    [PlayerStateKeyEnum.VIDEO_HEIGHT]:
      initialState.videoHeight ?? defaultRuntimeState.videoHeight,

    // 错误状态
    [PlayerStateKeyEnum.ERROR_CODE]:
      initialState.errorCode ?? defaultRuntimeState.errorCode,
    [PlayerStateKeyEnum.ERROR_MESSAGE]:
      initialState.errorMessage ?? defaultRuntimeState.errorMessage,

    // 加载状态
    [PlayerStateKeyEnum.IS_LOADING]:
      initialState.isLoading ?? defaultRuntimeState.isLoading,
    [PlayerStateKeyEnum.LOAD_PROGRESS]:
      initialState.loadProgress ?? defaultRuntimeState.loadProgress,

    // 控制栏状态
    [PlayerStateKeyEnum.CONTROLS_VISIBLE]:
      initialState.controlsVisible ?? defaultRuntimeState.controlsVisible,
    [PlayerStateKeyEnum.CONTROLS_HOVER]:
      initialState.controlsHover ?? defaultRuntimeState.controlsHover,

    // 弹幕状态
    [PlayerStateKeyEnum.DANMAKU_VISIBLE]:
      initialState.danmakuVisible ?? defaultRuntimeState.danmakuVisible,
    [PlayerStateKeyEnum.DANMAKU_OPACITY]:
      initialState.danmakuOpacity ?? defaultRuntimeState.danmakuOpacity,
    [PlayerStateKeyEnum.DANMAKU_SPEED]:
      initialState.danmakuSpeed ?? defaultRuntimeState.danmakuSpeed,
    [PlayerStateKeyEnum.DANMAKU_DENSITY]:
      initialState.danmakuDensity ?? defaultRuntimeState.danmakuDensity,

    // 字幕状态
    [PlayerStateKeyEnum.SUBTITLE_VISIBLE]:
      initialState.subtitleVisible ?? defaultRuntimeState.subtitleVisible,
    [PlayerStateKeyEnum.SUBTITLE_LANG]:
      initialState.subtitleLang ?? defaultRuntimeState.subtitleLang,
  };

  return createTypedStateManager<PlayerStateMap>(state);
}

/**
 * 运行时状态管理器实例类型
 */
export type RuntimeStateManager = TypedStateManager<PlayerStateMap>;

/**
 * 播放器状态 Context
 * 组件通过 useContext(StateContext) 获取状态管理器实例
 * 无需 props 传递，避免层级穿透
 *
 * @example
 * // 在父组件中提供值（PlayerDocker）
 * h('div', {
 *   __providers: [{ contextId: StateContext.id, value: state }]
 * }, children)
 *
 * // 在子组件中使用（LeftControls / RightControls / VolumeSlider）
 * const state = useContext(StateContext);
 * if (state) {
 *   useState(state, PlayerStateKeyEnum.VOLUME, (newVol) => { ... }, lifecycle);
 * }
 */
export const StateContext =
  createContext<TypedStateManager<PlayerStateMap> | null>(null);

export const defaultControlConfig: ControlConfig = {
  prev: true,
  next: true,
  viewpoint: false,
  quality: true,
  eplist: false,
  setting: true,
  pip: true,
  wide: true,
  web: true,
};

export const ConfigContext = createContext<ControlConfig>(defaultControlConfig);
