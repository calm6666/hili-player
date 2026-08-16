/**
 * ============================================
 * 高能进度条组件 (PbpControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent, ref } from '@/core';

export interface PbpControlsProps {
  visible?: boolean;
}

export type PbpControlsEvents = {
  pbpClick: undefined;
  pbpPinClick: undefined;
  pbpControlsMounted: { show: () => void; hide: () => void };
};

export const PbpControls = defineComponent<PbpControlsProps, PbpControlsEvents>((props, lifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 高能进度条容器元素引用 */
  const pbpRef = ref<HTMLDivElement>();

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 显示高能进度条组件
   */
  const show = (): void => {
    if (pbpRef.current) {
      pbpRef.current.style.display = '';
    }
  };

  /**
   * 隐藏高能进度条组件
   */
  const hide = (): void => {
    if (pbpRef.current) {
      pbpRef.current.style.display = 'none';
    }
  };

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 处理高能进度条点击事件
   */
  const handlePbpClick = (): void => {
    lifecycle.emit?.('pbpClick');
  };

  /**
   * 处理高能进度条固定按钮点击事件
   */
  const handlePinClick = (): void => {
    lifecycle.emit?.('pbpPinClick');
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，向上层暴露显示和隐藏方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('pbpControlsMounted', { show, hide });
  };

  /**
   * 组件销毁前，清空 DOM 引用
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', { class: 'player-pbp', ref: pbpRef, onClick: handlePbpClick, style: { display: props.visible ? '' : 'none' } },
    h('span', { class: 'common-svg-icon' }),
    h('div', { class: 'player-pbp-pin', onClick: handlePinClick },
      h('div', { class: 'player-pbp-pin-icon' },
        h('span', { class: 'common-svg-icon' }),
        h('span', { class: 'player-pbp-pin-tip' }, '打开《高能进度条》常驻')
      )
    )
  );
});
