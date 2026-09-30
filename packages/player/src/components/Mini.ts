/**
 * ============================================
 * 迷你播放器组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';

/**
 * 迷你播放器组件 Props 接口
 */
export interface MiniProps {
  /** 视频总时长（秒） */
  duration?: number;
  /** 当前缓冲进度时间（秒） */
  buffer?: number;
  /** 当前播放时间（秒） */
  currentTime?: number;
  /** 关闭迷你播放器回调 */
  onClose?: () => void;
  /** 播放/暂停状态切换回调 */
  onStateChange?: () => void;
}

/**
 * 迷你播放器组件
 */
export const Mini = defineComponent<MiniProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 缓冲进度条元素引用 */
  const progressBufferRef = useTemplateRef<HTMLDivElement>(lifecycle, 'progressBufferRef');

  /** 播放进度条元素引用 */
  const progressTempoRef = useTemplateRef<HTMLDivElement>(lifecycle, 'progressTempoRef');

  /** 根容器元素引用 */
  const miniWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'miniWrapRef');

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 处理关闭按钮点击
   */
  const handleClose = (): void => {
    props.onClose?.();
  };

  /**
   * 处理播放/暂停状态切换点击
   */
  const handleStateChange = (): void => {
    props.onStateChange?.();
  };

  // ============================================
  // DOM 更新函数
  // ============================================

  /**
   * 更新缓冲进度条的显示比例
   * @param buffer - 缓冲进度时间（秒）
   */
  const updateBuffer = (buffer: number): void => {
    if (progressBufferRef.value && props.duration) {
      const scale = buffer / props.duration;
      progressBufferRef.value.style.transform = `scaleX(${scale})`;
    }
  };

  /**
   * 更新当前播放进度条的显示比例
   * @param current - 当前播放时间（秒）
   */
  const updateCurrent = (current: number): void => {
    if (progressTempoRef.value && props.duration) {
      const scale = current / props.duration;
      progressTempoRef.value.style.transform = `scaleX(${scale})`;
    }
  };

  /**
   * 显示迷你播放器
   */
  const show = (): void => {
    if (miniWrapRef.value) {
      miniWrapRef.value.style.display = '';
    }
  };

  /**
   * 隐藏迷你播放器
   */
  const hide = (): void => {
    if (miniWrapRef.value) {
      miniWrapRef.value.style.display = 'none';
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    // 初始化进度条
    if (props.buffer !== undefined) {
      updateBuffer(props.buffer);
    }
    if (props.currentTime !== undefined) {
      updateCurrent(props.currentTime);
    }

    lifecycle.emit?.('miniMounted', {
      updateBuffer,
      updateCurrent,
      show,
      hide,
    });
  };

  lifecycle.onBeforeDestroy = (): void => {
  };

  // ============================================
  // 主渲染函数
  // ============================================

  return h(
    'div',
    { class: 'player-mini-warp', ref: 'miniWrapRef' },
    h(
      'div',
      { class: 'player-mini-close', onClick: handleClose },
      '×'
    ),
    h(
      'div',
      { class: 'player-mini-state', onClick: handleStateChange },
      h('div', { class: 'player-mini-state-play' }),
      h('div', { class: 'player-mini-state-pause' })
    ),
    h(
      'div',
      { class: 'player-mini-progress' },
      h('div', {
        class: 'player-mini-progress-buffer',
        ref: 'progressBufferRef',
      }),
      h('div', {
        class: 'player-mini-progress-tempo',
        ref: 'progressTempoRef',
      })
    )
  );
});
