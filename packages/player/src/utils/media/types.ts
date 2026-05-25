/**
 * 媒体播放器监控类型定义
 * 支持 dash.js、hls.js、flv.js 等播放器
 */

/** 播放器类型 */
export enum PlayerType {
  DASH = 'dash',
  HLS = 'hls',
  FLV = 'flv',
  NATIVE = 'native',
  UNKNOWN = 'unknown',
}

/** 流媒体协议类型 */
export enum StreamingProtocol {
  DASH = 'DASH',
  HLS = 'HLS',
  FLV = 'FLV',
  MP4 = 'MP4',
  WEBM = 'WebM',
  UNKNOWN = 'Unknown',
}

/** 码率数据点 (当前播放的实时码率) */
export interface BitrateDataPoint {
  /** 时间戳 */
  timestamp: number;
  /** 总码率 (bps) - 当前选中清晰度的静态码率 */
  totalBitrate: number;
  /** 视频码率 (bps) - 当前选中清晰度的静态码率 */
  videoBitrate: number;
  /** 音频码率 (bps) - 当前选中清晰度的静态码率 */
  audioBitrate: number;
}

/** 吞吐量数据点 (实际下载速度) */
export interface ThroughputDataPoint {
  /** 时间戳 */
  timestamp: number;
  /** 总吞吐量 (bps) */
  totalThroughput: number;
  /** 视频吞吐量 (bps) */
  videoThroughput: number;
  /** 音频吞吐量 (bps) */
  audioThroughput: number;
}

/** 缓冲区数据点 */
export interface BufferDataPoint {
  /** 时间戳 */
  timestamp: number;
  /** 视频缓冲区时长 (秒) */
  videoBuffer: number;
  /** 音频缓冲区时长 (秒) */
  audioBuffer: number;
}

/** 帧率数据点 */
export interface FrameRateDataPoint {
  /** 时间戳 */
  timestamp: number;
  /** 当前帧率 */
  fps: number;
  /** 丢帧率 */
  droppedFrames: number;
}

/** 视频轨道信息 */
export interface VideoTrackInfo {
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 码率 */
  bitrate: number;
  /** 帧率 */
  frameRate: number;
  /** 编码格式 */
  codec: string;
  /** 清晰度标签 */
  qualityLabel: string;
}

/** 音频轨道信息 */
export interface AudioTrackInfo {
  /** 码率 */
  bitrate: number;
  /** 采样率 */
  sampleRate: number;
  /** 声道数 */
  channels: number;
  /** 编码格式 */
  codec: string;
}

/** 播放器统计信息 */
export interface PlayerStats {
  /** 当前总码率 (bps) */
  totalBitrate: number;
  /** 当前视频码率 (bps) */
  videoBitrate: number;
  /** 当前音频码率 (bps) */
  audioBitrate: number;
  /** 视频缓冲区时长 (秒) */
  videoBufferLength: number;
  /** 音频缓冲区时长 (秒) */
  audioBufferLength: number;
  /** 当前帧率 */
  currentFPS: number;
  /** 丢帧总数 */
  droppedFrames: number;
  /** 视频宽度 */
  videoWidth: number;
  /** 视频高度 */
  videoHeight: number;
  /** 视频编码 */
  videoCodec: string;
  /** 音频编码 */
  audioCodec: string;
  /** 流媒体协议 */
  protocol: StreamingProtocol;
  /** 当前清晰度 */
  currentQuality: string;
  /** 可用清晰度列表 */
  availableQualities: string[];
}

/** 播放器详细信息 */
export interface PlayerDetails {
  /** 播放器类型 */
  playerType: PlayerType;
  /** 流媒体协议 */
  protocol: StreamingProtocol;
  /** 视频编码 */
  videoCodec: string;
  /** 音频编码 */
  audioCodec: string;
  /** 视频宽度 */
  videoWidth: number;
  /** 视频高度 */
  videoHeight: number;
  /** 帧率 */
  frameRate: number;
  /** 当前清晰度 */
  currentQuality: string;
  /** 可用清晰度列表 */
  availableQualities: string[];
  /** 当前视频码率 */
  videoBitrate: number;
  /** 当前音频码率 */
  audioBitrate: number;
  /** 总码率 */
  totalBitrate: number;
  /** 视频缓冲区 */
  videoBuffer: number;
  /** 音频缓冲区 */
  audioBuffer: number;
  /** 当前播放时间 */
  currentTime: number;
  /** 总时长 */
  duration: number;
  /** 视频 URL */
  videoUrl: string;
  /** MIME 类型 */
  mimeType: string;
}

/** 监控配置 */
export interface MonitorConfig {
  /** 数据点最大数量 */
  maxDataPoints?: number;
  /** 更新间隔 (毫秒) */
  updateInterval?: number;
  /** 是否启用码率监控 */
  enableBitrate?: boolean;
  /** 是否启用吞吐量监控 */
  enableThroughput?: boolean;
  /** 是否启用缓冲区监控 */
  enableBuffer?: boolean;
  /** 是否启用帧率监控 */
  enableFPS?: boolean;
}

/** 监控回调函数 */
export interface MonitorCallbacks {
  /** 统计数据更新回调 */
  onStatsUpdate?: (stats: PlayerStats) => void;
  /** 码率数据更新回调 */
  onBitrateUpdate?: (data: BitrateDataPoint[]) => void;
  /** 吞吐量数据更新回调 */
  onThroughputUpdate?: (data: ThroughputDataPoint[]) => void;
  /** 缓冲区数据更新回调 */
  onBufferUpdate?: (data: BufferDataPoint[]) => void;
  /** 帧率数据更新回调 */
  onFPSUpdate?: (data: FrameRateDataPoint[]) => void;
}

/** dash.js 实例类型（简化定义，避免依赖外部包） */
export interface DashPlayer {
  /** 播放器类型标识 */
  __playerType: 'dash';
  /** 获取视频元素 */
  getVideoElement(): HTMLVideoElement;
  /** 获取当前质量级别 */
  getQualityFor(type: 'video' | 'audio' | 'image'): number;
  /** 获取当前比特率 */
  getCurrentBitrateFor(type: 'video' | 'audio' | 'image'): number;
  /** 获取缓冲区长度 */
  getBufferLength(type: 'video' | 'audio' | 'image'): number;
  /** 获取平均吞吐量 */
  getAverageThroughput(type: 'video' | 'audio' | 'image'): number;
  /** 获取 dash 指标 */
  getDashMetrics(): {
    getCurrentBufferLevel(type: 'video' | 'audio' | 'image'): number;
    getCurrentLatency(): number;
    getHttpRequests(type: 'video' | 'audio' | 'image'): Array<{
      trace?: Array<{ s: number; b: number }>;
    }>;
  };
  /** 获取当前表示 */
  getCurrentRepresentationForType(type: 'video' | 'audio' | 'image'): {
    bandwidth: number;
    bitrate: number;
    height: number;
    width: number;
    codec: string;
  } | null;
  /** 获取当前轨道 */
  getCurrentTrackFor(type: 'video' | 'audio' | 'image'): {
    codec: string;
  } | null;
  /** 获取指定类型的表示列表 */
  getRepresentationsByType(type: 'video' | 'audio' | 'image'): Array<{
    bitrate: number;
    height: number;
    width: number;
  }>;
  /** 质量级别列表（dash 使用 getRepresentationsByType） */
  levels: never;
  /** 当前级别 */
  currentLevel: never;
  /** 音频轨道列表 */
  audioTracks: never;
  /** 当前音频轨道索引 */
  audioTrack: never;
  /** 统计信息 */
  stats: never;
  /** flv 统计信息 */
  statisticsInfo: never;
}

/** hls.js 实例类型（简化定义，避免依赖外部包） */
export interface HlsPlayer {
  /** 播放器类型标识 */
  __playerType: 'hls';
  /** 质量级别列表 */
  levels: Array<{
    /** 高度 */
    height: number;
    /** 宽度 */
    width: number;
    /** 比特率 */
    bitrate: number;
    /** 编解码器 */
    codecSet?: string;
  }>;
  /** 当前级别 */
  currentLevel: number;
  /** 音频轨道列表 */
  audioTracks: Array<{
    bitrate?: number;
    codec?: string;
  }>;
  /** 当前音频轨道索引 */
  audioTrack: number;
  /** 获取当前级别 */
  getCurrentLevel(): number;
  /** 获取当前质量级别 */
  getCurrentQuality(): number;
  /** 获取缓冲区长度 */
  getBufferLength(): number;
  /** 获取平均吞吐量 */
  getAverageThroughput(): number;
  /** 统计信息 */
  stats: { loaded: number };
  /** dash 方法占位 */
  getVideoElement: never;
  getQualityFor: never;
  getCurrentBitrateFor: never;
  getDashMetrics: never;
  getCurrentRepresentationForType: never;
  getCurrentTrackFor: never;
  getRepresentationsByType: never;
  /** flv 统计信息 */
  statisticsInfo: never;
}

/** flv.js 实例类型 (简化) */
export interface FlvPlayer {
  /** 播放器类型标识 */
  __playerType: 'flv';
  statisticsInfo: {
    speed: number;
    playerType: string;
  };
  /** hls 属性占位 */
  levels: never;
  currentLevel: never;
  audioTracks: never;
  audioTrack: never;
  stats: never;
  /** dash 方法占位 */
  getVideoElement: never;
  getQualityFor: never;
  getCurrentBitrateFor: never;
  getBufferLength: never;
  getAverageThroughput: never;
  getDashMetrics: never;
  getCurrentRepresentationForType: never;
  getCurrentTrackFor: never;
  getRepresentationsByType: never;
  getCurrentLevel: never;
  getCurrentQuality: never;
}
