/**
 * ============================================
 * 弹幕插件 (DanmakuPlugin)
 * ============================================
 * 弹幕功能插件，通过 PlayerEventEnum 事件实现跨组件通信
 * 在 MOUNTED 时从 RowDm 容器获取弹幕渲染容器（不自行创建容器）
 * 使用 DanmakuManager 管理弹幕渲染
 *
 * 使用方式：
 * import { DanmakuPlugin } from '@hili-player/plugins';
 *
 * plugins: [
 *   DanmakuPlugin({
 *     callbacks: {
 *       onSend: async (danmaku) => { ... return confirmed; },
 *       onSendSuccess: (danmaku) => { ... },
 *       onSendError: (err, danmaku) => { ... },
 *     }
 *   })
 * ]
 */

import type { Plugin, PluginOptions } from '@/types/plugin';
import type { DanmakuCallbacks } from '@/types/callbacks';
import type {
  DanmakuItem,
  DanmakuSpeed,
  DanmakuFontSize,
  DanmakuArea,
  DanmakuFilter,
  DanmakuMaskConfig,
  RenderMode,
} from '@/types/danmaku';
import { ScreenMode } from '@/types/danmaku';
import type { VideoPlayer } from '../../../player/src/player/VideoPlayer';
import type { PlayerEventBus } from '../../../player/src/core/plugin';
import { PlayerEventEnum } from '@/core/events';
import { DanmakuManager } from '../utils/danmaku';

// ============================================
// 类型定义
// ============================================

/** 弹幕插件配置 */
export interface DanmakuPluginConfig {
  /** 插件选项 */
  options?: PluginOptions;
  /** 弹幕回调 */
  callbacks?: DanmakuCallbacks;
}

// ============================================
// 弹幕插件 API 接口（暴露给外部使用的完整类型）
// ============================================

/** 弹幕插件完整 API 接口 */
export interface DanmakuPluginAPI extends Plugin {
  /** 获取 DanmakuManager 实例 */
  getManager(): DanmakuManager | null;
  /** 加载弹幕列表 */
  loadDanmaku(list: DanmakuItem[]): void;
  /** 设置弹幕可见性 */
  setVisible(visible: boolean): void;
  /** 发送弹幕 */
  send(danmaku: DanmakuItem): void;
  /** 批量发送弹幕 */
  sendBatch(danmakus: DanmakuItem[]): void;
  /** 继续弹幕动画 */
  play(): void;
  /** 暂停弹幕动画 */
  pause(): void;
  /** 停止弹幕 */
  stop(): void;
  /** 清空弹幕 */
  clear(): void;
  /** 设置弹幕透明度 (0-1) */
  setOpacity(opacity: number): void;
  /** 设置弹幕速度 */
  setSpeed(speed: DanmakuSpeed): void;
  /** 设置弹幕字号 */
  setFontSize(size: DanmakuFontSize): void;
  /** 设置弹幕显示区域 */
  setArea(area: DanmakuArea): void;
  /** 设置渲染模式 (DOM/Canvas) */
  setRenderMode(mode: RenderMode): void;
  /** 设置屏幕模式 */
  setScreenMode(mode: ScreenMode): void;
  /** 设置弹幕过滤器 */
  setFilter(filter: DanmakuFilter): void;
  /** 设置防挡配置 */
  setMaskConfig(config: DanmakuMaskConfig): void;
  /** 设置弹幕密度 */
  setDensity(density: number): void;
  /** 获取弹幕统计信息 */
  getStats(): ReturnType<DanmakuManager['getStats']> | null;
  /** 跳转到指定时间 */
  seek(time: number): void;
  /** 重新计算布局 */
  resize(): void;
}

// ============================================
// 弹幕插件类
// ============================================

class DanmakuPluginClass implements DanmakuPluginAPI {
  readonly name = 'danmaku';
  readonly version = '1.0.0';
  readonly description = '弹幕渲染插件';
  readonly options?: PluginOptions;

  private manager: DanmakuManager | null = null;
  private callbacks: DanmakuCallbacks;
  private video: HTMLVideoElement | null = null;
  private container: HTMLElement | null = null;
  private isVisible = true;
  private unsubscribers: Array<() => void> = [];

  constructor(config?: DanmakuPluginConfig) {
    this.callbacks = config?.callbacks ?? {};
    this.options = config?.options;
  }

  install(player: VideoPlayer): void {
    const events: PlayerEventBus = player.events;

    // 订阅 MOUNTED 事件：获取 video 元素和弹幕渲染容器
    const unsubMounted = events.on(PlayerEventEnum.MOUNTED, (data): void => {
      const video = data.video ?? null;
      this.video = video;

      // 从 player 容器获取弹幕渲染容器（RowDm 组件渲染的容器）
      if (data.container) {
        this.container = data.container.querySelector('.bilibili-player-video-danmaku') ??
                         data.container.querySelector('.player-bas-dm-wrap') ??
                         data.container.querySelector('.player-row-dm-wrap') ??
                         null;
      }

      // 创建 DanmakuManager
      if (this.video && this.container) {
        this.manager = new DanmakuManager({
          container: this.container,
          video: this.video,
        });
        this.bindManagerCallbacks();
      }
    });
    this.unsubscribers.push(unsubMounted);

    // 订阅 PLAY 事件：调用 manager.play()
    const unsubPlay = events.on(PlayerEventEnum.PLAY, (): void => {
      this.manager?.play();
    });
    this.unsubscribers.push(unsubPlay);

    // 订阅 PAUSE 事件：调用 manager.pause()
    const unsubPause = events.on(PlayerEventEnum.PAUSE, (): void => {
      this.manager?.pause();
    });
    this.unsubscribers.push(unsubPause);

    // 订阅 ENDED 事件：调用 manager.stop() + manager.clear()
    const unsubEnded = events.on(PlayerEventEnum.ENDED, (): void => {
      this.manager?.stop();
      this.manager?.clear();
    });
    this.unsubscribers.push(unsubEnded);

    // 订阅 SEEK_END 事件：DanmakuManager 内部已绑定 video seeking 事件
    const unsubSeekEnd = events.on(PlayerEventEnum.SEEK_END, (): void => {
      // manager 内部通过 video seeking 事件自动处理 seek
    });
    this.unsubscribers.push(unsubSeekEnd);

    // 订阅 RESIZE 事件：调用 manager.resize()
    const unsubResize = events.on(PlayerEventEnum.RESIZE, (): void => {
      this.manager?.resize();
    });
    this.unsubscribers.push(unsubResize);

    // 订阅 FULLSCREEN_CHANGE 事件：调用 manager.switchScreenMode()
    const unsubFullscreen = events.on(PlayerEventEnum.FULLSCREEN_CHANGE, (data): void => {
      this.manager?.switchScreenMode(data.isFullscreen ? 'fullscreen' : 'normal');
    });
    this.unsubscribers.push(unsubFullscreen);

    // 订阅 DANMAKU_TOGGLE 事件：调用 manager.setVisible()
    const unsubToggle = events.on(PlayerEventEnum.DANMAKU_TOGGLE, (): void => {
      this.isVisible = !this.isVisible;
      this.manager?.setVisible(this.isVisible);
    });
    this.unsubscribers.push(unsubToggle);

    // 订阅 DANMAKU_SEND 事件：调用 manager.sendDanmaku()
    const unsubSend = events.on(PlayerEventEnum.DANMAKU_SEND, (data): void => {
      this.handleSendDanmaku(data.text, data.options);
    });
    this.unsubscribers.push(unsubSend);

    // 订阅 DANMAKU_CLEAR 事件：调用 manager.clear()
    const unsubClear = events.on(PlayerEventEnum.DANMAKU_CLEAR, (): void => {
      this.manager?.clear();
    });
    this.unsubscribers.push(unsubClear);
  }

  uninstall(): void {
    // 取消所有事件订阅
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // 销毁 manager
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }

    this.video = null;
    this.container = null;
  }

  // ==================== 私有方法 ====================

  /**
   * 绑定 DanmakuManager 回调
   */
  private bindManagerCallbacks(): void {
    if (!this.manager) return;

    // 弹幕悬停回调
    this.manager.setOnDanmakuHover((danmaku, position): void => {
      if (danmaku && position) {
        // 悬停进入
      } else if (danmaku === null) {
        // 悬停离开
      }
    });
  }

  /**
   * 处理发送弹幕
   */
  private async handleSendDanmaku(text: string, options?: Partial<DanmakuItem>): Promise<void> {
    const danmaku: DanmakuItem = {
      id: Date.now(),
      text,
      time: this.video?.currentTime ?? 0,
      type: 1,
      ...options,
    };

    // 如果配置了 onSend 回调，先走服务器确认流程
    if (this.callbacks.onSend) {
      try {
        const confirmed = await this.callbacks.onSend(danmaku);
        this.manager?.sendDanmaku(confirmed.text, confirmed);
        this.callbacks.onSendSuccess?.(confirmed);
      } catch (error) {
        this.callbacks.onSendError?.(
          error instanceof Error ? error : new Error(String(error)),
          danmaku
        );
      }
    } else {
      this.manager?.sendDanmaku(text, options);
    }
  }

  // ==================== 公共 API ====================

  /**
   * 获取 DanmakuManager 实例
   */
  getManager(): DanmakuManager | null {
    return this.manager;
  }

  /**
   * 加载弹幕列表
   */
  loadDanmaku(list: DanmakuItem[]): void {
    if (!this.manager) return;
    list.forEach(item => this.manager!.addDanmaku(item));
    this.callbacks.onIncrementalUpdate?.(list, this.manager.getStats().scheduler.totalLoaded);
  }

  /**
   * 设置弹幕可见性
   */
  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.manager?.setVisible(visible);
  }

  /**
   * 发送弹幕
   */
  send(danmaku: DanmakuItem): void {
    if (!this.manager) return;
    this.manager.addDanmaku(danmaku);
  }

  /**
   * 批量发送弹幕
   */
  sendBatch(danmakus: DanmakuItem[]): void {
    if (!this.manager) return;
    danmakus.forEach(item => this.manager!.addDanmaku(item));
    this.callbacks.onIncrementalUpdate?.(danmakus, this.manager.getStats().scheduler.totalLoaded);
  }

  /**
   * 继续弹幕动画
   */
  play(): void {
    this.manager?.play();
  }

  /**
   * 暂停弹幕动画
   */
  pause(): void {
    this.manager?.pause();
  }

  /**
   * 停止弹幕（清空所有弹幕）
   */
  stop(): void {
    this.manager?.stop();
  }

  /**
   * 清空弹幕
   */
  clear(): void {
    this.manager?.clear();
  }

  /**
   * 设置弹幕透明度 (0-1)
   */
  setOpacity(opacity: number): void {
    this.manager?.setOpacity(opacity);
  }

  /**
   * 设置弹幕速度
   */
  setSpeed(speed: DanmakuSpeed): void {
    this.manager?.setSpeed(speed);
  }

  /**
   * 设置弹幕字号
   */
  setFontSize(size: DanmakuFontSize): void {
    this.manager?.setFontSize(size * 18);
  }

  /**
   * 设置弹幕显示区域
   */
  setArea(area: DanmakuArea): void {
    this.manager?.setArea(area);
  }

  /**
   * 设置渲染模式 (DOM/Canvas)
   */
  setRenderMode(mode: RenderMode): void {
    this.manager?.setRenderMode(mode);
  }

  /**
   * 设置屏幕模式 (全屏/滚动/顶部/底部)
   */
  setScreenMode(mode: ScreenMode): void {
    this.manager?.switchScreenMode(mode === ScreenMode.FULLSCREEN ? 'fullscreen' : 'normal');
  }

  /**
   * 设置弹幕过滤器
   */
  setFilter(filter: DanmakuFilter): void {
    this.manager?.setFilter(filter);
  }

  /**
   * 设置防挡配置
   */
  setMaskConfig(config: DanmakuMaskConfig): void {
    this.manager?.setMaskConfig(config);
  }

  /**
   * 设置弹幕密度
   */
  setDensity(density: number): void {
    this.manager?.setDensity(density);
  }

  /**
   * 获取弹幕统计信息
   */
  getStats(): ReturnType<DanmakuManager['getStats']> | null {
    return this.manager ? this.manager.getStats() : null;
  }

  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    if (!this.video) return;
    this.video.currentTime = time;
  }

  /**
   * 重新计算布局
   */
  resize(): void {
    this.manager?.resize();
  }
}

/**
 * 弹幕插件工厂函数
 *
 * @param config - 插件配置
 * @returns DanmakuPluginAPI 实例
 *
 * @example
 * plugins: [
 *   DanmakuPlugin({
 *     callbacks: {
 *       onSend: async (danmaku) => { return await sendToServer(danmaku); },
 *       onSendSuccess: (danmaku) => console.log('发送成功'),
 *       onSendError: (err, danmaku) => console.error('发送失败', err),
 *     }
 *   })
 * ]
 */
export function DanmakuPlugin(config?: DanmakuPluginConfig): DanmakuPluginAPI {
  return new DanmakuPluginClass(config);
}

/**
 * 创建弹幕插件（别名）
 */
export const createDanmakuPlugin = DanmakuPlugin;
