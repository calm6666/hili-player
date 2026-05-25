/**
 * ============================================
 * Toast 提示组件
 * ============================================
 * 使用 h 函数实现的 Toast 提示组件
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * Toast 组件 Props 接口
 */
export interface ToastProps {
  /** 是否显示 */
  visible?: boolean;
  /** 提示文本 */
  text?: string;
  /** 跳转时间 */
  jumpTime?: string;
  /** 关闭回调 */
  onClose?: () => void;
  /** 跳转回调 */
  onJump?: () => void;
}

/**
 * Toast 提示组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Toast = defineComponent<ToastProps>((props) => {
  /**
   * 处理关闭
   */
  const handleClose = (): void => {
    props.onClose?.();
  };

  /**
   * 处理跳转
   */
  const handleJump = (): void => {
    props.onJump?.();
  };

  /**
   * 渲染固定提示内容
   */
  const renderFixedContent = (): VNode | null => {
    if (!props.visible) {
      return null;
    }

    return h(
      'div',
      { class: 'player-toast-fixed' },
      h(
        'div',
        { class: 'player-toast-close', onClick: handleClose },
        h('span', { class: 'common-svg-icon' }, '×')
      ),
      h('span', { class: 'player-toast-text' }, props.text ?? '记忆你上次看到'),
      h('span', { class: 'player-toast-time' }, props.jumpTime ?? '00:00'),
      h('span', { class: 'player-toast-jump', onClick: handleJump }, '跳转')
    );
  };

  return h(
    'div',
    { class: 'player-toast-wrap' },
    h('div', { class: 'player-toast-auto' }),
    renderFixedContent()
  );
});
