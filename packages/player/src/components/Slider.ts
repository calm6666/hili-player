/**
 * ============================================
 * 滑块组件
 * ============================================
 * 使用 h 函数实现的滑块组件
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * 标记点接口
 */
export interface SliderMark {
  /** 位置值 (0-100) */
  value: number;
  /** 显示名称 */
  name: string;
}

/**
 * 滑块组件 Props 接口
 */
export interface SliderProps {
  /** 宽度 */
  width?: string | number;
  /** 当前值 (0-100) */
  value?: number;
  /** 标记点数组 */
  marks?: SliderMark[] | null;
  /** 步长 */
  step?: number;
  /** 值变化回调 */
  onChange?: (value: number) => void;
  /** 拖动开始回调 */
  onDragStart?: () => void;
  /** 拖动结束回调 */
  onDragEnd?: () => void;
}

/**
 * 滑块组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Slider = defineComponent<SliderProps>((props) => {
  /**
   * 默认值
   */
  const width = props.width ?? '100%';
  const step = props.step ?? 1;

  /**
   * 当前值
   */
  let currentValue = props.value ?? 0;

  /**
   * 拖动开始时的 X 坐标
   */
  let startX = 0;

  /**
   * 是否正在拖动
   */
  let isDragging = false;

  /**
   * 进度条容器元素引用
   */
  const progressRef: { current: HTMLDivElement | null } = { current: null };

  /**
   * 进度条元素引用
   */
  const progressBarRef: { current: HTMLDivElement | null } = { current: null };

  /**
   * 进度值显示元素引用
   */
  const progressValRef: { current: HTMLDivElement | null } = { current: null };

  /**
   * 获取显示值
   */
  const getDisplayValue = (): string => {
    if (props.marks) {
      const mark = props.marks.find((m: SliderMark) => m.value === currentValue);
      if (mark) {
        return mark.name;
      }
    }
    return `${Math.floor(currentValue)}%`;
  };

  /**
   * 更新进度条宽度
   */
  const updateProgressBar = (): void => {
    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${Math.floor(currentValue)}%`;
    }
    if (progressValRef.current) {
      progressValRef.current.innerHTML = getDisplayValue();
    }
  };

  /**
   * 计算值从鼠标位置
   */
  const calculateValueFromPosition = (clientX: number): number => {
    if (!progressRef.current) {
      return currentValue;
    }

    const rect = progressRef.current.getBoundingClientRect();
    const percentage = Math.min(
      Math.max(0, ((clientX - rect.left) / rect.width) * 100),
      100
    );

    if (step !== 1) {
      return Math.min(
        Math.max(0, Math.round(percentage / step) * step),
        100
      );
    }

    return percentage;
  };

  /**
   * 处理进度条容器点击
   */
  const handleProgressClick = (event: MouseEvent): void => {
    currentValue = calculateValueFromPosition(event.clientX);
    updateProgressBar();
    props.onChange?.(currentValue);
  };

  /**
   * 处理滑块点鼠标按下
   */
  const handleDotMouseDown = (event: MouseEvent): void => {
    isDragging = true;

    if (step === 1) {
      startX = event.clientX;
    }

    props.onDragStart?.();

    /**
     * 添加全局鼠标事件监听
     */
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  /**
   * 处理鼠标移动
   */
  const handleMouseMove = (event: MouseEvent): void => {
    if (!isDragging || !progressRef.current) {
      return;
    }

    if (step !== 1) {
      currentValue = calculateValueFromPosition(event.clientX);
    } else {
      const rect = progressRef.current.getBoundingClientRect();
      const deltaX = event.clientX - startX;
      const deltaPercentage = (deltaX / rect.width) * 100;
      currentValue = Math.min(Math.max(0, currentValue + deltaPercentage), 100);
      startX = event.clientX;
    }

    updateProgressBar();
    props.onChange?.(currentValue);
  };

  /**
   * 处理鼠标释放
   */
  const handleMouseUp = (): void => {
    isDragging = false;

    /**
     * 移除全局鼠标事件监听
     */
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    props.onDragEnd?.();
  };



  /**
   * 渲染标记点
   */
  const renderMarks = (): VNode | null => {
    if (!props.marks || props.marks.length === 0) {
      return null;
    }

    return h(
      'div',
      { class: 'ui-progress-step' },
      ...props.marks.map((mark: SliderMark) =>
        h(
          'div',
          {
            class: 'ui-progress-item',
            style: { left: `${mark.value}%` },
          },
          h('div', { class: 'ui-progress-lab' })
        )
      )
    );
  };

  return h(
    'div',
    {
      class: 'ui-area',
      style: { width: typeof width === 'number' ? `${width}px` : width },
    },
    h(
        'div',
        {
          class: 'ui-progress-wrap',
          ref: progressRef,
          onClick: handleProgressClick,
        },
        h(
          'div',
          {
            class: 'ui-progress-bar',
            ref: progressBarRef,
          },
          h('span', {
            class: 'ui-progress-dot',
            onMouseDown: handleDotMouseDown,
          })
        ),
        renderMarks()
      ),
      h(
        'div',
        {
          class: 'ui-progress-val',
          style: { width: '60px' },
          ref: progressValRef,
        },
        getDisplayValue()
      )
  );
});
