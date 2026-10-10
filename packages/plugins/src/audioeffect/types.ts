/**
 * ============================================
 * 音效插件类型定义
 * ============================================
 * 定义效果名、预设名、混响数据、压缩器数据、效果组合等类型
 */

/** 效果名 — 五种音效 */
export type EffectName = 'eq' | 'reverb' | 'a3d' | 'phone' | 'compressor';

/** EQ 段数 */
export type EQBandCount = '5' | '10';

/** EQ 预设名 */
export type EQPresetName =
  | 'custom'
  | 'default'
  | 'bassBooster'
  | 'bassReducer'
  | 'classical'
  | 'dance'
  | 'deep'
  | 'electronic'
  | 'hiphop'
  | 'jazz'
  | 'latin'
  | 'loudness'
  | 'lounge'
  | 'piano'
  | 'pop'
  | 'rnb'
  | 'rock'
  | 'smallSpeakers'
  | 'spokenWord'
  | 'trebleBooster'
  | 'trebleReducer'
  | 'vocalBooster'
  | 'guitar';

/** Reverb IR 类型 */
export type ReverbIRType = 'simple' | 'moorer';

/** Reverb 预设名 */
export type ReverbPresetName = 'default' | 'room' | 'live' | 'bathroom' | 'hall';

/** 效果组合预设名 */
export type CombinationPresetName =
  | 'default'
  | 'bassBooster'
  | 'piano'
  | 'pop'
  | 'rnb'
  | 'spokenWord'
  | 'concertHall'
  | 'bathroom'
  | 'a3d'
  | 'phone';

/** EQ 增益数组 */
export type EQGainArray = readonly number[];

/** EQ 预设表 — 段数 -> 预设名 -> 增益数组 */
export type EQPresetTable = Readonly<Record<EQBandCount, Readonly<Record<string, EQGainArray>>>>;

/** Reverb 数据 */
export interface ReverbData {
  /** 干湿混合 (0~1) */
  mix: number;
  /** 衰减时间（秒） */
  decay: number;
  /** 淡入时长（毫秒） */
  fadeIn: number;
  /** 是否反向 */
  reverse: boolean;
  /** IR 类型 */
  ir: ReverbIRType;
  /** 高通截止频率（Hz） */
  highCut: number;
  /** 低通截止频率（Hz） */
  lowCut: number;
  /** 整体增益 */
  gain: number;
}

/** Reverb 预设表 — 预设名 -> ReverbData */
export type ReverbPresetTable = Readonly<Record<string, ReverbData>>;

/** Compressor 数据 */
export interface CompressorData {
  /** 阈值（dB） */
  threshold: number;
  /** 拐点（dB） */
  knee: number;
  /** 比率 */
  ratio: number;
  /** 启动时间（秒） */
  attack: number;
  /** 释放时间（秒） */
  release: number;
}

/** Compressor 预设表 — 预设名 -> CompressorData */
export type CompressorPresetTable = Readonly<Record<string, CompressorData>>;

/** 效果组合项 */
export interface CombinationItem {
  /** 效果名 */
  name: EffectName;
  /** 预设名（可选，a3d/phone 无预设） */
  preset?: string;
}

/** 效果组合预设项 */
export interface CombinationPreset {
  /** 组合项列表 */
  items: readonly CombinationItem[];
}

/** 效果组合预设表 — 预设名 -> CombinationPreset */
export type CombinationPresetTable = Readonly<Record<string, CombinationPreset>>;

/** 效果激活状态映射 */
export type EffectActiveMap = Readonly<Record<EffectName, boolean>>;
