/**
 * 弹幕防遮挡 —— 分割主线程客户端
 * ============================================================
 * 封装能力检测 + 分割 Worker 的生命周期：
 *
 * - `init()`：检测浏览器 GPU 能力；不支持则进入 mock 模式（不创建 Worker），
 *   支持则创建 Worker 并加载 MediaPipe 模型；
 * - `segment(video, timestamp)`：从视频抽一帧（OffscreenCanvas，不占 DOM），
 *   交给 Worker 分割，返回 SVG 轮廓结果；mock 模式下直接返回预置轮廓；
 * - `dispose()`：释放 Worker 与资源。
 *
 * 抽帧节流（sampleInterval）由调用方（如 VideoPlayer）控制，本类只负责单帧处理。
 */

import { CapabilityDetector } from './capabilityDetector';
import {
  DEFAULT_MASK_CONFIG,
  type CapabilityInfo,
  type MaskRegion,
  type SegmentationConfig,
  type SegmentationResult,
  type SegmentationWorkerRequest,
  type SegmentationWorkerResponse,
} from './types';

/** 抽帧画布边长（传给模型前的输入尺寸，保持宽高比、居中 letterbox） */
const EXTRACT_SIZE = 256;

export class DanmakuMaskSegmenter {
  private readonly config: SegmentationConfig;
  private capability: CapabilityInfo | null = null;
  private worker: Worker | null = null;
  private ready = false;
  private mock = false;
  private disposed = false;
  private nextId = 1;
  /** 最新一次分割请求的 id：结果回来时若小于它，说明已被更新的帧取代（stale） */
  private latestId = 0;

  private extractCanvas: OffscreenCanvas | null = null;

  private readonly pending = new Map<
    number,
    { resolve: (r: SegmentationResult) => void; reject: (e: Error) => void }
  >();

  private resolveReady: (() => void) | null = null;
  private rejectReady: ((e: Error) => void) | null = null;

  constructor(config?: Partial<SegmentationConfig>) {
    this.config = { ...DEFAULT_MASK_CONFIG, ...config };
  }

  /** 当前能力检测结果（init 后可用） */
  getCapability(): CapabilityInfo | null {
    return this.capability;
  }

  /** 是否处于 mock 降级模式 */
  isMock(): boolean {
    return this.mock;
  }

  /**
   * 初始化：检测能力并（可选）启动分割 Worker。
   * @returns 能力检测结果
   */
  async init(): Promise<CapabilityInfo> {
    const detector = new CapabilityDetector();
    this.capability = detector.detect(this.config.minFps);

    if (!this.capability.supported) {
      this.mock = true;
      return this.capability;
    }

    // 启动分割 Worker
    this.worker = new Worker(new URL('./segmentationWorker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<SegmentationWorkerResponse>) =>
      this.onMessage(event.data);
    this.worker.onerror = (event: ErrorEvent) => {
      const message = event.message || '分割 Worker 异常';
      if (!this.ready && this.rejectReady) this.rejectReady(new Error(message));
    };

    const readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.worker.postMessage({
      type: 'init',
      config: this.config,
      capability: this.capability,
    } satisfies SegmentationWorkerRequest);

    await readyPromise;
    return this.capability;
  }

  /**
   * 对视频当前帧做分割，返回 SVG 轮廓结果。
   *
   * @param video 视频元素
   * @param timestamp 时间戳（供模型 video 模式使用，用 performance.now() 即可）
   */
  segment(video: HTMLVideoElement, timestamp: number): Promise<SegmentationResult> {
    // 模型还没就绪 / 能力不足时：不再返回 mock 人形剪影（很丑），
    // 而是返回「无人」结果，调用方直接不设置遮罩，等真实模型就绪后自动切换。
    if (this.disposed || this.mock || !this.worker || !this.ready) {
      return Promise.resolve(this.emptyResult());
    }

    const { bitmap, region } = this.extractFrame(video);
    const id = this.nextId++;
    this.latestId = id;
    const worker = this.worker;

    return new Promise<SegmentationResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(
        { type: 'segment', id, bitmap, timestamp, region } satisfies SegmentationWorkerRequest,
        [bitmap]
      );
    });
  }

  /** 生成「无人」结果：不设置遮罩 */
  private emptyResult(): SegmentationResult {
    return {
      image: '',
      timestamp: Date.now(),
      isMock: false,
      width: this.config.maskWidth,
      height: this.config.maskHeight,
      noPerson: true,
    };
  }

  /** 释放资源 */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.worker) {
      this.worker.postMessage({ type: 'dispose' } satisfies SegmentationWorkerRequest);
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
    this.ready = false;
  }

  /** 从视频抽一帧到 OffscreenCanvas（letterbox 居中），返回 bitmap 与视频区域 */
  private extractFrame(video: HTMLVideoElement): { bitmap: ImageBitmap; region: MaskRegion } {
    if (!this.extractCanvas) {
      this.extractCanvas = new OffscreenCanvas(EXTRACT_SIZE, EXTRACT_SIZE);
    }
    const ctx = this.extractCanvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 2D 绘制上下文');

    const vw = video.videoWidth || EXTRACT_SIZE;
    const vh = video.videoHeight || EXTRACT_SIZE;
    const scale = Math.min(EXTRACT_SIZE / vw, EXTRACT_SIZE / vh);
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    const x = (EXTRACT_SIZE - w) / 2;
    const y = (EXTRACT_SIZE - h) / 2;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, EXTRACT_SIZE, EXTRACT_SIZE);
    ctx.drawImage(video, x, y, w, h);

    const bitmap = this.extractCanvas.transferToImageBitmap();
    // 视频内容在 256×256 画布里的相对区域（0~1），Worker 用它把 mask 裁回视频宽高比，
    // 避免「正方形 letterbox → 16:9」造成的横向压扁 / 人物错位。
    const region: MaskRegion = {
      x: x / EXTRACT_SIZE,
      y: y / EXTRACT_SIZE,
      w: w / EXTRACT_SIZE,
      h: h / EXTRACT_SIZE,
    };
    return { bitmap, region };
  }

  private onMessage(msg: SegmentationWorkerResponse): void {
    switch (msg.type) {
      case 'ready': {
        this.ready = true;
        if (msg.actualFps && this.capability) {
          this.capability = { ...this.capability, estimatedFps: msg.actualFps };
        }
        this.resolveReady?.();
        break;
      }
      case 'result': {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.resolve({
            image: msg.image,
            timestamp: msg.timestamp,
            isMock: msg.isMock,
            width: msg.width,
            height: msg.height,
            // 结果回来时若已经有更新的分割请求在跑，这个结果就过期了
            stale: msg.id < this.latestId,
            noPerson: msg.noPerson,
          });
        }
        break;
      }
      case 'error': {
        if (msg.id === undefined) {
          this.rejectReady?.(new Error(msg.message));
        } else {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            p.reject(new Error(msg.message));
          }
        }
        break;
      }
    }
  }
}
