/**
 * ============================================
 * DOM 挂载与渲染模块
 * ============================================
 * 提供将虚拟节点转换为真实 DOM 并挂载的功能
 * 包含属性应用、事件绑定、指令处理等
 * 支持服务端渲染(SSR)环境
 */

import type {
  VNode,
  VNodeAttrs,
  Lifecycle,
  RefValue,
  DirectiveFn,
} from "@/types";
import type { Signal } from "@preact/signals-core";
import { isBrowser } from "@/utils";
import { safeCall, ErrorSource, isDev, warn, WarnSource } from "./warning";
import { applyStyle, normalizeClass } from "./normalize";
import { isRefObject, isSignalRef } from "./templateRef";

/**
 * 沿 __parent 链向上查找最近的组件生命周期注册表，解析字符串模板引用
 * 字符串 ref 归属「最近的组件」，不跨组件边界
 */
function findTemplateRef(
  vnode: VNode,
  key: string,
): Signal<unknown> | undefined {
  let cur: VNode | undefined = vnode;
  while (cur) {
    if (cur.lifecycle) {
      return cur.lifecycle._templateRefs?.get(key);
    }
    cur = cur.__parent;
  }
  return undefined;
}

/**
 * 统一的 ref 绑定：支持回调 / 字符串模板引用 / Signal / 旧 {current} 对象
 */
function bindRef(refValue: unknown, el: Element, vnode: VNode): void {
  if (refValue === undefined || refValue === null) return;
  if (typeof refValue === "function") {
    (refValue as RefValue)(el, vnode);
    return;
  }
  if (typeof refValue === "string") {
    const sig = findTemplateRef(vnode, refValue);
    if (sig) {
      sig.value = el;
    } else if (isDev()) {
      warn(
        WarnSource.MOUNT,
        `模板引用 "${refValue}" 未注册：请在 setup 中调用 useTemplateRef(lc, "${refValue}")`,
      );
    }
    return;
  }
  if (isSignalRef(refValue)) {
    refValue.value = el;
    return;
  }
  if (isRefObject(refValue)) {
    refValue.current = el;
  }
}

/**
 * 统一的 ref 清理：销毁时把已绑定的引用清空，避免悬挂 DOM 引用
 */
function clearRef(refValue: unknown, vnode: VNode): void {
  if (refValue === undefined || refValue === null) return;
  if (typeof refValue === "string") {
    const sig = findTemplateRef(vnode, refValue);
    if (sig) sig.value = null;
    return;
  }
  if (isSignalRef(refValue)) {
    refValue.value = null;
    return;
  }
  if (isRefObject(refValue)) {
    refValue.current = null;
  }
}

/**
 * 需要直接赋值到 DOM property 的属性白名单
 * 这些属性用 setAttribute 设置后行为异常或不生效：
 * - value：setAttribute 不会更新当前值，且不影响 form reset
 * - checked/selected：setAttribute 设置的是默认值而非当前值
 * - disabled/readOnly：setAttribute 会被视为 true（即使值为 false）
 * - textContent/innerHTML：setAttribute 无法设置这些 property
 */
const DOM_PROPERTIES = new Set<string>([
  "value",
  "checked",
  "selected",
  "disabled",
  "readOnly",
  "defaultValue",
  "defaultChecked",
  "defaultSelected",
  "indeterminate",
  "textContent",
  "innerHTML",
]);

/**
 * 将虚拟节点挂载到容器元素
 * 这是挂载流程的入口函数
 * 在服务端环境中跳过实际挂载，仅触发生命周期
 *
 * @param vnode - 要挂载的虚拟节点
 * @param container - 容器 DOM 元素
 *
 * @example
 * mount(h(App, {}), document.getElementById('root')!)
 */
export function mount(vnode: VNode | string, container: HTMLElement): void {
  /**
   * 服务端环境跳过实际挂载
   * 仅触发生命周期钩子（如果存在）
   */
  if (!isBrowser()) {
    invokeLifecycle(vnode, "onBeforeMount");
    invokeLifecycle(vnode, "onMounted");
    return;
  }

  /**
   * 开发环境检测重复挂载
   * 同一 VNode 被多次 mount 会导致状态污染和事件监听累积
   */
  if (typeof vnode === "object" && vnode._mounted && isDev()) {
    console.warn(
      "[HiliFramework/mount] 检测到 VNode 重复挂载，同一 VNode 对象不应被多次 mount",
    );
  }

  /**
   * 将虚拟节点物化为真实 DOM
   * 递归创建所有子节点
   */
  const el = materialize(vnode);

  /**
   * 触发 onBeforeMount 生命周期钩子
   * 在 DOM 插入容器之前调用，此时组件可做最后的修改/拦截
   * 与 Vue3 的 onBeforeMount 语义一致：DOM 即将挂载但尚未插入文档
   */
  invokeLifecycle(vnode, "onBeforeMount");

  /**
   * 将生成的 DOM 插入容器
   */
  container.appendChild(el);

  /**
   * 标记 VNode 已挂载
   */
  if (typeof vnode === "object") {
    vnode._mounted = true;
  }

  /**
   * 触发 onMounted 生命周期钩子
   * DOM 已插入容器，组件可以安全地访问 DOM 元素
   */
  invokeLifecycle(vnode, "onMounted");
}

/**
 * 将虚拟节点物化为真实 DOM 节点
 * 递归处理子节点，构建完整的 DOM 树
 * 在服务端环境中返回一个模拟的节点对象
 *
 * @param vnode - 虚拟节点或字符串
 * @returns 真实 DOM 节点或模拟节点
 */
export function materialize(vnode: VNode | string): Node {
  /**
   * 服务端环境返回模拟节点
   * 避免访问 document 对象导致报错
   */
  if (!isBrowser()) {
    return createMockNode(vnode);
  }

  /**
   * 处理文本节点
   * 字符串直接创建为文本节点
   */
  if (typeof vnode === "string") {
    return document.createTextNode(vnode);
  }

  /**
   * Fragment 片段处理
   * fragment 标签不产生真实 DOM 元素，只创建 DocumentFragment 包裹子节点
   * 与 SSR 中的 renderElementToString 行为一致
   */
  if (String(vnode.tag).toLowerCase() === "fragment") {
    const fragment = document.createDocumentFragment();
    for (const child of vnode.children) {
      if (typeof child !== "string" && child.__parent === undefined) {
        child.__parent = vnode;
      }
      fragment.appendChild(materialize(child));
    }
    return fragment;
  }

  /**
   * 获取命名空间（用于 SVG 元素）
   * 如果存在命名空间，使用 createElementNS 创建元素
   */
  const ns = vnode.__ns;

  /**
   * 创建元素节点
   * 根据是否有命名空间选择创建方法
   */
  const el =
    ns !== undefined
      ? document.createElementNS(ns, String(vnode.tag))
      : document.createElement(String(vnode.tag));

  /**
   * 应用属性到元素
   * 包括 HTML 属性、事件监听、指令等
   * 注意：SVG 元素（如 <path>）是 SVGElement 而非 HTMLElement，
   * 必须用 el instanceof Element 判断，否则 SVG 元素的属性（如 d、viewBox）
   * 永远不会被设置，导致 SVG 渲染为空标签
   */
  const domEl = el instanceof Element ? el : undefined;
  if (domEl) {
    applyAttrs(domEl, vnode.attrs, vnode);
  }

  /**
   * 递归物化并挂载子节点
   * 使用 DocumentFragment 批量插入，减少重排次数
   *
   * __parent 由 h() 在创建 VNode 时设置，这里只在未设置时补充
   * 避免多次 mount 同一 VNode 树时覆盖已有的 __parent 链
   */
  if (vnode.children.length > 0) {
    const fragment = document.createDocumentFragment();
    for (const child of vnode.children) {
      if (typeof child !== "string" && child.__parent === undefined) {
        child.__parent = vnode;
      }
      fragment.appendChild(materialize(child));
    }
    el.appendChild(fragment);
  }

  /**
   * 保存真实 DOM 引用到虚拟节点
   * 便于后续直接操作
   * SVG 元素也保存引用（SVGElement 继承自 Element）
   */
  if (domEl) {
    vnode.el = domEl;
  }

  return el;
}

/**
 * 创建模拟 DOM 节点（用于 SSR）
 * 在服务端环境中创建一个简单的对象来模拟 DOM 节点
 *
 * @param vnode - 虚拟节点或字符串
 * @returns 模拟的 DOM 节点
 */
function createMockNode(vnode: VNode | string): Node {
  /**
   * 文本节点直接返回空文本节点模拟
   */
  if (typeof vnode === "string") {
    return { nodeType: Node.TEXT_NODE, textContent: vnode } as Node;
  }

  /**
   * 创建模拟元素节点
   * 包含基本的属性和方法，使组件能够正常初始化
   */
  const mockEl = {
    nodeType: Node.ELEMENT_NODE,
    tagName: String(vnode.tag).toUpperCase(),
    attributes: {},
    style: {},
    childNodes: [],
    appendChild: () => {},
    removeChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    getAttribute: () => null,
    setAttribute: () => {},
    removeAttribute: () => {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => false,
      contains: () => false,
    },
  } as unknown as Element | HTMLElement | SVGElement;

  /**
   * 保存模拟 DOM 引用到虚拟节点
   */
  vnode.el = mockEl;

  /**
   * 递归处理子节点
   */
  if (vnode.children.length > 0) {
    for (const child of vnode.children) {
      materialize(child);
    }
  }

  return mockEl;
}

// 类型守卫：将 entry 收窄为 [DirectiveFn, unknown]
function isDirectiveEntry(value: unknown): value is [DirectiveFn, unknown] {
  return (
    Array.isArray(value) && value.length >= 2 && typeof value[0] === "function"
  );
}

/**
 * 应用属性到 DOM 元素
 * 处理各种类型的属性：普通属性、事件、样式、指令、ref 等
 * 支持 HTML 元素和 SVG 元素（SVGElement 继承自 Element）
 *
 * @param el - 目标 DOM 元素（HTMLElement 或 SVGElement）
 * @param attrs - 属性对象
 * @param vnode - 所属虚拟节点（用于存储清理函数）
 */
export function applyAttrs(
  el: Element | HTMLElement | SVGElement,
  attrs: VNodeAttrs,
  vnode: VNode,
): void {
  /**
   * 清理函数数组
   * 用于存储事件监听和指令的清理函数
   */
  const cleanups: (() => void)[] = [];

  /**
   * 第一步：优先处理编译期预分类的 __ref（如果存在）
   * 编译期：vite-plugin-hili-compile 将 ref 重命名为 __ref
   * 运行时：优先读取 __ref，fallback 到 ref
   * 统一支持：回调 / 字符串模板引用 / Signal / 旧 {current} 对象
   */
  bindRef(attrs.__ref ?? attrs.ref, el, vnode);

  /**
   * 第二步：优先处理编译期预分类的 __events（如果存在）
   * 编译期：vite-plugin-hili-compile 将 onXxx 事件提取为 __events 对象
   * 运行时：直接遍历 __events 绑定事件，跳过属性遍历中的 startsWith 判断
   */
  const eventsValue = attrs.__events;
  if (
    eventsValue !== undefined &&
    eventsValue !== null &&
    typeof eventsValue === "object"
  ) {
    const events = eventsValue as Record<string, EventListener>;
    for (const eventName in events) {
      if (Object.prototype.hasOwnProperty.call(events, eventName)) {
        const handler = events[eventName];
        if (typeof handler === "function") {
          el.addEventListener(eventName, handler);
          cleanups.push(() => el.removeEventListener(eventName, handler));
        }
      }
    }
  }

  /**
   * 第三步：处理其他属性
   */
  for (const key in attrs) {
    if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;

    const value = attrs[key];

    /**
     * 跳过空值和内部属性
     */
    if (value === null || value === undefined) continue;

    /**
     * 跳过已处理的 ref / __ref / __events / __providers
     * __providers 由 h()/内部函数在创建 VNode 时提取到 vnode.__providers，
     * 此处兜底跳过，防止任何路径残留的 __providers 被当作 DOM 属性设置
     */
    if (
      key === "ref" ||
      key === "__ref" ||
      key === "__events" ||
      key === "__providers"
    ) continue;

    /**
     * 处理指令数组
     * 二维数组格式：[[directiveFn, value], ...]
     * 每个指令执行后可能返回清理函数
     */
    if (key === "directives" && Array.isArray(value)) {
      for (const entry of value) {
        if (!isDirectiveEntry(entry)) continue; // 类型收窄，过滤非法 entry
        const [dir, val] = entry; // 安全解构，不再有 any 报错
        const cleanup = dir(el, val); //,安全调用
        if (cleanup !== undefined) {
          cleanups.push(cleanup);
        }
      }
    } else if (key === "svgContent" && typeof value === "string") {
      /**
       * 处理 SVG 内容注入
       * 安全地解析并插入 SVG 字符串
       */
      const fragment = parseSafeSVG(value);
      el.appendChild(fragment);
    } else if (key === "style") {
      if ("style" in el) {
        const raw = attrs[key];
        if (typeof raw === "string" || (typeof raw === "object" && raw !== null && !Array.isArray(raw))) {
          applyStyle(el as HTMLElement | SVGElement, raw);
        }
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      const event = key.slice(2).toLowerCase();
      const handler: EventListener = <EventListener>value;
      el.addEventListener(event, handler);
      cleanups.push(() => el.removeEventListener(event, handler));
    } else if (key === "className" || key === "class") {
      /**
       * 处理 class / className（统一入口，支持字符串/数组/对象）
       *
       * normalizeClass 处理：
       * - 'foo bar'              → 'foo bar'
       * - ['foo', { active: true }] → 'foo active'
       * - { active: true, hidden: false } → 'active'
       * - null / undefined       → ''（不设置属性）
       */
      const cls = normalizeClass(value as Parameters<typeof normalizeClass>[0]);
      if (cls) {
        el.setAttribute("class", cls);
      } else {
        el.removeAttribute("class");
      }
    } else if (DOM_PROPERTIES.has(key)) {
      /**
       * 处理需要直接赋值的 DOM property
       * value/checked/selected 等属性用 setAttribute 不生效或行为异常，
       * 必须直接赋值到 DOM 元素的对应 property 上
       * 参考 React 的实现：对这些属性使用 el[key] = value
       */
      try {
        (el as unknown as Record<string, unknown>)[key] = value;
      } catch {
        /** 某些只读 property 赋值会抛异常，fallback 到 setAttribute */
        el.setAttribute(key, String(value));
      }
    } else {
      /**
       * 处理普通属性
       * SVG 元素或 class 属性使用 setAttribute
       * 其他属性优先使用 DOM 属性，不存在则使用 setAttribute
       */
      el.setAttribute(key, String(value));
    }
  }

  /**
   * 保存清理函数到虚拟节点
   * 销毁时统一调用
   */
  vnode._cleanups = cleanups;
}

/**
 * 安全解析 SVG 字符串
 * 移除潜在的危险元素和属性，防止 XSS 攻击
 *
 * @param svgString - SVG 字符串
 * @returns 清理后的 DocumentFragment
 */
function parseSafeSVG(svgString: string): DocumentFragment {
  /**
   * 使用 DOMParser 解析 SVG 字符串
   */
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const root = doc.documentElement;

  /**
   * 检查解析结果是否为有效的 SVG
   */
  if (root === null || root.nodeName.toLowerCase() !== "svg") {
    return document.createDocumentFragment();
  }

  /**
   * 递归清理不安全的节点和属性
   */
  removeUnsafeNodes(root);

  /**
   * 创建文档片段并导入清理后的 SVG
   */
  const fragment = document.createDocumentFragment();
  fragment.appendChild(document.importNode(root, true));
  return fragment;
}

/**
 * 递归移除 SVG 中的不安全节点和属性
 *
 * @param node - 要检查的节点
 */
function removeUnsafeNodes(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
    const el = node;
    const tagName = el.tagName.toLowerCase();

    /**
     * 移除危险标签
     * script: 可执行代码
     * use: 可能引用外部资源
     * foreignObject: 可嵌入 HTML
     */
    if (["script", "use", "foreignobject"].includes(tagName)) {
      el.parentNode?.removeChild(el);
      return;
    }

    /**
     * 移除危险属性
     * - 事件处理器（on*）
     * - javascript: 协议的 href/xlink:href（包括 image 标签的外部资源引用）
     */
    Array.from(el.attributes).forEach((attr) => {
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value.toLowerCase();

      if (
        attrName.startsWith("on") ||
        ((attrName === "href" || attrName === "xlink:href") &&
          attrValue.startsWith("javascript:"))
      ) {
        el.removeAttribute(attr.name);
      }
    });

    /**
     * 递归处理子节点
     */
    Array.from(el.childNodes).forEach(removeUnsafeNodes);
  }
}

/**
 * 销毁虚拟节点及其 DOM
 * 递归触发销毁生命周期并清理资源
 *
 * @param vnode - 要销毁的虚拟节点
 */
export function destroy(vnode: VNode | string): void {
  /**
   * 字符串节点无需处理
   */
  if (typeof vnode === "string") return;

  /**
   * 触发销毁前生命周期钩子
   * 只处理当前节点，不递归（递归由 destroy 自身的递归处理）
   * 避免与 destroy 的递归叠加导致子节点生命周期被重复调用
   */
  processLifecycleForNode(vnode, "onBeforeDestroy");

  /**
   * 执行所有清理函数
   * 包括事件监听移除和指令清理
   */
  vnode._cleanups?.forEach((fn) => fn());

  /**
   * 执行 useState 订阅的取消订阅函数
   * 避免组件销毁后状态变化仍触发 updater
   */
  vnode.lifecycle?._stateCleanups?.forEach((fn) => fn());

  /**
   * 清空元素 ref（回调 / 字符串 / Signal / {current}）
   * 避免销毁后残留悬挂的 DOM 引用（安全稳定）
   */
  if (vnode.attrs) {
    clearRef(vnode.attrs.__ref ?? vnode.attrs.ref, vnode);
  }

  /**
   * 递归销毁子节点
   * 子节点的 onBeforeDestroy/onDestroyed 在各自的 destroy() 中调用
   * 销毁顺序：子先父后（子组件先从 DOM 移除，父组件后移除）
   */
  for (const child of vnode.children) {
    destroy(child);
  }

  /**
   * 从 DOM 中移除元素
   * 使用 try-catch 防止子节点已被手动移除时抛异常
   */
  if (vnode.el?.parentNode !== null && vnode.el?.parentNode !== undefined) {
    try {
      vnode.el.parentNode.removeChild(vnode.el);
    } catch {
      /** 节点已被手动移除，忽略错误 */
    }
  }

  /**
   * 触发销毁完成生命周期钩子
   * 只处理当前节点，不递归
   */
  processLifecycleForNode(vnode, "onDestroyed");
}

/**
 * 处理单个节点的生命周期钩子和 ref 设置
 * 不递归子节点，由调用方控制递归顺序
 *
 * @param vnode - 虚拟节点
 * @param method - 生命周期方法名
 */
function processLifecycleForNode(vnode: VNode, method: keyof Lifecycle): void {
  const lc = vnode.lifecycle;

  /**
   * onMounted 时先将组件根 DOM 元素设置到 lifecycle.el
   * 这样组件在 onMounted 钩子和响应式 effect 中可以通过 lifecycle.el
   * 访问自己的根元素，用于手动 DOM 更新
   */
  if (lc && method === "onMounted" && vnode.el && vnode.el instanceof Element) {
    lc.el = vnode.el;
  }

  /**
   * onMounted 时启动响应式 effect（signal/computed + onEffect）
   * - 在用户 onMounted 之前启动，完成初始渲染
   * - 此时 ref.current / lifecycle.el 已就绪
   * - dispose 收集到 _stateCleanups，destroy 时统一清理
   */
  if (lc && method === "onMounted" && lc._effects) {
    const effects = lc._effects;
    lc._effects = undefined;
    const cleanups = (lc._stateCleanups ??= []);
    for (const startEffect of effects) {
      const dispose = startEffect();
      if (dispose) {
        cleanups.push(dispose);
      }
    }
  }

  if (lc?.[method]) {
    safeCall(
      () => lc[method]!(),
      ErrorSource.LIFECYCLE,
      `生命周期钩子执行失败: ${method}`,
    );
  }

  /**
   * 组件实例 ref 处理
   * onMounted 后：将组件暴露的 API 或根 DOM 元素赋值给 ref.current
   * onDestroyed 后：清空 ref.current 防止悬挂引用
   *
   * 与 Vue3 行为一致：
   *   - 如果组件调用了 expose()，ref.current = 暴露的 API 对象
   *   - 如果组件没有 expose()，ref.current = 组件根 DOM 元素（lifecycle.el）
   *   - Vue3 中没有 expose 时 ref 指向组件实例
   *
   * ref 清空时机：onDestroyed（组件完全销毁后清空）
   * 与 Vue3 一致：onUnmounted 之后 ref 才被清空
   */
  if (vnode.lifecycle) {
    if (method === "onMounted" && vnode.lifecycle._ref) {
      const refValue = vnode.lifecycle._ref;
      /**
       * ref 赋值规则（与 Vue3 一致）：
       * 1. 组件调用了 expose() → ref = 暴露的 API 对象
       * 2. 组件未调用 expose() → ref = 组件根 DOM 元素（lifecycle.el ?? vnode.el）
       * 3. 普通 DOM 元素 → ref = DOM 元素（由 applyAttrs/hydrateNode 处理）
       */
      const exposed = vnode.lifecycle._exposed !== undefined
        ? vnode.lifecycle._exposed
        : (vnode.lifecycle.el ?? vnode.el ?? null);

      if (isSignalRef(refValue)) {
        refValue.value = exposed;
      } else if (isRefObject(refValue)) {
        refValue.current = exposed as unknown;
      }
    }
    if (method === "onDestroyed" && vnode.lifecycle._ref) {
      const refValue = vnode.lifecycle._ref;
      if (isSignalRef(refValue)) {
        refValue.value = null;
      } else if (isRefObject(refValue)) {
        refValue.current = null;
      }
    }
    // 组件销毁时清空所有模板引用 Signal，避免悬挂 DOM 引用
    if (method === "onDestroyed" && vnode.lifecycle._templateRefs) {
      for (const sig of vnode.lifecycle._templateRefs.values()) {
        sig.value = null;
      }
    }
  }
}

/**
 * 调用生命周期钩子
 * 递归遍历虚拟节点树，调用指定生命周期方法
 *
 * 递归顺序（与 Vue3 一致）：
 *   - onBeforeMount / onBeforeDestroy：父先子后（父组件先收到通知）
 *   - onMounted / onDestroyed：子先父后（子组件先完成挂载/销毁）
 *
 * 这确保了：
 *   - 父组件 onMounted 时，所有子组件已经挂载完成，ref 已设置
 *   - 父组件 onBeforeDestroy 时，子组件还未销毁，仍可访问
 *
 * @param vnode - 虚拟节点
 * @param method - 生命周期方法名
 */
export function invokeLifecycle(
  vnode: VNode | string,
  method: keyof Lifecycle,
): void {
  if (typeof vnode === "string") return;

  const isBeforePhase =
    method === "onBeforeMount" || method === "onBeforeDestroy";

  if (isBeforePhase) {
    /**
     * onBeforeMount / onBeforeDestroy：先处理当前节点，再递归子节点
     * 父组件先收到通知，子组件后收到通知
     */
    processLifecycleForNode(vnode, method);
    for (const child of vnode.children) {
      invokeLifecycle(child, method);
    }
  } else {
    /**
     * onMounted / onDestroyed：先递归子节点，再处理当前节点
     * 子组件先完成挂载/销毁，父组件后完成
     * 这确保父组件 onMounted 时可以访问子组件的 ref
     */
    for (const child of vnode.children) {
      invokeLifecycle(child, method);
    }
    processLifecycleForNode(vnode, method);
  }
}

/**
 * 客户端水合
 * 将服务端渲染的 DOM 与虚拟节点关联，绑定事件、ref、生命周期
 * 不重新创建 DOM，而是复用已有的 DOM 结构
 *
 * 水合流程（与 mount 等价，但复用已有 DOM）：
 *   1. 遍历 VNode 树，匹配已有 DOM 节点
 *   2. 将 el 存储到 vnode.el（后续 useState updater 等需要访问）
 *   3. 绑定 ref（回调 ref 和对象 ref）
 *   4. 绑定事件监听器（onClick → addEventListener）
 *   5. 收集清理函数（事件移除等，销毁时调用）
 *   6. 调用生命周期钩子（onBeforeMount → onMounted）
 *
 * @param vnode - 虚拟节点
 * @param container - 已有的 DOM 容器（包含服务端渲染的 HTML）
 */
export function hydrate(vnode: VNode | string, container: HTMLElement): void {
  if (!isBrowser()) return;

  if (typeof vnode === "string") return;

  /**
   * 从容器的第一个子节点开始顺序水合。
   *
   * 这里不能只找第一个 Element：
   * - Fragment 会直接输出多个兄弟节点
   * - 文本节点也可能是根节点或子节点
   *
   * hydrateNode() 会返回“下一个未消费的 DOM 节点”，
   * 这样才能按 SSR 输出顺序把整棵树完整对齐。
   */
  const firstChild = container.firstChild;
  if (firstChild) {
    hydrateNode(vnode, firstChild);
  }

  /**
   * 触发生命周期钩子
   * 水合完成后，与 mount 一样触发 onBeforeMount 和 onMounted
   * 这样组件的 onMounted 钩子可以安全地访问 DOM 元素
   */
  invokeLifecycle(vnode, "onBeforeMount");
  invokeLifecycle(vnode, "onMounted");
}

/**
 * 递归水合单个节点
 * 将 VNode 与已有 DOM 元素关联：存储 el、绑定 ref/事件、收集清理函数
 *
 * 水合时不重新设置属性（属性已在 SSR 中设置），只绑定事件和 ref
 *
 * @param vnode - 虚拟节点
 * @param el - 对应的已有 DOM 元素
 */
function hydrateNode(vnode: VNode, el: ChildNode): ChildNode | null {
  /**
   * 组件类型 VNode：组件函数已经在 h() 中执行过
   * 组件返回的 VNode 存储在 vnode 的结构中
   * 需要找到组件返回的实际 VNode，然后递归水合其子树
   */
  if (typeof vnode.tag === "function") {
    /**
     * 存储组件 VNode 的 el 引用
     * 组件 VNode 的 el 指向其返回的根 DOM 元素
     */
    vnode.el = el instanceof Element ? el : undefined;

    /**
     * 组件 VNode 的 children 中包含组件返回的实际 VNode
     * 需要递归水合这些子 VNode
     * 注意：defineComponent 返回的 VNode 结构中，
     * 组件返回的 VNode 就是 vnode 本身（tag 已经被替换为实际标签）
     * 但函数组件的 vnode.tag 仍然是函数，需要跳过组件层直接水合子节点
     */
    const children = vnode.children || [];
    let domChild: ChildNode | null = el.firstChild;
    for (const child of children) {
      if (typeof child === "string") {
        domChild = domChild?.nextSibling ?? null;
        continue;
      }
      if (child && domChild) {
        // ★ 建立 __parent 链（与 materialize 一致），供 useTemplateRef 字符串 ref 沿链解析
        if (child.__parent === undefined) child.__parent = vnode;
        domChild = hydrateNode(child, domChild);
      }
    }
    return el.nextSibling;
  }

  /**
   * Fragment 不对应真实 DOM 节点，它直接消费一段连续的兄弟节点。
   * 这里必须顺序递归并返回最后一个子节点之后的节点，
   * 否则多根 SSR 输出只能绑定到第一个子节点。
   */
  if (String(vnode.tag).toLowerCase() === "fragment") {
    let current: ChildNode | null = el;
    for (const child of vnode.children || []) {
      if (!current) break;
      if (typeof child === "string") {
        current = current.nextSibling;
        continue;
      }
      // ★ 建立 __parent 链（与 materialize 一致）
      if (child.__parent === undefined) child.__parent = vnode;
      current = hydrateNode(child, current);
    }
    return current;
  }

  /**
   * 原生元素：存储 el、绑定 ref、绑定事件、收集清理函数
   * 与 mount 中的 applyAttrs 逻辑等价，但不设置属性（属性已在 SSR 中设置）
   *
   * 使用 instanceof Element 判断，覆盖 HTMLElement 和 SVGElement
   * （SVGElement 继承自 Element，SVGAElement 只是 <a> 元素的类型）
   */
  if (el instanceof Element) {
    /**
     * Mismatch 检测：检查 VNode.tag 与 DOM tagName 是否匹配
     * SSR 和客户端渲染结果不一致时，开发环境输出警告
     * 不匹配时不中断水合，继续绑定事件和 ref
     */
    const vnodeTag = String(vnode.tag).toLowerCase();
    const domTag = el.tagName.toLowerCase();
    if (vnodeTag !== "fragment" && vnodeTag !== domTag) {
      if (isDev()) {
        console.warn(
          `[HiliFramework/hydrate] 标签不匹配: VNode 标签 "${vnodeTag}" 与 DOM 标签 "${domTag}" 不一致`,
        );
      }
    }

    /** 存储 DOM 引用到 vnode，后续 useState updater 等需要访问 */
    vnode.el = el;

    const attrs = vnode.attrs || {};

    /**
     * 清理函数数组
     * 收集事件监听的移除函数，销毁时统一调用
     */
    const cleanups: (() => void)[] = [];

    /**
     * 绑定 ref（统一支持回调 / 字符串模板引用 / Signal / 旧 {current} 对象）
     *
     * ★ 优先读取编译期预分类的 __ref（与 applyAttrs 一致）
     * 编译器将 ref → __ref，若只读 attrs.ref，编译产物水合时 ref 会全部失效
     */
    bindRef(attrs.__ref ?? attrs.ref, el, vnode);

    /**
     * 绑定事件监听器
     * SSR 输出的 HTML 中没有事件（onclick 等不序列化到 HTML）
     * 水合时必须重新绑定所有事件监听器
     *
     * ★ 优先使用编译期预分类的 __events（与 applyAttrs 一致）
     * 编译器将 onXxx → __events: { xxx: handler }，跳过 startsWith+typeof 检查
     */
    const preClassifiedEvents = attrs.__events as Record<string, EventListener> | undefined;
    if (preClassifiedEvents) {
      for (const eventName in preClassifiedEvents) {
        if (!Object.prototype.hasOwnProperty.call(preClassifiedEvents, eventName)) continue;
        const handler = preClassifiedEvents[eventName];
        if (typeof handler === "function") {
          el.addEventListener(eventName, handler);
          cleanups.push(() => el.removeEventListener(eventName, handler));
        }
      }
    } else {
      // fallback：未编译代码，遍历 attrs 按 onXxx 约定查找
      for (const key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
        if (!key.startsWith("on") || typeof attrs[key] !== "function") continue;

        const eventType = key.slice(2).toLowerCase();
        const handler: EventListener = attrs[key] as EventListener;
        el.addEventListener(eventType, handler);
        cleanups.push(() => el.removeEventListener(eventType, handler));
      }
    }

    /**
     * 处理指令（与 mount 中的 applyAttrs 逻辑一致）
     * 水合时也需要执行指令，否则指令不生效
     */
    if (attrs.directives && Array.isArray(attrs.directives)) {
      for (const entry of attrs.directives) {
        if (!isDirectiveEntry(entry)) continue;
        const [dir, val] = entry;
        const cleanup = dir(el, val);
        if (cleanup !== undefined) {
          cleanups.push(cleanup);
        }
      }
    }

    /**
     * 保存清理函数到虚拟节点
     * 销毁时统一调用，移除所有事件监听和指令清理
     */
    vnode._cleanups = cleanups;

    /**
     * 处理组件实例 ref（lifecycle._ref）
     * 如果该元素是组件的根元素，且组件有 expose API，
     * 在 onMounted 后将 exposed API 赋值给 ref.current
     * 这部分在 invokeLifecycle 中处理
     */
  }

  /**
   * 递归水合子节点
   * VNode 子节点与 DOM 子节点一一对应
   */
  const children = vnode.children || [];
  let domChild = el.firstChild;

  for (const child of children) {
    if (typeof child === "string") {
      domChild = domChild?.nextSibling ?? null;
      continue;
    }
    if (child && domChild) {
      // ★ 建立 __parent 链（与 materialize 一致），供 useTemplateRef 字符串 ref 沿链解析
      if (child.__parent === undefined) child.__parent = vnode;
      domChild = hydrateNode(child, domChild);
    }
  }
  return el.nextSibling;
}
