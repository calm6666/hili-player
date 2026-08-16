/**
 * ============================================
 * 字幕容器组件 (SubtitleLayer)
 * ============================================
 * 字幕DOM容器在player侧，字幕逻辑实现在插件侧
 * 与弹幕(RowDm)和互动(InteractionLayer)采用相同的低耦合模式
 * 字幕插件将自身DOM注入到 .player-subtitle-wrap 容器中
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';

// ============================================
// 字幕位置类型
// ============================================

/** 字幕显示位置类型：顶部、居中、底部 */
export type SubtitlePosition = 'top' | 'center' | 'bottom';

// ============================================
// SubtitleLayer 组件 Props 接口
// ============================================

/** 字幕容器组件属性接口 */
export interface SubtitleLayerProps {
  /** 是否显示字幕层 */
  visible?: boolean;
}

// ============================================
// SubtitleLayer 组件
// ============================================

/**
 * SubtitleLayer 组件 - 使用 defineComponent 创建独立组件
 * 提供字幕插件注入 DOM 的容器
 * 类名使用 'player-subtitle-wrap'
 */
export const SubtitleLayer = defineComponent<SubtitleLayerProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 字幕容器 DOM 引用，字幕插件将内容注入到此容器 */
  const subtitleWrapRef = ref<HTMLDivElement>();

  // ============================================
  // 样式控制方法
  // ============================================

  /**
   * 设置字幕字体大小
   * @param size - 字体大小（px）
   */
  const setFontSize = (size: number): void => {
    if (subtitleWrapRef.current) {
      subtitleWrapRef.current.style.fontSize = `${size}px`;
    }
  };

  /**
   * 设置字幕文字颜色
   * @param color - CSS 颜色值
   */
  const setColor = (color: string): void => {
    if (subtitleWrapRef.current) {
      subtitleWrapRef.current.style.color = color;
    }
  };

  /**
   * 设置字幕背景颜色
   * @param color - CSS 颜色值
   */
  const setBackgroundColor = (color: string): void => {
    if (subtitleWrapRef.current) {
      subtitleWrapRef.current.style.backgroundColor = color;
    }
  };

  /**
   * 设置字幕位置
   * @param position - 字幕位置（top / center / bottom）
   */
  const setPosition = (position: SubtitlePosition): void => {
    if (!subtitleWrapRef.current) return;

    switch (position) {
      case 'top':
        subtitleWrapRef.current.style.bottom = '';
        subtitleWrapRef.current.style.top = '10%';
        break;
      case 'center':
        subtitleWrapRef.current.style.bottom = '';
        subtitleWrapRef.current.style.top = '50%';
        subtitleWrapRef.current.style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        subtitleWrapRef.current.style.top = '';
        subtitleWrapRef.current.style.transform = '';
        subtitleWrapRef.current.style.bottom = '10%';
        break;
    }
  };

  // ============================================
  // 生命周期
  // ============================================

  /** 组件挂载后对外暴露字幕容器引用和样式控制方法 */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('subtitleLayerMounted', {
      subtitleWrap: subtitleWrapRef.current,
      setFontSize,
      setColor,
      setBackgroundColor,
      setPosition,
    });
  };

  /** 组件销毁前清理字幕容器内的所有子节点 */
  lifecycle.onBeforeDestroy = (): void => {
    if (subtitleWrapRef.current) {
      while (subtitleWrapRef.current.firstChild) {
        subtitleWrapRef.current.removeChild(subtitleWrapRef.current.firstChild);
      }
    }
  };

  // ============================================
  // 渲染输出
  // ============================================

  return h('div', {
    class: 'player-subtitle-wrap',
    ref: subtitleWrapRef,
    style: {
      position: 'absolute',
      left: '0',
      bottom: '10%',
      width: '100%',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: '15',
      display: props.visible === false ? 'none' : '',
    },
  });
});

export default SubtitleLayer;
