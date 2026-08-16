/**
 * 编译期生成的专用内部函数
 *
 * 这些函数由 vite-plugin-hili-compile 在编译期将 h() 调用替换后引用。
 * 每个函数只做一件事，跳过所有运行时类型判断。
 *
 * 未编译的代码（开发模式）仍走 h() 通用路径。
 * 编译后的代码（生产模式）使用这些专用函数。
 */

import type { VNode, VNodeAttrs, VNodeChild, Component, Ref } from "@/types";
import type { HChild } from "./h";
import { h } from "./h";
import { getCurrentVNode, setPendingProviders } from "./context";
import { reportError, ErrorSource } from "./warning";

/**
 * 扁平化子节点数组（与 h() 中的逻辑一致）
 */
function flattenChildren(children: HChild[]): VNodeChild[] {
  return children
    .flat(3)
    .filter((c): c is VNodeChild => c !== null && c !== undefined);
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
  return {
    tag,
    attrs: attrs ?? {},
    children: flattenChildren(children),
  };
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
  return {
    tag,
    attrs: attrs ?? {},
    children: flattenChildren(children),
  };
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
  return {
    tag,
    attrs: attrs ?? {},
    children: flattenChildren(children),
    __ns: "http://www.w3.org/2000/svg",
  };
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

  // 提取 ref（不作为 props 传递）
  const rawAttrs = attrs ?? {};
  const componentRef: Ref<unknown> | undefined =
    "ref" in rawAttrs &&
    rawAttrs.ref &&
    typeof rawAttrs.ref === "object" &&
    "current" in rawAttrs.ref
      ? (rawAttrs.ref as Ref<unknown>)
      : undefined;

  // 提取 __providers（Context 依赖注入）
  const providers: Array<{ contextId: symbol; value: unknown }> | undefined =
    "__providers" in rawAttrs && Array.isArray(rawAttrs.__providers)
      ? rawAttrs.__providers
      : undefined;

  // 构建 props（排除 ref 和 __providers）
  const props: Record<string, unknown> = { ...rawAttrs };
  delete props["ref"];
  delete props["__providers"];
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
