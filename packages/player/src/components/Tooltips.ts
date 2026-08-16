/**
 * ============================================
 * 工具提示组件
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';

/**
 * 提示项接口
 */
export interface TooltipItem {
  /** 名称标识，用于匹配和索引提示项 */
  name: string;
  /** 提示标题，显示在工具提示中的文本 */
  title: string;
}

/**
 * 工具提示组件 Props 接口
 */
export interface TooltipsProps {
  /** 屏幕模式：普通、全屏、网页全屏 */
  screen?: 'normal' | 'full' | 'web';
  /** 提示项数组，定义所有可显示的工具提示 */
  items?: TooltipItem[];
  /** 当前显示的提示名称，为 null 时表示没有激活的提示 */
  activeName?: string | null;
  /** 提示项位置信息映射表，键为提示名称，值为坐标 */
  positions?: Record<string, { left: number; top: number }>;
}

/**
 * 默认提示项列表，包含播放器各按钮的默认提示文本
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
 */
export const Tooltips = defineComponent<TooltipsProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 工具提示区域容器元素引用 */
  const tooltipAreaRef = ref<HTMLDivElement>();

  /**
   * 提示项元素引用映射表
   * 通过 name 索引每个提示项的 DOM 元素引用
   */
  const itemRefMap: Record<string, { current: HTMLDivElement | null }> = {};

  /** 提示项数组，未传入时使用默认提示项 */
  const items = props.items ?? DEFAULT_TOOLTIP_ITEMS;

  /**
   * 获取指定提示项的样式
   * 激活时显示在指定位置，未激活时隐藏
   */
  const getItemStyle = (name: string): Record<string, string> => {
    /** 提示项的目标位置 */
    const position = props.positions?.[name];
    /** 是否为当前激活的提示项 */
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

    /** 未激活时的默认偏移，反馈按钮向上偏移，其余向下偏移 */
    const defaultTransform = name === 'feedback-btn' ? 'translate(0px, -5px)' : 'translate(0px, 5px)';

    return {
      transform: defaultTransform,
      visibility: 'hidden',
      opacity: '0',
    };
  };

  /**
   * 渲染所有提示项
   */
  const renderTooltipItems = (): VNode[] => {
    return items.map((item: TooltipItem) => {
      /** 当前提示项的 DOM 元素引用对象 */
      const refObj = ref<HTMLDivElement>();
      itemRefMap[item.name] = refObj;

      return h(
        'div',
        {
          class: 'player-tooltip-item',
          'data-name': item.name,
          style: getItemStyle(item.name),
          ref: refObj,
        },
        h('div', { class: 'player-tooltip-title' }, item.title)
      );
    });
  };

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 显示指定名称的提示项，设置其位置和可见性
   */
  const showTooltip = (name: string, position: { left: number; top: number }): void => {
    /** 指定名称对应的 DOM 元素引用对象 */
    const refObj = itemRefMap[name];
    if (refObj?.current) {
      refObj.current.style.transform = 'translate(0px, 0px)';
      refObj.current.style.visibility = 'visible';
      refObj.current.style.opacity = '1';
      refObj.current.style.left = `${position.left}px`;
      refObj.current.style.top = `${position.top}px`;
    }
  };

  /**
   * 隐藏指定名称的提示项，恢复默认偏移和不可见状态
   */
  const hideTooltip = (name: string): void => {
    /** 指定名称对应的 DOM 元素引用对象 */
    const refObj = itemRefMap[name];
    if (refObj?.current) {
      /** 未激活时的默认偏移 */
      const defaultTransform = name === 'feedback-btn' ? 'translate(0px, -5px)' : 'translate(0px, 5px)';
      refObj.current.style.transform = defaultTransform;
      refObj.current.style.visibility = 'hidden';
      refObj.current.style.opacity = '0';
    }
  };

  /**
   * 隐藏所有提示项
   */
  const hideAll = (): void => {
    items.forEach((item) => {
      /** 当前提示项的 DOM 元素引用对象 */
      const refObj = itemRefMap[item.name];
      if (refObj?.current) {
        /** 未激活时的默认偏移 */
        const defaultTransform = item.name === 'feedback-btn' ? 'translate(0px, -5px)' : 'translate(0px, 5px)';
        refObj.current.style.transform = defaultTransform;
        refObj.current.style.visibility = 'hidden';
        refObj.current.style.opacity = '0';
      }
    });
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，向上层暴露显示、隐藏和全部隐藏方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('tooltipsMounted', { showTooltip, hideTooltip, hideAll });
  };

  /**
   * 组件销毁前，清空所有 DOM 引用
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  return h(
    'div',
    { class: 'player-tooltip-area', ref: tooltipAreaRef },
    ...renderTooltipItems()
  );
});
