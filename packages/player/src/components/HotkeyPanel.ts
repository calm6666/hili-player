/**
 * ============================================
 * 快捷键面板组件
 * ============================================
 *
 * DOM 结构与 CSS 类名与既有实现保持一致：
 *   .player-hotkey-panel
 *     .player-hotkey-panel-title
 *       「快捷键说明」
 *       .player-hotkey-panel-close > .common-svg-icon > svg
 *     .player-hotkey-panel-area
 *       .player-hotkey-panel-content
 *         .player-hotkey-panel-content-item
 *           .player-hotkey-panel-content-name
 *           .player-hotkey-panel-content-desc
 *
 * 显隐由根节点上的 player-panel-active 类控制（基态 display: none），
 * 不使用内联 display，否则会覆盖掉类选择器的 display: block。
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';
import { HOTKEYS } from '@/hili-player/core/hotkeys';

/**
 * 快捷键项接口
 * 描述单个快捷键的按键名称和功能说明
 */
export interface HotkeyItem {
  /** 快捷键按键名称 */
  name: string;
  /** 快捷键功能描述 */
  desc: string;
}

/**
 * 快捷键面板组件 Props 接口
 */
export interface HotkeyPanelProps {
  /** 是否立即显示面板（默认为隐藏，由用户主动打开） */
  visible?: boolean;
  /** 快捷键列表，未提供时使用 HOTKEYS（与真实快捷键行为同一数据源） */
  hotkeys?: HotkeyItem[];
  /** 关闭面板的回调函数 */
  onClose?: () => void;
}

/**
 * 快捷键面板对外暴露的 API
 */
export interface HotkeyPanelApi {
  /** 打开面板 */
  open: () => void;
  /** 关闭面板 */
  close: () => void;
}

/**
 * 关闭图标（与既有实现的 Close 图标一致）
 */
const CloseIcon = (): ReturnType<typeof h> =>
  h(
    'svg',
    { viewBox: '0 0 1024 1024', version: '1.1', xmlns: 'http://www.w3.org/2000/svg' },
    h('path', {
      d: 'M512 444.16l297.088-297.088c17.088-17.152 46.208-15.872 64.96 2.88 18.752 18.752 20.032 47.872 2.88 64.96L579.904 512l297.024 297.088c17.152 17.088 15.872 46.208-2.88 64.96-18.752 18.752-47.872 20.032-64.96 2.88L512 579.904l-297.088 297.024c-17.088 17.152-46.208 15.872-64.96-2.88-18.752-18.752-20.032-47.872-2.88-64.96L444.096 512 147.072 214.912c-17.152-17.088-15.872-46.208 2.88-64.96 18.752-18.752 47.872-20.032 64.96-2.88L512 444.096z',
    }),
  );

/**
 * 快捷键面板组件
 * 展示播放器支持的快捷键列表及其功能说明
 */
export const HotkeyPanel = defineComponent<HotkeyPanelProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 面板根容器 DOM 引用 */
  const panelRef = useTemplateRef<HTMLDivElement>(lifecycle, 'panelRef');

  /**
   * 处理关闭面板操作
   */
  const handleClose = (): void => {
    close();
    props.onClose?.();
  };

  /**
   * 渲染快捷键列表项
   * @returns 快捷键项虚拟节点数组
   */
  const renderHotkeyItems = (): ReturnType<typeof h>[] => {
    /** 实际使用的快捷键列表，优先使用 props 传入值，否则使用 HOTKEYS */
    const hotkeys: HotkeyItem[] = props.hotkeys ?? HOTKEYS;

    return hotkeys.map((item: HotkeyItem) =>
      h(
        'div',
        { class: 'player-hotkey-panel-content-item' },
        h('span', { class: 'player-hotkey-panel-content-name' }, item.name),
        h('span', { class: 'player-hotkey-panel-content-desc' }, item.desc)
      )
    );
  };

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 显示面板组件
   * 通过 player-panel-active 类切换（基态为 display: none）
   */
  const show = (): void => {
    panelRef.value?.classList.add('player-panel-active');
  };

  /**
   * 隐藏面板组件
   */
  const hide = (): void => {
    panelRef.value?.classList.remove('player-panel-active');
  };

  /**
   * 打开面板（对外 API 语义化别名）
   */
  const open = (): void => {
    show();
  };

  /**
   * 关闭面板（对外 API 语义化别名）
   */
  const close = (): void => {
    hide();
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后：按 visible 决定初始显隐，并通过事件向外暴露控制方法
   */
  lifecycle.onMounted = (): void => {
    if (props.visible) {
      show();
    }
    lifecycle.emit?.('hotkeyPanelMounted', { show, hide, open, close });
  };

  return h(
    'div',
    {
      class: 'player-hotkey-panel',
      ref: 'panelRef',
    },
    h(
      'div',
      { class: 'player-hotkey-panel-title' },
      '快捷键说明',
      h(
        'span',
        { class: 'player-hotkey-panel-close', onClick: handleClose },
        h('span', { class: 'common-svg-icon' }, CloseIcon())
      )
    ),
    h(
      'div',
      { class: 'player-hotkey-panel-area' },
      h(
        'div',
        {
          class: 'player-hotkey-panel-content',
          style: {
            transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
            transitionDuration: '0ms',
            transform: 'translate(0px, 0px) scale(1) translateZ(0px)',
          },
        },
        ...renderHotkeyItems()
      )
    )
  );
});
