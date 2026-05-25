/**
 * ============================================
 * 核心模块统一导出
 * ============================================
 */

export { h, defineComponent, Fragment, when, each } from './h';
export { mount, materialize, applyAttrs, destroy, invokeLifecycle } from './mount';

// 状态管理、事件总线、钩子系统（基础类型和实现）
export { createStateManager } from './state';
export { createEventBus } from './eventBus';
export { createHookSystem } from './hooks';

// 导出基础类型（从各模块重新导出，不依赖 plugin）
export type { StateManager } from './state';
export type { EventBus } from './eventBus';
export type { HookSystem } from './hooks';
