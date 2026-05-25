/**
 * ============================================
 * 结尾组件 (Ending)
 * ============================================
 * 使用 h 函数框架实现的播放器结尾组件
 * 保持与老播放器完全相同的 DOM 结构和类名
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';

/**
 * Ending 组件 Props 接口
 */
export interface EndingProps {
  /** 是否打开 */
  isOpen?: boolean;
  /** UP主信息 */
  upInfo?: {
    id: string;
    name: string;
    avatar: string;
    followCount: number;
  };
  /** 相关视频 */
  relatedVideo?: {
    title: string;
    cover: string;
    bvid: string;
  };
  /** 视频BV号 */
  bvid?: string;
  /** 视频链接 */
  videoUrl?: string;
  /** 嵌入代码 */
  iframeCode?: string;
  /** 重播回调 */
  onRestart?: () => void;
  /** 关注回调 */
  onFollow?: () => void;
  /** 点赞回调 */
  onLike?: () => void;
  /** 投币回调 */
  onCoin?: () => void;
  /** 收藏回调 */
  onCollect?: () => void;
  /** 分享回调 */
  onShare?: () => void;
  /** 关闭分享回调 */
  onCloseShare?: () => void;
  /** 复制链接回调 */
  onCopyLink?: (type: 'html' | 'iframe') => void;
}

/**
 * 结尾组件
 * 使用 h 函数实现，保持与老播放器完全相同的 DOM 结构和类名
 */
export const Ending = defineComponent<EndingProps>((props, lifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================
  const endingWrapRef: { current: HTMLDivElement | null } = { current: null };
  const endingPanelRef: { current: HTMLDivElement | null } = { current: null };
  const sharePanelRef: { current: HTMLDivElement | null } = { current: null };

  // ============================================
  // 方法
  // ============================================

  /**
   * 显示结尾面板
   */
  const showEndWrap = (): void => {
    endingWrapRef.current?.setAttribute('data-select', '1');
    lifecycle.emit?.('showEnd');
  };

  /**
   * 关闭结尾面板
   */
  const closeEndWrap = (): void => {
    endingWrapRef.current?.removeAttribute('data-select');
    lifecycle.emit?.('closeEnd');
  };

  /**
   * 显示分享面板
   */
  const showSharePanel = (): void => {
    endingWrapRef.current?.setAttribute('data-select', '2');
    lifecycle.emit?.('showShare');
  };

  /**
   * 关闭分享面板
   */
  const closeSharePanel = (): void => {
    endingWrapRef.current?.setAttribute('data-select', '1');
    lifecycle.emit?.('closeShare');
  };

  // ============================================
  // 渲染函数
  // ============================================

  /**
   * 渲染结尾内容
   */
  const renderEndingContent = (): VNode => {
    const upInfo = props.upInfo;
    const relatedVideo = props.relatedVideo;

    return h('div', { class: 'player-ending' },
      h('div', { class: 'player-ending-content', 'screen-mode': 'second-screen', style: { transform: 'scale(0.799718)' } },
        h('div', { class: 'player-ending-functions' },
          // UP主头像
          h('div', { class: 'player-ending-functions-avatar', 'data-action': 'upinfo' },
            h('a', { href: `//space.bilibili.com/${upInfo?.id || ''}`, target: '_blank' },
              h('img', { src: upInfo?.avatar || '' })
            )
          ),
          // UP主信息
          h('div', { class: 'player-ending-functions-upinfo', 'data-action': 'upinfo' },
            h('div', { class: 'player-ending-functions-name' },
              h('a', { href: `//space.bilibili.com/${upInfo?.id || ''}`, target: '_blank' }, upInfo?.name || '')
            ),
            h('div', { class: 'player-ending-functions-buttons' },
              h('div', { class: 'player-ending-functions-electric state-little' }),
              h('div', { class: 'player-ending-functions-follow', 'data-action': 'follow', onClick: props.onFollow },
                h('span', { class: 'common-svg-icon' }),
                `关注 ${upInfo?.followCount || 0}`
              )
            )
          ),
          // 功能按钮
          h('div', { class: 'player-ending-functions-common' },
            h('div', { class: 'player-ending-functions-btn', 'data-action': 'restart', onClick: props.onRestart },
              h('span', { class: 'common-svg-icon' }),
              '重播'
            ),
            h('div', { class: 'player-ending-functions-pagecallback' },
              h('div', { class: 'player-ending-functions-btn', 'data-action': 'grade' }),
              h('div', { class: 'player-ending-functions-btn state-active', 'data-action': 'like', onClick: props.onLike },
                h('span', { class: 'common-svg-icon' }),
                '好评'
              ),
              h('div', { class: 'player-ending-functions-btn', 'data-action': 'coin', onClick: props.onCoin },
                h('span', { class: 'common-svg-icon' }),
                '投币'
              ),
              h('div', { class: 'player-ending-functions-btn', 'data-action': 'collect', onClick: props.onCollect },
                h('span', { class: 'common-svg-icon' }),
                '收藏'
              ),
              h('div', { class: 'player-ending-functions-btn', 'data-action': 'share', onClick: () => { props.onShare?.(); showSharePanel(); } },
                h('span', { class: 'common-svg-icon' }),
                '分享'
              )
            )
          )
        ),
        // 相关视频
        relatedVideo ? h('div', { class: 'player-ending-related' },
          h('a', { class: 'player-ending-related-item' },
            h('div', { class: 'player-ending-related-item-img', style: { backgroundImage: `url(${relatedVideo.cover})` } }),
            h('div', { class: 'player-ending-related-item-cover' },
              h('div', { class: 'player-ending-related-item-title' }, relatedVideo.title),
              h('div', { class: 'player-ending-related-item-watchlater' }, h('i')),
              h('div', { class: 'player-ending-related-item-cancel', style: { display: 'none' } }, '取消连播'),
              h('div', { class: 'bpx-player-ending-related-item-countdown', style: { display: 'none' } })
            )
          )
        ) : null
      )
    );
  };

  /**
   * 渲染分享面板
   */
  const renderSharePanel = (): VNode => {
    return h('div', { class: 'player-video-share-box' },
      h('div', { class: 'player-video-share-header' },
        h('span', { class: 'player-video-share-close', onClick: () => { props.onCloseShare?.(); closeSharePanel(); } },
          h('span', { class: 'common-svg-icon' })
        )
      ),
      h('div', { class: 'player-video-share-content' },
        h('div', { class: 'player-video-share-left' },
          // 分享按钮
          h('div', { class: 'player-video-share-source' },
            h('div', { class: 'player-video-share-btn weibo' },
              h('span', { class: 'common-svg-icon' })
            ),
            h('div', { class: 'player-video-share-btn qq' },
              h('span', { class: 'common-svg-icon' })
            )
          ),
          // 视频地址
          h('div', { class: 'player-video-share-link' },
            h('p', { class: 'player-video-share-link-label' }, '视频地址'),
            h('div', { class: 'player-video-share-link-content' },
              h('input', { class: 'player-video-share-link-input html', value: props.videoUrl || '', readOnly: true }),
              h('div', { class: 'player-video-share-link-copy html ui ui-button', value: props.videoUrl || '', onClick: () => props.onCopyLink?.('html') },
                h('div', { class: 'ui-area ui-button-blue' }, '复制')
              )
            )
          ),
          // 嵌入代码
          h('div', { class: 'player-video-share-link' },
            h('p', { class: 'player-video-share-link-label' }, '嵌入代码'),
            h('div', { class: 'player-video-share-link-content' },
              h('input', { class: 'player-video-share-link-input iframe', value: props.iframeCode || '', readOnly: true }),
              h('div', { class: 'player-video-share-link-copy iframe ui ui-button', value: props.iframeCode || '', onClick: () => props.onCopyLink?.('iframe') },
                h('div', { class: 'ui-area ui-button-blue' }, '复制')
              )
            )
          )
        ),
        // 二维码
        h('div', { class: 'player-video-share-right' },
          h('div', { class: 'player-video-share-qrcode' },
            h('span', {}, '分享到微信'),
            h('span', { class: 'player-video-share-qrcode-img' },
              h('canvas', { width: 150, height: 150, 'data-qrcode': '[object Object]' })
            )
          )
        )
      )
    );
  };

  // ============================================
  // 生命周期
  // ============================================
  lifecycle.onMounted = (): void => {
    if (props.isOpen) {
      showEndWrap();
    }
  };

  // ============================================
  // 组件渲染
  // ============================================
  return h('div', { class: 'player-ending-wrap', ref: endingWrapRef },
    h('div', { class: 'player-ending-back' }),
    h('div', { class: 'player-ending-panel', 'data-option': '1', ref: endingPanelRef }, renderEndingContent()),
    h('div', { class: 'player-share-panel', 'data-option': '2', ref: sharePanelRef }, renderSharePanel())
  );
});
