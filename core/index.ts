/**
 * ============================================
 * 核心模块统一导出
 * ============================================
 */

export { h, defineComponent, Fragment, when, each } from './h';
export { mount, materialize, applyAttrs, destroy, invokeLifecycle, hydrate } from './mount';
export { ref } from './ref';
export type { Ref, ExposedApi, ComponentLifecycle, TypedComponentLifecycle, TypedEmit, TypedOn, ComponentAttrs, VNodeInternalAttrs, EventCallbacks, ExposedComponent } from '@/types';

// 状态管理、事件总线、钩子系统（基础类型和实现）
export { createStateManager, createTypedStateManager, useState } from './state';
export { createEventBus, createTypedEventBus } from './eventBus';
export { createHookSystem } from './hooks';
export { createContext, useContext, provide, saveContext, restoreContext } from './context';

// 框架警告与错误处理
export { warn, reportError, safeCall, safeAsyncCall, assertWarn, onFrameworkError, onFrameworkWarning } from './warning';
export { WarnSource, ErrorSource } from './warning';
export type { FrameworkError, FrameworkWarning, GlobalErrorHandler, GlobalWarningHandler } from './warning';

// 导出基础类型（从各模块重新导出，不依赖 plugin）
export type { StateManager, TypedStateManager } from './state';
export type { EventBus, TypedEventBus } from './eventBus';
export type { PlayerEventMap, PlayerEventBus } from './events';
export type { HookSystem } from './hooks';

// 服务端渲染(SSR)
export { renderToString } from './ssr';

// Style / Class 标准化（SSR 和客户端共用）
export {
  normalizeStyle,
  normalizeStyleValue,
  normalizeClass,
  serializeStyle,
  applyStyle,
  camelToKebab,
} from './normalize';

// 编译期内部函数（由 vite-plugin-hili-compile 生成的代码引用）
export {
  _createStaticEl,
  _createEl,
  _createSvgEl,
  _createFragment,
  _createComp,
  _cloneHoisted,
} from './internal';
