/**
 * ============================================
 * 弹幕发送栏组件 (SendBar)
 * ============================================
 * 使用 h 函数框架实现的弹幕发送栏组件
 * 保持与老播放器完全相同的 DOM 结构和类名
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';
import { rafTimeout, cancelRaf } from '@/utils/rafTimeout';
import type { AnimationFrameID } from '@/utils/rafTimeout';

/**
 * 面板显示状态
 */
export interface DmShowpanel {
  setting: {
    showTimer: AnimationFrameID | null;
    hideTimer: AnimationFrameID | null;
  };
  selection: {
    showTimer: AnimationFrameID | null;
    hideTimer: AnimationFrameID | null;
  };
}

/**
 * 提示按钮
 */
export interface Tooltip {
  element: HTMLElement | null;
  name: string;
  dataName: string;
}

/**
 * SendBar 组件 Props 接口
 */
export interface SendBarProps {
  /** 在线人数 */
  onlineCount?: string;
  /** 弹幕数量 */
  danmakuCount?: string;
  /** 是否显示登录提示 */
  showLoginTip?: boolean;
  /** 弹幕开关状态 */
  danmakuSwitch?: boolean;
  /** 输入框占位符 */
  placeholder?: string;
  /** 输入框聚焦回调 */
  onInputFocus?: () => void;
  /** 输入框失焦回调 */
  onInputBlur?: () => void;
  /** 弹幕开关变化回调 */
  onDanmakuSwitch?: (checked: boolean) => void;
  /** 发送弹幕回调 */
  onSendDanmaku?: (text: string) => void;
  /** 显示提示回调 */
  onShowTooltip?: (tooltip: Tooltip) => void;
  /** 隐藏提示回调 */
  onHideTooltip?: () => void;
}

/**
 * 弹幕发送栏组件
 * 使用 h 函数实现，保持与老播放器完全相同的 DOM 结构和类名
 */
export const SendBar = defineComponent<SendBarProps>((props, lifecycle) => {
  // ============================================
  // 状态数据
  // ============================================
  const dmShowpanel: DmShowpanel = {
    setting: { showTimer: null, hideTimer: null },
    selection: { showTimer: null, hideTimer: null },
  };

  let tipInTimer: AnimationFrameID | null = null;
  let inputValue = '';
  let isDanmakuEnabled = props.danmakuSwitch ?? true;

  const tooltip: Tooltip = {
    element: null,
    name: 'danmaku-switch',
    dataName: 'danmaku_switch',
  };

  // ============================================
  // DOM 元素引用
  // ============================================
  const sendingBarRef: { current: HTMLDivElement | null } = { current: null };
  const settingIconRef: { current: HTMLDivElement | null } = { current: null };
  const textSettingIconRef: { current: HTMLDivElement | null } = { current: null };
  const settingWrapRef: { current: HTMLDivElement | null } = { current: null };
  const selectionContainerRef: { current: HTMLDivElement | null } = { current: null };
  const inputRef: { current: HTMLInputElement | null } = { current: null };
  const switchInputRef: { current: HTMLInputElement | null } = { current: null };

  // ============================================
  // 事件处理
  // ============================================

  /**
   * 处理输入框聚焦
   */
  const handleInputFocus = (): void => {
    props.onInputFocus?.();
    lifecycle.emit?.('inputFocus');
  };

  /**
   * 处理输入框失焦
   */
  const handleInputBlur = (): void => {
    props.onInputBlur?.();
    lifecycle.emit?.('inputBlur');
  };

  /**
   * 处理输入变化
   */
  const handleInputChange = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement)) return;
    inputValue = event.target.value;
  };

  /**
   * 处理发送弹幕
   */
  const handleSend = (): void => {
    if (inputValue.trim()) {
      props.onSendDanmaku?.(inputValue.trim());
      lifecycle.emit?.('sendDanmaku', inputValue.trim());
      if (inputRef.current) {
        inputRef.current.value = '';
        inputValue = '';
      }
    }
  };

  /**
   * 处理弹幕开关变化
   */
  const handleSwitchChange = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement)) return;
    isDanmakuEnabled = event.target.checked;
    props.onDanmakuSwitch?.(event.target.checked);
    lifecycle.emit?.('danmakuSwitch', event.target.checked);
  };

  /**
   * 显示开关提示
   */
  const showSwitchTip = (event: Event): void => {
    if (!tooltip.element && event.target instanceof HTMLElement) {
      tooltip.element = event.target;
    }
    cancelRaf(tipInTimer!);
    tipInTimer = rafTimeout(() => {
      props.onShowTooltip?.(tooltip);
      lifecycle.emit?.('showTooltip', tooltip);
    }, 300);
  };

  /**
   * 隐藏开关提示
   */
  const hideSwitchTip = (): void => {
    cancelRaf(tipInTimer!);
    props.onHideTooltip?.();
    lifecycle.emit?.('hideTooltip');
  };

  /**
   * 打开面板
   */
  const openPanel = (panel: 'setting' | 'selection'): void => {
    switch (panel) {
      case 'setting':
        cancelRaf(dmShowpanel.setting.hideTimer!);
        dmShowpanel.setting.showTimer = rafTimeout(() => {
          settingWrapRef.current?.classList.add('player-dm-setting-show');
        }, 300);
        break;
      case 'selection':
        cancelRaf(dmShowpanel.selection.hideTimer!);
        dmShowpanel.selection.showTimer = rafTimeout(() => {
          selectionContainerRef.current?.classList.add('player-mode-selection-show');
        }, 300);
        break;
    }
  };

  /**
   * 关闭面板
   */
  const closePanel = (panel: 'setting' | 'selection'): void => {
    switch (panel) {
      case 'setting':
        cancelRaf(dmShowpanel.setting.showTimer!);
        dmShowpanel.setting.hideTimer = rafTimeout(() => {
          settingWrapRef.current?.classList.remove('player-dm-setting-show');
        }, 300);
        break;
      case 'selection':
        cancelRaf(dmShowpanel.selection.showTimer!);
        dmShowpanel.selection.hideTimer = rafTimeout(() => {
          selectionContainerRef.current?.classList.remove('player-mode-selection-show');
        }, 300);
        break;
    }
  };

  // ============================================
  // 生命周期
  // ============================================
  lifecycle.onMounted = (): void => {
    // 添加事件监听
    settingIconRef.current?.addEventListener('mouseenter', () => openPanel('setting'));
    settingIconRef.current?.addEventListener('mouseleave', () => closePanel('setting'));
    textSettingIconRef.current?.addEventListener('mouseenter', () => openPanel('selection'));
    textSettingIconRef.current?.addEventListener('mouseleave', () => closePanel('selection'));
  };

  // ============================================
  // 组件渲染
  // ============================================
  return h('div', { class: 'player-sending-bar', ref: sendingBarRef },
    // 视频信息
    h('div', { class: 'player-video-info' },
      h('div', { class: 'player-video-info-online' },
        h('b', {}, props.onlineCount || '1000+'),
        '人正在看'
      ),
      h('div', { class: 'player-video-info-divide' }, '，'),
      h('div', { class: 'player-video-info-dm' }, `已装填 ${props.danmakuCount || '0'} 条弹幕`)
    ),
    // 弹幕根容器
    h('div', { class: 'player-dm-root' },
      // 弹幕开关
      h('div', { class: 'player-dm-switch danmaku-switch' },
        h('div', {
          class: 'switch-area',
          onMouseEnter: showSwitchTip,
          onMouseLeave: hideSwitchTip,
        },
          h('input', {
            class: 'danmaku-switch-input',
            type: 'checkbox',
            checked: isDanmakuEnabled,
            ref: switchInputRef,
            onChange: handleSwitchChange,
          }),
          h('label', { class: 'danmaku-switch-label' },
            h('span', { class: 'danmaku-switch-on' },
              h('span', { class: 'common-svg-icon' })
            ),
            h('span', { class: 'danmaku-switch-off' },
              h('span', { class: 'common-svg-icon' })
            )
          )
        )
      ),
      // 弹幕设置
      h('div', {
        class: 'player-dm-setting',
        ref: settingIconRef,
      },
        h('span', { class: 'common-svg-icon' }),
        h('div', { class: 'player-dm-setting-wrap', ref: settingWrapRef },
          h('div', { class: 'player-dm-setting-box ui ui-panel ui-dark' })
        )
      ),
      // 输入栏
      h('div', { class: 'player-video-inputbar player-checkBox-hide' },
        h('div', { class: 'player-video-inputbar-wrap', 'data-v-risk': 'fingerprint' },
          // 弹幕类型按钮
          h('div', {
            class: 'player-video-btn-dm',
            ref: textSettingIconRef,
          },
            h('span', { class: 'player-iconfont player-iconfont-danmakutype' },
              h('span', { class: 'common-svg-icon' })
            ),
            h('div', { class: 'player-mode-selection-container', ref: selectionContainerRef })
          ),
          // 登录提示
          props.showLoginTip ? h('div', { class: 'player-dm-wrap' },
            '请先',
            h('a', { href: '', 'data-action': 'login' }, '登录'),
            '或',
            h('a', { href: '//passport.bilibili.com/login?register_page=1', target: '_blank', 'data-action': 'login' }, '注册')
          ) : null,
          // 输入框
          h('input', {
            class: 'player-dm-input',
            placeholder: props.placeholder || '发个友善的弹幕见证当下',
            autocomplete: 'off',
            style: { display: props.showLoginTip ? 'none' : 'block' },
            ref: inputRef,
            onFocus: handleInputFocus,
            onBlur: handleInputBlur,
            onInput: handleInputChange,
            onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') handleSend(); },
          })
        ),
        // 发送按钮
        h('div', {
          class: ['player-dm-btn-send', 'player-button', { disabled: !inputValue.trim() }],
          'data-v-risk': 'fingerprint',
          onClick: handleSend,
        },
          h('div', { class: 'button-blue' }, '发送')
        )
      )
    )
  );
});
