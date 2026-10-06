/**
 * ============================================
 * 播放器状态组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';

/**
 * 状态组件 Props 接口
 */
export interface StateProps {
  /** 缓冲速度（字节/秒） */
  bufferSpeed?: number;
  /** 是否显示缓冲状态 */
  buffering?: boolean;
}

/**
 * 播放器状态组件
 */
export const State = defineComponent<StateProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 播放图标元素引用 */
  const playIconRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playIconRef');

  /** 缓冲图标元素引用 */
  const bufferIconRef = useTemplateRef<HTMLDivElement>(lifecycle, 'bufferIconRef');

  /** 缓冲速度文本元素引用 */
  const bufferSpeedRef = useTemplateRef<HTMLSpanElement>(lifecycle, 'bufferSpeedRef');

  /** 缓冲文本容器元素引用 */
  const bufferTextRef = useTemplateRef<HTMLDivElement>(lifecycle, 'bufferTextRef');

  // ============================================
  // DOM 更新函数
  // ============================================

  /** 最近一次有效的缓冲速度（字节/秒），0 表示当前无有效数据 */
  let lastValidSpeed = 0;

  /**
   * 将缓冲速度格式化为可读字符串（按量级自适应 KB/S 与 MB/S）
   *
   * 单位说明：入参为「字节/秒」（与 StreamStats.downloadSpeed 的单位一致），
   * 1024 进制下除以 1024 得到的是 KB/S，除以 1024² 才是 MB/S。
   * @param speed - 缓冲速度（字节/秒）
   * @returns 格式化后的速度字符串；无有效数据（非正数 / NaN）时返回空串
   */
  const formatBufferSpeed = (speed: number): string => {
    if (!Number.isFinite(speed) || speed <= 0) return '';
    const kb = speed / 1024;
    // 1MB/S（1024KB/S）以下按 KB/S 显示，避免出现「0.0MB/S」这类无信息量的文本
    return kb < 1024 ? `${kb.toFixed(1)}KB/S` : `${(kb / 1024).toFixed(1)}MB/S`;
  };

  /**
   * 应用缓冲速度到速度文本
   *
   * 无有效数据时隐藏速度文本（`.player-state-buff-speed` 本身没有隐藏样式，
   * 必须由这里控制显隐），避免出现假的「0.0MB/S」。
   * @param speed - 缓冲速度（字节/秒）
   */
  const applyBufferSpeed = (speed: number): void => {
    const text = formatBufferSpeed(speed);
    lastValidSpeed = text ? speed : 0;
    if (!bufferSpeedRef.value) return;
    if (!text) {
      bufferSpeedRef.value.textContent = '';
      bufferSpeedRef.value.style.display = 'none';
      return;
    }
    bufferSpeedRef.value.textContent = text;
    bufferSpeedRef.value.style.display = '';
  };

  /**
   * 更新缓冲速度显示文本
   * @param speed - 缓冲速度（字节/秒）；无效（0 / NaN / 负数）时隐藏速度文本
   */
  const updateBufferSpeed = (speed: number): void => {
    applyBufferSpeed(speed);
  };

  /**
   * 显示缓冲状态图标和文本
   */
  const showBuffering = (): void => {
    if (bufferIconRef.value) {
      bufferIconRef.value.style.display = '';
    }
    if (bufferTextRef.value) {
      bufferTextRef.value.style.display = '';
    }
    // 文本容器重新显示时，按最近一次有效速度重新决定速度文本的显隐
    applyBufferSpeed(lastValidSpeed);
  };

  /**
   * 隐藏缓冲状态图标和文本
   */
  const hideBuffering = (): void => {
    if (bufferIconRef.value) {
      bufferIconRef.value.style.display = 'none';
    }
    if (bufferTextRef.value) {
      bufferTextRef.value.style.display = 'none';
    }
  };

  /**
   * 显示播放图标
   */
  const showPlayIcon = (): void => {
    if (playIconRef.value) {
      playIconRef.value.style.display = '';
    }
  };

  /**
   * 隐藏播放图标
   */
  const hidePlayIcon = (): void => {
    if (playIconRef.value) {
      playIconRef.value.style.display = 'none';
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    // 初始状态：先按 props 速度决定速度文本显隐（无有效数据即隐藏）
    applyBufferSpeed(props.bufferSpeed ?? 0);
    // 缓冲状态：props.buffering 为真时显示缓冲图标与文本
    if (props.buffering) {
      showBuffering();
    } else {
      hideBuffering();
    }
    // 初始隐藏播放图标（由父组件的暂停状态驱动显示）
    hidePlayIcon();

    lifecycle.emit?.('stateMounted', {
      updateBufferSpeed,
      showBuffering,
      hideBuffering,
      showPlayIcon,
      hidePlayIcon,
    });
  };

  lifecycle.onBeforeDestroy = (): void => {
    // 组件销毁时引用自动释放
  };

  // ============================================
  // 主渲染函数
  // ============================================

  return h(
    'div',
    { class: 'player-state-wrap' },
    h('div', { class: 'player-state-play', ref: 'playIconRef' }),
    h('div', { class: 'player-state-buff-icon', ref: 'bufferIconRef' }),
    h(
      'div',
      { class: 'player-state-buff-text', ref: 'bufferTextRef' },
      h('span', { class: 'player-state-buff-title' }, '正在缓冲...'),
      h(
        'span',
        {
          class: 'player-state-buff-speed',
          ref: 'bufferSpeedRef',
          // 初值无有效数据时先隐藏，onMounted 会按 props.bufferSpeed 重新判定
          style: { display: 'none' },
        },
        formatBufferSpeed(props.bufferSpeed ?? 0)
      )
    )
  );
});
