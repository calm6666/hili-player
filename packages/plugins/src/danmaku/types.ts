/**
 * 弹幕插件类型定义
 * 与 src/utils/danmaku 保持一致
 */

/** 弹幕类型 */
export enum DanmakuType {
  /** 滚动弹幕 */
  SCROLL = 1,
  /** 顶部固定 */
  TOP = 2,
  /** 底部固定 */
  BOTTOM = 3,
  /** 高级弹幕 */
  ADVANCED = 4,
}

/** 弹幕速度档位 - 5档 */
export enum DanmakuSpeed {
  /** 极慢 - 0.5倍速 */
  VERY_SLOW = 1,
  /** 较慢 - 0.75倍速 */
  SLOW = 2,
  /** 适中 - 1.0倍速（默认） */
  NORMAL = 3,
  /** 较快 - 1.5倍速 */
  FAST = 4,
  /** 极快 - 2.0倍速 */
  VERY_FAST = 5,
}

/** 弹幕字号档位 */
export enum DanmakuFontSize {
  /** 小字号 */
  SMALL = 0.8,
  /** 标准字号（默认） */
  NORMAL = 1.0,
}

/** 弹幕区域档位 - 4档 */
export enum DanmakuArea {
  /** 25% - 仅顶部区域 */
  QUARTER = 0.25,
  /** 50% - 上半区域 */
  HALF = 0.5,
  /** 75% - 大部分区域 */
  THREE_QUARTERS = 0.75,
  /** 100% - 全屏 */
  FULL = 1,
}

/** 渲染模式 */
export enum RenderMode {
  /** DOM渲染 - 适合少量弹幕 */
  DOM = 'dom',
  /** Canvas渲染 - 适合大量弹幕 */
  CANVAS = 'canvas',
  /** 自动模式 - 根据弹幕数量自动切换 */
  AUTO = 'auto',
}

/** 屏幕状态 */
export enum ScreenMode {
  /** 正常模式 */
  NORMAL = 'normal',
  /** 全屏模式 */
  FULLSCREEN = 'fullscreen',
  /** 网页全屏 */
  WEB_FULLSCREEN = 'webFullscreen',
}

/** 弹幕过滤器设置 */
export interface DanmakuFilter {
  /** 过滤滚动弹幕 */
  scroll?: boolean;
  /** 过滤固定弹幕（顶部+底部） */
  fixed?: boolean;
  /** 过滤彩色弹幕（非白色） */
  colorful?: boolean;
}

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

/** 单条弹幕数据结构 */
export interface DanmakuItem {
  /** 唯一ID */
  id: string | number;
  /** 弹幕内容 */
  text: string;
  /** 出现时间 (秒) */
  time: number;
  /** 弹幕类型 */
  type: DanmakuType;
  /** 字体大小 */
  fontSize?: number;
  /** 字体颜色 */
  color?: string;
  /** 发送者ID */
  userId?: string;
  /** 发送者名称 */
  userName?: string;
  /** 是否会员 */
  isVip?: boolean;
  /** 弹幕权重 (用于优先级) */
  weight?: number;
  /** 弹幕速度档位 */
  speed?: DanmakuSpeed;
  /** 发送者UID (用于标识本人发布的弹幕) */
  uid?: string | number;
}

/** 弹幕配置选项 */
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
