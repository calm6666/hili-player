/**
 * ============================================
 * Compressor 压缩器效果
 * ============================================
 * 基于 DynamicsCompressorNode，对响度过大的输入信号进行动态压缩
 * 用于平衡音量、避免削波；通过 threshold / knee / ratio / attack / release 五参数刻画压缩曲线
 */

import type { CompressorData } from '../types';
import { COMPRESSOR_PRESETS } from '../presets';
import { EffectBase } from './EffectBase';

/**
 * Compressor 压缩器效果
 * 节点图：source → comp(DynamicsCompressorNode)
 */
export class CompressorEffect extends EffectBase {
  /** DynamicsCompressorNode 实例 */
  private comp: DynamicsCompressorNode | null = null;

  /**
   * 初始化：创建 DynamicsCompressorNode，并应用 default 预设参数
   */
  public override init(
    audioCtx: AudioContext,
    source: AudioNode,
    destination: AudioNode,
  ): void {
    super.init(audioCtx, source, destination);
    this.comp = audioCtx.createDynamicsCompressor();
    // 应用默认预设参数，使初始压缩曲线有意义
    this.applyPreset(COMPRESSOR_PRESETS.default);
  }

  /**
   * 应用压缩参数到 DynamicsCompressorNode
   * 使用 setValueAtTime(currentTime + 0.1) 进行短延迟过渡，避免参数突变引发爆音
   * @param data - 压缩参数
   */
  private applyPreset(data: CompressorData): void {
    if (!this.comp || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.comp.threshold.setValueAtTime(data.threshold, now + 0.1);
    this.comp.knee.setValueAtTime(data.knee, now + 0.1);
    this.comp.ratio.setValueAtTime(data.ratio, now + 0.1);
    this.comp.attack.setValueAtTime(data.attack, now + 0.1);
    this.comp.release.setValueAtTime(data.release, now + 0.1);
  }

  /**
   * 设置压缩参数
   * @param data - 压缩参数
   */
  setData(data: CompressorData): void {
    this.applyPreset(data);
  }

  /** 接入上游 source 到 comp */
  connect(): void {
    if (!this.audioSource || !this.comp) return;
    this.audioSource.connect(this.comp);
  }

  /** 从上游 source 断开 comp */
  disconnect(): void {
    if (!this.audioSource || !this.comp) return;
    this.audioSource.disconnect(this.comp);
  }

  /** 返回 comp 作为输出节点 */
  source(): AudioNode {
    return this.comp ?? this.audioSource!;
  }

  /** 销毁：断开 comp + 释放引用 + 调用基类销毁 */
  destroy(): void {
    this.comp?.disconnect();
    this.comp = null;
    super.destroy();
  }
}
