/**
 * ============================================
 * 弹幕选择面板组件 (Selection)
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';

/**
 * 弹幕模式类型
 * 1: 滚动弹幕, 4: 底部弹幕, 5: 顶部弹幕
 */
export type DanmakuMode = 1 | 4 | 5;

/**
 * 弹幕字号类型
 * small: 小字号, normal: 标准字号
 */
export type DanmakuSize = 'small' | 'normal';

/**
 * Selection 组件 Props 接口
 */
export interface SelectionProps {
  /** 初始弹幕颜色值 */
  initialColor?: string;
  /** 初始弹幕模式 */
  initialMode?: DanmakuMode;
  /** 初始弹幕字号 */
  initialSize?: DanmakuSize;
  /** 弹幕颜色变化时的回调函数 */
  onColorChange?: (color: string) => void;
  /** 弹幕模式变化时的回调函数 */
  onModeChange?: (mode: DanmakuMode) => void;
  /** 弹幕字号变化时的回调函数 */
  onSizeChange?: (size: DanmakuSize) => void;
}

/**
 * 预设弹幕颜色列表
 */
const COLOR_LIST: string[] = [
  '#FE0302', '#FF7204', '#FFAA02', '#FFD302', '#FFFF00',
  '#A0EE00', '#00CD00', '#019899', '#4266BE', '#89D5FF',
  '#CC0273', '#222222', '#9B9B9B', '#FFFFFF',
];

/**
 * 弹幕选择面板组件
 */
export const Selection = defineComponent<SelectionProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // 状态数据
  // ============================================

  /** 当前选中的弹幕模式 */
  let currentMode = props.initialMode || 1;

  /** 当前选中的弹幕字号 */
  let currentSize = props.initialSize || 'normal';

  // ============================================
  // DOM 元素引用
  // ============================================

  /** 颜色输入框元素引用 */
  const inputRef = ref<HTMLInputElement>();

  /** 颜色预览方块元素引用 */
  const colorBoxRef = ref<HTMLDivElement>();

  /** 颜色选择器列表元素引用 */
  const colorPickerRef = ref<HTMLUListElement>();

  // ============================================
  // 事件处理
  // ============================================

  /**
   * 处理颜色选择事件
   * @param color - 选中的颜色值
   */
  const handleColorSelect = (color: string): void => {
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
   * 处理弹幕模式选择事件
   * @param mode - 选中的弹幕模式
   */
  const handleModeSelect = (mode: DanmakuMode): void => {
    currentMode = mode;
    props.onModeChange?.(mode);
    lifecycle.emit?.('modeChange', mode);
  };

  /**
   * 处理弹幕字号选择事件
   * @param size - 选中的弹幕字号
   */
  const handleSizeSelect = (size: DanmakuSize): void => {
    currentSize = size;
    props.onSizeChange?.(size);
    lifecycle.emit?.('sizeChange', size);
  };

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 外部设置弹幕颜色
   * @param color - 颜色值
   */
  const setColor = (color: string): void => {
    if (inputRef.current) {
      inputRef.current.value = color;
    }
    if (colorBoxRef.current) {
      colorBoxRef.current.style.background = color;
    }
  };

  /**
   * 外部设置弹幕模式
   * @param mode - 弹幕模式
   */
  const setMode = (mode: DanmakuMode): void => {
    currentMode = mode;
  };

  /**
   * 外部设置弹幕字号
   * @param size - 弹幕字号
   */
  const setSize = (size: DanmakuSize): void => {
    currentSize = size;
  };

  // ============================================
  // 渲染函数
  // ============================================

  /**
   * 渲染颜色选项列表
   * @returns 颜色选项 VNode 数组
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
   * 渲染字号选择行
   * @returns 字号选择 VNode
   */
  const renderSizeSelection = (): VNode => {
    return h('div', { class: 'player-mode-selection-row fontsize' },
      h('div', { class: 'row-title' }, '字号'),
      h('div', { class: 'row-selection' },
        h('div', { class: 'hui-radio-wrap-button' },
          h('div', {
            class: ['radio-button', currentSize === 'small' ? 'active' : ''].filter(Boolean).join(' '),
            onClick: () => handleSizeSelect('small'),
          }, h('span', {}, '小')),
          h('div', {
            class: ['radio-button', currentSize === 'normal' ? 'active' : ''].filter(Boolean).join(' '),
            onClick: () => handleSizeSelect('normal'),
          }, h('span', {}, '标准'))
        )
      )
    );
  };

  /**
   * 渲染模式选择行
   * @returns 模式选择 VNode
   */
  const renderModeSelection = (): VNode => {
    /** 弹幕模式选项列表，包含模式值、显示标签和图标路径 */
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
            class: ['selection-span', 'js-action', currentMode === mode.value ? 'active' : ''].filter(Boolean).join(' '),
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
   * 渲染颜色选择行
   * @returns 颜色选择 VNode
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
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，向外暴露设置方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('selectionMounted', { setColor, setMode, setSize });
  };

  /**
   * 组件销毁前的回调，清理所有 DOM 引用
   */
  lifecycle.onBeforeDestroy = (): void => {
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
