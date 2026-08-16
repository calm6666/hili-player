/**
 * DASH 相关类型定义
 *
 * 定义 manifestToDash() 转换器输出的 dash.js 内部对象格式。
 * 这些类型仅用于内部转换，不暴露给用户。
 *
 * 重要：对象模式下 dash.js 不走 XML 解析（DurationMatcher/NumericMatcher 不执行），
 * 所有数值字段必须直接传数字类型，属性名不带 _asArray 后缀。
 * ObjectIron 也不会执行属性继承，子元素必须包含完整属性。
 */

/** DASH SegmentTimeline 中的 S 元素 */
export interface DashSegmentTimelineEntry {
  /** 起始时间（timescale 单位） */
  t?: number;
  /** 持续时长（timescale 单位） */
  d: number;
  /** 重复次数 */
  r?: number;
}

/** DASH SegmentURL（SegmentList 中的分片条目） */
export interface DashSegmentUrl {
  /** 媒体段 URL（相对或绝对路径） */
  media?: string;
  /** 媒体段字节范围 */
  mediaRange?: string;
  /** 索引字节范围 */
  indexRange?: string;
}

/** DASH SegmentTemplate 配置 */
export interface DashSegmentTemplate {
  /** 时间刻度，默认 1 */
  timescale?: number;
  /** 初始化段 URL 模板 */
  initialization?: string;
  /** 媒体段 URL 模板 */
  media?: string;
  /** 起始编号 */
  startNumber?: number;
  /** 最后一个分片的编号
   * dash.js 用此字段确定分片范围，防止快进到末尾时请求超出范围的分片（如 init segment）
   * MPD 中对应 endNumber 属性 */
  endNumber?: number;
  /** 固定分片时长（timescale 单位） */
  duration?: number;
  /** 分片时间线 */
  SegmentTimeline?: {
    S: DashSegmentTimelineEntry[];
  };
}

/** DASH SegmentList 配置（显式分片列表） */
export interface DashSegmentList {
  /** 时间刻度，默认 1 */
  timescale?: number;
  /** 固定分片时长（timescale 单位）
   * 注意：当 SegmentTimeline 存在时不能设置此字段，
   * 否则 dash.js 会用 duration / timescale 作为 segmentDuration，
   * 忽略 SegmentTimeline 的精确时间戳 */
  duration?: number;
  /** 起始编号 */
  startNumber?: number;
  /** 初始化段 */
  Initialization?: DashSegmentBaseInitialization;
  /** 分片 URL 列表 */
  SegmentURL: DashSegmentUrl[];
  /** 分片时间线（提供精确的每分片时长，优先于 duration） */
  SegmentTimeline?: {
    S: DashSegmentTimelineEntry[];
  };
}

/** DASH SegmentBase 初始化段配置 */
export interface DashSegmentBaseInitialization {
  /** 字节范围，如 "0-934" */
  range?: string;
  /** 源 URL */
  sourceURL?: string;
}

/** DASH SegmentBase 配置 */
export interface DashSegmentBase {
  /** 时间刻度 */
  timescale?: number;
  /** 初始化段 */
  Initialization?: DashSegmentBaseInitialization;
  /** 索引字节范围 */
  indexRange?: string;
}

/** DASH AudioChannelConfiguration 对象（数组格式） */
export interface DashAudioChannelConfiguration {
  schemeIdUri: string;
  value: string;
}

/** DASH ContentProtection 对象
 *
 * ClearKey ContentProtection 映射：
 * - schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc" — CENC 通用加密
 * - schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" — ClearKey
 */
export interface DashContentProtection {
  /** 保护方案标识 URI */
  schemeIdUri: string;
  /** 方案值，如 "cenc"、"cbcs" */
  value?: string;
  /** 默认密钥 ID（UUID 格式） */
  'cenc:defaultKId'?: string;
  /** PSSH 数据（base64 编码） */
  'cenc:pssh'?: string;
}

/** DASH Representation 对象 */
export interface DashRepresentation {
  id: string;
  bandwidth: number;
  /** 必须提供，ObjectIron 不执行继承 */
  mimeType: string;
  /** 必须提供，ObjectIron 不执行继承 */
  codecs: string;
  width?: number;
  height?: number;
  frameRate?: number;
  sar?: string;
  audioSamplingRate?: number;
  /** BaseURL 必须是数组，dash.js getBaseURLsFromElement 期望数组；未提供时不设置 */
  BaseURL?: string[];
  SegmentTemplate?: DashSegmentTemplate;
  SegmentList?: DashSegmentList;
  SegmentBase?: DashSegmentBase;
  /** AudioChannelConfiguration 必须是数组 */
  AudioChannelConfiguration?: DashAudioChannelConfiguration[];
}

/** DASH AdaptationSet 对象 */
export interface DashAdaptationSet {
  id: string;
  contentType: string;
  /** 必须提供，ObjectIron 不执行继承 */
  mimeType: string;
  /** 必须提供，ObjectIron 不执行继承 */
  codecs?: string;
  startWithSAP?: number;
  segmentAlignment?: boolean;
  bitstreamSwitching?: boolean;
  lang?: string;
  /** 角色描述列表 */
  Role?: DashRole[];
  /** 内容保护列表 */
  ContentProtection?: DashContentProtection[];
  /** dash.js 内部访问 AdaptationSet（不带 _asArray 后缀，必须是数组） */
  Representation: DashRepresentation[];
}

/** DASH Role 描述符 */
export interface DashRole {
  schemeIdUri: string;
  value: string;
}

/** DASH Period 对象 */
export interface DashPeriod {
  id: string;
  /** Period 起始时间（秒），对象模式下必须是数字 */
  start?: number;
  /** Period 时长（秒） */
  duration?: number;
  /** dash.js 内部访问 AdaptationSet（不带 _asArray 后缀，必须是数组） */
  AdaptationSet: DashAdaptationSet[];
}

/** dash.js attachSource() 需要的完整 manifest 对象 */
export interface DashManifestObject {
  /** 'static' 或 'dynamic' */
  type: string;
  /** 协议标识，必须为 'DASH' */
  protocol: string;
  /** 加载时间，必须为 Date 对象 */
  loadedTime: Date;
  /** 数字类型的时长（秒），dash.js 对象模式下直接用于设置 MediaSource.duration */
  mediaPresentationDuration: number;
  /** 数字类型的最小缓冲时间（秒） */
  minBufferTime: number;
  /** 数字类型的最大分片时长（秒），可选 */
  maxSegmentDuration?: number;
  /** dash.js 内部访问 Period（不带 _asArray 后缀，必须是数组） */
  Period: DashPeriod[];
  /** manifest URL，对象模式下必须设置为合法绝对 URL（dash.js createFinalQueryStrings 依赖） */
  url?: string;
  /** 基准 URL，对象模式下必须设置（dash.js getBaseURLsFromElement 用它解析相对路径） */
  baseUri?: string;
}
