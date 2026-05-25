/**
 * ============================================
 * DOM 挂载与渲染模块
 * ============================================
 * 提供将虚拟节点转换为真实 DOM 并挂载的功能
 * 包含属性应用、事件绑定、指令处理等
 * 支持服务端渲染(SSR)环境
 */

import type { VNode, VNodeAttrs, Lifecycle } from '@/types';
import { isBrowser } from '@/utils';

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
    invokeLifecycle(vnode, 'onBeforeMount');
    invokeLifecycle(vnode, 'onMounted');
    return;
  }

  /**
   * 将虚拟节点物化为真实 DOM
   * 递归创建所有子节点
   */
  const el = materialize(vnode);

  /**
   * 将生成的 DOM 插入容器
   */
  container.appendChild(el);

  /**
   * 触发生命周期钩子
   * 先触发 onBeforeMount，再触发 onMounted
   */
  invokeLifecycle(vnode, 'onBeforeMount');
  invokeLifecycle(vnode, 'onMounted');
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
  if (typeof vnode === 'string') {
    return document.createTextNode(vnode);
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
  const el = ns !== undefined
    ? document.createElementNS(ns, vnode.tag as string)
    : document.createElement(vnode.tag as string);

  /**
   * 应用属性到元素
   * 包括 HTML 属性、事件监听、指令等
   */
  applyAttrs(el as HTMLElement, vnode.attrs, vnode);

  /**
   * 递归物化并挂载子节点
   * 使用 DocumentFragment 批量插入，减少重排次数
   */
  if (vnode.children.length > 0) {
    const fragment = document.createDocumentFragment();
    for (const child of vnode.children) {
      fragment.appendChild(materialize(child));
    }
    el.appendChild(fragment);
  }

  /**
   * 保存真实 DOM 引用到虚拟节点
   * 便于后续直接操作
   */
  vnode.el = el as HTMLElement;

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
  if (typeof vnode === 'string') {
    return { nodeType: Node.TEXT_NODE, textContent: vnode } as unknown as Node;
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
  } as unknown as HTMLElement;

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

  return mockEl as unknown as Node;
}

/**
 * 应用属性到 DOM 元素
 * 处理各种类型的属性：普通属性、事件、样式、指令、ref 等
 *
 * @param el - 目标 DOM 元素
 * @param attrs - 属性对象
 * @param vnode - 所属虚拟节点（用于存储清理函数）
 */
export function applyAttrs(
  el: HTMLElement,
  attrs: VNodeAttrs,
  vnode: VNode
): void {
  /**
   * 判断是否为 SVG 元素
   * SVG 元素需要使用 setAttribute 设置属性
   */
  const isSvg = el.namespaceURI === 'http://www.w3.org/2000/svg';

  /**
   * 清理函数数组
   * 用于存储事件监听和指令的清理函数
   */
  const cleanups: (() => void)[] = [];

  /**
   * 第一步：先处理 ref
   * 支持两种形式：
   * 1. 回调函数：ref: (el) => { element = el }
   * 2. 直接绑定对象：ref: elementRef，其中 elementRef = { current: null }
   *    h函数内部会将 el 赋值给 elementRef.current
   *
   * 确保在事件绑定前，ref 已经被设置
   * 这样事件处理函数中可以使用 ref 获取的元素
   */
  const refValue = attrs.ref;
  if (refValue !== undefined && refValue !== null) {
    if (typeof refValue === 'function') {
      // 回调函数形式
      (refValue as (el: HTMLElement) => void)(el);
    } else if (typeof refValue === 'object' && 'current' in refValue) {
      // 直接绑定对象形式 { current: null }
      (refValue as { current: HTMLElement | null }).current = el;
    }
  }

  /**
   * 第二步：处理其他属性
   */
  for (const key in attrs) {
    if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;

    const value = attrs[key];

    /**
     * 跳过空值和内部属性
     */
    if (value === null || value === undefined) continue;

    /**
     * 跳过已处理的 ref
     */
    if (key === 'ref') continue;

    /**
     * 处理指令数组
     * 二维数组格式：[[directiveFn, value], ...]
     * 每个指令执行后可能返回清理函数
     */
    if (key === 'directives' && Array.isArray(value)) {
      for (const [dir, val] of value as [((el: HTMLElement, val: unknown) => (() => void) | undefined), unknown][]) {
        const cleanup = dir(el, val);
        if (cleanup !== undefined) cleanups.push(cleanup);
      }
    }
    /**
     * 处理 SVG 内容注入
     * 安全地解析并插入 SVG 字符串
     */
    else if (key === 'svgContent' && typeof value === 'string') {
      const fragment = parseSafeSVG(value);
      el.appendChild(fragment);
    }
    /**
     * 处理事件监听
     * 以 'on' 开头的属性视为事件处理函数
     */
    else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      const handler = value as EventListener;
      el.addEventListener(event, handler);
      cleanups.push(() => el.removeEventListener(event, handler));
    }
    /**
     * 处理样式对象
     * 支持传入对象形式的内联样式
     */
    else if (key === 'style' && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(el.style, value as Record<string, string>);
    }
    /**
     * 处理 className（映射为 class）
     */
    else if (key === 'className') {
      el.setAttribute('class', String(value));
    }
    /**
     * 处理普通属性
     * SVG 元素或 class 属性使用 setAttribute
     * 其他属性优先使用 DOM 属性，不存在则使用 setAttribute
     */
    else {
      if (isSvg || key === 'class') {
        el.setAttribute(key, String(value));
      } else if (key in el) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (el as unknown as Record<string, unknown>)[key] = value;
      } else {
        el.setAttribute(key, String(value));
      }
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
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const root = doc.documentElement;

  /**
   * 检查解析结果是否为有效的 SVG
   */
  if (root === null || root.nodeName.toLowerCase() !== 'svg') {
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
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tagName = el.tagName.toLowerCase();

    /**
     * 移除危险标签
     * script: 可执行代码
     * use: 可能引用外部资源
     * foreignObject: 可嵌入 HTML
     */
    if (['script', 'use', 'foreignobject'].includes(tagName)) {
      el.parentNode?.removeChild(el);
      return;
    }

    /**
     * 移除危险属性
     * - 事件处理器（on*）
     * - javascript: 协议的 href
     */
    Array.from(el.attributes).forEach(attr => {
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value.toLowerCase();

      if (
        attrName.startsWith('on') ||
        (attrName === 'href' && attrValue.startsWith('javascript:'))
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
  if (typeof vnode === 'string') return;

  /**
   * 触发销毁前生命周期钩子
   */
  invokeLifecycle(vnode, 'onBeforeDestroy');

  /**
   * 执行所有清理函数
   * 包括事件监听移除和指令清理
   */
  vnode._cleanups?.forEach(fn => fn());

  /**
   * 递归销毁子节点
   */
  for (const child of vnode.children) {
    destroy(child);
  }

  /**
   * 从 DOM 中移除元素
   */
  if (vnode.el?.parentNode !== null && vnode.el?.parentNode !== undefined) {
    vnode.el.parentNode.removeChild(vnode.el);
  }

  /**
   * 触发销毁完成生命周期钩子
   */
  invokeLifecycle(vnode, 'onDestroyed');
}

/**
 * 调用生命周期钩子
 * 递归遍历虚拟节点树，调用指定生命周期方法
 *
 * @param vnode - 虚拟节点
 * @param method - 生命周期方法名
 */
export function invokeLifecycle(
  vnode: VNode | string,
  method: keyof Lifecycle
): void {
  if (typeof vnode === 'string') return;

  /**
   * 调用当前节点的生命周期方法
   */
  vnode.lifecycle?.[method]?.();

  /**
   * 递归调用子节点的生命周期方法
   */
  for (const child of vnode.children) {
    invokeLifecycle(child, method);
  }
}
