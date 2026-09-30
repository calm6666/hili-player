/**
 * ============================================
 * 清晰度选择菜单组件 (QualityMenu)
 * ============================================
 * 清晰度选择下拉菜单，支持清晰度列表渲染、当前清晰度标识、
 * 菜单悬停动画回调
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { VNode } from '@/types';

/**
 * 清晰度选项接口
 */
export interface QualityItem {
  /** 清晰度显示标签 */
  label: string;
  /** 清晰度值 */
  value: string;
  /** 角标文本（如"大会员"） */
  badge?: string;
}

/**
 * QualityMenu 组件 Props 接口
 */
export interface QualityMenuProps {
  qualities?: QualityItem[];
  currentQuality?: string;
}

export type QualityMenuEvents = {
  qualityChange: string;
  menuAnimation: { type: 'quality'; action: 'show' | 'hide' };
  qualityMenuMounted: undefined;
};

/**
 * QualityMenu 组件 - 使用 defineComponent 创建独立组件
 * 渲染清晰度选择菜单，支持当前清晰度高亮和角标显示
 */
export const QualityMenu = defineComponent<QualityMenuProps, QualityMenuEvents>((props, lifecycle) => {
  /** 可用清晰度列表，默认为空数组 */
  const { qualities = [], currentQuality } = props;

  // ============================================
  // DOM 引用
  // ============================================

  /** 当前清晰度显示文本元素引用 */
  const qualityResultRef = useTemplateRef<HTMLDivElement>(lifecycle, 'qualityResultRef');

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 鼠标进入清晰度按钮时触发的回调
   */
  const handleMouseEnter = (): void => {
    lifecycle.emit?.('menuAnimation', { type: 'quality', action: 'show' });
  };

  /**
   * 鼠标离开清晰度按钮时触发的回调
   */
  const handleMouseLeave = (): void => {
    lifecycle.emit?.('menuAnimation', { type: 'quality', action: 'hide' });
  };

  // ============================================
  // 渲染辅助函数
  // ============================================

  /**
   * 渲染单个清晰度菜单项
   * @param item - 清晰度选项数据
   * @returns 菜单项 VNode
   */
  const renderQualityItem = (item: QualityItem): VNode => {
    /** 是否为当前选中的清晰度 */
    const isActive = item.value === currentQuality;
    return h('li', {
      class: ['player-ctrl-quality-menu-item', isActive ? 'active' : ''].filter(Boolean).join(' '),
      'data-value': item.value,
      onClick: () => {
        lifecycle.emit?.('qualityChange', item.value);
        // 更新当前清晰度显示
        if (qualityResultRef.value) {
          qualityResultRef.value.innerText = item.label;
        }
      },
    },
      h('span', { class: 'player-ctrl-quality-text' }, item.label),
      item.badge
        ? h('span', { class: 'player-ctrl-quality-badge player-ctrl-quality-badge-bigvip' }, item.badge)
        : null
    );
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，设置初始清晰度显示文本并通知外部组件已就绪
   */
  lifecycle.onMounted = (): void => {
    // 设置初始清晰度显示文本
    if (qualityResultRef.value && currentQuality) {
      const current = qualities.find((q) => q.value === currentQuality);
      if (current) {
        qualityResultRef.value.innerText = current.label;
      }
    }
    lifecycle.emit?.('qualityMenuMounted');
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', {
    class: 'player-ctrl-btn player-ctrl-quality',
    role: 'button',
    'aria-label': '清晰度',
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  },
    // 当前清晰度显示
    h('div', { class: 'player-ctrl-quality-result', ref: 'qualityResultRef' }, '自动'),
    // 清晰度下拉菜单
    h('div', { class: 'player-ctrl-quality-menu-wrap' },
      h('ul', { class: 'player-ctrl-quality-menu' },
        ...qualities.map((item) => renderQualityItem(item))
      )
    )
  );
});
