/**
 * ============================================
 * 右键菜单组件 (Context)
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import { isBrowser } from '@/utils';
import type { VNode, ComponentLifecycle } from '@/types';

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
  /** 左边距（像素） */
  left: number;
  /** 上边距（像素） */
  top: number;
}

/**
 * Context 组件 Props 接口
 */
export interface ContextProps {
  /** 菜单项列表 */
  menuItems?: ContextMenuItem[];
  /** 播放器版本号 */
  version?: string;
  /** 菜单点击回调 */
  onMenuClick?: (action: string) => void;
  /** 关闭菜单回调 */
  onClose?: () => void;
  /** 打开面板回调（色彩调整、快捷键说明、视频统计信息） */
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
 */
export const Context = defineComponent<ContextProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // 状态数据
  // ============================================

  /** 实际使用的菜单项列表，未传入时使用默认菜单项 */
  const menuItems = props.menuItems || DEFAULT_MENU_ITEMS;
  /** 播放器版本号，未传入时默认为 1.0.0 */
  const version = props.version || '1.0.0';

  // ============================================
  // DOM 元素引用
  // ============================================

  /** 右键菜单列表元素引用 */
  const contextmenuRef = ref<HTMLUListElement>();
  /** 右键菜单区域容器元素引用 */
  const contextAreaRef = ref<HTMLDivElement>();

  // ============================================
  // 方法
  // ============================================

  /**
   * 在指定坐标显示右键菜单
   * @param x - 左边距（像素）
   * @param y - 上边距（像素）
   */
  const showMenu = (x: number, y: number): void => {
    if (!isBrowser()) return;
    if (contextmenuRef.current) {
      contextmenuRef.current.style.left = `${x}px`;
      contextmenuRef.current.style.top = `${y}px`;
      contextmenuRef.current.classList.add('player-active');
    }
    document.addEventListener('click', hideMenu);
  };

  /**
   * 隐藏右键菜单并触发关闭回调
   */
  const hideMenu = (): void => {
    contextmenuRef.current?.classList.remove('player-active');
    props.onClose?.();
    lifecycle.emit?.('hideMenu');
    document.removeEventListener('click', hideMenu);
  };

  /**
   * 处理菜单项点击，根据动作标识执行对应操作
   * @param dataAction - 动作标识
   */
  const clickMenu = (dataAction: string): void => {
    props.onMenuClick?.(dataAction);
    lifecycle.emit?.('menuClick', dataAction);

    switch (dataAction) {
      case 'copyLink':
        if (isBrowser() && navigator.clipboard) {
          navigator.clipboard.writeText(document.URL);
        }
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
   * 渲染菜单项列表
   * @returns 菜单项 VNode 数组
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
  // 生命周期
  // ============================================

  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('contextMounted', { showMenu, hideMenu });
  };

  lifecycle.onBeforeDestroy = (): void => {
    document.removeEventListener('click', hideMenu);
  };

  // ============================================
  // 组件渲染
  // ============================================
  return h('div', { class: 'player-context-area', ref: contextAreaRef },
    h('ul', { class: 'player-contextmenu player-black', ref: contextmenuRef }, ...renderMenuItems())
  );
});
