/**
 * ============================================
 * 插件管理器
 * ============================================
 * 管理插件的生命周期，提供插件上下文
 * 每个插件管理器实例管理一组插件，拥有独立的状态、事件和钩子系统
 */

import type { Plugin, PluginContext } from './plugin';
import type { VideoPlayer } from '@/hili-player/index';
import { createStateManager } from '@/core/state';
import { createEventBus } from '@/core/eventBus';
import { createHookSystem } from '@/core/hooks';
import type { StateManager, EventBus, HookSystem } from '@/core';
import { createLogger } from '@/utils';

const logger = createLogger('PluginManager');

/**
 * 插件管理器类
 * 负责插件的安装、卸载和管理
 */
export class PluginManager {
  /**
   * 已安装插件的映射表
   * key: 插件名称
   * value: 插件实例
   */
  private plugins = new Map<string, Plugin>();

  /**
   * 关联的播放器实例
   */
  private player: VideoPlayer;

  /**
   * 插件专用的状态管理器
   * 插件可以使用此状态管理器存储自己的状态
   */
  state: StateManager;

  /**
   * 插件专用的事件总线
   * 插件可以使用此事件总线进行通信
   */
  events: EventBus;

  /**
   * 插件专用的钩子系统
   * 插件可以使用此钩子系统扩展功能
   */
  hooks: HookSystem;

  /**
   * 创建插件管理器实例
   * @param player - 关联的播放器实例
   */
  constructor(player: VideoPlayer) {
    this.player = player;
    this.state = createStateManager();
    this.events = createEventBus();
    this.hooks = createHookSystem();
  }

  /**
   * 安装插件
   * @param plugin - 要安装的插件
   */
  install(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn(`插件 "${plugin.name}" 已安装`);
      return;
    }

    // 创建插件上下文（供插件使用）
    const _context: PluginContext = {
      player: this.player,
      state: this.state,
      events: this.events,
      hooks: this.hooks,
      log: (msg) => logger.info(`[Plugin:${plugin.name}] ${msg}`),
    };

    // 将上下文附加到播放器，供插件访问
    Object.defineProperty(this.player, '_pluginContext', {
      value: _context,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    plugin.install(this.player);
    this.plugins.set(plugin.name, plugin);
    logger.info(`插件 "${plugin.name}" 安装成功`);
  }

  /**
   * 卸载插件
   * @param name - 要卸载的插件名称
   */
  uninstall(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    if (plugin.uninstall) {
      plugin.uninstall(this.player);
    }
    this.plugins.delete(name);
    logger.info(`插件 "${name}" 卸载成功`);
  }

  /**
   * 获取已安装的插件
   * @param name - 插件名称
   * @returns 插件实例，未安装则返回 undefined
   */
  get<T extends Plugin>(name: string): T | undefined {
    // 泛型 T 是 Plugin 的子类型，Map 存储的是 Plugin 基类
    // 调用方通过泛型参数指定具体插件类型，类型安全由调用方保证
    const plugin = this.plugins.get(name);
    if (!plugin) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return plugin as T;
  }

  /**
   * 销毁插件管理器
   * 卸载所有插件并清理资源
   */
  destroy(): void {
    this.plugins.forEach((_, name) => this.uninstall(name));
  }
}
