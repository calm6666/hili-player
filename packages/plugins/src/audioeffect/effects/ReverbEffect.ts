/**
 * ============================================
 * Reverb 混响效果
 * ============================================
 * 节点图：
 *   inputNode → highCut(lowpass) → lowCut(highpass) → convolver → wetGain → outputNode
 *   inputNode → dryGain → outputNode
 * 通过 ConvolverNode 加载生成的脉冲响应（IR）实现混响
 */

import type { ReverbData, ReverbPresetName } from '../types';
import { REVERB_PRESETS } from '../presets';
import { getDryLevel, getWetLevel, isFiniteNumber } from '../utils';
import { EffectBase } from './EffectBase';

/**
 * Reverb 混响效果
 */
export class ReverbEffect extends EffectBase {
  /** 输入节点 */
  private inputNode: GainNode | null = null;
  /** 输出节点 */
  private outputNode: GainNode | null = null;
  /** 湿信号增益（混响信号电平） */
  private wetGainNode: GainNode | null = null;
  /** 干信号增益（原始信号电平） */
  private dryGainNode: GainNode | null = null;
  /** 卷积器（混响核心） */
  private convolverNode: ConvolverNode | null = null;
  /** 高通滤波（切除混响信号中过高频率） */
  private highCutNode: BiquadFilterNode | null = null;
  /** 低通滤波（切除混响信号中过低频率） */
  private lowCutNode: BiquadFilterNode | null = null;
  /** 当前混响参数 */
  private data: ReverbData = REVERB_PRESETS.default;

  /** 初始化节点图 */
  public override init(
    audioCtx: AudioContext,
    source: AudioNode,
    destination: AudioNode,
  ): void {
    super.init(audioCtx, source, destination);
    this.inputNode = audioCtx.createGain();
    this.outputNode = audioCtx.createGain();
    this.wetGainNode = audioCtx.createGain();
    this.dryGainNode = audioCtx.createGain();
    this.convolverNode = audioCtx.createConvolver();
    this.highCutNode = audioCtx.createBiquadFilter();
    this.lowCutNode = audioCtx.createBiquadFilter();

    // 滤波器配置
    this.highCutNode.type = 'lowpass';
    this.highCutNode.frequency.value = this.data.highCut;
    this.lowCutNode.type = 'highpass';
    this.lowCutNode.frequency.value = this.data.lowCut;

    // 干湿信号电平
    this.dryGainNode.gain.value = getDryLevel(this.data.mix);
    this.wetGainNode.gain.value = getWetLevel(this.data.mix) * this.data.gain;

    // 湿信号通路：input → highCut → lowCut → convolver → wetGain → output
    this.inputNode.connect(this.highCutNode);
    this.highCutNode.connect(this.lowCutNode);
    this.lowCutNode.connect(this.convolverNode);
    this.convolverNode.connect(this.wetGainNode);
    this.wetGainNode.connect(this.outputNode);

    // 干信号通路：input → dryGain → output
    this.inputNode.connect(this.dryGainNode);
    this.dryGainNode.connect(this.outputNode);

    // 生成初始脉冲响应
    this.updateImpulse();
  }

  /**
   * 更新脉冲响应（IR）
   * 根据 data.ir 类型选择 simple / moorer 算法生成 IR
   */
  private updateImpulse(): void {
    if (!this.audioCtx || !this.convolverNode) return;
    const { decay, fadeIn, reverse, ir, highCut, lowCut } = this.data;

    /** 采样率 */
    const sampleRate = this.audioCtx.sampleRate;
    /** IR 长度（采样数） */
    const length = Math.max(1, Math.floor(sampleRate * decay));
    /** 离线渲染上下文，用于对 IR 应用渐变低通 */
    const offlineCtx = new OfflineAudioContext(1, length, sampleRate);
    /** IR 源节点 */
    const irSource = offlineCtx.createBufferSource();
    /** IR 缓冲区 */
    const buffer = offlineCtx.createBuffer(1, length, sampleRate);
    /** 通道数据 */
    const channelData = buffer.getChannelData(0);

    if (ir === 'moorer') {
      this.fillMoorerIR(channelData, length, sampleRate, fadeIn, reverse);
    } else {
      this.fillSimpleIR(channelData, length, sampleRate, fadeIn, reverse);
    }

    irSource.buffer = buffer;
    // 应用渐变低通：模拟低频衰减
    const lowpass = offlineCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = 0.0001;
    lowpass.frequency.setValueAtTime(highCut, 0);
    lowpass.frequency.linearRampToValueAtTime(Math.max(1, lowCut), length / sampleRate);
    irSource.connect(lowpass);
    lowpass.connect(offlineCtx.destination);
    irSource.start(0);

    // 渲染并应用到 convolverNode
    offlineCtx.startRendering().then((renderedBuffer: AudioBuffer) => {
      if (this.convolverNode && this.audioCtx) {
        this.convolverNode.buffer = renderedBuffer;
      }
    }).catch(() => {
      // 渲染失败时回退到 simple IR
      if (this.convolverNode && this.audioCtx) {
        const fallback = this.audioCtx.createBuffer(1, length, sampleRate);
        const data = fallback.getChannelData(0);
        this.fillSimpleIR(data, length, sampleRate, fadeIn, reverse);
        this.convolverNode.buffer = fallback;
      }
    });
  }

  /**
   * 简单 IR：衰减白噪声
   * 用于 room / live / hall 等预设
   */
  private fillSimpleIR(
    data: Float32Array,
    length: number,
    sampleRate: number,
    fadeIn: number,
    reverse: boolean,
  ): void {
    /** 淡入采样数 */
    fadeIn = (typeof fadeIn === 'number' && isFiniteNumber(fadeIn)) ? fadeIn : 0;
    const fadeInSamples = Math.floor((fadeIn / 1000) * sampleRate);
    for (let i = 0; i < length; i++) {
      /** 衰减包络（指数衰减） */
      const envelope = Math.pow(1 - i / length, 2);
      /** 淡入处理 */
      const fadeMultiplier = fadeInSamples > 0 && i < fadeInSamples
        ? i / fadeInSamples
        : 1;
      /** 白噪声 */
      const noise = Math.random() * 2 - 1;
      data[i] = noise * envelope * fadeMultiplier;
    }
    if (reverse) {
      data.reverse();
    }
  }

  /**
   * Moorer IR：早期反射 + 衰减尾巴
   * 用于 bathroom 预设
   */
  private fillMoorerIR(
    data: Float32Array,
    length: number,
    sampleRate: number,
    fadeIn: number,
    reverse: boolean,
  ): void {
    // 早期反射时间点（秒）—— Moorer 模型典型值
    const earlyReflections = [0.005, 0.011, 0.019, 0.027, 0.037, 0.049];
    const fadeInSamples = Math.floor((fadeIn / 1000) * sampleRate);
    for (let i = 0; i < length; i++) {
      /** 早期反射强度 */
      let early = 0;
      for (const reflectionTime of earlyReflections) {
        const reflectionSample = Math.floor(reflectionTime * sampleRate);
        if (i === reflectionSample) {
          early += 0.5;
        } else if (i > reflectionSample && i < reflectionSample + 50) {
          early += 0.5 * (1 - (i - reflectionSample) / 50);
        }
      }
      /** 尾巴衰减 */
      const tail = Math.pow(1 - i / length, 3);
      /** 噪声 */
      const noise = Math.random() * 2 - 1;
      const fadeMultiplier = fadeInSamples > 0 && i < fadeInSamples
        ? i / fadeInSamples
        : 1;
      data[i] = (noise * tail + early * 0.3) * fadeMultiplier;
    }
    if (reverse) {
      data.reverse();
    }
  }

  /**
   * 选择预设
   * @param presetName - 预设名
   */
  selectPreset(presetName: ReverbPresetName): void {
    const preset = REVERB_PRESETS[presetName];
    if (!preset) return;
    this.data = preset;
    // 更新干湿信号电平
    if (this.dryGainNode && this.wetGainNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.dryGainNode.gain.setValueAtTime(getDryLevel(preset.mix), now);
      this.wetGainNode.gain.setValueAtTime(
        getWetLevel(preset.mix) * preset.gain,
        now,
      );
    }
    // 更新高 / 低通滤波
    if (this.highCutNode && this.audioCtx) {
      this.highCutNode.frequency.setValueAtTime(preset.highCut, this.audioCtx.currentTime);
    }
    if (this.lowCutNode && this.audioCtx) {
      this.lowCutNode.frequency.setValueAtTime(preset.lowCut, this.audioCtx.currentTime);
    }
    // 重新生成 IR
    this.updateImpulse();
  }

  /**
   * 设置干湿混合比例
   * @param mix - 0~1
   */
  setMix(mix: number): void {
    this.data = { ...this.data, mix };
    if (this.dryGainNode && this.wetGainNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.dryGainNode.gain.setValueAtTime(getDryLevel(mix), now);
      this.wetGainNode.gain.setValueAtTime(getWetLevel(mix) * this.data.gain, now);
    }
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
    this.inputNode?.disconnect();
    this.outputNode?.disconnect();
    this.wetGainNode?.disconnect();
    this.dryGainNode?.disconnect();
    this.convolverNode?.disconnect();
    this.highCutNode?.disconnect();
    this.lowCutNode?.disconnect();
    this.inputNode = null;
    this.outputNode = null;
    this.wetGainNode = null;
    this.dryGainNode = null;
    this.convolverNode = null;
    this.highCutNode = null;
    this.lowCutNode = null;
    super.destroy();
  }
}
