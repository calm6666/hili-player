/**
 * ============================================
 * 弹幕设置面板组件 (DmSetting)
 * ============================================
 *
 * DOM 结构与 CSS 类名与既有实现保持一致：
 *   .player-dm-setting-panel-wrap
 *     .player-dm-setting-panel
 *       .player-dm-setting-block（按类型屏蔽：.player-block-filter-type.*）
 *       .player-dm-setting-panel-radio（弹幕随屏幕缩放复选框）
 *       .player-dm-setting-panel-area / -opacity / -fontsize / -speedplus
 *         （标题 + 内容区，内容区挂 Slider：.ui-area > .ui-progress-wrap ...）
 *
 * 行为：各滑杆 / 复选框变化时写入运行时状态
 * （player.danmakuArea / danmakuOpacity / danmakuFontSize / danmakuSpeed /
 *   danmakuScaleWithScreen），由 PlayerDocker 订阅后应用到弹幕层。
 */

import { h, defineComponent, useContext } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';
import type { TypedStateManager } from '@/core/state';
import { Slider } from '@/hili-player/components/Slider';
import { Checkbox } from '@/hili-player/components/Checkbox';
import {
  StateContext,
  PlayerStateKeyEnum,
  type PlayerStateMap,
} from '@/store/runtimeState';

/** 弹幕速度滑杆值（0-100）到速度倍率的映射：0 → 0.5，50 → 1.0，100 → 1.5 */
const speedSliderToMultiplier = (value: number): number => 0.5 + value / 100;

/**
 * 弹幕设置面板组件 Props 接口
 */
export interface DmSettingProps {
  /** 弹幕设置项变化时的回调函数（type: area | opacity | fontsize | speed） */
  onSettingChange?: (type: string, value: number) => void;
}

/**
 * 弹幕设置面板对外暴露的 API
 */
export interface DmSettingApi {
  /** 设置不透明度滑杆（0-100） */
  setOpacity: (value: number) => void;
  /** 设置显示区域滑杆（0-100） */
  setArea: (value: number) => void;
  /** 设置字号滑杆（0-100） */
  setFontsize: (value: number) => void;
  /** 设置速度滑杆（0-100） */
  setSpeed: (value: number) => void;
}

/** 显示区域滑杆的档位标记（与既有实现一致） */
const AREA_MARKS = [
  { value: 0, name: '0%' },
  { value: 25, name: '25%' },
  { value: 50, name: '50%' },
  { value: 75, name: '75%' },
  { value: 100, name: '100%' },
];

/** 弹幕速度滑杆的档位标记（与既有实现一致） */
const SPEED_MARKS = [
  { value: 0, name: '极慢' },
  { value: 25, name: '较慢' },
  { value: 50, name: '适中' },
  { value: 75, name: '较快' },
  { value: 100, name: '极快' },
];

/**
 * 弹幕设置面板组件
 */
export const DmSetting = defineComponent<DmSettingProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // 状态管理器（通过 Context 获取）
  // ============================================

  /** 运行时状态管理器，设置项变化时写入 */
  const stateMgr = useContext<TypedStateManager<PlayerStateMap> | null>(
    StateContext,
  );

  // ============================================
  // 滑杆 API（由 Slider 组件挂载后填充）
  // ============================================

  /** 各滑杆的 setValue API 引用 */
  const sliderApis: {
    area?: (value: number) => void;
    opacity?: (value: number) => void;
    fontsize?: (value: number) => void;
    speed?: (value: number) => void;
  } = {};

  // ============================================
  // 状态写入
  // ============================================

  /**
   * 处理显示区域滑杆变化
   * @param value - 滑杆值（0-100）
   */
  const handleAreaChange = (value: number): void => {
    stateMgr?.set(PlayerStateKeyEnum.DANMAKU_AREA, value);
    props.onSettingChange?.('area', value);
  };

  /**
   * 处理不透明度滑杆变化
   * @param value - 滑杆值（0-100，映射为 0-1 写入状态）
   */
  const handleOpacityChange = (value: number): void => {
    stateMgr?.set(PlayerStateKeyEnum.DANMAKU_OPACITY, value / 100);
    props.onSettingChange?.('opacity', value);
  };

  /**
   * 处理弹幕字号滑杆变化
   * @param value - 滑杆值（0-100）
   */
  const handleFontsizeChange = (value: number): void => {
    stateMgr?.set(PlayerStateKeyEnum.DANMAKU_FONT_SIZE, value);
    props.onSettingChange?.('fontsize', value);
  };

  /**
   * 处理弹幕速度滑杆变化
   * @param value - 滑杆值（0-100，映射为 0.5-1.5 倍率写入状态）
   */
  const handleSpeedChange = (value: number): void => {
    stateMgr?.set(PlayerStateKeyEnum.DANMAKU_SPEED, speedSliderToMultiplier(value));
    props.onSettingChange?.('speed', value);
  };

  /**
   * 处理「弹幕随屏幕缩放」复选框变化
   * @param checked - 是否选中
   */
  const handleScaleChange = (checked: boolean): void => {
    stateMgr?.set(PlayerStateKeyEnum.DANMAKU_SCALE_WITH_SCREEN, checked);
  };

  /**
   * 处理「按类型屏蔽」选项点击：切换选中态类名
   * @param event - 鼠标事件
   */
  const handleFilterTypeClick = (event: MouseEvent): void => {
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.toggle('player-block-filter-type-selected');
    }
  };

  // ============================================
  // 渲染函数
  // ============================================

  /**
   * 渲染「按类型屏蔽」的类型选项
   * 每个类型包含正常态与屏蔽态两个 SVG 图标（由 CSS 按选中态切换显示）
   * @returns 类型选项虚拟节点数组
   */
  const renderFilterTypes = (): VNode[] => {
    /** 类型列表：键名后缀与标签（与既有实现一致） */
    const types = [
      { suffix: 'Scroll', label: '滚动' },
      { suffix: 'Top', label: '顶部' },
      { suffix: 'Bottom', label: '底部' },
      { suffix: 'Color', label: '彩色' },
    ];

    /** 滚动弹幕图标（正常态） */
    const scrollIcon = 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM11 9h6a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2zm-3 2H6V9h2v2zm4 4h-2v-2h2v2zm9 0h-6a1 1 0 0 1 0-2h6a1 1 0 0 1 0 2z';
    /** 顶部弹幕图标（正常态） */
    const topIcon = 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM9 9H7V7h2v2zm4 0h-2V7h2v2zm4 0h-2V7h2v2zm4 0h-2V7h2v2z';
    /** 底部弹幕图标（正常态） */
    const bottomIcon = 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM9 21H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z';
    /** 彩色弹幕图标（正常态） */
    const colorIcon = 'M17.365 11.118c0-.612-.535-1.147-1.147-1.147s-1.147.535-1.147 1.147c0 .611.535 1.147 1.147 1.147s1.147-.536 1.147-1.147zM12.93 9.665c-.764 0-1.376.611-1.376 1.3 0 .689.612 1.301 1.376 1.301s1.376-.612 1.376-1.301-.612-1.3-1.376-1.3zM9.794 11.883c-.764 0-1.376.612-1.376 1.3 0 .689.612 1.3 1.376 1.3s1.376-.611 1.376-1.3c.001-.688-.611-1.3-1.376-1.3zM10.023 15.171c-.612 0-1.147.536-1.147 1.148 0 .611.535 1.146 1.147 1.146s1.147-.535 1.147-1.146c.001-.612-.535-1.148-1.147-1.148zM17.823 12.953c-.611 0-1.147.535-1.147 1.147s.536 1.147 1.147 1.147c.612 0 1.148-.535 1.148-1.147s-.536-1.147-1.148-1.147z';
    /** 彩色弹幕图标（主体，正常态） */
    const colorBodyIcon = 'M23.177 3H4.824C2.683 3 1 4.833 1 7.167v13.665C1 23.167 2.683 25 4.824 25h18.353C25.318 25 27 23.167 27 20.833V7.167C27 4.833 25.318 3 23.177 3zm-3.442 13.624c-1.987.612-4.129-.154-5.046.764-.918.918 1.529 1.606 0 2.219-1.988.84-7.341-.535-8.182-4.053-.841-3.441 2.905-6.5 5.888-7.035 2.906-.535 6.041.841 8.181 2.982 2.065 2.141.765 4.74-.841 5.123z';

    return types.map((type) =>
      h(
        'div',
        {
          class: `player-block-filter-type player-block-type${type.suffix}`,
          onClick: handleFilterTypeClick,
        },
        h('span', { class: 'player-block-filter-image' },
          h('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            'xml:space': 'preserve',
            'data-pointer': 'none',
            style: 'enable-background:new 0 0 28 28',
            viewBox: '0 0 28 28',
          }, h('path', { d: type.suffix === 'Scroll' ? scrollIcon : type.suffix === 'Top' ? topIcon : type.suffix === 'Bottom' ? bottomIcon : colorIcon })),
          type.suffix === 'Color'
            ? h('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                'xml:space': 'preserve',
                'data-pointer': 'none',
                style: 'enable-background:new 0 0 28 28',
                viewBox: '0 0 28 28',
              }, h('path', { d: colorBodyIcon }))
            : h('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                'xml:space': 'preserve',
                'data-pointer': 'none',
                style: 'enable-background:new 0 0 28 28',
                viewBox: '0 0 28 28',
              }, h('path', { d: 'M23 15c1.487 0 2.866.464 4 1.255V7a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h11.674A7 7 0 0 1 23 15zM11 9h6a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2zm-3 2H6V9h2v2zm4 4h-2v-2h2v2zm2-1a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2h-1a1 1 0 0 1-1-1z' })),
        ),
        h('span', { class: 'player-block-filter-label' }, type.label),
      ),
    );
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后：把当前状态值同步到滑杆显示，并向外暴露设置方法
   */
  lifecycle.onMounted = (): void => {
    if (stateMgr) {
      /** 当前显示区域值 */
      const area = stateMgr.get(PlayerStateKeyEnum.DANMAKU_AREA) ?? 50;
      /** 当前不透明度值（0-1 → 0-100） */
      const opacity = (stateMgr.get(PlayerStateKeyEnum.DANMAKU_OPACITY) ?? 1) * 100;
      /** 当前字号值 */
      const fontsize = stateMgr.get(PlayerStateKeyEnum.DANMAKU_FONT_SIZE) ?? 50;
      /** 当前速度倍率（0.5-1.5 → 0-100） */
      const speed = ((stateMgr.get(PlayerStateKeyEnum.DANMAKU_SPEED) ?? 1) - 0.5) * 100;
      sliderApis.area?.(area);
      sliderApis.opacity?.(opacity);
      sliderApis.fontsize?.(fontsize);
      sliderApis.speed?.(speed);
    }
    lifecycle.emit?.('dmSettingMounted', {
      setOpacity: (value: number) => sliderApis.opacity?.(value),
      setArea: (value: number) => sliderApis.area?.(value),
      setFontsize: (value: number) => sliderApis.fontsize?.(value),
      setSpeed: (value: number) => sliderApis.speed?.(value),
    } satisfies DmSettingApi);
  };

  // ============================================
  // 组件渲染（DOM 结构与既有实现一致）
  // ============================================

  return h(
    'div',
    { class: 'player-dm-setting-panel-wrap' },
    h(
      'div',
      { class: 'player-dm-setting-panel' },
      // 按类型屏蔽
      h(
        'div',
        { class: 'player-dm-setting-block' },
        h('div', { class: 'player-dm-setting-block-title' }, '按类型屏蔽'),
        h('div', { class: 'player-dm-setting-block-conent' }, ...renderFilterTypes()),
      ),
      // 弹幕随屏幕缩放复选框
      h('div', { class: 'player-dm-setting-panel-radio' },
        h(Checkbox, {
          checked: stateMgr?.get(PlayerStateKeyEnum.DANMAKU_SCALE_WITH_SCREEN) ?? true,
          label: '弹幕随屏幕缩放',
          onChange: handleScaleChange,
        }),
      ),
      // 显示区域
      h(
        'div',
        { class: 'player-dm-setting-panel-area' },
        h('div', { class: 'player-dm-setting-panel-area-title' }, '显示区域'),
        h('div', { class: 'player-dm-setting-panel-area-content' },
          h(Slider, {
            value: 50,
            step: 25,
            marks: AREA_MARKS,
            onChange: handleAreaChange,
            onSliderMounted: (api: { setValue: (value: number) => void }) => {
              sliderApis.area = api.setValue;
            },
          }),
        ),
      ),
      // 不透明度
      h(
        'div',
        { class: 'player-dm-setting-panel-opacity' },
        h('div', { class: 'player-dm-setting-panel-opacity-title' }, '不透明度'),
        h('div', { class: 'player-dm-setting-panel-opacity-content' },
          h(Slider, {
            value: 50,
            onChange: handleOpacityChange,
            onSliderMounted: (api: { setValue: (value: number) => void }) => {
              sliderApis.opacity = api.setValue;
            },
          }),
        ),
      ),
      // 弹幕字号
      h(
        'div',
        { class: 'player-dm-setting-panel-fontsize' },
        h('div', { class: 'player-dm-setting-panel-fontsize-title' }, '弹幕字号'),
        h('div', { class: 'player-dm-setting-panel-fontsize-content' },
          h(Slider, {
            value: 50,
            onChange: handleFontsizeChange,
            onSliderMounted: (api: { setValue: (value: number) => void }) => {
              sliderApis.fontsize = api.setValue;
            },
          }),
        ),
      ),
      // 弹幕速度
      h(
        'div',
        { class: 'player-dm-setting-panel-speedplus' },
        h('div', { class: 'player-dm-setting-panel-speedplus-title' }, '弹幕速度'),
        h('div', { class: 'player-dm-setting-panel-speedplus-content' },
          h(Slider, {
            value: 50,
            step: 25,
            marks: SPEED_MARKS,
            onChange: handleSpeedChange,
            onSliderMounted: (api: { setValue: (value: number) => void }) => {
              sliderApis.speed = api.setValue;
            },
          }),
        ),
      ),
    ),
  );
});
