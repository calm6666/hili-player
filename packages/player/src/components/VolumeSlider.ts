/**
 * ============================================
 * 音量滑块组件 (VolumeSlider)
 * ============================================
 * 从 RightControls 中提取的独立音量滑块组件
 * 处理垂直滑块拖拽、静音切换、音量数字显示
 */

import { h, defineComponent, ref, useState, useContext } from '@/core';
import { isBrowser } from '@/utils';
import { PlayerStateKeyEnum } from '@/store/runtimeState';
import { StateContext } from '@/store/runtimeState';
import { LottieIcon, LottieIconApi } from './LottieIcon';
import volumeHoverAnimationData from '../assets/lottie-icon/volume-hover-animation.json';
import volumeMuteHoverAnimationData from '../assets/lottie-icon/volume-mute-hover-animation.json';
import volumeToMuteAnimationData from '../assets/lottie-icon/volume-to-mute-animation.json';
import muteToVolumeAnimationData from '../assets/lottie-icon/mute-to-volume-animation.json';



/**
 * VolumeSlider 组件 Props 接口
 */
export type VolumeSliderEvents = {
  volumeChange: number;
  muteToggle: undefined;
  volumeSliderMounted: { setVolume: (vol: number) => void; setMuted: (mutedState: boolean) => void };
};

export interface VolumeSliderProps {}

/**
 * VolumeSlider 组件 - 使用 defineComponent 创建独立组件
 * 支持垂直滑块拖拽、静音切换和音量数字显示
 */
export const VolumeSlider = defineComponent<VolumeSliderProps, VolumeSliderEvents>((_props, lifecycle) => {
  const state = useContext(StateContext);
  const initialVolume = state?.get(PlayerStateKeyEnum.VOLUME) ?? 1;
  const initialMuted = state?.get(PlayerStateKeyEnum.MUTED) ?? false;

  // ============================================
  // DOM 引用
  // ============================================

  /** 音量按钮容器元素引用 */
  const volumeBtnRef = ref<HTMLDivElement>();

  /** 音量图标元素引用 */
  const volumeIconRef = ref<LottieIconApi>();

  /** 音量数字显示元素引用 */
  const volumeNumberRef = ref<HTMLDivElement>();

  /** 垂直滑块区域元素引用 */
  const sliderAreaRef = ref<HTMLDivElement>();

  /** 垂直滑块进度条元素引用 */
  const sliderBarRef = ref<HTMLDivElement>();

  /** 垂直滑块拖拽手柄元素引用 */
  const sliderThumbRef = ref<HTMLDivElement>();

  // ============================================
  // 状态
  // ============================================

  /** 当前音量值 */
  let currentVolume = initialVolume;

  let isMuted = initialMuted;

  /** 是否正在拖拽 */
  let isDragging = false;

  /** 拖拽时的鼠标移动处理函数引用 */
  let dragMouseMove: ((e: MouseEvent) => void) | null = null;

  /** 拖拽时的鼠标释放处理函数引用 */
  let dragMouseUp: (() => void) | null = null;
  // ============================================
  // 辅助函数
  // ============================================

  /**
   * 音量按钮鼠标进入事件处理
   */
  const mouseVolumeEnter = (): void => {
    volumeIconRef.current?.play();
  };


  /**
   * 音量按钮鼠标离开事件处理
   */
  const mouseVolumeLeave = (): void => {

  };

  /**
   * 更新音量 UI 显示
   * @param vol - 音量值 (0-1)
   */
  const updateVolumeUI = (vol: number): void => {
    /** 音量百分比 (0-100) */
    const percent = Math.max(0, Math.min(100, vol * 100));

    if (sliderBarRef.current) {
      sliderBarRef.current.style.height = `${percent}%`;
    }
    if (sliderThumbRef.current) {
      sliderThumbRef.current.style.bottom = `${percent}%`;
    }
    if (volumeNumberRef.current) {
      volumeNumberRef.current.innerText = `${Math.round(percent)}`;
    }
  };

  /**
   * 更新静音图标显示
   * @param mutedState - 是否静音
   */
  const updateMuteUI = (_mutedState: boolean): void => {

  };

  /**
   * 根据鼠标位置计算音量
   * @param clientY - 鼠标 Y 坐标
   * @returns 音量值 (0-1)
   */
  const getVolumeFromY = (clientY: number): number => {
    if (!sliderAreaRef.current) return 0;
    /** 滑块区域的边界矩形 */
    const rect = sliderAreaRef.current.getBoundingClientRect();
    // 垂直滑块：底部为最大值，顶部为最小值
    /** 鼠标位置在滑块上的比例 (0-1)，底部为 1，顶部为 0 */
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return Math.round(ratio * 100) / 100;
  };

  // ============================================
  // 状态监听（通过 useState + useContext 订阅 TypedStateManager）
  // ============================================
  // useContext(StateContext) 从最近的 Provider 获取状态管理器实例
  // 无需 props 传递，组件直接订阅，避免层级穿透
  //
  // 当外部（VideoPlayer / 插件 / 快捷键）改变音量或静音状态时，
  // 自动更新滑块 UI 和图标，无需父组件手动调用 API
  //
  // 数据流示例：
  //   用户按 M 键 → VideoPlayer.toggleMute()
  //     → state.set(PlayerStateKeyEnum.MUTED, true)
  //     → 此处 updater 自动执行：更新图标 + 更新 isMuted 变量

  if (state) {
    /**
     * 监听音量状态变化
     * 当外部改变音量时，自动更新滑块位置和数字显示
     * 例如：state.set(PlayerStateKeyEnum.VOLUME, 0.5)
     */
    useState(
      state,
      PlayerStateKeyEnum.VOLUME,
      (newVolume) => {
        currentVolume = newVolume;
        updateVolumeUI(newVolume);
      },
      lifecycle
    );

    /**
     * 监听静音状态变化
     * 当外部改变静音状态时，自动更新图标动画和内部变量
     * 例如：state.set(PlayerStateKeyEnum.MUTED, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.MUTED,
      (newMuted) => {
        console.log(newMuted);
        isMuted = newMuted;
        if (volumeIconRef.current) {
          if (newMuted) {
            volumeIconRef.current.setSequenceSlot(2);
          } else {
            volumeIconRef.current.setSequenceSlot(0);
          }
          volumeIconRef.current.play();
        }
      },
      lifecycle
    );
  }

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 静音切换
   */
  const handleMuteToggle = (): void => {
    handleVolumeIconAnimation();
    lifecycle.emit?.('muteToggle');
  };

  /**
   * 音量图标点击，切换音量图标动画
   */
  const handleVolumeIconAnimation = (): void => {
    if (isMuted) {
      isMuted = false;
      volumeIconRef.current?.setSequenceSlot(0);
    } else {
      isMuted = true;
      volumeIconRef.current?.setSequenceSlot(2);
    }
    volumeIconRef.current?.play();
  };

  /** 
   * 音量图标鼠标进入事件处理
   */

  /**
   * 滑块区域点击，直接跳转到点击位置对应的音量
   */
  const handleSliderClick = (event: MouseEvent): void => {
    /** 点击位置对应的音量值 */
    const vol = getVolumeFromY(event.clientY);
    currentVolume = vol;
    updateVolumeUI(vol);
    lifecycle.emit?.('volumeChange', vol);
  };

  /**
   * 滑块区域鼠标按下 - 开始拖拽
   */
  const handleSliderMouseDown = (event: MouseEvent): void => {
    if (!isBrowser()) return;
    event.preventDefault();
    isDragging = true;

    /** 鼠标位置对应的音量值 */
    const vol = getVolumeFromY(event.clientY);
    currentVolume = vol;
    updateVolumeUI(vol);
    lifecycle.emit?.('volumeChange', vol);

    /**
     * 拖拽过程中鼠标移动的处理函数
     */
    const onMouseMove = (e: MouseEvent): void => {
      if (!isDragging) return;
      /** 鼠标位置对应的音量值 */
      const v = getVolumeFromY(e.clientY);
      currentVolume = v;
      updateVolumeUI(v);
      lifecycle.emit?.('volumeChange', v);
    };

    /**
     * 拖拽结束时鼠标释放的处理函数
     */
    const onMouseUp = (): void => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragMouseMove = null;
      dragMouseUp = null;
    };

    dragMouseMove = onMouseMove;
    dragMouseUp = onMouseUp;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ============================================
  // API 方法
  // ============================================

  /**
   * 设置音量并更新 UI
   */
  const setVolume = (vol: number): void => {
    currentVolume = Math.max(0, Math.min(1, vol));
    updateVolumeUI(currentVolume);
  };

  /**
   * 设置静音状态并更新图标
   */
  const setMuted = (mutedState: boolean): void => {
    updateMuteUI(mutedState);
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，初始化音量和静音状态显示，并向上层暴露设置方法
   */
  lifecycle.onMounted = (): void => {
    updateVolumeUI(currentVolume);
    updateMuteUI(isMuted);
    lifecycle.emit?.('volumeSliderMounted', { setVolume, setMuted });
  };

  /**
   * 组件销毁前，移除 document 级别的事件监听并重置拖拽状态
   */
  lifecycle.onBeforeDestroy = (): void => {
    isDragging = false;
    if (dragMouseMove) {
      document.removeEventListener('mousemove', dragMouseMove);
      dragMouseMove = null;
    }
    if (dragMouseUp) {
      document.removeEventListener('mouseup', dragMouseUp);
      dragMouseUp = null;
    }
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', {
    class: 'player-ctrl-btn player-ctrl-volume',
    role: 'button',
    'aria-label': '音量',
    ref: volumeBtnRef,
    onClick: handleMuteToggle,
    onMouseEnter: mouseVolumeEnter,
    onMouseLeave: mouseVolumeLeave,
  },
    // 音量图标
    h('div', { class: 'player-ctrl-btn-icon' },
      h(LottieIcon, {
        name: 'volume',
        initialSlotIndex: isMuted ? 3 : 1,
        sequence: [
          {
            animationData: muteToVolumeAnimationData,
            startFrame: 2,
            complete: 'next',
            autoplay: false
          },
          {
            animationData: volumeHoverAnimationData,
            complete: 'stop',
            autoplay: false
          },
          {
            animationData: volumeToMuteAnimationData,
            complete: 'next',
            autoplay: false
          },
          {
            animationData: volumeMuteHoverAnimationData,
            complete: 'stop',
            autoplay: false
          }
        ],
        loop: false,
        autoplay: false,
        ref: volumeIconRef
      })
    ),
    // 音量控制区域
    h('div', { class: 'player-ctrl-volume-box' },
      // 音量数字
      h('div', { class: 'player-ctrl-volume-number', ref: volumeNumberRef }),
      // 垂直滑块
      h('div', { class: 'player-ctrl-volume-progress slider' },
        h('div', {
          class: 'slider-area',
          ref: sliderAreaRef,
          onClick: handleSliderClick,
          onMouseDown: handleSliderMouseDown,
        },
          h('div', { class: 'slider-bar-wrap' },
            h('div', {
              class: 'slider-bar',
              role: 'progressbar',
              ref: sliderBarRef,
            })
          ),
          h('div', {
            class: 'slider-thumb',
            role: 'thumb',
            ref: sliderThumbRef,
          },
            h('div', { class: 'slider-thumb-dot' })
          )
        )
      )
    )
  );
});
