/**
 * ============================================
 * 加载组件
 * ============================================
 * 声明式响应式版本：显示状态与提示文本由内部 signal 驱动，
 * 渲染层零 DOM 操作（class 由编译器自动包装为 __reactiveAttrs，
 * 文本由 _reactiveText 精准更新）。
 *
 * 对外保留 show/hide/setText 命令式 API 契约不变
 * （父组件经 loadingMounted 持有引用，零改动）；
 * API 内部仅写 signal，不再触碰 DOM。
 */

import { h, defineComponent, signal } from "@/core";
import type { ComponentLifecycle } from "@/types";

/**
 * 加载组件 Props 接口
 */
export interface LoadingProps {
  /** 是否显示加载状态（仅作初值快照；原实现初始渲染不带 state-loading 类，此字段不参与初值） */
  loading?: boolean;
  /** 加载提示文本（仅作初值快照，运行时由 setText 更新） */
  text?: string;
}

/**
 * 加载组件
 */
export const Loading = defineComponent<LoadingProps>(
  (props, lifecycle: ComponentLifecycle) => {
    // ============================================
    // 响应式状态（渲染层唯一数据源）
    // ============================================

    /**
     * 是否显示加载面板
     * 初值语义与原实现严格一致：原实现初始渲染不带 state-loading 类
     * （面板 scss 默认 display:none），仅外部调用 show() 后可见；
     * props.loading === false 分支的 hide() 是无操作，故初值恒为 false
     */
    const visibleSig = signal<boolean>(false);

    /** 加载提示文本（初值取 props 一次性快照，替代原 onMounted 的 textContent 写入） */
    const textSig = signal<string>(props.text ?? "");

    // ============================================
    // 对外命令式 API（契约与原实现完全一致）
    // ——内部仅写 signal，渲染层声明式自动更新
    // ============================================

    /**
     * 显示加载面板
     *
     * 可见性由既有类名 state-loading 驱动
     * （.nova-player-loading-panel.state-loading { display: block }）。
     * 原实现的 style.display = "" 仅清除内联 display，本组件从未写入过内联
     * display，声明式下无需保留该操作。
     */
    const show = (): void => {
      visibleSig.value = true;
    };

    /**
     * 隐藏加载面板，移除加载状态样式
     */
    const hide = (): void => {
      visibleSig.value = false;
    };

    /**
     * 设置加载提示文本
     * @param text - 提示文本内容
     */
    const setText = (text: string): void => {
      textSig.value = text;
    };

    // ============================================
    // 生命周期钩子
    // ============================================

    lifecycle.onMounted = (): void => {
      // 原实现的初始 props 处理已由 signal 初值覆盖：
      // - props.loading === false → hide()（无操作，初始本就隐藏）
      // - props.text 有值 → textSig 初值直接渲染（原为 onMounted 写 textContent）
      lifecycle.emit?.("loadingMounted", {
        show,
        hide,
        setText,
      });
    };

    // ============================================
    // 声明式渲染（零 DOM 操作）：
    // - class 内的 signal 访问由编译器包装为 __reactiveAttrs，
    //   signal 变化时自动 normalizeClass 重新应用 state-loading
    // - 文本使用显式 getter 协议，textSig 变化精准更新文本节点
    // ============================================

    return h(
      "div",
      {
        class: [
          "nova-player-loading-panel",
          { "state-loading": visibleSig.value },
        ],
      },
      h(
        "div",
        { class: "nova-player-loading-panel-text" },
        () => textSig.value,
      ),
      h(
        "div",
        {
          class: "nova-player-loading-panel-blur",
        },
        h("div", {
          class: "nova-player-loading-panel-blur-detail",
        }),
      ),
    );
  },
);
