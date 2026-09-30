/**
 * ============================================
 * 滑块组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { VNode, ComponentLifecycle } from '@/types';
import { isBrowser } from '@/utils';

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
  /** 滑块宽度，支持字符串或数字（像素） */
  width?: string | number;
  /** 当前值 (0-100) */
  value?: number;
  /** 标记点数组 */
  marks?: SliderMark[] | null;
  /** 步长，用于离散调整滑块值 */
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
 */
export const Slider = defineComponent<SliderProps>((props, lifecycle: ComponentLifecycle) => {
  /** 滑块宽度，默认 100% */
  const width = props.width ?? '100%';

  /** 步长，默认为 1 表示连续调整 */
  const step = props.step ?? 1;

  /** 当前滑块值 */
  let currentValue = props.value ?? 0;

  /** 拖动开始时的 X 坐标 */
  let startX = 0;

  /** 是否正在拖动 */
  let isDragging = false;

  /** 进度条容器元素引用 */
  const progressRef = useTemplateRef<HTMLDivElement>(lifecycle, 'progressRef');

  /** 进度条元素引用 */
  const progressBarRef = useTemplateRef<HTMLDivElement>(lifecycle, 'progressBarRef');

  /** 进度值显示元素引用 */
  const progressValRef = useTemplateRef<HTMLDivElement>(lifecycle, 'progressValRef');

  /**
   * 获取显示值，优先从标记点中查找名称，否则返回百分比字符串
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
   * 更新进度条宽度和显示值
   */
  const updateProgressBar = (): void => {
    if (progressBarRef.value) {
      progressBarRef.value.style.width = `${Math.floor(currentValue)}%`;
    }
    if (progressValRef.value) {
      progressValRef.value.innerHTML = getDisplayValue();
    }
  };

  /**
   * 根据鼠标位置计算滑块值
   */
  const calculateValueFromPosition = (clientX: number): number => {
    if (!progressRef.value) {
      return currentValue;
    }

    /** 进度条容器的边界矩形 */
    const rect = progressRef.value.getBoundingClientRect();
    /** 鼠标位置对应的百分比 */
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
   * 处理进度条容器点击，直接跳转到点击位置
   */
  const handleProgressClick = (event: MouseEvent): void => {
    currentValue = calculateValueFromPosition(event.clientX);
    updateProgressBar();
    props.onChange?.(currentValue);
  };

  /**
   * 处理滑块点鼠标按下，开始拖动
   */
  const handleDotMouseDown = (event: MouseEvent): void => {
    if (!isBrowser()) return;
    isDragging = true;

    if (step === 1) {
      startX = event.clientX;
    }

    props.onDragStart?.();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  /**
   * 处理鼠标移动，实时更新滑块位置
   */
  const handleMouseMove = (event: MouseEvent): void => {
    if (!isDragging || !progressRef.value) {
      return;
    }

    if (step !== 1) {
      currentValue = calculateValueFromPosition(event.clientX);
    } else {
      /** 进度条容器的边界矩形 */
      const rect = progressRef.value.getBoundingClientRect();
      /** 鼠标移动的水平偏移量 */
      const deltaX = event.clientX - startX;
      /** 偏移量对应的百分比变化 */
      const deltaPercentage = (deltaX / rect.width) * 100;
      currentValue = Math.min(Math.max(0, currentValue + deltaPercentage), 100);
      startX = event.clientX;
    }

    updateProgressBar();
    props.onChange?.(currentValue);
  };

  /**
   * 处理鼠标释放，结束拖动
   */
  const handleMouseUp = (): void => {
    isDragging = false;

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    props.onDragEnd?.();
  };

  // ============================================
  // API 方法
  // ============================================

  /**
   * 设置当前值并更新进度条
   */
  const setValue = (value: number): void => {
    currentValue = Math.min(Math.max(0, value), 100);
    updateProgressBar();
  };

  /**
   * 获取当前值
   */
  const getValue = (): number => {
    return currentValue;
  };

  // ============================================
  // 生命周期
  // ============================================

  /**
   * 组件挂载后，通过事件向上层暴露 setValue 和 getValue 方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('sliderMounted', { setValue, getValue });
  };

  /**
   * 组件销毁前，移除全局鼠标事件监听并重置拖动状态
   */
  lifecycle.onBeforeDestroy = (): void => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    isDragging = false;
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
          ref: 'progressRef',
          onClick: handleProgressClick,
        },
        h(
          'div',
          {
            class: 'ui-progress-bar',
            ref: 'progressBarRef',
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
          ref: 'progressValRef',
        },
        getDisplayValue()
      )
  );
});
