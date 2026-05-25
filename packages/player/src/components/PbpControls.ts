/**
 * ============================================
 * 高能进度条组件 (PbpControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent } from '@/core';

/**
 * PbpControls 组件 Props 接口
 */
export interface PbpControlsProps {
  // 可以添加配置属性，如是否启用等
}

/**
 * PbpControls 组件 - 使用 defineComponent 创建独立组件
 */
export const PbpControls = defineComponent<PbpControlsProps>((props, lifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================
  const pbpRef: { current: HTMLDivElement | null } = { current: null };

  // ============================================
  // 事件处理函数
  // ============================================
  const handlePbpClick = (): void => {
    lifecycle.emit?.('pbpClick');
  };

  const handlePinClick = (): void => {
    lifecycle.emit?.('pbpPinClick');
  };

  // ============================================
  // 生命周期钩子
  // ============================================
  lifecycle.onMounted = (): void => {
    // 组件挂载后的初始化逻辑
    lifecycle.emit?.('pbpControlsMounted');
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', { class: 'player-pbp', ref: pbpRef, onClick: handlePbpClick },
    h('span', { class: 'common-svg-icon' }),
    h('div', { class: 'player-pbp-pin', onClick: handlePinClick },
      h('div', { class: 'player-pbp-pin-icon' },
        h('span', { class: 'common-svg-icon' }),
        h('span', { class: 'player-pbp-pin-tip' }, '打开《高能进度条》常驻')
      )
    )
  );
});
