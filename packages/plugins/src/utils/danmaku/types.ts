/**
 * 高性能弹幕系统 - 类型定义
 * High Performance Danmaku System - Type Definitions
 */

/// <reference lib="dom" />

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

/** 弹幕过滤器设置 */
export interface DanmakuFilter {
  /** 过滤滚动弹幕 */
  scroll?: boolean;
  /** 过滤固定弹幕（顶部+底部） */
  fixed?: boolean;
  /** 过滤彩色弹幕（非白色） */
  colorful?: boolean;
}

/** 弹幕位置 */
export enum DanmakuPosition {
  /** 滚动 */
  SCROLL = 'scroll',
  /** 顶部 */
  TOP = 'top',
  /** 底部 */
  BOTTOM = 'bottom',
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

/** 弹幕分段数据 */
export interface DanmakuSegment {
  /** 分段索引 */
  index: number;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 弹幕列表 */
  danmakuList: DanmakuItem[];
  /** 是否已加载 */
  loaded: boolean;
}

/** 弹幕轨道 */
export interface DanmakuTrack {
  /** 轨道ID */
  id: number;
  /** 轨道索引 */
  index: number;
  /** 轨道高度 */
  height: number;
  /** 轨道Y坐标 */
  y: number;
  /** 当前轨道上的弹幕 */
  items: Set<DanmakuRenderItem>;
  /** 最后一条弹幕的结束位置 */
  lastItemEndX: number;
  /** 最后一条弹幕的结束时间 */
  lastItemEndTime: number;
}

/** 渲染中的弹幕项 */
export interface DanmakuRenderItem extends DanmakuItem {
  /** 渲染ID */
  renderId: string;
  /** 当前X坐标 */
  x: number;
  /** 当前Y坐标 */
  y: number;
  /** 弹幕宽度 */
  width: number;
  /** 弹幕高度 */
  height: number;
  /** 移动速度 (像素/毫秒) */
  speed: number;
  /** 所在轨道 */
  trackIndex: number;
  /** 是否正在渲染 */
  isRendering: boolean;
  /** 创建时间 */
  createTime: number;
  /** DOM元素引用 */
  element?: HTMLElement;
  /** 动画持续时间 */
  duration: number;
  /** 滚动距离（创建时计算，用于位置更新） */
  scrollDistance?: number;
  /** 动画结束处理方法 */
  animationEndHandler?: () => void;
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
  /** 字体大小 */
  fontSize?: number;
  /** 是否自动随屏幕大小缩放弹幕 (默认true) */
  autoScale?: boolean;
  /** 是否显示弹幕 */
  visible?: boolean;
  /** 弹幕密度 (0-1) */
  density?: number;
  /** 是否防遮挡 */
  preventOverlap?: boolean;
  /** 轨道高度 */
  trackHeight?: number;
  /** 分段时长 (秒) */
  segmentDuration?: number;
  /** 预加载分段数 */
  preloadSegments?: number;
  /** 最大同时渲染弹幕数 */
  maxRenderCount?: number;
  /** 是否开启硬件加速 */
  hardwareAcceleration?: boolean;
  /** 是否显示高级弹幕 */
  showAdvanced?: boolean;
  /** 是否合并相同弹幕 */
  mergeSame?: boolean;
  /** 弹幕过滤器 */
  filter?: DanmakuFilter;
}

/** 弹幕管理器状态 */
export interface DanmakuState {
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 当前时间 */
  currentTime: number;
  /** 屏幕模式 */
  screenMode: ScreenMode;
  /** 容器宽度 */
  containerWidth: number;
  /** 容器高度 */
  containerHeight: number;
  /** 当前渲染的弹幕数量 */
  renderCount: number;
  /** 当前激活的分段 */
  activeSegments: Set<number>;
}

/** 性能统计 */
export interface PerformanceStats {
  /** FPS */
  fps: number;
  /** 渲染弹幕数 */
  renderCount: number;
  /** 对象池使用率 */
  poolUsage: number;
  /** 内存使用 (MB) */
  memoryUsage: number;
  /** 平均渲染时间 (ms) */
  avgRenderTime: number;
}

/** 弹幕事件 */
export interface DanmakuEvents {
  /** 弹幕点击 */
  onClick?: (item: DanmakuItem) => void;
  /** 弹幕进入 */
  onEnter?: (item: DanmakuRenderItem) => void;
  /** 弹幕离开 */
  onLeave?: (item: DanmakuRenderItem) => void;
  /** 性能警告 */
  onPerformanceWarning?: (stats: PerformanceStats) => void;
}

/** 轨道配置 */
export interface TrackConfig {
  /** 轨道数量 */
  count: number;
  /** 轨道高度 */
  height: number;
  /** 轨道间距 */
  gap: number;
  /** 顶部边距 */
  topMargin: number;
  /** 底部边距 */
  bottomMargin: number;
}

/** 防挡遮罩配置 */
export interface DanmakuMaskConfig {
  /** 是否启用防挡 */
  enabled?: boolean;
  /** 遮罩图片URL（镂空PNG） */
  maskImage?: string;
  /** 遮罩图片元素 */
  maskImageElement?: HTMLImageElement;
  /** 视频在容器中的位置（用于对齐遮罩） */
  videoRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 遮罩获取函数（用户自定义实现，可以是后端请求） */
  maskLoader?: MaskLoader;
  /** 遮罩更新间隔（毫秒），默认1000ms */
  updateInterval?: number;
  /** 获取当前视频时间的回调函数 */
  getCurrentTime?: () => number;
}

/** 遮罩获取函数类型
 * 返回 null 表示该时间没有遮罩，不设置遮罩
 * 遮罩图片应该与视频比例一致，使用 CSS object-fit: contain 自适应居中
 */
export type MaskLoader = (currentTime: number) => Promise<MaskLoaderResult | null>;

/** 遮罩获取结果 */
export interface MaskLoaderResult {
  /** 遮罩图片URL（镂空PNG） */
  maskImage: string;
  /** 可选：遮罩图片元素（如果已预加载） */
  maskImageElement?: HTMLImageElement;
  /** 遮罩图片的原始宽度（用于比例计算） */
  originalWidth?: number;
  /** 遮罩图片的原始高度（用于比例计算） */
  originalHeight?: number;
}
