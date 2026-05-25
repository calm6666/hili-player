/**
 * ============================================
 * 右键菜单组件 (Context)
 * ============================================
 * 使用 h 函数框架实现的播放器右键菜单组件
 * 保持与老播放器完全相同的 DOM 结构和类名
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * 菜单项配置
 */
export interface ContextMenuItem {
  /** 动作标识 */
  dataAction: string;
  /** 显示文本 */
  text: string;
}

/**
 * 菜单位置
 */
export interface ContextOffset {
  /** 左边距 */
  left: number;
  /** 上边距 */
  top: number;
}

/**
 * Context 组件 Props 接口
 */
export interface ContextProps {
  /** 菜单项列表 */
  menuItems?: ContextMenuItem[];
  /** 播放器版本 */
  version?: string;
  /** 菜单点击回调 */
  onMenuClick?: (action: string) => void;
  /** 关闭菜单回调 */
  onClose?: () => void;
  /** 打开面板回调 */
  onOpenPanel?: (panel: 'color' | 'keyboard' | 'info') => void;
}

/**
 * 默认菜单项
 */
const DEFAULT_MENU_ITEMS: ContextMenuItem[] = [
  { dataAction: 'copyLink', text: '复制视频地址（精准空降）' },
  { dataAction: 'color', text: '视频色彩调整' },
  { dataAction: 'keyboard', text: '快捷键说明' },
  { dataAction: 'version', text: '播放器版本 1.0.0' },
  { dataAction: 'info', text: '视频统计信息' },
];

/**
 * 右键菜单组件
 * 使用 h 函数实现，保持与老播放器完全相同的 DOM 结构和类名
 */
export const Context = defineComponent<ContextProps>((props, lifecycle) => {
  // ============================================
  // 状态数据
  // ============================================
  const menuItems = props.menuItems || DEFAULT_MENU_ITEMS;
  const version = props.version || '1.0.0';

  // ============================================
  // DOM 元素引用
  // ============================================
  const contextmenuRef: { current: HTMLUListElement | null } = { current: null };
  const contextAreaRef: { current: HTMLDivElement | null } = { current: null };

  // ============================================
  // 方法
  // ============================================

  /**
   * 显示菜单
   * @param offset - 菜单位置
   */
  const showMenu = (offset: ContextOffset): void => {
    if (contextmenuRef.current) {
      contextmenuRef.current.style.left = `${offset.left}px`;
      contextmenuRef.current.style.top = `${offset.top}px`;
      contextmenuRef.current.classList.add('player-active');
    }
    lifecycle.emit?.('showMenu', offset);
    document.addEventListener('click', hideMenu);
  };

  /**
   * 隐藏菜单
   */
  const hideMenu = (): void => {
    contextmenuRef.current?.classList.remove('player-active');
    props.onClose?.();
    lifecycle.emit?.('hideMenu');
    document.removeEventListener('click', hideMenu);
  };

  /**
   * 处理菜单点击
   * @param dataAction - 动作标识
   */
  const clickMenu = (dataAction: string): void => {
    props.onMenuClick?.(dataAction);
    lifecycle.emit?.('menuClick', dataAction);

    switch (dataAction) {
      case 'copyLink':
        navigator.clipboard.writeText(document.URL);
        break;
      case 'color':
        props.onOpenPanel?.('color');
        lifecycle.emit?.('openPanel', 'color');
        break;
      case 'keyboard':
        props.onOpenPanel?.('keyboard');
        lifecycle.emit?.('openPanel', 'keyboard');
        break;
      case 'version':
        // 版本信息无需特殊处理
        break;
      case 'info':
        props.onOpenPanel?.('info');
        lifecycle.emit?.('openPanel', 'info');
        break;
    }
    hideMenu();
  };

  // ============================================
  // 渲染函数
  // ============================================

  /**
   * 渲染菜单项
   */
  const renderMenuItems = (): VNode[] => {
    return menuItems.map((item) =>
      h('li', {
        'data-action': item.dataAction,
        onClick: () => clickMenu(item.dataAction),
      }, item.dataAction === 'version' ? `${item.text} ${version}` : item.text)
    );
  };

  // ============================================
  // 组件渲染
  // ============================================
  return h('div', { class: 'player-context-area', ref: contextAreaRef },
    h('ul', { class: 'player-contextmenu player-black', ref: contextmenuRef }, ...renderMenuItems())
  );
});
