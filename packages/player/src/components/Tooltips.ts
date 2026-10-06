/**
 * ============================================
 * 工具提示组件
 * ============================================
 */

import { h, defineComponent, signal } from '@/core';
import type { Signal } from '@/core';
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

  /**
   * 提示项元素引用映射表
   * 通过 name 索引每个提示项的 DOM 元素引用
   */
  const itemRefMap: Record<string, Signal<HTMLDivElement | null>> = {};

  /** 提示项数组，未传入时使用默认提示项 */
  const items = props.items ?? DEFAULT_TOOLTIP_ITEMS;

  /**
   * 当前屏幕模式（对应既有实现 Tooltips.screen 字段）：
   * 全屏 / 网页全屏下提示框显示在按钮上方更远处（32px vs 23px），
   * 由 PlayerDocker 在显示模式 / 全屏状态变化时通过 setScreen 同步
   */
  let screen: 'normal' | 'full' | 'web' = props.screen ?? 'normal';

  /**
   * 更新屏幕模式（对应既有实现的 tooltips.screen 赋值）
   */
  const setScreen = (next: 'normal' | 'full' | 'web'): void => {
    screen = next;
  };

  /**
   * 按 name 获取提示项 DOM 元素
   */
  const getTipElement = (name: string): HTMLDivElement | null => {
    return itemRefMap[name]?.value ?? null;
  };

  /**
   * 计算提示框显示位置（与既有实现的
   * calculateTipPosition 一致，坐标系为视口坐标，样式为 position: fixed）
   * @param btnElement - 触发提示的按钮元素
   * @param tipElement - 提示项元素
   * @param name - 提示项名称（决定上下偏移规则）
   */
  const calculateTipPosition = (
    btnElement: HTMLElement,
    tipElement: HTMLElement,
    name: string,
  ): { left: number; top: number } => {
    const tipClient = tipElement.getBoundingClientRect();
    const btnClient = btnElement.getBoundingClientRect();
    /** 水平方向：提示框中心对齐按钮中心 */
    let left = btnClient.left - (tipClient.width / 2 - btnClient.width / 2);
    let top = 0;

    if (name === 'feedback-btn') {
      // 反馈按钮在顶栏，提示显示在按钮下方
      top = btnClient.top + btnClient.height + 10;
    } else if (name === 'danmaku_switch') {
      // 弹幕开关提示显示在按钮上方 8px
      top = btnClient.top - 8 - tipClient.height;
    } else {
      // 其余按钮：全屏 / 网页全屏下偏移更大
      top =
        screen === 'full' || screen === 'web'
          ? btnClient.top - 32 - tipClient.height
          : btnClient.top - 23 - tipClient.height;
    }

    // 水平方向夹紧到播放器容器内（左右各留 12px）
    const container = tipElement.closest<HTMLElement>('.player-container');
    if (container) {
      const containerLeft = container.getBoundingClientRect().left;
      const containerWidth = container.getBoundingClientRect().width;
      if (containerLeft >= left || left <= 12) {
        left = containerLeft + 12;
      } else if (containerLeft + containerWidth <= left + tipClient.width) {
        left = containerLeft + containerWidth - 12 - tipClient.width;
      }
    }

    return { left, top };
  };

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
      /** 当前提示项的 DOM 元素引用（每个 item 独立 Signal，不能用 useTemplateRef 去重 key） */
      const refObj = signal<HTMLDivElement | null>(null);
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
    if (refObj?.value) {
      refObj.value.style.transform = 'translate(0px, 0px)';
      refObj.value.style.visibility = 'visible';
      refObj.value.style.opacity = '1';
      refObj.value.style.left = `${position.left}px`;
      refObj.value.style.top = `${position.top}px`;
    }
  };

  /**
   * 隐藏指定名称的提示项，恢复默认偏移和不可见状态
   */
  const hideTooltip = (name: string): void => {
    /** 指定名称对应的 DOM 元素引用对象 */
    const refObj = itemRefMap[name];
    if (refObj?.value) {
      /** 未激活时的默认偏移 */
      const defaultTransform = name === 'feedback-btn' ? 'translate(0px, -5px)' : 'translate(0px, 5px)';
      refObj.value.style.transform = defaultTransform;
      refObj.value.style.visibility = 'hidden';
      refObj.value.style.opacity = '0';
    }
  };

  /**
   * 打开指定名称的提示项（与既有实现的 openTip 一致）：
   * 依据按钮元素实时计算位置后显示
   * @param btnElement - 触发提示的按钮元素
   * @param name - 提示项名称（Tooltip.dataName）
   */
  const openTip = (btnElement: HTMLElement | null, name: string): void => {
    const tipElement = getTipElement(name);
    if (tipElement && btnElement) {
      const { left, top } = calculateTipPosition(btnElement, tipElement, name);
      showTooltip(name, { left: Math.floor(left), top: Math.floor(top) });
    }
  };

  /**
   * 关闭指定名称的提示项（与既有实现的 closeTip 一致）
   */
  const closeTip = (name: string): void => {
    hideTooltip(name);
  };

  /**
   * 更新提示项文本内容（与既有实现的 updateTip 一致）
   * 优先更新 .player-tooltip-title 子元素的文本，保持内部结构不变
   * @param name - 提示项名称
   * @param text - 新的提示文本
   */
  const updateTip = (name: string, text: string): void => {
    const tipElement = getTipElement(name);
    if (!tipElement) return;
    const titleElement = tipElement.querySelector<HTMLDivElement>(
      '.player-tooltip-title',
    );
    if (titleElement) {
      titleElement.textContent = text;
    } else {
      tipElement.textContent = text;
    }
  };

  /**
   * 隐藏所有提示项
   */
  const hideAll = (): void => {
    items.forEach((item) => {
      /** 当前提示项的 DOM 元素引用对象 */
      const refObj = itemRefMap[item.name];
      if (refObj?.value) {
        /** 未激活时的默认偏移 */
        const defaultTransform = item.name === 'feedback-btn' ? 'translate(0px, -5px)' : 'translate(0px, 5px)';
        refObj.value.style.transform = defaultTransform;
        refObj.value.style.visibility = 'hidden';
        refObj.value.style.opacity = '0';
      }
    });
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，向上层暴露打开、关闭、更新提示与同步屏幕模式的方法
   * （对应既有实现的 showTooltip / hideTooltip 及
   * handleFullscreenChange / toggleWebFullscreen 中的 screen 与 updateTip 调用）
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('tooltipsMounted', {
      openTip,
      closeTip,
      updateTip,
      setScreen,
      hideAll,
    });
  };

  /**
   * 组件销毁前，清空所有 DOM 引用
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  return h(
    'div',
    { class: 'player-tooltip-area' },
    ...renderTooltipItems()
  );
});
