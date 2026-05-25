/**
 * 高性能弹幕系统 - DOM渲染引擎
 * 使用CSS3动画渲染弹幕，适合中少量弹幕场景
 */

import {
  DanmakuType,
  ScreenMode,
  DanmakuSpeed,
  DanmakuArea,
  type DanmakuItem,
  type DanmakuRenderItem,
  type DanmakuFilter,
  type DanmakuMaskConfig,
} from './types';
import { DOMElementPool, DanmakuItemPool } from './objectPool';
import { TrackManager } from './trackManager';
import { rafTimeout, cancelRaf, createLogger } from '@/utils';
import { calculateFontSize } from './scaleHelper';
const logger = createLogger('DOMEngine');

/** DOM引擎配置 */
interface DOMEngineConfig {
  /** 字体 */
  fontFamily: string;
  /** 基础字体大小 */
  baseFontSize: number;
  /** 字体大小缩放 */
  fontSizeScale: number;
  /** 透明度 */
  opacity: number;
  /** 速度档位 */
  speed: DanmakuSpeed;
  /** 区域档位 */
  area: DanmakuArea;
  /** 是否使用CSS动画 */
  useCSSAnimation: boolean;
  /** 是否使用Transform */
  useTransform: boolean;
  /** 是否开启硬件加速 */
  hardwareAcceleration: boolean;
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

export class DOMEngine {
  private container: HTMLElement;
  private danmakuLayer: HTMLElement;
  private config: DOMEngineConfig;
  private elementPool: DOMElementPool;
  private itemPool: DanmakuItemPool;
  private trackManager: TrackManager;

  // 渲染状态
  private renderItems: Map<string, DanmakuRenderItem> = new Map();
  private isPlaying = false;
  private isPaused = false; // 视频暂停状态
  private animationId: number | null = null;
  private lastFrameTime = 0;

  // 尺寸
  private width = 0;
  private height = 0;

  // 鼠标悬停回调
  private onDanmakuHover:
    | ((danmaku: DanmakuRenderItem | null, position: { x: number; y: number } | null) => void)
    | null = null;

  // 防挡遮罩
  private maskImage: HTMLImageElement | null = null;
  private maskUpdateTimer: { id: number } | null = null;

  // 缓存遮罩计算参数
  private lastMaskParams: {
    containerWidth: number;
    containerHeight: number;
    videoRatio: number;
    gradient1: string;
    gradient2: string;
  } | null = null;

  constructor(
    container: HTMLElement,
    elementPool: DOMElementPool,
    itemPool: DanmakuItemPool,
    trackManager: TrackManager,
    config: Partial<DOMEngineConfig> = {}
  ) {
    this.container = container;
    this.elementPool = elementPool;
    this.itemPool = itemPool;
    this.trackManager = trackManager;
    this.config = {
      fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
      baseFontSize: 18,
      fontSizeScale: 1,
      opacity: 1,
      speed: DanmakuSpeed.NORMAL,
      area: DanmakuArea.FULL,
      useCSSAnimation: true,
      useTransform: true,
      hardwareAcceleration: true,
      filter: {},
      autoScale: true,
      ...config,
    };

    // 创建弹幕层
    this.danmakuLayer = document.createElement('div');
    this.danmakuLayer.className = 'danmaku-layer dom-engine';
    this.danmakuLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    `;

    container.appendChild(this.danmakuLayer);

    // 添加B站风格的CSS动画样式
    this.injectCSSStyles();

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
   */
  private loadMaskImage(url: string): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.maskImage = img;
      this.applyMask();
    };
    img.onerror = () => {
      // 静默处理错误
    };
    img.src = url;
  }

  /**
   * 应用防挡遮罩
   * 使用 CSS mask-size: contain 和 mask-position: center 实现自适应居中
   * 遮罩图片比例应与视频比例一致
   *
   * 蒙层图片格式：
   * - 黑色 = 背景，显示弹幕
   * - 透明/镂空 = 人物，不显示弹幕
   *
   * 哔哩哔哩实现方案：
   * 使用多层 mask 组合，参考 B站真实代码：
   * - 第1层：左边渐变（黑色到透明）
   * - 第2层：右边渐变（透明到黑色）
   * - 第3层：蒙层图片
   * - composite: source-over：多层叠加
   *
   * 结果：
   * - 蒙层图片黑色区域：显示弹幕
   * - 蒙层图片透明区域：不显示弹幕
   * - 蒙层图片外区域（两边/上下）：显示弹幕
   */
  private applyMask(): void {
    if (!this.maskImage || !this.config.maskConfig?.enabled) {
      this.danmakuLayer.style.maskImage = '';
      this.danmakuLayer.style.webkitMaskImage = '';
      return;
    }

    // 获取容器尺寸
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;

    // 获取视频比例（从 videoRect 传入，默认 16:9）
    const videoRatio =
      this.config.maskConfig?.videoRect?.width && this.config.maskConfig?.videoRect?.height
        ? this.config.maskConfig.videoRect.width / this.config.maskConfig.videoRect.height
        : 16 / 9;

    // 检查缓存：如果参数没有变化，直接应用蒙层图片
    if (
      this.lastMaskParams &&
      this.lastMaskParams.containerWidth === containerWidth &&
      this.lastMaskParams.containerHeight === containerHeight &&
      this.lastMaskParams.videoRatio === videoRatio
    ) {
      // 只更新蒙层图片 URL
      const maskLayer = `url(${this.maskImage.src})`;
      this.danmakuLayer.style.maskImage = `${this.lastMaskParams.gradient1}, ${this.lastMaskParams.gradient2}, ${maskLayer}`;
      this.danmakuLayer.style.webkitMaskImage = `${this.lastMaskParams.gradient1}, ${this.lastMaskParams.gradient2}, ${maskLayer}`;
      return;
    }

    // 计算容器比例
    const containerRatio = containerWidth / containerHeight;

    let gradient1: string;
    let gradient2: string;

    // 渐变扩展量（百分比），用于确保完全覆盖留白区域
    const gradientExtend = 2;

    if (containerRatio > videoRatio) {
      // 容器比视频宽 → 视频按高度撑满 → 左右留白（黑边在左右）
      // 计算视频在容器中的宽度和左右留白
      const scaledWidth = containerHeight * videoRatio;
      const offsetX = (containerWidth - scaledWidth) / 2;

      // 计算左右留白百分比（稍微增大确保覆盖）
      const leftPercent = Math.max(0, (offsetX / containerWidth) * 100 + gradientExtend);
      const rightStartPercent = Math.min(
        100,
        ((offsetX + scaledWidth) / containerWidth) * 100 - gradientExtend
      );

      // 第1层：左边渐变填充（黑色显示弹幕）
      gradient1 = `linear-gradient(to right, rgb(0,0,0), rgb(0,0,0) ${leftPercent.toFixed(2)}%, rgba(0,0,0,0) ${leftPercent.toFixed(2)}%)`;

      // 第2层：右边渐变填充（黑色显示弹幕）
      gradient2 = `linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0) ${rightStartPercent.toFixed(2)}%, rgb(0,0,0) ${rightStartPercent.toFixed(2)}%)`;
    } else {
      // 容器比视频窄 → 视频按宽度撑满 → 上下留白（黑边在上下）
      // 计算视频在容器中的高度和上下留白
      const scaledHeight = containerWidth / videoRatio;
      const offsetY = (containerHeight - scaledHeight) / 2;

      // 计算上下留白百分比（稍微增大确保覆盖）
      const topPercent = Math.max(0, (offsetY / containerHeight) * 100 + gradientExtend);
      const bottomStartPercent = Math.min(
        100,
        ((offsetY + scaledHeight) / containerHeight) * 100 - gradientExtend
      );

      // 第1层：上边渐变填充（黑色显示弹幕）
      gradient1 = `linear-gradient(to bottom, rgb(0,0,0), rgb(0,0,0) ${topPercent.toFixed(2)}%, rgba(0,0,0,0) ${topPercent.toFixed(2)}%)`;

      // 第2层：下边渐变填充（黑色显示弹幕）
      gradient2 = `linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0) ${bottomStartPercent.toFixed(2)}%, rgb(0,0,0) ${bottomStartPercent.toFixed(2)}%)`;
    }

    // 缓存计算结果
    this.lastMaskParams = {
      containerWidth,
      containerHeight,
      videoRatio,
      gradient1,
      gradient2,
    };

    // 第3层：蒙层图片（contain 模式居中）
    const maskLayer = `url(${this.maskImage.src})`;

    this.danmakuLayer.style.maskImage = `${gradient1}, ${gradient2}, ${maskLayer}`;
    this.danmakuLayer.style.webkitMaskImage = `${gradient1}, ${gradient2}, ${maskLayer}`;

    // 渐变层覆盖整个容器，蒙层图片居中 contain
    this.danmakuLayer.style.maskSize = '100% 100%, 100% 100%, contain';
    this.danmakuLayer.style.webkitMaskSize = '100% 100%, 100% 100%, contain';

    // 渐变层从左上角开始，蒙层图片居中
    this.danmakuLayer.style.maskPosition = '0 0, 0 0, center';
    this.danmakuLayer.style.webkitMaskPosition = '0 0, 0 0, center';

    this.danmakuLayer.style.maskRepeat = 'no-repeat, no-repeat, no-repeat';
    this.danmakuLayer.style.webkitMaskRepeat = 'no-repeat, no-repeat, no-repeat';

    // 使用 source-over 让多层叠加
    // 只要有任意一层是不透明的（黑色），就显示弹幕
    this.danmakuLayer.style.maskComposite = 'source-over, source-over';
    this.danmakuLayer.style.webkitMaskComposite = 'source-over, source-over';
  }

  /**
   * 注入CSS样式 - B站风格弹幕动画
   */
  private injectCSSStyles(): void {
    const styleId = 'danmaku-bilibili-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* 滚动弹幕 - B站风格 */
      .danmaku-x-roll {
        position: absolute;
        top: var(--top, 0);
        left: var(--offset, 100%);
        white-space: nowrap;
        will-change: transform;
        animation: danmaku-roll var(--duration, 8s) linear forwards;
        animation-delay: var(--animation-delay, 0s);
        pointer-events: auto;
      }

      @keyframes danmaku-roll {
        from {
          transform: translate3d(0, 0, 0);
        }
        to {
          transform: translate3d(var(--translateX, -100%), 0, 0);
        }
      }

      /* 固定弹幕（顶部/底部） */
      .danmaku-x-fixed {
        position: absolute;
        top: var(--top, 0);
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        animation: danmaku-fade var(--duration, 4s) ease-in-out forwards;
        animation-delay: var(--animation-delay, 0s);
        pointer-events: auto;
      }

      @keyframes danmaku-fade {
        0% {
          opacity: 0;
          transform: translateX(-50%) scale(0.8);
        }
        10% {
          opacity: 1;
          transform: translateX(-50%) scale(1);
        }
        90% {
          opacity: 1;
          transform: translateX(-50%) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateX(-50%) scale(0.9);
        }
      }

      /* 弹幕悬停效果 */
      .danmaku-x-roll:hover,
      .danmaku-x-fixed:hover {
        z-index: 1000;
        opacity: 1 !important;
      }

      /* 父容器暂停时，所有子弹幕动画暂停 */
      .danmaku-layer.is-paused .danmaku-x-roll,
      .danmaku-layer.is-paused .danmaku-x-fixed {
        animation-play-state: paused !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 调整尺寸
   */
  resize(): void {
    const rect = this.container.getBoundingClientRect();

    // 如果尺寸没有变化，跳过
    if (rect.width === this.width && rect.height === this.height) {
      return;
    }

    this.width = rect.width;
    this.height = rect.height;

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

    // 尺寸变化时清除遮罩缓存，重新计算渐变
    if (this.lastMaskParams) {
      this.lastMaskParams = null;
      this.applyMask();
    }

    // 注意：不处理已存在弹幕的位置，避免全屏切换时性能问题
    // 已存在的弹幕会继续按原来的位置和速度移动，新的弹幕会使用新的尺寸
  }

  /**
   * 添加弹幕
   * @param item 弹幕数据
   * @param currentTime 当前时间（performance.now()）
   * @param videoTime 视频当前时间（秒），用于快进后恢复显示
   * @returns 是否成功添加
   */
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

  addDanmaku(item: DanmakuItem, currentTime: number, videoTime?: number): boolean {
    // 检查是否被过滤
    if (this.isFiltered(item)) {
      return false;
    }

    // 获取元素
    const element = this.elementPool.acquire();

    // 设置内容
    element.textContent = item.text;

    // 计算字体大小
    const fontSize = (item.fontSize || this.config.baseFontSize) * this.config.fontSizeScale;

    // 设置样式
    const color = item.color || '#ffffff';
    // 判断是否为自己发布的弹幕（uid为1表示本人），添加白色边框
    const isSelf = item.uid === 1 || item.uid === '1';
    element.style.cssText = `
      position: absolute;
      white-space: nowrap;
      font-family: ${this.config.fontFamily};
      font-size: ${fontSize}px;
      font-weight: bold;
      color: ${color};
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      opacity: ${this.config.opacity};
      pointer-events: auto;
      cursor: pointer;
      line-height: 1;
      ${this.config.hardwareAcceleration ? 'will-change: transform;' : ''}
      ${this.config.hardwareAcceleration ? 'transform: translateZ(0);' : ''}
      ${this.config.hardwareAcceleration ? 'backface-visibility: hidden;' : ''}
      ${isSelf ? 'border: 2px solid #ffffff !important; border-radius: 4px; padding: 2px 6px; box-sizing: border-box;' : ''}
    `;

    // 添加到DOM以测量尺寸
    this.danmakuLayer.appendChild(element);
    const rect = element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // 计算动画持续时间
    // 滚动弹幕：根据距离和速度计算，确保完全移出屏幕
    const distance = item.type === DanmakuType.SCROLL ? this.width + width : 0;
    const baseSpeed = 150; // 基础速度：150px/秒
    // 应用速度档位倍率：优先使用弹幕数据中的speed，否则使用当前配置的速度档位
    const speedToUse = item.speed !== undefined ? item.speed : this.config.speed;
    const speedMultiplier = SPEED_MULTIPLIERS[speedToUse];
    const adjustedSpeed = baseSpeed * speedMultiplier;
    const scrollDuration = item.type === DanmakuType.SCROLL ? (distance / adjustedSpeed) * 1000 : 0;
    // 固定弹幕显示4秒
    const fixedDuration = 4000;
    const duration = item.type === DanmakuType.SCROLL ? scrollDuration : fixedDuration;

    // 创建渲染项
    const renderItem = this.itemPool.acquire({
      ...item,
      x: this.width,
      y: 0,
      width,
      height,
      speed: item.type === DanmakuType.SCROLL ? distance / (duration / 1000) : 0,
      duration,
      element,
      isRendering: true,
    });

    if (!renderItem) {
      this.elementPool.release(element);
      element.remove();
      return false;
    }

    // 获取可用轨道
    const trackIndex = this.trackManager.getAvailableTrack(renderItem, currentTime);
    if (trackIndex === -1) {
      this.elementPool.release(element);
      element.remove();
      this.itemPool.release(renderItem.renderId);
      return false;
    }

    // 添加到轨道（这会设置 renderItem.y）
    this.trackManager.addToTrack(trackIndex, renderItem);

    // 计算弹幕已经经过的时间（用于快进后恢复显示）
    let elapsedTime = 0;
    if (videoTime !== undefined && item.type === DanmakuType.SCROLL) {
      elapsedTime = Math.max(0, (videoTime - item.time) * 1000); // 转换为毫秒
      if (elapsedTime > 0 && elapsedTime < duration) {
        // 快进后的弹幕，调整 createTime 以反映已经经过的时间
        renderItem.createTime = currentTime - elapsedTime;
      }
    }

    // 设置初始位置
    if (item.type === DanmakuType.SCROLL) {
      // 如果有经过时间，计算当前位置；否则从右侧进入
      if (elapsedTime > 0 && elapsedTime < duration) {
        const progress = elapsedTime / duration;
        renderItem.x = this.width - distance * progress;
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
    // 注意：renderItem.y 已经在 addToTrack 中设置，不要重置为0

    // 应用固定弹幕样式（必须在CSS动画之前）
    this.applyFixedDanmakuStyle(renderItem);

    // 添加CSS动画或JS动画（二选一，不要同时用）
    if (this.config.useCSSAnimation) {
      if (item.type === DanmakuType.SCROLL) {
        // CSS动画会处理位置，不需要调用 updateElementPosition
        this.applyCSSAnimation(renderItem);
      } else {
        // 固定弹幕使用淡入淡出动画
        this.applyFixedCSSAnimation(renderItem);
      }
    } else {
      // 不使用CSS动画时，手动设置位置
      this.updateElementPosition(renderItem);
    }

    // 绑定事件
    this.bindEvents(renderItem);

    // 保存渲染项
    this.renderItems.set(renderItem.renderId, renderItem);

    return true;
  }

  /**
   * 批量添加弹幕
   * @param items 弹幕列表
   * @param currentTime 当前时间（performance.now()）
   * @param videoTime 视频当前时间（秒）
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
   * 应用CSS动画 - B站风格：使用CSS变量控制
   * @param item 弹幕项
   */
  private applyCSSAnimation(item: DanmakuRenderItem): void {
    if (!item.element) return;

    const { width, duration, y } = item;
    const distance = this.width + width;

    // 使用CSS变量控制动画，类似B站实现
    item.element.style.setProperty('--offset', `${this.width}px`);
    item.element.style.setProperty('--translateX', `-${distance}px`);
    item.element.style.setProperty('--duration', `${duration / 1000}s`);
    item.element.style.setProperty('--top', `${y}px`);

    // 添加CSS类来触发动画
    item.element.classList.add('danmaku-x-roll');

    // 使用CSS animation-delay来控制动画进度（负值表示已经进行了一段时间）
    item.element.style.animationDelay = '0s';

    // 监听动画结束
    const onAnimationEnd = () => {
      this.removeDanmaku(item.renderId);
    };
    item.element.addEventListener('animationend', onAnimationEnd);
    item.animationEndHandler = onAnimationEnd;
  }

  /**
   * 应用固定弹幕样式
   * @param item 弹幕项
   */
  private applyFixedDanmakuStyle(item: DanmakuRenderItem): void {
    if (!item.element || item.type === DanmakuType.SCROLL) return;

    // 固定弹幕添加文字阴影增强可读性，不添加背景色和边框
    item.element.style.cssText += `
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.8);
      padding: 2px 8px;
    `;
  }

  /**
   * 应用固定弹幕CSS动画（淡入淡出）- B站风格
   * @param item 弹幕项
   */
  private applyFixedCSSAnimation(item: DanmakuRenderItem): void {
    if (!item.element) return;

    const { duration, y } = item;

    // 使用CSS变量控制动画 - B站风格
    item.element.style.setProperty('--duration', `${duration / 1000}s`);
    item.element.style.setProperty('--top', `${y}px`);

    // 添加CSS类来触发动画
    item.element.classList.add('danmaku-x-fixed');

    // 使用CSS animation-delay来控制动画进度
    item.element.style.animationDelay = '0s';

    // 监听动画结束
    const onAnimationEnd = () => {
      this.removeDanmaku(item.renderId);
    };
    item.element.addEventListener('animationend', onAnimationEnd);
    item.animationEndHandler = onAnimationEnd;
  }

  /**
   * 更新元素位置
   * @param item 弹幕项
   */
  private updateElementPosition(item: DanmakuRenderItem): void {
    if (!item.element) return;

    if (this.config.useTransform) {
      item.element.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
    } else {
      item.element.style.left = `${item.x}px`;
      item.element.style.top = `${item.y}px`;
    }
  }

  /**
   * 绑定事件
   * @param item 弹幕项
   */
  private bindEvents(item: DanmakuRenderItem): void {
    if (!item.element) return;

    // 存储自动恢复定时器
    let autoResumeTimer: { id: number } | null = null;

    item.element.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    item.element.addEventListener('mouseenter', () => {
      if (!item.element) return;

      // 清除之前的定时器
      if (autoResumeTimer) {
        cancelRaf(autoResumeTimer);
        autoResumeTimer = null;
      }

      // 提升层级和透明度
      item.element.style.zIndex = '1000';
      item.element.style.opacity = '1';

      // 暂停该弹幕动画
      const animations = item.element.getAnimations();
      animations.forEach((anim) => anim.pause());

      // 调用悬停回调 - 使用相对于容器的位置
      if (this.onDanmakuHover) {
        const containerRect = this.container.getBoundingClientRect();
        const rect = item.element.getBoundingClientRect();
        this.onDanmakuHover(item, {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.bottom - containerRect.top,
        });
      }

      // 3秒后自动恢复
      autoResumeTimer = rafTimeout(() => {
        if (item.element) {
          const animations = item.element.getAnimations();
          animations.forEach((anim) => anim.play());
          item.element.style.zIndex = '';
          item.element.style.opacity = `${this.config.opacity}`;
        }
        // 调用离开回调
        if (this.onDanmakuHover) {
          this.onDanmakuHover(null, null);
        }
      }, 3000);
    });

    item.element.addEventListener('mouseleave', () => {
      if (!item.element) return;

      // 清除自动恢复定时器
      if (autoResumeTimer) {
        cancelRaf(autoResumeTimer);
        autoResumeTimer = null;
      }

      // 恢复层级和透明度
      item.element.style.zIndex = '';
      item.element.style.opacity = `${this.config.opacity}`;

      // 恢复该弹幕动画
      const animations = item.element.getAnimations();
      animations.forEach((anim) => anim.play());

      // 调用离开回调
      if (this.onDanmakuHover) {
        this.onDanmakuHover(null, null);
      }
    });
  }

  /**
   * 开始渲染
   */
  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();

    // 如果不使用CSS动画，使用JS动画循环
    if (!this.config.useCSSAnimation) {
      this.renderLoop();
    }
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
   * 暂停所有弹幕动画（视频暂停时调用）
   */
  pauseAnimations(): void {
    // 设置暂停标志，停止JS动画更新
    this.isPaused = true;
    // 添加暂停类名到容器，CSS会自动暂停所有子弹幕动画
    this.danmakuLayer.classList.add('is-paused');
  }

  /**
   * 恢复所有弹幕动画（视频播放时调用）
   */
  resumeAnimations(): void {
    // 清除暂停标志，恢复JS动画更新
    this.isPaused = false;
    // 移除暂停类名，CSS会自动恢复所有子弹幕动画
    this.danmakuLayer.classList.remove('is-paused');
    // 重置lastFrameTime以避免deltaTime累积导致跳变
    this.lastFrameTime = performance.now();
  }

  /**
   * 渲染循环 (用于JS动画)
   */
  private renderLoop = (): void => {
    if (!this.isPlaying) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // 如果视频暂停，不更新位置
    if (!this.isPaused) {
      this.update(deltaTime, currentTime);
    }

    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * 更新弹幕位置
   * @param _deltaTime 时间差（保留参数以兼容接口，当前未使用）
   * @param currentTime 当前时间
   */
  private update(_deltaTime: number, currentTime: number): void {
    const itemsToRemove: string[] = [];

    for (const [id, item] of this.renderItems) {
      if (!item.isRendering) {
        itemsToRemove.push(id);
        continue;
      }

      // 滚动弹幕更新位置（仅在不使用CSS动画时）
      if (item.type === DanmakuType.SCROLL && !this.config.useCSSAnimation) {
        const elapsedTime = currentTime - item.createTime;

        if (elapsedTime >= item.duration) {
          item.isRendering = false;
          itemsToRemove.push(id);
          continue;
        }

        const progress = elapsedTime / item.duration;
        item.x = this.width - (this.width + item.width) * progress;
        this.updateElementPosition(item);
      }
    }

    // 移除已结束的弹幕
    for (const id of itemsToRemove) {
      this.removeDanmaku(id);
    }

    // 清理轨道
    this.trackManager.cleanupFinishedItems(currentTime);
  }

  /**
   * 移除弹幕
   * @param renderId 渲染ID
   */
  removeDanmaku(renderId: string): void {
    const item = this.renderItems.get(renderId);
    if (item) {
      // 从轨道移除
      this.trackManager.removeFromTrack(item);

      // 回收元素
      if (item.element) {
        // 移除动画结束监听器
        const animationEndHandler = item.animationEndHandler;
        if (animationEndHandler) {
          item.element.removeEventListener('animationend', animationEndHandler);
        }
        this.elementPool.release(item.element);
        item.element.remove();
      }

      // 回收渲染项
      this.itemPool.release(renderId);

      // 从映射中移除
      this.renderItems.delete(renderId);
    }
  }

  /**
   * 清空弹幕
   */
  clear(): void {
    // 停止动画
    this.stop();

    // 移除所有弹幕
    for (const [id, item] of this.renderItems) {
      if (item.element) {
        this.elementPool.release(item.element);
        item.element.remove();
      }
      this.itemPool.release(id);
    }
    this.renderItems.clear();

    // 重置轨道
    this.trackManager.reset();
  }

  /**
   * 更新弹幕位置（用于小幅度seek）- B站风格：使用animation-delay调整动画进度
   * @param timeDiff 时间差（秒），正数表示快进，负数表示后退
   */
  updateDanmakuPositionsForSeek(timeDiff: number): void {
    const timeDiffSec = timeDiff; // 秒

    for (const item of this.renderItems.values()) {
      if (!item.isRendering || !item.element) continue;

      if (item.type === DanmakuType.SCROLL) {
        // 获取当前animation-delay（负值表示已经进行的时间）
        const currentDelay = parseFloat(item.element.style.animationDelay || '0');

        // 计算新的animation-delay
        // 快进：delay变得更负（表示已经过去更多时间）
        // 后退：delay变得不那么负（表示回退时间）
        let newDelay = currentDelay - timeDiffSec;

        // 如果新的delay超出动画持续时间，移除弹幕
        if (newDelay <= -item.duration / 1000) {
          this.removeDanmaku(item.renderId);
          continue;
        }

        // 如果delay大于0，说明回退到了动画开始前，重置为0
        if (newDelay > 0) {
          newDelay = 0;
        }

        // 应用新的animation-delay（B站风格）
        item.element.style.animationDelay = `${newDelay}s`;

        // 更新createTime以保持同步
        item.createTime = performance.now() + newDelay * 1000;

        // 更新x坐标以匹配新的动画位置
        const distance = this.width + item.width;
        const progress = Math.abs(newDelay) / (item.duration / 1000);
        item.x = this.width - distance * progress;
      } else if (item.type === DanmakuType.TOP || item.type === DanmakuType.BOTTOM) {
        // 固定弹幕：同样使用animation-delay调整
        const currentDelay = parseFloat(item.element.style.animationDelay || '0');
        const newDelay = currentDelay - timeDiffSec;

        if (newDelay <= -item.duration / 1000) {
          this.removeDanmaku(item.renderId);
        } else if (newDelay > 0) {
          item.element.style.animationDelay = '0s';
        } else {
          item.element.style.animationDelay = `${newDelay}s`;
        }
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
   * 切换屏幕模式
   * @param _mode 屏幕模式（已废弃，保留参数用于兼容性）
   */
  switchScreenMode(_mode: ScreenMode): void {
    // 只调整尺寸，不再切换轨道模式（现在只有一个统一的状态）
    this.resize();
  }

  /**
   * 更新配置
   * @param config 配置
   */
  updateConfig(config: Partial<DOMEngineConfig>): void {
    const oldArea = this.config.area;

    Object.assign(this.config, config);

    // 如果区域档位变化，重新初始化轨道
    if (config.area !== undefined && config.area !== oldArea) {
      this.trackManager.initTracks(this.width, this.height, config.area);
    }

    // 如果防挡配置变化，更新遮罩
    if (config.maskConfig !== undefined) {
      if (config.maskConfig.enabled && config.maskConfig.maskImage) {
        if (config.maskConfig.maskImageElement) {
          this.maskImage = config.maskConfig.maskImageElement;
          this.applyMask();
        } else if (config.maskConfig.maskImage !== this.maskImage?.src) {
          this.loadMaskImage(config.maskConfig.maskImage);
        } else {
          this.applyMask();
        }
      } else {
        this.maskImage = null;
        this.applyMask();
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
          this.applyMask();
        } else {
          this.loadMaskImage(config.maskImage);
        }
      }
    } else {
      this.maskImage = null;
      this.applyMask();
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
          this.applyMask();
        } else if (result.maskImage) {
          this.loadMaskImage(result.maskImage);
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
   * 获取渲染统计
   */
  getStats(): { renderCount: number; poolStats: ReturnType<DOMElementPool['getStats']> } {
    return {
      renderCount: this.renderItems.size,
      poolStats: this.elementPool.getStats(),
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
   * 绑定鼠标事件（带节流优化）
   */
  private bindMouseEvents(): void {
    // 当前悬停的弹幕
    let hoveredItem: DanmakuRenderItem | null = null;
    // 节流控制：50ms，既保证流畅又不会太频繁
    let lastMouseMoveTime = 0;
    const throttleMs = 50;

    this.danmakuLayer.addEventListener('mousemove', (e) => {
      const now = performance.now();
      // 节流：距离上次处理不足50ms则跳过
      if (now - lastMouseMoveTime < throttleMs) {
        return;
      }
      lastMouseMoveTime = now;

      const rect = this.danmakuLayer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 查找鼠标下的弹幕
      let foundItem: DanmakuRenderItem | null = null;

      for (const item of this.renderItems.values()) {
        if (!item.isRendering || !item.element) continue;

        // 获取元素实际位置（考虑CSS动画）
        const itemRect = item.element.getBoundingClientRect();
        const itemLeft = itemRect.left - rect.left;
        const itemRight = itemRect.right - rect.left;
        const itemTop = itemRect.top - rect.top;
        const itemBottom = itemRect.bottom - rect.top;

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
        // 恢复之前悬停的弹幕
        if (hoveredItem && hoveredItem.element) {
          this.resumeSingleAnimation(hoveredItem);
        }

        hoveredItem = foundItem;

        if (hoveredItem) {
          // 暂停当前悬停的弹幕
          this.pauseSingleAnimation(hoveredItem);

          // 获取元素实际位置（相对于容器）
          if (hoveredItem.element != null) {
            const containerRect = this.container.getBoundingClientRect();
            const itemRect = hoveredItem.element.getBoundingClientRect();
            const position = {
              x: itemRect.left - containerRect.left + itemRect.width / 2,
              y: itemRect.bottom - containerRect.top,
            };
            // 触发回调
            this.onDanmakuHover?.(hoveredItem, position);
          }
        } else {
          this.onDanmakuHover?.(null, null);
        }
      }
    });

    this.danmakuLayer.addEventListener('mouseleave', () => {
      if (hoveredItem && hoveredItem.element) {
        this.resumeSingleAnimation(hoveredItem);
      }
      hoveredItem = null;
      this.onDanmakuHover?.(null, null);
    });
  }

  /**
   * 暂停单条弹幕动画
   */
  private pauseSingleAnimation(item: DanmakuRenderItem): void {
    if (!item.element) return;

    // 暂停 CSS 动画
    item.element.style.animationPlayState = 'paused';

    // 暂停 Web Animations API 动画
    const animations = item.element.getAnimations();
    animations.forEach((anim) => anim.pause());
  }

  /**
   * 恢复单条弹幕动画
   */
  private resumeSingleAnimation(item: DanmakuRenderItem): void {
    if (!item.element) return;

    // 恢复 CSS 动画
    item.element.style.animationPlayState = 'running';

    // 恢复 Web Animations API 动画
    const animations = item.element.getAnimations();
    animations.forEach((anim) => anim.play());
  }

  /**
   * 销毁引擎
   */
  destroy(): void {
    this.stop();
    this.clear();
    this.danmakuLayer.remove();
  }
}
