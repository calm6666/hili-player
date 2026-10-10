/**
 * ============================================
 * EffectChain 效果链管理器
 * ============================================
 * 管理 EQ / Reverb / A3D / Phone / Compressor 五种效果的激活状态与节点连接
 *
 * 采用并联结构：每个效果独立从 mediaSource 接入，输出统一汇入 gain 节点
 *   mediaSource ──► effect_i (active=true) ──► gain ──► destination
 *                └─► (inactive 不连接)
 * 优点：激活/切换互不干扰，单效果出问题不影响其它
 */

import type {
  EffectName,
  EQPresetName,
  EQBandCount,
  ReverbPresetName,
  CombinationPresetName,
} from '../types';
import { COMBINATION_PRESETS, EQ_PRESETS, REVERB_PRESETS } from '../presets';
import { db2gain } from '../utils';
import { EffectBase } from './EffectBase';
import { EQEffect } from './EQEffect';
import { ReverbEffect } from './ReverbEffect';
import { A3DEffect } from './A3DEffect';
import { PhoneEffect } from './PhoneEffect';
import { CompressorEffect } from './CompressorEffect';

/** 单个效果的运行时状态 */
interface EffectState {
  /** 是否激活（参与连接） */
  active: boolean;
  /** 效果节点实例 */
  node: EffectBase;
}

/** 效果列表的固定顺序（用于稳定遍历） */
const EFFECT_ORDER: readonly EffectName[] = ['eq', 'reverb', 'a3d', 'phone', 'compressor'] as const;

/**
 * 效果链 —— 管理 mediaSource → active 效果节点 → gain → destination 的并联连接
 */
export class EffectChain {
  /** AudioContext，由外部插件注入 */
  private audioCtx: AudioContext | null = null;
  /** 上游音频源（MediaElementAudioSourceNode） */
  private source: MediaElementAudioSourceNode | null = null;
  /** 输出总控 GainNode（音量调节） */
  private gain: GainNode | null = null;
  /** 5 个效果的运行时状态映射 */
  private effectsObj: Record<EffectName, EffectState> = {
    eq: { active: false, node: new EQEffect() },
    reverb: { active: false, node: new ReverbEffect() },
    a3d: { active: false, node: new A3DEffect() },
    phone: { active: false, node: new PhoneEffect() },
    compressor: { active: false, node: new CompressorEffect() },
  };
  /** 效果名固定顺序数组 */
  private effectsList: readonly EffectName[] = EFFECT_ORDER;

  /**
   * 初始化：注入 audioCtx / source / gain / destination 引用，
   * 并对每个效果调用 init（让它们各自构建内部节点图）
   * @param audioCtx - AudioContext 实例
   * @param source - 上游 MediaElementAudioSourceNode
   * @param gain - 总控 GainNode
   * @param destination - 最终目标节点（audioCtx.destination）
   */
  init(
    audioCtx: AudioContext,
    source: MediaElementAudioSourceNode,
    gain: GainNode,
    destination: AudioNode,
  ): void {
    this.audioCtx = audioCtx;
    this.source = source;
    this.gain = gain;
    // 总控 gain 必须连到 destination，否则听不到声音
    gain.connect(destination);
    // 每个效果独立 init：上游=source，下游=gain（让效果内部不直接连接 destination，
    // 由 connectAll 统一接管 effect.source() → gain 的最终汇入）
    this.effectsList.forEach((name) => {
      this.effectsObj[name].node.init(audioCtx, source, gain);
    });
  }

  /**
   * 重建所有 active 效果的连接
   * 每个效果：effect.connect() 将 source 接入输入；effect.source().connect(gain) 将输出汇入 gain
   */
  private connectAll(): void {
    if (!this.gain) return;
    const gain = this.gain;
    this.effectsList.forEach((name) => {
      const state = this.effectsObj[name];
      if (!state.active) return;
      state.node.connect();
      state.node.source().connect(gain);
    });
  }

  /**
   * 断开所有 active 效果的连接
   * 与 connectAll 对称：先断输出→gain，再断 source→输入
   * 容错 try/catch：节点可能尚未连接，避免抛出影响后续断开
   */
  private disconnectAll(): void {
    if (!this.gain) return;
    const gain = this.gain;
    this.effectsList.forEach((name) => {
      const state = this.effectsObj[name];
      if (!state.active) return;
      try {
        state.node.source().disconnect(gain);
      } catch {
        // 节点可能尚未连接到 gain，忽略
      }
      try {
        state.node.disconnect();
      } catch {
        // 同上
      }
    });
  }

  /**
   * 设置某个效果的激活状态
   * 改变后通过 disconnectAll + connectAll 重建连接，确保状态一致
   * @param name - 效果名
   * @param active - 是否激活
   */
  setEffectActive(name: EffectName, active: boolean): void {
    const state = this.effectsObj[name];
    if (!state) return;
    if (state.active === active) return;
    this.disconnectAll();
    state.active = active;
    this.connectAll();
  }

  /**
   * 设置总音量（dB）
   * 用 setTargetAtTime 平滑过渡，避免爆音
   * @param db - 分贝值
   */
  setVolume(db: number): void {
    if (!this.gain || !this.audioCtx) return;
    this.gain.gain.setTargetAtTime(db2gain(db), this.audioCtx.currentTime, 0.015);
  }

  /**
   * 设置 EQ 预设
   * 用 instanceof 守卫收窄类型，避免类型断言
   * @param preset - 预设名
   * @param bandCount - 段数（可选，'5' / '10'）
   */
  setEQPreset(preset: EQPresetName, bandCount?: EQBandCount): void {
    const eq = this.effectsObj.eq.node;
    if (eq instanceof EQEffect) {
      if (bandCount) eq.selectType(bandCount);
      eq.selectPreset(preset);
    }
  }

  /**
   * 设置 Reverb 预设
   * 用 instanceof 守卫收窄类型
   * @param preset - 预设名
   */
  setReverbPreset(preset: ReverbPresetName): void {
    const reverb = this.effectsObj.reverb.node;
    if (reverb instanceof ReverbEffect) reverb.selectPreset(preset);
  }

  /**
   * 选择效果组合预设
   * 先将所有效果置为 inactive，再按 preset.items 逐项激活并选择对应预设
   * @param presetName - 组合预设名
   */
  selectCombination(presetName: CombinationPresetName): void {
    const preset = COMBINATION_PRESETS[presetName];
    if (!preset) return;
    this.disconnectAll();
    // 全部置为 inactive
    this.effectsList.forEach((name) => {
      this.effectsObj[name].active = false;
    });
    // 按 items 激活对应效果
    preset.items.forEach((item) => {
      const state = this.effectsObj[item.name];
      if (!state) return;
      state.active = true;
      // 对应预设处理：EQ / Reverb 通过各自的方法应用
      if (item.preset === undefined) return;
      if (item.name === 'eq') {
        const eq = state.node;
        if (eq instanceof EQEffect && this.isEQPresetName(item.preset)) {
          eq.selectPreset(item.preset);
        }
      } else if (item.name === 'reverb') {
        const reverb = state.node;
        if (reverb instanceof ReverbEffect && this.isReverbPresetName(item.preset)) {
          reverb.selectPreset(item.preset);
        }
      }
    });
    this.connectAll();
  }

  /**
   * 类型谓词：判断字符串是否为合法的 EQPresetName
   * 通过查询 EQ_PRESETS 表（5/10 段任一存在即合法）来运行时验证
   * @param value - 待验证字符串
   */
  private isEQPresetName(value: string): value is EQPresetName {
    // EQ_PRESETS 的键为段数 '5'/'10'，每段下表键为预设名
    return value in EQ_PRESETS['5'] || value in EQ_PRESETS['10'];
  }

  /**
   * 类型谓词：判断字符串是否为合法的 ReverbPresetName
   * 通过查询 REVERB_PRESETS 表来运行时验证
   * @param value - 待验证字符串
   */
  private isReverbPresetName(value: string): value is ReverbPresetName {
    return value in REVERB_PRESETS;
  }

  /**
   * 获取效果名固定顺序列表
   * @returns 效果名数组副本
   */
  getEffectsList(): EffectName[] {
    return [...this.effectsList];
  }

  /**
   * 销毁：断开所有连接 + 销毁每个效果 + 断开 source / gain
   */
  destroy(): void {
    this.disconnectAll();
    this.effectsList.forEach((name) => {
      this.effectsObj[name].node.destroy();
    });
    try {
      this.source?.disconnect();
    } catch {
      // source 可能未连接，忽略
    }
    try {
      this.gain?.disconnect();
    } catch {
      // gain 可能未连接，忽略
    }
    this.source = null;
    this.gain = null;
    this.audioCtx = null;
  }
}
