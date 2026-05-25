/**
 * ============================================
 * 顶部进度条组件 (TopControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * TopControls 组件 Props 接口
 */
export interface TopControlsProps {
  // 可以添加配置属性，如是否显示预览图等
}

/**
 * TopControls 组件 - 使用 defineComponent 创建独立组件
 */
export const TopControls = defineComponent<TopControlsProps>((props, lifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================
  const playerProgressAreaRef: { current: HTMLDivElement | null } = { current: null };
  const playerProgressWrapRef: { current: HTMLDivElement | null } = { current: null };
  const playerProgressScheduleWrapRef: { current: HTMLDivElement | null } = { current: null };
  const progressThumbRef: { current: HTMLDivElement | null } = { current: null };
  const moveIndicatorRef: { current: HTMLDivElement | null } = { current: null };
  const progressPopupRef: { current: HTMLDivElement | null } = { current: null };
  const previewImageRef: { current: HTMLImageElement | null } = { current: null };
  const previewTimeRef: { current: HTMLDivElement | null } = { current: null };
  const progressPullIndicatorRef: { current: HTMLDivElement | null } = { current: null };
  const progressCursorRef: { current: HTMLDivElement | null } = { current: null };

  // ============================================
  // 事件处理函数
  // ============================================
  const mouseMove = (event: MouseEvent): void => {
    lifecycle.emit?.('progressMouseMove', event);
  };

  const handleMouseDown = (event: MouseEvent): void => {
    lifecycle.emit?.('progressMouseDown', event);
  };

  // ============================================
  // 生命周期钩子
  // ============================================
  lifecycle.onMounted = (): void => {
    // 组件挂载后的初始化逻辑
    lifecycle.emit?.('topControlsMounted');
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', { class: 'player-control-top' },
    h('div', {
      class: 'player-progress-area',
      ref: playerProgressAreaRef,
      onMouseMove: mouseMove,
      onMouseDown: handleMouseDown
    },
      h('div', { class: 'player-progress-wrap', ref: playerProgressWrapRef },
        h('div', { class: 'player-progress', style: { height: '4px' } },
          h('div', { class: 'player-progress-schedule-wrap', ref: playerProgressScheduleWrapRef }),
          h('div', { class: 'player-progress-point-wrap' }),
          h('div', { class: 'player-progress-thumb', ref: progressThumbRef },
            h('div', { class: 'player-progress-thumb-icon player-progress-thumb-icon-dynamic player-progress-thumb-active' },
              h('span', { class: 'common-svg-icon' })
            )
          ),
          h('div', { class: 'player-progress-move-indicator', ref: moveIndicatorRef },
            h('div', { class: 'player-progress-move-indicator-down' }),
            h('div', { class: 'player-progress-move-indicator-up' })
          ),
          h('div', { class: 'player-progress-popup', ref: progressPopupRef },
            h('div', { class: 'player-progress-preview' },
              h('img', { class: 'player-progress-preview-image', ref: previewImageRef }),
              h('div', { class: 'player-progress-preview-time', ref: previewTimeRef })
            ),
            h('div', { class: 'player-progress-hotspot' })
          ),
          h('div', {
            class: 'player-progress-pull-indicator',
            style: { transform: 'translateX(0px)' },
            ref: progressPullIndicatorRef
          },
            h('span', { class: 'common-svg-icon' })
          ),
          h('div', { class: 'player-progress-cursor', ref: progressCursorRef })
        )
      )
    )
  );
});
