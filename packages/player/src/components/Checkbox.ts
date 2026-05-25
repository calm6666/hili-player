/**
 * ============================================
 * 复选框组件
 * ============================================
 * 使用 h 函数实现的复选框组件
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * 复选框组件 Props 接口
 */
export interface CheckboxProps {
  /** 是否选中 */
  checked?: boolean;
  /** 标签文本 */
  label?: string;
  /** 值变化回调 */
  onChange?: (checked: boolean) => void;
  /** 点击回调 */
  onClick?: () => void;
}

/**
 * 复选框组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Checkbox = defineComponent<CheckboxProps>((props) => {
  /**
   * 当前选中状态
   * 使用闭包变量保存状态
   */
  let checked = props.checked ?? false;

  /**
   * 复选框盒子元素引用
   */
  const checkboxBoxRef: { current: HTMLSpanElement | null } = { current: null };

  /**
   * 处理点击事件
   * 切换选中状态并触发回调
   */
  const handleClick = (): void => {
    checked = !checked;

    /**
     * 更新 DOM 类名
     */
    if (checkboxBoxRef.current) {
      if (checked) {
        checkboxBoxRef.current.classList.add('checkbox-checked');
      } else {
        checkboxBoxRef.current.classList.remove('checkbox-checked');
      }
    }

    /**
     * 触发回调
     */
    props.onChange?.(checked);
    props.onClick?.();
  };

  /**
   * 渲染标签元素
   */
  const renderLabel = (): VNode | null => {
    if (!props.label) {
      return null;
    }

    return h('span', {
      class: 'checkbox-label',
    }, props.label);
  };

  return h('div', {
    class: 'u-checkbox',
  },
    h('div', {
      class: 'u-checkbox-wrap',
    },
      h('div', {
        class: 'u-checkbox-box',
        onClick: handleClick,
      },
        h('span', {
          class: 'checkbox-box',
          ref: checkboxBoxRef,
        }),
        renderLabel()
      )
    )
  );
});
