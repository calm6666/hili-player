/**
 * ============================================
 * EQ 均衡器效果
 * ============================================
 * 由 input(GainNode) → eq[](BiquadFilterNode peaking) → output(GainNode) 串联构成
 * 支持 5 / 10 段切换，每个频段可独立设置增益
 */

import type { EQBandCount, EQPresetName } from '../types';
import { EQ_PRESETS } from '../presets';
import { EffectBase } from './EffectBase';

/** EQ 各段中心频率（10 段标准） */
const EQ_FREQUENCIES_10: readonly number[] = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
];

/** EQ 各段中心频率（5 段：从 10 段中每隔一段抽取） */
const EQ_FREQUENCIES_5: readonly number[] = [60, 250, 1000, 4000, 12000];

/**
 * EQ 均衡器
 * 内部节点图：input(GainNode) → eq[0..n-1](BiquadFilter peaking) → output(GainNode)
 */
export class EQEffect extends EffectBase {
  /** 输入节点 */
  private inputNode: GainNode | null = null;
  /** 输出节点 */
  private outputNode: GainNode | null = null;
  /** BiquadFilter 数组，每段一个 */
  private eq: BiquadFilterNode[] = [];
  /** 当前段数 */
  private bandCount: EQBandCount = '10';
  /** 当前预设名 */
  private presetName: EQPresetName = 'default';

  /** 在 init 之后构建 BiquadFilter 节点链 */
  public override init(
    audioCtx: AudioContext,
    source: AudioNode,
    destination: AudioNode,
  ): void {
    super.init(audioCtx, source, destination);
    this.inputNode = audioCtx.createGain();
    this.outputNode = audioCtx.createGain();
    this.resetEQ(this.bandCount);
    // 应用默认预设增益
    this.applyPreset(this.presetName);
  }

  /**
   * 重建 eq 数组（按段数创建 BiquadFilter 并串联）
   * @param bandCount - 段数 '5' / '10'
   */
  resetEQ(bandCount: EQBandCount): void {
    if (!this.audioCtx || !this.inputNode || !this.outputNode) return;
    // 先断开旧节点
    this.eq.forEach((node) => node.disconnect());
    this.inputNode.disconnect();
    this.bandCount = bandCount;
    /** 频率表 */
    const frequencies = bandCount === '5' ? EQ_FREQUENCIES_5 : EQ_FREQUENCIES_10;
    /** 创建 BiquadFilter 数组 */
    this.eq = frequencies.map((freq) => {
      const filter = this.audioCtx!.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = 0;
      return filter;
    });
    // 串联：input → eq[0] → eq[1] → ... → output
    this.inputNode.connect(this.eq[0]);
    for (let i = 0; i < this.eq.length - 1; i++) {
      this.eq[i].connect(this.eq[i + 1]);
    }
    this.eq[this.eq.length - 1].connect(this.outputNode);
  }

  /**
   * 应用预设增益数组
   * @param presetName - 预设名
   */
  private applyPreset(presetName: EQPresetName): void {
    /** 当前段数对应的预设表 */
    const table = EQ_PRESETS[this.bandCount];
    /** 预设增益数组 */
    const gains = table[presetName];
    if (!gains) return;
    // 用 setValueAtTime 平滑过渡，避免爆音
    const now = this.audioCtx?.currentTime ?? 0;
    this.eq.forEach((node, i) => {
      const value = gains[i] ?? 0;
      node.gain.setValueAtTime(value, now + 0.1);
    });
  }

  /**
   * 选择段数并重建节点
   * @param bandCount - '5' / '10'
   */
  selectType(bandCount: EQBandCount): void {
    if (this.bandCount === bandCount) return;
    this.resetEQ(bandCount);
    this.applyPreset(this.presetName);
  }

  /**
   * 选择预设
   * @param presetName - 预设名
   */
  selectPreset(presetName: EQPresetName): void {
    this.presetName = presetName;
    this.applyPreset(presetName);
  }

  /**
   * 直接设置增益数组（custom 预设）
   * @param gains - 增益数组（长度需匹配当前段数）
   */
  setData(gains: readonly number[]): void {
    const now = this.audioCtx?.currentTime ?? 0;
    this.eq.forEach((node, i) => {
      const value = gains[i] ?? 0;
      node.gain.setValueAtTime(value, now + 0.1);
    });
    this.presetName = 'custom';
  }

  /**
   * 获取当前段数下可用的预设名列表
   * @returns 预设名数组
   */
  getPresetsList(): string[] {
    return Object.keys(EQ_PRESETS[this.bandCount]);
  }

  /** 接入上游 source */
  connect(): void {
    if (!this.audioSource || !this.inputNode) return;
    this.audioSource.connect(this.inputNode);
  }

  /** 从上游 source 断开 */
  disconnect(): void {
    if (!this.audioSource || !this.inputNode) return;
    this.audioSource.disconnect(this.inputNode);
  }

  /** 返回输出节点 */
  source(): AudioNode {
    return this.outputNode ?? this.inputNode ?? this.audioSource!;
  }

  /** 销毁释放 */
  destroy(): void {
    this.eq.forEach((node) => node.disconnect());
    this.eq = [];
    this.inputNode?.disconnect();
    this.outputNode?.disconnect();
    this.inputNode = null;
    this.outputNode = null;
    super.destroy();
  }
}
