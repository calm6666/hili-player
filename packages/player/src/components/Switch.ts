/**
 * ============================================
 * 开关组件 (Switch)
 * ============================================
 *
 * DOM 结构与 CSS 类名与既有实现保持一致：
 *   .ui-switch（根节点，携带 switch-small / switch-middle / switch-large、
 *              switch-checked / switch-disabled 状态类）
 *     input[type="checkbox"]
 *     .switch-inner
 *     .switch-circle（loading 态时插入加载图标）
 *
 * 行为：input change 事件驱动 switch-checked 类切换（对应既有实现 change()）；
 * loading(bool) 在圆点内插入 / 移除加载图标。
 */

import { h, defineComponent, useTemplateRef, materialize } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';

/**
 * 开关尺寸类型：small / middle / large
 */
export type SwitchSize = 'small' | 'middle' | 'large';

/**
 * 开关组件 Props 接口
 */
export interface SwitchProps {
  /** 开关尺寸，默认 middle */
  size?: SwitchSize;
  /** 是否选中，默认 false */
  checked?: boolean;
  /** 是否禁用，默认 false */
  disabled?: boolean;
  /** 选中状态变化时的回调函数 */
  onChange?: (checked: boolean) => void;
}

/**
 * 开关组件对外暴露的 API
 */
export interface SwitchApi {
  /** 设置选中状态（同步 input.checked 与样式类） */
  setChecked: (value: boolean) => void;
  /** 设置禁用状态 */
  setDisabled: (value: boolean) => void;
  /** 设置加载状态（在圆点内插入 / 移除加载图标，对应既有实现 loading()） */
  loading: (value: boolean) => void;
}

/** 加载图标（旋转圆环，与既有实现 loading 态一致） */
const LoadingIcon = (): VNode =>
  h('svg', {
    viewBox: '0 0 1024 1024',
    version: '1.1',
    xmlns: 'http://www.w3.org/2000/svg',
    class: 'switch-loading-icon',
  }, h('path', {
    d: 'M512 64a32 32 0 0 1 32 32v128a32 32 0 0 1-64 0V96a32 32 0 0 1 32-32z m0 704a32 32 0 0 1 32 32v128a32 32 0 0 1-64 0v-128a32 32 0 0 1 32-32z m448-256a32 32 0 0 1-32 32h-128a32 32 0 0 1 0-64h128a32 32 0 0 1 32 32z m-704 0a32 32 0 0 1-32 32H96a32 32 0 0 1 0-64h128a32 32 0 0 1 32 32z',
  }));

/**
 * 开关组件
 */
export const Switch = defineComponent<SwitchProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // 状态数据
  // ============================================

  /** 当前选中状态 */
  let checked = props.checked ?? false;

  /** 当前禁用状态 */
  let disabled = props.disabled ?? false;

  // ============================================
  // DOM 引用
  // ============================================

  /** 开关根元素引用 */
  const switchRef = useTemplateRef<HTMLDivElement>(lifecycle, 'switchRef');

  /** 复选框输入元素引用 */
  const inputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'inputRef');

  /** 圆点元素引用（loading 图标插入位置） */
  const circleRef = useTemplateRef<HTMLDivElement>(lifecycle, 'circleRef');

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 根据当前选中状态同步 switch-checked 样式类
   */
  const syncCheckedClass = (): void => {
    if (switchRef.value) {
      switchRef.value.classList.toggle('switch-checked', checked);
    }
  };

  /**
   * 处理复选框 change 事件（对应既有实现 change()）
   * 以 input.checked 为准切换样式类，禁用态下不响应
   * @param event - change 事件
   */
  const handleChange = (event: Event): void => {
    if (disabled) {
      return;
    }
    if (!(event.target instanceof HTMLInputElement)) return;
    checked = event.target.checked;
    syncCheckedClass();
    props.onChange?.(checked);
  };

  /**
   * 外部设置选中状态（同步 input.checked 与样式类）
   * @param value - 是否选中
   */
  const setChecked = (value: boolean): void => {
    checked = value;
    if (inputRef.value) {
      inputRef.value.checked = value;
    }
    syncCheckedClass();
  };

  /**
   * 外部设置禁用状态
   * @param value - 是否禁用
   */
  const setDisabled = (value: boolean): void => {
    disabled = value;
    if (switchRef.value) {
      switchRef.value.classList.toggle('switch-disabled', disabled);
    }
    if (inputRef.value) {
      inputRef.value.disabled = disabled;
    }
  };

  /**
   * 设置加载状态（对应既有实现 loading()）
   * @param value - 是否处于加载状态
   */
  const loading = (value: boolean): void => {
    if (!circleRef.value) return;
    if (value) {
      if (!circleRef.value.querySelector('.switch-loading-icon')) {
        circleRef.value.appendChild(materialize(LoadingIcon()));
      }
    } else {
      circleRef.value
        .querySelectorAll('.switch-loading-icon')
        .forEach((icon) => icon.remove());
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后：同步初始状态，并通过事件向外暴露控制方法
   */
  lifecycle.onMounted = (): void => {
    if (inputRef.value) {
      inputRef.value.checked = checked;
      inputRef.value.disabled = disabled;
    }
    if (switchRef.value) {
      switchRef.value.classList.toggle('switch-checked', checked);
      switchRef.value.classList.toggle('switch-disabled', disabled);
    }
    lifecycle.emit?.('switchMounted', { setChecked, setDisabled, loading } satisfies SwitchApi);
  };

  // ============================================
  // 组件渲染（DOM 结构与既有实现一致）
  // ============================================

  return h('div', {
    class: `ui-switch switch-${props.size ?? 'middle'}`,
    ref: 'switchRef',
  },
    h('input', {
      type: 'checkbox',
      ref: 'inputRef',
      onChange: handleChange,
    }),
    h('div', { class: 'switch-inner' }),
    h('div', { class: 'switch-circle', ref: 'circleRef' }),
  );
});
