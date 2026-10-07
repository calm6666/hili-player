/**
 * 进度条预览数据源（两种形态兼容）
 *
 * mock-server 同时提供两种预览数据：
 * - 雪碧图：一张大图 + img_x_len/img_y_len/img_x_size/img_y_size，按切片下标裁切（B 站形状）；
 * - 逐帧列表：\u001F 分隔的 jpeg data URL（preview.bin 形状）。
 *
 * 本模块把两者归一为一个纯函数：给定悬停时间，返回该显示哪个图（以及裁切样式）。
 */

/** 进度条预览数据源 */
export interface ProgressPreviewSource {
  /** 逐帧预览图（data URL 数组），preview.bin 形态 */
  frames?: string[];
  /** 雪碧图地址，sprite 形态 */
  imgUrl?: string;
  /** 雪碧图列数 */
  imgXLen?: number;
  /** 雪碧图行数 */
  imgYLen?: number;
  /** 单格宽（像素） */
  imgXSize?: number;
  /** 单格高（像素） */
  imgYSize?: number;
  /** 切片总数（缺省取 imgXLen * imgYLen；index 数组长度更准时可显式传入） */
  sliceCount?: number;
}

/** 某个时间点对应的预览切片 */
export interface ProgressPreviewSlice {
  /** 图片地址（逐帧为 data URL，雪碧图为大图地址） */
  url: string;
  /** 雪碧图裁切样式；逐帧模式为 undefined */
  sprite?: {
    width: string;
    height: string;
    objectFit: 'none';
    objectPosition: string;
  };
  /** 命中的切片下标（便于排查） */
  index: number;
  /** 是否为雪碧图模式 */
  isSprite: boolean;
}

/**
 * 归一化预览数据源
 *
 * @param source - 数组（旧的纯逐帧形态）或结构化数据源；空值返回 null
 * @returns 归一后的数据源；无可用数据返回 null
 */
export function normalizeProgressPreview(
  source?: ProgressPreviewSource | string[] | null,
): ProgressPreviewSource | null {
  if (!source) return null;
  if (Array.isArray(source)) {
    return source.length > 0 ? { frames: source } : null;
  }
  if (Array.isArray(source.frames) && source.frames.length > 0) {
    return { ...source, frames: source.frames };
  }
  const { imgUrl, imgXLen, imgYLen } = source;
  if (
    typeof imgUrl === 'string' &&
    imgUrl.length > 0 &&
    typeof imgXLen === 'number' &&
    imgXLen > 0 &&
    typeof imgYLen === 'number' &&
    imgYLen > 0
  ) {
    return { ...source, imgUrl, imgXLen, imgYLen };
  }
  return null;
}

/**
 * 解析某个时间点应显示的预览切片
 *
 * @param source - 预览数据源（未归一也可）
 * @param time - 悬停时间（秒）
 * @param duration - 视频总时长（秒）
 * @returns 切片信息；无可用数据或时长非法时返回 null
 */
export function resolveProgressPreviewSlice(
  source: ProgressPreviewSource | string[] | null | undefined,
  time: number,
  duration: number,
): ProgressPreviewSlice | null {
  const normalized = normalizeProgressPreview(source);
  if (!normalized || duration <= 0) return null;

  const ratio = Math.max(0, Math.min(1, time / duration));

  if (normalized.frames && normalized.frames.length > 0) {
    const index = Math.min(
      normalized.frames.length - 1,
      Math.floor(ratio * normalized.frames.length),
    );
    const url = normalized.frames[index];
    if (!url) return null;
    return { url, index, isSprite: false };
  }

  const { imgUrl, imgXLen, imgYLen, imgXSize, imgYSize } = normalized;
  if (!imgUrl || !imgXLen || !imgYLen) return null;

  const total = normalized.sliceCount ?? imgXLen * imgYLen;
  const index = Math.min(total - 1, Math.floor(ratio * total));
  if (index < 0) return null;

  const col = index % imgXLen;
  const row = Math.floor(index / imgXLen);
  const width = imgXSize ?? 160;
  const height = imgYSize ?? 90;

  return {
    url: imgUrl,
    index,
    isSprite: true,
    sprite: {
      width: `${width}px`,
      height: `${height}px`,
      objectFit: 'none',
      objectPosition: `-${col * width}px -${row * height}px`,
    },
  };
}
