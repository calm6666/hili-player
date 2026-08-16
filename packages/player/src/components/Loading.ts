/**
 * ============================================
 * 加载组件
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
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
  const loadingPanelRef = ref<HTMLDivElement>();

  /** 加载文本元素引用 */
  const loadingTextRef = ref<HTMLDivElement>();

  // ============================================
  // DOM 更新函数
  // ============================================

  /**
   * 显示加载面板
   */
  const show = (): void => {
    if (loadingPanelRef.current) {
      loadingPanelRef.current.style.display = '';
    }
  };

  /**
   * 隐藏加载面板，移除加载状态样式
   */
  const hide = (): void => {
    if (loadingPanelRef.current) {
      loadingPanelRef.current.classList.remove('state-loading');
    }
  };

  /**
   * 设置加载提示文本
   * @param text - 提示文本内容
   */
  const setText = (text: string): void => {
    if (loadingTextRef.current) {
      loadingTextRef.current.textContent = text;
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
    if (props.text && loadingTextRef.current) {
      loadingTextRef.current.innerHTML = props.text;
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
      ref: loadingPanelRef,
    },
    h('div', {
      class: 'player-loading-panel-text',
      ref: loadingTextRef,
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
