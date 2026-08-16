/**
 * ============================================
 * 流媒体插件类型
 * ============================================
 * StreamPlugin 继承 Plugin，添加流媒体专有方法
 * 所有流媒体相关类型的唯一来源
 *
 * @module types/streamPlugin
 */

import type { Plugin } from './plugin';
import type { PlayerEventBus } from '@/core/events';

/** 流媒体插件类型枚举 */
export enum StreamPluginTypeEnum {
  HLS = 'hls',
  DASH = 'dash',
  FLV = 'flv',
}

/** 流媒体格式枚举 */
export enum StreamFormatEnum {
  HLS = 'hls',
  DASH = 'dash',
  FLV = 'flv',
  MP4 = 'mp4',
}

/** 流媒体插件事件枚举 */
export enum StreamPluginEventEnum {
  LOAD_COMPLETE = 'STREAM_LOAD_COMPLETE',
  METADATA_LOADED = 'STREAM_METADATA_LOADED',
  PLAY_START = 'STREAM_PLAY_START',
  PLAY_PAUSE = 'STREAM_PLAY_PAUSE',
  BUFFER_START = 'STREAM_BUFFER_START',
  BUFFER_END = 'STREAM_BUFFER_END',
  STATS_UPDATE = 'STREAM_STATS_UPDATE',
  NETWORK_ERROR = 'STREAM_NETWORK_ERROR',
  DECODE_ERROR = 'STREAM_DECODE_ERROR',
  ERROR = 'STREAM_ERROR',
  /** 清晰度变化（自动或手动切换），payload: { width, height, bitrate, isAuto } */
  QUALITY_CHANGE = 'streamQualityChange',
}

/** 缓冲信息 */
export interface BufferInfo {
  /** 缓冲开始时间 (秒) */
  start: number;
  /** 缓冲结束时间 (秒) */
  end: number;
  /** 缓冲长度 (秒) */
  length: number;
}

/** 流媒体统计信息 */
export interface StreamStats {
  /** 当前下载速度 (字节/秒) */
  downloadSpeed: number;
  /** 视频码率 (比特/秒) */
  videoBitrate: number;
  /** 音频码率 (比特/秒) */
  audioBitrate: number;
  /** 丢包率 (0-1) */
  dropRate: number;
  /** 当前缓冲时长 (秒) */
  bufferLength: number;
  /** 当前播放时间 (秒) */
  currentTime: number;
  /** 视频总时长 (秒) */
  duration: number;
  /** 首帧时间 (毫秒) */
  firstFrameTime: number;
  /** 总卡顿次数 */
  totalStallCount: number;
  /** 总卡顿时间 (毫秒) */
  totalStallTime: number;
  /** 视频编码信息 */
  videoCodec?: string;
  /** 音频编码信息 */
  audioCodec?: string;
  /** 视频分辨率 */
  resolution?: { width: number; height: number };
}

/** 清单源对象类型（用于对象注入模式） */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type MediaManifestSource = object;

/** 流媒体配置 */
export interface StreamConfig {
  /** 流媒体 URL 或清单对象 */
  url: string | MediaManifestSource;
  /** 流媒体格式 */
  format: StreamFormatEnum;
  /** 是否直播 */
  isLive?: boolean;
  /** 开始播放时间 (秒) */
  startTime?: number;
  /** 自定义配置 */
  custom?: Record<string, string | number | boolean | object | null>;
}

/** 画质等级 */
export interface QualityLevel {
  /** 画质标识 */
  id: string;
  /** 画质显示名称 */
  label: string;
  /** 视频宽度 */
  width: number;
  /** 视频高度 */
  height: number;
  /** 码率 (比特/秒) */
  bitrate: number;
}

/** 流媒体插件接口 — 继承 Plugin */
export interface StreamPlugin extends Plugin {
  /** 插件类型 */
  readonly type: StreamPluginTypeEnum;
  /** 视频元素引用 */
  videoElement: HTMLVideoElement | null;
  /** 事件总线 */
  eventBus: PlayerEventBus | null;

  /**
   * 检查浏览器是否支持
   * @returns 是否支持
   */
  isSupported(): boolean;

  /**
   * 加载流媒体
   * @param config - 流媒体配置
   */
  load(config: StreamConfig): void;

  /** 播放 */
  play(): void;

  /** 暂停 */
  pause(): void;

  /**
   * 跳转
   * @param time - 目标时间 (秒)
   */
  seek(time: number): void;

  /** 销毁播放器实例 */
  destroy(): void;

  /**
   * 获取缓冲信息
   * @returns 缓冲信息
   */
  getBufferInfo(): BufferInfo;

  /**
   * 获取统计信息
   * @returns 部分统计信息
   */
  getStats(): Partial<StreamStats>;

  /**
   * 获取可用画质列表
   * @returns 画质等级列表
   */
  getQualities(): QualityLevel[];

  /**
   * 设置画质
   * @param quality - 画质标识
   */
  setQuality(quality: string): void;
}
