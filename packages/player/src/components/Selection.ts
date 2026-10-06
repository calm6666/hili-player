/**
 * ============================================
 * 弹幕类型选择面板组件 (Selection)
 * ============================================
 *
 * DOM 结构与 CSS 类名与既有实现保持一致：
 *   .player-mode-selection-panel
 *     .player-mode-selection-row.fontsize（字号：.hui-radio-wrap-button > .radio-button）
 *     .player-mode-selection-row.mode（模式：.selection-span.js-action，data-type/data-value）
 *     .player-mode-selection-row.color（颜色：.color-input-warp > input + .color-input-box，
 *                                       .color-picker-options > .color-picker-option）
 *
 * 行为：字号 / 模式 / 颜色变化时写入运行时状态（player.danmakuFontSize /
 * player.danmakuMode / player.danmakuColor），供弹幕层与发送逻辑消费。
 */

import { h, defineComponent, useTemplateRef, useContext } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';
import type { TypedStateManager } from '@/core/state';
import {
  StateContext,
  PlayerStateKeyEnum,
  type PlayerStateMap,
} from '@/store/runtimeState';

/**
 * 弹幕模式类型
 * 1: 滚动弹幕, 4: 底部弹幕, 5: 顶部弹幕（与既有实现的 data-value 一致）
 */
export type DanmakuMode = 1 | 4 | 5;

/**
 * 弹幕字号类型
 * small: 小字号, normal: 标准字号
 */
export type DanmakuSize = 'small' | 'normal';

/** 字号档位到状态值的映射（与既有实现「小 / 标准」两档一致） */
const SIZE_VALUE_MAP: Record<DanmakuSize, number> = {
  small: 0,
  normal: 50,
};

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
 * 预设弹幕颜色列表（与既有实现一致）
 */
const COLOR_LIST: string[] = [
  '#FE0302', '#FF7204', '#FFAA02', '#FFD302', '#FFFF00',
  '#A0EE00', '#00CD00', '#019899', '#4266BE', '#89D5FF',
  '#CC0273', '#222222', '#9B9B9B', '#FFFFFF',
];

/**
 * 弹幕类型选择面板组件
 */
export const Selection = defineComponent<SelectionProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // 状态管理器（通过 Context 获取）
  // ============================================

  /** 运行时状态管理器，设置项变化时写入 */
  const stateMgr = useContext<TypedStateManager<PlayerStateMap> | null>(
    StateContext,
  );

  // ============================================
  // 状态数据
  // ============================================

  /** 当前选中的弹幕模式 */
  let currentMode = props.initialMode || 1;

  /** 当前选中的弹幕字号 */
  let currentSize = props.initialSize || 'normal';

  /** 当前选中的弹幕颜色 */
  let currentColor = props.initialColor || '#FFFFFF';

  // ============================================
  // DOM 元素引用
  // ============================================

  /** 字号「小」按钮元素引用 */
  const sizeSmallRef = useTemplateRef<HTMLDivElement>(lifecycle, 'sizeSmallRef');

  /** 字号「标准」按钮元素引用 */
  const sizeNormalRef = useTemplateRef<HTMLDivElement>(lifecycle, 'sizeNormalRef');

  /** 模式选项按钮元素引用集合（按渲染顺序：滚动 / 顶部 / 底部） */
  const modeButtonRefs = [
    useTemplateRef<HTMLDivElement>(lifecycle, 'modeButtonRef1'),
    useTemplateRef<HTMLDivElement>(lifecycle, 'modeButtonRef2'),
    useTemplateRef<HTMLDivElement>(lifecycle, 'modeButtonRef3'),
  ];

  /** 颜色输入框元素引用 */
  const inputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'inputRef');

  /** 颜色预览方块元素引用 */
  const colorBoxRef = useTemplateRef<HTMLDivElement>(lifecycle, 'colorBoxRef');

  /** 颜色选择列表面元素引用 */
  const colorPickerRef = useTemplateRef<HTMLUListElement>(lifecycle, 'colorPickerRef');

  // ============================================
  // 状态写入
  // ============================================

  /**
   * 将当前颜色写入运行时状态
   * @param color - 颜色值
   */
  const writeColorState = (color: string): void => {
    stateMgr?.set(PlayerStateKeyEnum.DANMAKU_COLOR, color);
  };

  /**
   * 将当前模式写入运行时状态
   * @param mode - 弹幕模式
   */
  const writeModeState = (mode: DanmakuMode): void => {
    stateMgr?.set(PlayerStateKeyEnum.DANMAKU_MODE, mode);
  };

  /**
   * 将当前字号写入运行时状态
   * @param size - 弹幕字号档位
   */
  const writeSizeState = (size: DanmakuSize): void => {
    stateMgr?.set(PlayerStateKeyEnum.DANMAKU_FONT_SIZE, SIZE_VALUE_MAP[size]);
  };

  // ============================================
  // 事件处理
  // ============================================

  /**
   * 处理颜色选择事件（色板点击）
   * @param element - 被点击的色板元素
   * @param color - 选中的颜色值
   */
  const selectColor = (element: HTMLElement, color: string): void => {
    // 清除其余色板的选中态，仅保留当前项
    colorPickerRef.value
      ?.querySelectorAll('.color-picker-option')
      .forEach((option) => option.classList.remove('color-picker-option-active'));
    element.classList.add('color-picker-option-active');
    if (inputRef.value) {
      inputRef.value.value = color;
    }
    if (colorBoxRef.value) {
      colorBoxRef.value.style.background = color;
    }
    currentColor = color;
    writeColorState(color);
    props.onColorChange?.(color);
    lifecycle.emit?.('colorChange', color);
  };

  /**
   * 处理颜色输入框输入事件
   * 保证输入是以 "#" 开始的合法颜色值（与既有实现 handleInput 一致），
   * 输入有效时同步预览方块颜色并写入状态。
   * @param event - 输入事件
   */
  const handleInput = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement)) return;
    /** 输入框当前值 */
    const value = event.target.value;
    if (inputRef.value) {
      if (!value.startsWith('#')) {
        // 更新值，但不触发 input 事件，避免无限循环（与既有实现一致）
        inputRef.value.value = `#${value}`;
      }
      if (value.length >= 4 && colorBoxRef.value) {
        colorBoxRef.value.style.background = value;
        currentColor = value;
        writeColorState(value);
        props.onColorChange?.(value);
      }
    }
  };

  /**
   * 处理弹幕模式选择事件
   * @param index - 选项索引（对应 modeButtonRefs）
   * @param mode - 选中的弹幕模式
   */
  const handleModeSelect = (index: number, mode: DanmakuMode): void => {
    currentMode = mode;
    // 更新选中态类名
    modeButtonRefs.forEach((ref, i) => {
      ref.value?.classList.toggle('active', i === index);
    });
    writeModeState(mode);
    props.onModeChange?.(mode);
    lifecycle.emit?.('modeChange', mode);
  };

  /**
   * 处理弹幕字号选择事件
   * @param size - 选中的弹幕字号档位
   */
  const handleSizeSelect = (size: DanmakuSize): void => {
    currentSize = size;
    if (sizeSmallRef.value) {
      sizeSmallRef.value.classList.toggle('active', size === 'small');
    }
    if (sizeNormalRef.value) {
      sizeNormalRef.value.classList.toggle('active', size === 'normal');
    }
    writeSizeState(size);
    props.onSizeChange?.(size);
    lifecycle.emit?.('sizeChange', size);
  };

  // ============================================
  // DOM 更新方法（对外 API）
  // ============================================

  /**
   * 外部设置弹幕颜色
   * @param color - 颜色值
   */
  const setColor = (color: string): void => {
    if (inputRef.value) {
      inputRef.value.value = color;
    }
    if (colorBoxRef.value) {
      colorBoxRef.value.style.background = color;
    }
    currentColor = color;
    writeColorState(color);
  };

  /**
   * 外部设置弹幕模式
   * @param mode - 弹幕模式
   */
  const setMode = (mode: DanmakuMode): void => {
    /** 模式选项列表的渲染顺序：滚动 / 顶部 / 底部 */
    const modeOrder: DanmakuMode[] = [1, 5, 4];
    const index = modeOrder.indexOf(mode);
    if (index >= 0) {
      handleModeSelect(index, mode);
    }
  };

  /**
   * 外部设置弹幕字号
   * @param size - 弹幕字号档位
   */
  const setSize = (size: DanmakuSize): void => {
    handleSizeSelect(size);
  };

  // ============================================
  // 渲染函数
  // ============================================

  /**
   * 渲染字号选择行
   * @returns 字号选择虚拟节点
   */
  const renderSizeSelection = (): VNode =>
    h('div', { class: 'player-mode-selection-row fontsize' },
      h('div', { class: 'row-title' }, '字号'),
      h('div', { class: 'row-selection' },
        h('div', { class: 'hui-radio-wrap-button' },
          h('div', {
            class: `radio-button${currentSize === 'small' ? ' active' : ''}`,
            ref: 'sizeSmallRef',
            onClick: () => handleSizeSelect('small'),
          }, h('span', {}, '小')),
          h('div', {
            class: `radio-button${currentSize === 'normal' ? ' active' : ''}`,
            ref: 'sizeNormalRef',
            onClick: () => handleSizeSelect('normal'),
          }, h('span', {}, '标准')),
        ),
      ),
    );

  /**
   * 渲染模式选择行
   * @returns 模式选择虚拟节点
   */
  const renderModeSelection = (): VNode => {
    /** 弹幕模式选项列表，包含模式值、显示标签和图标路径（与既有实现一致） */
    const modes: { value: DanmakuMode; label: string; icon: string }[] = [
      { value: 1, label: '滚动', icon: 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM11 9h6a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2zm-3 2H6V9h2v2zm4 4h-2v-2h2v2zm9 0h-6a1 1 0 0 1 0-2h6a1 1 0 0 1 0 2z' },
      { value: 5, label: '顶部', icon: 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM9 9H7V7h2v2zm4 0h-2V7h2v2zm4 0h-2V7h2v2zm4 0h-2V7h2v2z' },
      { value: 4, label: '底部', icon: 'M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM9 21H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z' },
    ];

    return h('div', { class: 'player-mode-selection-row mode' },
      h('div', { class: 'row-title' }, '模式'),
      h('div', { class: 'row-selection' },
        ...modes.map((mode, index) =>
          h('div', {
            class: `selection-span js-action${currentMode === mode.value ? ' active' : ''}`,
            'data-type': 'mode',
            'data-value': mode.value.toString(),
            name: 'mode_selector',
            ref: `modeButtonRef${index + 1}`,
            onClick: () => handleModeSelect(index, mode.value),
          },
            h('span', { class: 'selection-icon', name: 'mode_selector' },
              h('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                'xml:space': 'preserve',
                'data-pointer': 'none',
                style: 'enable-background:new 0 0 28 28',
                viewBox: '0 0 28 28',
              }, h('path', { d: mode.icon })),
            ),
            h('span', { class: 'selection-name', name: 'mode_selector' }, mode.label),
          ),
        ),
      ),
    );
  };

  /**
   * 渲染颜色选择行
   * @returns 颜色选择虚拟节点
   */
  const renderColorSelection = (): VNode =>
    h('div', { class: 'player-mode-selection-row color' },
      h('div', { class: 'row-title' }, '颜色'),
      h('div', { class: 'row-selection' },
        h('div', { class: 'color-input-warp' },
          h('input', {
            type: 'text',
            ref: 'inputRef',
            onInput: handleInput,
          }),
          h('div', { class: 'color-input-box', ref: 'colorBoxRef' }),
        ),
      ),
      h('ul', { class: 'color-picker-options', ref: 'colorPickerRef' },
        ...COLOR_LIST.map((color) =>
          h('li', {
            class: 'color-picker-option',
            style: { background: color },
            onClick: (event: MouseEvent) => {
              if (event.currentTarget instanceof HTMLElement) {
                selectColor(event.currentTarget, color);
              }
            },
          }),
        ),
      ),
    );

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后：初始化输入框与预览方块颜色（与既有实现 initInput 一致），
   * 同步初始设置到运行时状态，并向外暴露设置方法
   */
  lifecycle.onMounted = (): void => {
    if (inputRef.value) {
      inputRef.value.value = currentColor;
    }
    if (colorBoxRef.value) {
      colorBoxRef.value.style.background = currentColor;
    }
    writeColorState(currentColor);
    writeModeState(currentMode);
    writeSizeState(currentSize);
    lifecycle.emit?.('selectionMounted', { setColor, setMode, setSize });
  };

  // ============================================
  // 组件渲染（DOM 结构与既有实现一致）
  // ============================================

  return h('div', { class: 'player-mode-selection-panel' },
    renderSizeSelection(),
    renderModeSelection(),
    renderColorSelection(),
  );
});
