/**
 * 校验工具函数
 *
 * 提供 MediaManifest 对象的结构校验，
 * 确保传入的对象包含必要的字段。
 */

import type { MediaManifest, MediaRepresentation, SegmentInfo, Aes128Encryption, LicenseServer } from '../types/index';

/** 校验错误类 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 校验 MediaManifest 对象
 *
 * 检查必要字段是否存在且类型正确。
 * @param manifest - 待校验的清单对象
 * @throws {ValidationError} 校验失败时抛出
 */
export function validateManifest(manifest: unknown): asserts manifest is MediaManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new ValidationError('manifest must be a non-empty object');
  }

  const m = manifest as Record<string, unknown>;

  /* 校验 duration */
  if (typeof m.duration !== 'number' || m.duration <= 0) {
    throw new ValidationError('manifest.duration must be a positive number');
  }

  /* 校验 video */
  if (!Array.isArray(m.video) || m.video.length === 0) {
    throw new ValidationError('manifest.video must be a non-empty array');
  }

  /* 校验每个 video Representation */
  for (let i = 0; i < (m.video as unknown[]).length; i++) {
    validateRepresentation(m.video[i], `video[${i}]`, 'video');
  }

  /* 校验 audio（可选） */
  if (m.audio !== undefined) {
    if (!Array.isArray(m.audio)) {
      throw new ValidationError('manifest.audio must be an array');
    }
    for (let i = 0; i < (m.audio as unknown[]).length; i++) {
      validateRepresentation(m.audio[i], `audio[${i}]`, 'audio');
    }
  }

  /* 校验 encryption（可选） */
  if (m.encryption !== undefined) {
    validateEncryption(m.encryption, 'manifest.encryption');
  }

  /* 校验 licenseServer（可选） */
  if (m.licenseServer !== undefined) {
    validateLicenseServer(m.licenseServer, 'manifest.licenseServer');
  }
}

/**
 * 校验 MediaRepresentation 对象
 *
 * @param rep - 待校验的表示对象
 * @param path - 字段路径（用于错误信息）
 * @param kind - 类型标识 'video' | 'audio'
 */
function validateRepresentation(
  rep: unknown,
  path: string,
  kind: 'video' | 'audio',
): asserts rep is MediaRepresentation {
  if (!rep || typeof rep !== 'object') {
    throw new ValidationError(`${path} must be a non-empty object`);
  }

  const r = rep as Record<string, unknown>;

  /* 必填字段 */
  if (r.id === undefined) {
    throw new ValidationError(`${path}.id is required`);
  }
  if (r.baseUrl !== undefined) {
    if (typeof r.baseUrl !== 'string' || !r.baseUrl) {
      throw new ValidationError(`${path}.baseUrl must be a non-empty string`);
    }
  }
  if (r.backupUrls !== undefined) {
    if (!Array.isArray(r.backupUrls)) {
      throw new ValidationError(`${path}.backupUrls must be an array`);
    }
    for (let j = 0; j < r.backupUrls.length; j++) {
      if (typeof r.backupUrls[j] !== 'string' || !r.backupUrls[j]) {
        throw new ValidationError(`${path}.backupUrls[${j}] must be a non-empty string`);
      }
    }
  }
  if (typeof r.bandwidth !== 'number' || r.bandwidth <= 0) {
    throw new ValidationError(`${path}.bandwidth must be a positive number`);
  }
  if (typeof r.mimeType !== 'string' || !r.mimeType) {
    throw new ValidationError(`${path}.mimeType must be a non-empty string`);
  }
  if (typeof r.codecs !== 'string' || !r.codecs) {
    throw new ValidationError(`${path}.codecs must be a non-empty string`);
  }

  /* 视频特有字段 */
  if (kind === 'video') {
    if (r.width !== undefined && typeof r.width !== 'number') {
      throw new ValidationError(`${path}.width must be a number`);
    }
    if (r.height !== undefined && typeof r.height !== 'number') {
      throw new ValidationError(`${path}.height must be a number`);
    }
  }

  /* 校验 segmentInfo（可选） */
  if (r.segmentInfo !== undefined) {
    validateSegmentInfo(r.segmentInfo, `${path}.segmentInfo`);
  }

  /* 校验 encryption（可选） */
  if (r.encryption !== undefined) {
    validateEncryption(r.encryption, `${path}.encryption`);
  }
}

/**
 * 校验 SegmentInfo 对象
 */
function validateSegmentInfo(
  info: unknown,
  path: string,
): asserts info is SegmentInfo {
  if (!info || typeof info !== 'object') {
    throw new ValidationError(`${path} must be a non-empty object`);
  }

  const s = info as Record<string, unknown>;

  if (s.mode !== 'single' && s.mode !== 'template' && s.mode !== 'list') {
    throw new ValidationError(`${path}.mode must be 'single', 'template', or 'list'`);
  }

  if (s.mode === 'single') {
    /* single = SegmentBase（单文件 + 字节范围，见 docs/MANIFEST-OBJECT-GUIDE.md 6.3）：
       · initialization / indexRange 都是**字节范围字符串**（"start-end"），不是 URL；
       · 段表来源必须至少有一样：indexRange（dash.js 读单文件里的 sidx）或
         非空 segments[]（显式字节范围，转换器会退回 SegmentList + mediaRange）。
       两样都没有的话清单是"空壳"，这里直接报错，别等播放时才失败。 */
    const isRange = (v: unknown): boolean => typeof v === 'string' && /^\d+-\d+$/.test(v);

    if (s.initialization !== undefined && !isRange(s.initialization)) {
      throw new ValidationError(
        `${path}.initialization in single mode must be a byte range (start-end), not a URL`,
      );
    }
    if (s.indexRange !== undefined && !isRange(s.indexRange)) {
      throw new ValidationError(`${path}.indexRange must be a byte range (start-end)`);
    }
    const hasIndexRange = isRange(s.indexRange);
    const hasExplicitSegments = Array.isArray(s.segments) && s.segments.length > 0;
    if (!hasIndexRange && !hasExplicitSegments) {
      throw new ValidationError(
        `${path} is in single mode, must provide indexRange (read sidx from single file) or non-empty segments[] (explicit byte ranges)`,
      );
    }
  }

  if (s.mode === 'template' || s.mode === 'list') {
    if (s.initialization !== undefined && typeof s.initialization !== 'string') {
      throw new ValidationError(`${path}.initialization must be a string`);
    }
    if (s.targetDuration !== undefined && typeof s.targetDuration !== 'number') {
      throw new ValidationError(`${path}.targetDuration must be a number`);
    }
    if (s.segments !== undefined && !Array.isArray(s.segments)) {
      throw new ValidationError(`${path}.segments must be an array`);
    }
    if (s.media !== undefined) {
      if (typeof s.media !== 'string' || !s.media) {
        throw new ValidationError(`${path}.media must be a non-empty string`);
      }
      if (!s.media.includes('*')) {
        throw new ValidationError(`${path}.media must contain * wildcard for segment index position`);
      }
    }
    if (s.totalCount !== undefined && (typeof s.totalCount !== 'number' || s.totalCount <= 0)) {
      throw new ValidationError(`${path}.totalCount must be a positive integer`);
    }
    if (s.suffix !== undefined) {
      if (typeof s.suffix !== 'string' || !s.suffix) {
        throw new ValidationError(`${path}.suffix must be a non-empty string, e.g. "ts" or "m4s"`);
      }
    }
  }
}

/**
 * 校验视频容器元素
 *
 * @param container - DOM 元素或 CSS 选择器
 * @returns 视频 DOM 元素
 */
export function validateContainer(container: HTMLElement | string): HTMLVideoElement {
  let el: HTMLElement | null;

  if (typeof container === 'string') {
    el = document.querySelector(container);
  } else {
    el = container;
  }

  if (!el) {
    throw new ValidationError('Video container element does not exist');
  }

  if (el.tagName !== 'VIDEO') {
    /* 如果不是 video 元素，尝试在其内部查找 */
    const video = el.querySelector('video');
    if (video) return video;

    /* 自动创建 video 元素 */
    const videoEl = document.createElement('video');
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    el.appendChild(videoEl);
    return videoEl;
  }

  return el as HTMLVideoElement;
}

/**
 * 校验 Aes128Encryption 对象
 */
function validateEncryption(
  encryption: unknown,
  path: string,
): asserts encryption is Aes128Encryption {
  if (!encryption || typeof encryption !== 'object') {
    throw new ValidationError(`${path} must be a non-empty object`);
  }

  const e = encryption as Record<string, unknown>;

  if (typeof e.keyUrl !== 'string' || !e.keyUrl) {
    throw new ValidationError(`${path}.keyUrl must be a non-empty string`);
  }

  if (e.iv !== undefined && typeof e.iv !== 'string') {
    throw new ValidationError(`${path}.iv must be a string`);
  }

  if (e.keyFormat !== undefined && typeof e.keyFormat !== 'string') {
    throw new ValidationError(`${path}.keyFormat must be a string`);
  }

  if (e.keyFormatVersions !== undefined && typeof e.keyFormatVersions !== 'string') {
    throw new ValidationError(`${path}.keyFormatVersions must be a string`);
  }

  if (e.expiresIn !== undefined) {
    if (typeof e.expiresIn !== 'number' || e.expiresIn < 0) {
      throw new ValidationError(`${path}.expiresIn must be a non-negative number`);
    }
  }
}

/**
 * 校验 LicenseServer 对象
 */
function validateLicenseServer(
  licenseServer: unknown,
  path: string,
): asserts licenseServer is LicenseServer {
  if (!licenseServer || typeof licenseServer !== 'object') {
    throw new ValidationError(`${path} must be a non-empty object`);
  }

  const ls = licenseServer as Record<string, unknown>;

  if (typeof ls.url !== 'string' || !ls.url) {
    throw new ValidationError(`${path}.url must be a non-empty string`);
  }

  if (ls.contentId !== undefined && typeof ls.contentId !== 'string') {
    throw new ValidationError(`${path}.contentId must be a string`);
  }

  if (ls.keyType !== undefined) {
    const validKeyTypes = ['clearkey', 'aes128', 'widevine', 'fairplay', 'playready'];
    if (!validKeyTypes.includes(ls.keyType as string)) {
      throw new ValidationError(`${path}.keyType must be one of ${validKeyTypes.join(', ')}`);
    }
  }
}
