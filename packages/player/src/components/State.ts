/**
 * ============================================
 * 播放器状态组件
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';

/**
 * 状态组件 Props 接口
 */
export interface StateProps {
  /** 缓冲速度（字节/秒） */
  bufferSpeed?: number;
  /** 是否显示缓冲状态 */
  buffering?: boolean;
}

/**
 * 播放器状态组件
 */
export const State = defineComponent<StateProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 播放图标元素引用 */
  const playIconRef = ref<HTMLDivElement>();

  /** 缓冲图标元素引用 */
  const bufferIconRef = ref<HTMLDivElement>();

  /** 缓冲速度文本元素引用 */
  const bufferSpeedRef = ref<HTMLSpanElement>();

  /** 缓冲文本容器元素引用 */
  const bufferTextRef = ref<HTMLDivElement>();

  // ============================================
  // DOM 更新函数
  // ============================================

  /**
   * 将缓冲速度格式化为可读的 MB/S 字符串
   * @param speed - 缓冲速度（字节/秒）
   * @returns 格式化后的速度字符串
   */
  const formatBufferSpeed = (speed: number): string => {
    return `${(speed / 1024).toFixed(1)}MB/S`;
  };

  /**
   * 更新缓冲速度显示文本
   * @param speed - 缓冲速度（字节/秒）
   */
  const updateBufferSpeed = (speed: number): void => {
    if (bufferSpeedRef.current) {
      bufferSpeedRef.current.innerHTML = formatBufferSpeed(speed);
    }
  };

  /**
   * 显示缓冲状态图标和文本
   */
  const showBuffering = (): void => {
    if (bufferIconRef.current) {
      bufferIconRef.current.style.display = '';
    }
    if (bufferTextRef.current) {
      bufferTextRef.current.style.display = '';
    }
  };

  /**
   * 隐藏缓冲状态图标和文本
   */
  const hideBuffering = (): void => {
    if (bufferIconRef.current) {
      bufferIconRef.current.style.display = 'none';
    }
    if (bufferTextRef.current) {
      bufferTextRef.current.style.display = 'none';
    }
  };

  /**
   * 显示播放图标
   */
  const showPlayIcon = (): void => {
    if (playIconRef.current) {
      playIconRef.current.style.display = '';
    }
  };

  /**
   * 隐藏播放图标
   */
  const hidePlayIcon = (): void => {
    if (playIconRef.current) {
      playIconRef.current.style.display = 'none';
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    // 初始状态：隐藏缓冲和播放图标
    hideBuffering();
    hidePlayIcon();

    lifecycle.emit?.('stateMounted', {
      updateBufferSpeed,
      showBuffering,
      hideBuffering,
      showPlayIcon,
      hidePlayIcon,
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
    { class: 'player-state-wrap' },
    h('div', { class: 'player-state-play', ref: playIconRef }),
    h('div', { class: 'player-state-buff-icon', ref: bufferIconRef }),
    h(
      'div',
      { class: 'player-state-buff-text', ref: bufferTextRef },
      h('span', { class: 'player-state-buff-title' }, '正在缓冲...'),
      h(
        'span',
        {
          class: 'player-state-buff-speed',
          ref: bufferSpeedRef,
        },
        formatBufferSpeed(props.bufferSpeed ?? 0)
      )
    )
  );
});
