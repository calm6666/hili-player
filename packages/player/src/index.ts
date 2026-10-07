/**
 * ============================================
 * hili-player 核心播放器
 * ============================================
 *
 * 使用方式：
 * import { VideoPlayer } from '@hili-player/core';
 *
 * const player = new VideoPlayer({
 *   src: 'video.mp4',
 *   container: '#player-container'
 * });
 */

// 导出播放器
export { VideoPlayer } from './player';

// 导出便捷入口（createPlayer / mountPlayer / 实例查询）
// 此前只定义在 src/player/index.ts，未从包入口导出，消费者无法使用
export { createPlayer, mountPlayer, getPlayerInstance } from './player';

// 导出类型
export type { PlayerConfig } from '@/types';
export type {
  StateManager,
  EventBus,
  HookSystem,
} from '@/core';

// 导出插件相关（从 plugins 包）
export type {
  Plugin,
  PluginContext,
} from '@/hili-player/core/plugin';
export { PlayerHooks } from '@/hili-player/core/plugin';

// 导出事件系统
export { createEventBus } from '@/events';
export type { EventHandler } from '@/events';

// 导出错误处理系统
export {
  ErrorHandler,
  createErrorHandler,
  ErrorLevel,
  ErrorType,
} from '@/error';

export type {
  ErrorInfo,
  ErrorHandlerConfig,
} from '@/error';

// 导出 SSR 相关功能
export {
  isServer,
  createSSRConfig,
} from '@/utils';
export type { SSRConfig } from '@/utils';

// 导出清单协议判定（唯一实现，供流媒体插件按内容判定协议）
export {
  detectManifestProtocol,
  isSegmentBaseManifest,
  isMediaManifestLike,
  resolveManifestProtocolProfile,
} from '@/hili-player/utils/media/manifestProtocol';
export type {
  ManifestProtocol,
  ManifestSegmentMode,
  ManifestProtocolProfile,
} from '@/hili-player/utils/media/manifestProtocol';
