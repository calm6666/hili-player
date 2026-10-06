/**
 * ============================================
 * 弹幕发送栏组件 (SendBar)
 * ============================================
 * 提供弹幕输入、发送、弹幕开关和设置面板等交互功能
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import { rafTimeout, cancelRaf } from '@/utils/rafTimeout';
import type { AnimationFrameID } from '@/utils/rafTimeout';
import type { ComponentLifecycle } from '@/types';
import { DmSetting } from '@/hili-player/components/DmSetting';
import { Selection } from '@/hili-player/components/Selection';
import {
  DanmakuSwitchOn,
  DanmakuSwitchOff,
  DanmakuSetting,
  DanmakuTextSetting,
} from '@/hili-player/components/icons';

/**
 * 面板显示状态
 * 管理设置面板和弹幕类型选择面板的延迟显示/隐藏定时器
 */
export interface DmShowpanel {
  /** 设置面板的定时器 */
  setting: {
    /** 设置面板延迟显示的定时器 ID */
    showTimer: AnimationFrameID | null;
    /** 设置面板延迟隐藏的定时器 ID */
    hideTimer: AnimationFrameID | null;
  };
  /** 弹幕类型选择面板的定时器 */
  selection: {
    /** 选择面板延迟显示的定时器 ID */
    showTimer: AnimationFrameID | null;
    /** 选择面板延迟隐藏的定时器 ID */
    hideTimer: AnimationFrameID | null;
  };
}

/**
 * 提示按钮信息
 * 用于弹幕开关悬停时显示提示气泡
 */
export interface Tooltip {
  /** 触发提示的 DOM 元素 */
  element: HTMLElement | null;
  /** 提示名称 */
  name: string;
  /** 提示的数据属性名 */
  dataName: string;
}

/**
 * SendBar 组件 Props 接口
 * 定义弹幕发送栏的所有属性和回调
 */
export interface SendBarProps {
  /** 在线观看人数文本 */
  onlineCount?: string;
  /** 弹幕总数文本 */
  danmakuCount?: string;
  /** 是否显示登录提示（未登录时显示登录/注册链接） */
  showLoginTip?: boolean;
  /** 弹幕开关初始状态，true 为开启 */
  danmakuSwitch?: boolean;
  /** 输入框占位符文本 */
  placeholder?: string;
  /** 输入框获得焦点时的回调 */
  onInputFocus?: () => void;
  /** 输入框失去焦点时的回调 */
  onInputBlur?: () => void;
  /** 弹幕开关状态变化时的回调 */
  onDanmakuSwitch?: (checked: boolean) => void;
  /** 发送弹幕时的回调，参数为弹幕文本 */
  onSendDanmaku?: (text: string) => void;
  /** 显示提示气泡时的回调 */
  onShowTooltip?: (tooltip: Tooltip) => void;
  /** 隐藏提示气泡时的回调 */
  onHideTooltip?: () => void;
}

/**
 * 弹幕发送栏组件
 * 提供弹幕输入、发送、开关控制和设置面板等交互功能
 */
export const SendBar = defineComponent<SendBarProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // 状态数据
  // ============================================

  /** 面板显示状态，管理设置面板和弹幕类型选择面板的定时器 */
  const dmShowpanel: DmShowpanel = {
    setting: { showTimer: null, hideTimer: null },
    selection: { showTimer: null, hideTimer: null },
  };

  /** 提示气泡延迟显示的定时器 ID */
  let tipInTimer: AnimationFrameID | null = null;

  /** 弹幕输入框的当前文本值 */
  let inputValue = '';

  /** 弹幕开关状态，true 表示弹幕开启 */
  let isDanmakuEnabled = props.danmakuSwitch ?? true;

  /** 弹幕开关提示信息 */
  const tooltip: Tooltip = {
    element: null,
    name: 'danmaku-switch',
    dataName: 'danmaku_switch',
  };

  // ============================================
  // DOM 元素引用
  // ============================================

  /** 弹幕设置图标 DOM 引用，用于绑定鼠标悬停事件 */
  const settingIconRef = useTemplateRef<HTMLDivElement>(lifecycle, 'settingIconRef');

  /** 弹幕类型选择图标 DOM 引用，用于绑定鼠标悬停事件 */
  const textSettingIconRef = useTemplateRef<HTMLDivElement>(lifecycle, 'textSettingIconRef');

  /** 弹幕设置面板容器 DOM 引用，用于控制面板的显示/隐藏 */
  const settingWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'settingWrapRef');

  /** 弹幕类型选择面板容器 DOM 引用，用于控制面板的显示/隐藏 */
  const selectionContainerRef = useTemplateRef<HTMLDivElement>(lifecycle, 'selectionContainerRef');

  /** 弹幕输入框 DOM 引用 */
  const inputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'inputRef');

  /** 弹幕开关复选框 DOM 引用 */
  const switchInputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'switchInputRef');

  // ============================================
  // 事件处理
  // ============================================

  /**
   * 处理输入框获得焦点事件
   * 说明：lifecycle.emit 会同时路由到 props.onInputFocus（框架 onXxx 约定），
   * 因此这里不再显式调用 props 回调，否则会重复触发
   */
  const handleInputFocus = (): void => {
    lifecycle.emit?.('inputFocus');
  };

  /** 处理输入框失去焦点事件（同上，避免重复触发 props 回调） */
  const handleInputBlur = (): void => {
    lifecycle.emit?.('inputBlur');
  };

  /**
   * 处理输入框内容变化事件
   * @param event - 输入事件
   */
  const handleInputChange = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement)) return;
    inputValue = event.target.value;
  };

  /** 处理发送弹幕，清空输入框并触发回调（emit 会路由到 props.onSendDanmaku） */
  const handleSend = (): void => {
    if (inputValue.trim()) {
      lifecycle.emit?.('sendDanmaku', inputValue.trim());
      if (inputRef.value) {
        inputRef.value.value = '';
        inputValue = '';
      }
    }
  };

  /**
   * 处理弹幕开关变化事件
   * emit 会同时路由到 props.onDanmakuSwitch，不再显式调用 props 回调
   * @param event - 变化事件
   */
  const handleSwitchChange = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement)) return;
    isDanmakuEnabled = event.target.checked;
    lifecycle.emit?.('danmakuSwitch', event.target.checked);
  };

  /**
   * 显示弹幕开关的提示气泡
   * emit 会同时路由到 props.onShowTooltip，不再显式调用 props 回调
   * @param event - 鼠标进入事件
   */
  const showSwitchTip = (event: Event): void => {
    if (!tooltip.element && event.target instanceof HTMLElement) {
      tooltip.element = event.target;
    }
    cancelRaf(tipInTimer!);
    tipInTimer = rafTimeout(() => {
      lifecycle.emit?.('showTooltip', tooltip);
    }, 300);
  };

  /** 隐藏弹幕开关的提示气泡（同上，避免重复触发 props 回调） */
  const hideSwitchTip = (): void => {
    cancelRaf(tipInTimer!);
    lifecycle.emit?.('hideTooltip', tooltip);
  };

  /**
   * 打开指定面板（设置面板或弹幕类型选择面板）
   * @param panel - 面板类型，'setting' 为设置面板，'selection' 为类型选择面板
   */
  const openPanel = (panel: 'setting' | 'selection'): void => {
    switch (panel) {
      case 'setting':
        cancelRaf(dmShowpanel.setting.hideTimer!);
        dmShowpanel.setting.showTimer = rafTimeout(() => {
          settingWrapRef.value?.classList.add('player-dm-setting-show');
        }, 300);
        break;
      case 'selection':
        cancelRaf(dmShowpanel.selection.hideTimer!);
        dmShowpanel.selection.showTimer = rafTimeout(() => {
          selectionContainerRef.value?.classList.add('player-mode-selection-show');
        }, 300);
        break;
    }
  };

  /**
   * 关闭指定面板（设置面板或弹幕类型选择面板）
   * @param panel - 面板类型，'setting' 为设置面板，'selection' 为类型选择面板
   */
  const closePanel = (panel: 'setting' | 'selection'): void => {
    switch (panel) {
      case 'setting':
        cancelRaf(dmShowpanel.setting.showTimer!);
        dmShowpanel.setting.hideTimer = rafTimeout(() => {
          settingWrapRef.value?.classList.remove('player-dm-setting-show');
        }, 300);
        break;
      case 'selection':
        cancelRaf(dmShowpanel.selection.showTimer!);
        dmShowpanel.selection.hideTimer = rafTimeout(() => {
          selectionContainerRef.value?.classList.remove('player-mode-selection-show');
        }, 300);
        break;
    }
  };

  // ============================================
  // API 方法
  // ============================================

  /**
   * 设置输入框的值
   * @param value - 要设置的文本值
   */
  const setInputValue = (value: string): void => {
    inputValue = value;
    if (inputRef.value) {
      inputRef.value.value = value;
    }
  };

  /**
   * 设置弹幕开关状态
   * @param enabled - true 开启弹幕，false 关闭弹幕
   */
  const setDanmakuSwitch = (enabled: boolean): void => {
    isDanmakuEnabled = enabled;
    if (switchInputRef.value) {
      switchInputRef.value.checked = enabled;
    }
  };

  /** 聚焦弹幕输入框 */
  const focusInput = (): void => {
    inputRef.value?.focus();
  };

  /** 让弹幕输入框失去焦点 */
  const blurInput = (): void => {
    inputRef.value?.blur();
  };

  // ============================================
  // 生命周期
  // ============================================

  /** 设置图标鼠标进入事件处理，打开设置面板 */
  const handleSettingMouseEnter = (): void => openPanel('setting');
  /** 设置图标鼠标离开事件处理，关闭设置面板 */
  const handleSettingMouseLeave = (): void => closePanel('setting');
  /** 弹幕类型图标鼠标进入事件处理，打开类型选择面板 */
  const handleTextSettingMouseEnter = (): void => openPanel('selection');
  /** 弹幕类型图标鼠标离开事件处理，关闭类型选择面板 */
  const handleTextSettingMouseLeave = (): void => closePanel('selection');

  /** 组件挂载后绑定鼠标悬停事件并对外暴露控制方法 */
  lifecycle.onMounted = (): void => {
    // 添加事件监听
    settingIconRef.value?.addEventListener('mouseenter', handleSettingMouseEnter);
    settingIconRef.value?.addEventListener('mouseleave', handleSettingMouseLeave);
    textSettingIconRef.value?.addEventListener('mouseenter', handleTextSettingMouseEnter);
    textSettingIconRef.value?.addEventListener('mouseleave', handleTextSettingMouseLeave);

    lifecycle.emit?.('sendBarMounted', { setInputValue, setDanmakuSwitch, focusInput, blurInput });
  };

  /** 组件销毁前移除鼠标悬停事件监听 */
  lifecycle.onBeforeDestroy = (): void => {
    settingIconRef.value?.removeEventListener('mouseenter', handleSettingMouseEnter);
    settingIconRef.value?.removeEventListener('mouseleave', handleSettingMouseLeave);
    textSettingIconRef.value?.removeEventListener('mouseenter', handleTextSettingMouseEnter);
    textSettingIconRef.value?.removeEventListener('mouseleave', handleTextSettingMouseLeave);
  };

  // ============================================
  // 组件渲染
  // ============================================
  return h('div', { class: 'player-sending-bar' },
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
            ref: 'switchInputRef',
            onChange: handleSwitchChange,
          }),
          h('label', { class: 'danmaku-switch-label' },
            h('span', { class: 'danmaku-switch-on' },
              // 弹幕开关图标：既有实现 icons 的 DanmakuSwitchOn SVG
              h('span', { class: 'common-svg-icon', innerHTML: DanmakuSwitchOn })
            ),
            h('span', { class: 'danmaku-switch-off' },
              // 弹幕开关图标：既有实现 icons 的 DanmakuSwitchOff SVG
              h('span', { class: 'common-svg-icon', innerHTML: DanmakuSwitchOff })
            )
          )
        )
      ),
      // 弹幕设置
      h('div', {
        class: 'player-dm-setting',
        ref: 'settingIconRef',
      },
        // 弹幕设置图标：既有实现 icons 的 DanmakuSetting SVG
        h('span', { class: 'common-svg-icon', innerHTML: DanmakuSetting }),
        h('div', { class: 'player-dm-setting-wrap', ref: 'settingWrapRef' },
          h('div', { class: 'player-dm-setting-box ui ui-panel ui-dark' },
            // 弹幕设置面板（显示区域 / 不透明度 / 字号 / 速度，写入运行时状态）
            h(DmSetting, {}),
          )
        )
      ),
      // 输入栏
      h('div', { class: 'player-video-inputbar player-checkBox-hide' },
        h('div', { class: 'player-video-inputbar-wrap', 'data-v-risk': 'fingerprint' },
          // 弹幕类型按钮
          h('div', {
            class: 'player-video-btn-dm',
            ref: 'textSettingIconRef',
          },
            h('span', { class: 'player-iconfont player-iconfont-danmakutype' },
              // 弹幕类型图标：既有实现 icons 的 DanmakuTextSetting SVG
              h('span', { class: 'common-svg-icon', innerHTML: DanmakuTextSetting })
            ),
            h('div', { class: 'player-mode-selection-container', ref: 'selectionContainerRef' },
              // 弹幕类型选择面板（字号 / 模式 / 颜色，写入运行时状态）
              h(Selection, {}),
            ),
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
            ref: 'inputRef',
            onFocus: handleInputFocus,
            onBlur: handleInputBlur,
            onInput: handleInputChange,
            onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') handleSend(); },
          })
        ),
        // 发送按钮
        h('div', {
          class: ['player-dm-btn-send', 'player-button', inputValue.trim() ? '' : 'disabled'].filter(Boolean).join(' '),
          'data-v-risk': 'fingerprint',
          onClick: handleSend,
        },
          h('div', { class: 'button-blue' }, '发送')
        )
      )
    )
  );
});
