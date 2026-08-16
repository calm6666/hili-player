/**
 * ============================================
 * Ref 引用工具模块
 * ============================================
 * 提供类型安全的 DOM 元素引用机制
 * 参考 Vue 3.5 的 ref 设计，支持泛型
 */

import type { Ref } from '@/types';

export type { Ref };

/**
 * 创建一个类型安全的元素引用
 * 用于在组件中获取渲染后的 DOM 元素实例
 *
 * @typeParam T - 引用的元素类型，默认为 Element
 * @returns 包含 current 属性的引用对象
 *
 * @example
 * ```typescript
 * // 创建引用
 * const containerRef = ref<HTMLDivElement>();
 * const videoRef = ref<HTMLVideoElement>();
 * const inputRef = ref<HTMLInputElement>();
 *
 * // 在 h() 函数中绑定
 * h('div', { ref: containerRef }, '内容')
 *
 * // 挂载后访问 DOM 元素
 * containerRef.current?.classList.add('active')
 * ```
 */
export function ref<T = Element>(): Ref<T> {
  const result: Ref<T> = { current: null };
  return result;
}
