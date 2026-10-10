/**
 * ============================================
 * 字幕插件
 * ============================================
 * 双模式字幕能力统一出口：
 * - 模式 A：本地 AI 实时识别（采集链 + VAD + AsrEngine）
 * - 模式 B：服务端字幕轨（RemoteSubtitleProvider，支持多轨/增量）
 * - 兼容旧 aiBackend 配置（自动映射为单轨 Provider）
 */

export { SubtitlePlugin, createSubtitlePlugin } from './SubtitlePlugin';
export type { SubtitlePluginConfig, SubtitleSource, SubtitlePluginAPI } from './SubtitlePlugin';
export { SUBTITLE_TRANSLATION_CLASS } from './SubtitlePlugin';

// AI 字幕扩展能力（后端可配置、后续对接）
export type { AiSubtitleBackendConfig, AiSubtitleEntry } from './aiSubtitleConfig';
export { defaultAiSubtitleParser, fillAiTemplate, aiSubtitleEntriesToItems } from './aiSubtitleConfig';
export { AiSubtitleFetcher } from './AiSubtitleFetcher';

// 模式 B：服务端字幕轨 Provider（含旧 aiBackend 配置的兼容映射）
export {
  createLegacyRemoteProvider,
  LEGACY_REMOTE_TRACK_ID,
} from './remoteProvider';
export type { RemoteFetchParamsResolver } from './remoteProvider';

// 模式 A：本地 AI 实时识别链
export { AudioCapture } from './asr/audioCapture';
export { VadSegmenter } from './asr/vadSegmenter';
export type { VadCallbacks, VadOptions } from './asr/vadSegmenter';
export { MockAsrEngine } from './asr/mockAsrEngine';
export { createLocalAiProvider, LOCAL_AI_TRACK_ID } from './asr/localAiProvider';

// 字幕双模式公共类型（统一维护于 @/types/subtitle，此处 re-export 便于外部接入）
export type {
  SubtitleTrackInfo,
  SubtitleCueEvent,
  SubtitleAiStatusPayload,
  SubtitleAudioStream,
  SubtitleEngineContext,
  AsrEngine,
  AsrEngineInitOptions,
  AsrPartialResult,
  AsrFinalResult,
  AsrEngineStatus,
  LocalAiSubtitleProvider,
  LocalAiSubtitleConfig,
  RemoteSubtitleTrack,
  RemoteSubtitleProvider,
} from '@/types/subtitle';
