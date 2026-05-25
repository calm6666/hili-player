/**
 * ============================================
 * 顶部栏组件
 * ============================================
 * 使用 h 函数实现的顶部栏组件
 */

import { h, defineComponent } from '@/core';

/**
 * 顶部栏组件 Props 接口
 */
export interface TopProps {
  /** 视频标题 */
  title?: string;
  /** UP主头像 */
  avatar?: string;
  /** 是否显示 */
  visible?: boolean;
  /** 问题反馈点击回调 */
  onIssueClick?: () => void;
  /** 关注点击回调 */
  onFollowClick?: () => void;
}

/**
 * 顶部栏组件
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const Top = defineComponent<TopProps>((props) => {
  /**
   * 处理问题反馈点击
   */
  const handleIssueClick = (): void => {
    props.onIssueClick?.();
  };

  /**
   * 处理关注点击
   */
  const handleFollowClick = (): void => {
    props.onFollowClick?.();
  };

  return h(
    'div',
    {
      class: 'player-top-wrap',
      style: {
        display: props.visible !== false ? '' : 'none',
      },
    },
    h('div', { class: 'player-top-mask', hidden: true }),
    h('div', { class: 'player-top-title' }),
    h('div', { class: 'player-top-follow' }),
    h(
      'div',
      { class: 'player-top-left' },
      h(
        'div',
        { class: 'player-top-left-title', style: { fontSize: '20px' } },
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
