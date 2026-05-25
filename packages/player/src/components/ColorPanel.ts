/**
 * ============================================
 * 色彩调整面板组件
 * ============================================
 * 使用 h 函数实现的色彩调整面板组件
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * 色彩调整面板组件 Props 接口
 */
export interface ColorPanelProps {
  /** 是否显示 */
  visible?: boolean;
  /** 饱和度值 (0-200) */
  saturate?: number;
  /** 亮度值 (0-200) */
  brightness?: number;
  /** 对比度值 (0-200) */
  contrast?: number;
  /** 关闭回调 */
  onClose?: () => void;
  /** 重置回调 */
  onReset?: () => void;
  /** 饱和度变化回调 */
  onSaturateChange?: (value: number) => void;
  /** 亮度变化回调 */
  onBrightnessChange?: (value: number) => void;
  /** 对比度变化回调 */
  onContrastChange?: (value: number) => void;
}

/**
 * 色彩调整面板组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const ColorPanel = defineComponent<ColorPanelProps>((props) => {
  /**
   * 饱和度值
   */
  const saturate = props.saturate ?? 100;

  /**
   * 亮度值
   */
  const brightness = props.brightness ?? 100;

  /**
   * 对比度值
   */
  const contrast = props.contrast ?? 100;

  /**
   * 计算滑块进度
   */
  const getSliderProgress = (value: number): number => {
    return value / 200;
  };

  /**
   * 计算滑块位置
   */
  const getSliderPosition = (value: number): number => {
    return (value / 200) * 268;
  };

  /**
   * 渲染滑块
   */
  const renderSlider = (value: number): VNode => {
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
            })
          ),
          h(
            'div',
            { class: 'ui-thumb', style: { transform: `translateX(${getSliderPosition(value)}px)` } },
            h('div', { class: 'ui-thumb-dot' })
          )
        )
      )
    );
  };

  return h(
    'div',
    {
      class: 'player-color-panel',
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
      renderSlider(saturate),
      h('div', { class: 'player-color-panel-value' }, saturate.toString())
    ),
    h(
      'div',
      { class: 'player-color-panel-brightness player-color-wrap' },
      h('div', { class: 'player-color-panel-name' }, '亮度'),
      renderSlider(brightness),
      h('div', { class: 'player-color-panel-value' }, brightness.toString())
    ),
    h(
      'div',
      { class: 'player-color-panel-contrast player-color-wrap' },
      h('div', { class: 'player-color-panel-name' }, '对比度'),
      renderSlider(contrast),
      h('div', { class: 'player-color-panel-value' }, contrast.toString())
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
