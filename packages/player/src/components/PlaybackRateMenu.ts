/**
 * ============================================
 * 播放倍速选择菜单组件 (PlaybackRateMenu)
 * ============================================
 * 播放倍速选择下拉菜单，支持倍速列表渲染、
 * 当前倍率高亮、菜单悬停动画回调
 */

import { h, defineComponent, ref } from '@/core';
import type { VNode } from '@/types';

/**
 * PlaybackRateMenu 组件 Props 接口
 */
export interface PlaybackRateMenuProps {
  rate?: number;
  rates?: number[];
}

export type PlaybackRateMenuEvents = {
  rateChange: number;
  menuAnimation: { type: 'playbackrate'; action: 'show' | 'hide' };
  playbackRateMenuMounted: undefined;
};

/**
 * PlaybackRateMenu 组件 - 使用 defineComponent 创建独立组件
 * 渲染播放倍速选择菜单，支持当前倍速高亮
 */
export const PlaybackRateMenu = defineComponent<PlaybackRateMenuProps, PlaybackRateMenuEvents>((props, lifecycle) => {
  /** 当前播放倍速，默认为 1 倍速 */
  const { rate = 1, rates = [2, 1.5, 1.25, 1, 0.75, 0.5] } = props;

  // ============================================
  // DOM 引用
  // ============================================

  /** 倍速按钮根元素引用 */
  const backrateBtnRef = ref<HTMLDivElement>();

  /** 倍速显示文本元素引用 */
  const backrateResultTextRef = ref<HTMLDivElement>();

  /** 倍速下拉菜单列表元素引用 */
  const backrateMenuRef = ref<HTMLUListElement>();

  // ============================================
  // 状态
  // ============================================

  /** 倍速菜单项 DOM 元素列表，用于切换高亮状态 */
  const menuItems: HTMLLIElement[] = [];

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 鼠标进入倍速按钮时触发的回调
   */
  const handleMouseEnter = (): void => {
    lifecycle.emit?.('menuAnimation', { type: 'playbackrate', action: 'show' });
  };

  /**
   * 鼠标离开倍速按钮时触发的回调
   */
  const handleMouseLeave = (): void => {
    lifecycle.emit?.('menuAnimation', { type: 'playbackrate', action: 'hide' });
  };

  // ============================================
  // 渲染辅助函数
  // ============================================

  /**
   * 格式化倍速标签文本
   * @param rateValue - 倍速值
   * @returns 格式化后的显示文本
   */
  const formatRateLabel = (rateValue: number): string => {
    return rateValue === 1 ? '1.0X' : `${rateValue}X`;
  };

  /**
   * 渲染单个倍速菜单项
   * @param rateValue - 倍速值
   * @returns 菜单项 VNode
   */
  const renderRateItem = (rateValue: number): VNode => {
    /** 是否为当前选中的倍速 */
    const isActive = rateValue === rate;
    return h('li', {
      class: ['player-ctrl-playbackrate-menu-item', isActive ? 'active' : ''].filter(Boolean).join(' '),
      'data-value': rateValue.toString(),
      ref: ref<HTMLLIElement>(),
      onClick: (e: MouseEvent) => {
        /** 点击的目标元素 */
        const target = e.currentTarget;
        if (target instanceof HTMLElement) {
          // 更新菜单项高亮
          menuItems.forEach((item) => item.classList.remove('active'));
          target.classList.add('active');
        }
        // 更新倍速显示文本
        if (backrateResultTextRef.current) {
          backrateResultTextRef.current.innerText = rateValue === 1 ? '倍速' : formatRateLabel(rateValue);
        }
        lifecycle.emit?.('rateChange', rateValue);
      },
    }, formatRateLabel(rateValue));
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，收集菜单项 DOM 元素并设置初始倍速显示
   */
  lifecycle.onMounted = (): void => {
    // 收集菜单项 DOM 元素
    if (backrateMenuRef.current) {
      const items = backrateMenuRef.current.querySelectorAll('.player-ctrl-playbackrate-menu-item');
      menuItems.length = 0;
      items.forEach((item) => {
        if (item instanceof HTMLLIElement) {
          menuItems.push(item);
        }
      });
    }

    // 设置初始倍速显示
    if (backrateResultTextRef.current) {
      backrateResultTextRef.current.innerText = rate === 1 ? '倍速' : formatRateLabel(rate);
    }

    lifecycle.emit?.('playbackRateMenuMounted');
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', {
    class: 'player-ctrl-btn player-ctrl-playbackrate',
    role: 'button',
    'aria-label': '倍速',
    ref: backrateBtnRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  },
    // 当前倍速显示
    h('div', { class: 'player-ctrl-playbackrate-result', ref: backrateResultTextRef }, '倍速'),
    // 倍速下拉菜单
    h('div', { class: 'player-ctrl-playbackrate-menu-wrap' },
      h('ul', { class: 'player-ctrl-playbackrate-menu', ref: backrateMenuRef },
        ...rates.map((r) => renderRateItem(r))
      )
    )
  );
});
