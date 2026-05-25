/**
 * ============================================
 * 进度关闭组件
 * ============================================
 * 使用 h 函数实现的进度关闭组件
 */

import { h, defineComponent } from '@/core';

/**
 * 进度关闭组件 Props 接口
 */
export interface ProgressCloseProps {
  /** 进度值 (0-1) */
  progress?: number;
  /** 点击回调 */
  onClick?: () => void;
}

/**
 * 进度关闭组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const ProgressClose = defineComponent<ProgressCloseProps>((props) => {
  /**
   * 进度圆圈元素引用
   */
  const progressCircleRef: { current: SVGCircleElement | null } = { current: null };

  /**
   * 处理点击
   */
  const handleClick = (): void => {
    props.onClick?.();
  };

  /**
   * 计算 stroke-dashoffset
   */
  const getStrokeDashoffset = (progress: number): number => {
    const clampedProgress = Math.min(Math.max(0, progress), 1);
    return 377 - clampedProgress * 377;
  };

  /**
   * 更新进度
   * 手动操作 DOM 更新进度圆圈
   * @param progress - 进度值 (0-1)
   */
  const updateProgress = (progress: number): void => {
    if (progressCircleRef.current) {
      const dashoffsetStr = getStrokeDashoffset(progress).toString();
      progressCircleRef.current.setAttribute('stroke-dashoffset', dashoffsetStr);
    }
  };

  return h(
    'svg',
    {
      width: '150',
      height: '150',
      viewBox: '0 0 150 150',
      class: 'close-warp',
      onClick: handleClick,
    },
    h('circle', {
      cx: '75',
      cy: '75',
      r: '60',
      class: 'close-bg',
    }),
    h('circle', {
      class: 'progress-circle',
      cx: '75',
      cy: '75',
      r: '60',
      fill: 'none',
      stroke: '#fff',
      'stroke-width': '8',
      'stroke-dasharray': '377',
      'stroke-dashoffset': getStrokeDashoffset(props.progress ?? 0).toString(),
      ref: progressCircleRef,
    }),
    h('path', {
      d: 'M 50,50 L 100,100 M 50,100 L 100,50',
      stroke: '#fff',
      'stroke-width': '4',
      fill: 'none',
    })
  );
});
