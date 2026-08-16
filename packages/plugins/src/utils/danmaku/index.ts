/**
 * 高性能弹幕系统 - 主入口
 * High Performance Danmaku System
 *
 * 特性：
 * 1. 分段渲染 - 后端按时间分段返回，每次只渲染当前时间段弹幕
 * 2. 双引擎 - DOM引擎(少量) + Canvas引擎(大量)
 * 3. 轨道管理 - 全屏/非全屏统一轨道系统，自动适配尺寸
 * 4. 性能优化 - RAF动画、对象池、离屏Canvas、CSS3硬件加速
 */

import {
  DanmakuType,
  DanmakuSpeed,
  DanmakuArea,
  RenderMode,
  ScreenMode,
} from '@/types/danmaku';
import type {
  DanmakuItem,
  DanmakuFilter,
} from '@/types/danmaku';
import type {
  DanmakuOptions,
  DanmakuEvents,
  PerformanceStats,
  DanmakuMaskConfig,
  DanmakuRenderItem as DanmakuRenderItemType,
} from './types';
import { DOMElementPool, DanmakuItemPool } from './objectPool';
import { TrackManager } from './trackManager';
import { DOMEngine } from './domEngine';
import { CanvasEngine } from './canvasEngine';
import { DanmakuScheduler } from './scheduler';
import { rafTimeout, cancelRaf, createLogger, isBrowser } from '@/utils';
const logger = createLogger('Danmaku');

/** 带有 memory 信息的 Performance 接口（Chrome 扩展） */
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

function hasMemoryInfo(perf: Performance): perf is PerformanceWithMemory {
  return 'memory' in perf;
}

// 重新导出类型 — 通用类型从 @/types/danmaku，扩展类型从 ./types
export {
  DanmakuType,
  DanmakuSpeed,
  DanmakuFontSize,
  DanmakuArea,
  RenderMode,
  ScreenMode,
} from '@/types/danmaku';

export type {
  DanmakuItem,
  DanmakuFilter,
  DanmakuSegment,
} from '@/types/danmaku';

export type {
  DanmakuOptions,
  DanmakuEvents,
  PerformanceStats,
  DanmakuMaskConfig,
  MaskLoader,
  DanmakuTrack,
  DanmakuRenderItem,
} from './types';

// 导出子模块
export { DOMElementPool, DanmakuItemPool } from './objectPool';
export { TrackManager } from './trackManager';
export { DOMEngine } from './domEngine';
export { CanvasEngine } from './canvasEngine';
export { DanmakuScheduler } from './scheduler';

/** 弹幕管理器配置 */
interface DanmakuManagerConfig {
  /** 自动切换阈值 (弹幕数量超过此值切换到Canvas) */
  autoSwitchThreshold: number;
  /** 性能监控间隔 (毫秒) */
  performanceMonitorInterval: number;
  /** 最小FPS */
  minFps: number;
}

/** 弹幕管理器 */
export class DanmakuManager {
  private container: HTMLElement;
  private video: HTMLVideoElement;
  private options: DanmakuOptions & { renderMode: RenderMode; opacity: number; speed: DanmakuSpeed; area: DanmakuArea; fontSize: number; autoScale: boolean; visible: boolean; density: number; preventOverlap: boolean; trackHeight: number; segmentDuration: number; preloadSegments: number; maxRenderCount: number; hardwareAcceleration: boolean; showAdvanced: boolean; mergeSame: boolean; filter: DanmakuFilter };
  private events: DanmakuEvents;

  // 核心组件
  private elementPool!: DOMElementPool;
  private itemPool!: DanmakuItemPool;
  private trackManager!: TrackManager;
  private domEngine: DOMEngine | null = null;
  private canvasEngine: CanvasEngine | null = null;
  private scheduler!: DanmakuScheduler;

  // 状态
  private isPlaying = false;
  private currentMode: RenderMode;
  private currentScreenMode: ScreenMode = ScreenMode.NORMAL;
  private lastVideoTime = 0;
  private animationId: number | null = null;
  private resizeTimeout: { id: number } | null = null;
  private pauseStartTime = 0; // 暂停开始时间

  // 配置
  private config: DanmakuManagerConfig;

  // 性能监控
  private performanceStats: PerformanceStats = {
    fps: 60,
    renderCount: 0,
    poolUsage: 0,
    memoryUsage: 0,
    avgRenderTime: 0,
  };
  private performanceMonitorTimer: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastContainerWidth = 0;
  private lastContainerHeight = 0;

  constructor(options: DanmakuOptions, events: DanmakuEvents = {}) {
    this.container = options.container;
    this.video = options.video;
    this.options = {
      renderMode: RenderMode.AUTO,
      opacity: 1,
      speed: DanmakuSpeed.NORMAL,
      area: DanmakuArea.FULL,
      fontSize: 18,
      autoScale: true, // 默认开启自动缩放
      visible: true,
      density: 1,
      preventOverlap: true,
      trackHeight: 24,
      segmentDuration: 30,
      preloadSegments: 2,
      maxRenderCount: 2000, // 增加最大渲染数量，Canvas模式可以处理更多
      hardwareAcceleration: true,
      showAdvanced: true,
      mergeSame: false,
      filter: {},
      ...options,
    };
    this.events = events;
    this.currentMode = this.options.renderMode;

    this.config = {
      autoSwitchThreshold: 200,
      performanceMonitorInterval: 5000,
      minFps: 30,
    };

    this.init();
  }

  /** 初始化 */
  private init(): void {
    if (!isBrowser()) {
      return;
    }

    // 初始化对象池
    this.elementPool = new DOMElementPool({
      initialCapacity: 100,
      maxCapacity: this.options.maxRenderCount,
    });

    this.itemPool = new DanmakuItemPool({
      initialCapacity: 200,
      maxCapacity: this.options.maxRenderCount * 2,
    });

    // 初始化轨道管理器
    this.trackManager = new TrackManager({
      trackHeight: this.options.trackHeight,
      trackGap: 4,
      topMargin: 10,
      bottomMargin: 10,
      bottomSafeArea: 80, // 底部安全区域80px（字幕区域）
      safeDistance: 20,
    });

    // 初始化调度器
    this.scheduler = new DanmakuScheduler({
      segmentDuration: this.options.segmentDuration,
      preloadSegments: this.options.preloadSegments,
      maxCachedSegments: 10,
      densityLimit: this.options.density,
    });

    // 初始化渲染引擎
    this.initEngines();

    // 初始化容器尺寸记录
    this.lastContainerWidth = this.container.clientWidth;
    this.lastContainerHeight = this.container.clientHeight;

    // 绑定视频事件
    this.bindVideoEvents();

    // 启动性能监控
    this.startPerformanceMonitor();
  }

  /** 初始化渲染引擎 */
  private initEngines(): void {
    // DOM引擎
    this.domEngine = new DOMEngine(
      this.container,
      this.elementPool,
      this.itemPool,
      this.trackManager,
      {
        opacity: this.options.opacity,
        fontSizeScale: this.options.fontSize / 18,
        speed: this.options.speed,
        area: this.options.area,
        hardwareAcceleration: this.options.hardwareAcceleration,
        filter: this.options.filter,
        autoScale: this.options.autoScale,
      }
    );

    // Canvas引擎
    this.canvasEngine = new CanvasEngine(this.container, this.itemPool, this.trackManager, {
      opacity: this.options.opacity,
      fontSizeScale: this.options.fontSize / 18,
      speed: this.options.speed,
      area: this.options.area,
      filter: this.options.filter,
      autoScale: this.options.autoScale,
    });
  }

  /** 绑定视频事件 */
  private bindVideoEvents(): void {
    this.video.addEventListener('play', () => this.play());
    this.video.addEventListener('pause', () => this.pause());
    this.video.addEventListener('seeking', () => this.onSeeking());
    this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.video.addEventListener('ended', () => this.stop());

    // 使用ResizeObserver监听容器大小变化（更精确）
    this.initResizeObserver();
  }

  /** 初始化ResizeObserver */
  private initResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // 检查尺寸是否真的变化了
        if (width !== this.lastContainerWidth || height !== this.lastContainerHeight) {
          this.lastContainerWidth = width;
          this.lastContainerHeight = height;

          // 防抖：延迟执行resize，避免频繁调用
          if (this.resizeTimeout) {
            cancelRaf(this.resizeTimeout);
          }
          this.resizeTimeout = rafTimeout(() => {
            // 更新引擎尺寸（不处理已存在的弹幕位置，避免性能问题）
            this.domEngine?.resize();
            this.canvasEngine?.resize();
          }, 300);
        }
      }
    });

    this.resizeObserver.observe(this.container);
  }

  /** 播放 */
  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // 计算暂停时间并调整弹幕
    if (this.pauseStartTime > 0) {
      const pauseDuration = performance.now() - this.pauseStartTime;
      this.canvasEngine?.adjustDanmakuTime(pauseDuration);
      this.pauseStartTime = 0;
    }

    const engine = this.getActiveEngine();
    engine?.start();

    // 恢复现有弹幕动画
    this.domEngine?.resumeAnimations();
    this.canvasEngine?.resumeAnimations();

    this.renderLoop();
  }

  /** 暂停 */
  pause(): void {
    this.isPlaying = false;
    this.pauseStartTime = performance.now();

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // 暂停现有弹幕动画（而不是停止）
    this.domEngine?.pauseAnimations();
    this.canvasEngine?.pauseAnimations();
  }

  /** 停止 */
  stop(): void {
    this.isPlaying = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.domEngine?.stop();
    this.canvasEngine?.stop();
    this.clear();
  }

  /** 渲染循环 */
  private renderLoop = (): void => {
    if (!this.isPlaying) return;

    const currentTime = this.video.currentTime;

    // 时间变化较大时，可能是seek操作
    if (Math.abs(currentTime - this.lastVideoTime) > 1) {
      this.onSeeking();
    }

    this.lastVideoTime = currentTime;

    // 更新调度器时间
    this.scheduler.setCurrentTime(currentTime);

    // 获取需要渲染的弹幕（限制每帧最多渲染10条，避免卡顿）
    const danmakuToRender = this.scheduler.getDanmakuToRender(currentTime, 10);

    // 渲染弹幕
    if (danmakuToRender.length > 0) {
      this.renderDanmaku(danmakuToRender);
    }

    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  /** 渲染弹幕 */
  private renderDanmaku(items: DanmakuItem[]): void {
    const engine = this.getActiveEngine();
    if (!engine) return;

    const currentTime = performance.now();
    const videoTime = this.video.currentTime;

    // 根据引擎类型调用不同方法
    if (this.currentMode === RenderMode.DOM && this.domEngine) {
      this.domEngine.addDanmakuBatch(items, currentTime, videoTime);
    } else if (this.canvasEngine) {
      this.canvasEngine.addDanmakuBatch(items, currentTime, videoTime);
    }
  }

  /** 获取当前激活的引擎 */
  private getActiveEngine(): DOMEngine | CanvasEngine | null {
    // 自动模式：根据弹幕数量切换
    if (this.currentMode === RenderMode.AUTO) {
      const stats = this.scheduler.getStats();
      if (stats.totalLoaded > this.config.autoSwitchThreshold) {
        this.currentMode = RenderMode.CANVAS;
        this.domEngine?.stop();
        return this.canvasEngine;
      } else {
        this.currentMode = RenderMode.DOM;
        this.canvasEngine?.stop();
        return this.domEngine;
      }
    }

    return this.currentMode === RenderMode.DOM ? this.domEngine : this.canvasEngine;
  }

  /** 时间更新处理 */
  private onTimeUpdate(): void {
    // 已在renderLoop中处理
  }

  /** Seeking处理 */
  private onSeeking(): void {
    const currentTime = this.video.currentTime;
    const timeDiff = currentTime - this.lastVideoTime;

    // 判断seek幅度
    const isSmallSeek = Math.abs(timeDiff) <= 5; // 5秒内认为是小幅度seek

    if (isSmallSeek) {
      // 小幅度seek：保留现有弹幕，只更新位置
      this.handleSmallSeek(currentTime, timeDiff);
    } else {
      // 大幅度seek：清空并重新加载
      this.handleLargeSeek(currentTime);
    }
  }

  /** 处理小幅度seek（几秒） */
  private handleSmallSeek(currentTime: number, timeDiff: number): void {
    // 更新调度器时间
    this.scheduler.setCurrentTime(currentTime);

    // 更新现有弹幕的位置（根据seek的时间差）
    this.domEngine?.updateDanmakuPositionsForSeek(timeDiff);
    this.canvasEngine?.updateDanmakuPositionsForSeek(timeDiff);

    // 获取新进入时间窗口的弹幕
    const danmakuToRender = this.scheduler.getDanmakuToRender(currentTime, 10);
    if (danmakuToRender.length > 0) {
      this.renderDanmaku(danmakuToRender);
    }
  }

  /** 处理大幅度seek（超过5秒）- B站风格：保留弹幕，调整位置 */
  private handleLargeSeek(currentTime: number): void {
    const timeDiff = currentTime - this.lastVideoTime;

    // 更新调度器时间
    this.scheduler.setCurrentTime(currentTime);

    // B站风格：不清空弹幕，而是调整所有现有弹幕的位置
    // 对于已经在屏幕上的弹幕，调整它们的动画进度
    this.domEngine?.updateDanmakuPositionsForLargeSeek(timeDiff);
    this.canvasEngine?.updateDanmakuPositionsForLargeSeek(timeDiff);

    // 获取新进入时间窗口的弹幕并渲染
    const danmakuToRender = this.scheduler.getDanmakuToRender(currentTime, 10);
    if (danmakuToRender.length > 0) {
      this.renderDanmaku(danmakuToRender);
    }
  }

  /** 清空弹幕 */
  clear(): void {
    this.domEngine?.clear();
    this.canvasEngine?.clear();
  }

  /** 移除单条弹幕 */
  removeDanmaku(renderId: string): void {
    this.domEngine?.removeDanmaku(renderId);
    this.canvasEngine?.removeDanmaku(renderId);
  }

  /** 设置弹幕数据源 */
  setDataSource(loader: (startTime: number, endTime: number) => Promise<DanmakuItem[]>): void {
    this.scheduler.setLoadCallback(loader);
  }

  /** 添加单条弹幕 */
  addDanmaku(danmaku: DanmakuItem): void {
    this.scheduler.addDanmaku(danmaku);
  }

  /** 发送弹幕 */
  sendDanmaku(text: string, options: Partial<DanmakuItem> = {}): void {
    const danmaku: DanmakuItem = {
      id: Date.now(),
      text,
      time: this.video.currentTime,
      type: DanmakuType.SCROLL,
      fontSize: this.options.fontSize,
      color: '#ffffff',
      ...options,
    };

    this.addDanmaku(danmaku);

    // 立即渲染
    const engine = this.getActiveEngine();
    if (engine instanceof DOMEngine) {
      engine.addDanmaku(danmaku, performance.now());
    } else if (engine instanceof CanvasEngine) {
      engine.addDanmaku(danmaku, performance.now());
    }
  }

  /** 设置可见性 */
  setVisible(visible: boolean): void {
    this.options.visible = visible;
    this.container.style.opacity = visible ? '1' : '0';
  }

  /** 设置透明度 */
  setOpacity(opacity: number): void {
    this.options.opacity = opacity;
    this.domEngine?.updateConfig({ opacity });
    this.canvasEngine?.updateConfig({ opacity });
  }

  /** 设置密度 */
  setDensity(density: number): void {
    this.options.density = density;
    this.scheduler.updateConfig({ densityLimit: density });
  }

  /** 设置渲染模式 */
  setRenderMode(mode: RenderMode): void {
    this.currentMode = mode;
    this.options.renderMode = mode;

    // 清空并重启
    this.clear();
    if (this.isPlaying) {
      this.play();
    }
  }

  /** 切换全屏 */
  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen?.()?.catch(err => {
        logger.warn('全屏请求失败:', err);
      });
    } else {
      document.exitFullscreen?.()?.catch(err => {
        logger.warn('退出全屏失败:', err);
      });
    }
  }

  /** 启动性能监控 */
  private startPerformanceMonitor(): void {
    this.performanceMonitorTimer = window.setInterval(() => {
      this.updatePerformanceStats();
    }, this.config.performanceMonitorInterval);
  }

  /** 更新性能统计 */
  private updatePerformanceStats(): void {
    const domStats = this.domEngine?.getStats();
    const canvasStats = this.canvasEngine?.getStats();
    const poolStats = this.itemPool.getStats();

    this.performanceStats = {
      fps: canvasStats?.fps || 60,
      renderCount: domStats?.renderCount || canvasStats?.renderCount || 0,
      poolUsage: poolStats.inUse / poolStats.total,
      memoryUsage: this.getMemoryUsage(),
      avgRenderTime: 0, // 需要更精细的测量
    };

    // 性能警告
    if (this.performanceStats.fps < this.config.minFps) {
      this.events.onPerformanceWarning?.(this.performanceStats);
    }
  }

  /** 获取内存使用 */
  // private getMemoryUsage(): number {
  //   if ('memory' in performance) {
  //     const memory = (performance as any).memory;
  //     return memory ? Math.round(memory.usedJSHeapSize / 1048576) : 0;
  //   }

  //   return 0;
  // }

  private getMemoryUsage(): number {
    if (hasMemoryInfo(performance) && performance.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1048576);
    }
    return 0;
  }

  /** 获取性能统计 */
  getPerformanceStats(): PerformanceStats {
    return { ...this.performanceStats };
  }

  /** 获取统计信息 */
  getStats(): {
    renderMode: RenderMode;
    screenMode: ScreenMode;
    isPlaying: boolean;
    performance: PerformanceStats;
    scheduler: ReturnType<DanmakuScheduler['getStats']>;
  } {
    return {
      renderMode: this.currentMode,
      screenMode: this.currentScreenMode,
      isPlaying: this.isPlaying,
      performance: this.performanceStats,
      scheduler: this.scheduler.getStats(),
    };
  }

  /** 调整尺寸 */
  resize(): void {
    this.domEngine?.resize();
    this.canvasEngine?.resize();
  }

  /**
   * 切换屏幕模式（全屏/非全屏）
   * @param mode 屏幕模式：'fullscreen' 或 'normal'
   */
  switchScreenMode(mode: 'fullscreen' | 'normal'): void {
    const newMode = mode === 'fullscreen' ? ScreenMode.FULLSCREEN : ScreenMode.NORMAL;

    if (newMode !== this.currentScreenMode) {
      this.currentScreenMode = newMode;

      // 通知引擎（只调整尺寸，不再切换轨道模式）
      this.domEngine?.switchScreenMode(newMode);
      this.canvasEngine?.switchScreenMode(newMode);

      // 调整尺寸
      rafTimeout(() => {
        this.canvasEngine?.resize();
        this.domEngine?.resize();
      }, 100);
    }
  }

  /**
   * 设置底部安全区域高度（字幕区域）
   * @param height 安全区域高度（像素）
   */
  setBottomSafeArea(height: number): void {
    // 更新轨道管理器配置
    this.trackManager.updateConfig({ bottomSafeArea: height });
    // 重新初始化轨道
    this.trackManager.initTracks(
      this.container.clientWidth,
      this.container.clientHeight,
      this.options.area
    );
  }

  /**
   * 获取当前轨道信息
   * @returns 轨道数量和尺寸信息
   */
  getTrackInfo(): {
    count: number;
    height: number;
    screenMode: ScreenMode;
    containerWidth: number;
    containerHeight: number;
  } {
    return {
      count: this.trackManager.getTrackCount(),
      height: this.options.trackHeight,
      screenMode: this.currentScreenMode,
      containerWidth: this.container.clientWidth,
      containerHeight: this.container.clientHeight,
    };
  }

  /** 销毁 */
  destroy(): void {
    this.stop();

    if (this.performanceMonitorTimer) {
      clearInterval(this.performanceMonitorTimer);
    }

    // 清理ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.domEngine?.destroy();
    this.canvasEngine?.destroy();
    this.scheduler.destroy();
    this.elementPool.destroy();

    // 清理引用
    this.domEngine = null;
    this.canvasEngine = null;
  }

  /**
   * 设置弹幕悬停回调
   * @param callback 回调函数，参数为弹幕项和位置（悬停时为数据，离开时为空）
   * @example
   * danmakuManager.setOnDanmakuHover((danmaku, position) => {
   *   if (danmaku && position) {
   *     console.log('悬停弹幕:', danmaku.text);
   *     console.log('位置:', position); // { x: 100, y: 200 }
   *   } else {
   *     console.log('离开弹幕');
   *   }
   * });
   */
  setOnDanmakuHover(
    callback: (
      danmaku: DanmakuRenderItemType | null,
      position: { x: number; y: number } | null
    ) => void
  ): void {
    this.domEngine?.setOnDanmakuHover(callback);
    this.canvasEngine?.setOnDanmakuHover(callback);
  }

  /**
   * 设置弹幕速度档位
   * @param speed 速度档位：VERY_SLOW(极慢), SLOW(较慢), NORMAL(适中), FAST(较快), VERY_FAST(极快)
   * @description 修改后新渲染的弹幕会使用新速度，已存在的弹幕保持原速度
   */
  setSpeed(speed: DanmakuSpeed): void {
    this.options.speed = speed;
    this.domEngine?.updateConfig({ speed });
    this.canvasEngine?.updateConfig({ speed });
  }

  /**
   * 获取当前速度档位
   */
  getSpeed(): DanmakuSpeed {
    return this.options.speed;
  }

  /**
   * 设置弹幕区域档位
   * @param area 区域档位：QUARTER(25%), HALF(50%), THREE_QUARTERS(75%), FULL(100%)
   * @description 修改后新渲染的弹幕会使用新区域，已存在的弹幕保持原位置
   */
  setArea(area: DanmakuArea): void {
    this.options.area = area;
    this.domEngine?.updateConfig({ area });
    this.canvasEngine?.updateConfig({ area });
  }

  /**
   * 获取当前区域档位
   */
  getArea(): DanmakuArea {
    return this.options.area;
  }

  /**
   * 设置弹幕字号
   * @param fontSize 字号大小（像素）
   * @description 修改后新渲染的弹幕会使用新字号，已存在的弹幕保持原字号
   */
  setFontSize(fontSize: number): void {
    this.options.fontSize = fontSize;
    const fontSizeScale = fontSize / 18;
    this.domEngine?.updateConfig({ fontSizeScale });
    this.canvasEngine?.updateConfig({ fontSizeScale });
  }

  /**
   * 获取当前字号
   */
  getFontSize(): number {
    return this.options.fontSize;
  }

  /**
   * 设置是否自动随屏幕大小缩放弹幕
   * @param autoScale 是否自动缩放，默认true
   * @description 开启后，新渲染的弹幕会随窗口大小自动缩放；关闭后，新弹幕保持固定大小。已存在的弹幕不受影响。
   */
  setAutoScale(autoScale: boolean): void {
    this.options.autoScale = autoScale;
    // 只更新配置，不触发resize，已存在的弹幕保持原样，新弹幕使用新配置
    this.domEngine?.updateConfig({ autoScale });
    this.canvasEngine?.updateConfig({ autoScale });
  }

  /**
   * 获取当前是否自动缩放弹幕
   */
  getAutoScale(): boolean {
    return this.options.autoScale ?? true;
  }

  /**
   * 设置弹幕过滤器
   * @param filter 过滤器配置：{ scroll?: boolean, fixed?: boolean, colorful?: boolean }
   * @description 修改后立即生效，新添加的弹幕会根据过滤器判断是否显示
   */
  setFilter(filter: DanmakuFilter): void {
    this.options.filter = filter;
    this.domEngine?.updateConfig({ filter });
    this.canvasEngine?.updateConfig({ filter });
  }

  /**
   * 获取当前过滤器设置
   */
  getFilter(): DanmakuFilter {
    return { ...this.options.filter };
  }

  /**
   * 重置过滤器（清除所有过滤）
   */
  resetFilter(): void {
    this.setFilter({});
  }

  /**
   * 设置防挡遮罩
   * @param config 防挡遮罩配置
   * @description 启用后，弹幕会在遮罩镂空区域显示，被遮挡区域不显示弹幕
   */
  setMaskConfig(config: DanmakuMaskConfig): void {
    // 只给当前使用的引擎设置遮罩配置，并传入获取视频时间的回调
    const activeEngine = this.getActiveEngine();
    if (activeEngine) {
      activeEngine.setMaskConfig({
        ...config,
        getCurrentTime: () => this.video.currentTime,
      });
    }
  }

  /**
   * 获取当前防挡遮罩配置
   */
  getMaskConfig(): DanmakuMaskConfig | undefined {
    // 从 DOM 引擎获取配置（两个引擎配置保持一致）
    return this.domEngine?.['config']?.maskConfig ?? this.canvasEngine?.['config']?.maskConfig;
  }

  /**
   * 启用防挡功能
   * @param maskImage 遮罩图片URL（镂空PNG）
   * @param videoRect 视频在容器中的位置（可选，用于对齐遮罩）
   */
  enableMask(
    maskImage: string,
    videoRect?: { x: number; y: number; width: number; height: number }
  ): void {
    this.setMaskConfig({
      enabled: true,
      maskImage,
      videoRect,
    });
  }

  /**
   * 禁用防挡功能
   */
  disableMask(): void {
    this.setMaskConfig({
      enabled: false,
    });
  }
}

// 默认导出
export default DanmakuManager;
