/**
 * ============================================
 * 顶部栏组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';
import { rafTimeout, cancelRaf } from '@/utils/rafTimeout';
import type { AnimationFrameID } from '@/utils/rafTimeout';
import { Plus, Issue } from '@/hili-player/components/icons';

/**
 * 顶栏提示信息（与既有实现的 Tooltip 结构一致）
 */
export interface TopTooltip {
  /** 触发提示的 DOM 元素 */
  element: HTMLElement | null;
  /** 提示名称 */
  name: string;
  /** 提示的数据属性名（对应 Tooltips 提示项的 name） */
  dataName: string;
}

/**
 * 顶部栏组件 Props 接口
 */
export interface TopProps {
  /** 视频标题 */
  title?: string;
  /** UP主头像 URL */
  avatar?: string;
  /** 是否显示顶部栏 */
  visible?: boolean;
  /** 问题反馈点击回调 */
  onIssueClick?: () => void;
  /** 关注按钮点击回调 */
  onFollowClick?: () => void;
  /** 请求显示 tooltip（问题反馈图标悬停） */
  onShowTooltip?: (tooltip: TopTooltip) => void;
  /** 请求隐藏 tooltip */
  onHideTooltip?: (tooltip: TopTooltip) => void;
}

/**
 * 顶部栏组件
 */
export const Top = defineComponent<TopProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 根容器元素引用 */
  const topWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'topWrapRef');

  /** 标题文本元素引用 */
  const titleRef = useTemplateRef<HTMLDivElement>(lifecycle, 'titleRef');

  /** 头像图片元素引用 */
  const avatarRef = useTemplateRef<HTMLImageElement>(lifecycle, 'avatarRef');

  /** 问题反馈图标元素引用 */
  const issueIconRef = useTemplateRef<HTMLSpanElement>(lifecycle, 'issueIconRef');

  // ============================================
  // 问题反馈图标的悬停提示（与既有实现一致）
  // ============================================

  /** 提示延迟显示的定时器 */
  let inTimer: AnimationFrameID | null = null;

  /** 反馈按钮提示信息（dataName 对应 Tooltips 的 feedback-btn 提示项） */
  const issueTooltip: TopTooltip = {
    element: null,
    name: 'issue',
    dataName: 'feedback-btn',
  };

  /** 图标悬停 300ms 后显示提示 */
  const handleIssueEnter = (): void => {
    cancelRaf(inTimer!);
    inTimer = rafTimeout(() => {
      props.onShowTooltip?.(issueTooltip);
    }, 300);
  };

  /** 移开图标立即隐藏提示 */
  const handleIssueLeave = (): void => {
    cancelRaf(inTimer!);
    props.onHideTooltip?.(issueTooltip);
  };

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 处理问题反馈按钮点击
   */
  const handleIssueClick = (): void => {
    props.onIssueClick?.();
  };

  /**
   * 处理关注按钮点击
   */
  const handleFollowClick = (): void => {
    props.onFollowClick?.();
  };

  // ============================================
  // DOM 更新函数
  // ============================================

  /**
   * 设置视频标题文本
   * @param title - 标题内容
   */
  const setTitle = (title: string): void => {
    if (titleRef.value) {
      titleRef.value.textContent = title;
    }
  };

  /**
   * 设置UP主头像图片地址
   * @param avatar - 头像 URL
   */
  const setAvatar = (avatar: string): void => {
    if (avatarRef.value) {
      avatarRef.value.src = avatar;
    }
  };

  /**
   * 显示顶部栏
   */
  const show = (): void => {
    if (topWrapRef.value) {
      topWrapRef.value.style.display = '';
    }
  };

  /**
   * 隐藏顶部栏
   */
  const hide = (): void => {
    if (topWrapRef.value) {
      topWrapRef.value.style.display = 'none';
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    // 初始状态：根据 props 设置显示/隐藏
    if (props.visible === false) {
      hide();
    }

    // 悬停提示的目标元素（挂载后才有 DOM 引用）
    issueTooltip.element = issueIconRef.value;

    lifecycle.emit?.('topMounted', {
      setTitle,
      setAvatar,
      show,
      hide,
    });
  };

  lifecycle.onBeforeDestroy = (): void => {
  };

  // ============================================
  // 主渲染函数
  // ============================================

  return h(
    'div',
    {
      class: 'player-top-wrap',
      ref: 'topWrapRef',
    },
    h('div', { class: 'player-top-mask', hidden: true }),
    h('div', { class: 'player-top-title' }),
    h('div', { class: 'player-top-follow' }),
    h(
      'div',
      { class: 'player-top-left' },
      h(
        'div',
        { class: 'player-top-left-title', style: { fontSize: '20px' }, ref: 'titleRef' },
        props.title ?? ''
      ),
      h(
        'div',
        { class: 'player-top-left-follow' },
        h(
          'div',
          { class: 'player-follow', onClick: handleFollowClick },
          h('img', {
            class: 'player-follow-face',
            src:
              props.avatar ??
              'https://io.v.hblog.top/hfs/face/706353e46fe1c390d6d2cb72a704818a.jpg@240w_240h_1c_1s_!web-avatar-nav.webp',
            ref: 'avatarRef',
          }),
          h(
            'span',
            { class: 'player-follow-icon' },
            // 关注图标：既有实现 icons 的 Plus SVG（禁止用 unicode 字符当图标）
            h('span', { class: 'common-svg-icon', innerHTML: Plus })
          ),
          h('span', { class: 'player-follow-text' }, '关注')
        )
      )
    ),
    h(
      'div',
      { class: 'player-top-issue' },
      h(
        'span',
        {
          class: 'player-top-issue-icon',
          ref: 'issueIconRef',
          onMouseEnter: handleIssueEnter,
          onMouseLeave: handleIssueLeave,
          onClick: handleIssueClick,
        },
        // 问题反馈图标：既有实现 icons 的 Issue SVG（禁止用 unicode 字符当图标）
        h('span', { class: 'common-svg-icon', innerHTML: Issue })
      )
    )
  );
});
