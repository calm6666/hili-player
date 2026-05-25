/**
 * ============================================
 * 弹幕设置面板组件
 * ============================================
 * 使用 h 函数实现的弹幕设置面板组件
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * 弹幕设置面板组件 Props 接口
 */
export interface DmSettingProps {
  /** 是否显示 */
  visible?: boolean;
  /** 不透明度 (0-100) */
  opacity?: number;
  /** 显示区域 (0-100) */
  area?: number;
  /** 弹幕字号 (0-100) */
  fontsize?: number;
  /** 弹幕速度 (0-100) */
  speed?: number;
  /** 关闭回调 */
  onClose?: () => void;
  /** 设置变化回调 */
  onSettingChange?: (type: string, value: number) => void;
}

/**
 * 弹幕设置面板组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const DmSetting = defineComponent<DmSettingProps>((props) => {
  /**
   * 不透明度值
   */
  const opacity = props.opacity ?? 100;

  /**
   * 显示区域值
   */
  const area = props.area ?? 100;

  /**
   * 弹幕字号值
   */
  const fontsize = props.fontsize ?? 100;

  /**
   * 弹幕速度值
   */
  const speed = props.speed ?? 100;

  /**
   * 渲染滑块
   */
  const renderSlider = (value: number, _type: string): VNode => {
    const progress = value / 100;
    const position = (value / 100) * 268;

    return h(
      'div',
      { class: 'ui ui-slider ui-dark' },
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
              style: { transform: `scaleX(${progress})` },
            })
          ),
          h(
            'div',
            { class: 'ui-thumb', style: { transform: `translateX(${position}px)` } },
            h('div', { class: 'ui-thumb-dot' })
          )
        )
      )
    );
  };

  /**
   * 渲染屏蔽类型选项
   */
  const renderFilterTypes = (): VNode[] => {
    const types = [
      { key: 'scroll', label: '滚动' },
      { key: 'top', label: '顶部' },
      { key: 'bottom', label: '底部' },
      { key: 'color', label: '彩色' },
    ];

    return types.map((type) =>
      h(
        'div',
        { class: `player-block-filter-type player-block-type${type.key.charAt(0).toUpperCase() + type.key.slice(1)}` },
        h('span', { class: 'player-block-filter-image' }),
        h('span', { class: 'player-block-filter-label' }, type.label)
      )
    );
  };

  return h(
    'div',
    {
      class: 'player-dm-setting-panel-wrap',
      style: {
        display: props.visible ? '' : 'none',
      },
    },
    h(
      'div',
      { class: 'player-dm-setting-panel' },
      h(
        'div',
        { class: 'player-dm-setting-block' },
        h('div', { class: 'player-dm-setting-block-title' }, '按类型屏蔽'),
        h('div', { class: 'player-dm-setting-block-conent' }, ...renderFilterTypes())
      ),
      h('div', { class: 'player-dm-setting-panel-radio' }),
      h(
        'div',
        { class: 'player-dm-setting-panel-area' },
        h('div', { class: 'player-dm-setting-panel-area-title' }, '显示区域'),
        h('div', { class: 'player-dm-setting-panel-area-content' }, renderSlider(area, 'area'))
      ),
      h(
        'div',
        { class: 'player-dm-setting-panel-opacity' },
        h('div', { class: 'player-dm-setting-panel-opacity-title' }, '不透明度'),
        h('div', { class: 'player-dm-setting-panel-opacity-content' }, renderSlider(opacity, 'opacity'))
      ),
      h(
        'div',
        { class: 'player-dm-setting-panel-fontsize' },
        h('div', { class: 'player-dm-setting-panel-fontsize-title' }, '弹幕字号'),
        h('div', { class: 'player-dm-setting-panel-fontsize-content' }, renderSlider(fontsize, 'fontsize'))
      ),
      h(
        'div',
        { class: 'player-dm-setting-panel-speed' },
        h('div', { class: 'player-dm-setting-panel-speed-title' }, '弹幕速度'),
        h('div', { class: 'player-dm-setting-panel-speed-content' }, renderSlider(speed, 'speed'))
      )
    )
  );
});
