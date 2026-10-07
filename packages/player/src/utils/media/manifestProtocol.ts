/**
 * 清单协议判定 —— 自定义扁平 JSON 清单（MediaManifest）的唯一判定入口。
 *
 * 判定顺序（固定，不可分叉到别处）：
 * 1. 顶层 mediaSourceType === 'dash' | 'hls' → 直接采用；
 * 2. 否则 segmentInfo.mediaSequence !== undefined → HLS；
 * 3. 否则分片描述为单文件字节范围（mode 'single' / 'segmentBase' 且带 indexRange）
 *    → 走 SegmentBase 加载路径，协议默认 DASH（第 1、2 步已判 HLS 时保持 HLS）；
 * 4. 否则（totalCount + segmentTimeline 或 segments）→ DASH。
 *
 * 纯函数、零依赖、不做 DOM 访问，播放器与插件共用同一份实现。
 */

/** 清单声明的流媒体协议 */
export type ManifestProtocol = 'dash' | 'hls';

/** 清单声明的分片组织方式（'segmentBase' 归一为 'single'） */
export type ManifestSegmentMode = 'single' | 'template' | 'list';

/** 清单协议判定结果 */
export interface ManifestProtocolProfile {
  /** 最终生效的协议 */
  protocol: ManifestProtocol;
  /** 顶层 mediaSourceType 显式声明的协议；未声明为 null */
  declared: ManifestProtocol | null;
  /** 归一后的分片模式；清单里没有 segmentInfo 时为 null */
  segmentMode: ManifestSegmentMode | null;
  /** 是否走 SegmentBase 加载路径（单文件 + indexRange） */
  segmentBase: boolean;
  /** 是否存在 HLS 的 mediaSequence 标记 */
  hasMediaSequence: boolean;
}

/** 把任意值收窄为普通对象 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** 协议字符串归一化；非 'dash' / 'hls' 返回 null */
export function normalizeManifestProtocol(value: unknown): ManifestProtocol | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (text === 'dash' || text === 'hls') return text;
  return null;
}

/** 分片模式归一化；'segmentBase' 与 'single' 同义，未知值返回 null */
export function normalizeSegmentMode(value: unknown): ManifestSegmentMode | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (text === 'single' || text === 'segmentbase') return 'single';
  if (text === 'template') return 'template';
  if (text === 'list') return 'list';
  return null;
}

/** 收集清单里所有音视频轨道（含 periods）的 segmentInfo */
function collectSegmentInfos(manifest: Record<string, unknown>): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  const collectFromTracks = (tracks: unknown): void => {
    if (!Array.isArray(tracks)) return;
    for (const track of tracks) {
      const info = asRecord(asRecord(track)?.segmentInfo);
      if (info) result.push(info);
    }
  };

  collectFromTracks(manifest.video);
  collectFromTracks(manifest.audio);

  if (Array.isArray(manifest.periods)) {
    for (const period of manifest.periods) {
      const record = asRecord(period);
      if (!record) continue;
      collectFromTracks(record.video);
      collectFromTracks(record.audio);
    }
  }

  return result;
}

/** 取第一个可归一的分片模式（同一清单内各轨道模式一致） */
function pickSegmentMode(infos: Record<string, unknown>[]): ManifestSegmentMode | null {
  for (const info of infos) {
    const mode = normalizeSegmentMode(info.mode);
    if (mode) return mode;
  }
  return null;
}

/** 是否存在非空的 indexRange 字节范围 */
function hasIndexRange(infos: Record<string, unknown>[]): boolean {
  return infos.some(
    (info) => typeof info.indexRange === 'string' && info.indexRange.trim().length > 0,
  );
}

/**
 * 判定清单协议并给出分片组织信息（唯一实现）
 *
 * @param manifest - 自定义扁平 JSON 清单对象（结构不完整时也能安全判定）
 * @returns 判定结果
 */
export function resolveManifestProtocolProfile(manifest: unknown): ManifestProtocolProfile {
  const record = asRecord(manifest);
  if (!record) {
    return {
      protocol: 'dash',
      declared: null,
      segmentMode: null,
      segmentBase: false,
      hasMediaSequence: false,
    };
  }

  const declared = normalizeManifestProtocol(record.mediaSourceType);
  const infos = collectSegmentInfos(record);
  const segmentMode = pickSegmentMode(infos);
  const hasMediaSequence = infos.some((info) => info.mediaSequence !== undefined);
  const segmentBase = segmentMode === 'single' && hasIndexRange(infos);

  let protocol: ManifestProtocol;
  if (declared) {
    protocol = declared;
  } else if (hasMediaSequence) {
    protocol = 'hls';
  } else {
    protocol = 'dash';
  }

  return { protocol, declared, segmentMode, segmentBase, hasMediaSequence };
}

/**
 * 判定清单协议
 *
 * @param manifest - 自定义扁平 JSON 清单对象
 * @returns 'dash' | 'hls'
 */
export function detectManifestProtocol(manifest: unknown): ManifestProtocol {
  return resolveManifestProtocolProfile(manifest).protocol;
}

/**
 * 是否走 SegmentBase（单文件字节范围）加载路径
 *
 * @param manifest - 自定义扁平 JSON 清单对象
 * @returns 是否为 SegmentBase 清单
 */
export function isSegmentBaseManifest(manifest: unknown): boolean {
  return resolveManifestProtocolProfile(manifest).segmentBase;
}

/**
 * 判断给定源是否为清单对象（含 duration 与 video 字段）
 *
 * @param source - 任意视频源
 * @returns 是否为清单对象
 */
export function isMediaManifestLike(source: unknown): boolean {
  const record = asRecord(source);
  if (!record) return false;
  return 'duration' in record && 'video' in record;
}
