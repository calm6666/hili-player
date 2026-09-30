/**
 * ============================================
 * 进度关闭组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';

/**
 * 进度关闭组件 Props 接口
 */
export interface ProgressCloseProps {
  /** 进度值 (0-1)，表示圆形进度条的填充比例 */
  progress?: number;
  /** 点击关闭按钮的回调函数 */
  onClick?: () => void;
}

/**
 * 进度关闭组件
 * 渲染一个带圆形进度条的关闭按钮，进度值控制圆弧填充程度
 */
export const ProgressClose = defineComponent<ProgressCloseProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** SVG 根元素 DOM 引用 */
  const svgRef = useTemplateRef<SVGSVGElement>(lifecycle, 'svgRef');

  /** 进度圆环 DOM 引用 */
  const progressCircleRef = useTemplateRef<SVGCircleElement>(lifecycle, 'progressCircleRef');

  /**
   * 处理点击事件
   */
  const handleClick = (): void => {
    props.onClick?.();
  };

  /**
   * 根据进度值计算 SVG 圆弧的 stroke-dashoffset 值
   * @param progress - 进度值 (0-1)
   * @returns stroke-dashoffset 偏移量
   */
  const getStrokeDashoffset = (progress: number): number => {
    /** 限制进度值在 0-1 范围内 */
    const clampedProgress = Math.min(Math.max(0, progress), 1);
    return 377 - clampedProgress * 377;
  };

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 设置进度值并更新圆弧显示
   * @param progress - 新的进度值 (0-1)
   */
  const setProgress = (progress: number): void => {
    if (progressCircleRef.value) {
      progressCircleRef.value.setAttribute('stroke-dashoffset', getStrokeDashoffset(progress).toString());
    }
  };

  /**
   * 显示组件
   */
  const show = (): void => {
    if (svgRef.value) {
      svgRef.value.style.display = '';
    }
  };

  /**
   * 隐藏组件
   */
  const hide = (): void => {
    if (svgRef.value) {
      svgRef.value.style.display = 'none';
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，通过事件向外暴露控制方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('progressCloseMounted', { setProgress, show, hide });
  };

  /**
   * 组件销毁前，清空 DOM 引用以防止内存泄漏
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  return h(
    'svg',
    {
      width: '150',
      height: '150',
      viewBox: '0 0 150 150',
      class: 'close-warp',
      ref: 'svgRef',
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
      ref: 'progressCircleRef',
    }),
    h('path', {
      d: 'M 50,50 L 100,100 M 50,100 L 100,50',
      stroke: '#fff',
      'stroke-width': '4',
      fill: 'none',
    })
  );
});
