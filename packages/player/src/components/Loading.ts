/**
 * ============================================
 * 加载组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';

/**
 * 加载组件 Props 接口
 */
export interface LoadingProps {
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 加载提示文本 */
  text?: string;
}

/**
 * 加载组件
 */
export const Loading = defineComponent<LoadingProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 加载面板容器元素引用 */
  const loadingPanelRef = useTemplateRef<HTMLDivElement>(lifecycle, 'loadingPanelRef');

  /** 加载文本元素引用 */
  const loadingTextRef = useTemplateRef<HTMLDivElement>(lifecycle, 'loadingTextRef');

  // ============================================
  // DOM 更新函数
  // ============================================

  /**
   * 显示加载面板
   *
   * 面板在 scss 中默认 `display: none`，可见性由既有类名 `state-loading` 驱动
   * （见 styles/loading.scss `.player-loading-panel.state-loading { display: block }`），
   * 因此此处必须补上该类，否则仅清空内联 display 无法真正显示。
   */
  const show = (): void => {
    if (loadingPanelRef.value) {
      loadingPanelRef.value.classList.add('state-loading');
      loadingPanelRef.value.style.display = '';
    }
  };

  /**
   * 隐藏加载面板，移除加载状态样式
   */
  const hide = (): void => {
    if (loadingPanelRef.value) {
      loadingPanelRef.value.classList.remove('state-loading');
    }
  };

  /**
   * 设置加载提示文本
   * @param text - 提示文本内容
   */
  const setText = (text: string): void => {
    if (loadingTextRef.value) {
      loadingTextRef.value.textContent = text;
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    // 初始状态：根据 props 设置显示/隐藏
    if (props.loading === false) {
      hide();
    }
    if (props.text && loadingTextRef.value) {
      loadingTextRef.value.textContent = props.text;
    }

    lifecycle.emit?.('loadingMounted', {
      show,
      hide,
      setText,
    });
  };

  lifecycle.onBeforeDestroy = (): void => {
    // 组件销毁时引用自动释放
  };

  // ============================================
  // 主渲染函数
  // ============================================

  return h(
    'div',
    {
      class: 'player-loading-panel',
      ref: 'loadingPanelRef',
    },
    h('div', {
      class: 'player-loading-panel-text',
      ref: 'loadingTextRef',
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
