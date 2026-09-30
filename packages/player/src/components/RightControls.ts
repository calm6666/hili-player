/**
 * ============================================
 * 右侧控制按钮组件 (RightControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent, useTemplateRef, useState, useContext } from '@/core';
import type { VNode } from '@/types';
import { PlayerStateKeyEnum, ConfigContext } from '@/store/runtimeState';
import { StateContext } from '@/store/runtimeState';
import { VolumeSlider } from './VolumeSlider';
import { QualityMenu, type QualityItem } from './QualityMenu';
import { PlaybackRateMenu } from './PlaybackRateMenu';
import { SettingMenu } from './SettingMenu';
import { LottieIcon, type LottieIconApi } from './LottieIcon';
import fullscreenAnimationData from '../assets/lottie-icon/fullscreen-animation.json';
import webFullscreenAnimationData from '../assets/lottie-icon/web-fullscreen-animation.json';
import webExitFullscreenAnimationData from '../assets/lottie-icon/web-exit-fullscreen-animation.json';
import wideHoverAnimationData from '../assets/lottie-icon/wide-hover-animation.json';
import wideExitHoverAnimationData from '../assets/lottie-icon/wide-exit-hover-animation.json';
import pipHoverAnimationData from '../assets/lottie-icon/pip-hover-animation.json';
import pipExitHoverAnimationData from '../assets/lottie-icon/pip-exit-hover-animation.json';



/**
 * RightControls 组件 Props 接口
 */
export type RightControlsEvents = {
  fullscreen: undefined;
  webFullscreen: undefined;
  pip: undefined;
  wide: undefined;
  mute: undefined;
  backrateChange: number;
  volumeChange: number;
  muteToggle: undefined;
  qualityChange: string;
  settingChange: { key: string; value: boolean | string | number };
  menuAnimation: { type: 'quality' | 'eplist' | 'playbackrate' | 'volume' | 'setting'; action: 'show' | 'hide' };
  moreSettingClick: undefined;
  rightControlsMounted: undefined;
};

export interface RightControlsProps {}

/**
 * RightControls 组件 - 使用 defineComponent 创建独立组件
 */
export const RightControls = defineComponent<RightControlsProps, RightControlsEvents>((_props, lifecycle) => {
  const configCtx = useContext(ConfigContext);
  const config = configCtx;
  const state = useContext(StateContext);

  const qualities: QualityItem[] = [];
  const currentQuality = state?.get(PlayerStateKeyEnum.QUALITY) ?? 'auto';
  const rate = state?.get(PlayerStateKeyEnum.PLAYBACK_RATE) ?? 1;
  const rates = [2, 1.5, 1.25, 1, 0.75, 0.5];

  const onQualityChange = (quality: string): void => {
    lifecycle.emit?.('qualityChange', quality);
  };
  const onRateChange = (r: number): void => {
    lifecycle.emit?.('backrateChange', r);
  };
  const onSettingChange = (key: string, value: boolean | string | number): void => {
    lifecycle.emit?.('settingChange', { key, value });
  };
  const onMenuAnimation = (type: 'quality' | 'eplist' | 'playbackrate' | 'volume' | 'setting', action: 'show' | 'hide'): void => {
    lifecycle.emit?.('menuAnimation', { type, action });
  };

  // ============================================
  // DOM 引用
  // ============================================

  /** 画中画按钮元素引用 */
  const pipBtnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'pipBtnRef');

  /** 宽屏按钮元素引用 */
  const wideBtnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'wideBtnRef');

  /** 网页全屏按钮元素引用 */
  const webBtnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'webBtnRef');

  /** 全屏按钮元素引用 */
  const fullBtnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'fullBtnRef');

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 切换全屏状态
   */
  const toggleFullscreen = (): void => { lifecycle.emit?.('fullscreen'); };

  /**
   * 切换网页全屏状态
   */
  const toggleWebFullscreen = (): void => { lifecycle.emit?.('webFullscreen'); };

  /**
   * 切换画中画状态
   */
  const togglePip = (): void => { lifecycle.emit?.('pip'); };

  /**
   * 切换宽屏状态
   */
  const toggleWide = (): void => { lifecycle.emit?.('wide'); };

  /** 全屏按钮 API 引用 */
  const fullscreenRef = useTemplateRef<LottieIconApi>(lifecycle, 'fullscreenRef');
  /** 网页全屏按钮 API 引用 */
  const webFullscreenRef = useTemplateRef<LottieIconApi>(lifecycle, 'webFullscreenRef');
  /** 宽屏按钮 API 引用 */
  const wideRef = useTemplateRef<LottieIconApi>(lifecycle, 'wideRef');
  /** 画中画按钮 API 引用 */
  const pipRef = useTemplateRef<LottieIconApi>(lifecycle, 'pipRef');



  /**
   * 全屏悬悬停事件处理函数
   */
  const mouseFullscreenEnter = (): void => {
    fullscreenRef.value?.play();
  };

  /**
   * 全屏悬停事件处理函数
   */
  const mouseFullscreenLeave = (): void => {
  };

  /**
   * 网页全屏悬悬停事件处理函数
   */
  const mouseWebEnter = (): void => {
    webFullscreenRef.value?.play();
  };

  /**
   * 网页全屏悬停事件处理函数
   */
  const mouseWebLeave = (): void => {
  };

  /**
   * 宽屏悬悬停事件处理函数
   */
  const mouseWideEnter = (): void => {
    wideRef.value?.play();
  };

  /**
   * 宽屏悬停事件处理函数
   */
  const mouseWideLeave = (): void => {
  };

  /**
   * 画中画悬悬停事件处理函数
   */
  const mousePipEnter = (): void => {
    pipRef.value?.play();
  };

  /**
   * 画中画悬停事件处理函数
   */
  const mousePipLeave = (): void => {
  };

  // ============================================
  // 状态监听（通过 useState + useContext 订阅 TypedStateManager）
  // ============================================
  // useContext(StateContext) 从最近的 Provider 获取状态管理器实例
  // 无需 props 传递，组件直接订阅，避免层级穿透
  //
  // 当外部改变全屏/画中画/宽屏等状态时，自动更新按钮的视觉反馈
  // 例如：用户按 F11 → VideoPlayer 检测到 fullscreenchange
  //   → state.set(PlayerStateKeyEnum.IS_FULLSCREEN, true)
  //   → 此处 updater 自动执行，给按钮添加 active 样式

  if (state) {
    /**
     * 监听全屏状态变化
     * 进入全屏时给全屏按钮添加 'state-active' 样式类，退出时移除
     * 例如：state.set(PlayerStateKeyEnum.IS_FULLSCREEN, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_FULLSCREEN,
      (isFullscreen) => {
        console.log("RightControls isFullscreen: ", isFullscreen);
        if (fullBtnRef.value) {
          fullBtnRef.value.classList.toggle('state-active', isFullscreen);
        }
      },
      lifecycle
    );

    /**
     * 监听网页全屏状态变化
     * 进入网页全屏时给按钮添加 'state-active' 样式类，退出时移除
     * 例如：state.set(PlayerStateKeyEnum.IS_WEB_FULLSCREEN, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_WEB_FULLSCREEN,
      (isWebFullscreen) => {
        console.log("RightControls isWebFullscreen: ", isWebFullscreen);
        if (webBtnRef.value) {
          webBtnRef.value.classList.toggle('state-active', isWebFullscreen);
        }
      },
      lifecycle
    );

    /**
     * 监听画中画状态变化
     * 进入画中画时给按钮添加 'state-active' 样式类，退出时移除
     * 例如：state.set(PlayerStateKeyEnum.IS_PIP, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_PIP,
      (isPip) => {
        console.log("RightControls isPip: ", isPip);
        if (pipBtnRef.value) {
          pipBtnRef.value.classList.toggle('state-active', isPip);
        }
      },
      lifecycle
    );

    /**
     * 监听宽屏状态变化
     * 进入宽屏模式时给按钮添加 'state-active' 样式类，退出时移除
     * 例如：state.set(PlayerStateKeyEnum.IS_WIDE_SCREEN, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_WIDE_SCREEN,
      (isWide) => {
        if (wideBtnRef.value) {
          wideBtnRef.value.classList.toggle('state-active', isWide);
        }
      },
      lifecycle
    );
  }

  // ============================================
  // 底部右侧按钮渲染器映射表
  // ============================================

  /** 按钮类型到渲染函数的映射表，每个键对应一种控制按钮的渲染逻辑 */
  const bottomRightRenderers: Record<string, () => VNode | null> = {
    /** 渲染画质选择菜单 */
    quality: () => {
      if (!config.quality) return null;
      return h(QualityMenu, { qualities, currentQuality, onQualityChange, onMenuAnimation });
    },
    /** 渲染选集菜单 */
    eplist: () => {
      if (!config.eplist) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-eplist',
        role: 'button',
        'aria-label': '选集',
        onMouseEnter: () => lifecycle.emit?.('menuAnimation', { type: 'eplist', action: 'show' }),
        onMouseLeave: () => lifecycle.emit?.('menuAnimation', { type: 'eplist', action: 'hide' })
      },
        h('div', { class: 'player-ctrl-eplist-result' }, '选集'),
        h('div', { class: 'player-ctrl-eplist-menu-wrap', style: { minHeight: '180px' } },
          h('div', { class: 'player-ctrl-eplist-section' },
            h('div', {
              class: 'player-ctrl-eplist-section-bottom',
              style: {
                touchAction: 'pan-x',
                userSelect: 'none',
                webkitUserDrag: 'none',
                webkitTapHighlightColor: 'rgba(0, 0, 0, 0)'
              }
            },
              h('ul', {
                class: 'player-ctrl-eplist-section-content',
                style: {
                  transitionTimingFunction: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
                  transitionDuration: '0ms',
                  transform: 'translate(0px, 0px) scale(1) translateZ(0px)'
                },
              },
                h('li', { class: 'player-ctrl-eplist-multi-menu-item state-multi-active-item', 'data-cid': '554164205' },
                  h('span', { class: 'common-svg-icon' }),
                  h('span', { class: 'player-ctrl-eplist-multi-menu-item-text' }, '青岛大学教工足球队2022年3月20日周五中午活动')
                ),
                h('li', { class: 'player-ctrl-eplist-multi-menu-item', 'data-cid': '554164027' },
                  h('span', { class: 'common-svg-icon' }),
                  h('span', { class: 'player-ctrl-eplist-multi-menu-item-text' }, '青岛大学教工足球队2022年3月20日周日中午活动')
                ),
                h('li', { class: 'player-ctrl-eplist-multi-menu-item', 'data-cid': '554164026' },
                  h('span', { class: 'common-svg-icon' }),
                  h('span', { class: 'player-ctrl-eplist-multi-menu-item-text' }, 'C0099')
                )
              )
            )
          )
        )
      );
    },
    /** 渲染播放速率选择菜单 */
    playbackrate: () => h(PlaybackRateMenu, { rate, rates, onRateChange, onMenuAnimation }),
    /** 渲染音量滑块组件 */
    volume: () => h(VolumeSlider, {}),
    /** 渲染设置菜单 */
    setting: () => {
      if (!config.setting) return null;
      return h(SettingMenu, { onSettingChange, onMenuAnimation });
    },
    /** 渲染画中画按钮 */
    pip: () => {
      if (!config.pip) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-pip',
        role: 'button',
        'aria-label': '画中画',
        ref: 'pipBtnRef',
        onClick: togglePip,
        onMouseEnter: mousePipEnter,
        onMouseLeave: mousePipLeave,
      },
        h('div', { class: 'player-ctrl-btn-icon' },
          h(LottieIcon, {
            name: 'pip',
            sequence: [
              {
                animationData: pipHoverAnimationData,
                complete: 'stop',
                autoplay: false
              },
              {
                animationData: pipExitHoverAnimationData,
                complete: 'stop',
                autoplay: false
              }
            ],
            ref: 'pipRef'
          }
          )
        ),
      );
    },
    /** 渲染宽屏按钮 */
    wide: () => {
      if (!config.wide) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-wide',
        role: 'button',
        'aria-label': '宽屏',
        ref: 'wideBtnRef',
        onClick: toggleWide,
        onMouseEnter: mouseWideEnter,
        onMouseLeave: mouseWideLeave,
      },
        h('div', { class: 'player-ctrl-btn-icon' },
          h(LottieIcon, {
            name: 'wide',
            sequence: [
              {
                animationData: wideHoverAnimationData,
                complete: 'stop',
                autoplay: false
              },
              {
                animationData: wideExitHoverAnimationData,
                complete: 'stop',
                autoplay: false
              }
            ],
            ref: 'wideRef'
          }
          )
        )
      );
    },
    /** 渲染网页全屏按钮 */
    web: () => {
      if (!config.web) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-web',
        role: 'button',
        'aria-label': '网页全屏',
        ref: 'webBtnRef',
        onClick: toggleWebFullscreen,
        onMouseEnter: mouseWebEnter,
        onMouseLeave: mouseWebLeave,
      },
        h('div', { class: 'player-ctrl-btn-icon' },
          h(LottieIcon, {
            name: 'webFullscreen',
            sequence: [
              {
                animationData: webFullscreenAnimationData,
                complete: 'stop',
                autoplay: false
              },
              {
                animationData: webExitFullscreenAnimationData,
                complete: 'stop',
                autoplay: false
              }
            ],
            ref: 'webFullscreenRef'
          }
          )
        )
      );
    },
    /** 渲染全屏按钮 */
    full: () => h('div', {
      class: 'player-ctrl-btn player-ctrl-full',
      role: 'button',
      'aria-label': '全屏',
      ref: 'fullBtnRef',
      onMouseEnter: mouseFullscreenEnter,
      onMouseLeave: mouseFullscreenLeave,
      onClick: toggleFullscreen
    },
      h('div', { class: 'player-ctrl-btn-icon' },
        h(LottieIcon,
          {
            name: 'fullscreen',
            animationData: fullscreenAnimationData,
            ref: 'fullscreenRef',
            autoplay: false
          }
        )
      )
    )
  };

  /** 底部右侧按钮的渲染顺序配置 */
  const bottomRightOrder = ['quality', 'eplist', 'playbackrate', 'volume', 'setting', 'pip', 'wide', 'web', 'full'];

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，通知上层组件
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('rightControlsMounted');
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', { class: 'player-control-bottom-right' },
    ...bottomRightOrder
      .map(key => {
        /** 当前键对应的渲染函数 */
        const renderer = bottomRightRenderers[key];
        if (!renderer) return null;
        return renderer();
      })
      .filter((vnode): vnode is VNode => vnode !== null)
  );
});
