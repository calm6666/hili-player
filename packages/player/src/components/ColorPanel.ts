/**
 * ============================================
 * 色彩调整面板组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { Signal } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';

/**
 * 色彩调整面板组件 Props 接口
 */
export interface ColorPanelProps {
  /** 是否显示面板 */
  visible?: boolean;
  /** 饱和度值 (0-200)，默认 100 */
  saturate?: number;
  /** 亮度值 (0-200)，默认 100 */
  brightness?: number;
  /** 对比度值 (0-200)，默认 100 */
  contrast?: number;
  /** 关闭面板的回调函数 */
  onClose?: () => void;
  /** 重置色彩参数的回调函数 */
  onReset?: () => void;
  /** 饱和度变化时的回调函数 */
  onSaturateChange?: (value: number) => void;
  /** 亮度变化时的回调函数 */
  onBrightnessChange?: (value: number) => void;
  /** 对比度变化时的回调函数 */
  onContrastChange?: (value: number) => void;
}

/**
 * 色彩调整面板组件
 * 提供饱和度、亮度、对比度三个滑块用于调整视频画面色彩
 */
export const ColorPanel = defineComponent<ColorPanelProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // 状态
  // ============================================

  /** 当前饱和度值 */
  let saturate = props.saturate ?? 100;

  /** 当前亮度值 */
  let brightness = props.brightness ?? 100;

  /** 当前对比度值 */
  let contrast = props.contrast ?? 100;

  // ============================================
  // DOM 引用
  // ============================================

  /** 面板根容器 DOM 引用 */
  const panelRef = useTemplateRef<HTMLDivElement>(lifecycle, 'panelRef');

  /** 饱和度滑块进度条 DOM 引用 */
  const saturateBarRef = useTemplateRef<HTMLDivElement>(lifecycle, 'saturateBarRef');

  /** 饱和度滑块拖拽手柄 DOM 引用 */
  const saturateThumbRef = useTemplateRef<HTMLDivElement>(lifecycle, 'saturateThumbRef');

  /** 饱和度数值显示 DOM 引用 */
  const saturateValueRef = useTemplateRef<HTMLDivElement>(lifecycle, 'saturateValueRef');

  /** 亮度滑块进度条 DOM 引用 */
  const brightnessBarRef = useTemplateRef<HTMLDivElement>(lifecycle, 'brightnessBarRef');

  /** 亮度滑块拖拽手柄 DOM 引用 */
  const brightnessThumbRef = useTemplateRef<HTMLDivElement>(lifecycle, 'brightnessThumbRef');

  /** 亮度数值显示 DOM 引用 */
  const brightnessValueRef = useTemplateRef<HTMLDivElement>(lifecycle, 'brightnessValueRef');

  /** 对比度滑块进度条 DOM 引用 */
  const contrastBarRef = useTemplateRef<HTMLDivElement>(lifecycle, 'contrastBarRef');

  /** 对比度滑块拖拽手柄 DOM 引用 */
  const contrastThumbRef = useTemplateRef<HTMLDivElement>(lifecycle, 'contrastThumbRef');

  /** 对比度数值显示 DOM 引用 */
  const contrastValueRef = useTemplateRef<HTMLDivElement>(lifecycle, 'contrastValueRef');

  /**
   * 计算滑块进度比例
   * @param value - 当前数值 (0-200)
   * @returns 进度比例 (0-1)
   */
  const getSliderProgress = (value: number): number => {
    return value / 200;
  };

  /**
   * 计算滑块手柄的像素偏移位置
   * @param value - 当前数值 (0-200)
   * @returns 手柄偏移像素值
   */
  const getSliderPosition = (value: number): number => {
    return (value / 200) * 268;
  };

  /**
   * 更新滑块的 UI 显示（进度条缩放、手柄位置、数值文本）
   * @param barRef - 进度条 DOM 引用
   * @param thumbRef - 手柄 DOM 引用
   * @param valueRef - 数值显示 DOM 引用
   * @param value - 当前数值
   */
  const updateSliderUI = (barRef: Signal<HTMLDivElement | null>, thumbRef: Signal<HTMLDivElement | null>, valueRef: Signal<HTMLDivElement | null>, value: number): void => {
    const progress = getSliderProgress(value);
    const position = getSliderPosition(value);
    if (barRef.value) {
      barRef.value.style.transform = `scaleX(${progress})`;
    }
    if (thumbRef.value) {
      thumbRef.value.style.transform = `translateX(${position}px)`;
    }
    if (valueRef.value) {
      valueRef.value.innerText = value.toString();
    }
  };

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 设置饱和度并更新对应滑块 UI
   * @param value - 新的饱和度值
   */
  const setSaturate = (value: number): void => {
    saturate = value;
    updateSliderUI(saturateBarRef, saturateThumbRef, saturateValueRef, value);
  };

  /**
   * 设置亮度并更新对应滑块 UI
   * @param value - 新的亮度值
   */
  const setBrightness = (value: number): void => {
    brightness = value;
    updateSliderUI(brightnessBarRef, brightnessThumbRef, brightnessValueRef, value);
  };

  /**
   * 设置对比度并更新对应滑块 UI
   * @param value - 新的对比度值
   */
  const setContrast = (value: number): void => {
    contrast = value;
    updateSliderUI(contrastBarRef, contrastThumbRef, contrastValueRef, value);
  };

  /**
   * 显示面板组件
   */
  const show = (): void => {
    if (panelRef.value) {
      panelRef.value.style.display = '';
    }
  };

  /**
   * 隐藏面板组件
   */
  const hide = (): void => {
    if (panelRef.value) {
      panelRef.value.style.display = 'none';
    }
  };

  /**
   * 渲染单个滑块控件
   * @param value - 当前数值
   * @param barRef - 进度条 DOM 引用
   * @param thumbRef - 手柄 DOM 引用
   * @returns 滑块虚拟节点
   */
  const renderSlider = (value: number, barRef: Signal<HTMLDivElement | null>, thumbRef: Signal<HTMLDivElement | null>): VNode => {
    return h(
      'div',
      { class: 'player-color-panel-slider ui ui-slider ui-dark' },
      h(
        'div',
        { class: 'ui-area' },
        h(
          'div',
          { class: 'ui-track' },
          h(
            'div',
            { class: 'ui-bar-wrap' },
            h('div', {
              class: 'ui-bar ui-bar-normal',
              role: 'progressbar',
              style: { transform: `scaleX(${getSliderProgress(value)})` },
              ref: barRef,
            })
          ),
          h(
            'div',
            { class: 'ui-thumb', style: { transform: `translateX(${getSliderPosition(value)}px)` }, ref: thumbRef },
            h('div', { class: 'ui-thumb-dot' })
          )
        )
      )
    );
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，通过事件向外暴露控制方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('colorPanelMounted', { setSaturate, setBrightness, setContrast, show, hide });
  };

  /**
   * 组件销毁前，清空所有 DOM 引用以防止内存泄漏
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  return h(
    'div',
    {
      class: 'player-color-panel',
      ref: 'panelRef',
      style: {
        display: props.visible ? '' : 'none',
      },
    },
    h(
      'div',
      { class: 'player-color-panel-title' },
      '色彩调整',
      h(
        'span',
        { class: 'player-color-panel-close', onClick: () => props.onClose?.() },
        h('span', { class: 'common-svg-icon' }, '×')
      )
    ),
    h(
      'div',
      { class: 'player-color-panel-saturate player-color-wrap' },
      h('div', { class: 'player-color-panel-name' }, '饱和度'),
      renderSlider(saturate, saturateBarRef, saturateThumbRef),
      h('div', { class: 'player-color-panel-value', ref: 'saturateValueRef' }, saturate.toString())
    ),
    h(
      'div',
      { class: 'player-color-panel-brightness player-color-wrap' },
      h('div', { class: 'player-color-panel-name' }, '亮度'),
      renderSlider(brightness, brightnessBarRef, brightnessThumbRef),
      h('div', { class: 'player-color-panel-value', ref: 'brightnessValueRef' }, brightness.toString())
    ),
    h(
      'div',
      { class: 'player-color-panel-contrast player-color-wrap' },
      h('div', { class: 'player-color-panel-name' }, '对比度'),
      renderSlider(contrast, contrastBarRef, contrastThumbRef),
      h('div', { class: 'player-color-panel-value', ref: 'contrastValueRef' }, contrast.toString())
    ),
    h(
      'div',
      { class: 'player-color-panel-reset' },
      h(
        'span',
        { class: 'player-color-panel-btn ui ui-button', onClick: () => props.onReset?.() },
        h('div', { class: 'ui-area ui-button-black' }, '重置')
      )
    )
  );
});
