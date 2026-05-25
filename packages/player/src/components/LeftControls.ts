/**
 * ============================================
 * 左侧控制按钮组件 (LeftControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';
import type { ControlConfig, ProgressViewPoint } from '@/hili-player/types';
import { formatTime } from '@/utils/formatTime';

/**
 * LeftControls 组件 Props 接口
 */
export interface LeftControlsProps {
  config: ControlConfig;
  duration: number;
}

/**
 * LeftControls 组件 - 使用 defineComponent 创建独立组件
 */
export const LeftControls = defineComponent<LeftControlsProps>((props, lifecycle) => {
  const { config, duration } = props;

  // ============================================
  // DOM 引用
  // ============================================
  const prevBtnRef: { current: HTMLDivElement | null } = { current: null };
  const playBtnRef: { current: HTMLDivElement | null } = { current: null };
  const nextBtnRef: { current: HTMLDivElement | null } = { current: null };
  const playerCtrlTimeCurrentRef: { current: HTMLDivElement | null } = { current: null };
  const playerCtrlTimeDurationRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlViewpointBtnRef: { current: HTMLDivElement | null } = { current: null };
  const viewpointTextRef: { current: HTMLDivElement | null } = { current: null };
  const viewpointMenuRef: { current: HTMLUListElement | null } = { current: null };

  // ============================================
  // 事件处理函数
  // ============================================
  const handlePrev = (): void => { lifecycle.emit?.('prev'); };
  const handleNext = (): void => { lifecycle.emit?.('next'); };
  const togglePlayPause = (): void => { lifecycle.emit?.('playPause'); };

  // ============================================
  // 渲染辅助函数
  // ============================================
  const renderViewpointItem = (viewpoint: ProgressViewPoint): VNode => {
    return h('li', {
      class: 'player-ctrl-viewpoint-menu-item',
      'data-time': viewpoint.startTime,
      onClick: () => {
        lifecycle.emit?.('seek', viewpoint.startTime);
        if (viewpointTextRef.current) {
          viewpointTextRef.current.innerText = '章节 · ' + viewpoint.pointText;
        }
      },
    },
      h('span', {
        class: 'player-ctrl-viewpoint-menu-item-team team-blue',
        style: { opacity: '0', display: 'none' },
        'data-time': viewpoint.startTime
      }),
      h('span', { class: 'player-ctrl-viewpoint-menu-item-content', 'data-time': '124' },
        viewpoint.pointText
      )
    );
  };

  // ============================================
  // 底部左侧按钮渲染器映射表
  // ============================================
  const bottomLeftRenderers: Record<string, () => VNode | null> = {
    prev: () => h('div', {
      role: 'button',
      'aria-label': '上一个',
      class: 'player-ctrl-btn player-ctrl-prev',
      ref: prevBtnRef,
      onClick: handlePrev
    },
      h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' }))
    ),
    play: () => h('div', {
      role: 'button',
      'aria-label': '播放/暂停',
      class: 'player-ctrl-btn player-ctrl-play',
      ref: playBtnRef,
      onClick: togglePlayPause
    },
      h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' })),
      h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' }))
    ),
    next: () => h('div', {
      role: 'button',
      'aria-label': '下一个',
      class: 'player-ctrl-btn player-ctrl-next',
      ref: nextBtnRef,
      onClick: handleNext
    },
      h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' }))
    ),
    time: () => h('div', { class: 'player-ctrl-btn player-ctrl-time' },
      h('div', { class: 'player-ctrl-time-label' },
        h('span', { class: 'player-ctrl-time-current', ref: playerCtrlTimeCurrentRef }),
        h('span', { class: 'player-ctrl-time-divide' }, '/'),
        h('span', { class: 'player-ctrl-time-duration', ref: playerCtrlTimeDurationRef })
      )
    ),
    viewpoint: () => {
      if (!config.viewpoint || !config.progressViewPoints || config.progressViewPoints.length <= 1) {
        return null;
      }
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-viewpoint',
        ref: ctrlViewpointBtnRef,
        onMouseEnter: () => lifecycle.emit?.('menuAnimation', 'viewpoint', 'show'),
        onMouseLeave: () => lifecycle.emit?.('menuAnimation', 'viewpoint', 'hide')
      },
        h('div', { class: 'player-ctrl-viewpoint-inner' },
          h('div', { class: 'player-ctrl-viewpoint-content' },
            h('span', { class: 'player-ctrl-viewpoint-text', ref: viewpointTextRef },
              '章节 · ' + config.progressViewPoints[0].pointText
            ),
            h('span', { class: 'player-ctrl-viewpoint-icon' },
              h('span', { class: 'common-svg-icon' })
            ),
            h('div', { class: 'player-ctrl-viewpoint-menu-wrap' },
              h('ul', { class: 'player-ctrl-viewpoint-menu', ref: viewpointMenuRef },
                ...config.progressViewPoints.map((vp: ProgressViewPoint) => renderViewpointItem(vp))
              )
            )
          )
        )
      );
    },
  };

  // ============================================
  // 底部左侧按钮渲染顺序配置
  // ============================================
  const bottomLeftOrder = ['prev', 'play', 'next', 'time', 'viewpoint'];

  // ============================================
  // 生命周期钩子
  // ============================================
  lifecycle.onMounted = (): void => {
    // 初始化时长显示
    if (playerCtrlTimeDurationRef.current) {
      playerCtrlTimeDurationRef.current.innerHTML = formatTime(duration);
    }
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', { class: 'player-control-bottom-left' },
    ...bottomLeftOrder
      .map(key => {
        const renderer = bottomLeftRenderers[key];
        if (!renderer) return null;
        if (key === 'prev' && !config.prev) return null;
        if (key === 'next' && !config.next) return null;
        return renderer();
      })
      .filter((vnode): vnode is VNode => vnode !== null)
  );
});
