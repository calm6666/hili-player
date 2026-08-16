/**
 * ============================================
 * 弹幕类型定义
 * ============================================
 * 合并 player 和 plugin 的弹幕类型，纯类型定义，零运行时依赖
 * player 和 plugins 包均从此导入
 *
 * @module types/danmaku
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
  /** 发送者UID */
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

/** 弹幕渲染项 — 运行时渲染状态 */
export interface DanmakuRenderItem {
  /** 渲染ID */
  renderId: string;
  /** 原始弹幕数据 */
  item: DanmakuItem;
  /** 轨道索引 */
  trackIndex: number;
  /** 开始渲染时间戳 */
  startTime: number;
  /** 持续时间 (毫秒) */
  duration: number;
  /** DOM 元素 (DOM 模式) */
  element?: HTMLElement;
}

/** 弹幕分段 — 增量加载用 */
export interface DanmakuSegment {
  /** 分段索引 */
  index: number;
  /** 开始时间 (秒) */
  startTime: number;
  /** 结束时间 (秒) */
  endTime: number;
  /** 是否已加载 */
  loaded: boolean;
  /** 弹幕列表 */
  danmakuList: DanmakuItem[];
}

/** 性能统计 */
export interface PerformanceStats {
  /** FPS */
  fps: number;
  /** 渲染弹幕数 */
  renderCount: number;
  /** 对象池使用率 */
  poolUsage?: number;
  /** 内存使用 (MB) */
  memoryUsage?: number;
  /** 平均渲染时间 (ms) */
  avgRenderTime?: number;
}
