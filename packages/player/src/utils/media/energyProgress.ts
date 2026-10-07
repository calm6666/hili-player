/**
 * 高能进度条（PBP）数据
 *
 * 数据源：mock-server 的 `GET /x/player/pbp` →
 * `{ code, message, data: { step_sec, data: number[], count, duration } }`，
 * 其中 `data[i]` 是第 i 个采样点的热度（0-1，首点对应 0 秒）。
 *
 * 本模块只做「数据 → SVG path」的纯换算，渲染交给 PbpControls。
 */

/** 高能进度条数据 */
export interface EnergyProgressData {
  /** 采样间隔（秒） */
  stepSec: number;
  /** 采样点（0-1） */
  data: number[];
  /** 总时长（秒），用于把播放进度换算成采样点下标 */
  duration?: number;
}

/** 曲线坐标系尺寸（与实际像素解耦，靠 preserveAspectRatio="none" 拉伸） */
export const ENERGY_VIEW_WIDTH = 1000;
export const ENERGY_VIEW_HEIGHT = 100;

/**
 * 归一化高能进度条数据
 *
 * @param value - 任意可能形态（`{step_sec,data}` / `{stepSec,data}` / 纯数组）
 * @returns 归一后的数据；无有效采样点时返回 null
 */
export function normalizeEnergyProgress(value: unknown): EnergyProgressData | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as {
    step_sec?: unknown;
    stepSec?: unknown;
    duration?: unknown;
    data?: unknown;
  };
  const rawData = Array.isArray(record.data) ? record.data : null;
  if (!rawData || rawData.length === 0) return null;

  const data: number[] = [];
  for (const item of rawData) {
    const num = Number(item);
    if (Number.isFinite(num)) data.push(Math.min(1, Math.max(0, num)));
  }
  if (data.length === 0) return null;

  const stepRaw = Number(record.step_sec ?? record.stepSec);
  const durationRaw = Number(record.duration);

  return {
    stepSec: Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : 1,
    data,
    duration: Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : undefined,
  };
}

/**
 * 把采样点换算为「面积路径」（从底边闭合成一块区域）
 *
 * @param samples - 采样点（0-1），长度 >= 1
 * @param throughIndex - 只画到该下标（含）；缺省画满
 * @returns SVG path 的 d 属性；无有效点返回空串
 */
export function buildEnergyAreaPath(
  samples: number[],
  throughIndex?: number,
): string {
  if (samples.length === 0) return '';

  const last =
    throughIndex === undefined
      ? samples.length - 1
      : Math.max(0, Math.min(samples.length - 1, throughIndex));
  const visible = samples.slice(0, last + 1);
  const stepX = ENERGY_VIEW_WIDTH / Math.max(1, samples.length - 1);

  const points = visible.map((value, index) => {
    const x = index * stepX;
    const y = ENERGY_VIEW_HEIGHT - value * ENERGY_VIEW_HEIGHT;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const lastX = (last * stepX).toFixed(2);
  return [
    `M0,${ENERGY_VIEW_HEIGHT}`,
    ...points.map((point) => `L${point}`),
    `L${lastX},${ENERGY_VIEW_HEIGHT}`,
    'Z',
  ].join(' ');
}

/**
 * 把播放进度换算成采样点下标
 *
 * @param data - 高能数据
 * @param time - 当前播放时间（秒）
 * @returns 采样点下标（已夹在 [0, length-1]）
 */
export function energyIndexAt(data: EnergyProgressData, time: number): number {
  const total = data.duration ?? data.stepSec * data.data.length;
  if (!Number.isFinite(time) || total <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, time / total));
  return Math.max(0, Math.min(data.data.length - 1, Math.floor(ratio * data.data.length)));
}
