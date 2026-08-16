/**
 * ============================================
 * DASH 插件
 * ============================================
 */

export { DashPlugin, createDashPlugin } from './DashPlugin';
export type { MediaManifest, VideoTrack, AudioTrack, SegmentInfo, SegmentTemplateInfo, SegmentListInfo } from './vendor/types';
export { manifestToDash } from './vendor/manifest-to-dash';
export type { DashManifestObject } from './vendor/manifest-to-dash';
