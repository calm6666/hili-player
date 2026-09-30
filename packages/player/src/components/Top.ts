/**
 * ============================================
 * 顶部栏组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';

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
            h('span', { class: 'common-svg-icon' }, '+')
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
        { class: 'player-top-issue-icon', onClick: handleIssueClick },
        h('span', { class: 'common-svg-icon' }, '?')
      )
    )
  );
});
