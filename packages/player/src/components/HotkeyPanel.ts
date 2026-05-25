/**
 * ============================================
 * 快捷键面板组件
 * ============================================
 * 使用 h 函数实现的快捷键面板组件
 */

import { h, defineComponent } from '@/core';

/**
 * 快捷键项接口
 */
export interface HotkeyItem {
  /** 按键名称 */
  name: string;
  /** 功能描述 */
  desc: string;
}

/**
 * 快捷键面板组件 Props 接口
 */
export interface HotkeyPanelProps {
  /** 是否显示 */
  visible?: boolean;
  /** 快捷键列表 */
  hotkeys?: HotkeyItem[];
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 默认快捷键列表
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
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const HotkeyPanel = defineComponent<HotkeyPanelProps>((props) => {
  /**
   * 处理关闭
   */
  const handleClose = (): void => {
    props.onClose?.();
  };

  /**
   * 渲染快捷键列表
   */
  const renderHotkeyItems = (): ReturnType<typeof h>[] => {
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

  return h(
    'div',
    {
      class: 'player-hotkey-panel',
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
