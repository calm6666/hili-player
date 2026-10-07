/**
 * ============================================
 * 播放倍速选择菜单组件 (PlaybackRateMenu)
 * ============================================
 * 播放倍速选择下拉菜单，支持倍速列表渲染、
 * 当前倍率高亮、菜单悬停动画回调
 *
 * 本次修正：
 * 1. 选中态类名由 `active` 改为 `player-state-active`，与 scss 选择器
 *    `.player-ctrl-playbackrate-menu-item.player-state-active` 对齐
 *    （此前类名不匹配，选中项高亮实际不生效）；
 * 2. 新增对运行时状态 `player.playbackRate` 的订阅：倍速被外部改变
 *    （播放器 API / 快捷键 / 配置恢复）时，结果文本与高亮会同步更新
 *    （此前只在挂载时读取一次）；
 * 3. 挂载时通过 `playbackRateMenuMounted` 回传 `setRate`，父层可主动同步。
 */

import { h, defineComponent, useTemplateRef, useState, useContext } from '@/core';
import { useComponentUnmount } from '@/hili-player/core/componentUnmount';
import { rafTimeout, cancelRaf } from '@/utils/rafTimeout';
import type { AnimationFrameID } from '@/utils/rafTimeout';
import type { VNode } from '@/types';
import { PlayerStateKeyEnum, StateContext } from '@/store/runtimeState';

const MENU_SHOW_DELAY = 120;
const MENU_HIDE_DELAY = 220;

/**
 * PlaybackRateMenu 组件 Props 接口
 */
export interface PlaybackRateMenuProps {
  rate?: number;
  rates?: number[];
}

export type PlaybackRateMenuEvents = {
  rateChange: number;
  /** 挂载完成回传控制方法（供父层在倍速被外部改变时同步 UI） */
  playbackRateMenuMounted: { setRate: (rate: number) => void };
};

/**
 * PlaybackRateMenu 组件 - 使用 defineComponent 创建独立组件
 * 渲染播放倍速选择菜单，支持当前倍速高亮
 */
export const PlaybackRateMenu = defineComponent<PlaybackRateMenuProps, PlaybackRateMenuEvents>((props, lifecycle) => {
  /** 初始倍速与可选档位 */
  const { rate = 1, rates = [2, 1.5, 1.25, 1, 0.75, 0.5] } = props;

  /** 运行时状态管理器（用于订阅当前倍速） */
  const state = useContext(StateContext);

  // ============================================
  // DOM 引用
  // ============================================

  /** 倍速显示文本元素引用 */
  const backrateResultTextRef = useTemplateRef<HTMLDivElement>(lifecycle, 'backrateResultTextRef');

  /** 倍速下拉菜单列表元素引用 */
  const backrateMenuRef = useTemplateRef<HTMLUListElement>(lifecycle, 'backrateMenuRef');

  /** 倍速按钮根元素引用（面板显隐的类名挂载点） */
  const rootRef = useTemplateRef<HTMLDivElement>(lifecycle, 'backrateRootRef');

  /** 展开定时器 */
  let showTimer: AnimationFrameID | null = null;

  /** 收起定时器 */
  let hideTimer: AnimationFrameID | null = null;

  /**
   * 落地面板展开态：直接给自己根节点的 DOM 加 / 去状态类
   * @param show - 是否展开
   */
  const setShown = (show: boolean): void => {
    rootRef.value?.classList.toggle('state-show', show);
  };

  /** 取消两个方向的排队任务 */
  const clearTimers = (): void => {
    cancelRaf(showTimer!);
    cancelRaf(hideTimer!);
    showTimer = null;
    hideTimer = null;
  };

  // ============================================
  // 状态
  // ============================================

  /** 倍速菜单项 DOM 元素列表，用于切换高亮状态 */
  const menuItems: HTMLLIElement[] = [];

  /** 当前倍速（可变：订阅到状态变化后更新） */
  let currentRate = rate;

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
   * 刷新结果文本：1 倍速显示「倍速」，其它显示具体档位
   */
  const applyResultText = (): void => {
    if (backrateResultTextRef.value) {
      backrateResultTextRef.value.innerText =
        currentRate === 1 ? '倍速' : formatRateLabel(currentRate);
    }
  };

  /**
   * 同步选中态（框架无 diff，必须手动互斥）
   */
  const updateActive = (): void => {
    menuItems.forEach((item) => {
      const value = Number(item.getAttribute('data-value'));
      item.classList.toggle('player-state-active', value === currentRate);
    });
  };

  /**
   * 统一的倍速更新入口：更新当前值并刷新文本与高亮
   * @param next - 新的倍速值
   */
  const setRate = (next: number): void => {
    currentRate = next;
    applyResultText();
    updateActive();
  };

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 鼠标进入倍速按钮：延迟展开面板（面板显隐由本组件自己负责）
   */
  const handleMouseEnter = (): void => {
    cancelRaf(hideTimer!);
    hideTimer = null;
    if (showTimer !== null) return;
    showTimer = rafTimeout(() => {
      showTimer = null;
      setShown(true);
    }, MENU_SHOW_DELAY);
  };

  /**
   * 鼠标离开倍速按钮：延迟收起面板
   */
  const handleMouseLeave = (): void => {
    cancelRaf(showTimer!);
    showTimer = null;
    if (hideTimer !== null) return;
    hideTimer = rafTimeout(() => {
      hideTimer = null;
      setShown(false);
    }, MENU_HIDE_DELAY);
  };

  /**
   * 渲染单个倍速菜单项
   * @param rateValue - 倍速值
   * @returns 菜单项 VNode
   */
  const renderRateItem = (rateValue: number): VNode => {
    /** 是否为当前选中的倍速 */
    const isActive = rateValue === currentRate;
    return h('li', {
      class: [
        'player-ctrl-playbackrate-menu-item',
        isActive ? 'player-state-active' : '',
      ]
        .filter(Boolean)
        .join(' '),
      'data-value': rateValue.toString(),
      onClick: () => {
        // 先本地反馈，随后由运行时状态订阅统一校正
        setRate(rateValue);
        lifecycle.emit?.('rateChange', rateValue);
      },
    }, formatRateLabel(rateValue));
  };

  // ============================================
  // 状态监听
  // ============================================

  // 框架无响应式：倍速被外部改变时不会自动更新 DOM，必须在回调里手动刷新
  if (state) {
    useState(
      state,
      PlayerStateKeyEnum.PLAYBACK_RATE,
      (next) => {
        setRate(next);
      },
      lifecycle,
    );
  }

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，收集菜单项 DOM 元素并同步初始倍速显示
   */
  lifecycle.onMounted = (): void => {
    // 收集菜单项 DOM 元素
    if (backrateMenuRef.value) {
      const items = backrateMenuRef.value.querySelectorAll('.player-ctrl-playbackrate-menu-item');
      menuItems.length = 0;
      items.forEach((item) => {
        if (item instanceof HTMLLIElement) {
          menuItems.push(item);
        }
      });
    }

    // 同步初始倍速的文本与高亮
    applyResultText();
    updateActive();

    // 回传控制方法，供父层主动同步
    lifecycle.emit?.('playbackRateMenuMounted', { setRate });
  };

  useComponentUnmount(lifecycle, clearTimers);

  // ============================================
  // 主渲染函数
  // ============================================

  return h('div', {
    class: 'player-ctrl-btn player-ctrl-playbackrate',
    role: 'button',
    'aria-label': '倍速',
    ref: 'backrateRootRef',
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  },
    // 当前倍速显示
    h('div', { class: 'player-ctrl-playbackrate-result', ref: 'backrateResultTextRef' }, '倍速'),
    // 倍速下拉菜单
    h('div', { class: 'player-ctrl-playbackrate-menu-wrap' },
      h('ul', { class: 'player-ctrl-playbackrate-menu', ref: 'backrateMenuRef' },
        ...rates.map((r) => renderRateItem(r))
      )
    )
  );
});
