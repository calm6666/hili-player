/**
 * ============================================
 * 音量提示组件
 * ============================================
 * 使用 h 函数实现的音量提示组件
 */

import { h, defineComponent } from '@/core';

/**
 * 音量提示组件 Props 接口
 */
export interface VolumeHintProps {
  /** 当前音量 (0-1) */
  volume?: number;
  /** 是否显示 */
  visible?: boolean;
}

/**
 * 音量提示组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const VolumeHint = defineComponent<VolumeHintProps>((props) => {
  /**
   * 音量图标元素引用
   */
  const volumeHintIconRef: { current: HTMLSpanElement | null } = { current: null };

  /**
   * 获取显示文本
   */
  const getDisplayText = (volume?: number): string => {
    if (volume === undefined || volume === null) {
      return '';
    }
    if (volume === 0) {
      return '静音';
    }
    return `${Math.floor(volume * 100)}%`;
  };

  return h(
    'div',
    {
      class: 'player-volume-hint',
      style: {
        display: props.visible ? '' : 'none',
        opacity: props.visible ? '1' : '0',
      },
    },
    h(
        'span',
        {
          class: 'player-volume-hint-icon',
          ref: volumeHintIconRef,
        },
        '📢'
      ),
    h(
      'span',
      {
        class: 'player-volume-hint-text',
      },
      getDisplayText(props.volume)
    )
  );
});
