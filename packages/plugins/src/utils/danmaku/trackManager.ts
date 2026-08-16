/**
 * 高性能弹幕系统 - 轨道管理器
 * 管理弹幕轨道分配
 */

import { DanmakuType, DanmakuArea } from '@/types/danmaku';
import type { DanmakuTrack, DanmakuRenderItem, TrackConfig } from './types';

/** 轨道管理器配置 */
interface TrackManagerConfig {
  /** 轨道高度 */
  trackHeight: number;
  /** 轨道间距 */
  trackGap: number;
  /** 顶部边距 */
  topMargin: number;
  /** 底部边距 */
  bottomMargin: number;
  /** 底部安全区域高度（字幕区域） */
  bottomSafeArea: number;
  /** 碰撞检测安全距离 */
  safeDistance: number;
}

/** 轨道状态 */
interface TrackState {
  /** 轨道列表 */
  tracks: DanmakuTrack[];
  /** 容器宽度 */
  width: number;
  height: number;
  /** 当前区域档位 */
  area: DanmakuArea;
  /** 最后更新时间 */
  lastUpdateTime: number;
  /** 当前扩展次数 */
  extendCount: number;
}

export class TrackManager {
  private config: TrackManagerConfig;
  private state: TrackState;

  constructor(config: Partial<TrackManagerConfig> = {}) {
    this.config = {
      trackHeight: 24,
      trackGap: 4,
      topMargin: 10,
      bottomMargin: 10,
      bottomSafeArea: 0,
      safeDistance: 20,
      ...config,
    };

    this.state = {
      tracks: [],
      width: 0,
      height: 0,
      area: DanmakuArea.FULL,
      lastUpdateTime: 0,
      extendCount: 0,
    };
  }

  /**
   * 初始化轨道
   * @param width 容器宽度
   * @param height 容器高度
   * @param area 区域档位（默认全屏）
   */
  initTracks(width: number, height: number, area: DanmakuArea = DanmakuArea.FULL): void {
    this.state.width = width;
    this.state.height = height;
    this.state.area = area;
    this.state.extendCount = 0;

    // 根据区域档位计算可用高度
    // FULL(1.0): 全屏, THREE_QUARTERS(0.75): 75%, HALF(0.5): 50%, QUARTER(0.25): 25%
    const areaHeight = Math.floor(height * area);

    // 计算可用高度（根据区域档位，不考虑安全区域）
    const availableHeight = areaHeight - this.config.topMargin - this.config.bottomMargin;

    // 计算最大轨道数
    const maxTrackCount = Math.floor(availableHeight / (this.config.trackHeight + this.config.trackGap));

    // 初始轨道数：使用70%的可用轨道，留出空间给后续扩展
    const trackCount = Math.max(1, Math.floor(maxTrackCount * 0.7));

    // 创建轨道（从顶部开始）
    this.state.tracks = [];
    for (let i = 0; i < trackCount; i++) {
      const trackY = this.config.topMargin + i * (this.config.trackHeight + this.config.trackGap);

      // 确保轨道不超出区域边界
      if (trackY + this.config.trackHeight > areaHeight) {
        break;
      }

      this.state.tracks.push({
        id: i,
        index: i,
        height: this.config.trackHeight,
        y: trackY,
        items: new Set(),
        lastItemEndX: width,
        lastItemEndTime: 0,
      });
    }
  }

  /**
   * 扩展轨道：交替模式 +5 -> +4 -> +5 -> +4...
   * 确保与第一次的轨道不重合，且不超出区域边界
   * @returns 是否成功扩展
   */
  extendTracksToSafeArea(): boolean {
    const { width, height, area } = this.state;

    // 根据区域档位计算可用高度（与 initTracks 保持一致）
    // FULL(1.0): 全屏, THREE_QUARTERS(0.75): 75%, HALF(0.5): 50%, QUARTER(0.25): 25%
    const areaHeight = Math.floor(height * area);
    // 计算可用高度（根据区域档位，不考虑安全区域）
    const availableHeight = areaHeight - this.config.topMargin - this.config.bottomMargin;
    // 区域边界位置
    const effectiveBoundary = areaHeight;

    // 计算最大可用轨道数（确保不超出边界）
    const maxTrackCount = Math.floor(availableHeight / (this.config.trackHeight + this.config.trackGap));

    const currentCount = this.state.tracks.length;
    if (currentCount >= maxTrackCount) {
      return false;
    }

    // 计算本次要添加的轨道数
    const isOddExtend = this.state.extendCount % 2 === 0;
    const extendCount = Math.min(isOddExtend ? 5 : 4, maxTrackCount - currentCount);

    if (extendCount <= 0) {
      return false;
    }

    // 保存现有轨道位置，用于避免重合
    const existingYPositions = new Set(this.state.tracks.map(t => Math.round(t.y)));

    // 创建新轨道
    let addedCount = 0;
    let tryY = this.config.topMargin + this.config.trackHeight;
    const maxAllowedY = effectiveBoundary - this.config.trackHeight;

    while (addedCount < extendCount && tryY <= maxAllowedY) {
      const roundedY = Math.round(tryY);

      // 检查是否与现有轨道重合
      let isOverlapping = false;
      for (const existingY of existingYPositions) {
        if (Math.abs(existingY - roundedY) < this.config.trackHeight + 2) {
          isOverlapping = true;
          break;
        }
      }

      if (!isOverlapping) {
        // 添加新轨道
        const newIndex = this.state.tracks.length;
        this.state.tracks.push({
          id: newIndex,
          index: newIndex,
          height: this.config.trackHeight,
          y: tryY,
          items: new Set(),
          lastItemEndX: width,
          lastItemEndTime: 0,
        });
        existingYPositions.add(roundedY);
        addedCount++;
      }
      
      // 尝试下一个位置
      tryY += this.config.trackHeight + this.config.trackGap;
    }

    if (addedCount > 0) {
      // 重新排序轨道
      this.state.tracks.sort((a, b) => a.y - b.y);
      // 更新索引
      this.state.tracks.forEach((track, index) => {
        track.index = index;
        track.id = index;
      });
      this.state.extendCount++;
      return true;
    }

    return false;
  }

  /**
   * 获取可用轨道
   * @param item 弹幕项
   * @param currentTime 当前时间
   * @returns 可用轨道索引，-1表示无可用轨道
   */
  getAvailableTrack(item: DanmakuRenderItem, currentTime: number): number {
    const { tracks, width } = this.state;

    // 顶部/底部固定弹幕
    if (item.type === DanmakuType.TOP || item.type === DanmakuType.BOTTOM) {
      return this.getFixedTrack(item.type, currentTime);
    }

    // 滚动弹幕 - 查找可用轨道

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];

      // 空轨道直接使用
      if (track.items.size === 0) {
        return i;
      }

      // 检查是否与轨道上现有弹幕碰撞
      if (this.checkTrackAvailability(track, item, currentTime, width)) {
        return i;
      }
    }

    // 没有可用轨道，尝试扩展
    if (this.extendTracksToSafeArea()) {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.items.size === 0) {
          return i;
        }
        if (this.checkTrackAvailability(track, item, currentTime, width)) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * 获取动态安全距离
   * @returns 安全距离（像素）
   */
  private getDynamicSafeDistance(): number {
    const { tracks } = this.state;

    let totalItems = 0;
    tracks.forEach(track => {
      track.items.forEach(item => {
        if (item.isRendering) totalItems++;
      });
    });

    const density = totalItems / Math.max(1, tracks.length);
    
    // 弹幕少时间距大（100px），弹幕多时间距小（20px）
    // 密度 0-5: 100px, 密度 5-20: 线性递减, 密度 >20: 20px
    if (density <= 1) {
      return 150;
    } else if (density <= 5) {
      return 100;
    } else if (density <= 15) {
      return 60;
    } else if (density <= 25) {
      return 40;
    } else {
      return 20;
    }
  }

  /**
   * 检查轨道是否可用
   * @param track 轨道
   * @param newItem 新弹幕
   * @param currentTime 当前时间
   * @param containerWidth 容器宽度
   * @returns 是否可用
   */
  private checkTrackAvailability(
    track: DanmakuTrack,
    newItem: DanmakuRenderItem,
    currentTime: number,
    containerWidth: number
  ): boolean {
    const safeDistance = this.getDynamicSafeDistance();

    for (const existingItem of track.items) {
      if (!existingItem.isRendering) continue;
      if (existingItem.type !== DanmakuType.SCROLL) continue;

      const elapsedTime = currentTime - existingItem.createTime;
      const existingProgress = elapsedTime / existingItem.duration;
      const existingX = containerWidth - (containerWidth + existingItem.width) * existingProgress;

      if (existingX > containerWidth - newItem.width - safeDistance * 2) {
        return false;
      }

      if (existingX + existingItem.width > 0) {
        const remainingTime = existingItem.duration - elapsedTime;
        const minRemainingTime = safeDistance > 80 ? 2000 : 1000;
        if (remainingTime < minRemainingTime) {
          continue;
        }

        const newSpeed = (containerWidth + newItem.width) / newItem.duration;
        const existingSpeed = (containerWidth + existingItem.width) / existingItem.duration;

        if (newSpeed > existingSpeed && existingX > containerWidth / 2) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 获取固定位置轨道
   * @param type 弹幕类型
   * @param currentTime 当前时间
   * @returns 轨道索引
   */
  private getFixedTrack(type: DanmakuType, currentTime: number): number {
    const { tracks, height } = this.state;
    const safeAreaBoundary = Math.floor(height * 0.8);
    const isTop = type === DanmakuType.TOP;

    if (isTop) {
      const maxTrackIndex = Math.floor(tracks.length / 3);
      for (let i = 0; i < maxTrackIndex && i < tracks.length; i++) {
        const track = tracks[i];
        let hasConflict = false;

        for (const existingItem of track.items) {
          if (existingItem.isRendering && existingItem.type === type) {
            const elapsedTime = currentTime - existingItem.createTime;
            const remainingTime = existingItem.duration - elapsedTime;
            if (remainingTime > 500) {
              hasConflict = true;
              break;
            }
          }
        }

        if (!hasConflict) {
          return i;
        }
      }
    } else {
      // 底部弹幕：也从上方开始查找可用轨道，但不使用安全区域内的轨道
      // 找到不在安全区域内的轨道
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        
        // 跳过安全区域内的轨道（底部20%）
        if (track.y > safeAreaBoundary) {
          continue;
        }

        let hasConflict = false;
        for (const existingItem of track.items) {
          if (existingItem.isRendering && existingItem.type === type) {
            const elapsedTime = currentTime - existingItem.createTime;
            const remainingTime = existingItem.duration - elapsedTime;

            // 如果还有剩余显示时间，不能放置
            if (remainingTime > 500) {
              hasConflict = true;
              break;
            }
          }
        }

        if (!hasConflict) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * 添加弹幕到轨道
   * @param trackIndex 轨道索引
   * @param item 弹幕项
   */
  addToTrack(trackIndex: number, item: DanmakuRenderItem): void {
    const track = this.state.tracks[trackIndex];
    if (track) {
      track.items.add(item);
      item.trackIndex = trackIndex;
      item.y = track.y;
    }
  }

  /**
   * 从轨道移除弹幕
   * @param item 弹幕项
   */
  removeFromTrack(item: DanmakuRenderItem): void {
    if (item.trackIndex >= 0) {
      const track = this.state.tracks[item.trackIndex];
      if (track) {
        track.items.delete(item);
      }
      item.trackIndex = -1;
    }
  }

  /**
   * 清理已结束的弹幕
   * @param currentTime 当前时间
   */
  cleanupFinishedItems(currentTime: number): void {
    this.state.tracks.forEach((track) => {
      for (const item of track.items) {
        if (item.isRendering) {
          const elapsedTime = currentTime - item.createTime;
          if (elapsedTime >= item.duration) {
            item.isRendering = false;
            track.items.delete(item);
          }
        }
      }
    });
  }

  /**
   * 获取当前轨道配置
   */
  getTrackConfig(): TrackConfig {
    return {
      count: this.state.tracks.length,
      height: this.config.trackHeight,
      gap: this.config.trackGap,
      topMargin: this.config.topMargin,
      bottomMargin: this.config.bottomMargin,
    };
  }

  /**
   * 获取轨道数量
   */
  getTrackCount(): number {
    return this.state.tracks.length;
  }

  /**
   * 获取轨道信息
   */
  getTracks(): DanmakuTrack[] {
    return this.state.tracks;
  }

  /**
   * 重置轨道
   */
  reset(): void {
    this.state.tracks.forEach((track) => track.items.clear());
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TrackManagerConfig>): void {
    Object.assign(this.config, config);
  }
}
