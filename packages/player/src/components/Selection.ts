/**
 * ============================================
 * 弹幕选择面板组件 (Selection)
 * ============================================
 * 使用 h 函数框架实现的弹幕选择面板组件
 * 保持与老播放器完全相同的 DOM 结构和类名
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * 弹幕模式
 */
export type DanmakuMode = 1 | 4 | 5; // 1:滚动 4:底部 5:顶部

/**
 * 弹幕字号
 */
export type DanmakuSize = 'small' | 'normal';

/**
 * Selection 组件 Props 接口
 */
export interface SelectionProps {
  /** 初始颜色 */
  initialColor?: string;
  /** 初始模式 */
  initialMode?: DanmakuMode;
  /** 初始字号 */
  initialSize?: DanmakuSize;
  /** 颜色变化回调 */
  onColorChange?: (color: string) => void;
  /** 模式变化回调 */
  onModeChange?: (mode: DanmakuMode) => void;
  /** 字号变化回调 */
  onSizeChange?: (size: DanmakuSize) => void;
}

/**
 * 预设颜色列表
 */
const COLOR_LIST: string[] = [
  '#FE0302', '#FF7204', '#FFAA02', '#FFD302', '#FFFF00',
  '#A0EE00', '#00CD00', '#019899', '#4266BE', '#89D5FF',
  '#CC0273', '#222222', '#9B9B9B', '#FFFFFF',
];

/**
 * 弹幕选择面板组件
 * 使用 h 函数实现，保持与老播放器完全相同的 DOM 结构和类名
 */
export const Selection = defineComponent<SelectionProps>((props, lifecycle) => {
  // ============================================
  // 状态数据
  // ============================================
  let currentColor = props.initialColor || '#FFFFFF';
  let currentMode = props.initialMode || 1;
  let currentSize = props.initialSize || 'normal';

  // ============================================
  // DOM 元素引用
  // ============================================
  const inputRef: { current: HTMLInputElement | null } = { current: null };
  const colorBoxRef: { current: HTMLDivElement | null } = { current: null };
  const colorPickerRef: { current: HTMLUListElement | null } = { current: null };

  // ============================================
  // 事件处理
  // ============================================

  /**
   * 处理颜色输入
   */
  const handleInput = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement)) return;
    const value = event.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      currentColor = value;
      if (colorBoxRef.current) {
        colorBoxRef.current.style.background = value;
      }
      props.onColorChange?.(value);
      lifecycle.emit?.('colorChange', value);
    }
  };

  /**
   * 处理颜色选择
   */
  const handleColorSelect = (color: string): void => {
    currentColor = color;
    if (inputRef.current) {
      inputRef.current.value = color;
    }
    if (colorBoxRef.current) {
      colorBoxRef.current.style.background = color;
    }
    props.onColorChange?.(color);
    lifecycle.emit?.('colorChange', color);
  };

  /**
   * 处理模式选择
   */
  const handleModeSelect = (mode: DanmakuMode): void => {
    currentMode = mode;
    props.onModeChange?.(mode);
    lifecycle.emit?.('modeChange', mode);
  };

  /**
   * 处理字号选择
   */
  const handleSizeSelect = (size: DanmakuSize): void => {
    currentSize = size;
    props.onSizeChange?.(size);
    lifecycle.emit?.('sizeChange', size);
  };

  // ============================================
  // 渲染函数
  // ============================================

  /**
   * 渲染颜色选项
   */
  const renderColorOptions = (): VNode[] => {
    return COLOR_LIST.map((color) =>
      h('li', {
        class: 'color-picker-option',
        style: { backgroundColor: color },
        'data-color': color,
        onClick: () => handleColorSelect(color),
      })
    );
  };

  /**
   * 渲染字号选择
   */
  const renderSizeSelection = (): VNode => {
    return h('div', { class: 'player-mode-selection-row fontsize' },
      h('div', { class: 'row-title' }, '字号'),
      h('div', { class: 'row-selection' },
        h('div', { class: 'hui-radio-wrap-button' },
          h('div', {
            class: ['radio-button', { active: currentSize === 'small' }],
            onClick: () => handleSizeSelect('small'),
          }, h('span', {}, '小')),
          h('div', {
            class: ['radio-button', { active: currentSize === 'normal' }],
            onClick: () => handleSizeSelect('normal'),
          }, h('span', {}, '标准'))
        )
      )
    );
  };

  /**
   * 渲染模式选择
   */
  const renderModeSelection = (): VNode => {
    const modes: { value: DanmakuMode; label: string; icon: string }[] = [
      { value: 1, label: '滚动', icon: 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM11 9h6a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2zm-3 2H6V9h2v2zm4 4h-2v-2h2v2zm9 0h-6a1 1 0 0 1 0-2h6a1 1 0 0 1 0 2z' },
      { value: 5, label: '顶部', icon: 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM9 9H7V7h2v2zm4 0h-2V7h2v2zm4 0h-2V7h2v2zm4 0h-2V7h2v2z' },
      { value: 4, label: '底部', icon: 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM9 21H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z' },
    ];

    return h('div', { class: 'player-mode-selection-row mode' },
      h('div', { class: 'row-title' }, '模式'),
      h('div', { class: 'row-selection' },
        ...modes.map((mode) =>
          h('div', {
            class: ['selection-span', 'js-action', { active: currentMode === mode.value }],
            'data-type': 'mode',
            'data-value': mode.value.toString(),
            name: 'mode_selector',
            onClick: () => handleModeSelect(mode.value),
          },
            h('span', { class: 'selection-icon', name: 'mode_selector' },
              h('svg', { xmlns: 'http://www.w3.org/2000/svg', 'xml:space': 'preserve', 'data-pointer': 'none', style: 'enable-background:new 0 0 28 28', viewBox: '0 0 28 28' },
                h('path', { d: mode.icon })
              )
            ),
            h('span', { class: 'selection-name', name: 'mode_selector' }, mode.label)
          )
        )
      )
    );
  };

  /**
   * 渲染颜色选择
   */
  const renderColorSelection = (): VNode => {
    return h('div', { class: 'player-mode-selection-row color' },
      h('div', { class: 'row-title' }, '颜色'),
      h('div', { class: 'row-selection' },
        h('div', { class: 'color-input-warp' },
          h('input', { type: 'text', ref: inputRef }),
          h('div', { class: 'color-input-box', ref: colorBoxRef })
        )
      ),
      h('ul', { class: 'color-picker-options', ref: colorPickerRef }, ...renderColorOptions())
    );
  };

  // ============================================
  // 组件渲染
  // ============================================
  return h('div', { class: 'player-mode-selection-panel' },
    renderSizeSelection(),
    renderModeSelection(),
    renderColorSelection()
  );
});
