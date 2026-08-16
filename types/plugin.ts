/**
 * ============================================
 * 插件系统核心类型
 * ============================================
 * Plugin 基接口、PluginContext、StateManager、EventBus、HookSystem
 * 所有插件相关类型的唯一来源 — player 和 plugins 包均从此导入
 *
 * @module types/plugin
 */

import type { VideoPlayer } from '@hili-player/player';

/** 插件通用选项 */
export interface PluginOptions {
  /** 是否开启调试模式，默认继承播放器的 debug 设置 */
  debug?: boolean;
}

/** 插件基接口 — 所有插件必须实现 */
export interface Plugin {
  /** 插件名称，必须唯一 */
  readonly name: string;
  /** 插件版本号 */
  readonly version?: string;
  /** 插件描述 */
  readonly description?: string;
  /** 依赖的其他插件名称列表 */
  readonly dependencies?: string[];
  /** 插件选项 */
  readonly options?: PluginOptions;

  /**
   * 安装插件 — 在播放器初始化时调用
   * @param player - 播放器实例
   */
  install(player: VideoPlayer): void;

  /**
   * 卸载插件 — 清理资源 (可选)
   * @param player - 播放器实例
   */
  uninstall?(player: VideoPlayer): void;

  /** 启用插件 (可选) */
  enable?(): void;

  /** 禁用插件 (可选) */
  disable?(): void;
}

/** 插件工厂函数类型 */
export type PluginFactory<TConfig = Record<string, unknown>> =
  (config?: TConfig & PluginOptions) => Plugin;

/** 状态管理器接口 */
export interface StateManager {
  /** 获取完整状态对象的深拷贝 */
  getState(): Record<string, unknown>;
  /** 根据路径获取状态值 */
  get<R>(path: string): R | undefined;
  /** 设置状态值 */
  set(path: string, value: unknown, silent?: boolean): void;
  /** 订阅状态变化 */
  subscribe(path: string, listener: (newVal: unknown, oldVal: unknown) => void): () => void;
}

/** 事件总线接口 */
export interface EventBus {
  /** 监听事件，返回取消监听的函数 */
  on<T>(event: string, handler: (payload: T) => void): () => void;
  /** 一次性订阅 — 触发一次后自动取消 */
  once<T>(event: string, handler: (payload: T) => void): () => void;
  /** 取消监听事件 */
  off<T>(event: string, handler: (payload: T) => void): void;
  /** 清空指定事件的所有订阅者，不传则清空全部 */
  offAll(event?: string): void;
  /** 触发事件 */
  emit<T>(event: string, payload?: T): void;
}

/** 钩子系统接口 */
export interface HookSystem {
  /** 注册钩子处理器 */
  register<T, R>(name: string, handler: (ctx: T) => R): () => void;
  /** 执行钩子 */
  run<T, R>(name: string, context: T): R;
}

/** 插件上下文 — 插件安装时获得的上下文对象 */
export interface PluginContext {
  /** 播放器实例 */
  player: VideoPlayer;
  /** 状态管理器 */
  state: StateManager;
  /** 事件总线 */
  events: EventBus;
  /** 钩子系统 */
  hooks: HookSystem;
  /** 日志输出函数 — 自动带插件名前缀 */
  log: (msg: string) => void;
}

/** 预定义钩子常量 */
export const PlayerHooks = {
  /** 播放前钩子 */
  BEFORE_PLAY: 'player:beforePlay',
  /** 播放后钩子 */
  AFTER_PLAY: 'player:afterPlay',
  /** 跳转前钩子 */
  BEFORE_SEEK: 'player:beforeSeek',
  /** 跳转后钩子 */
  AFTER_SEEK: 'player:afterSeek',
} as const;
