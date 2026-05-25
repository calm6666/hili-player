/**
 * ============================================
 * 加载组件
 * ============================================
 * 使用 h 函数实现的加载组件
 */

import { h, defineComponent } from '@/core';

/**
 * 加载组件 Props 接口
 */
export interface LoadingProps {
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 加载文本 */
  text?: string;
}

/**
 * 加载组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Loading = defineComponent<LoadingProps>((props) => {
  /**
   * 加载面板元素引用
   */
  const loadingPanelRef: { current: HTMLDivElement | null } = { current: null };

  return h(
    'div',
    {
      class: 'player-loading-panel',
      ref: loadingPanelRef,
    },
    h('div', {
      class: 'player-loading-panel-text',
    }),
    h(
      'div',
      {
        class: 'player-loading-panel-blur',
      },
      h('div', {
        class: 'player-loading-panel-blur-detail',
      })
    )
  );
});
