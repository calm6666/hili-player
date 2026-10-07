/**
 * ============================================
 * 高能进度条组件 (PbpControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期。
 *
 * 与参考实现 `controls/index.ts` 一致：
 * - `.player-pbp` 常驻在控制条实体中（CSS 里 opacity: 0 / z-index: -1）
 * - 控制栏显示时由父组件调用 setShow(true) 加上 `show` 类，
 *   CSS `.player-pbp.show { bottom: calc(100% + 7px) }` 把它抬到控制栏之上
 */

import { h, defineComponent, useTemplateRef } from '@/core';

export interface PbpControlsProps {
  visible?: boolean;
}

export type PbpControlsEvents = {
  pbpClick: undefined;
  pbpPinClick: undefined;
  pbpControlsMounted: { setShow: (show: boolean) => void };
};

export const PbpControls = defineComponent<PbpControlsProps, PbpControlsEvents>((props, lifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 高能进度条容器元素引用 */
  const pbpRef = useTemplateRef<HTMLDivElement>(lifecycle, 'pbpRef');

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 设置高能进度条的展开态（与参考实现 showControl / hideControl 的 `show` 类一致）
   * @param show - 是否展开
   */
  const setShow = (show: boolean): void => {
    pbpRef.value?.classList.toggle('show', show);
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
  const handlePinClick = (event: MouseEvent): void => {
    event.stopPropagation();
    lifecycle.emit?.('pbpPinClick');
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，向上层暴露显示和隐藏方法
   */
  lifecycle.onMounted = (): void => {
    setShow(props.visible === true);
    lifecycle.emit?.('pbpControlsMounted', { setShow });
  };

  // ============================================
  // 主渲染函数
  // ============================================

  return h('div', { class: 'player-pbp', ref: 'pbpRef', onClick: handlePbpClick },
    h('span', { class: 'common-svg-icon' }),
    h('div', { class: 'player-pbp-pin', onClick: handlePinClick },
      h('div', { class: 'player-pbp-pin-icon' },
        h('span', { class: 'common-svg-icon' }),
        h('span', { class: 'player-pbp-pin-tip' }, '打开《高能进度条》常驻')
      )
    )
  );
});
