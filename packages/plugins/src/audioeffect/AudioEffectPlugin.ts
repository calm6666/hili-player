/**
 * ============================================
 * AudioEffect 音效插件
 * ============================================
 * Web Audio 音效插件 —— 通过 MediaElementSource + 节点图实现 EQ / Reverb / A3D / Phone / Compressor
 * 安装时订阅 MOUNTED 事件，video 元素就绪后构建 AudioContext + EffectChain
 *
 * 使用方式：
 * import { AudioEffectPlugin } from '@lumina/plugins';
 *
 * const player = new VideoPlayer({
 *   src: 'video.mp4',
 *   plugins: {
 *     list: [
 *       AudioEffectPlugin({ volume: 0 }),
 *     ]
 *   }
 * });
 *
 * player.plugins.audioEffect?.setEffectActive('eq', true);
 * player.plugins.audioEffect?.setEQPreset('pop', '10');
 */

import type { Plugin, PluginOptions } from '@/types/plugin';
import type { VideoPlayer } from '../../../player/src/player/VideoPlayer';
import type { PlayerEventBus } from '../../../player/src/core/plugin';
import { PlayerEventEnum } from '@/core/events';
import { createLogger, isBrowser } from '@/utils';
import { EffectChain } from './effects/EffectChain';
import type {
  EffectName,
  EQPresetName,
  EQBandCount,
  ReverbPresetName,
  CombinationPresetName,
} from './types';

const logger = createLogger('AudioEffectPlugin');

// ============================================
// 类型定义
// ============================================

/** 音效插件配置 */
export interface AudioEffectPluginConfig {
  /** 插件选项 */
  options?: PluginOptions;
  /** 初始音量（dB），默认 0（即线性增益 1） */
  volume?: number;
}

/** 音效插件完整 API 接口（暴露给外部使用的完整类型） */
export interface AudioEffectPluginAPI extends Plugin {
  /** 设置某个效果的激活状态 */
  setEffectActive(name: EffectName, active: boolean): void;
  /** 设置 EQ 预设（可选段数切换） */
  setEQPreset(preset: EQPresetName, bandCount?: EQBandCount): void;
  /** 设置 Reverb 预设 */
  setReverbPreset(preset: ReverbPresetName): void;
  /** 设置音量（dB） */
  setVolume(db: number): void;
  /** 应用效果组合预设 */
  selectCombination(preset: CombinationPresetName): void;
  /** 获取效果名列表 */
  getEffectsList(): EffectName[];
  /** 获取内部 EffectChain 实例（只读访问） */
  getEffectChain(): EffectChain | null;
}

// ============================================
// 插件实现
// ============================================

/**
 * 音效插件实现类
 * 通过订阅 MOUNTED 事件延迟到 video 元素就绪后再构建 Web Audio 图
 */
class AudioEffectPluginClass implements AudioEffectPluginAPI {
  readonly name = 'audioEffect';
  readonly version = '1.0.0';
  readonly description = 'Web Audio 音效插件';
  readonly options?: PluginOptions;

  /** 播放器事件总线 */
  private eventBus: PlayerEventBus | null = null;
  /** 效果链管理器 */
  private effectChain: EffectChain | null = null;
  /** AudioContext 实例 */
  private audioCtx: AudioContext | null = null;
  /** MediaElementSource —— 桥接 HTMLVideoElement 与 Web Audio 图 */
  private mediaSource: MediaElementAudioSourceNode | null = null;
  /** 总控 GainNode */
  private gain: GainNode | null = null;
  /** 视频元素 */
  private video: HTMLVideoElement | null = null;
  /** 事件取消订阅函数列表 */
  private unsubscribers: Array<() => void> = [];
  /** 初始音量（dB），由配置传入 */
  private initialVolume: number;

  constructor(config?: AudioEffectPluginConfig) {
    this.options = config?.options;
    this.initialVolume = config?.volume ?? 0;
  }

  /**
   * 安装插件：订阅 MOUNTED 事件拿 video 元素
   * SSR 环境下仅注册不初始化
   */
  install(player: VideoPlayer): void {
    if (!isBrowser()) {
      logger.warn('服务端环境，音效插件仅注册不初始化');
      return;
    }
    this.eventBus = player.events;
    const unsub = this.eventBus.on(PlayerEventEnum.MOUNTED, (data): void => {
      if (data.video instanceof HTMLVideoElement) {
        this.video = data.video;
        this.initAudio();
      }
    });
    this.unsubscribers.push(unsub);
  }

  /**
   * 构建 Web Audio 图：AudioContext → MediaElementSource → EffectChain → destination
   * 现代浏览器均支持 unprefixed AudioContext；前缀兼容由 polyfill 处理，这里不引入 webkit 检测
   */
  private initAudio(): void {
    if (!this.video) return;
    // 检查 AudioContext 是否可用
    if (typeof window.AudioContext !== 'function') {
      logger.warn('当前环境不支持 AudioContext，音效插件不可用');
      return;
    }
    try {
      this.audioCtx = new window.AudioContext();
      this.mediaSource = this.audioCtx.createMediaElementSource(this.video);
      this.gain = this.audioCtx.createGain();
      this.effectChain = new EffectChain();
      this.effectChain.init(
        this.audioCtx,
        this.mediaSource,
        this.gain,
        this.audioCtx.destination,
      );
      // gain → destination 的连接由 EffectChain.init 负责，避免重复 connect
      this.effectChain.setVolume(this.initialVolume);
      logger.info('音效链初始化成功');
    } catch (err) {
      logger.error('音效链初始化失败:', err);
    }
  }

  // ==================== 公共 API ====================

  /** 设置某个效果激活状态 */
  setEffectActive(name: EffectName, active: boolean): void {
    this.effectChain?.setEffectActive(name, active);
  }

  /** 设置 EQ 预设 */
  setEQPreset(preset: EQPresetName, bandCount?: EQBandCount): void {
    this.effectChain?.setEQPreset(preset, bandCount);
  }

  /** 设置 Reverb 预设 */
  setReverbPreset(preset: ReverbPresetName): void {
    this.effectChain?.setReverbPreset(preset);
  }

  /** 设置音量（dB） */
  setVolume(db: number): void {
    this.effectChain?.setVolume(db);
  }

  /** 应用效果组合预设 */
  selectCombination(preset: CombinationPresetName): void {
    this.effectChain?.selectCombination(preset);
  }

  /** 获取效果名列表 */
  getEffectsList(): EffectName[] {
    return this.effectChain?.getEffectsList() ?? [];
  }

  /** 获取内部 EffectChain 实例 */
  getEffectChain(): EffectChain | null {
    return this.effectChain;
  }

  /**
   * 卸载插件：取消订阅 + 销毁效果链 + 关闭 AudioContext
   */
  uninstall(): void {
    // 取消所有事件订阅
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    // 销毁效果链
    this.effectChain?.destroy();
    this.effectChain = null;
    // 关闭 AudioContext（异步，失败忽略）
    const ctx = this.audioCtx;
    if (ctx) {
      ctx.close().catch((): void => {
        // 关闭失败忽略
      });
    }
    this.audioCtx = null;
    this.mediaSource = null;
    this.gain = null;
    this.video = null;
    this.eventBus = null;
  }
}

/**
 * 音效插件工厂函数
 *
 * @param config - 插件配置
 * @returns AudioEffectPluginAPI 实例
 *
 * @example
 * const player = new VideoPlayer({
 *   plugins: {
 *     list: [
 *       AudioEffectPlugin({ volume: -3 }),
 *     ]
 *   }
 * });
 */
export function AudioEffectPlugin(config?: AudioEffectPluginConfig): AudioEffectPluginAPI {
  return new AudioEffectPluginClass(config);
}

/** 创建音效插件（别名） */
export const createAudioEffectPlugin = AudioEffectPlugin;
