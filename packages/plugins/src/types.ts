/**
 * 插件包共享类型定义
 */

import type { Plugin } from '@hili-player/player';

/**
 * 插件工厂函数类型
 */
export type PluginFactory<T = unknown> = (config?: T) => Plugin;

/**
 * 流媒体插件接口
 * 用于 dash/hls/flv 等流媒体协议插件
 */
export interface StreamPlugin extends Plugin {
  /** 支持的 MIME 类型 */
  readonly supportedTypes: string[];
  /** 检测是否支持给定 URL */
  canHandle(url: string): boolean;
  /** 创建播放器实例 */
  create(video: HTMLVideoElement, url: string): void;
  /** 销毁播放器实例 */
  destroy?(): void;
}

/**
 * 字幕插件配置
 */
export interface SubtitlePluginConfig {
  /** 字幕源列表 */
  sources?: SubtitleSource[];
  /** 默认字幕语言 */
  defaultLang?: string;
  /** 字体大小 */
  fontSize?: number;
  /** 字体颜色 */
  color?: string;
  /** 背景颜色 */
  backgroundColor?: string;
  /** 描边颜色 */
  strokeColor?: string;
  /** 描边宽度 */
  strokeWidth?: number;
  /** 底部偏移 */
  bottomOffset?: number;
  /** 字幕容器 */
  container?: HTMLElement;
}

/**
 * 字幕源
 */
export interface SubtitleSource {
  /** 字幕 URL */
  src: string;
  /** 语言代码 */
  lang: string;
  /** 显示名称 */
  label: string;
  /** 默认选中 */
  default?: boolean;
}

/**
 * 弹幕插件配置
 */
export interface DanmakuPluginConfig {
  /** 渲染模式: 'dom' | 'canvas' | 'auto' */
  renderMode?: 'dom' | 'canvas' | 'auto';
  /** 弹幕透明度 (0-1) */
  opacity?: number;
  /** 弹幕速度: 'slow' | 'normal' | 'fast' */
  speed?: 'slow' | 'normal' | 'fast';
  /** 弹幕区域: 'full' | 'half' | 'quarter' */
  area?: 'full' | 'half' | 'quarter';
  /** 字体大小 */
  fontSize?: number;
  /** 是否自动随屏幕大小缩放弹幕 */
  autoScale?: boolean;
  /** 是否显示弹幕 */
  visible?: boolean;
  /** 弹幕密度 (0-1) */
  density?: number;
  /** 是否防遮挡 */
  preventOverlap?: boolean;
  /** 轨道高度 */
  trackHeight?: number;
  /** 是否开启硬件加速 */
  hardwareAcceleration?: boolean;
  /** 弹幕容器 */
  container?: HTMLElement;
}

/**
 * 弹幕项
 */
export interface DanmakuItem {
  /** 唯一ID */
  id: string;
  /** 弹幕文本 */
  text: string;
  /** 发送时间（秒） */
  time: number;
  /** 弹幕类型: 'scroll' | 'top' | 'bottom' */
  type?: 'scroll' | 'top' | 'bottom';
  /** 字体大小 */
  fontSize?: number;
  /** 字体颜色 */
  color?: string;
  /** 发送者 */
  sender?: string;
}

/**
 * Dash 插件配置
 */
export interface DashPluginConfig {
  /** 自动播放 */
  autoplay?: boolean;
  /** 初始画质 */
  initialQuality?: number;
  /** 缓冲时间（秒） */
  bufferTime?: number;
  /** 最大缓冲时间（秒） */
  maxBufferTime?: number;
  /** 低延迟模式 */
  lowLatencyMode?: boolean;
  /** 日志级别 */
  logLevel?: number;
}

/**
 * HLS 插件配置
 */
export interface HlsPluginConfig {
  /** 自动播放 */
  autoplay?: boolean;
  /** 初始画质 */
  initialQuality?: number;
  /** 调试模式 */
  debug?: boolean;
  /** 最大缓冲长度（秒） */
  maxBufferLength?: number;
  /** 最大最大缓冲长度（秒） */
  maxMaxBufferLength?: number;
  /** 启用 Worker */
  enableWorker?: boolean;
}

/**
 * FLV 插件配置
 */
export interface FlvPluginConfig {
  /** 自动播放 */
  autoplay?: boolean;
  /** 是否直播 */
  isLive?: boolean;
  /** 是否启用缓存 */
  enableStashBuffer?: boolean;
  /** 缓存长度（秒） */
  stashInitialSize?: number;
  /** 懒加载最大时长（秒） */
  lazyLoadMaxDuration?: number;
}
