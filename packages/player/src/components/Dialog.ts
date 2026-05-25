/**
 * ============================================
 * 对话框组件
 * ============================================
 * 使用 h 函数实现的对话框组件
 */

import { h, defineComponent } from '@/core';

/**
 * 对话框组件 Props 接口
 */
export interface DialogProps {
  /** 是否显示 */
  visible?: boolean;
  /** 内容 */
  content?: string;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 对话框组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Dialog = defineComponent<DialogProps>((props) => {
  return h(
    'div',
    {
      class: 'player-dialog-wrap',
      style: {
        display: props.visible ? '' : 'none',
      },
    },
    props.content ?? ''
  );
});
