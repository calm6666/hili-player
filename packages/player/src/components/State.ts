/**
 * ============================================
 * 播放器状态组件
 * ============================================
 * 使用 h 函数实现的状态显示组件
 */

import { h, defineComponent } from '@/core';

/**
 * 状态组件 Props 接口
 */
export interface StateProps {
  /** 缓冲速度 (bytes/s) */
  bufferSpeed?: number;
  /** 是否显示缓冲状态 */
  buffering?: boolean;
}

/**
 * 播放器状态组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const State = defineComponent<StateProps>((props) => {
  /**
   * 格式化缓冲速度
   */
  const formatBufferSpeed = (speed?: number): string => {
    if (!speed) {
      return '';
    }
    return `${(speed / 1024).toFixed(1)}MB/S`;
  };

  return h(
    'div',
    { class: 'player-state-wrap' },
    h('div', { class: 'player-state-play' }),
    h('div', { class: 'player-state-buff-icon' }),
    h(
      'div',
      { class: 'player-state-buff-text' },
      h('span', { class: 'player-state-buff-title' }, '正在缓冲...'),
      h(
        'span',
        {
          class: 'player-state-buff-speed',
        },
        formatBufferSpeed(props.bufferSpeed)
      )
    )
  );
});
