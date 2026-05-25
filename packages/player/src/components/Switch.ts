/**
 * ============================================
 * 开关组件
 * ============================================
 * 使用 h 函数实现的开关组件
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * 开关尺寸类型
 */
export type SwitchSize = 'small' | 'middle' | 'large';

/**
 * 开关组件 Props 接口
 */
export interface SwitchProps {
  /** 开关尺寸 */
  size?: SwitchSize;
  /** 是否选中 */
  checked?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 值变化回调 */
  onChange?: (checked: boolean) => void;
}

/**
 * 开关组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Switch = defineComponent<SwitchProps>((props) => {
  /**
   * 当前选中状态
   */
  let checked = props.checked ?? false;

  /**
   * 开关根元素引用
   */
  const switchRef: { current: HTMLDivElement | null } = { current: null };

  /**
   * 处理 change 事件
   */
  const handleChange = (): void => {
    if (props.disabled) {
      return;
    }

    checked = !checked;

    /**
     * 更新 DOM 类名
     */
    if (switchRef.current) {
      if (checked) {
        switchRef.current.classList.add('switch-checked');
      } else {
        switchRef.current.classList.remove('switch-checked');
      }
    }

    /**
     * 触发回调
     */
    props.onChange?.(checked);
  };

  /**
   * 渲染加载图标
   */
  const renderLoadingIcon = (): VNode | null => {
    if (!props.loading) {
      return null;
    }

    /**
     * 这里可以返回加载图标
     * 简化起见，返回一个文本节点
     */
    return null;
  };

  return h('div', {
    class: 'ui-switch',
    ref: switchRef,
  },
    h('input', {
      type: 'checkbox',
      checked: checked,
      onChange: handleChange,
    }),
    h('div', {
      class: 'switch-inner',
    }),
    h('div', {
      class: 'switch-circle',
    }, renderLoadingIcon())
  );
});
