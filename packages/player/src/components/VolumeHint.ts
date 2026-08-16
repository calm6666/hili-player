/**
 * ============================================
 * 音量提示组件
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';

/**
 * 音量提示组件 Props 接口
 */
export interface VolumeHintProps {
  /** 当前音量，范围 0-1 */
  volume?: number;
  /** 是否显示音量提示 */
  visible?: boolean;
}

/**
 * 音量提示组件
 */
export const VolumeHint = defineComponent<VolumeHintProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 音量提示容器元素引用 */
  const hintRef = ref<HTMLDivElement>();
  /** 音量数值文本元素引用 */
  const textRef = ref<HTMLSpanElement>();
  /** 音量图标元素引用 */
  const iconRef = ref<HTMLSpanElement>();

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 显示音量提示并更新音量数值
   * @param volume - 当前音量，范围 0-1
   */
  const show = (volume: number): void => {
    if (hintRef.current) {
      // 使用 removeProperty 而非 setProperty(_, null)
      // setProperty 的 value 参数不接受 null，会被转为字符串 "null" 导致无效 CSS
      hintRef.current.style.removeProperty('display');
      hintRef.current.style.opacity = '1';
    }
    if (textRef.current) {
      if (volume === 0) {
        textRef.current.innerHTML = '静音';
      } else {
        textRef.current.innerHTML = `${Math.floor(volume * 100)}%`;
      }
    }
  };

  /**
   * 隐藏音量提示
   */
  const hide = (): void => {
    if (hintRef.current) {
      hintRef.current.style.opacity = '0';
      hintRef.current.style.display = 'none';
    }
  };

  /**
   * 更新音量数值文本
   * @param volume - 当前音量，范围 0-1
   */
  const setVolume = (volume: number): void => {
    if (textRef.current) {
      if (volume === 0) {
        textRef.current.innerHTML = '静音';
      } else {
        textRef.current.innerHTML = `${Math.floor(volume * 100)}%`;
      }
    }
  };

  /**
   * 切换静音图标状态
   * @param isMuted - 是否静音
   */
  const setMuted = (isMuted: boolean): void => {
    if (iconRef.current) {
      if (isMuted) {
        iconRef.current.classList.add('player-volume-muted');
      } else {
        iconRef.current.classList.remove('player-volume-muted');
      }
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('volumeHintMounted', { show, hide, setVolume, setMuted });
  };

  lifecycle.onBeforeDestroy = (): void => {
    // 组件销毁时引用自动释放
  };

  return h(
    'div',
    {
      class: 'player-volume-hint',
      ref: hintRef,
      style: {
        display: props.visible ? '' : 'none',
        opacity: props.visible ? '1' : '0',
      },
    },
    h(
        'span',
        {
          class: 'player-volume-hint-icon',
          ref: iconRef,
        },
        '📢'
      ),
    h(
      'span',
      {
        class: 'player-volume-hint-text',
        ref: textRef,
      },
      (props.volume ?? 0) === 0 ? '静音' : `${Math.floor((props.volume ?? 0) * 100)}%`
    )
  );
});
