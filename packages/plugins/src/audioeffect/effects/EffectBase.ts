/**
 * ============================================
 * 音效基类
 * ============================================
 * 所有具体音效（EQ/Reverb/A3D/Phone/Compressor）的抽象基类
 * 提供 audioCtx / audioSource 公共字段，及 connect/disconnect/source 抽象接口
 */

/**
 * 音效基类
 * 子类需实现：
 * - init：在 audioCtx / source / destination 就绪后构建内部节点图
 * - connect：将 source 接入本效果的输入节点
 * - disconnect：从 source 断开本效果的连接
 * - source：返回本效果的输出节点（供链式串联）
 * - destroy：释放内部节点引用
 */
export abstract class EffectBase {
  /** AudioContext，由 EffectChain 在 init 时注入 */
  protected audioCtx: AudioContext | null = null;
  /** 上游音频源节点（MediaElementAudioSourceNode 或前一级效果的输出） */
  protected audioSource: AudioNode | null = null;
  /** 目标节点（EffectChain 的 gain 节点，最终输出） */
  protected destination: AudioNode | null = null;

  /**
   * 初始化效果 —— 构建 BiquadFilter / Convolver 等内部节点
   * 在 audioCtx / audioSource / destination 三者就绪后由 EffectChain 调用
   *
   * @param audioCtx - AudioContext 实例
   * @param source - 上游音频节点
   * @param destination - 下游目标节点
   */
  init(audioCtx: AudioContext, source: AudioNode, destination: AudioNode): void {
    this.audioCtx = audioCtx;
    this.audioSource = source;
    this.destination = destination;
  }

  /** 将上游 source 接入本效果的输入节点 */
  abstract connect(): void;

  /** 从上游 source 断开本效果的连接 */
  abstract disconnect(): void;

  /** 获取本效果的输出节点（供链式串联） */
  abstract source(): AudioNode;

  /** 销毁效果，释放内部节点引用 */
  destroy(): void {
    this.audioCtx = null;
    this.audioSource = null;
    this.destination = null;
  }
}
