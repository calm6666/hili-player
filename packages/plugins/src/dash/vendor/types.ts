/**
 * ============================================
 * MediaManifest 类型定义
 * ============================================
 * 统一的媒体清单对象类型，用于 HLS/DASH 对象注入模式
 * 由 media-manifest 项目提供，此处为本地声明
 */

/** 分片信息（模板模式） */
export interface SegmentTemplateInfo {
  /** 分片模式 */
  mode: 'template';
  /** 分片媒体模板，如 'video/$Number$.m4s' */
  media: string;
  /** 初始化分片 URL，如 'video/init.m4s' */
  initialization: string;
}

/** 分片信息（列表模式） */
export interface SegmentListInfo {
  /** 分片模式 */
  mode: 'list';
  /** 分片 URL 列表 */
  segments: string[];
  /** 初始化分片 URL */
  initialization: string;
}

/** 分片信息联合类型 */
export type SegmentInfo = SegmentTemplateInfo | SegmentListInfo;

/** 视频轨道描述 */
export interface VideoTrack {
  /** 轨道标识 */
  id: string;
  /** 带宽（比特/秒） */
  bandwidth: number;
  /** MIME 类型 */
  mimeType: string;
  /** 编解码器字符串 */
  codecs: string;
  /** 视频宽度 */
  width: number;
  /** 视频高度 */
  height: number;
  /** 分片信息 */
  segmentInfo: SegmentInfo;
}

/** 音频轨道描述 */
export interface AudioTrack {
  /** 轨道标识 */
  id: string;
  /** 带宽（比特/秒） */
  bandwidth: number;
  /** MIME 类型 */
  mimeType: string;
  /** 编解码器字符串 */
  codecs: string;
  /** 语言标签 */
  lang?: string;
  /** 分片信息 */
  segmentInfo: SegmentInfo;
}

/** 媒体清单对象 */
export interface MediaManifest {
  /** 总时长（秒），0 表示直播 */
  duration: number;
  /** 视频轨道列表 */
  video: VideoTrack[];
  /** 音频轨道列表 */
  audio: AudioTrack[];
}
