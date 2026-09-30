/**
 * ============================================
 * 开关组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';

/**
 * 开关尺寸类型
 * small: 小尺寸, middle: 中尺寸, large: 大尺寸
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
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 选中状态变化时的回调函数 */
  onChange?: (checked: boolean) => void;
}

/**
 * 开关组件
 */
export const Switch = defineComponent<SwitchProps>((props, lifecycle: ComponentLifecycle) => {
  /**
   * 当前选中状态
   */
  let checked = props.checked ?? false;

  /**
   * 当前禁用状态
   */
  let disabled = props.disabled ?? false;

  /**
   * 开关根元素引用
   */
  const switchRef = useTemplateRef<HTMLDivElement>(lifecycle, 'switchRef');

  /**
   * 处理开关状态切换事件
   * 禁用状态下不响应，否则切换选中状态并更新 DOM 样式和触发回调
   */
  const handleChange = (): void => {
    if (disabled) {
      return;
    }

    checked = !checked;

    // 更新 DOM 类名
    if (switchRef.value) {
      if (checked) {
        switchRef.value.classList.add('switch-checked');
      } else {
        switchRef.value.classList.remove('switch-checked');
      }
    }

    // 触发回调
    props.onChange?.(checked);
  };

  /**
   * 渲染加载图标
   * @returns 加载图标 VNode，若非加载状态则返回 null
   */
  const renderLoadingIcon = (): VNode | null => {
    if (!props.loading) {
      return null;
    }

    return null;
  };

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 外部设置选中状态
   * @param value - 是否选中
   */
  const setChecked = (value: boolean): void => {
    checked = value;
    if (switchRef.value) {
      if (checked) {
        switchRef.value.classList.add('switch-checked');
      } else {
        switchRef.value.classList.remove('switch-checked');
      }
    }
  };

  /**
   * 外部设置禁用状态
   * @param value - 是否禁用
   */
  const setDisabled = (value: boolean): void => {
    disabled = value;
    if (switchRef.value) {
      if (disabled) {
        switchRef.value.classList.add('switch-disabled');
      } else {
        switchRef.value.classList.remove('switch-disabled');
      }
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，向外暴露设置选中状态和禁用状态的方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('switchMounted', { setChecked, setDisabled });
  };

  /**
   * 组件销毁前的回调，清理 DOM 引用
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  return h('div', {
    class: 'ui-switch',
    ref: 'switchRef',
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
