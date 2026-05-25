/**
 * ============================================
 * 迷你播放器组件
 * ============================================
 * 使用 h 函数实现的迷你播放器组件
 */

import { h, defineComponent } from '@/core';

/**
 * 迷你播放器组件 Props 接口
 */
export interface MiniProps {
  /** 视频总时长 */
  duration?: number;
  /** 当前缓冲时间 */
  buffer?: number;
  /** 当前播放时间 */
  currentTime?: number;
  /** 关闭回调 */
  onClose?: () => void;
  /** 播放状态切换回调 */
  onStateChange?: () => void;
}

/**
 * 迷你播放器组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Mini = defineComponent<MiniProps>((props) => {
  /**
   * 缓冲进度元素引用
   */
  const progressBufferRef: { current: HTMLDivElement | null } = { current: null };

  /**
   * 播放进度元素引用
   */
  const progressTempoRef: { current: HTMLDivElement | null } = { current: null };

  /**
   * 总时长
   */
  const duration = props.duration ?? 0;

  /**
   * 处理关闭
   */
  const handleClose = (): void => {
    props.onClose?.();
  };

  /**
   * 处理状态切换
   */
  const handleStateChange = (): void => {
    props.onStateChange?.();
  };

  return h(
    'div',
    { class: 'player-mini-warp' },
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
        ref: progressBufferRef,
      }),
      h('div', {
        class: 'player-mini-progress-tempo',
        ref: progressTempoRef,
      })
    )
  );
});
