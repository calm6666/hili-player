/**
 * ============================================
 * 音效预设表
 * ============================================
 * EQ 均衡器（5/10 段）、Reverb 混响、Compressor 压缩器、组合预设
 * 所有数据从原始 Web Audio 音效链实现中提取，保持参数一致性
 */

import type {
  EQPresetTable,
  ReverbPresetTable,
  CompressorPresetTable,
  CombinationPresetTable,
} from './types';

/**
 * EQ 预设表
 * - '5' 段：4 个预设（custom/default/bassBooster/bassReducer）
 * - '10' 段：22 个预设（含 custom/default 及 20 种风格化曲线）
 * 增益单位为 dB，正数提升 / 负数衰减
 */
export const EQ_PRESETS: EQPresetTable = {
  '5': {
    custom: [0, 0, 0, 0, 0],
    default: [0, 0, 0, 0, 0],
    bassBooster: [5, 4, 3, 2, 1],
    bassReducer: [-5, -4, -3, -2, -1],
  },
  '10': {
    custom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    default: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    classical: [4.5, 4, 3, 2, -1, -1, 0, 2, 3, 4],
    dance: [4, 7, 5, 0, 2, 3, 5, 4, 3, 0],
    deep: [5, 3, 2, 1, 3, 2, 1, -2, -4, -5],
    electronic: [4.5, 3.5, 1, 0, -2, 2, 0.5, 1, 4, 5],
    hiphop: [5, 4, 1, 3, -1, -1, 1, -1, 2, 3],
    jazz: [4, 3, 1, 2, -2, -2, 0, 1, 3, 4],
    latin: [4.5, 3, 0, 0, -1.5, -1.5, -1.5, 0, 3, 4.5],
    loudness: [6, 4, 0, 0, -2, 0, -1, -5, 5, 1],
    lounge: [-3, -1.5, -0.5, 1.5, 4, 2, 0, -1.5, 2, 1],
    piano: [3, 2, 0, 2.5, 3, 1, 3.5, 4, 3, 3.5],
    pop: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2],
    rnb: [3, 7, 6, 2, -3, -2, 2, 3, 3, 4],
    rock: [5, 4, 3, 2, -1, -1, 1, 3, 4, 5],
    smallSpeakers: [5, 4, 3, 2, 1, 0, -1, -2, -3, -4],
    spokenWord: [-4, -1, 0, 1, 4, 5, 5, 4, 2, 0],
    trebleBooster: [0, 0, 0, 0, 0, 1, 2, 3, 4, 5],
    trebleReducer: [0, 0, 0, 0, 0, -1, -2, -3, -4, -5],
    vocalBooster: [-2, -3, -3, 1, 4, 4, 3, 1, 0, -2],
    guitar: [-5, -3, -2, 2, -0.5, 0, 0, 2, 6, 0],
  },
};

/**
 * Reverb 预设表
 * - default：标准混响（中等的混合比和衰减）
 * - room：房间感（短衰减）
 * - live：现场感（长衰减、低混合比）
 * - bathroom：浴室（高混合比、极短衰减、Moorer IR）
 * - hall：音乐厅（超长衰减，由 live 衍生）
 */
export const REVERB_PRESETS: ReverbPresetTable = {
  default: {
    mix: 0.5,
    decay: 2,
    fadeIn: 10,
    reverse: false,
    ir: 'simple',
    highCut: 7000,
    lowCut: 80,
    gain: 1,
  },
  room: {
    mix: 0.5,
    decay: 1.4,
    fadeIn: 10,
    reverse: false,
    ir: 'simple',
    highCut: 7000,
    lowCut: 80,
    gain: 1,
  },
  live: {
    mix: 0.3,
    decay: 3,
    fadeIn: 17,
    reverse: false,
    ir: 'simple',
    highCut: 7000,
    lowCut: 0,
    gain: 1,
  },
  bathroom: {
    mix: 0.9,
    decay: 0.6,
    fadeIn: 0.3,
    reverse: false,
    ir: 'moorer',
    highCut: 7000,
    lowCut: 0,
    gain: 2,
  },
  hall: {
    mix: 0.4,
    decay: 4.5,
    fadeIn: 20,
    reverse: false,
    ir: 'simple',
    highCut: 7000,
    lowCut: 60,
    gain: 1.2,
  },
};

/**
 * Compressor 预设表
 * - default：通用压缩参数（适合大多数视频源）
 * - loudnessStandard：设置面板「音量均衡·标准」—— 较高阈值提前触发 +
 *   高比率强压缩，把忽大忽小的节目响度拉平（对白/夜间观看友好）
 * - loudnessDynamic：设置面板「音量均衡·高动态」—— 深阈值只压峰值 +
 *   低比率温和压缩，保留节目的动态起伏（音乐/电影场景）
 */
export const COMPRESSOR_PRESETS: CompressorPresetTable = {
  default: {
    threshold: -24,
    knee: 30,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
  },
  loudnessStandard: {
    threshold: -18,
    knee: 24,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
  },
  loudnessDynamic: {
    threshold: -32,
    knee: 12,
    ratio: 4,
    attack: 0.01,
    release: 0.4,
  },
};

/**
 * 组合预设表
 * - default：EQ 默认
 * - bassBooster：EQ 低音增强
 * - piano：EQ piano + Reverb room
 * - pop/rnb/spokenWord：对应 EQ 预设
 * - concertHall：Reverb hall
 * - bathroom：Reverb bathroom
 * - a3d / phone：单效果激活
 */
export const COMBINATION_PRESETS: CombinationPresetTable = {
  default: {
    items: [{ name: 'eq', preset: 'default' }],
  },
  bassBooster: {
    items: [{ name: 'eq', preset: 'bassBooster' }],
  },
  piano: {
    items: [
      { name: 'eq', preset: 'piano' },
      { name: 'reverb', preset: 'room' },
    ],
  },
  pop: {
    items: [{ name: 'eq', preset: 'pop' }],
  },
  rnb: {
    items: [{ name: 'eq', preset: 'rnb' }],
  },
  spokenWord: {
    items: [{ name: 'eq', preset: 'spokenWord' }],
  },
  concertHall: {
    items: [{ name: 'reverb', preset: 'hall' }],
  },
  bathroom: {
    items: [{ name: 'reverb', preset: 'bathroom' }],
  },
  a3d: {
    items: [{ name: 'a3d' }],
  },
  phone: {
    items: [{ name: 'phone' }],
  },
};
