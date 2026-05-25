/**
 * ============================================
 * hili-player 插件系统
 * ============================================
 * *
 * 使用方式：
 * import {
 *   DanmakuPlugin,
 *   SubtitlePlugin,
 *   DashPlugin,
 *   HlsPlugin,
 *   FlvPlugin,
 *   InteractionPlugin
 * } from '@hili-player/plugins';
 *
 * const player = new VideoPlayer({
 *   src: 'video.mp4',
 *   plugins: [
 *     DanmakuPlugin({ renderMode: 'dom' }),
 *     SubtitlePlugin({
 *       sources: [
 *         { src: 'subtitles/cn.srt', lang: 'zh', label: '中文' }
 *       ]
 *     }),
 *     DashPlugin({ autoplay: true }),
 *     InteractionPlugin({ isEdit: false })
 *   ]
 * });
 */

// 导出流媒体相关
export type { StreamPlugin, StreamConfig, BufferInfo, StreamStats } from './stream/types';
export {
  StreamPluginTypeEnum,
  StreamFormatEnum,
  StreamingProtocolEnum,
  BufferStatusEnum,
  StreamPluginEventEnum,
} from './stream/enums';

// 导出 FLV 插件 - 使用工厂函数
export { FlvPlugin, createFlvPlugin } from './flv';

// 导出 HLS 插件 - 使用工厂函数
export { HlsPlugin, createHlsPlugin } from './hls';

// 导出 DASH 插件 - 使用工厂函数
export { DashPlugin, createDashPlugin } from './dash';

// 导出弹幕插件 - 使用工厂函数
export { DanmakuPlugin } from './danmaku';
export type { DanmakuPluginConfig } from './danmaku';
export type { DanmakuItem } from './danmaku/types';

// 导出字幕插件 - 使用工厂函数
export { SubtitlePlugin } from './subtitle';
export type { SubtitlePluginConfig, SubtitleSource } from './subtitle';

// 导出交互插件 - 使用工厂函数
export { InteractionPlugin } from './interaction';
export type { InteractionPluginConfig } from './interaction';
