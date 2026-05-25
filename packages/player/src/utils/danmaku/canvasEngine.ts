/**
 * 高性能弹幕系统 - Canvas渲染引擎
 * 使用Canvas 2D API渲染大量弹幕，支持离屏渲染和批量绘制
 */

import {
  DanmakuType,
  DanmakuSpeed,
  DanmakuArea,
  ScreenMode,
  type DanmakuItem,
  type DanmakuRenderItem,
  type DanmakuFilter,
  type DanmakuMaskConfig,
} from './types';
import { DanmakuItemPool } from './objectPool';
import { TrackManager } from './trackManager';
import { rafTimeout, cancelRaf, createLogger } from '@/utils';
import { calculateFontSize } from './scaleHelper';
const logger = createLogger('CanvasEngine');

/** Canvas引擎配置 */
interface CanvasEngineConfig {
  /** 字体 */
  fontFamily: string;
  /** 基础字体大小 */
  baseFontSize: number;
  /** 字体大小缩放 */
  fontSizeScale: number;
  /** 阴影模糊 */
  shadowBlur: number;
  /** 阴影颜色 */
  shadowColor: string;
  /** 描边宽度 */
  strokeWidth: number;
  /** 描边颜色 */
  strokeColor: string;
  /** 透明度 */
  opacity: number;
  /** 速度档位 */
  speed: DanmakuSpeed;
  /** 区域档位 */
  area: DanmakuArea;
  /** 是否开启抗锯齿 */
  antialias: boolean;
  /** 过滤器 */
  filter: DanmakuFilter;
  /** 是否自动随屏幕大小缩放 */
  autoScale: boolean;
  /** 防挡遮罩配置 */
  maskConfig?: DanmakuMaskConfig;
  /** 视频元素（用于防挡遮罩获取当前时间） */
  video?: HTMLVideoElement;
}

/** 速度档位对应的倍率 */
const SPEED_MULTIPLIERS: Record<DanmakuSpeed, number> = {
  [DanmakuSpeed.VERY_SLOW]: 0.5,
  [DanmakuSpeed.SLOW]: 0.75,
  [DanmakuSpeed.NORMAL]: 1.0,
  [DanmakuSpeed.FAST]: 1.5,
  [DanmakuSpeed.VERY_FAST]: 2.0,
};

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private config: CanvasEngineConfig;
  private itemPool: DanmakuItemPool;
  private trackManager: TrackManager;

  // 渲染状态
  private renderItems: Map<string, DanmakuRenderItem> = new Map();
  private isPlaying = false;
  private isPaused = false;
  private animationId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private lastFpsTime = 0;
  private fps = 60;

  // 性能优化
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private textMeasureCache: Map<string, TextMetrics> = new Map();

  // 尺寸
  private width = 0;
  private height = 0;
  private dpr = window.devicePixelRatio || 1;
  private isResizing = false;

  // 鼠标悬停回调
  private onDanmakuHover:
    | ((danmaku: DanmakuRenderItem | null, position: { x: number; y: number } | null) => void)
    | null = null;

  // 暂停的弹幕
  private pausedItems: Set<string> = new Set();

  // 防挡遮罩
  private maskImage: HTMLImageElement | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  private maskUpdateTimer: { id: number } | null = null;
  // 遮罩原始尺寸（用于比例计算）
  private maskOriginalWidth = 0;
  private maskOriginalHeight = 0;
  // 缓存的临时 canvas 和处理后的遮罩数据
  private maskTempCanvas: HTMLCanvasElement | null = null;
  private maskTempCtx: CanvasRenderingContext2D | null = null;
  // 缓存的计算结果
  private maskDrawParams: { x: number; y: number; width: number; height: number } | null = null;

  constructor(
    container: HTMLElement,
    itemPool: DanmakuItemPool,
    trackManager: TrackManager,
    config: Partial<CanvasEngineConfig> = {}
  ) {
    this.container = container;
    this.itemPool = itemPool;
    this.trackManager = trackManager;
    this.config = {
      fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
      baseFontSize: 18,
      fontSizeScale: 1,
      shadowBlur: 2,
      shadowColor: 'rgba(0, 0, 0, 0.8)',
      strokeWidth: 1,
      strokeColor: '#000000',
      opacity: 1,
      speed: DanmakuSpeed.NORMAL,
      area: DanmakuArea.FULL,
      antialias: true,
      filter: {},
      autoScale: true,
      ...config,
    };

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'danmaku-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: auto;
    `;

    // 启用硬件加速的 Canvas 上下文配置
    const ctx = this.canvas.getContext('2d', {
      alpha: true,
      desynchronized: true, // 启用去同步渲染，减少延迟
    });
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    this.ctx = ctx;

    // 离屏Canvas - 用于双缓冲渲染
    this.offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = this.offscreenCanvas.getContext('2d', {
      alpha: true,
    });
    if (!offscreenCtx) {
      throw new Error('Failed to get offscreen canvas context');
    }
    this.offscreenCtx = offscreenCtx;

    // 启用 CSS 硬件加速
    this.canvas.style.willChange = 'transform';
    this.canvas.style.transform = 'translateZ(0)';

    container.appendChild(this.canvas);

    // 绑定鼠标事件
    this.bindMouseEvents();

    // 初始化防挡遮罩
    if (this.config.maskConfig?.enabled && this.config.maskConfig.maskImage) {
      this.loadMaskImage(this.config.maskConfig.maskImage);
    }

    this.resize();
  }

  /**
   * 加载防挡遮罩图片
   * @param url 图片URL
   * @param originalWidth 遮罩原始宽度（可选）
   * @param originalHeight 遮罩原始高度（可选）
   */
  private loadMaskImage(url: string, originalWidth?: number, originalHeight?: number): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.maskImage = img;
      // 保存原始尺寸，如果没有提供则使用图片实际尺寸
      this.maskOriginalWidth = originalWidth || img.naturalWidth || img.width;
      this.maskOriginalHeight = originalHeight || img.naturalHeight || img.height;
      this.createMaskCanvas();
    };
    img.onerror = () => {
      // 静默处理错误
    };
    img.src = url;
  }

  /**
   * 创建遮罩Canvas
   */
  private createMaskCanvas(): void {
    if (!this.maskImage) return;

    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = this.width;
    this.maskCanvas.height = this.height;

    const ctx = this.maskCanvas.getContext('2d');
    if (!ctx) return;
    this.maskCtx = ctx;

    this.updateMaskCanvas();
  }

  /**
   * 更新遮罩Canvas
   * 使用 contain 模式保持比例自适应居中
   *
   * 蒙层图片格式：透明/镂空区域=不显示弹幕，其他区域(黑色)=显示弹幕
   * 最终 maskCanvas：透明=切除弹幕(不显示)，黑色=保留弹幕(显示)
   */
  private updateMaskCanvas(): void {
    if (!this.maskImage || !this.maskCtx || !this.maskCanvas) return;

    // 使用遮罩原始尺寸或图片实际尺寸计算比例
    const imgWidth = this.maskOriginalWidth || this.maskImage.naturalWidth || this.maskImage.width;
    const imgHeight =
      this.maskOriginalHeight || this.maskImage.naturalHeight || this.maskImage.height;

    if (imgWidth === 0 || imgHeight === 0) return;

    // contain 模式：保持比例，撑满长或宽，另一边居中
    const scaleX = this.width / imgWidth;
    const scaleY = this.height / imgHeight;
    const scale = Math.min(scaleX, scaleY);

    const drawWidth = Math.ceil(imgWidth * scale);
    const drawHeight = Math.ceil(imgHeight * scale);
    const x = Math.floor((this.width - drawWidth) / 2);
    const y = Math.floor((this.height - drawHeight) / 2);

    // 缓存当前绘制参数
    const newParams = { x, y, width: drawWidth, height: drawHeight };
    const paramsChanged =
      !this.maskDrawParams ||
      this.maskDrawParams.x !== x ||
      this.maskDrawParams.y !== y ||
      this.maskDrawParams.width !== drawWidth ||
      this.maskDrawParams.height !== drawHeight;

    // 步骤1：先把整个 maskCanvas 填充为黑色（显示弹幕）
    this.maskCtx.fillStyle = '#000000';
    this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

    // 步骤2：检查是否需要重新处理遮罩数据
    let tempCanvas: HTMLCanvasElement;

    if (!paramsChanged && this.maskTempCanvas && this.maskTempCtx) {
      // 复用缓存的临时 canvas
      tempCanvas = this.maskTempCanvas;
    } else {
      // 需要重新创建或重置临时 canvas
      if (
        !this.maskTempCanvas ||
        this.maskTempCanvas.width !== drawWidth ||
        this.maskTempCanvas.height !== drawHeight
      ) {
        this.maskTempCanvas = document.createElement('canvas');
        this.maskTempCanvas.width = drawWidth;
        this.maskTempCanvas.height = drawHeight;
        this.maskTempCtx = this.maskTempCanvas.getContext('2d');
      }

      tempCanvas = this.maskTempCanvas;

      // 在临时 canvas 上绘制蒙层图片
      if (this.maskTempCtx != null) {
        this.maskTempCtx.drawImage(this.maskImage, 0, 0, drawWidth, drawHeight);
        // 获取像素数据并处理（只处理一次，后续复用）
        const imageData = this.maskTempCtx.getImageData(0, 0, drawWidth, drawHeight);
        const data = imageData.data;
        const len = data.length;

        // 优化：使用局部变量减少属性访问
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // 透明或浅色区域设为白色（用于切除），深色区域设为透明（保留弹幕）
          if (a < 128 || (r > 200 && g > 200 && b > 200)) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
          } else {
            data[i + 3] = 0;
          }
        }

        this.maskTempCtx.putImageData(imageData, 0, 0);

        // 更新缓存参数
        this.maskDrawParams = newParams;
      }
    }

    // 步骤3：使用 destination-out 将镂空区域（白色）从黑色背景中切除
    this.maskCtx.globalCompositeOperation = 'destination-out';
    this.maskCtx.drawImage(tempCanvas, x, y);
    this.maskCtx.globalCompositeOperation = 'source-over';
  }

  /**
   * 调整Canvas尺寸
   */
  resize(): void {
    // 使用getBoundingClientRect获取尺寸，它比clientWidth更实时
    const rect = this.container.getBoundingClientRect();

    // 使用rect的宽度和高度
    const newWidth = rect.width;
    const newHeight = rect.height;

    // 如果尺寸没有变化，跳过
    if (newWidth === this.width && newHeight === this.height) {
      return;
    }

    this.isResizing = true;
    this.width = newWidth;
    this.height = newHeight;

    // 限制DPR最大为2，避免在高DPR屏幕上渲染过大的画布
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 设置Canvas实际尺寸
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    // 设置显示尺寸
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // 缩放上下文
    this.ctx.scale(this.dpr, this.dpr);

    // 离屏Canvas
    this.offscreenCanvas.width = this.width * this.dpr;
    this.offscreenCanvas.height = this.height * this.dpr;
    this.offscreenCtx.scale(this.dpr, this.dpr);

    // 初始化轨道（保持当前区域档位）
    this.trackManager.initTracks(this.width, this.height, this.config.area);

    // 根据autoScale决定是否自动缩放字体
    if (this.config.autoScale) {
      // 使用新的缩放辅助函数，根据播放器大小和系统缩放计算
      const fontSize = calculateFontSize(
        this.config.baseFontSize,
        1, // 基础缩放为1，calculateFontSize内部会计算响应式缩放
        this.width,
        true
      );
      // 计算相对于baseFontSize的缩放比例
      const scale = fontSize / this.config.baseFontSize;
      this.updateConfig({ fontSizeScale: scale });
    }
    // 如果autoScale为false，保持当前的fontSizeScale不变

    // 清空缓存
    this.textMeasureCache.clear();

    // 如果启用了防挡遮罩，重新创建遮罩Canvas
    if (this.maskImage && this.config.maskConfig?.enabled) {
      this.createMaskCanvas();
    }

    // 更新遮罩canvas尺寸
    if (this.maskCanvas && this.maskImage) {
      this.maskCanvas.width = this.width;
      this.maskCanvas.height = this.height;
      // 尺寸变化，清除缓存的绘制参数，强制重新计算
      this.maskDrawParams = null;
      this.updateMaskCanvas();
    }

    // 注意：不处理已存在弹幕的位置，避免全屏切换时性能问题
    // 已存在的弹幕会继续按原来的位置和速度移动，新的弹幕会使用新的尺寸

    this.isResizing = false;
  }

  /**
   * 检查弹幕是否被过滤
   */
  private isFiltered(item: DanmakuItem): boolean {
    const filter = this.config.filter;
    if (!filter) return false;

    // 过滤滚动弹幕
    if (filter.scroll && item.type === DanmakuType.SCROLL) {
      return true;
    }

    // 过滤固定弹幕（顶部+底部）
    if (filter.fixed && (item.type === DanmakuType.TOP || item.type === DanmakuType.BOTTOM)) {
      return true;
    }

    // 过滤彩色弹幕（非白色）
    if (filter.colorful) {
      const color = item.color || '#ffffff';
      const isWhite =
        color.toLowerCase() === '#ffffff' ||
        color.toLowerCase() === 'white' ||
        color.toLowerCase() === '#fff';
      if (!isWhite) {
        return true;
      }
    }

    return false;
  }

  /**
   * 添加弹幕
   * @param item 弹幕数据
   * @param currentTime 当前时间
   * @returns 是否成功添加
   */
  addDanmaku(item: DanmakuItem, currentTime: number, videoTime?: number): boolean {
    // 检查是否被过滤
    if (this.isFiltered(item)) {
      return false;
    }

    // 如果正在resize，延迟添加弹幕
    if (this.isResizing) {
      requestAnimationFrame(() => this.addDanmaku(item, currentTime, videoTime));
      return true;
    }

    // 测量文本尺寸
    const { width, height } = this.measureText(item.text, item.fontSize);

    // 计算动画持续时间
    // 滚动弹幕：根据距离和速度计算，确保完全移出屏幕
    const distance = item.type === DanmakuType.SCROLL ? this.width + width : 0;
    // 根据屏幕宽度调整基础速度，确保全屏时弹幕不会太慢
    // 窗口模式(800px)约150px/s，全屏模式(1920px)约200px/s
    const baseSpeed = Math.min(200, 120 + (this.width / 1920) * 80);
    // 应用速度档位倍率：优先使用弹幕数据中的speed，否则使用当前配置的速度档位
    const speedToUse = item.speed !== undefined ? item.speed : this.config.speed;
    const speedMultiplier = SPEED_MULTIPLIERS[speedToUse];
    const adjustedSpeed = baseSpeed * speedMultiplier;
    const scrollDuration = item.type === DanmakuType.SCROLL ? (distance / adjustedSpeed) * 1000 : 0;
    // 固定弹幕显示4秒
    const fixedDuration = 4000;
    const duration = item.type === DanmakuType.SCROLL ? scrollDuration : fixedDuration;

    // 计算弹幕已经经过的时间（用于快进后恢复显示）
    let elapsedTime = 0;
    if (videoTime !== undefined && item.type === DanmakuType.SCROLL) {
      elapsedTime = Math.max(0, (videoTime - item.time) * 1000); // 转换为毫秒
    }

    // 创建渲染项
    const renderItem = this.itemPool.acquire({
      ...item,
      x: this.width,
      y: 0,
      width,
      height,
      speed: item.type === DanmakuType.SCROLL ? distance / (duration / 1000) : 0,
      duration,
      isRendering: true,
      scrollDistance: item.type === DanmakuType.SCROLL ? distance : undefined,
    });

    if (!renderItem) {
      return false;
    }

    // 获取可用轨道
    const trackIndex = this.trackManager.getAvailableTrack(renderItem, currentTime);
    if (trackIndex === -1) {
      this.itemPool.release(renderItem.renderId);
      return false;
    }

    // 添加到轨道
    this.trackManager.addToTrack(trackIndex, renderItem);

    // 设置初始位置
    if (item.type === DanmakuType.SCROLL) {
      // 如果有经过时间，计算当前位置；否则从右侧进入
      if (elapsedTime > 0 && elapsedTime < duration) {
        const progress = elapsedTime / duration;
        renderItem.x = this.width - distance * progress;
        renderItem.createTime = currentTime - elapsedTime;
      } else {
        renderItem.x = this.width;
      }
    } else if (item.type === DanmakuType.TOP) {
      // 顶部固定弹幕居中
      renderItem.x = (this.width - width) / 2;
    } else if (item.type === DanmakuType.BOTTOM) {
      // 底部固定弹幕居中
      renderItem.x = (this.width - width) / 2;
    }

    // 保存渲染项
    this.renderItems.set(renderItem.renderId, renderItem);

    return true;
  }

  /**
   * 批量添加弹幕
   * @param items 弹幕列表
   * @param currentTime 当前时间
   */
  addDanmakuBatch(items: DanmakuItem[], currentTime: number, videoTime?: number): void {
    // 按时间排序
    const sortedItems = items.sort((a, b) => a.time - b.time);

    // 批量添加
    for (const item of sortedItems) {
      this.addDanmaku(item, currentTime, videoTime);
    }
  }

  /**
   * 测量文本尺寸
   * @param text 文本
   * @param fontSize 字体大小
   * @returns 尺寸
   */
  private measureText(text: string, fontSize?: number): { width: number; height: number } {
    const size = (fontSize || this.config.baseFontSize) * this.config.fontSizeScale;
    const cacheKey = `${text}_${size}`;

    let metrics = this.textMeasureCache.get(cacheKey);
    if (!metrics) {
      // 使用离屏Canvas进行文本测量，避免影响主Canvas
      this.offscreenCtx.font = `bold ${size}px ${this.config.fontFamily}`;
      metrics = this.offscreenCtx.measureText(text);
      this.textMeasureCache.set(cacheKey, metrics);
    }

    return {
      width: metrics.width,
      height: size * 1.2,
    };
  }

  /**
   * 开始渲染
   */
  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.renderLoop();
  }

  /**
   * 停止渲染
   */
  stop(): void {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 暂停渲染（视频暂停时调用）
   */
  pauseAnimations(): void {
    this.isPaused = true;
    // 添加暂停类名到容器（用于样式标记）
    this.canvas.classList.add('is-paused');
  }

  /**
   * 恢复渲染（视频播放时调用）
   */
  resumeAnimations(): void {
    this.isPaused = false;
    // 移除暂停类名
    this.canvas.classList.remove('is-paused');
    this.lastFrameTime = performance.now();
  }

  /**
   * 调整弹幕时间（用于补偿暂停时间）
   * @param deltaTime 需要补偿的时间（毫秒）
   */
  adjustDanmakuTime(deltaTime: number): void {
    for (const item of this.renderItems.values()) {
      if (item.isRendering && !this.pausedItems.has(item.renderId)) {
        item.createTime += deltaTime;
      }
    }
  }

  /**
   * 清空弹幕
   */
  clear(): void {
    this.renderItems.forEach((item) => {
      this.itemPool.release(item.renderId);
    });
    this.renderItems.clear();
    this.trackManager.reset();
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * 移除单条弹幕
   * @param renderId 渲染ID
   */
  removeDanmaku(renderId: string): void {
    const item = this.renderItems.get(renderId);
    if (item) {
      // 从轨道移除
      this.trackManager.removeFromTrack(item);
      // 回收对象
      this.itemPool.release(renderId);
      this.renderItems.delete(renderId);
    }
  }

  /**
   * 更新弹幕位置（用于小幅度seek）- B站风格：保留屏幕弹幕，调整动画进度
   * @param timeDiff 时间差（秒），正数表示快进，负数表示后退
   */
  updateDanmakuPositionsForSeek(timeDiff: number): void {
    const timeDiffMs = timeDiff * 1000; // 转换为毫秒
    const itemsToRemove: string[] = [];

    for (const [id, item] of this.renderItems) {
      if (!item.isRendering) continue;

      if (item.type === DanmakuType.SCROLL) {
        // 滚动弹幕：根据时间差调整位置
        // 使用保存的scrollDistance，避免屏幕尺寸变化影响
        const distance = item.scrollDistance || this.width + item.width;

        // 快进：弹幕应该向前移动；后退：弹幕应该向后移动
        // 调整 createTime 来影响动画进度
        item.createTime -= timeDiffMs;

        // 重新计算当前位置
        const elapsed = performance.now() - item.createTime;
        const progress = elapsed / item.duration;
        item.x = this.width - distance * progress;

        // 如果弹幕已经移出屏幕，标记为移除
        if (item.x < -item.width || progress >= 1) {
          item.isRendering = false;
          itemsToRemove.push(id);
          this.trackManager.removeFromTrack(item);
        }
      }
      // 固定弹幕不需要调整位置
    }

    // 释放已结束的弹幕
    for (const id of itemsToRemove) {
      const item = this.renderItems.get(id);
      if (item) {
        this.itemPool.release(id);
        this.renderItems.delete(id);
      }
    }
  }

  /**
   * 更新弹幕位置（用于大幅度seek）- B站风格
   * 与小幅度seek相同处理：保留弹幕，调整动画进度
   * @param timeDiff 时间差（秒），正数表示快进，负数表示后退
   */
  updateDanmakuPositionsForLargeSeek(timeDiff: number): void {
    // 大幅度seek也使用相同的处理方式
    this.updateDanmakuPositionsForSeek(timeDiff);
  }

  /**
   * 渲染循环
   */
  private renderLoop = (): void => {
    if (!this.isPlaying) return;

    const currentTime = performance.now();

    // 如果视频暂停，不更新lastFrameTime，避免deltaTime累积
    if (this.isPaused) {
      this.draw();
      this.animationId = requestAnimationFrame(this.renderLoop);
      return;
    }

    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // 计算FPS（每秒一次）
    this.frameCount++;
    if (currentTime - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = currentTime;
    }

    this.update(deltaTime, currentTime);
    this.draw();

    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * 更新弹幕位置
   * @param deltaTime 时间差
   * @param currentTime 当前时间
   */
  private update(deltaTime: number, currentTime: number): void {
    // 清理已结束的弹幕
    const itemsToRemove: string[] = [];
    const width = this.width; // 缓存宽度避免重复访问
    const pausedItems = this.pausedItems; // 缓存引用
    const renderItems = this.renderItems; // 缓存引用
    const itemPool = this.itemPool; // 缓存引用
    const trackManager = this.trackManager; // 缓存引用

    for (const [id, item] of renderItems) {
      if (!item.isRendering) {
        itemsToRemove.push(id);
        continue;
      }

      // 跳过鼠标悬停暂停的弹幕
      if (pausedItems.has(id)) {
        item.createTime += deltaTime;
        continue;
      }

      // 计算经过时间
      const elapsedTime = currentTime - item.createTime;

      // 检查是否结束
      if (elapsedTime >= item.duration) {
        item.isRendering = false;
        itemsToRemove.push(id);
        trackManager.removeFromTrack(item);
        continue;
      }

      // 更新位置 (滚动弹幕) - 内联计算减少函数调用
      if (item.type === DanmakuType.SCROLL) {
        const progress = elapsedTime / item.duration;
        item.x = width - (item.scrollDistance || width + item.width) * progress;
      }
    }

    // 批量释放已结束的弹幕
    const removeCount = itemsToRemove.length;
    if (removeCount > 0) {
      for (let i = 0; i < removeCount; i++) {
        const id = itemsToRemove[i];
        renderItems.delete(id);
        itemPool.release(id);
      }
    }

    // 清理轨道
    trackManager.cleanupFinishedItems(currentTime);
  }

  /**
   * 绘制弹幕
   */
  private draw(): void {
    // 优化：使用透明填充代替clearRect，在某些浏览器上更快
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 收集可见弹幕
    const visibleItems: DanmakuRenderItem[] = [];
    for (const item of this.renderItems.values()) {
      if (!item.isRendering) continue;
      // 优化：只绘制在屏幕内的弹幕
      if (item.x + item.width < 0 || item.x > this.width) continue;
      visibleItems.push(item);
    }

    // 如果没有可见弹幕，直接返回
    if (visibleItems.length === 0) return;

    // 按字体大小排序，减少font设置次数
    visibleItems.sort(
      (a, b) => (a.fontSize || this.config.baseFontSize) - (b.fontSize || this.config.baseFontSize)
    );

    // 批量绘制 - 使用局部变量缓存配置
    const fontFamily = this.config.fontFamily;
    const fontSizeScale = this.config.fontSizeScale;
    const baseFontSize = this.config.baseFontSize;
    let currentFontSize = 0;

    for (const item of visibleItems) {
      const size = (item.fontSize || baseFontSize) * fontSizeScale;

      // 只在字体大小变化时设置font
      if (size !== currentFontSize) {
        this.ctx.font = `bold ${size}px ${fontFamily}`;
        currentFontSize = size;
      }

      this.drawItem(item);
    }

    // 应用防挡遮罩
    this.applyMask();
  }

  /**
   * 应用防挡遮罩
   */
  private applyMask(): void {
    if (!this.maskImage || !this.maskCanvas || !this.config.maskConfig?.enabled) {
      return;
    }

    // 使用 destination-in 模式：只保留 maskCanvas 中不透明（黑色）区域的弹幕
    // maskCanvas: 黑色=显示弹幕, 透明=不显示弹幕
    // destination-in: 保留源（已绘制弹幕）和目标（maskCanvas）都重叠的不透明区域
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.drawImage(this.maskCanvas, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * 绘制单个弹幕
   * @param item 弹幕项
   */
  private drawItem(item: DanmakuRenderItem): void {
    const { text, x, y, height, color, width, uid } = item;

    this.ctx.textBaseline = 'middle';
    const drawY = y + height / 2;

    // 判断是否为自己发布的弹幕（uid为1表示本人），添加白色边框
    const isSelf = uid === 1 || uid === '1';

    if (isSelf) {
      // 绘制白色边框背景
      this.ctx.save();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      const padding = 4;
      this.ctx.fillRect(x - padding, y - padding / 2, width + padding * 2, height + padding);
      this.ctx.strokeRect(x - padding, y - padding / 2, width + padding * 2, height + padding);
      this.ctx.restore();
    }

    // 简化渲染：关闭阴影和描边以提高性能
    // 填充文字
    this.ctx.fillStyle = color || '#ffffff';
    this.ctx.fillText(text, x, drawY);
  }

  /**
   * 切换屏幕模式
   * @param _mode 屏幕模式（已废弃，保留参数用于兼容性）
   */
  switchScreenMode(_mode: ScreenMode): void {
    // 只调整Canvas尺寸，不再切换轨道模式（现在只有一个统一的状态）
    this.resize();
  }

  /**
   * 更新配置
   * @param config 配置
   */
  updateConfig(config: Partial<CanvasEngineConfig>): void {
    const oldArea = this.config.area;

    Object.assign(this.config, config);
    this.textMeasureCache.clear();

    // 如果区域档位变化，重新初始化轨道
    if (config.area !== undefined && config.area !== oldArea) {
      this.trackManager.initTracks(this.width, this.height, config.area);
    }

    // 如果防挡配置变化，更新遮罩
    if (config.maskConfig !== undefined) {
      if (config.maskConfig.enabled && config.maskConfig.maskImage) {
        if (config.maskConfig.maskImageElement) {
          this.maskImage = config.maskConfig.maskImageElement;
          this.createMaskCanvas();
        } else if (config.maskConfig.maskImage !== this.maskImage?.src) {
          this.loadMaskImage(config.maskConfig.maskImage);
        } else {
          this.updateMaskCanvas();
        }
      } else {
        this.maskImage = null;
        this.maskCanvas = null;
        this.maskCtx = null;
      }
    }
  }

  /**
   * 设置防挡遮罩
   * @param config 防挡遮罩配置
   */
  setMaskConfig(config: DanmakuMaskConfig): void {
    // 清理旧的定时器
    if (this.maskUpdateTimer) {
      cancelRaf(this.maskUpdateTimer);
      this.maskUpdateTimer = null;
    }

    this.config.maskConfig = config;

    if (config.enabled) {
      // 如果提供了遮罩获取函数，启动定时更新
      if (config.maskLoader) {
        this.startMaskAutoUpdate(config);
      } else if (config.maskImage) {
        // 使用静态遮罩图片
        if (config.maskImageElement) {
          this.maskImage = config.maskImageElement;
          this.createMaskCanvas();
        } else {
          this.loadMaskImage(config.maskImage);
        }
      }
    } else {
      this.maskImage = null;
      this.maskCanvas = null;
      this.maskCtx = null;
    }
  }

  /**
   * 启动遮罩自动更新
   */
  private startMaskAutoUpdate(config: DanmakuMaskConfig): void {
    const updateInterval = config.updateInterval || 1000;
    let lastTimeKey = -1;

    const updateMask = async () => {
      if (!config.maskLoader) {
        return;
      }

      // 通过回调获取当前视频时间
      const currentTime = config.getCurrentTime ? config.getCurrentTime() : 0;
      const timeKey = Math.floor(currentTime);

      // 如果视频暂停且时间没有变化，跳过请求，但继续定时检查
      if (timeKey === lastTimeKey) {
        // 继续下一次更新
        if (config.enabled) {
          this.maskUpdateTimer = rafTimeout(updateMask, updateInterval);
        }
        return;
      }

      lastTimeKey = timeKey;

      try {
        const result = await config.maskLoader(currentTime);

        // 返回 null 表示该时间没有遮罩，不设置
        if (result === null) {
          return;
        }

        if (result.maskImageElement) {
          this.maskImage = result.maskImageElement;
          // 保存原始尺寸
          this.maskOriginalWidth =
            result.originalWidth ||
            result.maskImageElement.naturalWidth ||
            result.maskImageElement.width;
          this.maskOriginalHeight =
            result.originalHeight ||
            result.maskImageElement.naturalHeight ||
            result.maskImageElement.height;
          this.createMaskCanvas();
        } else if (result.maskImage) {
          this.loadMaskImage(result.maskImage, result.originalWidth, result.originalHeight);
        }
      } catch (error) {
        logger.error('Mask request failed:', error);
      }

      // 继续下一次更新
      if (config.enabled) {
        this.maskUpdateTimer = rafTimeout(updateMask, updateInterval);
      }
    };

    // 立即执行一次
    updateMask().catch(error => {
      logger.error('updateMask 执行失败:', error);
    });
  }

  /**
   * 获取FPS
   */
  getFps(): number {
    return this.fps;
  }

  /**
   * 获取渲染统计
   */
  getStats(): { renderCount: number; fps: number } {
    return {
      renderCount: this.renderItems.size,
      fps: this.fps,
    };
  }

  /**
   * 设置鼠标悬停回调
   * @param callback 回调函数，参数为弹幕项和位置（悬停时为数据，离开时为空）
   */
  setOnDanmakuHover(
    callback: (danmaku: DanmakuRenderItem | null, position: { x: number; y: number } | null) => void
  ): void {
    this.onDanmakuHover = callback;
  }

  /**
   * 绑定鼠标事件
   */
  private bindMouseEvents(): void {
    // 当前悬停的弹幕
    let hoveredItem: DanmakuRenderItem | null = null;
    // 自动恢复定时器
    let autoResumeTimer: { id: number } | null = null;

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 查找鼠标下的弹幕
      let foundItem: DanmakuRenderItem | null = null;

      for (const item of this.renderItems.values()) {
        if (!item.isRendering) continue;

        // 计算弹幕当前位置
        const itemLeft = item.x;
        const itemRight = item.x + item.width;
        const itemTop = item.y;
        const itemBottom = item.y + item.height;

        // 检查鼠标是否在弹幕范围内
        if (
          mouseX >= itemLeft &&
          mouseX <= itemRight &&
          mouseY >= itemTop &&
          mouseY <= itemBottom
        ) {
          foundItem = item;
          break;
        }
      }

      if (foundItem !== hoveredItem) {
        // 清除之前的定时器
        if (autoResumeTimer) {
          cancelRaf(autoResumeTimer);
          autoResumeTimer = null;
        }

        // 恢复之前悬停的弹幕
        if (hoveredItem) {
          this.pausedItems.delete(hoveredItem.renderId);
        }

        hoveredItem = foundItem;

        if (hoveredItem) {
          // 暂停当前悬停的弹幕
          this.pausedItems.add(hoveredItem.renderId);

          // 计算底部中间位置
          const position = {
            x: hoveredItem.x + hoveredItem.width / 2,
            y: hoveredItem.y + hoveredItem.height,
          };

          // 触发回调
          this.onDanmakuHover?.(hoveredItem, position);

          // 3秒后自动恢复
          autoResumeTimer = rafTimeout(() => {
            if (hoveredItem) {
              this.pausedItems.delete(hoveredItem.renderId);
            }
            hoveredItem = null;
            this.onDanmakuHover?.(null, null);
          }, 3000);
        } else {
          this.onDanmakuHover?.(null, null);
        }
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      // 清除自动恢复定时器
      if (autoResumeTimer) {
        cancelRaf(autoResumeTimer);
        autoResumeTimer = null;
      }

      if (hoveredItem) {
        this.pausedItems.delete(hoveredItem.renderId);
      }
      hoveredItem = null;
      this.onDanmakuHover?.(null, null);
    });
  }

  /**
   * 销毁引擎
   */
  destroy(): void {
    this.stop();
    this.clear();
    this.canvas.remove();
    this.textMeasureCache.clear();
  }
}
