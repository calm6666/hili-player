/**
 * ============================================
 * Toast 提示组件
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';

/**
 * Toast 组件 Props 接口
 */
export interface ToastProps {
  /** 是否显示 Toast 提示 */
  visible?: boolean;
  /** 提示文本内容 */
  text?: string;
  /** 跳转目标时间点，格式为 "mm:ss" */
  jumpTime?: string;
  /** 关闭固定提示时的回调函数 */
  onClose?: () => void;
  /** 点击跳转按钮时的回调函数 */
  onJump?: () => void;
}

/**
 * Toast 提示组件
 * 提供自动消失的短暂提示和带跳转功能的固定提示两种模式
 */
export const Toast = defineComponent<ToastProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 自动消失提示的 DOM 容器引用 */
  const autoToastRef = ref<HTMLDivElement>();

  /** 固定提示的 DOM 容器引用 */
  const fixedToastRef = ref<HTMLDivElement>();

  /** 固定提示中的文本元素引用 */
  const fixedTextRef = ref<HTMLSpanElement>();

  /** 固定提示中的时间元素引用 */
  const fixedTimeRef = ref<HTMLSpanElement>();

  // ============================================
  // 事件处理函数
  // ============================================

  /** 自动隐藏定时器，用于控制自动提示的延迟消失 */
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
  // 手动 DOM 更新函数
  // ============================================

  /**
   * 显示自动消失的短暂提示
   * @param text - 提示文本内容
   * @param duration - 显示持续时间（毫秒），默认 3000ms
   */
  const showAutoToast = (text: string, duration?: number): void => {
    if (autoToastRef.current) {
      autoToastRef.current.textContent = text;
      autoToastRef.current.style.display = '';
    }
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
    if (autoToastRef.current) {
      autoToastRef.current.style.display = 'none';
    }
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
    if (fixedTextRef.current) {
      fixedTextRef.current.textContent = text;
    }
    if (fixedTimeRef.current) {
      fixedTimeRef.current.textContent = jumpTime;
    }
    if (fixedToastRef.current) {
      fixedToastRef.current.style.display = '';
    }
  };

  /** 隐藏固定提示 */
  const hideFixedToast = (): void => {
    if (fixedToastRef.current) {
      fixedToastRef.current.style.display = 'none';
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /** 组件挂载后初始化提示状态并对外暴露控制方法 */
  lifecycle.onMounted = (): void => {
    // 初始状态：隐藏所有提示
    hideAutoToast();
    hideFixedToast();

    lifecycle.emit?.('toastMounted', {
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
  // 主渲染函数
  // ============================================

  return h(
    'div',
    { class: 'player-toast-wrap' },
    h('div', { class: 'player-toast-auto', ref: autoToastRef }),
    h(
      'div',
      { class: 'player-toast-fixed', ref: fixedToastRef },
      h(
        'div',
        { class: 'player-toast-close', onClick: handleClose },
        h('span', { class: 'common-svg-icon' }, '×')
      ),
      h('span', { class: 'player-toast-text', ref: fixedTextRef }, props.text ?? '记忆你上次看到'),
      h('span', { class: 'player-toast-time', ref: fixedTimeRef }, props.jumpTime ?? '00:00'),
      h('span', { class: 'player-toast-jump', onClick: handleJump }, '跳转')
    )
  );
});
