/**
 * 清单文本解析器 —— 从 .m3u8 / .mpd 文本中提取清晰度档位信息
 *
 * 与 manifest-to-hls.ts / manifest-to-dash.ts 的单向转换互补：
 * 后者做「JSON 对象 → 库内部对象」，本文件做「协议文本 → 档位信息」。
 *
 * 设计要点：
 * - 纯函数，除 DOMParser / fetch 外不做任何 DOM 操作，SSR 下 import 不报错；
 * - HLS 属性串按「引号外的逗号」切分（CODECS 值里可能带逗号）；
 * - DASH 优先用 DOMParser，不可用时（SSR / Node）降级为正则抽取。
 */

import type { ManifestVariant, ManifestAudioGroup } from 'hls.js';
import type { MediaManifest, MediaRepresentation, SegmentInfo } from './types/index';
import { resolveUrl } from './utils/index';
import type { HlsManifestData } from './manifest-to-hls';

// ============================================================================
// 通用解析工具
// ============================================================================

/**
 * 按「引号外的分隔符」切分字符串
 *
 * 协议里的属性值可能带引号且引号内含分隔符（如 CODECS="avc1.640028,mp4a.40.2"），
 * 直接 split(',') 会把一个值拆成两段，因此要跳过引号内部的分隔符。
 *
 * @param input - 待切分文本
 * @param delimiter - 分隔符（单字符）
 * @returns 切分后的片段数组（保留引号）
 */
function splitOutsideQuotes(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === delimiter && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * 解析 HLS 属性列表串 → 键值对象
 *
 * 输入形如 `BANDWIDTH=5000000,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080`，
 * 键统一转大写，值去掉包裹的双引号（内部的逗号原样保留）。
 *
 * @param input - 冒号之后的完整属性串
 * @returns 属性名（大写）到值的映射
 */
function parseAttributeList(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of splitOutsideQuotes(input, ',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toUpperCase();
    if (!key) continue;
    let value = part.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** 字符串转数字，非法值返回 undefined（避免把 NaN 写进结果） */
function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

// ============================================================================
// HLS（m3u8）解析
// ============================================================================

/**
 * 解析 `RESOLUTION=1920x1080` 形式的字符串
 *
 * @returns 宽高对象；缺失或格式非法时返回 undefined
 */
function parseResolution(value: string | undefined): { width: number; height: number } | undefined {
  if (!value) return undefined;
  const matched = /^(\d+)[xX](\d+)$/.exec(value.trim());
  if (!matched) return undefined;
  return { width: Number(matched[1]), height: Number(matched[2]) };
}

/**
 * 从某行之后的第一个「非注释、非空」行取 variant URI
 *
 * @param lines - 播放列表按行切分后的数组
 * @param startIndex - 起始扫描下标（#EXT-X-STREAM-INF 行的下一行）
 * @returns 原始 URI；找不到时返回 undefined
 */
function nextUriLine(lines: string[], startIndex: number): string | undefined {
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    return line;
  }
  return undefined;
}

/**
 * 由 `#EXT-X-STREAM-INF` 属性构造 ManifestVariant
 *
 * @param attrs - 属性映射（键已大写）
 * @param uri - 已解析为绝对地址的变体 URI
 */
function buildVariant(attrs: Record<string, string>, uri: string): ManifestVariant {
  /* ManifestVariant.bandwidth 必填：BANDWIDTH 缺失时退回 AVERAGE-BANDWIDTH */
  const bandwidth = toNumber(attrs['BANDWIDTH']) ?? toNumber(attrs['AVERAGE-BANDWIDTH']) ?? 0;
  const variant: ManifestVariant = { bandwidth, url: uri };

  if (attrs['CODECS']) variant.codecs = attrs['CODECS'];

  const resolution = parseResolution(attrs['RESOLUTION']);
  if (resolution) variant.resolution = resolution;

  const frameRate = toNumber(attrs['FRAME-RATE']);
  if (frameRate !== undefined) variant.frameRate = frameRate;

  if (attrs['AUDIO']) variant.audioGroupId = attrs['AUDIO'];

  return variant;
}

/**
 * 由 `#EXT-X-MEDIA`（TYPE=AUDIO）属性构造 ManifestAudioGroup
 *
 * @param attrs - 属性映射（键已大写）
 * @param baseUrl - 用于把 URI 解析为绝对地址
 */
function buildAudioGroup(attrs: Record<string, string>, baseUrl: string): ManifestAudioGroup {
  const rawUri = attrs['URI'];
  const group: ManifestAudioGroup = {
    groupId: attrs['GROUP-ID'] ?? '',
    /* 带内音频没有独立 URI，此时留空串以满足必填类型 */
    url: rawUri ? resolveUrl(baseUrl, rawUri) : '',
  };

  if (attrs['NAME']) group.name = attrs['NAME'];
  if (attrs['LANGUAGE']) group.lang = attrs['LANGUAGE'];
  if (attrs['DEFAULT']) group.default = attrs['DEFAULT'].toUpperCase() === 'YES';
  if (attrs['AUTOSELECT']) group.autoselect = attrs['AUTOSELECT'].toUpperCase() === 'YES';

  return group;
}

/**
 * 解析 m3u8 主播放列表文本 → 档位信息
 *
 * 支持 `#EXT-X-STREAM-INF`（变体流）与 `#EXT-X-MEDIA`（音频组）。
 * 若文本是媒体播放列表（含 #EXTINF 而无 #EXT-X-STREAM-INF），
 * 返回空 variants/audioGroups，由调用方降级为「单档」。
 *
 * @param text - m3u8 文本内容
 * @param baseUrl - 变体/音频 URI 的解析基准（通常是播放列表所在目录）
 * @returns 与 HlsManifestData 完全一致的结构
 */
export function parseHlsManifest(text: string, baseUrl: string): HlsManifestData {
  const variants: ManifestVariant[] = [];
  const audioGroups: ManifestAudioGroup[] = [];

  /* 媒体播放列表：没有多档位信息，直接返回空，交由调用方按单档处理 */
  if (text.includes('#EXTINF') && !text.includes('#EXT-X-STREAM-INF')) {
    return { variants, audioGroups };
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attrs = parseAttributeList(line.slice('#EXT-X-STREAM-INF:'.length));
      const uri = nextUriLine(lines, i + 1);
      if (uri) variants.push(buildVariant(attrs, resolveUrl(baseUrl, uri)));
      continue;
    }

    if (line.startsWith('#EXT-X-MEDIA:')) {
      const attrs = parseAttributeList(line.slice('#EXT-X-MEDIA:'.length));
      /* audioGroups 只收纳音频轨道，SUBTITLES / CLOSED-CAPTIONS 等忽略 */
      if ((attrs['TYPE'] ?? '').toUpperCase() === 'AUDIO') {
        audioGroups.push(buildAudioGroup(attrs, baseUrl));
      }
    }
  }

  return { variants, audioGroups };
}

// ============================================================================
// DASH（MPD）解析
// ============================================================================

/** 正则路径解析出的 Representation：标签属性 + 子节点信息 */
interface RawRepresentation {
  attributes: Record<string, string>;
  /** BaseURL 子节点原始文本 */
  baseUrl?: string;
  /** SegmentTemplate 子节点属性 */
  segmentTemplate?: Record<string, string>;
  /** SegmentList 子节点属性 */
  segmentList?: Record<string, string>;
  /** SegmentBase 子节点属性 */
  segmentBase?: Record<string, string>;
}

/** 正则路径解析出的 AdaptationSet：自身属性 + 所属 Representation */
interface RawAdaptationSet {
  attributes: Record<string, string>;
  segmentTemplate?: Record<string, string>;
  segmentList?: Record<string, string>;
  segmentBase?: Record<string, string>;
  representations: RawRepresentation[];
}

/**
 * 解析 ISO 8601 duration（形如 PT1H2M3.5S）→ 秒
 *
 * @returns 秒数；无法解析时返回 undefined
 */
function parseIsoDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const matched = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/.exec(value.trim());
  if (!matched) return undefined;
  const days = Number(matched[1] ?? 0);
  const hours = Number(matched[2] ?? 0);
  const minutes = Number(matched[3] ?? 0);
  const seconds = Number(matched[4] ?? 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * 解析 XML 属性串 → 键值对象（正则降级路径用）
 *
 * 同时兼容双引号与单引号属性值。
 */
function readAttributes(attrText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let matched: RegExpExecArray | null;
  while ((matched = re.exec(attrText)) !== null) {
    result[matched[1]] = matched[2] !== undefined ? matched[2] : matched[3];
  }
  return result;
}

/**
 * 读取 MPD 根标签属性（两种解析路径共用）
 *
 * 直接对 `<MPD ...>` 开标签做正则，避免依赖 DOM。
 */
function readMpdAttributes(text: string): Record<string, string> {
  const matched = /<MPD\b([^>]*)>/i.exec(text);
  return matched ? readAttributes(matched[1]) : {};
}

/** 取某元素的直接子元素中 localName 匹配的列表（DOMParser 路径用） */
function directChildElements(parent: Element, localName: string): Element[] {
  const result: Element[] = [];
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].localName === localName) result.push(children[i]);
  }
  return result;
}

/** DOM 元素全部属性 → 键值对象 */
function domElementAttributes(element: Element): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    result[attr.name] = attr.value;
  }
  return result;
}

/** 取某元素的第一个直接子元素 localName 匹配的文本内容（DOMParser 路径用） */
function domChildText(parent: Element, localName: string): string | undefined {
  const found = directChildElements(parent, localName)[0];
  return found ? (found.textContent ?? '').trim() : undefined;
}

/** 把 DOMParser 解析出的 Representation 元素转成 RawRepresentation */
function domRepresentation(element: Element): RawRepresentation {
  const rep: RawRepresentation = { attributes: domElementAttributes(element) };
  const baseUrl = domChildText(element, 'BaseURL');
  if (baseUrl) rep.baseUrl = baseUrl;
  const template = directChildElements(element, 'SegmentTemplate')[0];
  if (template) rep.segmentTemplate = domElementAttributes(template);
  const list = directChildElements(element, 'SegmentList')[0];
  if (list) rep.segmentList = domElementAttributes(list);
  const base = directChildElements(element, 'SegmentBase')[0];
  if (base) rep.segmentBase = domElementAttributes(base);
  return rep;
}

/**
 * DOMParser 路径：解析出所有 AdaptationSet
 *
 * @returns AdaptationSet 列表；XML 解析失败（parsererror）时返回 null，交由正则降级
 */
function parseAdaptationSetsWithDom(text: string): RawAdaptationSet[] | null {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  /* DOMParser 不抛异常，解析失败时会产出 <parsererror> 节点 */
  if (doc.getElementsByTagName('parsererror').length > 0) return null;

  const periods: Element[] = [];
  const periodNodes = doc.getElementsByTagName('Period');
  for (let i = 0; i < periodNodes.length; i++) periods.push(periodNodes[i]);
  /* 无 Period 时退化为直接扫描根节点下的 AdaptationSet */
  if (periods.length === 0 && doc.documentElement) periods.push(doc.documentElement);

  const result: RawAdaptationSet[] = [];
  for (const period of periods) {
    for (const adapt of directChildElements(period, 'AdaptationSet')) {
      const raw: RawAdaptationSet = {
        attributes: domElementAttributes(adapt),
        representations: directChildElements(adapt, 'Representation').map(domRepresentation),
      };
      const template = directChildElements(adapt, 'SegmentTemplate')[0];
      if (template) raw.segmentTemplate = domElementAttributes(template);
      const list = directChildElements(adapt, 'SegmentList')[0];
      if (list) raw.segmentList = domElementAttributes(list);
      const base = directChildElements(adapt, 'SegmentBase')[0];
      if (base) raw.segmentBase = domElementAttributes(base);
      result.push(raw);
    }
  }
  return result;
}

/** 从一段块文本里取第一个指定标签的属性（正则降级路径用） */
function extractTagAttributes(block: string, tag: string): Record<string, string> | undefined {
  const re = new RegExp(`<${tag}\\b([^>]*?)\\/?>`);
  const matched = re.exec(block);
  return matched ? readAttributes(matched[1]) : undefined;
}

/** 从一段块文本里取第一个指定标签的文本内容 */
function extractTagText(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const matched = re.exec(block);
  return matched ? matched[1].trim() : undefined;
}

/**
 * 正则降级路径：从 XML 文本抽取所有 AdaptationSet
 *
 * 用于 SSR / Node 等无 DOMParser 的场景，仅覆盖
 * Period > AdaptationSet > Representation 这一必要层级。
 */
function parseAdaptationSetsWithRegex(text: string): RawAdaptationSet[] {
  const result: RawAdaptationSet[] = [];
  const adaptRe = /<AdaptationSet\b([^>]*)>([\s\S]*?)<\/AdaptationSet>/gi;
  let adaptMatch: RegExpExecArray | null;

  while ((adaptMatch = adaptRe.exec(text)) !== null) {
    const body = adaptMatch[2];
    const current: RawAdaptationSet = {
      attributes: readAttributes(adaptMatch[1]),
      representations: [],
    };

    /* AdaptationSet 级别的分片描述（供 Representation 继承） */
    const adaptTemplate = extractTagAttributes(body, 'SegmentTemplate');
    if (adaptTemplate) current.segmentTemplate = adaptTemplate;
    const adaptList = extractTagAttributes(body, 'SegmentList');
    if (adaptList) current.segmentList = adaptList;
    const adaptBase = extractTagAttributes(body, 'SegmentBase');
    if (adaptBase) current.segmentBase = adaptBase;

    const repRe = /<Representation\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Representation>)/gi;
    let repMatch: RegExpExecArray | null;
    while ((repMatch = repRe.exec(body)) !== null) {
      const repBody = repMatch[2] ?? '';
      const rawRep: RawRepresentation = { attributes: readAttributes(repMatch[1]) };
      const baseUrl = extractTagText(repBody, 'BaseURL');
      if (baseUrl) rawRep.baseUrl = baseUrl;
      const template = extractTagAttributes(repBody, 'SegmentTemplate');
      if (template) rawRep.segmentTemplate = template;
      const list = extractTagAttributes(repBody, 'SegmentList');
      if (list) rawRep.segmentList = list;
      const base = extractTagAttributes(repBody, 'SegmentBase');
      if (base) rawRep.segmentBase = base;
      current.representations.push(rawRep);
    }

    result.push(current);
  }
  return result;
}

/**
 * 构造最小可用的 SegmentInfo
 *
 * MPD 里的 Representation 可能只给 BaseURL 而没有分片描述。
 * MediaRepresentation.segmentInfo 是必填字段，这里按「能找到什么填什么」的原则
 * 产出最小对象：**这类字段仅用于满足类型 / 供档位展示**，播放器真正取流时
 * 应以完整 MPD 或转换后的清单为准。
 *
 * 优先级：Representation 自身 > AdaptationSet（DASH 允许分片描述向上继承）。
 */
function buildSegmentInfo(rep: RawRepresentation, set: RawAdaptationSet): SegmentInfo {
  const template = rep.segmentTemplate ?? set.segmentTemplate;
  if (template) {
    const info: SegmentInfo = { mode: 'template' };
    if (template['media']) info.media = template['media'];
    if (template['initialization']) info.initialization = template['initialization'];
    const startNumber = toNumber(template['startNumber']);
    if (startNumber !== undefined) info.startNumber = startNumber;
    const timescale = toNumber(template['timescale']);
    if (timescale !== undefined) info.timescale = timescale;
    return info;
  }

  if (rep.segmentList ?? set.segmentList) {
    return { mode: 'list' };
  }

  const base = rep.segmentBase ?? set.segmentBase;
  if (base) {
    const info: SegmentInfo = { mode: 'single' };
    if (base['indexRange']) info.indexRange = base['indexRange'];
    const timescale = toNumber(base['timescale']);
    if (timescale !== undefined) info.timescale = timescale;
    return info;
  }

  /* 仅有 BaseURL、没有任何分片描述：按单文件模式构造最小值（仅为满足类型/供档位展示） */
  return { mode: 'single' };
}

/** 判定 AdaptationSet 的媒体类型 */
function classifyAdaptationSet(set: RawAdaptationSet): 'video' | 'audio' | 'none' {
  const contentType = (set.attributes['contentType'] ?? '').toLowerCase();
  const mimeType = (set.attributes['mimeType'] ?? '').toLowerCase();
  if (contentType === 'video' || mimeType.startsWith('video/')) return 'video';
  if (contentType === 'audio' || mimeType.startsWith('audio/')) return 'audio';
  return 'none';
}

/** 解析 frameRate：既支持 "25"，也支持 "30000/1001" 这类分数 */
function parseFrameRate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const text = value.trim();
  const slash = text.indexOf('/');
  if (slash === -1) return toNumber(text);
  const numerator = toNumber(text.slice(0, slash));
  const denominator = toNumber(text.slice(slash + 1));
  if (numerator === undefined || denominator === undefined || denominator === 0) return undefined;
  return numerator / denominator;
}

/**
 * 由 RawAdaptationSet 列表构造统一的 MediaManifest
 *
 * 多 Period 场景下，所有 Period 的视频/音频 Representation 会被汇总到
 * 同一个 video/audio 数组中（见任务约定）。
 */
function buildManifest(
  sets: RawAdaptationSet[],
  meta: { duration: number; minBufferTime?: number; maxSegmentDuration?: number },
  baseUrl: string,
): MediaManifest {
  const video: MediaRepresentation[] = [];
  const audio: MediaRepresentation[] = [];
  let videoIndex = 0;
  let audioIndex = 0;

  for (const set of sets) {
    const kind = classifyAdaptationSet(set);
    if (kind === 'none') continue;
    const isVideo = kind === 'video';

    for (const rep of set.representations) {
      const attrs = rep.attributes;
      const mimeType =
        attrs['mimeType'] ?? set.attributes['mimeType'] ?? (isVideo ? 'video/mp4' : 'audio/mp4');
      const codecs = attrs['codecs'] ?? set.attributes['codecs'] ?? '';
      const bandwidth = toNumber(attrs['bandwidth']) ?? toNumber(attrs['maxBandwidth']) ?? 0;
      const id = attrs['id'] ?? (isVideo ? `v${videoIndex}` : `a${audioIndex}`);

      const representation: MediaRepresentation = {
        id,
        bandwidth,
        mimeType,
        codecs,
        segmentInfo: buildSegmentInfo(rep, set),
      };

      if (rep.baseUrl) representation.baseUrl = resolveUrl(baseUrl, rep.baseUrl);

      if (isVideo) {
        const width = toNumber(attrs['width']);
        if (width !== undefined) representation.width = width;
        const height = toNumber(attrs['height']);
        if (height !== undefined) representation.height = height;
        const frameRate = parseFrameRate(attrs['frameRate']);
        if (frameRate !== undefined) representation.frameRate = frameRate;
        video.push(representation);
        videoIndex++;
      } else {
        if (set.attributes['lang']) representation.lang = set.attributes['lang'];
        audio.push(representation);
        audioIndex++;
      }
    }
  }

  const manifest: MediaManifest = { duration: meta.duration, video };
  if (audio.length > 0) manifest.audio = audio;
  if (meta.minBufferTime !== undefined) manifest.minBufferTime = meta.minBufferTime;
  if (meta.maxSegmentDuration !== undefined) manifest.maxSegmentDuration = meta.maxSegmentDuration;
  return manifest;
}

/**
 * 解析 MPD 文本 → 统一清单对象
 *
 * 优先使用 DOMParser；不可用（SSR / Node）或 XML 解析失败时降级为正则抽取。
 * 取出 MPD@mediaPresentationDuration / minBufferTime / maxSegmentDuration，
 * 并汇总所有 Period 下的视频与音频 Representation。
 *
 * @param text - MPD XML 文本
 * @param baseUrl - BaseURL 相对路径的解析基准
 * @returns 统一 MediaManifest（仅填充档位相关字段）
 */
export function parseDashManifest(text: string, baseUrl: string): MediaManifest {
  const mpdAttrs = readMpdAttributes(text);

  /* DOMParser 可用时走标准路径；返回 null 表示 XML 非法，退回正则 */
  let sets: RawAdaptationSet[] | null = null;
  if (typeof DOMParser !== 'undefined') {
    sets = parseAdaptationSetsWithDom(text);
  }
  if (!sets) sets = parseAdaptationSetsWithRegex(text);

  const duration = parseIsoDuration(mpdAttrs['mediaPresentationDuration']) ?? 0;
  const meta: { duration: number; minBufferTime?: number; maxSegmentDuration?: number } = { duration };
  const minBufferTime = parseIsoDuration(mpdAttrs['minBufferTime']);
  if (minBufferTime !== undefined) meta.minBufferTime = minBufferTime;
  const maxSegmentDuration = parseIsoDuration(mpdAttrs['maxSegmentDuration']);
  if (maxSegmentDuration !== undefined) meta.maxSegmentDuration = maxSegmentDuration;

  return buildManifest(sets, meta, baseUrl);
}

// ============================================================================
// 按 URL 拉取并解析
// ============================================================================

/** 取 URL 路径（去掉 query/hash）的小写扩展名，如 ".m3u8"、".mpd" */
function extensionOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  const slash = path.lastIndexOf('/');
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

/** 取 URL 的目录部分（去掉文件名与 query/hash，保留尾部斜杠） */
function baseUrlOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(0, slash + 1) : '';
}

/**
 * 按 URL 扩展名拉取并解析清单
 *
 * .m3u8 → parseHlsManifest；.mpd → parseDashManifest；
 * 其余扩展名直接 reject 带说明的 Error；非 2xx 响应也会 throw（含状态码）。
 *
 * @param url - 清单地址
 * @returns HLS 档位信息或 DASH 清单对象
 */
export async function fetchAndParseManifest(url: string): Promise<HlsManifestData | MediaManifest> {
  const ext = extensionOf(url);

  let accept: string;
  if (ext === '.m3u8') {
    accept = 'application/vnd.apple.mpegurl';
  } else if (ext === '.mpd') {
    accept = 'application/dash+xml';
  } else {
    throw new Error(`不支持的清单扩展名："${ext || '(无)'}"，仅支持 .m3u8 / .mpd：${url}`);
  }

  const response = await fetch(url, { headers: { Accept: accept } });
  if (!response.ok) {
    throw new Error(`拉取清单失败：HTTP ${response.status} ${response.statusText}（${url}）`);
  }

  const text = await response.text();
  const baseUrl = baseUrlOf(url);
  return ext === '.m3u8' ? parseHlsManifest(text, baseUrl) : parseDashManifest(text, baseUrl);
}
