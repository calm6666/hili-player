/**
 * 高性能弹幕系统 - 调度器
 * 管理弹幕分段加载和智能渲染调度
 */

import type { DanmakuItem, DanmakuSegment } from '@/types/danmaku';
import { createLogger } from '@/utils';
const logger = createLogger('DanmakuScheduler');

/** 调度器配置 */
interface SchedulerConfig {
  /** 分段时长 (秒) */
  segmentDuration: number;
  /** 预加载分段数 */
  preloadSegments: number;
  /** 最大缓存分段数 */
  maxCachedSegments: number;
  /** 渲染延迟 (毫秒) */
  renderDelay: number;
  /** 密度限制 (0-1) */
  densityLimit: number;
}

/** 分段加载回调 */
type SegmentLoadCallback = (startTime: number, endTime: number) => Promise<DanmakuItem[]>;

export class DanmakuScheduler {
  private config: SchedulerConfig;
  private segments: Map<number, DanmakuSegment> = new Map();
  private loadCallback: SegmentLoadCallback | null = null;

  // 状态
  private currentSegmentIndex = -1;
  private loadedRanges: Array<{ start: number; end: number }> = [];

  // 性能统计
  private stats = {
    totalLoaded: 0,
    totalRendered: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      segmentDuration: 30, // 30秒一个分段
      preloadSegments: 2, // 预加载前后2个分段
      maxCachedSegments: 10, // 最多缓存10个分段
      renderDelay: 100, // 100ms渲染延迟
      densityLimit: 1, // 默认密度100%
      ...config,
    };
  }

  /**
   * 设置分段加载回调
   * @param callback 加载回调
   */
  setLoadCallback(callback: SegmentLoadCallback): void {
    this.loadCallback = callback;
  }

  /**
   * 设置当前时间
   * @param time 时间 (秒)
   */
  setCurrentTime(time: number): void {
    const segmentIndex = Math.floor(time / this.config.segmentDuration);

    if (segmentIndex !== this.currentSegmentIndex) {
      this.currentSegmentIndex = segmentIndex;
      this.onSegmentChange(segmentIndex);
    }
  }

  /**
   * 分段变化处理
   * @param index 分段索引
   */
  private onSegmentChange(index: number): void {
    // 预加载附近分段
    this.preloadSegments(index)?.catch(err => logger.error('预加载失败:', err));

    // 清理过期缓存
    this.cleanupCache(index);
  }

  /**
   * 预加载分段
   * @param centerIndex 中心分段索引
   */
  private async preloadSegments(centerIndex: number): Promise<void> {
    if (!this.loadCallback) return;

    const startIndex = Math.max(0, centerIndex - this.config.preloadSegments);
    const endIndex = centerIndex + this.config.preloadSegments;

    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.segments.has(i)) {
        await this.loadSegment(i);
      }
    }
  }

  /**
   * 加载单个分段
   * @param index 分段索引
   */
  private async loadSegment(index: number): Promise<void> {
    if (!this.loadCallback || this.segments.has(index)) return;

    const startTime = index * this.config.segmentDuration;
    const endTime = startTime + this.config.segmentDuration;

    try {
      const danmakuList = await this.loadCallback(startTime, endTime);

      // 创建分段
      const segment: DanmakuSegment = {
        index,
        startTime,
        endTime,
        danmakuList: this.processDanmakuList(danmakuList),
        loaded: true,
      };

      this.segments.set(index, segment);
      this.stats.totalLoaded += danmakuList.length;

      // 更新加载范围
      this.updateLoadedRanges();
    } catch (error) {
      logger.error(`Failed to load segment ${index}:`, error);
    }
  }

  /**
   * 处理弹幕列表
   * @param list 原始弹幕列表
   * @returns 处理后的列表
   */
  private processDanmakuList(list: DanmakuItem[]): DanmakuItem[] {
    // 按时间排序
    const sorted = list.sort((a, b) => a.time - b.time);

    // 应用密度限制
    if (this.config.densityLimit < 1) {
      const limit = Math.ceil(sorted.length * this.config.densityLimit);
      return sorted.slice(0, limit);
    }

    return sorted;
  }

  /**
   * 更新已加载范围
   */
  private updateLoadedRanges(): void {
    const indices = Array.from(this.segments.keys()).sort((a, b) => a - b);

    this.loadedRanges = [];
    let currentRange: { start: number; end: number } | null = null;

    for (const index of indices) {
      if (!currentRange) {
        currentRange = { start: index, end: index };
      } else if (index === currentRange.end + 1) {
        currentRange.end = index;
      } else {
        this.loadedRanges.push(currentRange);
        currentRange = { start: index, end: index };
      }
    }

    if (currentRange) {
      this.loadedRanges.push(currentRange);
    }
  }

  /**
   * 清理缓存
   * @param currentIndex 当前分段索引
   */
  private cleanupCache(currentIndex: number): void {
    const maxDistance = this.config.maxCachedSegments;

    for (const [index] of this.segments) {
      const distance = Math.abs(index - currentIndex);
      if (distance > maxDistance) {
        this.segments.delete(index);
      }
    }
  }

  /**
   * 获取当前时间需要渲染的弹幕
   * @param currentTime 当前时间 (秒)
   * @param limit 最大返回数量（避免卡顿）
   * @param timeWindow 时间窗口 (秒)
   * @returns 需要渲染的弹幕列表
   */
  getDanmakuToRender(
    currentTime: number,
    limit: number = 20,
    timeWindow: number = 0.5
  ): DanmakuItem[] {
    const result: DanmakuItem[] = [];
    const startTime = currentTime;
    const endTime = currentTime + timeWindow;

    // 计算涉及的分段
    const startSegment = Math.floor(startTime / this.config.segmentDuration);
    const endSegment = Math.floor(endTime / this.config.segmentDuration);

    for (let i = startSegment; i <= endSegment && result.length < limit; i++) {
      const segment = this.segments.get(i);
      if (!segment) {
        this.stats.cacheMisses++;
        continue;
      }

      this.stats.cacheHits++;

      // 筛选在当前时间窗口内的弹幕
      for (const danmaku of segment.danmakuList) {
        if (danmaku.time >= startTime && danmaku.time <= endTime) {
          result.push(danmaku);
          if (result.length >= limit) {
            break;
          }
        }
      }
    }

    this.stats.totalRendered += result.length;
    return result;
  }

  /**
   * 获取当前屏幕上应该显示的所有弹幕（用于快进后恢复显示）
   * @param currentTime 当前时间 (秒)
   * @param limit 最大返回数量
   * @returns 需要渲染的弹幕列表
   */
  getDanmakuOnScreen(currentTime: number, limit: number = 50): DanmakuItem[] {
    const result: DanmakuItem[] = [];

    // 估算弹幕在屏幕上的显示时间（通常8-10秒）
    const screenDuration = 10;
    const startTime = Math.max(0, currentTime - screenDuration);
    const endTime = currentTime + 1; // 未来1秒的弹幕也要显示

    // 计算涉及的分段
    const startSegment = Math.floor(startTime / this.config.segmentDuration);
    const endSegment = Math.floor(endTime / this.config.segmentDuration);

    for (let i = startSegment; i <= endSegment && result.length < limit; i++) {
      const segment = this.segments.get(i);
      if (!segment) continue;

      // 筛选在屏幕显示时间范围内的弹幕
      for (const danmaku of segment.danmakuList) {
        // 弹幕应该已经显示（time <= currentTime）
        // 且还没有移出屏幕（time + screenDuration > currentTime）
        if (danmaku.time <= currentTime && danmaku.time + screenDuration > currentTime) {
          result.push(danmaku);
          if (result.length >= limit) {
            break;
          }
        }
      }
    }

    return result;
  }

  /**
   * 添加弹幕到当前分段
   * @param danmaku 弹幕数据
   */
  addDanmaku(danmaku: DanmakuItem): void {
    const segmentIndex = Math.floor(danmaku.time / this.config.segmentDuration);
    let segment = this.segments.get(segmentIndex);

    // 如果分段不存在，创建新分段
    if (!segment) {
      const startTime = segmentIndex * this.config.segmentDuration;
      const endTime = startTime + this.config.segmentDuration;
      segment = {
        index: segmentIndex,
        startTime,
        endTime,
        danmakuList: [],
        loaded: true,
      };
      this.segments.set(segmentIndex, segment);
    }

    segment.danmakuList.push(danmaku);
    segment.danmakuList.sort((a, b) => a.time - b.time);
  }

  /**
   * 预加载指定时间范围
   * @param startTime 开始时间
   * @param endTime 结束时间
   */
  async preloadRange(startTime: number, endTime: number): Promise<void> {
    const startSegment = Math.floor(startTime / this.config.segmentDuration);
    const endSegment = Math.floor(endTime / this.config.segmentDuration);

    for (let i = startSegment; i <= endSegment; i++) {
      if (!this.segments.has(i)) {
        await this.loadSegment(i);
      }
    }
  }

  /**
   * 检查是否已加载
   * @param time 时间
   * @returns 是否已加载
   */
  isLoaded(time: number): boolean {
    const segmentIndex = Math.floor(time / this.config.segmentDuration);
    return this.segments.has(segmentIndex);
  }

  /**
   * 获取已加载范围
   * @returns 已加载范围列表
   */
  getLoadedRanges(): Array<{ start: number; end: number }> {
    return this.loadedRanges.map((range) => ({
      start: range.start * this.config.segmentDuration,
      end: (range.end + 1) * this.config.segmentDuration,
    }));
  }

  /**
   * 获取统计信息
   */
  getStats(): typeof this.stats & { cachedSegments: number } {
    return {
      ...this.stats,
      cachedSegments: this.segments.size,
    };
  }

  /**
   * 更新配置
   * @param config 配置
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * 重置
   */
  reset(): void {
    this.segments.clear();
    this.currentSegmentIndex = -1;
    this.loadedRanges = [];
    this.stats = {
      totalLoaded: 0,
      totalRendered: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.reset();
    this.loadCallback = null;
  }
}
