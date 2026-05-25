/**
 * ============================================
 * 虚拟节点创建模块 (h 函数)
 * ============================================
 * 提供创建虚拟 DOM 节点的核心函数
 * 基于设计文档中的纯 h 函数架构
 */

import type { VNode, VNodeChild, Component, FnComponent, ClassComponent, ComponentLifecycle } from '@/types';

/**
 * SVG 标签集合
 * 用于自动识别 SVG 元素并设置命名空间
 */
const SVG_TAGS = new Set([
  'svg', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect',
  'text', 'tspan', 'g', 'defs', 'use', 'symbol', 'linearGradient', 'radialGradient',
  'stop', 'clipPath', 'mask', 'pattern', 'image', 'foreignObject'
]);

/**
 * 判断是否为类组件
 * 通过检查原型链上是否存在 render 方法来区分函数组件和类组件
 *
 * @param fn - 待检查的组件
 * @returns 是否为类组件
 */
function isClassComponent(fn: unknown): fn is ClassComponent {
  return typeof fn === 'function' &&
    (fn as { prototype?: { render?: unknown } }).prototype !== undefined &&
    typeof (fn as { prototype?: { render?: unknown } }).prototype?.render === 'function';
}

/**
 * h 函数属性类型
 */
export type HAttrs = Record<string, unknown> | null | undefined;

/**
 * h 函数子元素类型
 */
export type HChild = VNode | string | null | undefined;

/**
 * 创建虚拟节点 (VNode)
 * 核心函数，用于描述 DOM 结构
 *
 * @param tag - 标签名或组件
 * @param attrs - 属性对象（可选）
 * @param children - 子节点（可变参数）
 * @returns 虚拟节点对象
 *
 * @example
 * // 创建普通元素
 * h('div', { class: 'container' }, 'Hello')
 *
 * @example
 * // 创建组件
 * h(MyComponent, { prop: 'value' }, h('span', {}, 'Child'))
 *
 * @example
 * // 创建 SVG
 * h('svg', { viewBox: '0 0 100 100' }, h('circle', { r: 50 }))
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function h<P = any>(
  tag: string | Component<P>,
  attrs?: HAttrs,
  ...children: HChild[]
): VNode {
  /**
   * 扁平化子节点数组
   * 处理嵌套数组并过滤掉 null 和 undefined
   */
  const flatChildren = children
    .flat(Infinity as 1)
    .filter((c): c is VNodeChild => c !== null && c !== undefined);

  /**
   * 组件处理逻辑
   * 根据组件类型（函数组件或类组件）实例化并渲染
   */
  if (typeof tag === 'function') {
    const props: Record<string, unknown> = { ...(attrs ?? {}), children: flatChildren };

    if (isClassComponent(tag)) {
      /**
       * 类组件实例化流程：
       * 1. 创建组件实例
       * 2. 调用 render 方法获取虚拟节点
       * 3. 将实例作为生命周期对象注入到虚拟节点
       */
      const instance = new tag(props);
      const vnode = instance.render();
      vnode.lifecycle = instance;
      return vnode;
    } else {
      /**
       * 函数组件调用流程：
       * 直接执行函数，传入 props 返回虚拟节点
       */
      return (tag as FnComponent)(props);
    }
  }

  /**
   * 普通元素处理
   * 创建基础虚拟节点对象
   */
  const vnode: VNode = {
    tag,
    attrs: attrs ?? {},
    children: flatChildren,
  };

  /**
   * SVG 标签自动标记命名空间
   * 确保 SVG 元素使用 createElementNS 创建
   */
  if (typeof tag === 'string' && SVG_TAGS.has(tag)) {
    vnode.attrs.xmlns = (vnode.attrs.xmlns as string) ?? 'http://www.w3.org/2000/svg';
    vnode.__ns = vnode.attrs.xmlns as string;
  }

  return vnode;
}

/**
 * 创建函数组件并绑定生命周期和内部回调支持
 * 通过闭包为函数组件提供生命周期和回调机制支持
 *
 * @param setup - 组件设置函数，接收 props 和 lifecycle 对象
 * @returns 包装后的函数组件
 *
 * @example
 * const MyComponent = defineComponent<{ title: string }>((props, lifecycle) => {
 *   lifecycle.onMounted = () => console.log('mounted');
 *
 *   // 注册内部回调
 *   lifecycle.on?.('customEvent', (data) => {
 *     console.log('收到自定义事件:', data);
 *   });
 *
 *   // 触发内部回调
 *   const handleClick = () => {
 *     lifecycle.emit?.('buttonClick', { timestamp: Date.now() });
 *   };
 *
 *   return h('div', { onClick: handleClick }, props.title);
 * });
 *
 * // 使用组件时监听内部回调
 * const vnode = h(MyComponent, {
 *   title: 'Hello',
 *   onCustomEvent: (data) => console.log('外部收到:', data),
 *   onButtonClick: (info) => console.log('按钮点击:', info),
 * });
 */
export function defineComponent<P>(
  setup: (props: P, lifecycle: ComponentLifecycle) => VNode
): FnComponent<P> {
  return (props: P): VNode => {
    const lc: ComponentLifecycle = {};

    // 初始化回调存储
    lc._callbacks = {};

    /**
     * 注册回调函数
     * @param event - 事件名称
     * @param callback - 回调函数
     */
    lc.on = (event: string, callback: (...args: unknown[]) => void): void => {
      if (lc._callbacks === undefined) lc._callbacks = {};
      lc._callbacks[event] = callback;
    };

    /**
     * 触发回调函数
     * 优先调用通过 props 传入的回调，其次调用通过 on 注册的回调
     * @param event - 事件名称
     * @param args - 传递给回调函数的参数
     */
    lc.emit = (event: string, ...args: unknown[]): void => {
      const callbackName = `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;

      // 优先调用 props 中的回调（外部传入）
      const propCallback = (props as Record<string, unknown>)[callbackName];
      if (typeof propCallback === 'function') {
        (propCallback as (...args: unknown[]) => void)(...args);
      }

      // 调用通过 on 注册的回调（内部注册）
      if (lc._callbacks !== undefined && lc._callbacks[event] !== undefined) {
        lc._callbacks[event](...args);
      }
    };

    const vnode = setup(props, lc);
    vnode.lifecycle = lc;
    return vnode;
  };
}

/**
 * 片段组件 (Fragment)
 * 用于包裹多个子元素而不产生额外 DOM 节点
 * 返回一个虚拟的 div 容器，在渲染时会特殊处理
 */
export function Fragment(props: { children: VNodeChild[] }): VNode {
  return h('fragment', {}, ...props.children);
}

/**
 * 条件渲染辅助函数
 * 当 condition 为真时渲染 vnode，否则返回空字符串
 *
 * @param condition - 条件表达式
 * @param vnode - 条件为真时渲染的虚拟节点
 * @returns 虚拟节点或空字符串
 *
 * @example
 * when(user.isAdmin, h('div', {}, '管理员面板'))
 */
export function when(condition: boolean, vnode: VNode): VNode | string {
  return condition ? vnode : '';
}

/**
 * 列表渲染辅助函数
 * 将数组映射为虚拟节点数组
 *
 * @param items - 数据源数组
 * @param renderFn - 渲染函数，接收 item 和 index 返回 VNode
 * @returns 虚拟节点数组
 *
 * @example
 * each(users, (user, index) =>
 *   h('li', { key: user.id }, user.name)
 * )
 */
export function each<T>(
  items: T[],
  renderFn: (item: T, index: number) => VNode
): VNode[] {
  return items.map((item, index) => renderFn(item, index));
}

/**
 * 显示/隐藏辅助函数
 * 通过 CSS display 属性控制显示/隐藏，元素始终存在于 DOM 中
 *
 * @param visible - 是否可见
 * @param vnode - 虚拟节点
 * @returns 带 display 样式的虚拟节点
 *
 * @example
 * show(isModalOpen, h('div', { class: 'modal' }, '内容'))
 */
export function show(visible: boolean, vnode: VNode): VNode {
  if (vnode.attrs === undefined) {
    vnode.attrs = {};
  }
  vnode.attrs.style = {
    ...(vnode.attrs.style as Record<string, string> ?? {}),
    display: visible ? '' : 'none'
  };
  return vnode;
}
