/**
 * 类型统一导出
 */

// 通用类型
export { StreamType, PlayerState } from './common';
export type {
  CommonPlayerOptions,
  DrmSystems,
  PlayerEvent,
  PlayerEventCallback,
} from './common';

// 统一清单对象类型（用户入口）
export type {
  MediaManifest,
  MediaRepresentation,
  SegmentInfo,
  Segment,
  SegmentTimelineEntry,
  ContentSteeringConfig,
  ContentProtection,
  Aes128Encryption,
  LicenseServer,
  AudioChannelConfig,
  SubtitleRepresentation,
  LiveConfig,
  Period,
  UtcTiming,
  EventStream,
  SupplementalProperty,
  EssentialProperty,
} from './manifest';

// DASH 内部类型
export type {
  DashManifestObject,
  DashPeriod,
  DashAdaptationSet,
  DashRole,
  DashRepresentation,
  DashSegmentTemplate,
  DashSegmentList,
  DashSegmentUrl,
  DashSegmentBase,
  DashSegmentBaseInitialization,
  DashSegmentTimelineEntry,
  DashAudioChannelConfiguration,
  DashContentProtection,
} from './dash';
