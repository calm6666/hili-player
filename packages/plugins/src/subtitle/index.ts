/**
 * ============================================
 * 字幕插件 (SubtitlePlugin)
 * ============================================
 * 字幕功能插件，通过事件总线实现跨组件通信
 * 需要配合 src/utils/subtitle 使用
 *
 * 使用方式：
 * import { parseSRT, parseASS, parseVTT, detectSubtitleFormat } from '@/utils/subtitle';
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
 *
 * 事件通信：
 * - subtitle:toggle - 切换字幕开关
 * - subtitle:setVisible - 设置字幕可见性
 * - subtitle:switch - 切换字幕语言
 * - subtitle:setFontSize - 设置字体大小
 * - subtitle:setColor - 设置颜色
 * - subtitle:setBackground - 设置背景
 * - subtitle:setStroke - 设置描边
 * - subtitle:setPosition - 设置位置
 * - subtitle:load - 加载字幕
 * - subtitle:clear - 清空字幕
 */

import type { Plugin } from '@hili-player/player';
import type {
  SubtitleFormat,
  SubtitleItem,
  ParsedSubtitle,
} from './types';

// 重新导出类型
export {
  SubtitleFormat,
  type SubtitleItem,
  type SubtitleStyle,
  type ParsedSubtitle,
} from './types';

// ============================================
// 类型谓词函数（用于替代 as 类型断言）
// ============================================

/** 播放器事件接口 */
interface PlayerEvents {
  on: (event: string, handler: (data: unknown) => void) => () => void;
  emit: (event: string, data?: unknown) => void;
}

/** 检查对象是否拥有 events 属性 */
function hasPlayerEvents(obj: unknown): obj is { events: PlayerEvents } {
  return typeof obj === 'object' && obj !== null && 'events' in obj;
}

/** 检查对象是否拥有 video 属性 */
function hasVideoProperty(obj: unknown): obj is { video?: HTMLVideoElement } {
  return typeof obj === 'object' && obj !== null && 'video' in obj;
}

/** 检查对象是否拥有 container 属性 */
function hasContainerProperty(obj: unknown): obj is { container?: HTMLElement } {
  return typeof obj === 'object' && obj !== null && 'container' in obj;
}

/** 检查对象是否拥有 source 属性（字幕源数据） */
function isSourceData(obj: unknown): obj is { source: SubtitleSource } {
  return typeof obj === 'object' && obj !== null && 'source' in obj;
}

/** 字幕插件已解析配置类型 */
type SubtitleResolvedConfig = Omit<Required<SubtitlePluginConfig>, 'parser'> & { parser: SubtitleParser | null };

/**
 * 字幕源配置
 */
export interface SubtitleSource {
  /** 字幕文件地址 */
  src: string;
  /** 语言代码 */
  lang: string;
  /** 显示名称 */
  label: string;
  /** 格式（可选，自动检测） */
  format?: SubtitleFormat;
  /** 是否默认 */
  default?: boolean;
}

/**
 * 字幕解析器接口
 */
interface SubtitleParser {
  detectSubtitleFormat(content: string): SubtitleFormat;
  parseSRT(content: string): ParsedSubtitle;
  parseASS(content: string): ParsedSubtitle;
  parseVTT(content: string): ParsedSubtitle;
}

/**
 * 字幕插件配置
 */
export interface SubtitlePluginConfig {
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
  /** 字幕解析器（由外部传入） */
  parser?: SubtitleParser;
}

/**
 * 字幕插件类
 */
class SubtitlePluginClass implements Plugin {
  readonly name = 'subtitle';
  readonly version = '1.0.0';
  readonly description = '字幕渲染插件';

  private video: HTMLVideoElement | null = null;
  private container: HTMLElement | null = null;
  private subtitleContainer: HTMLElement | null = null;

  private config: SubtitleResolvedConfig;
  private currentSubtitle: ParsedSubtitle | null = null;
  private currentSource: SubtitleSource | null = null;
  private isVisible = true;
  private currentIndex = -1;
  private parser: SubtitleParser | null = null;

  // 事件发射器
  private emit: ((event: string, data?: unknown) => void) | null = null;

  // 更新定时器
  private updateInterval: number | null = null;

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
      parser: config?.parser ?? null,
    };
    this.isVisible = this.config.visible;
    if (config?.parser) {
      this.parser = config.parser;
    }
  }

  install(player: unknown): void {
    const playerVideo = hasVideoProperty(player) ? player.video : undefined;
    const playerContainer = hasContainerProperty(player) ? player.container : undefined;
    const playerEvents = hasPlayerEvents(player) ? player.events : undefined;

    if (playerVideo) {
      this.video = playerVideo;
    }

    if (playerContainer) {
      this.container = playerContainer;
    }

    // 保存事件发射器
    if (playerEvents) {
      this.emit = (event: string, data?: unknown) => playerEvents.emit(event, data);
    }

    // 创建字幕容器
    this.createSubtitleContainer();

    // 监听播放器事件
    if (playerEvents) {
      playerEvents.on('player:mounted', (data: unknown) => {
        if (hasContainerProperty(data) && data.container && !this.container) {
          this.container = data.container;
          this.createSubtitleContainer();
        }
        if (hasVideoProperty(data) && data.video && !this.video) {
          this.video = data.video;
        }
        if (!this.parser) {
          this.emit?.('subtitle:needParser', {});
        }
      });

      // 监听字幕控制事件
      this.bindControlEvents(playerEvents);
    }

    // 加载默认字幕
    if (this.config.sources.length > 0) {
      const defaultSource = this.config.sources.find(s => s.default) ||
                            this.config.sources.find(s => s.lang === this.config.defaultLang) ||
                            this.config.sources[0];
      if (defaultSource) {
        this.loadSubtitle(defaultSource);
      }
    }

    // 开始字幕更新循环
    this.startUpdateLoop();

    // 发射初始化完成事件
    this.emit?.('subtitle:initialized', { sources: this.config.sources });
  }

  /**
   * 创建字幕容器
   */
  private createSubtitleContainer(): void {
    if (!this.container) return;

    this.subtitleContainer = document.createElement('div');
    this.subtitleContainer.className = 'hili-subtitle-container';
    this.subtitleContainer.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      pointer-events: none;
      z-index: 100;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 500;
      line-height: 1.4;
      text-shadow: 0 0 ${this.config.strokeWidth}px ${this.config.strokeColor};
      transition: opacity 0.3s ease;
    `;

    this.updatePosition();
    this.updateStyle();

    this.container.appendChild(this.subtitleContainer);
  }

  /**
   * 更新字幕位置
   */
  private updatePosition(): void {
    if (!this.subtitleContainer) return;

    switch (this.config.position) {
      case 'top':
        this.subtitleContainer.style.top = '20px';
        this.subtitleContainer.style.bottom = 'auto';
        break;
      case 'middle':
        this.subtitleContainer.style.top = '50%';
        this.subtitleContainer.style.bottom = 'auto';
        this.subtitleContainer.style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
      default:
        this.subtitleContainer.style.top = 'auto';
        this.subtitleContainer.style.bottom = `${this.config.bottomOffset}px`;
        this.subtitleContainer.style.transform = 'none';
        break;
    }
  }

  /**
   * 更新字幕样式
   */
  private updateStyle(): void {
    if (!this.subtitleContainer) return;

    this.subtitleContainer.style.fontSize = `${this.config.fontSize}px`;
    this.subtitleContainer.style.color = this.config.color;
    this.subtitleContainer.style.backgroundColor = this.config.backgroundColor;
    this.subtitleContainer.style.textShadow = `0 0 ${this.config.strokeWidth}px ${this.config.strokeColor}`;
  }

  /**
   * 绑定控制事件
   */
  private bindControlEvents(events: { on: (event: string, handler: (data: unknown) => void) => () => void }): void {
    // 切换字幕开关
    events.on('subtitle:toggle', () => {
      this.toggle();
    });

    // 设置可见性
    events.on('subtitle:setVisible', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'visible' in data && typeof data.visible === 'boolean') {
        this.setVisible(data.visible);
      }
    });

    // 切换字幕语言
    events.on('subtitle:switch', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'lang' in data && typeof data.lang === 'string') {
        this.switchLanguage(data.lang);
      }
    });

    // 设置字体大小
    events.on('subtitle:setFontSize', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'fontSize' in data && typeof data.fontSize === 'number') {
        this.setFontSize(data.fontSize);
      }
    });

    // 设置颜色
    events.on('subtitle:setColor', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'color' in data && typeof data.color === 'string') {
        this.setColor(data.color);
      }
    });

    // 设置背景
    events.on('subtitle:setBackground', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'color' in data && typeof data.color === 'string') {
        this.setBackgroundColor(data.color);
      }
    });

    // 设置描边
    events.on('subtitle:setStroke', (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const color = 'color' in data && typeof data.color === 'string' ? data.color : undefined;
        const width = 'width' in data && typeof data.width === 'number' ? data.width : undefined;
        this.setStroke(color, width);
      }
    });

    // 设置位置
    events.on('subtitle:setPosition', (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const rawPosition = 'position' in data && typeof data.position === 'string' ? data.position : undefined;
        const position: 'bottom' | 'top' | 'middle' | undefined =
          rawPosition === 'bottom' || rawPosition === 'top' || rawPosition === 'middle' ? rawPosition : undefined;
        const offset = 'offset' in data && typeof data.offset === 'number' ? data.offset : undefined;
        this.setPosition(position, offset);
      }
    });

    // 加载字幕
    events.on('subtitle:load', (data: unknown) => {
      if (isSourceData(data)) {
        this.loadSubtitle(data.source);
      }
    });

    // 清空字幕
    events.on('subtitle:clear', () => {
      this.clear();
    });

    // 获取字幕状态
    events.on('subtitle:getStatus', () => {
      this.emit?.('subtitle:status', this.getStatus());
    });
  }

  uninstall(): void {
    this.stopUpdateLoop();

    if (this.subtitleContainer && this.container) {
      this.container.removeChild(this.subtitleContainer);
      this.subtitleContainer = null;
    }

    this.container = null;
    this.video = null;
    this.currentSubtitle = null;
    this.currentSource = null;
    this.emit = null;
  }

  // ==================== 公共 API ====================

  /**
   * 设置字幕解析器
   */
  setParser(parser: SubtitleParser): void {
    this.parser = parser;
  }

  /**
   * 加载字幕
   */
  async loadSubtitle(source: SubtitleSource): Promise<void> {
    if (!this.parser) {
      this.emit?.('subtitle:error', { type: 'load', message: 'Parser not set' });
      return;
    }

    try {
      const response = await fetch(source.src);
      if (!response.ok) {
        throw new Error(`Failed to load subtitle: ${response.status}`);
      }

      const content = await response.text();
      const format = source.format || this.parser.detectSubtitleFormat(content);

      let parsed: ParsedSubtitle;
      switch (format) {
        case 'srt':
          parsed = this.parser.parseSRT(content);
          break;
        case 'ass':
        case 'ssa':
          parsed = this.parser.parseASS(content);
          break;
        case 'vtt':
          parsed = this.parser.parseVTT(content);
          break;
        default:
          // 尝试用 SRT 解析
          parsed = this.parser.parseSRT(content);
          break;
      }

      this.currentSubtitle = parsed;
      this.currentSource = source;
      this.emit?.('subtitle:loaded', { source, format, itemCount: parsed.items.length });
    } catch (error) {
      this.emit?.('subtitle:error', { type: 'load', source, error });
    }
  }

  /**
   * 切换字幕语言
   */
  async switchLanguage(lang: string): Promise<void> {
    const source = this.config.sources.find(s => s.lang === lang);
    if (source) {
      await this.loadSubtitle(source);
      this.emit?.('subtitle:switched', { lang, label: source.label });
    } else {
      this.emit?.('subtitle:error', { type: 'switch', message: `Language ${lang} not found` });
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
    if (this.subtitleContainer) {
      this.subtitleContainer.style.opacity = visible ? '1' : '0';
    }
    this.emit?.('subtitle:visibilityChange', { visible });
  }

  /**
   * 设置字体大小
   */
  setFontSize(fontSize: number): void {
    this.config.fontSize = Math.max(12, Math.min(72, fontSize));
    this.updateStyle();
    this.emit?.('subtitle:styleChange', { fontSize: this.config.fontSize });
  }

  /**
   * 设置颜色
   */
  setColor(color: string): void {
    this.config.color = color;
    this.updateStyle();
    this.emit?.('subtitle:styleChange', { color });
  }

  /**
   * 设置背景颜色
   */
  setBackgroundColor(color: string): void {
    this.config.backgroundColor = color;
    this.updateStyle();
    this.emit?.('subtitle:styleChange', { backgroundColor: color });
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
    this.updateStyle();
    this.emit?.('subtitle:styleChange', { strokeColor: this.config.strokeColor, strokeWidth: this.config.strokeWidth });
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
    this.updatePosition();
    this.emit?.('subtitle:positionChange', { position: this.config.position, offset: this.config.bottomOffset });
  }

  /**
   * 清空字幕
   */
  clear(): void {
    this.currentSubtitle = null;
    this.currentSource = null;
    this.currentIndex = -1;
    if (this.subtitleContainer) {
      this.subtitleContainer.innerHTML = '';
    }
    this.emit?.('subtitle:cleared');
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
  } {
    return {
      visible: this.isVisible,
      currentLang: this.currentSource?.lang || null,
      currentLabel: this.currentSource?.label || null,
      availableLangs: this.config.sources.map(s => ({ lang: s.lang, label: s.label })),
      fontSize: this.config.fontSize,
      color: this.config.color,
      position: this.config.position,
      itemCount: this.currentSubtitle?.items.length || 0,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 开始更新循环
   */
  private startUpdateLoop(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateSubtitle();
    }, 100); // 100ms 更新一次
  }

  /**
   * 停止更新循环
   */
  private stopUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 更新字幕显示
   */
  private updateSubtitle(): void {
    if (!this.isVisible || !this.currentSubtitle || !this.subtitleContainer || !this.video) {
      if (this.subtitleContainer) {
        this.subtitleContainer.innerHTML = '';
      }
      return;
    }

    const currentTime = this.video.currentTime;
    const items = this.currentSubtitle.items;

    // 查找当前时间应该显示的字幕
    const activeIndex = items.findIndex(
      (item: SubtitleItem) => currentTime >= item.startTime && currentTime <= item.endTime
    );

    if (activeIndex !== this.currentIndex) {
      this.currentIndex = activeIndex;

      if (activeIndex >= 0) {
        const item = items[activeIndex];
        this.subtitleContainer.innerHTML = item.text;
        this.emit?.('subtitle:itemShow', { index: activeIndex, item });
      } else {
        this.subtitleContainer.innerHTML = '';
      }
    }
  }
}

/**
 * 字幕插件工厂函数
 *
 * @param config - 插件配置
 * @returns Plugin 实例
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
export function SubtitlePlugin(config?: SubtitlePluginConfig): Plugin {
  return new SubtitlePluginClass(config);
}
