/**
 * ============================================
 * 快捷键面板组件
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';

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
  /** 是否显示面板 */
  visible?: boolean;
  /** 快捷键列表，未提供时使用默认列表 */
  hotkeys?: HotkeyItem[];
  /** 关闭面板的回调函数 */
  onClose?: () => void;
}

/**
 * 默认快捷键列表
 * 包含播放器所有支持的快捷键及其功能描述
 */
const DEFAULT_HOTKEYS: HotkeyItem[] = [
  { name: 'E', desc: '收藏' },
  { name: 'Space', desc: '播放/暂停' },
  { name: '→', desc: '单次快进5s，长按倍速播放' },
  { name: '←', desc: '快退5s' },
  { name: '↑', desc: '音量增加10%' },
  { name: '↓', desc: '音量降低10%' },
  { name: 'Esc', desc: '退出全屏' },
  { name: '媒体键 play/pause', desc: '播放/暂停' },
  { name: 'F', desc: '全屏/退出全屏' },
  { name: '[', desc: '多P 上一个' },
  { name: ']', desc: '多P 下一个' },
  { name: 'Enter', desc: '发弹幕' },
  { name: 'D', desc: '开启/关闭弹幕' },
  { name: 'M', desc: '开启/关闭静音' },
];

/**
 * 快捷键面板组件
 * 展示播放器支持的快捷键列表及其功能说明
 */
export const HotkeyPanel = defineComponent<HotkeyPanelProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 面板根容器 DOM 引用 */
  const panelRef = ref<HTMLDivElement>();

  /**
   * 处理关闭面板操作
   */
  const handleClose = (): void => {
    props.onClose?.();
  };

  /**
   * 渲染快捷键列表项
   * @returns 快捷键项虚拟节点数组
   */
  const renderHotkeyItems = (): ReturnType<typeof h>[] => {
    /** 实际使用的快捷键列表，优先使用 props 传入值，否则使用默认列表 */
    const hotkeys = props.hotkeys ?? DEFAULT_HOTKEYS;

    return hotkeys.map((item: HotkeyItem) =>
      h(
        'div',
        { class: 'player-hotkey-item' },
        h('span', { class: 'player-hotkey-name' }, item.name),
        h('span', { class: 'player-hotkey-desc' }, item.desc)
      )
    );
  };

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 显示面板组件
   */
  const show = (): void => {
    if (panelRef.current) {
      panelRef.current.style.display = '';
    }
  };

  /**
   * 隐藏面板组件
   */
  const hide = (): void => {
    if (panelRef.current) {
      panelRef.current.style.display = 'none';
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，通过事件向外暴露控制方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('hotkeyPanelMounted', { show, hide });
  };

  /**
   * 组件销毁前，清空 DOM 引用以防止内存泄漏
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  return h(
    'div',
    {
      class: 'player-hotkey-panel',
      ref: panelRef,
      style: {
        display: props.visible ? '' : 'none',
      },
    },
    h(
      'div',
      { class: 'player-hotkey-panel-title' },
      '快捷键说明',
      h(
        'span',
        { class: 'player-hotkey-panel-close', onClick: handleClose },
        h('span', { class: 'common-svg-icon' }, '×')
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
