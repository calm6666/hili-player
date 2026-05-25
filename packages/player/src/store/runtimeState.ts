/**
 * ============================================
 * 运行时状态管理器
 * ============================================
 * 管理播放器的运行时状态，包括高频更新的数据
 */

import { createStateManager } from '@/core/state';
import type { StateManager } from '@/core/state';

/**
 * 播放器状态枚举
 */
export enum PlayerStateEnum {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
  ERROR = 'ERROR',
}

/**
 * 播放器状态键枚举
 * 用于状态管理器的路径定义
 */
export enum PlayerStateKeyEnum {
  // 播放状态
  STATE = 'player.state',
  CURRENT_TIME = 'player.currentTime',
  DURATION = 'player.duration',
  BUFFERED = 'player.buffered',

  // 音量状态
  VOLUME = 'player.volume',
  MUTED = 'player.muted',

  // 播放属性
  PLAYBACK_RATE = 'player.playbackRate',
  QUALITY = 'player.quality',

  // 显示状态
  IS_FULLSCREEN = 'player.isFullscreen',
  IS_PIP = 'player.isPip',
  IS_WEB_FULLSCREEN = 'player.isWebFullscreen',
  IS_WIDE_SCREEN = 'player.isWideScreen',

  // 视频属性
  VIDEO_WIDTH = 'video.width',
  VIDEO_HEIGHT = 'video.height',
  ASPECT_RATIO = 'video.aspectRatio',

  // 错误状态
  ERROR_CODE = 'player.errorCode',
  ERROR_MESSAGE = 'player.errorMessage',

  // 加载状态
  IS_LOADING = 'player.isLoading',
  LOAD_PROGRESS = 'player.loadProgress',

  // 控制栏状态
  CONTROLS_VISIBLE = 'player.controlsVisible',
  CONTROLS_HOVER = 'player.controlsHover',

  // 弹幕状态
  DANMAKU_VISIBLE = 'player.danmakuVisible',
  DANMAKU_OPACITY = 'player.danmakuOpacity',
  DANMAKU_SPEED = 'player.danmakuSpeed',
  DANMAKU_DENSITY = 'player.danmakuDensity',

  // 字幕状态
  SUBTITLE_VISIBLE = 'player.subtitleVisible',
  SUBTITLE_LANG = 'player.subtitleLang',
}

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
  errorMessage: '',
  isLoading: false,
  loadProgress: 0,
  controlsVisible: true,
  controlsHover: false,
  danmakuVisible: true,
  danmakuOpacity: 1,
  danmakuSpeed: 1,
  danmakuDensity: 0.5,
  subtitleVisible: true,
  subtitleLang: 'zh-CN',
};

/**
 * 创建运行时状态管理器
 * @param initialState - 初始状态
 * @returns 运行时状态管理器
 */
export function createRuntimeStateManager(
  initialState: Partial<RuntimeState> = {}
): StateManager {
  const state: Record<string, unknown> = {
    // 播放状态
    [PlayerStateKeyEnum.STATE]: initialState.state ?? defaultRuntimeState.state,
    [PlayerStateKeyEnum.CURRENT_TIME]: initialState.currentTime ?? defaultRuntimeState.currentTime,
    [PlayerStateKeyEnum.DURATION]: initialState.duration ?? defaultRuntimeState.duration,
    [PlayerStateKeyEnum.BUFFERED]: initialState.buffered ?? defaultRuntimeState.buffered,

    // 音量状态
    [PlayerStateKeyEnum.VOLUME]: initialState.volume ?? defaultRuntimeState.volume,
    [PlayerStateKeyEnum.MUTED]: initialState.muted ?? defaultRuntimeState.muted,

    // 播放属性
    [PlayerStateKeyEnum.PLAYBACK_RATE]: initialState.playbackRate ?? defaultRuntimeState.playbackRate,
    [PlayerStateKeyEnum.QUALITY]: initialState.quality ?? defaultRuntimeState.quality,

    // 显示状态
    [PlayerStateKeyEnum.IS_FULLSCREEN]: initialState.isFullscreen ?? defaultRuntimeState.isFullscreen,
    [PlayerStateKeyEnum.IS_PIP]: initialState.isPip ?? defaultRuntimeState.isPip,
    [PlayerStateKeyEnum.IS_WEB_FULLSCREEN]: initialState.isWebFullscreen ?? defaultRuntimeState.isWebFullscreen,
    [PlayerStateKeyEnum.IS_WIDE_SCREEN]: initialState.isWideScreen ?? defaultRuntimeState.isWideScreen,

    // 视频属性
    [PlayerStateKeyEnum.VIDEO_WIDTH]: initialState.videoWidth ?? defaultRuntimeState.videoWidth,
    [PlayerStateKeyEnum.VIDEO_HEIGHT]: initialState.videoHeight ?? defaultRuntimeState.videoHeight,

    // 错误状态
    [PlayerStateKeyEnum.ERROR_CODE]: initialState.errorCode ?? defaultRuntimeState.errorCode,
    [PlayerStateKeyEnum.ERROR_MESSAGE]: initialState.errorMessage ?? defaultRuntimeState.errorMessage,

    // 加载状态
    [PlayerStateKeyEnum.IS_LOADING]: initialState.isLoading ?? defaultRuntimeState.isLoading,
    [PlayerStateKeyEnum.LOAD_PROGRESS]: initialState.loadProgress ?? defaultRuntimeState.loadProgress,

    // 控制栏状态
    [PlayerStateKeyEnum.CONTROLS_VISIBLE]: initialState.controlsVisible ?? defaultRuntimeState.controlsVisible,
    [PlayerStateKeyEnum.CONTROLS_HOVER]: initialState.controlsHover ?? defaultRuntimeState.controlsHover,

    // 弹幕状态
    [PlayerStateKeyEnum.DANMAKU_VISIBLE]: initialState.danmakuVisible ?? defaultRuntimeState.danmakuVisible,
    [PlayerStateKeyEnum.DANMAKU_OPACITY]: initialState.danmakuOpacity ?? defaultRuntimeState.danmakuOpacity,
    [PlayerStateKeyEnum.DANMAKU_SPEED]: initialState.danmakuSpeed ?? defaultRuntimeState.danmakuSpeed,
    [PlayerStateKeyEnum.DANMAKU_DENSITY]: initialState.danmakuDensity ?? defaultRuntimeState.danmakuDensity,

    // 字幕状态
    [PlayerStateKeyEnum.SUBTITLE_VISIBLE]: initialState.subtitleVisible ?? defaultRuntimeState.subtitleVisible,
    [PlayerStateKeyEnum.SUBTITLE_LANG]: initialState.subtitleLang ?? defaultRuntimeState.subtitleLang,
  };

  return createStateManager(state);
}

/**
 * 运行时状态管理器实例类型
 */
export type RuntimeStateManager = ReturnType<typeof createRuntimeStateManager>;
