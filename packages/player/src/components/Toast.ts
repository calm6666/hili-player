/**
 * ============================================
 * Toast 提示组件
 * ============================================
 * 提供自动消失的短暂提示和带跳转功能的固定提示两种模式
 *
 * 声明式响应式版本：两类提示的可见性与文本由内部 signal 驱动，
 * 外层容器（.nova-player-toast-wrap）的可见性由两个可见性 signal 派生，
 * 渲染层零 DOM 操作（style 由编译器自动包装为 __reactiveAttrs）。
 *
 * 对外保留 showAutoToast/hideAutoToast/showFixedToast/hideFixedToast
 * 命令式 API 契约不变（父组件经 toastMounted 持有引用，零改动）；
 * API 内部仅写 signal，不再触碰 DOM。
 */

import { h, defineComponent, signal, t } from "@/core";
import { Close } from "@/nova/components/icons";
import type { ComponentLifecycle } from "@/types";

/**
 * Toast 组件 Props 接口
 */
export interface ToastProps {
  /** 是否显示 Toast 提示（保留字段：原实现初始即隐藏，此字段不参与初值） */
  visible?: boolean;
  /** 提示文本内容（仅作初值快照，运行时由 showFixedToast 更新） */
  text?: string;
  /** 跳转目标时间点，格式为 "mm:ss"（仅作初值快照） */
  jumpTime?: string;
  /** 关闭固定提示时的回调函数 */
  onClose?: () => void;
  /** 点击跳转按钮时的回调函数 */
  onJump?: () => void;
}

/**
 * Toast 提示组件
 */
export const Toast = defineComponent<ToastProps>(
  (props, lifecycle: ComponentLifecycle) => {
    // ============================================
    // 响应式状态（渲染层唯一数据源）
    // ============================================

    /**
     * 自动消失提示是否可见
     * 初值 false：与原实现 onMounted 调用 hideAutoToast() 的初始隐藏语义一致
     */
    const autoVisibleSig = signal<boolean>(false);

    /** 自动消失提示文本 */
    const autoTextSig = signal<string>("");

    /**
     * 固定提示是否可见
     * 初值 false：与原实现 onMounted 调用 hideFixedToast() 的初始隐藏语义一致
     */
    const fixedVisibleSig = signal<boolean>(false);

    /**
     * 固定提示文本（null 表示未设置，渲染时回落到既有 i18n 文案）
     * 保留 null 回落结构：getter 内 t() 读取 localeSignal，
     * 语言动态切换时文案精准更新（原实现为一次性快照，此处行为兼容且增强）
     */
    const fixedTextSig = signal<string | null>(props.text ?? null);

    /** 固定提示跳转时间（null 表示未设置，渲染时回落 "00:00"） */
    const fixedTimeSig = signal<string | null>(props.jumpTime ?? null);

    // ============================================
    // 事件处理函数
    // ============================================

    /** 自动隐藏定时器，用于控制自动提示的延迟消失（时序行为，保留命令式） */
    let autoToastTimer: ReturnType<typeof setTimeout> | null = null;

    /** 关闭固定提示并触发 onClose 回调 */
    const handleClose = (): void => {
      hideFixedToast();
      props.onClose?.();
    };

    /** 触发跳转回调，跳转到指定时间点 */
    const handleJump = (): void => {
      props.onJump?.();
    };

    // ============================================
    // 对外命令式 API（契约与原实现完全一致）
    // ——内部仅写 signal，容器/提示的可见性与文本由渲染层自动同步
    // ============================================

    /**
     * 显示自动消失的短暂提示
     * @param text - 提示文本内容
     * @param duration - 显示持续时间（毫秒），默认 3000ms
     */
    const showAutoToast = (text: string, duration?: number): void => {
      autoTextSig.value = text;
      autoVisibleSig.value = true;
      // 清除之前的定时器
      if (autoToastTimer !== null) {
        clearTimeout(autoToastTimer);
        autoToastTimer = null;
      }
      /** 自动隐藏的延迟时间（毫秒） */
      const timeout = duration ?? 3000;
      autoToastTimer = setTimeout(() => {
        hideAutoToast();
      }, timeout);
    };

    /** 隐藏自动消失的短暂提示 */
    const hideAutoToast = (): void => {
      autoVisibleSig.value = false;
      if (autoToastTimer !== null) {
        clearTimeout(autoToastTimer);
        autoToastTimer = null;
      }
    };

    /**
     * 显示固定提示（带关闭和跳转功能）
     * @param text - 提示文本内容
     * @param jumpTime - 跳转目标时间点字符串
     */
    const showFixedToast = (text: string, jumpTime: string): void => {
      fixedTextSig.value = text;
      fixedTimeSig.value = jumpTime;
      fixedVisibleSig.value = true;
    };

    /** 隐藏固定提示 */
    const hideFixedToast = (): void => {
      fixedVisibleSig.value = false;
    };

    // ============================================
    // 生命周期钩子
    // ============================================

    /** 组件挂载后对外暴露控制方法（初始隐藏已由 signal 初值覆盖） */
    lifecycle.onMounted = (): void => {
      lifecycle.emit?.("toastMounted", {
        showAutoToast,
        hideAutoToast,
        showFixedToast,
        hideFixedToast,
      });
    };

    /** 组件销毁前清理定时器 */
    lifecycle.onBeforeDestroy = (): void => {
      // 清理定时器
      if (autoToastTimer !== null) {
        clearTimeout(autoToastTimer);
        autoToastTimer = null;
      }
    };

    // ============================================
    // 声明式渲染（零 DOM 操作）：
    // - 外层容器可见性 = 任一提示可见（flex/none），
    //   与原 updateWrapVisibility 的语义一致
    // - 各提示的 display 由自身可见性 signal 驱动
    // - 文本使用显式 getter 协议（signal + t() 内的 localeSignal 双依赖）
    // ============================================

    return h(
      "div",
      {
        class: "nova-player-toast-wrap",
        style: {
          display:
            autoVisibleSig.value || fixedVisibleSig.value ? "flex" : "none",
        },
      },
      h(
        "div",
        {
          class: "nova-player-toast-auto",
          style: { display: autoVisibleSig.value ? "" : "none" },
        },
        () => autoTextSig.value,
      ),
      h(
        "div",
        {
          class: "nova-player-toast-fixed",
          style: { display: fixedVisibleSig.value ? "" : "none" },
        },
        h(
          "div",
          { class: "nova-player-toast-close", onClick: handleClose },
          // 关闭图标使用既有实现 icons 的 Close SVG（禁止用 unicode 字符当图标）
          h("span", { class: "common-svg-icon" }, Close()),
        ),
        h(
          "span",
          { class: "nova-player-toast-text" },
          () => fixedTextSig.value ?? t("player.ui.toast.last_seen"),
        ),
        h(
          "span",
          { class: "nova-player-toast-time" },
          () => fixedTimeSig.value ?? "00:00",
        ),
        h(
          "span",
          { class: "nova-player-toast-jump", onClick: handleJump },
          t("player.ui.toast.jump"),
        ),
      ),
    );
  },
);
