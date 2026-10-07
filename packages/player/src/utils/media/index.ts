/**
 * 媒体工具库
 * 提供视频播放器监控、码率统计、详细信息面板等功能
 * 支持 dash.js、hls.js、flv.js 和原生视频播放器
 * 集成浏览器能力检测，提供全向监控能力
 */

// 类型导出
export {
  PlayerType,
  StreamingProtocol,
} from './types';

export type {
  BitrateDataPoint,
  ThroughputDataPoint,
  BufferDataPoint,
  FrameRateDataPoint,
  VideoTrackInfo,
  AudioTrackInfo,
  PlayerStats,
  PlayerDetails,
  MonitorConfig,
  MonitorCallbacks,
  DashPlayer,
  HlsPlayer,
  FlvPlayer,
} from './types';

// 清单协议判定导出（播放器与流媒体插件共用的唯一判定入口）
export {
  normalizeManifestProtocol,
  normalizeSegmentMode,
  resolveManifestProtocolProfile,
  detectManifestProtocol,
  isSegmentBaseManifest,
  isMediaManifestLike,
} from './manifestProtocol';

export type {
  ManifestProtocol,
  ManifestSegmentMode,
  ManifestProtocolProfile,
} from './manifestProtocol';

// 监控器导出
export { MediaPlayerMonitor } from './monitor';

// 缓冲速度采样导出（State 组件「正在缓冲」速度文本的数据源）
export { createBufferSpeedSampler } from './bufferSpeed';

export type {
  BufferSpeedSampler,
  BufferSpeedSamplerOptions,
} from './bufferSpeed';

// 全向监控集成导出（统一管理 native + 三个流媒体插件 + 浏览器检测）
export {
  MediaIntegration,
  createMediaIntegration,
} from './pluginIntegration';

// 图表导出
export {
  generateBitrateChart,
  generateBufferChart,
  generateFPSChart,
  generateThroughputChart,
  formatBitrate,
  formatDuration,
  createChartContainer,
} from './chart';

export type { ChartConfig } from './chart';

// 面板导出
export {
  PlayerInfoPanel,
  createPlayerInfoPanel,
} from './playerInfoPanel';

export type { PanelConfig } from './playerInfoPanel';
