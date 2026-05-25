/**
 * ============================================
 * 工具提示组件
 * ============================================
 * 使用 h 函数实现的工具提示组件
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * 提示项接口
 */
export interface TooltipItem {
  /** 名称标识 */
  name: string;
  /** 提示标题 */
  title: string;
}

/**
 * 工具提示组件 Props 接口
 */
export interface TooltipsProps {
  /** 屏幕模式 */
  screen?: 'normal' | 'full' | 'web';
  /** 提示项数组 */
  items?: TooltipItem[];
  /** 当前显示的提示名称 */
  activeName?: string | null;
  /** 提示项位置信息 */
  positions?: Record<string, { left: number; top: number }>;
}

/**
 * 默认提示项
 */
const DEFAULT_TOOLTIP_ITEMS: TooltipItem[] = [
  { name: 'ctrl:codec:0', title: '优先使用播放器内置策略播放' },
  { name: 'ctrl:codec:1', title: '优先使用 AV1 编码视频播放' },
  { name: 'ctrl:codec:2', title: '优先使用 HEVC/H.265 编码视频播放' },
  { name: 'ctrl:codec:3', title: '优先使用 AVC/H.264 编码视频播放' },
  { name: 'danmaku_switch', title: '关闭弹幕 (d)' },
  { name: 'preventshade', title: '视频底部 15% 部分为空白保留区' },
  { name: 'special-more', title: '特殊颜色、运动形式的弹幕' },
  { name: 'feedback-btn', title: '反馈' },
  { name: 'ctrl:widescreen', title: '宽屏模式' },
  { name: 'ctrl:webscreen', title: '网页全屏' },
  { name: 'ctrl:pip', title: '开启画中画' },
  { name: 'ctrl:fullscreen', title: '进入全屏 (f)' },
  { name: 'ctrl:prev', title: '上一个 ([)' },
  { name: 'ctrl:next', title: '下一个 (])' },
];

/**
 * 工具提示组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Tooltips = defineComponent<TooltipsProps>((props) => {
  /**
   * 提示项数组
   */
  const items = props.items ?? DEFAULT_TOOLTIP_ITEMS;

  /**
   * 获取提示项样式
   */
  const getItemStyle = (name: string): Record<string, string> => {
    const position = props.positions?.[name];
    const isActive = props.activeName === name;

    if (isActive && position) {
      return {
        transform: 'translate(0px, 0px)',
        visibility: 'visible',
        opacity: '1',
        left: `${position.left}px`,
        top: `${position.top}px`,
      };
    }

    const defaultTransform = name === 'feedback-btn' ? 'translate(0px, -5px)' : 'translate(0px, 5px)';

    return {
      transform: defaultTransform,
      visibility: 'hidden',
      opacity: '0',
    };
  };

  /**
   * 渲染提示项
   */
  const renderTooltipItems = (): VNode[] => {
    return items.map((item: TooltipItem) =>
      h(
        'div',
        {
          class: 'player-tooltip-item',
          'data-name': item.name,
          style: getItemStyle(item.name),
        },
        h('div', { class: 'player-tooltip-title' }, item.title)
      )
    );
  };

  return h(
    'div',
    { class: 'player-tooltip-area' },
    ...renderTooltipItems()
  );
});
