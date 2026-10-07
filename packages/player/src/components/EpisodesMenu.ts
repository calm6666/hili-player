/**
 * ============================================
 * 选集面板组件 (EpisodesMenu)
 * ============================================
 * 控制栏右下角「选集」按钮 + 悬浮选集面板，支持命令式列表渲染、
 * 当前集高亮与播放中图标、空态展示、面板悬停动画回调。
 *
 * 框架无虚拟 DOM diff：`episodes` 数组变化不会触发重渲染，必须在
 * 状态订阅回调 / 生命周期钩子里手动重建 <li> 节点（与 QualityMenu 一致）。
 *
 * 可见性（普通模式隐藏 / 网页全屏与全屏可见）全部由
 * `styles/eplistmenu.scss` 用 visibility + width 控制，
 * 绝不能用 display —— 父层 RightControls 会用内联 style.display 控制该按钮显隐，
 * 内联优先级最高，用 display 会互相打架。
 */

import { h, defineComponent, useTemplateRef, useState, useContext, materialize } from '@/core';
import { useComponentUnmount } from '@/hili-player/core/componentUnmount';
import { rafTimeout, cancelRaf } from '@/utils/rafTimeout';
import type { AnimationFrameID } from '@/utils/rafTimeout';
import { PlayerStateKeyEnum, StateContext } from '@/store/runtimeState';
import type { VNode } from '@/types';

/**
 * 选集项
 */
export interface EpisodeOption {
  /** 唯一标识（对应 MediaItem.id / cid） */
  id?: string | number;
  /** 显示标题 */
  title?: string;
  /** 下标（必须与传入数组下标一致，点击时回传它） */
  index: number;
}

export interface EpisodesMenuProps {
  /** 选集列表（空数组时面板显示空态） */
  episodes: EpisodeOption[];
  /** 当前集下标 */
  currentIndex: number;
}

export interface EpisodesMenuEvents {
  /** 点击某一集 */
  episodeChange: (index: number) => void;
}

/** 列表区域最小高度，与参考实现的 min-height: 480px 对齐（普通模式盖掉，由 scss 控制） */
const MENU_MIN_HEIGHT = '180px';

/** 当前集「播放中」三段竖条图标（参考 DOM：viewBox 0 0 12 13 + 3 个 rect） */
const PlayingIcon = (): VNode =>
  h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      'data-pointer': 'none',
      viewBox: '0 0 12 13',
    },
    h('rect', { width: '2', height: '6', x: '1', y: '3.5', rx: '1' }),
    h('rect', { width: '2', height: '4', x: '9', y: '4.5', rx: '1' }),
    h('rect', { width: '2', height: '10', x: '5', y: '1.5', rx: '1' }),
  );

/**
 * EpisodesMenu 组件 - 使用 defineComponent 创建独立组件
 * 渲染选集按钮与选集面板，当前集高亮 + 播放中图标
 */
export const EpisodesMenu = defineComponent<EpisodesMenuProps, EpisodesMenuEvents>((props, lifecycle) => {
  const state = useContext(StateContext);

  // ============================================
  // DOM 引用
  // ============================================

  /** 选集列表容器（ul）引用 */
  const listRef = useTemplateRef<HTMLUListElement>(lifecycle, 'eplistListRef');

  /** 按钮根元素引用（面板显隐的类名挂载点） */
  const rootRef = useTemplateRef<HTMLDivElement>(lifecycle, 'eplistRootRef');

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
  // 内部状态（非响应式，仅渲染时手动维护）
  // ============================================

  /** 当前集下标（初始取 props，之后由 props/运行时状态推动） */
  let activeIndex: number = props.currentIndex ?? 0;

  /** 最近一次渲染的选集列表（供选中态 / 空态判断） */
  let currentList: EpisodeOption[] = [];

  // ============================================
  // 渲染辅助函数
  // ============================================

  /**
   * 创建当前集「播放中」图标虚拟节点（仅当前集插入）
   * @returns 图标 span 的虚拟节点
   */
  const renderPlayingIcon = (): VNode =>
    h('span', { class: 'player-ctrl-eplist-multi-menu-item-icon' }, PlayingIcon());

  /**
   * 创建单个选集项
   * 普通项：li[data-index] > span.player-ctrl-eplist-multi-menu-item-text
   * 当前项：额外加 player-state-active 类，并在文字前插播放中图标
   * @param item - 选集项
   * @returns 选集项 li 元素
   */
  const createItem = (item: EpisodeOption): HTMLLIElement => {
    const isActive = item.index === activeIndex;
    return materialize(
      h(
        'li',
        {
          class: isActive
            ? 'player-ctrl-eplist-multi-menu-item player-state-active'
            : 'player-ctrl-eplist-multi-menu-item',
          'data-index': String(item.index),
          onClick: () => {
            // 当前项点击不做任何事
            if (item.index === activeIndex) return;
            activeIndex = item.index;
            renderEpisodes(currentList);
            lifecycle.emit?.('episodeChange', item.index);
          },
        },
        ...(isActive ? [renderPlayingIcon()] : []),
        h(
          'span',
          { class: 'player-ctrl-eplist-multi-menu-item-text' },
          item.title ?? '',
        ),
      ),
    ) as HTMLLIElement;
  };

  /**
   * 创建空态项（episodes 为空数组时展示）
   * @returns 空态 li 元素
   */
  const createEmptyItem = (): HTMLLIElement =>
    materialize(
      h(
        'li',
        {
          class:
            'player-ctrl-eplist-multi-menu-item player-ctrl-eplist-empty',
        },
        h(
          'span',
          { class: 'player-ctrl-eplist-multi-menu-item-text' },
          '暂无选集',
        ),
      ),
    ) as HTMLLIElement;

  /**
   * 命令式重建选集列表（列表数据 / 当前集变化时调用）
   * @param list - 选集列表
   */
  const renderEpisodes = (list?: EpisodeOption[]): void => {
    const items = list ?? [];
    currentList = items;

    if (!listRef.value) return;
    listRef.value.replaceChildren(
      ...(items.length === 0
        ? [createEmptyItem()]
        : items.map((item) => createItem(item))),
    );
  };

  // ============================================
  // 状态监听（当前集下标变化 → 重建高亮与图标）
  // ============================================

  // 框架无响应式：外部切换剧集时 props/状态不会自动刷新 DOM，只能订阅运行时下标
  if (state) {
    useState(
      state,
      PlayerStateKeyEnum.PLAYLIST_INDEX,
      (index) => {
        if (typeof index !== 'number') return;
        activeIndex = index;
        renderEpisodes(currentList);
      },
      lifecycle,
    );
  }

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 鼠标进入选集按钮：延迟展开面板（面板显隐由本组件自己负责）
   */
  const handleMouseEnter = (): void => {
    cancelRaf(hideTimer!);
    hideTimer = null;
    if (showTimer !== null) return;
    showTimer = rafTimeout(() => {
      showTimer = null;
      setShown(true);
    }, 120);
  };

  /**
   * 鼠标离开选集按钮：延迟收起面板
   */
  const handleMouseLeave = (): void => {
    cancelRaf(showTimer!);
    showTimer = null;
    if (hideTimer !== null) return;
    hideTimer = rafTimeout(() => {
      hideTimer = null;
      setShown(false);
    }, 220);
  };

  /**
   * 键盘可达性：Enter / Space 展开面板
   * @param event - 键盘事件
   */
  const handleKeydown = (event: KeyboardEvent): void => {
    const key = event.key;
    if (key !== 'Enter' && key !== ' ') return;
    event.preventDefault();
    clearTimers();
    setShown(true);
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后：按 props 首渲染（运行时订阅后续变化自行重建），并同步一次当前集下标
   */
  lifecycle.onMounted = (): void => {
    const stateIndex = state?.get(PlayerStateKeyEnum.PLAYLIST_INDEX);
    if (typeof stateIndex === 'number') {
      activeIndex = stateIndex;
    } else if (typeof props.currentIndex === 'number') {
      activeIndex = props.currentIndex;
    }
    renderEpisodes(props.episodes ?? []);
  };

  useComponentUnmount(lifecycle, clearTimers);

  // ============================================
  // 主渲染函数
  // ============================================

  return h('div', {
    class: 'player-ctrl-btn player-ctrl-eplist',
    role: 'button',
    'aria-label': '选集',
    tabindex: '0',
    ref: 'eplistRootRef',
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onKeydown: handleKeydown,
  },
    // 按钮文案
    h('div', { class: 'player-ctrl-eplist-result' }, '选集'),
    // 选集面板
    h('div', { class: 'player-ctrl-eplist-menu-wrap', style: { minHeight: MENU_MIN_HEIGHT } },
      h('div', { class: 'player-ctrl-eplist-section' },
        h('div', {
          class: 'player-ctrl-eplist-section-bottom',
          style: {
            touchAction: 'pan-x',
            userSelect: 'none',
            webkitUserDrag: 'none',
            webkitTapHighlightColor: 'rgba(0, 0, 0, 0)',
          },
        },
          h('ul', { class: 'player-ctrl-eplist-section-content', ref: 'eplistListRef' })
        )
      )
    )
  );
});
