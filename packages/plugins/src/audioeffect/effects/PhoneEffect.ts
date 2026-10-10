/**
 * ============================================
 * Phone 电话音效果
 * ============================================
 * 通过两级低通 + 两级高通串联，模拟电话听筒典型的 500Hz ~ 2000Hz 通带
 * 节点图：source → lowPass(2000Hz) → lowPass2(2000Hz) → highPass(500Hz) → highPass2(500Hz)
 */

import { EffectBase } from './EffectBase';

/** 电话音低通截止频率（Hz）—— 限制高频成分，模拟电话带宽上限 */
const PHONE_LOW_FREQ = 2000;
/** 电话音高通截止频率（Hz）—— 阻断低频成分，模拟电话带宽下限 */
const PHONE_HIGH_FREQ = 500;

/**
 * Phone 电话音效果
 * 用 4 个 BiquadFilter（两两相同参数）形成更陡峭的滤波斜率，更接近真实电话音色
 */
export class PhoneEffect extends EffectBase {
  /** 第一级低通滤波器 */
  private lowPass: BiquadFilterNode | null = null;
  /** 第二级低通滤波器（增加斜率） */
  private lowPass2: BiquadFilterNode | null = null;
  /** 第一级高通滤波器 */
  private highPass: BiquadFilterNode | null = null;
  /** 第二级高通滤波器（增加斜率） */
  private highPass2: BiquadFilterNode | null = null;

  /**
   * 初始化：创建 4 个 BiquadFilter，配置低通 / 高通截止频率并串联
   * 串联顺序：lowPass → lowPass2 → highPass → highPass2
   */
  public override init(
    audioCtx: AudioContext,
    source: AudioNode,
    destination: AudioNode,
  ): void {
    super.init(audioCtx, source, destination);
    this.lowPass = audioCtx.createBiquadFilter();
    this.lowPass2 = audioCtx.createBiquadFilter();
    this.highPass = audioCtx.createBiquadFilter();
    this.highPass2 = audioCtx.createBiquadFilter();

    this.lowPass.type = 'lowpass';
    this.lowPass.frequency.value = PHONE_LOW_FREQ;
    this.lowPass2.type = 'lowpass';
    this.lowPass2.frequency.value = PHONE_LOW_FREQ;
    this.highPass.type = 'highpass';
    this.highPass.frequency.value = PHONE_HIGH_FREQ;
    this.highPass2.type = 'highpass';
    this.highPass2.frequency.value = PHONE_HIGH_FREQ;

    // 串联：lowPass → lowPass2 → highPass → highPass2
    this.lowPass.connect(this.lowPass2);
    this.lowPass2.connect(this.highPass);
    this.highPass.connect(this.highPass2);
  }

  /** 接入上游 source 到 lowPass 输入 */
  connect(): void {
    if (!this.audioSource || !this.lowPass) return;
    this.audioSource.connect(this.lowPass);
  }

  /** 从上游 source 断开 lowPass 输入 */
  disconnect(): void {
    if (!this.audioSource || !this.lowPass) return;
    this.audioSource.disconnect(this.lowPass);
  }

  /** 返回链路末端 highPass2 作为输出节点 */
  source(): AudioNode {
    return this.highPass2 ?? this.audioSource!;
  }

  /** 销毁：断开 4 个节点 + 释放引用 + 调用基类销毁 */
  destroy(): void {
    this.lowPass?.disconnect();
    this.lowPass2?.disconnect();
    this.highPass?.disconnect();
    this.highPass2?.disconnect();
    this.lowPass = null;
    this.lowPass2 = null;
    this.highPass = null;
    this.highPass2 = null;
    super.destroy();
  }
}
