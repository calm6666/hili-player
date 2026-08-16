/**
 * 通用类型定义
 */

/** 流类型枚举 */
export enum StreamType {
  DASH = 'dash',
  HLS = 'hls',
}

/** 播放器状态枚举 */
export enum PlayerState {
  IDLE = 'idle',
  LOADING = 'loading',
  READY = 'ready',
  PLAYING = 'playing',
  PAUSED = 'paused',
  ERROR = 'error',
  DESTROYED = 'destroyed',
}

/** DRM 密钥系统配置 */
export interface DrmSystems {
  /** ClearKey License URL（DASH + HLS 通用） */
  clearkey?: { licenseUrl: string };
  /** Widevine License URL */
  widevine?: { licenseUrl: string };
  /** FairPlay License URL */
  fairplay?: { licenseUrl: string; certificateUrl?: string };
  /** PlayReady License URL */
  playready?: { licenseUrl: string };
}

/** 播放器配置选项 */
export interface CommonPlayerOptions {
  /** 视频容器 DOM 元素或选择器 */
  container: HTMLElement | string;
  /** 是否开启调试模式 */
  debug?: boolean;
  /** 流类型，指定使用 DASH 还是 HLS */
  streamType?: StreamType;
  /** 是否自动播放 */
  autoplay?: boolean;
  /** DRM 密钥系统配置（加密内容必须设置） */
  drmSystems?: DrmSystems;
}

/** 播放器事件数据联合类型 */
export type PlayerEventData =
  | { type: string; [key: string]: unknown }
  | string
  | number
  | boolean
  | null
  | undefined;

/** 播放器事件 */
export interface PlayerEvent {
  type: string;
  data?: PlayerEventData;
  source: StreamType;
  timestamp: number;
}

/** 事件回调函数类型 */
export type PlayerEventCallback = (event: PlayerEvent) => void;
