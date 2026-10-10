/**
 * ============================================
 * DASH 插件
 * ============================================
 */

export { DashPlugin, createDashPlugin } from './DashPlugin';
export type { DashPluginConfig } from './DashPlugin';
export type { MediaManifest, SegmentInfo, DashManifestObject } from '../vendor/types';
export { manifestToDash } from '../vendor/manifest-to-dash';
