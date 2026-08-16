/**
 * ============================================
 * StreamMiddleware — 流媒体中间件
 * ============================================
 *
 * 统一管理 Native 和 Streaming 两种播放模式。
 * 当 PluginManager 检测到 StreamPlugin 安装时自动切换模式。
 * 中间件统一提供 play / pause / seek / load / getStats / getBufferInfo / getQualities / setQuality。
 */

import type {
  StreamPlugin,
  StreamConfig,
  StreamStats,
  BufferInfo,
  QualityLevel,
} from '@/types/streamPlugin';

export enum PlayerMode { NATIVE = 'native', STREAMING = 'streaming' }

export class StreamMiddleware {
  private mode: PlayerMode = PlayerMode.NATIVE;
  private activePlugin: StreamPlugin | null = null;
  private video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  /** PluginManager 安装 StreamPlugin 时调用 */
  registerStreamPlugin(plugin: StreamPlugin): void {
    this.activePlugin = plugin;
    this.mode = PlayerMode.STREAMING;
  }

  /** PluginManager 卸载 StreamPlugin 时调用 */
  unregisterStreamPlugin(): void {
    this.activePlugin = null;
    this.mode = PlayerMode.NATIVE;
  }

  /** 获取当前播放模式 */
  getMode(): PlayerMode {
    return this.mode;
  }

  // ── 代理方法：统一委托给 StreamPlugin 或原生 video ──

  /** 播放 */
  play(): void {
    if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
      this.activePlugin.play();
    } else {
      this.video.play();
    }
  }

  /** 暂停 */
  pause(): void {
    if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
      this.activePlugin.pause();
    } else {
      this.video.pause();
    }
  }

  /** 跳转到指定时间 */
  seek(time: number): void {
    if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
      this.activePlugin.seek(time);
    } else {
      this.video.currentTime = time;
    }
  }

  /** 加载流媒体配置 */
  load(config: StreamConfig): void {
    if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
      this.activePlugin.load(config);
    } else {
      const url = typeof config.url === 'string' ? config.url : '';
      this.video.src = url;
      this.video.load();
    }
  }

  /** 获取统计信息 */
  getStats(): Partial<StreamStats> | { currentTime: number; duration: number } {
    if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
      return this.activePlugin.getStats();
    }
    return { currentTime: this.video.currentTime, duration: this.video.duration };
  }

  /** 获取缓冲信息 */
  getBufferInfo(): BufferInfo {
    if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
      return this.activePlugin.getBufferInfo();
    }
    if (this.video.buffered.length === 0) {
      return { start: 0, end: 0, length: 0 };
    }
    const end: number = this.video.buffered.end(this.video.buffered.length - 1);
    return { start: 0, end, length: end - this.video.currentTime };
  }

  /** 获取可用画质列表 */
  getQualities(): QualityLevel[] {
    if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
      return this.activePlugin.getQualities();
    }
    return [];
  }

  /** 设置画质 */
  setQuality(quality: string): void {
    if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
      this.activePlugin.setQuality(quality);
    }
  }

  /** 销毁中间件，释放资源 */
  destroy(): void {
    if (this.activePlugin) {
      this.activePlugin.destroy();
    }
    this.activePlugin = null;
    this.mode = PlayerMode.NATIVE;
  }
}
