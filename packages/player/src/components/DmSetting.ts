/**
 * ============================================
 * 弹幕设置面板组件
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';

/**
 * 弹幕设置面板组件 Props 接口
 */
export interface DmSettingProps {
  /** 是否显示弹幕设置面板 */
  visible?: boolean;
  /** 不透明度 (0-100) */
  opacity?: number;
  /** 显示区域 (0-100) */
  area?: number;
  /** 弹幕字号 (0-100) */
  fontsize?: number;
  /** 弹幕速度 (0-100) */
  speed?: number;
  /** 关闭弹幕设置面板的回调函数 */
  onClose?: () => void;
  /** 弹幕设置项变化时的回调函数 */
  onSettingChange?: (type: string, value: number) => void;
}

/**
 * 弹幕设置面板组件
 */
export const DmSetting = defineComponent<DmSettingProps>((props, lifecycle: ComponentLifecycle) => {
  /**
   * 不透明度值
   */
  let opacity = props.opacity ?? 100;

  /**
   * 显示区域值
   */
  let area = props.area ?? 100;

  /**
   * 弹幕字号值
   */
  let fontsize = props.fontsize ?? 100;

  /**
   * 弹幕速度值
   */
  let speed = props.speed ?? 100;

  // ============================================
  // DOM 引用
  // ============================================

  /** 弹幕设置面板根元素引用 */
  const panelRef = ref<HTMLDivElement>();

  /** 显示区域滑块进度条元素引用 */
  const areaBarRef = ref<HTMLDivElement>();

  /** 显示区域滑块拖拽手柄元素引用 */
  const areaThumbRef = ref<HTMLDivElement>();

  /** 不透明度滑块进度条元素引用 */
  const opacityBarRef = ref<HTMLDivElement>();

  /** 不透明度滑块拖拽手柄元素引用 */
  const opacityThumbRef = ref<HTMLDivElement>();

  /** 弹幕字号滑块进度条元素引用 */
  const fontsizeBarRef = ref<HTMLDivElement>();

  /** 弹幕字号滑块拖拽手柄元素引用 */
  const fontsizeThumbRef = ref<HTMLDivElement>();

  /** 弹幕速度滑块进度条元素引用 */
  const speedBarRef = ref<HTMLDivElement>();

  /** 弹幕速度滑块拖拽手柄元素引用 */
  const speedThumbRef = ref<HTMLDivElement>();

  /**
   * 更新滑块 UI 显示
   * @param barRef - 进度条元素引用
   * @param thumbRef - 拖拽手柄元素引用
   * @param value - 当前滑块值 (0-100)
   */
  const updateSliderUI = (barRef: { current: HTMLDivElement | null }, thumbRef: { current: HTMLDivElement | null }, value: number): void => {
    /** 进度比例 (0-1) */
    const progress = value / 100;
    /** 手柄偏移像素位置 */
    const position = (value / 100) * 268;
    if (barRef.current) {
      barRef.current.style.transform = `scaleX(${progress})`;
    }
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translateX(${position}px)`;
    }
  };

  /**
   * 手动设置不透明度
   * @param value - 不透明度值 (0-100)
   */
  const setOpacity = (value: number): void => {
    opacity = value;
    updateSliderUI(opacityBarRef, opacityThumbRef, value);
  };

  /**
   * 手动设置显示区域
   * @param value - 显示区域值 (0-100)
   */
  const setArea = (value: number): void => {
    area = value;
    updateSliderUI(areaBarRef, areaThumbRef, value);
  };

  /**
   * 手动设置弹幕字号
   * @param value - 弹幕字号值 (0-100)
   */
  const setFontsize = (value: number): void => {
    fontsize = value;
    updateSliderUI(fontsizeBarRef, fontsizeThumbRef, value);
  };

  /**
   * 手动设置弹幕速度
   * @param value - 弹幕速度值 (0-100)
   */
  const setSpeed = (value: number): void => {
    speed = value;
    updateSliderUI(speedBarRef, speedThumbRef, value);
  };

  /**
   * 渲染滑块组件
   * @param value - 滑块当前值 (0-100)
   * @param type - 设置项类型标识
   * @param barRef - 进度条元素引用
   * @param thumbRef - 拖拽手柄元素引用
   * @returns 滑块 VNode
   */
  const renderSlider = (value: number, type: string, barRef: { current: HTMLDivElement | null }, thumbRef: { current: HTMLDivElement | null }): VNode => {
    /** 进度比例 (0-1) */
    const progress = value / 100;
    /** 手柄偏移像素位置 */
    const position = (value / 100) * 268;

    props.onSettingChange?.(type, value);

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
              ref: barRef,
            })
          ),
          h(
            'div',
            { class: 'ui-thumb', style: { transform: `translateX(${position}px)` }, ref: thumbRef },
            h('div', { class: 'ui-thumb-dot' })
          )
        )
      )
    );
  };

  /**
   * 渲染屏蔽类型选项列表
   * @returns 屏蔽类型选项 VNode 数组
   */
  const renderFilterTypes = (): VNode[] => {
    /** 弹幕类型列表，包含类型标识和显示标签 */
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

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，向外暴露设置方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('dmSettingMounted', { setOpacity, setArea, setFontsize, setSpeed });
  };

  /**
   * 组件销毁前的回调，清理所有 DOM 引用
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  return h(
    'div',
    {
      class: 'player-dm-setting-panel-wrap',
      ref: panelRef,
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
        h('div', { class: 'player-dm-setting-panel-area-content' }, renderSlider(area, 'area', areaBarRef, areaThumbRef))
      ),
      h(
        'div',
        { class: 'player-dm-setting-panel-opacity' },
        h('div', { class: 'player-dm-setting-panel-opacity-title' }, '不透明度'),
        h('div', { class: 'player-dm-setting-panel-opacity-content' }, renderSlider(opacity, 'opacity', opacityBarRef, opacityThumbRef))
      ),
      h(
        'div',
        { class: 'player-dm-setting-panel-fontsize' },
        h('div', { class: 'player-dm-setting-panel-fontsize-title' }, '弹幕字号'),
        h('div', { class: 'player-dm-setting-panel-fontsize-content' }, renderSlider(fontsize, 'fontsize', fontsizeBarRef, fontsizeThumbRef))
      ),
      h(
        'div',
        { class: 'player-dm-setting-panel-speed' },
        h('div', { class: 'player-dm-setting-panel-speed-title' }, '弹幕速度'),
        h('div', { class: 'player-dm-setting-panel-speed-content' }, renderSlider(speed, 'speed', speedBarRef, speedThumbRef))
      )
    )
  );
});
