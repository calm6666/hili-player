/**
 * 弹幕插件类型定义
 * 通用类型从 @/types/danmaku 导入并重新导出，插件特有类型保留在本地
 */

// ============================================
// 从 @/types/danmaku 导入通用类型（用于本地定义 + 重新导出）
// ============================================
import {
  DanmakuType,
  DanmakuSpeed,
  DanmakuFontSize,
  DanmakuArea,
  RenderMode,
  ScreenMode,
} from '@/types/danmaku';
import type {
  DanmakuItem,
  DanmakuFilter,
  DanmakuSegment,
} from '@/types/danmaku';

export {
  DanmakuType,
  DanmakuSpeed,
  DanmakuFontSize,
  DanmakuArea,
  RenderMode,
  ScreenMode,
};

export type {
  DanmakuItem,
  DanmakuFilter,
  DanmakuSegment,
};

// ============================================
// 插件特有类型
// ============================================

/** 防挡遮罩配置 */
export interface DanmakuMaskConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 遮罩图片URL（镂空PNG） */
  maskImage?: string;
  /** 视频在容器中的位置 */
  videoRect?: { x: number; y: number; width: number; height: number };
  /** 获取当前视频时间（内部使用） */
  getCurrentTime?: () => number;
}

/** 弹幕配置选项 — 插件层精简版 */
export interface DanmakuOptions {
  /** 容器元素 */
  container: HTMLElement;
  /** 视频元素 */
  video: HTMLVideoElement;
  /** 渲染模式 */
  renderMode?: RenderMode;
  /** 弹幕透明度 (0-1) */
  opacity?: number;
  /** 弹幕速度档位 */
  speed?: DanmakuSpeed;
  /** 弹幕区域档位 */
  area?: DanmakuArea;
  /** 字体大小（像素） */
  fontSize?: number;
  /** 字体大小档位 */
  fontSizeScale?: DanmakuFontSize;
  /** 是否自动随屏幕大小缩放弹幕 (默认true) */
  autoScale?: boolean;
  /** 是否显示弹幕 */
  visible?: boolean;
  /** 弹幕密度 (0-1) */
  density?: number;
  /** 弹幕过滤器 */
  filter?: DanmakuFilter;
}

/** 性能统计 */
export interface PerformanceStats {
  /** FPS */
  fps: number;
  /** 渲染弹幕数 */
  renderCount: number;
  /** 对象池使用率 */
  poolUsage?: number;
  /** 内存使用（MB） */
  memoryUsage?: number;
  /** 平均渲染时间（ms） */
  avgRenderTime?: number;
}

/** 弹幕管理器事件 */
export interface DanmakuEvents {
  /** 渲染开始 */
  renderStart: () => void;
  /** 渲染暂停 */
  renderPause: () => void;
  /** 弹幕添加 */
  danmakuAdd: (item: DanmakuItem) => void;
  /** 弹幕发送 */
  danmakuSend: (item: DanmakuItem) => void;
  /** 模式切换 */
  modeChange: (mode: RenderMode) => void;
  /** 性能警告 */
  onPerformanceWarning?: (stats: PerformanceStats) => void;
}

/** 弹幕管理器接口 - 与 src/utils/danmaku 的 DanmakuManager 保持一致 */
export interface IDanmakuManager {
  // 核心方法
  /** 播放 */
  play(): void;
  /** 暂停 */
  pause(): void;
  /** 停止 */
  stop(): void;
  /** 清空弹幕 */
  clear(): void;
  /** 销毁 */
  destroy(): void;

  // 弹幕操作
  /** 添加单条弹幕 */
  addDanmaku(danmaku: DanmakuItem): void;
  /** 批量添加弹幕 */
  loadDanmaku(list: DanmakuItem[]): void;
  /** 发送弹幕（立即显示） */
  sendDanmaku(text: string, options?: Partial<DanmakuItem>): void;
  /** 移除单条弹幕 */
  removeDanmaku(renderId: string): void;

  // 设置方法
  /** 设置可见性 */
  setVisible(visible: boolean): void;
  /** 设置透明度 */
  setOpacity(opacity: number): void;
  /** 设置密度 */
  setDensity(density: number): void;
  /** 设置渲染模式 */
  setRenderMode(mode: RenderMode): void;
  /** 设置速度档位 */
  setSpeed(speed: DanmakuSpeed): void;
  /** 获取当前速度档位 */
  getSpeed(): DanmakuSpeed;
  /** 设置区域档位 */
  setArea(area: DanmakuArea): void;
  /** 获取当前区域档位 */
  getArea(): DanmakuArea;
  /** 设置字号（像素） */
  setFontSize(fontSize: number): void;
  /** 获取当前字号 */
  getFontSize(): number;
  /** 设置是否自动缩放 */
  setAutoScale(autoScale: boolean): void;
  /** 获取当前是否自动缩放 */
  getAutoScale(): boolean;
  /** 设置过滤器 */
  setFilter(filter: DanmakuFilter): void;
  /** 获取当前过滤器 */
  getFilter(): DanmakuFilter;
  /** 重置过滤器 */
  resetFilter(): void;
  /** 设置防挡遮罩 */
  setMaskConfig(config: DanmakuMaskConfig): void;
  /** 获取防挡遮罩配置 */
  getMaskConfig(): DanmakuMaskConfig | undefined;
  /** 启用防挡功能 */
  enableMask(maskImage: string, videoRect?: { x: number; y: number; width: number; height: number }): void;
  /** 禁用防挡功能 */
  disableMask(): void;
  /** 设置底部安全区域 */
  setBottomSafeArea(height: number): void;

  // 屏幕模式
  /** 切换屏幕模式 */
  switchScreenMode(mode: 'fullscreen' | 'normal'): void;
  /** 切换全屏 */
  toggleFullscreen(): void;

  // 获取信息
  /** 获取弹幕数量 */
  getDanmakuCount(): number;
  /** 获取性能统计 */
  getPerformanceStats(): PerformanceStats;
  /** 获取轨道信息 */
  getTrackInfo(): {
    count: number;
    height: number;
    screenMode: ScreenMode;
    containerWidth: number;
    containerHeight: number;
  };
  /** 获取统计信息 */
  getStats(): {
    renderMode: RenderMode;
    screenMode: ScreenMode;
    isPlaying: boolean;
    performance: PerformanceStats;
  };

  // 事件绑定
  on<K extends keyof DanmakuEvents>(event: K, handler: DanmakuEvents[K]): void;
  /** 设置弹幕悬停回调 */
  setOnDanmakuHover(
    callback: (
      danmaku: DanmakuItem | null,
      position: { x: number; y: number } | null
    ) => void
  ): void;
}
