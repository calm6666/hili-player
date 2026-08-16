/**
 * ============================================
 * 字幕插件 (SubtitlePlugin)
 * ============================================
 * 字幕功能插件，通过 PlayerEventEnum 事件实现跨组件通信
 * 在 MOUNTED 时查找 .player-subtitle-wrap 容器（不自行创建容器）
 * 使用 RAF (requestAnimationFrame) 驱动字幕更新循环
 * 使用二分查找进行字幕时间定位
 * 集成 @/utils/subtitle 解析器
 *
 * 使用方式：
 * import { SubtitlePlugin } from '@hili-player/plugins';
 *
 * plugins: [
 *   SubtitlePlugin({
 *     sources: [
 *       { src: 'subtitles/cn.srt', lang: 'zh', label: '中文' },
 *       { src: 'subtitles/en.srt', lang: 'en', label: 'English' }
 *     ]
 *   })
 * ]
 */

import type { Plugin, PluginOptions } from '@/types/plugin';
import type { SubtitleItem, ParsedSubtitle, SubtitleSource, SubtitleStyle } from '@/types/subtitle';

export type { SubtitleSource } from '@/types/subtitle';
import type { VideoPlayer } from '../../../player/src/player/VideoPlayer';
import type { PlayerEventBus } from '../../../player/src/core/plugin';
import { PlayerEventEnum } from '@/core/events';
import { parseSubtitle } from '@/utils/subtitle';
import { isBrowser } from '@/utils';

// ============================================
// 类型定义
// ============================================

/** 字幕插件配置 */
export interface SubtitlePluginConfig {
  /** 插件选项 */
  options?: PluginOptions;
  /** 字幕源列表 */
  sources?: SubtitleSource[];
  /** 默认语言 */
  defaultLang?: string;
  /** 是否可见 */
  visible?: boolean;
  /** 字体大小（px） */
  fontSize?: number;
  /** 字体颜色 */
  color?: string;
  /** 背景颜色 */
  backgroundColor?: string;
  /** 描边颜色 */
  strokeColor?: string;
  /** 描边宽度 */
  strokeWidth?: number;
  /** 位置：'bottom' | 'top' | 'middle' */
  position?: 'bottom' | 'top' | 'middle';
  /** 底部偏移（px） */
  bottomOffset?: number;
}

/** 字幕插件已解析配置 */
interface SubtitleResolvedConfig {
  sources: SubtitleSource[];
  defaultLang: string;
  visible: boolean;
  fontSize: number;
  color: string;
  backgroundColor: string;
  strokeColor: string;
  strokeWidth: number;
  position: 'bottom' | 'top' | 'middle';
  bottomOffset: number;
}

// ============================================
// 字幕插件 API 接口
// ============================================

/** 字幕插件完整 API 接口 */
export interface SubtitlePluginAPI extends Plugin {
  /** 加载字幕源 */
  load(source: SubtitleSource): Promise<void>;
  /** 卸载字幕 */
  unload(): void;
  /** 显示字幕 */
  show(): void;
  /** 隐藏字幕 */
  hide(): void;
  /** 设置字幕样式 */
  setStyle(style: SubtitleStyle): void;
  /** 设置时间偏移（秒） */
  setOffset(offset: number): void;
  /** 获取当前字幕 */
  getCurrentSubtitle(): SubtitleItem | null;
  /** 跳转时更新字幕 */
  seek(time: number): void;
  /** 切换字幕语言 */
  switchLanguage(lang: string): Promise<void>;
  /** 切换字幕开关 */
  toggle(): boolean;
  /** 设置字幕可见性 */
  setVisible(visible: boolean): void;
  /** 设置字体大小 */
  setFontSize(fontSize: number): void;
  /** 设置颜色 */
  setColor(color: string): void;
  /** 设置背景颜色 */
  setBackgroundColor(color: string): void;
  /** 设置描边 */
  setStroke(color?: string, width?: number): void;
  /** 设置位置 */
  setPosition(position?: 'bottom' | 'top' | 'middle', offset?: number): void;
  /** 获取字幕状态 */
  getStatus(): {
    visible: boolean;
    currentLang: string | null;
    currentLabel: string | null;
    availableLangs: { lang: string; label: string }[];
    fontSize: number;
    color: string;
    position: string;
    itemCount: number;
    timeOffset: number;
  };
}

// ============================================
// 字幕插件类
// ============================================

class SubtitlePluginClass implements SubtitlePluginAPI {
  readonly name = 'subtitle';
  readonly version = '1.0.0';
  readonly description = '字幕渲染插件';
  readonly options?: PluginOptions;

  private video: HTMLVideoElement | null = null;
  private subtitleWrap: HTMLElement | null = null;
  private subtitleEl: HTMLElement | null = null;

  private config: SubtitleResolvedConfig;
  private currentSubtitle: ParsedSubtitle | null = null;
  private currentSource: SubtitleSource | null = null;
  private isVisible = true;
  private currentIndex = -1;
  private timeOffset = 0;

  // RAF 更新循环
  private rafId: number | null = null;

  // 事件取消订阅
  private unsubscribers: Array<() => void> = [];

  constructor(config?: SubtitlePluginConfig) {
    this.config = {
      sources: config?.sources ?? [],
      defaultLang: config?.defaultLang ?? '',
      visible: config?.visible ?? true,
      fontSize: config?.fontSize ?? 24,
      color: config?.color ?? '#ffffff',
      backgroundColor: config?.backgroundColor ?? 'transparent',
      strokeColor: config?.strokeColor ?? '#000000',
      strokeWidth: config?.strokeWidth ?? 2,
      position: config?.position ?? 'bottom',
      bottomOffset: config?.bottomOffset ?? 60,
    };
    this.isVisible = this.config.visible;
    this.options = config?.options;
  }

  install(player: VideoPlayer): void {
    if (!isBrowser()) return;

    const events: PlayerEventBus = player.events;

    const unsubMounted = events.on(PlayerEventEnum.MOUNTED, (data): void => {
      if (data.video) {
        this.video = data.video;
      }

      if (data.container) {
        // 查找 .player-subtitle-wrap 容器（SubtitleLayer 组件渲染的容器）
        this.subtitleWrap = data.container.querySelector('.player-subtitle-wrap') ?? null;

        // 在容器内创建字幕 DOM 元素
        if (this.subtitleWrap) {
          this.subtitleEl = document.createElement('div');
          this.subtitleEl.className = 'subtitle-text';
          this.subtitleEl.style.textAlign = 'center';
          this.subtitleEl.style.pointerEvents = 'none';
          this.subtitleEl.style.whiteSpace = 'pre-wrap';
          this.subtitleWrap.appendChild(this.subtitleEl);
          this.applyStyles();
        }
      }

      // 加载默认字幕
      if (this.config.sources.length > 0) {
        const defaultSource = this.config.sources.find(s => s.default) ??
                              this.config.sources.find(s => s.lang === this.config.defaultLang) ??
                              this.config.sources[0];
        if (defaultSource) {
          void this.load(defaultSource);
        }
      }

      // 启动 RAF 更新循环
      this.startUpdateLoop();
    });
    this.unsubscribers.push(unsubMounted);

    // 订阅 TIME_UPDATE 事件：字幕更新由 RAF 循环驱动，此事件仅用于通知
    const unsubTimeUpdate = events.on(PlayerEventEnum.TIME_UPDATE, (): void => {
      // RAF 循环会自动处理字幕更新
    });
    this.unsubscribers.push(unsubTimeUpdate);

    // 订阅 SEEK_END 事件：跳转时更新字幕
    const unsubSeekEnd = events.on(PlayerEventEnum.SEEK_END, (): void => {
      this.currentIndex = -1; // 重置索引，强制下次更新刷新字幕
    });
    this.unsubscribers.push(unsubSeekEnd);

    // 订阅 SUBTITLE_TOGGLE 事件：切换字幕可见性
    const unsubToggle = events.on(PlayerEventEnum.SUBTITLE_TOGGLE, (): void => {
      this.toggle();
    });
    this.unsubscribers.push(unsubToggle);

    // 订阅 SUBTITLE_SWITCH 事件：切换字幕语言
    const unsubSwitch = events.on(PlayerEventEnum.SUBTITLE_SWITCH, (data): void => {
      void this.switchLanguage(data.lang);
    });
    this.unsubscribers.push(unsubSwitch);
  }

  uninstall(): void {
    // 停止 RAF 更新循环
    this.stopUpdateLoop();

    // 取消所有事件订阅
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // 移除字幕 DOM 元素
    if (this.subtitleEl && this.subtitleWrap) {
      this.subtitleWrap.removeChild(this.subtitleEl);
    }
    this.subtitleEl = null;

    this.subtitleWrap = null;
    this.video = null;
    this.currentSubtitle = null;
    this.currentSource = null;
  }

  // ==================== RAF 更新循环 ====================

  /**
   * 启动 RAF 更新循环
   */
  private startUpdateLoop(): void {
    const loop = (): void => {
      this.updateSubtitle();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * 停止 RAF 更新循环
   */
  private stopUpdateLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ==================== 二分查找字幕 ====================

  /**
   * 二分查找：在按 startTime 排序的字幕数组中，
   * 找到当前时间应显示的字幕索引
   *
   * @param items - 按 startTime 升序排列的字幕数组
   * @param currentTime - 当前播放时间（秒）
   * @returns 匹配的字幕索引，未找到返回 -1
   */
  private binarySearchSubtitle(items: SubtitleItem[], currentTime: number): number {
    if (items.length === 0) return -1;

    let low = 0;
    let high = items.length - 1;

    // 二分查找最后一个 startTime <= currentTime 的项
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (items[mid].startTime <= currentTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // high 是最后一个 startTime <= currentTime 的索引
    // 检查该字幕是否仍在显示时间范围内
    if (high >= 0 && high < items.length && currentTime >= items[high].startTime && currentTime <= items[high].endTime) {
      return high;
    }

    return -1;
  }

  // ==================== 字幕更新 ====================

  /**
   * 更新字幕显示（由 RAF 驱动）
   */
  private updateSubtitle(): void {
    if (!this.isVisible || !this.currentSubtitle || !this.subtitleEl || !this.video) {
      if (this.subtitleEl) {
        this.subtitleEl.innerHTML = '';
      }
      return;
    }

    const currentTime = this.video.currentTime + this.timeOffset;
    const items = this.currentSubtitle.items;

    // 使用二分查找定位当前字幕
    const activeIndex = this.binarySearchSubtitle(items, currentTime);

    if (activeIndex !== this.currentIndex) {
      this.currentIndex = activeIndex;

      if (activeIndex >= 0) {
        const item = items[activeIndex];
        this.subtitleEl.innerHTML = item.text;
      } else {
        this.subtitleEl.innerHTML = '';
      }
    }
  }

  // ==================== 样式管理 ====================

  /**
   * 应用样式到字幕元素
   */
  private applyStyles(): void {
    if (!this.subtitleEl) return;

    this.subtitleEl.style.fontSize = `${this.config.fontSize}px`;
    this.subtitleEl.style.color = this.config.color;
    this.subtitleEl.style.backgroundColor = this.config.backgroundColor;
    this.subtitleEl.style.textShadow = `0 0 ${this.config.strokeWidth}px ${this.config.strokeColor}`;
    this.subtitleEl.style.opacity = this.isVisible ? '1' : '0';

    this.applyPosition();
  }

  /**
   * 应用位置到字幕容器
   */
  private applyPosition(): void {
    if (!this.subtitleWrap) return;

    switch (this.config.position) {
      case 'top':
        this.subtitleWrap.style.top = '20px';
        this.subtitleWrap.style.bottom = 'auto';
        this.subtitleWrap.style.transform = 'none';
        break;
      case 'middle':
        this.subtitleWrap.style.top = '50%';
        this.subtitleWrap.style.bottom = 'auto';
        this.subtitleWrap.style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
      default:
        this.subtitleWrap.style.top = 'auto';
        this.subtitleWrap.style.bottom = `${this.config.bottomOffset}px`;
        this.subtitleWrap.style.transform = 'none';
        break;
    }
  }

  // ==================== 公共 API ====================

  /**
   * 加载字幕源
   */
  async load(source: SubtitleSource): Promise<void> {
    try {
      const response = await fetch(source.src);
      if (!response.ok) {
        throw new Error(`Failed to load subtitle: ${response.status}`);
      }

      const content = await response.text();
      const parsed = parseSubtitle(content);

      this.currentSubtitle = parsed;
      this.currentSource = source;
      this.currentIndex = -1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SubtitlePlugin] 字幕加载失败: ${message}`);
    }
  }

  /**
   * 卸载字幕
   */
  unload(): void {
    this.currentSubtitle = null;
    this.currentSource = null;
    this.currentIndex = -1;
    if (this.subtitleEl) {
      this.subtitleEl.innerHTML = '';
    }
  }

  /**
   * 显示字幕
   */
  show(): void {
    this.isVisible = true;
    if (this.subtitleEl) {
      this.subtitleEl.style.opacity = '1';
    }
  }

  /**
   * 隐藏字幕
   */
  hide(): void {
    this.isVisible = false;
    if (this.subtitleEl) {
      this.subtitleEl.style.opacity = '0';
      this.subtitleEl.innerHTML = '';
    }
  }

  /**
   * 设置字幕样式
   */
  setStyle(style: SubtitleStyle): void {
    if (style.fontName) {
      this.subtitleEl?.style.setProperty('font-family', style.fontName);
    }
    if (style.fontSize !== undefined) {
      this.config.fontSize = Math.max(12, Math.min(72, style.fontSize));
    }
    if (style.primaryColor) {
      this.config.color = style.primaryColor;
    }
    if (style.outlineColor) {
      this.config.strokeColor = style.outlineColor;
    }
    if (style.outlineWidth !== undefined) {
      this.config.strokeWidth = Math.max(0, Math.min(5, style.outlineWidth));
    }
    if (style.bold !== undefined) {
      this.subtitleEl?.style.setProperty('font-weight', style.bold ? 'bold' : 'normal');
    }
    if (style.italic !== undefined) {
      this.subtitleEl?.style.setProperty('font-style', style.italic ? 'italic' : 'normal');
    }
    if (style.underline !== undefined) {
      this.subtitleEl?.style.setProperty('text-decoration', style.underline ? 'underline' : 'none');
    }
    this.applyStyles();
  }

  /**
   * 设置时间偏移（秒）
   */
  setOffset(offset: number): void {
    this.timeOffset = offset;
    this.currentIndex = -1; // 重置索引，强制刷新
  }

  /**
   * 获取当前字幕
   */
  getCurrentSubtitle(): SubtitleItem | null {
    if (!this.currentSubtitle || this.currentIndex < 0) return null;
    return this.currentSubtitle.items[this.currentIndex] ?? null;
  }

  /**
   * 跳转时更新字幕
   */
  seek(time: number): void {
    this.currentIndex = -1; // 重置索引，强制下次更新刷新字幕
    if (this.video) {
      this.video.currentTime = time;
    }
  }

  /**
   * 切换字幕语言
   */
  async switchLanguage(lang: string): Promise<void> {
    const source = this.config.sources.find(s => s.lang === lang);
    if (source) {
      await this.load(source);
    }
  }

  /**
   * 切换字幕开关
   */
  toggle(): boolean {
    const newVisible = !this.isVisible;
    this.setVisible(newVisible);
    return newVisible;
  }

  /**
   * 设置字幕可见性
   */
  setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.subtitleEl) {
      this.subtitleEl.style.opacity = visible ? '1' : '0';
    }
  }

  /**
   * 设置字体大小
   */
  setFontSize(fontSize: number): void {
    this.config.fontSize = Math.max(12, Math.min(72, fontSize));
    this.applyStyles();
  }

  /**
   * 设置颜色
   */
  setColor(color: string): void {
    this.config.color = color;
    this.applyStyles();
  }

  /**
   * 设置背景颜色
   */
  setBackgroundColor(color: string): void {
    this.config.backgroundColor = color;
    this.applyStyles();
  }

  /**
   * 设置描边
   */
  setStroke(color?: string, width?: number): void {
    if (color !== undefined) {
      this.config.strokeColor = color;
    }
    if (width !== undefined) {
      this.config.strokeWidth = Math.max(0, Math.min(5, width));
    }
    this.applyStyles();
  }

  /**
   * 设置位置
   */
  setPosition(position?: 'bottom' | 'top' | 'middle', offset?: number): void {
    if (position) {
      this.config.position = position;
    }
    if (offset !== undefined) {
      this.config.bottomOffset = Math.max(0, offset);
    }
    this.applyPosition();
  }

  /**
   * 获取字幕状态
   */
  getStatus(): {
    visible: boolean;
    currentLang: string | null;
    currentLabel: string | null;
    availableLangs: { lang: string; label: string }[];
    fontSize: number;
    color: string;
    position: string;
    itemCount: number;
    timeOffset: number;
  } {
    return {
      visible: this.isVisible,
      currentLang: this.currentSource?.lang ?? null,
      currentLabel: this.currentSource?.label ?? null,
      availableLangs: this.config.sources.map(s => ({ lang: s.lang, label: s.label })),
      fontSize: this.config.fontSize,
      color: this.config.color,
      position: this.config.position,
      itemCount: this.currentSubtitle?.items.length ?? 0,
      timeOffset: this.timeOffset,
    };
  }
}

/**
 * 字幕插件工厂函数
 *
 * @param config - 插件配置
 * @returns SubtitlePluginAPI 实例
 *
 * @example
 * plugins: [
 *   SubtitlePlugin({
 *     sources: [
 *       { src: 'subtitles/cn.srt', lang: 'zh', label: '中文' }
 *     ],
 *     fontSize: 20,
 *     position: 'bottom'
 *   })
 * ]
 */
export function SubtitlePlugin(config?: SubtitlePluginConfig): SubtitlePluginAPI {
  return new SubtitlePluginClass(config);
}

/**
 * 创建字幕插件（别名）
 */
export const createSubtitlePlugin = SubtitlePlugin;
