/**
 * ============================================
 * 章节/视点选择菜单组件 (ViewpointMenu)
 * ============================================
 * 用于 LeftControls 的章节/视点选择菜单
 * 支持章节列表渲染、章节点击跳转、菜单悬停动画回调
 */

import { h, defineComponent, ref } from '@/core';
import type { VNode } from '@/types';
import type { ComponentLifecycle } from '@/types';

/**
 * 章节/视点数据接口
 */
export interface ViewpointItem {
  /** 章节标题 */
  title: string;
  /** 章节起始时间（秒） */
  time: number;
}

/**
 * ViewpointMenu 组件 Props 接口
 */
export interface ViewpointMenuProps {
  /** 章节/视点列表 */
  points?: ViewpointItem[];
  /** 当前播放时间（秒） */
  currentTime?: number;
  /** 跳转到指定时间的回调函数 */
  onSeek?: (time: number) => void;
  /** 菜单动画触发时的回调函数 */
  onMenuAnimation?: (type: string, action: 'show' | 'hide') => void;
}

/**
 * ViewpointMenu 组件 - 使用 defineComponent 创建独立组件
 * 渲染章节/视点选择菜单，支持当前章节高亮
 */
export const ViewpointMenu = defineComponent<ViewpointMenuProps>((props, lifecycle: ComponentLifecycle) => {
  /** 章节列表，默认为空数组 */
  const { points = [], currentTime = 0 } = props;

  // ============================================
  // DOM 引用
  // ============================================

  /** 章节按钮根元素引用 */
  const viewpointBtnRef = ref<HTMLDivElement>();

  /** 章节显示文本元素引用 */
  const viewpointTextRef = ref<HTMLDivElement>();

  /** 章节下拉菜单列表元素引用 */
  const viewpointMenuRef = ref<HTMLUListElement>();

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 鼠标进入章节按钮时触发的回调
   */
  const handleMouseEnter = (): void => {
    lifecycle.emit?.('menuAnimation', 'viewpoint', 'show');
  };

  /**
   * 鼠标离开章节按钮时触发的回调
   */
  const handleMouseLeave = (): void => {
    lifecycle.emit?.('menuAnimation', 'viewpoint', 'hide');
  };

  // ============================================
  // 渲染辅助函数
  // ============================================

  /**
   * 判断指定时间是否属于当前章节
   * @param time - 章节起始时间
   * @param index - 章节在列表中的索引
   * @returns 是否为当前正在播放的章节
   */
  const isCurrentPoint = (time: number, index: number): boolean => {
    // 当前时间 >= 该章节时间，且 < 下一章节时间
    if (currentTime < time) return false;
    /** 下一个章节的数据 */
    const nextPoint = points[index + 1];
    if (!nextPoint) return true;
    return currentTime < nextPoint.time;
  };

  /**
   * 渲染单个章节菜单项
   * @param point - 章节数据
   * @param index - 章节在列表中的索引
   * @returns 菜单项 VNode
   */
  const renderViewpointItem = (point: ViewpointItem, index: number): VNode => {
    /** 是否为当前正在播放的章节 */
    const isActive = isCurrentPoint(point.time, index);
    return h('li', {
      class: ['player-ctrl-viewpoint-menu-item', isActive ? 'active' : ''].filter(Boolean).join(' '),
      'data-time': point.time,
      onClick: () => {
        lifecycle.emit?.('seek', point.time);
        // 更新章节文本显示
        if (viewpointTextRef.current) {
          viewpointTextRef.current.innerText = '章节 · ' + point.title;
        }
      },
    },
      h('span', {
        class: 'player-ctrl-viewpoint-menu-item-team team-blue',
        style: { opacity: '0', display: 'none' },
        'data-time': point.time,
      }),
      h('span', {
        class: 'player-ctrl-viewpoint-menu-item-content',
        'data-time': point.time,
      }, point.title)
    );
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，设置初始章节文本并通知外部组件已就绪
   */
  lifecycle.onMounted = (): void => {
    // 设置初始章节文本
    if (viewpointTextRef.current && points.length > 0) {
      // 找到当前章节
      const currentPoint = points.find((p, i) => isCurrentPoint(p.time, i));
      viewpointTextRef.current.innerText = '章节 · ' + (currentPoint?.title ?? points[0].title);
    }
    lifecycle.emit?.('viewpointMenuMounted');
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', {
    class: 'player-ctrl-btn player-ctrl-viewpoint',
    ref: viewpointBtnRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  },
    h('div', { class: 'player-ctrl-viewpoint-inner' },
      h('div', { class: 'player-ctrl-viewpoint-content' },
        // 章节文本
        h('span', { class: 'player-ctrl-viewpoint-text', ref: viewpointTextRef },
          points.length > 0 ? '章节 · ' + points[0].title : '章节'
        ),
        // 章节图标
        h('span', { class: 'player-ctrl-viewpoint-icon' },
          h('span', { class: 'common-svg-icon' })
        ),
        // 章节下拉菜单
        h('div', { class: 'player-ctrl-viewpoint-menu-wrap' },
          h('ul', { class: 'player-ctrl-viewpoint-menu', ref: viewpointMenuRef },
            ...points.map((point, index) => renderViewpointItem(point, index))
          )
        )
      )
    )
  );
});
