/**
 * ============================================
 * MediaManifest → hls.js 清单转换器
 * ============================================
 * 将 MediaManifest 对象转换为 fork 版 hls.js 的
 * ManifestVariant[] + ManifestAudioGroup[] 格式
 *
 * 用于对象注入模式：manifestToHls(manifest) → hls.loadManifest(variants, audioGroups)
 */

import type { ManifestVariant, ManifestAudioGroup } from 'hls.js';
import type { MediaManifest, VideoTrackDescriptor, AudioTrackDescriptor } from './types';

/**
 * 将 MediaManifest 转换为 hls.js 的清单格式
 *
 * @param manifest - 媒体清单对象
 * @returns hls.js loadManifest() 所需的 variants 和 audioGroups
 */
export function manifestToHls(manifest: MediaManifest): {
  variants: ManifestVariant[];
  audioGroups: ManifestAudioGroup[];
} {
  const baseUrl = manifest.baseUrl || '';

  // 转换视频轨道为 ManifestVariant[]
  const variants: ManifestVariant[] = manifest.video.map(
    (track: VideoTrackDescriptor) => variantFromVideoTrack(track, baseUrl),
  );

  // 转换音频轨道为 ManifestAudioGroup[]
  const audioGroups: ManifestAudioGroup[] = (manifest.audio || []).map(
    (track: AudioTrackDescriptor) => audioGroupFromAudioTrack(track, baseUrl),
  );

  return { variants, audioGroups };
}

/**
 * 将视频轨道描述转换为 ManifestVariant
 */
function variantFromVideoTrack(track: VideoTrackDescriptor, baseUrl: string): ManifestVariant {
  const variant: ManifestVariant = {
    bandwidth: track.bandwidth,
    url: resolveUrl(baseUrl, track.segmentInfo.media || ''),
    codecs: track.codecs,
    resolution: {
      width: track.width,
      height: track.height,
    },
  };

  if (track.frameRate !== undefined) {
    variant.frameRate = track.frameRate;
  }

  // 如果有音频轨道，关联音频组 ID
  if (track.segmentInfo) {
    variant.playlistDetails = buildPlaylistDetails(track, baseUrl);
  }

  return variant;
}

/**
 * 将音频轨道描述转换为 ManifestAudioGroup
 */
function audioGroupFromAudioTrack(track: AudioTrackDescriptor, baseUrl: string): ManifestAudioGroup {
  const audioGroup: ManifestAudioGroup = {
    groupId: 'audio',
    url: resolveUrl(baseUrl, track.segmentInfo.media || ''),
    codecs: track.codecs,
    name: track.id,
    bandwidth: track.bandwidth,
  };

  if (track.lang) {
    audioGroup.lang = track.lang;
  }

  if (track.isDefault) {
    audioGroup.default = true;
  }

  if (track.segmentInfo) {
    audioGroup.playlistDetails = buildPlaylistDetails(track, baseUrl);
  }

  return audioGroup;
}

/**
 * 从轨道描述构建 ManifestPlaylistDetails
 */
function buildPlaylistDetails(
  track: VideoTrackDescriptor | AudioTrackDescriptor,
  baseUrl: string,
): ManifestVariant['playlistDetails'] {
  const segInfo = track.segmentInfo;
  if (!segInfo) return undefined;

  const details: NonNullable<ManifestVariant['playlistDetails']> = {
    targetDuration: segInfo.duration || 4,
    live: false,
  };

  if (segInfo.initialization) {
    details.initSegmentUrl = resolveUrl(baseUrl, segInfo.initialization);
  }

  // 从 timeline 构建分片列表
  if (segInfo.timeline && segInfo.timeline.length > 0) {
    let segIndex = segInfo.startNumber || 0;
    details.segments = [];
    details.mediaSequence = segIndex;

    for (const entry of segInfo.timeline) {
      const repeat = entry.r !== undefined ? entry.r : 0;
      const count = repeat < 0 ? 1 : repeat + 1;
      for (let i = 0; i < count; i++) {
        const mediaTemplate = segInfo.media || '';
        const segUrl = mediaTemplate.replace(/\$Number\$/g, String(segIndex));
        details.segments.push({
          duration: entry.d / 1000, // timeline 中 d 为毫秒，转为秒
          url: resolveUrl(baseUrl, segUrl),
        });
        segIndex++;
      }
    }
  } else if (segInfo.media) {
    // 无 timeline 时，使用 duration 推算分片
    const duration = segInfo.duration || 4;
    details.segments = [];
    details.mediaSequence = segInfo.startNumber || 0;
    // 占位：实际分片数量由外部决定
    details.targetDuration = duration;
  }

  return details;
}

/**
 * 拼接基础 URL 和相对路径
 */
function resolveUrl(base: string, relative: string): string {
  if (!relative) return base;
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  if (!base) return relative;
  if (base.endsWith('/')) {
    return base + relative;
  }
  return base + '/' + relative;
}
