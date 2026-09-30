/**
 * 编译期生成的专用内部函数
 *
 * 这些函数由 vite-plugin-hili-compile 在编译期将 h() 调用替换后引用。
 * 每个函数只做一件事，跳过所有运行时类型判断。
 *
 * 未编译的代码（开发模式）仍走 h() 通用路径。
 * 编译后的代码（生产模式）使用这些专用函数。
 */

import type { VNode, VNodeAttrs, Component, Ref } from "@/types";
import type { Signal } from "@preact/signals-core";
import type { HChild } from "./h";
import { h, flattenChildren } from "./h";
import { getCurrentVNode, setPendingProviders } from "./context";
import { reportError, ErrorSource } from "./warning";
import { isRefObject, isSignalRef } from "./templateRef";

/**
 * 元素属性中的 Context Provider 条目
 * 与 h() 元素分支中的提取逻辑保持一致
 */
type ProviderEntry = { contextId: symbol; value: unknown };

/**
 * 从元素属性中提取 __providers（与 h() 元素分支行为一致）
 *
 * 编译路径下 _create* 系列函数必须做与 h() 相同的提取：
 * 否则 __providers 会残留在 attrs 中，被 applyAttrs 当作 DOM 属性设置，
 * 且 useContext 沿 __parent 链无法找到 Provider。
 *
 * @param attrs - 原始属性对象
 * @returns 清理后的 attrs（不含 __providers）与提取出的 providers
 */
function extractProviders(attrs: VNodeAttrs | undefined): {
  attrs: VNodeAttrs;
  providers?: ProviderEntry[];
} {
  if (attrs && "__providers" in attrs && Array.isArray(attrs.__providers)) {
    const providers = attrs.__providers as ProviderEntry[];
    const rest: VNodeAttrs = { ...attrs };
    delete rest.__providers;
    return { attrs: rest, providers };
  }
  return { attrs: attrs ?? {} };
}

/**
 * 创建纯静态元素（无动态属性、无事件、无 ref）
 *
 * 编译期转换：h('div', { class: 'x' }, 'text') → _createStaticEl('div', { class: 'x' }, 'text')
 *
 * 与 h() 相比跳过：
 * - 组件类型判断（isClassComponent/isFnComponent）
 * - SVG 标签查找（SVG_TAGS.has）
 * - Fragment 判断
 *
 * 注意：children 仍然以 rest args 传入，内部做扁平化
 */
export function _createStaticEl(
  tag: string,
  attrs?: VNodeAttrs,
  ...children: HChild[]
): VNode {
  const { attrs: cleanAttrs, providers } = extractProviders(attrs);
  const vnode: VNode = {
    tag,
    attrs: cleanAttrs,
    children: flattenChildren(children),
  };
  if (providers) {
    vnode.__providers = providers;
  }
  return vnode;
}

/**
 * 创建动态元素（可能有事件、ref、动态属性）
 *
 * 编译期转换：h('div', { onClick: fn, class: cls }, child) → _createEl('div', { __events: { click: fn }, class: cls }, child)
 *
 * 与 h() 相比跳过：
 * - 组件类型判断
 * - SVG 标签查找
 * - Fragment 判断
 * 属性中的事件已预分类为 __events，ref 已重命名为 __ref
 */
export function _createEl(
  tag: string,
  attrs?: VNodeAttrs,
  ...children: HChild[]
): VNode {
  const { attrs: cleanAttrs, providers } = extractProviders(attrs);
  const vnode: VNode = {
    tag,
    attrs: cleanAttrs,
    children: flattenChildren(children),
  };
  if (providers) {
    vnode.__providers = providers;
  }
  return vnode;
}

/**
 * 创建 SVG 元素（预设命名空间）
 *
 * 编译期转换：h('svg', {}, h('circle', {})) → _createSvgEl('svg', {}, _createSvgEl('circle', {}))
 *
 * 与 h() 相比跳过：
 * - SVG_TAGS.has() 运行时查找
 */
export function _createSvgEl(
  tag: string,
  attrs?: VNodeAttrs,
  ...children: HChild[]
): VNode {
  const { attrs: cleanAttrs, providers } = extractProviders(attrs);
  const vnode: VNode = {
    tag,
    attrs: cleanAttrs,
    children: flattenChildren(children),
    __ns: "http://www.w3.org/2000/svg",
  };
  if (providers) {
    vnode.__providers = providers;
  }
  return vnode;
}

/**
 * 创建 Fragment（不产生真实 DOM）
 *
 * 编译期转换：h('fragment', {}, ...) → _createFragment(...)
 */
export function _createFragment(...children: HChild[]): VNode {
  return {
    tag: "fragment",
    attrs: {},
    children: flattenChildren(children),
  };
}

/**
 * 创建组件 VNode（跳过运行时组件类型判断）
 *
 * 编译期转换：h(MyComp, { prop: val }) → _createComp(MyComp, { prop: val })
 *
 * 与 h() 相比跳过：
 * - isClassComponent 反射判断（Object.getOwnPropertyDescriptor）
 * - isFnComponent 判断
 *
 * 仍然处理（这些是运行时必须的）：
 * - ref 提取（存储到 lifecycle._ref）
 * - __providers 提取（Context 依赖注入）
 * - children 扁平化（添加到 props.children）
 * - __parent 设置（useContext 遍历父链）
 * - 错误处理（reportError + rethrow）
 */
export function _createComp(
  component: Component<Record<string, unknown>>,
  attrs?: Record<string, unknown>,
  ...children: HChild[]
): VNode {
  const type = (
    component as unknown as { __hili_type?: "fn" | "class" }
  ).__hili_type;

  // 扁平化子节点
  const flatChildren = flattenChildren(children);

  // 提取 ref（不作为 props 传递；支持字符串 / Signal / 旧 {current} 对象）
  const rawAttrs = attrs ?? {};
  const rawRef = "ref" in rawAttrs ? rawAttrs.ref : undefined;
  let componentRef: Ref<unknown> | Signal<unknown> | undefined;
  if (typeof rawRef === "string") {
    componentRef = getCurrentVNode()?.lifecycle?._templateRefs?.get(rawRef);
  } else if (isSignalRef(rawRef)) {
    componentRef = rawRef;
  } else if (isRefObject(rawRef)) {
    componentRef = rawRef as Ref<unknown>;
  }

  // 提取 __providers（Context 依赖注入）
  const providers: Array<{ contextId: symbol; value: unknown }> | undefined =
    "__providers" in rawAttrs && Array.isArray(rawAttrs.__providers)
      ? rawAttrs.__providers
      : undefined;

  // 构建 props（排除 ref 和 __providers），单次遍历避免两次对象展开
  const props: Record<string, unknown> = {};
  for (const key in rawAttrs) {
    if (key === "ref" || key === "__providers") continue;
    props[key] = rawAttrs[key];
  }
  props.children = flatChildren;

  // 函数组件
  if (type === "fn") {
    setPendingProviders(providers);
    const fn = component as unknown as (
      props: Record<string, unknown>,
    ) => VNode;

    let vnode: VNode;
    try {
      vnode = fn(props);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      reportError(
        ErrorSource.RENDER,
        `函数组件渲染失败: ${component.name || "Anonymous"}`,
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

  // 类组件
  if (type === "class") {
    const cls = component as unknown as new (
      props: Record<string, unknown>,
    ) => { render: () => VNode; _ref?: Ref<unknown> };
    const instance = new cls(props);

    let vnode: VNode;
    try {
      vnode = instance.render();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      reportError(
        ErrorSource.RENDER,
        `类组件渲染失败: ${component.name || "Anonymous"}`,
        error,
      );
      throw e;
    }

    vnode.lifecycle = instance as unknown as VNode["lifecycle"];
    if (componentRef && vnode.lifecycle) {
      vnode.lifecycle._ref = componentRef;
    }
    if (providers) {
      vnode.__providers = providers;
    }
    vnode.__parent = getCurrentVNode();
    return vnode;
  }

  // fallback：未编译的代码走通用 h() 路径
  return h(component as Component<unknown>, attrs, ...children);
}

/**
 * 克隆编译期提升的静态 VNode（_hoisted_N）
 *
 * 静态提升把整棵静态子树提升为模块级共享常量，
 * 同一常量可能被多次渲染/多处使用：
 * - materialize 会写入 vnode.el，共享对象会被后挂载的节点覆盖
 * - destroy 沿共享对象取 el 时可能移除错误的 DOM
 * 因此每个使用点必须克隆一份独立树，Vue 的 cloneVNode 同理。
 *
 * 编译期转换：_hoisted_1 → _cloneHoisted(_hoisted_1)
 */
export function _cloneHoisted<T extends VNode>(vnode: T): T {
  const clone: VNode = {
    tag: vnode.tag,
    attrs: { ...vnode.attrs },
    children: vnode.children.map((child) =>
      typeof child === "string" ? child : _cloneHoisted(child),
    ),
  };
  if (vnode.__ns !== undefined) {
    clone.__ns = vnode.__ns;
  }
  if (vnode.__providers !== undefined) {
    clone.__providers = vnode.__providers;
  }
  return clone as T;
}
