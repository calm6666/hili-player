/**
 * ============================================
 * MediaManifest → DASH 清单对象转换器
 * ============================================
 * 将统一的 MediaManifest 对象转换为 dash.js 可识别的清单对象
 * 用于对象注入模式，跳过网络请求直接播放
 *
 * 转换规则：
 * - MediaManifest.video[] → AdaptationSet (contentType=video)
 * - MediaManifest.audio[] → AdaptationSet (contentType=audio)
 * - 每个 Track → Representation
 * - SegmentTemplateInfo → SegmentTemplate
 */

import type { MediaManifest, VideoTrack, AudioTrack, SegmentTemplateInfo } from './types';

/** 分片模板 */
interface SegmentTemplate {
  /** 分片时长（秒） */
  duration?: number;
  /** 时间缩放 */
  timescale?: number;
  /** 初始化段 */
  initialization?: string;
  /** 媒体模板 */
  media?: string;
  /** 起始编号 */
  startNumber?: number;
}

/** Representation 结构 */
interface DashRepresentation {
  /** 标识 */
  id?: string;
  /** 带宽 */
  bandwidth?: number;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 编解码器 */
  codecs?: string;
  /** 分片模板 */
  SegmentTemplate?: SegmentTemplate;
}

/** AdaptationSet 结构 */
interface DashAdaptationSet {
  /** 内容类型 */
  contentType?: string;
  /** MIME 类型 */
  mimeType?: string;
  /** 语言 */
  lang?: string;
  /** 分段对齐 */
  segmentAlignment?: boolean;
  /** 子分段对齐 */
  subsegmentAlignment?: boolean;
  /** 子分段开始与 SAP 对齐 */
  subsegmentStartsWithSAP?: number;
  /** Representation 列表 */
  Representation: DashRepresentation[];
}

/** Period 结构 */
interface DashPeriod {
  /** AdaptationSet 列表 */
  AdaptationSet: DashAdaptationSet[];
}

/**
 * DASH 清单对象接口
 * dash.js attachSource() 接受的清单对象结构
 */
export interface DashManifestObject {
  /** 协议名称 */
  protocol?: string;
  /** 清单类型（static/dynamic） */
  type?: string;
  /** 媒体展示时长 */
  mediaPresentationDuration?: number;
  /** 最小缓冲时间 */
  minBufferTime?: number;
  /** Period 列表 */
  Period?: DashPeriod[];
  /** dash.js 内部依赖的 URL 属性（需在注入前设置） */
  url?: string;
  /** dash.js 内部依赖的 baseUri 属性（需在注入前设置） */
  baseUri?: string;
}

/**
 * 将视频轨道转换为 Representation
 */
function videoTrackToRepresentation(track: VideoTrack): DashRepresentation {
  const representation: DashRepresentation = {
    id: track.id,
    bandwidth: track.bandwidth,
    width: track.width,
    height: track.height,
    codecs: track.codecs,
  };

  if (track.segmentInfo.mode === 'template') {
    const seg = track.segmentInfo as SegmentTemplateInfo;
    representation.SegmentTemplate = {
      initialization: seg.initialization,
      media: seg.media,
      startNumber: 1,
    };
  }

  return representation;
}

/**
 * 将音频轨道转换为 Representation
 */
function audioTrackToRepresentation(track: AudioTrack): DashRepresentation {
  const representation: DashRepresentation = {
    id: track.id,
    bandwidth: track.bandwidth,
    codecs: track.codecs,
  };

  if (track.segmentInfo.mode === 'template') {
    const seg = track.segmentInfo as SegmentTemplateInfo;
    representation.SegmentTemplate = {
      initialization: seg.initialization,
      media: seg.media,
      startNumber: 1,
    };
  }

  return representation;
}

/**
 * 将 MediaManifest 转换为 dash.js 可识别的清单对象
 *
 * @param manifest - 统一的媒体清单对象
 * @returns dash.js attachSource() 可接受的清单对象
 */
export function manifestToDash(manifest: MediaManifest): DashManifestObject {
  // 构建视频 AdaptationSet
  const videoRepresentations = manifest.video.map(videoTrackToRepresentation);
  const videoAdaptationSet: DashAdaptationSet[] = videoRepresentations.length > 0
    ? [{
        contentType: 'video',
        mimeType: manifest.video[0]?.mimeType ?? 'video/mp4',
        segmentAlignment: true,
        subsegmentAlignment: true,
        subsegmentStartsWithSAP: 1,
        Representation: videoRepresentations,
      }]
    : [];

  // 构建音频 AdaptationSet
  const audioRepresentations = manifest.audio.map(audioTrackToRepresentation);
  const audioAdaptationSets: DashAdaptationSet[] = manifest.audio.map((track, index) => ({
    contentType: 'audio',
    mimeType: track.mimeType ?? 'audio/mp4',
    lang: track.lang,
    segmentAlignment: true,
    subsegmentAlignment: true,
    subsegmentStartsWithSAP: 1,
    Representation: [audioRepresentations[index]],
  }));

  return {
    protocol: 'dash',
    type: manifest.duration > 0 ? 'static' : 'dynamic',
    mediaPresentationDuration: manifest.duration,
    minBufferTime: 2,
    Period: [{
      AdaptationSet: [...videoAdaptationSet, ...audioAdaptationSets],
    }],
  };
}
