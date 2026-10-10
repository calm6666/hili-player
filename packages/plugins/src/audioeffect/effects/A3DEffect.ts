/**
 * ============================================
 * A3D 3D 环绕效果
 * ============================================
 * 基于 PannerNode 的 HRTF 头相关传递函数，将声源放置在三维空间中绕听者旋转
 * 启动后以 1000ms 为节拍、每拍推进 0.5 弧度，让听者获得"声源绕头部旋转"的环绕感
 */

import { EffectBase } from './EffectBase';

/**
 * A3D 3D 环绕效果
 * 节点图：source → panner(PannerNode, HRTF)
 */
export class A3DEffect extends EffectBase {
  /** Panner 节点 —— 实现空间音频定位的核心 */
  private panner: PannerNode | null = null;
  /** 旋转定时器 ID（setInterval 返回值） */
  private intervalId: ReturnType<typeof setInterval> | null = null;
  /** 当前旋转角度（弧度） */
  private angle = 0;

  /**
   * 初始化：创建 PannerNode 并配置空间模型参数
   * - panningModel='HRTF'：使用 HRTF 函数模拟人耳对方向感的辨别
   * - distanceModel='inverse'：距离衰减采用反比模型
   * - refDistance=1：参考距离 1 米
   * - coneInnerAngle=360：全方向无衰减锥
   * - coneOuterAngle=0 / coneOuterGain=0：无指向锥衰减
   */
  public override init(
    audioCtx: AudioContext,
    source: AudioNode,
    destination: AudioNode,
  ): void {
    super.init(audioCtx, source, destination);
    this.panner = audioCtx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1;
    this.panner.coneInnerAngle = 360;
    this.panner.coneOuterAngle = 0;
    this.panner.coneOuterGain = 0;
  }

  /**
   * 启动旋转：每 1000ms 推进 0.5 弧度，按 (1.5*cos θ, 0, 1.5*sin θ) 更新声源位置
   * 兼容带 positionX 的现代实现与仅 setPosition 的旧实现
   */
  start(): void {
    // 已运行则避免重复启动
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      this.angle += 0.5;
      const x = 1.5 * Math.cos(this.angle);
      const z = 1.5 * Math.sin(this.angle);
      this.applyPosition(x, 0, z);
    }, 1000);
  }

  /**
   * 停止旋转：清除定时器
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 直接设置 3D 位置（不启动自动旋转）
   * @param x - X 轴坐标（左右）
   * @param y - Y 轴坐标（上下，默认 0）
   * @param z - Z 轴坐标（前后，默认 300，约 3 米远）
   */
  set3d(x: number, y: number, z: number = 300): void {
    this.applyPosition(x, y, z);
  }

  /**
   * 内部：应用位置到 PannerNode
   * 用 `in` 操作符运行时探测 positionX/Y/Z 是否存在（现代浏览器均为 AudioParam）
   * 现代浏览器均支持 PannerNode.positionX/Y/Z，旧版 iOS Safari 的 setPosition 回退由 polyfill 处理
   */
  private applyPosition(x: number, y: number, z: number): void {
    if (!this.panner) return;
    const p = this.panner;
    // 运行时探测：避免在不支持 positionX 的环境直接赋值
    if ('positionX' in p && 'positionY' in p && 'positionZ' in p) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    }
    // 不支持 positionX 的旧环境：现代 lib.dom 已无 setPosition 类型定义，跳过回退
  }

  /** 接入上游 source 到 panner */
  connect(): void {
    if (!this.audioSource || !this.panner) return;
    this.audioSource.connect(this.panner);
  }

  /** 从上游 source 断开 panner */
  disconnect(): void {
    if (!this.audioSource || !this.panner) return;
    this.audioSource.disconnect(this.panner);
  }

  /** 返回 panner 作为输出节点 */
  source(): AudioNode {
    return this.panner ?? this.audioSource!;
  }

  /** 销毁：停止旋转 + 断开 panner + 释放引用 */
  destroy(): void {
    this.stop();
    this.panner?.disconnect();
    this.panner = null;
    super.destroy();
  }
}
