/**
 * 媒体工具库
 * 提供视频播放器监控、码率统计、详细信息面板等功能
 * 支持 dash.js、hls.js、flv.js 和原生视频播放器
 */

// 类型导出
export {
  PlayerType,
  StreamingProtocol,
} from './types';

export type {
  BitrateDataPoint,
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

// 监控器导出
export { MediaPlayerMonitor } from './monitor';

// 图表导出
export {
  generateBitrateChart,
  generateBufferChart,
  generateFPSChart,
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
