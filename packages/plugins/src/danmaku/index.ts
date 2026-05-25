/**
 * ============================================
 * 弹幕插件 (DanmakuPlugin)
 * ============================================
 * 弹幕功能插件，通过事件总线实现跨组件通信
 * 需要配合 src/utils/danmaku 的 DanmakuManager 使用
 *
 * 使用方式：
 * import { DanmakuManager } from '@/utils/danmaku';
 * import { DanmakuPlugin } from '@hili-player/plugins';
 *
 * const danmakuManager = new DanmakuManager({
 *   container: playerContainer,
 *   video: videoElement,
 *   renderMode: RenderMode.DOM
 * });
 *
 * plugins: [
 *   DanmakuPlugin({ manager: danmakuManager })
 * ]
 *
 * 事件通信：
 * - danmaku:toggle - 切换弹幕开关
 * - danmaku:setVisible - 设置弹幕可见性
 * - danmaku:switchMode - 切换渲染模式
 * - danmaku:setSpeed - 设置弹幕速度
 * - danmaku:setArea - 设置弹幕区域
 * - danmaku:setFontSize - 设置字体大小
 * - danmaku:setOpacity - 设置透明度
 * - danmaku:setDensity - 设置弹幕密度
 * - danmaku:setAutoScale - 设置自动缩放
 * - danmaku:setFilter - 设置过滤器
 * - danmaku:send - 发送弹幕
 * - danmaku:clear - 清空弹幕
 * - danmaku:enableMask - 启用防挡
 * - danmaku:disableMask - 禁用防挡
 */

import type { Plugin } from '@hili-player/player';
import {
  DanmakuSpeed,
  DanmakuArea,
  DanmakuFontSize,
  RenderMode,
} from './types';
import type {
  ScreenMode,
  DanmakuItem,
  DanmakuFilter,
  DanmakuMaskConfig,
  PerformanceStats,
} from './types';

// 重新导出类型
export {
  DanmakuType,
  DanmakuSpeed,
  DanmakuArea,
  DanmakuFontSize,
  RenderMode,
  ScreenMode,
} from './types';

export type {
  DanmakuItem,
  DanmakuOptions,
  DanmakuFilter,
  DanmakuMaskConfig,
  PerformanceStats,
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

/** 检查对象是否为 DanmakuItem */
function isDanmakuItem(obj: unknown): obj is DanmakuItem {
  return typeof obj === 'object' && obj !== null &&
    'id' in obj && 'text' in obj && 'time' in obj && 'type' in obj;
}

/** 检查对象是否拥有 text 属性（发送弹幕数据） */
function isSendDanmakuData(obj: unknown): obj is { text: string; options?: Partial<DanmakuItem> } {
  return typeof obj === 'object' && obj !== null && 'text' in obj && typeof obj.text === 'string';
}

/** 检查对象是否拥有 list 属性（加载弹幕数据） */
function isLoadDanmakuData(obj: unknown): obj is { list: DanmakuItem[] } {
  return typeof obj === 'object' && obj !== null && 'list' in obj && Array.isArray(obj.list);
}

/** 检查对象是否拥有 maskImage 属性（防挡数据） */
function isMaskEnableData(obj: unknown): obj is { maskImage: string; videoRect?: { x: number; y: number; width: number; height: number } } {
  return typeof obj === 'object' && obj !== null && 'maskImage' in obj && typeof obj.maskImage === 'string';
}

/** 检查对象是否拥有 mode 属性（渲染模式数据） */
function isModeData(obj: unknown): obj is { mode: RenderMode } {
  return typeof obj === 'object' && obj !== null && 'mode' in obj && typeof obj.mode === 'string';
}

/** 检查对象是否拥有 speed 属性（速度数据） */
function isSpeedData(obj: unknown): obj is { speed: DanmakuSpeed } {
  return typeof obj === 'object' && obj !== null && 'speed' in obj && typeof obj.speed === 'number';
}

/** 检查对象是否拥有 area 属性（区域数据） */
function isAreaData(obj: unknown): obj is { area: DanmakuArea } {
  return typeof obj === 'object' && obj !== null && 'area' in obj && typeof obj.area === 'number';
}

/** 检查对象是否拥有 filter 属性（过滤器数据） */
function isFilterData(obj: unknown): obj is { filter: DanmakuFilter } {
  return typeof obj === 'object' && obj !== null && 'filter' in obj;
}

/** 弹幕插件已解析配置类型 */
type DanmakuResolvedConfig = Omit<Required<DanmakuPluginConfig>, 'manager'> & { manager: DanmakuManager | null };

/**
 * DanmakuManager 接口（与 src/utils/danmaku 保持一致）
 */
interface DanmakuManager {
  play(): void;
  pause(): void;
  stop(): void;
  clear(): void;
  destroy(): void;
  addDanmaku(danmaku: DanmakuItem): void;
  loadDanmaku(list: DanmakuItem[]): void;
  sendDanmaku(text: string, options?: Partial<DanmakuItem>): void;
  removeDanmaku(renderId: string): void;
  setVisible(visible: boolean): void;
  setOpacity(opacity: number): void;
  setDensity(density: number): void;
  setRenderMode(mode: RenderMode): void;
  setSpeed(speed: DanmakuSpeed): void;
  getSpeed(): DanmakuSpeed;
  setArea(area: DanmakuArea): void;
  getArea(): DanmakuArea;
  setFontSize(fontSize: number): void;
  getFontSize(): number;
  setAutoScale(autoScale: boolean): void;
  getAutoScale(): boolean;
  setFilter(filter: DanmakuFilter): void;
  getFilter(): DanmakuFilter;
  resetFilter(): void;
  setMaskConfig(config: DanmakuMaskConfig): void;
  getMaskConfig(): DanmakuMaskConfig | undefined;
  enableMask(maskImage: string, videoRect?: { x: number; y: number; width: number; height: number }): void;
  disableMask(): void;
  setBottomSafeArea(height: number): void;
  switchScreenMode(mode: 'fullscreen' | 'normal'): void;
  toggleFullscreen(): void;
  getDanmakuCount(): number;
  getPerformanceStats(): PerformanceStats;
  getTrackInfo(): {
    count: number;
    height: number;
    screenMode: ScreenMode;
    containerWidth: number;
    containerHeight: number;
  };
  getStats(): {
    renderMode: RenderMode;
    screenMode: ScreenMode;
    isPlaying: boolean;
    performance: PerformanceStats;
  };
  on<K extends string>(event: K, handler: (...args: unknown[]) => void): void;
  setOnDanmakuHover(
    callback: (
      danmaku: DanmakuItem | null,
      position: { x: number; y: number } | null
    ) => void
  ): void;
}

/**
 * 弹幕插件配置
 */
export interface DanmakuPluginConfig {
  /** DanmakuManager 实例（由外部传入） */
  manager?: DanmakuManager;
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
  /** 是否可见 */
  visible?: boolean;
  /** 弹幕密度 (0-1) */
  density?: number;
  /** 弹幕过滤器 */
  filter?: DanmakuFilter;
}

/**
 * 弹幕插件类
 */
class DanmakuPluginClass implements Plugin {
  readonly name = 'danmaku';
  readonly version = '1.0.0';
  readonly description = '弹幕渲染插件';

  private danmakuManager: DanmakuManager | null = null;
  private config: DanmakuResolvedConfig;

  // 事件发射器
  private emit: ((event: string, data?: unknown) => void) | null = null;

  constructor(config?: DanmakuPluginConfig) {
    this.config = {
      manager: config?.manager ?? null,
      renderMode: config?.renderMode ?? RenderMode.AUTO,
      opacity: config?.opacity ?? 1,
      speed: config?.speed ?? DanmakuSpeed.NORMAL,
      area: config?.area ?? DanmakuArea.FULL,
      fontSize: config?.fontSize ?? 18,
      fontSizeScale: config?.fontSizeScale ?? DanmakuFontSize.NORMAL,
      autoScale: config?.autoScale ?? true,
      visible: config?.visible ?? true,
      density: config?.density ?? 1,
      filter: config?.filter ?? {},
    };

    if (config?.manager) {
      this.danmakuManager = config.manager;
    }
  }

  install(player: unknown): void {
    const playerEvents = hasPlayerEvents(player) ? player.events : undefined;

    // 保存事件发射器
    if (playerEvents) {
      this.emit = (event: string, data?: unknown): void => playerEvents.emit(event, data);
    }

    // 如果传入了 manager，应用配置
    if (this.danmakuManager) {
      this.applyConfig();
      this.bindManagerEvents();
    }

    // 监听播放器事件
    if (playerEvents) {
      playerEvents.on('player:mounted', (data: unknown) => {
        if (hasVideoProperty(data) && data.video) {
          if (!this.danmakuManager) {
            // 如果没有传入 manager，可以在这里创建（需要外部提供 DanmakuManager 类）
            this.emit?.('danmaku:needManager', { video: data.video });
          }
        }
      });

      playerEvents.on('player:play', () => {
        this.danmakuManager?.play();
      });

      playerEvents.on('player:pause', () => {
        this.danmakuManager?.pause();
      });

      playerEvents.on('player:seeking', () => {
        // DanmakuManager 内部处理 seeking
      });

      playerEvents.on('player:fullscreenChange', (data: unknown) => {
        if (typeof data === 'object' && data !== null && 'isFullscreen' in data && typeof data.isFullscreen === 'boolean') {
          this.danmakuManager?.switchScreenMode(data.isFullscreen ? 'fullscreen' : 'normal');
        }
      });

      // 监听弹幕控制事件
      this.bindControlEvents(playerEvents);
    }

    // 发射初始化完成事件
    this.emit?.('danmaku:initialized', {
      hasManager: !!this.danmakuManager,
      config: {
        renderMode: this.config.renderMode,
        visible: this.config.visible,
      },
    });
  }

  /**
   * 应用配置到 DanmakuManager
   */
  private applyConfig(): void {
    if (!this.danmakuManager) return;

    this.danmakuManager.setRenderMode(this.config.renderMode);
    this.danmakuManager.setOpacity(this.config.opacity);
    this.danmakuManager.setSpeed(this.config.speed);
    this.danmakuManager.setArea(this.config.area);
    this.danmakuManager.setFontSize(this.config.fontSize);
    this.danmakuManager.setAutoScale(this.config.autoScale);
    this.danmakuManager.setDensity(this.config.density);
    this.danmakuManager.setFilter(this.config.filter);
    this.danmakuManager.setVisible(this.config.visible);
  }

  /**
   * 绑定 DanmakuManager 事件
   */
  private bindManagerEvents(): void {
    if (!this.danmakuManager) return;

    this.danmakuManager.on('renderStart', () => {
      this.emit?.('danmaku:play');
    });

    this.danmakuManager.on('renderPause', () => {
      this.emit?.('danmaku:pause');
    });

    this.danmakuManager.on('danmakuAdd', (...args: unknown[]) => {
      if (args.length > 0 && isDanmakuItem(args[0])) {
        this.emit?.('danmaku:itemAdded', args[0]);
      }
    });

    this.danmakuManager.on('danmakuSend', (...args: unknown[]) => {
      if (args.length > 0 && isDanmakuItem(args[0])) {
        this.emit?.('danmaku:sent', args[0]);
      }
    });

    this.danmakuManager.on('modeChange', (...args: unknown[]) => {
      if (args.length > 0 && typeof args[0] === 'string') {
        this.emit?.('danmaku:modeChange', { mode: args[0] });
      }
    });
  }

  /**
   * 绑定控制事件
   */
  private bindControlEvents(events: { on: (event: string, handler: (data: unknown) => void) => () => void }): void {
    // 切换弹幕开关
    events.on('danmaku:toggle', () => {
      this.toggle();
    });

    // 设置可见性
    events.on('danmaku:setVisible', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'visible' in data && typeof data.visible === 'boolean') {
        this.setVisible(data.visible);
      }
    });

    // 切换渲染模式
    events.on('danmaku:switchMode', (data: unknown) => {
      if (isModeData(data)) {
        this.switchRenderMode(data.mode);
      }
    });

    // 设置速度
    events.on('danmaku:setSpeed', (data: unknown) => {
      if (isSpeedData(data)) {
        this.setSpeed(data.speed);
      }
    });

    // 设置区域
    events.on('danmaku:setArea', (data: unknown) => {
      if (isAreaData(data)) {
        this.setArea(data.area);
      }
    });

    // 设置字体大小
    events.on('danmaku:setFontSize', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'fontSize' in data && typeof data.fontSize === 'number') {
        this.setFontSize(data.fontSize);
      }
    });

    // 设置透明度
    events.on('danmaku:setOpacity', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'opacity' in data && typeof data.opacity === 'number') {
        this.setOpacity(data.opacity);
      }
    });

    // 设置密度
    events.on('danmaku:setDensity', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'density' in data && typeof data.density === 'number') {
        this.setDensity(data.density);
      }
    });

    // 设置自动缩放
    events.on('danmaku:setAutoScale', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'autoScale' in data && typeof data.autoScale === 'boolean') {
        this.setAutoScale(data.autoScale);
      }
    });

    // 设置过滤器
    events.on('danmaku:setFilter', (data: unknown) => {
      if (isFilterData(data)) {
        this.setFilter(data.filter);
      }
    });

    // 重置过滤器
    events.on('danmaku:resetFilter', () => {
      this.resetFilter();
    });

    // 发送弹幕
    events.on('danmaku:send', (data: unknown) => {
      if (isSendDanmakuData(data)) {
        this.sendDanmaku(data.text, data.options);
      }
    });

    // 清空弹幕
    events.on('danmaku:clear', () => {
      this.clear();
    });

    // 加载弹幕列表
    events.on('danmaku:load', (data: unknown) => {
      if (isLoadDanmakuData(data)) {
        this.loadDanmaku(data.list);
      }
    });

    // 启用防挡
    events.on('danmaku:enableMask', (data: unknown) => {
      if (isMaskEnableData(data)) {
        this.enableMask(data.maskImage, data.videoRect);
      }
    });

    // 禁用防挡
    events.on('danmaku:disableMask', () => {
      this.disableMask();
    });

    // 设置底部安全区域
    events.on('danmaku:setBottomSafeArea', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'height' in data && typeof data.height === 'number') {
        this.setBottomSafeArea(data.height);
      }
    });

    // 获取弹幕状态
    events.on('danmaku:getStatus', () => {
      this.emit?.('danmaku:status', this.getStatus());
    });
  }

  uninstall(): void {
    if (this.danmakuManager) {
      this.danmakuManager.destroy();
      this.danmakuManager = null;
    }
    this.emit = null;
  }

  // ==================== 公共 API ====================

  /**
   * 设置 DanmakuManager 实例
   */
  setManager(manager: DanmakuManager): void {
    this.danmakuManager = manager;
    this.applyConfig();
    this.bindManagerEvents();
  }

  /**
   * 添加弹幕
   */
  addDanmaku(danmaku: DanmakuItem): void {
    this.danmakuManager?.addDanmaku(danmaku);
    this.emit?.('danmaku:listUpdated', { count: this.danmakuManager?.getDanmakuCount() || 0 });
  }

  /**
   * 批量添加弹幕
   */
  addDanmakuList(list: DanmakuItem[]): void {
    this.danmakuManager?.loadDanmaku(list);
    this.emit?.('danmaku:listUpdated', { count: this.danmakuManager?.getDanmakuCount() || 0 });
  }

  /**
   * 加载弹幕数据
   */
  loadDanmaku(list: DanmakuItem[]): void {
    this.danmakuManager?.loadDanmaku(list);
    this.emit?.('danmaku:listLoaded', { count: list.length });
  }

  /**
   * 发送弹幕（立即显示）
   */
  sendDanmaku(text: string, options?: Partial<DanmakuItem>): void {
    this.danmakuManager?.sendDanmaku(text, options);
    this.emit?.('danmaku:sent', { text, options });
  }

  /**
   * 切换弹幕开关
   */
  toggle(): boolean {
    const newVisible = !this.config.visible;
    this.setVisible(newVisible);
    return newVisible;
  }

  /**
   * 设置可见性
   */
  setVisible(visible: boolean): void {
    this.config.visible = visible;
    this.danmakuManager?.setVisible(visible);
    this.emit?.('danmaku:visibilityChange', { visible });
  }

  /**
   * 切换渲染模式
   */
  switchRenderMode(mode: RenderMode): void {
    this.config.renderMode = mode;
    this.danmakuManager?.setRenderMode(mode);
    this.emit?.('danmaku:modeChange', { mode });
  }

  /**
   * 设置弹幕速度
   */
  setSpeed(speed: DanmakuSpeed): void {
    this.config.speed = speed;
    this.danmakuManager?.setSpeed(speed);
    this.emit?.('danmaku:speedChange', { speed });
  }

  /**
   * 设置弹幕区域
   */
  setArea(area: DanmakuArea): void {
    this.config.area = area;
    this.danmakuManager?.setArea(area);
    this.emit?.('danmaku:areaChange', { area });
  }

  /**
   * 设置字体大小
   */
  setFontSize(fontSize: number): void {
    this.config.fontSize = fontSize;
    this.danmakuManager?.setFontSize(fontSize);
    this.emit?.('danmaku:fontSizeChange', { fontSize });
  }

  /**
   * 设置透明度
   */
  setOpacity(opacity: number): void {
    this.config.opacity = Math.max(0, Math.min(1, opacity));
    this.danmakuManager?.setOpacity(this.config.opacity);
    this.emit?.('danmaku:opacityChange', { opacity: this.config.opacity });
  }

  /**
   * 设置弹幕密度
   */
  setDensity(density: number): void {
    this.config.density = Math.max(0.1, Math.min(2, density));
    this.danmakuManager?.setDensity(this.config.density);
    this.emit?.('danmaku:densityChange', { density: this.config.density });
  }

  /**
   * 设置自动缩放
   */
  setAutoScale(autoScale: boolean): void {
    this.config.autoScale = autoScale;
    this.danmakuManager?.setAutoScale(autoScale);
    this.emit?.('danmaku:autoScaleChange', { autoScale });
  }

  /**
   * 设置过滤器
   */
  setFilter(filter: DanmakuFilter): void {
    this.config.filter = filter;
    this.danmakuManager?.setFilter(filter);
    this.emit?.('danmaku:filterChange', { filter });
  }

  /**
   * 重置过滤器
   */
  resetFilter(): void {
    this.config.filter = {};
    this.danmakuManager?.resetFilter();
    this.emit?.('danmaku:filterReset');
  }

  /**
   * 启用防挡功能
   */
  enableMask(maskImage: string, videoRect?: { x: number; y: number; width: number; height: number }): void {
    this.danmakuManager?.enableMask(maskImage, videoRect);
    this.emit?.('danmaku:maskEnabled', { maskImage, videoRect });
  }

  /**
   * 禁用防挡功能
   */
  disableMask(): void {
    this.danmakuManager?.disableMask();
    this.emit?.('danmaku:maskDisabled');
  }

  /**
   * 设置底部安全区域
   */
  setBottomSafeArea(height: number): void {
    this.danmakuManager?.setBottomSafeArea(height);
    this.emit?.('danmaku:bottomSafeAreaChange', { height });
  }

  /**
   * 清空弹幕
   */
  clear(): void {
    this.danmakuManager?.clear();
    this.emit?.('danmaku:cleared');
  }

  /**
   * 获取弹幕状态
   */
  getStatus(): {
    visible: boolean;
    renderMode: RenderMode;
    speed: DanmakuSpeed;
    area: DanmakuArea;
    fontSize: number;
    opacity: number;
    density: number;
    autoScale: boolean;
    danmakuCount: number;
    filter: DanmakuFilter;
  } {
    return {
      visible: this.config.visible,
      renderMode: this.config.renderMode,
      speed: this.config.speed,
      area: this.config.area,
      fontSize: this.config.fontSize,
      opacity: this.config.opacity,
      density: this.config.density,
      autoScale: this.config.autoScale,
      danmakuCount: this.danmakuManager?.getDanmakuCount() || 0,
      filter: this.config.filter,
    };
  }

  /**
   * 获取 DanmakuManager 实例
   */
  getManager(): DanmakuManager | null {
    return this.danmakuManager;
  }
}

/**
 * 弹幕插件工厂函数
 *
 * @param config - 插件配置
 * @returns Plugin 实例
 *
 * @example
 * plugins: [
 *   DanmakuPlugin({ manager: danmakuManager })
 * ]
 */
export function DanmakuPlugin(config?: DanmakuPluginConfig): Plugin {
  return new DanmakuPluginClass(config);
}
