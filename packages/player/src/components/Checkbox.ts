/**
 * ============================================
 * 复选框组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';

/**
 * 复选框组件 Props 接口
 */
export interface CheckboxProps {
  /** 是否选中 */
  checked?: boolean;
  /** 标签文本 */
  label?: string;
  /** 选中状态变化时的回调函数 */
  onChange?: (checked: boolean) => void;
  /** 复选框点击时的回调函数 */
  onClick?: () => void;
}

/**
 * 复选框组件
 */
export const Checkbox = defineComponent<CheckboxProps>((props, lifecycle: ComponentLifecycle) => {
  /**
   * 当前选中状态
   */
  let checked = props.checked ?? false;

  /**
   * 复选框盒子元素引用
   */
  const checkboxBoxRef = useTemplateRef<HTMLSpanElement>(lifecycle, 'checkboxBoxRef');

  /**
   * 处理点击事件
   * 切换选中状态并更新 DOM 样式和触发回调
   */
  const handleClick = (): void => {
    checked = !checked;

    // 更新 DOM 类名
    if (checkboxBoxRef.value) {
      if (checked) {
        checkboxBoxRef.value.classList.add('checkbox-checked');
      } else {
        checkboxBoxRef.value.classList.remove('checkbox-checked');
      }
    }

    // 触发回调
    props.onChange?.(checked);
    props.onClick?.();
  };

  /**
   * 渲染标签元素
   * @returns 标签 VNode，若无标签则返回 null
   */
  const renderLabel = (): VNode | null => {
    if (!props.label) {
      return null;
    }

    return h('span', {
      class: 'checkbox-label',
    }, props.label);
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
    if (checkboxBoxRef.value) {
      if (checked) {
        checkboxBoxRef.value.classList.add('checkbox-checked');
      } else {
        checkboxBoxRef.value.classList.remove('checkbox-checked');
      }
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，向外暴露设置选中状态的方法
   */
  lifecycle.onMounted = (): void => {
    // 挂载时按初始 checked 落一次选中样式（否则 checked:true 的框看起来是未选中）
    setChecked(checked);
    lifecycle.emit?.('checkboxMounted', { setChecked });
  };

  /**
   * 组件销毁前的回调，清理 DOM 引用
   */
  lifecycle.onBeforeDestroy = (): void => {
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
          ref: 'checkboxBoxRef',
        }),
        renderLabel()
      )
    )
  );
});
