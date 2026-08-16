/**
 * ============================================
 * MediaManifest 类型定义
 * ============================================
 * 描述媒体清单对象的结构，用于对象注入模式
 * 当 StreamConfig.url 为对象时，可传入 MediaManifest
 * 由 manifestToHls() 转换为 hls.js 的 ManifestVariant[] + ManifestAudioGroup[]
 */

/** 分片模板信息 */
export interface SegmentTemplateInfo {
  /** 分片模式 */
  mode: 'template' | 'segment-base' | 'segment-list';
  /** 媒体分片 URL 模板（如 'video/$Number$.m4s'） */
  media?: string;
  /** 初始化段 URL（如 'video/init.m4s'） */
  initialization?: string;
  /** 分片时长（秒） */
  duration?: number;
  /** 时间线 */
  timeline?: Array<{ t?: number; d: number; r?: number }>;
  /** 起始编号 */
  startNumber?: number;
}

/** 视频轨道描述 */
export interface VideoTrackDescriptor {
  /** 轨道 ID */
  id: string;
  /** 带宽（bps） */
  bandwidth: number;
  /** MIME 类型 */
  mimeType: string;
  /** 编码格式字符串 */
  codecs: string;
  /** 视频宽度 */
  width: number;
  /** 视频高度 */
  height: number;
  /** 帧率 */
  frameRate?: number;
  /** 分片信息 */
  segmentInfo: SegmentTemplateInfo;
}

/** 音频轨道描述 */
export interface AudioTrackDescriptor {
  /** 轨道 ID */
  id: string;
  /** 带宽（bps） */
  bandwidth: number;
  /** MIME 类型 */
  mimeType: string;
  /** 编码格式字符串 */
  codecs: string;
  /** 语言标识 */
  lang?: string;
  /** 声道数 */
  channels?: number;
  /** 是否为默认轨道 */
  isDefault?: boolean;
  /** 分片信息 */
  segmentInfo: SegmentTemplateInfo;
}

/**
 * 媒体清单对象
 * 描述一个完整的媒体内容，包含时长、视频轨道和音频轨道
 */
export interface MediaManifest {
  /** 媒体总时长（秒） */
  duration: number;
  /** 视频轨道列表 */
  video: VideoTrackDescriptor[];
  /** 音频轨道列表 */
  audio?: AudioTrackDescriptor[];
  /** 基础 URL（用于拼接分片相对路径） */
  baseUrl?: string;
}
