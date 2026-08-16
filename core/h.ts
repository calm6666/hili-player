/**
 * ============================================
 * 虚拟节点创建模块 (h 函数)
 * ============================================
 * 提供创建虚拟 DOM 节点的核心函数
 * 基于设计文档中的纯 h 函数架构
 */

import type {
  VNode,
  VNodeChild,
  Component,
  FnComponent,
  ClassComponent,
  ComponentLifecycle,
  TypedComponentLifecycle,
  ExposedComponent,
  Ref,
  ComponentAttrs,
  VNodeInternalAttrs,
} from "@/types";
import {
  setCurrentVNode,
  getCurrentVNode,
  setPendingProviders,
  getPendingProviders,
} from "./context";
import { reportError, ErrorSource } from "./warning";

/**
 * SVG 标签集合
 * 用于自动识别 SVG 元素并设置命名空间
 * 包含 SVG 1.1 规范中的所有元素
 */
const SVG_TAGS = new Set([
  // 容器元素
  "svg",
  "g",
  "defs",
  "symbol",
  "use",
  "switch",
  "foreignObject",
  // 图形元素
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "image",
  // 文本元素
  "text",
  "tspan",
  "textPath",
  "title",
  "desc",
  "metadata",
  // 渐变元素
  "linearGradient",
  "radialGradient",
  "stop",
  // 裁剪与遮罩
  "clipPath",
  "mask",
  "pattern",
  "marker",
  // 滤镜元素
  "filter",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feFlood",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "feSpecularLighting",
  "feTile",
  "feTurbulence",
  "feDistantLight",
  "fePointLight",
  "feSpotLight",
  // 动画元素
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
  "mpath",
]);

/**
 * 组件类型缓存
 * 编译期通过 __hili_type 标记注入，运行时直接读取，避免反射判断
 * - 'fn': 函数组件
 * - 'class': 类组件
 * - undefined: 未编译的代码，fallback 到运行时判断
 */
type HiliCompType = "fn" | "class";

/**
 * 获取组件类型（优先使用编译期标记，fallback 到运行时反射判断）
 *
 * 编译期：vite-plugin-hili-compile 在 defineComponent 和 class 组件后注入
 *   Comp.__hili_type = 'fn' 或 Comp.__hili_type = 'class'
 * 运行时：优先读取标记（O(1)），无标记时 fallback 到 isClassComponent/isFnComponent
 */
function getComponentType(fn: unknown): HiliCompType | null {
  if (typeof fn !== "function") return null;

  // 优先检查编译期注入的标记（O(1) 属性读取，无需反射）
  const marker = (
    fn as unknown as { __hili_type?: HiliCompType }
  ).__hili_type;
  if (marker === "fn" || marker === "class") return marker;

  // fallback：运行时反射判断（开发模式或未编译代码）
  // 只做一次 isClassComponent 反射检查，避免 isFnComponent 中再次调用
  const isClass = isClassComponent(fn);
  if (isClass) return "class";
  // 是函数但不是 class → 函数组件
  if (typeof fn === "function") return "fn";
  return null;
}

/**
 * 判断是否为类组件
 * 通过 class 的特征（prototype 不可写）和原型上的 render 方法精确识别
 *
 * @param fn - 待检查的组件
 * @returns 是否为类组件
 */
function isClassComponent(fn: unknown): fn is ClassComponent {
  if (typeof fn !== "function") return false;

  const desc = Object.getOwnPropertyDescriptor(fn, "prototype");
  if (!desc || desc.writable !== false) return false;

  const proto: unknown = desc.value;
  if (typeof proto !== "object" || proto === null) return false;

  return typeof (proto as Record<string, unknown>).render === "function";
}

/**
 * 判断是否为函数组件
 * 是函数但不是类组件，即为函数组件
 *
 * @param fn - 待检查的组件
 * @returns 是否为函数组件
 */
/**
 * 判断是否为函数组件
 * 是函数但不是类组件，即为函数组件
 *
 * 注意：此函数仅在 SSR 的 renderComponentToString 中使用（非编译路径 fallback）。
 * h.ts 的 getComponentType 已优化为单次 isClassComponent 调用，
 * 不再调用 isFnComponent 以避免重复反射。
 */
export function isFnComponent(fn: unknown): fn is FnComponent {
  return typeof fn === "function" && !isClassComponent(fn);
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
export function h<P, E extends Record<string, unknown>>(
  tag: ExposedComponent<P, E>,
  attrs?: ComponentAttrs<P, E>,
  ...children: HChild[]
): VNode;

export function h<P>(
  tag: ExposedComponent<P, void>,
  attrs?: P & VNodeInternalAttrs,
  ...children: HChild[]
): VNode;

export function h(tag: string, attrs?: HAttrs, ...children: HChild[]): VNode;

export function h<P = Record<string, unknown>>(
  tag: Component<P>,
  attrs?: HAttrs,
  ...children: HChild[]
): VNode;

export function h<P = Record<string, unknown>>(
  tag: string | Component<P>,
  attrs?: HAttrs,
  ...children: HChild[]
): VNode {
  /**
   * 扁平化子节点数组
   * 处理嵌套数组并过滤掉 null 和 undefined
   * flat(3) 一次遍历，替代三次 flat(1) 的三次遍历+三次中间数组分配
   */
  const flatChildren = children
    .flat(3)
    .filter((c): c is VNodeChild => c !== null && c !== undefined);

  /**
   * 组件处理逻辑
   * 根据组件类型（函数组件或类组件）实例化并渲染
   */
  if (typeof tag === "function") {
    /**
     * 提取组件实例 ref（父组件通过 ref 属性传入）
     * ref 不作为 props 传递给组件，而是存储在 lifecycle 上
     * 挂载后由 mount 模块自动将 exposed API 赋值给 ref.current
     */
    const rawAttrs = attrs ?? {};
    const componentRef: Ref<unknown> | undefined =
      "ref" in rawAttrs &&
      rawAttrs.ref &&
      typeof rawAttrs.ref === "object" &&
      "current" in rawAttrs.ref
        ? rawAttrs.ref
        : undefined;
    const attrsWithoutRef = { ...rawAttrs };
    delete attrsWithoutRef["ref"];

    const providers: Array<{ contextId: symbol; value: unknown }> | undefined =
      "__providers" in rawAttrs && Array.isArray(rawAttrs.__providers)
        ? rawAttrs.__providers
        : undefined;
    delete attrsWithoutRef["__providers"];

    const props: Record<string, unknown> = {
      ...attrsWithoutRef,
      children: flatChildren,
    };

    const compType = getComponentType(tag);

    if (compType === "class") {
      const instance = new (tag as unknown as new (
        props: Record<string, unknown>,
      ) => { render: () => VNode })(props);
      /**
       * 类组件渲染：调用 render 方法获取 VNode
       * 渲染路径中的错误不吞掉，报告后重新抛出
       * 这样开发者能看到真实的渲染错误，而非得到一个空 div fallback
       */
      let vnode: VNode;
      try {
        vnode = instance.render();
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        reportError(
          ErrorSource.RENDER,
          `类组件渲染失败: ${tag.name || "Anonymous"}`,
          error,
        );
        throw e;
      }
      vnode.lifecycle = instance as unknown as ComponentLifecycle;
      if (componentRef && vnode.lifecycle) {
        vnode.lifecycle._ref = componentRef;
      }
      if (providers) {
        vnode.__providers = providers;
      }
      vnode.__parent = getCurrentVNode();
      return vnode;
    }

    if (compType === "fn") {
      setPendingProviders(providers);
      /**
       * 函数组件渲染：调用组件函数获取 VNode
       * 渲染路径中的错误不吞掉，报告后重新抛出
       * 之前使用 safeCall 吞掉错误返回 fallback div 的做法有严重问题：
       *   1. 隐藏了真正的渲染错误，开发者无法定位问题
       *   2. fallback div 的结构与组件预期输出不匹配，导致后续代码异常
       *   3. 组件内部变量（如 props 解构的 config）未正确初始化时，
       *      返回 fallback div 而非报错，让问题更难排查
       */
      let vnode: VNode;
      try {
        vnode = (tag as unknown as (props: Record<string, unknown>) => VNode)(
          props,
        );
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        reportError(
          ErrorSource.RENDER,
          `函数组件渲染失败: ${tag.name || "Anonymous"}`,
          error,
        );
        throw e;
      }
      if (componentRef && vnode.lifecycle) {
        vnode.lifecycle._ref = componentRef;
      }
      if (providers) {
        vnode.__providers = providers;
      }
      vnode.__parent = getCurrentVNode();
      return vnode;
    }
  }

  /**
   * 普通元素处理
   * 创建基础虚拟节点对象
   */
  const vnode: VNode = {
    tag: tag as string | Component<unknown>,
    attrs: attrs ?? {},
    children: flatChildren,
  };

  const elementAttrs = attrs ?? {};
  const providers: Array<{ contextId: symbol; value: unknown }> | undefined =
    "__providers" in elementAttrs && Array.isArray(elementAttrs.__providers)
      ? elementAttrs.__providers
      : undefined;
  if (providers) {
    vnode.__providers = providers;
    delete vnode.attrs["__providers"];
  }

  /**
   * SVG 标签自动标记命名空间
   * 确保 SVG 元素使用 createElementNS 创建
   *
   * xmlns 属性只设置在根 <svg> 元素上，子元素（如 <path>、<circle>）
   * 不需要 xmlns 属性，因为命名空间从父 <svg> 继承。
   * 这与 Vue 3 的行为一致：只有 <svg> 标签输出 xmlns，子元素不输出。
   *
   * __ns 内部标记仍然设置在所有 SVG 子元素上，
   * 用于 materialize() 中调用 createElementNS 创建正确的 SVG 元素类型
   * （否则 document.createElement('path') 会创建 HTMLUnknownElement）
   */
  if (typeof tag === "string" && SVG_TAGS.has(tag)) {
    const xmlnsValue: string =
      typeof vnode.attrs.xmlns === "string"
        ? vnode.attrs.xmlns
        : "http://www.w3.org/2000/svg";
    vnode.__ns = xmlnsValue;

    if (tag === "svg") {
      const { xmlns, ...rest } = vnode.attrs;
      vnode.attrs = { xmlns: xmlnsValue, ...rest };
    }
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
export function defineComponent<P, E = void>(
  setup: (
    props: P,
    lifecycle: E extends Record<string, unknown>
      ? TypedComponentLifecycle<E>
      : ComponentLifecycle,
  ) => VNode,
): ExposedComponent<P, E> {
  return ((props: P): VNode => {
    const lc: ComponentLifecycle = {};

    lc._callbacks = {};

    lc.on = (event: string, callback: (...args: unknown[]) => void): void => {
      lc._callbacks![event] = callback;
    };

    lc.emit = (event: string, ...args: unknown[]): void => {
      const callbackName = `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;

      const propCallback = props[callbackName as keyof typeof props];
      if (typeof propCallback === "function") {
        propCallback(...args);
      }

      if (lc._callbacks !== undefined && lc._callbacks[event] !== undefined) {
        lc._callbacks[event](...args);
      }
    };

    lc.expose = (api: unknown): void => {
      lc._exposed = api;
    };

    /**
     * Context 支持：
     * 在 setup 执行前，先创建一个占位 VNode 并设为 __currentVNode
     * 这样 setup 中调用 useContext() 可以沿 __parent 链向上查找 Provider
     * setup 执行后，将返回的 VNode 的 __providers 合并到占位 VNode 上
     * 最后恢复 __currentVNode 为父级
     */
    const parentVNode = getCurrentVNode();
    const contextVNode: VNode = {
      tag: "",
      attrs: {},
      children: [],
      lifecycle: lc,
      __parent: parentVNode,
    };

    const pendingProviders = getPendingProviders();
    if (pendingProviders) {
      contextVNode.__providers = pendingProviders;
      setPendingProviders(undefined);
    }

    setCurrentVNode(contextVNode);

    /**
     * 执行组件 setup 函数
     * 渲染路径中的错误不吞掉，报告后重新抛出
     * 之前使用 safeCall 吞掉错误返回 fallback div 导致：
     *   组件 setup 失败后返回空 div，但 lifecycle 已经创建，
     *   后续 mount 时 lifecycle 钩子仍会执行，造成不一致
     *   正确做法是让错误传播，开发者能立即看到并修复问题
     */
    let vnode: VNode;
    try {
      vnode = setup(
        props,
        lc as E extends Record<string, unknown>
          ? TypedComponentLifecycle<E>
          : ComponentLifecycle,
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      reportError(
        ErrorSource.SETUP,
        `组件 setup 执行失败: ${setup.name || "Anonymous"}`,
        error,
      );
      throw e;
    }
    vnode.lifecycle = lc;

    if (vnode.__providers) {
      contextVNode.__providers = [
        ...(contextVNode.__providers ?? []),
        ...vnode.__providers,
      ];
    }
    vnode.__parent = parentVNode;

    setCurrentVNode(parentVNode);

    return vnode;
  }) as ExposedComponent<P, E>;
}

/**
 * 片段组件 (Fragment)
 * 用于包裹多个子元素而不产生额外 DOM 节点
 * 返回一个虚拟的 div 容器，在渲染时会特殊处理
 */
export function Fragment(props: { children: VNodeChild[] }): VNode {
  return h("fragment", {}, ...props.children);
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
  return condition ? vnode : "";
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
  renderFn: (item: T, index: number) => VNode,
): VNode[] {
  return items.map((item, index) => renderFn(item, index));
}

/**
 * 显示/隐藏辅助函数
 * 通过 CSS display 属性控制显示/隐藏，元素始终存在于 DOM 中
 *
 * 注意：此函数会创建新的 attrs 和 style 对象，不修改传入的 VNode
 * 避免同一 VNode 被多次引用时产生共享状态污染
 *
 * @param visible - 是否可见
 * @param vnode - 虚拟节点
 * @returns 带 display 样式的虚拟节点
 *
 * @example
 * show(isModalOpen, h('div', { class: 'modal' }, '内容'))
 */
export function show(visible: boolean, vnode: VNode): VNode {
  /**
   * 返回一个新的 VNode，避免原地修改传入节点。
   *
   * 这里不能直接写 `vnode.attrs = ...`：
   * - 同一个 VNode 可能被多个地方复用
   * - 原地修改会让后续调用看到被污染的 style
   * - 对 SSR / hydration 来说，节点树应尽量保持不可变
   */
  const existingAttrs = vnode.attrs ?? {};
  const existingStyle: Record<string, string> =
    typeof existingAttrs.style === "object" && existingAttrs.style !== null
      ? Object.fromEntries(
          Object.entries(existingAttrs.style).map(([k, v]) => [k, String(v)]),
        )
      : {};

  return {
    ...vnode,
    attrs: {
      ...existingAttrs,
      style: {
        ...existingStyle,
        display: visible ? "" : "none",
      },
    },
  };
}
