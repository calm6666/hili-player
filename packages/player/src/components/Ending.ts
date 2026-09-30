/**
 * ============================================
 * 结尾组件 (Ending)
 * ============================================
 * 视频播放结束后展示的结尾面板，包含 UP 主信息、互动按钮、相关视频和分享功能
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { VNode } from '@/types';

/**
 * Ending 组件 Props 接口
 * 定义结尾面板所需的属性和回调
 */
export interface EndingProps {
  /** 是否打开结尾面板 */
  isOpen?: boolean;
  /** UP 主信息，包含头像、昵称、粉丝数等 */
  upInfo?: {
    /** UP 主的用户 ID */
    id: string;
    /** UP 主的昵称 */
    name: string;
    /** UP 主的头像 URL */
    avatar: string;
    /** UP 主的粉丝数 */
    followCount: number;
  };
  /** 相关推荐视频信息 */
  relatedVideo?: {
    /** 推荐视频标题 */
    title: string;
    /** 推荐视频封面图 URL */
    cover: string;
    /** 推荐视频的 BV 号 */
    bvid: string;
  };
  /** 当前视频的 BV 号 */
  bvid?: string;
  /** 视频分享链接地址 */
  videoUrl?: string;
  /** 视频嵌入代码（iframe） */
  iframeCode?: string;
  /** 点击重播按钮时的回调 */
  onRestart?: () => void;
  /** 点击关注按钮时的回调 */
  onFollow?: () => void;
  /** 点击点赞按钮时的回调 */
  onLike?: () => void;
  /** 点击投币按钮时的回调 */
  onCoin?: () => void;
  /** 点击收藏按钮时的回调 */
  onCollect?: () => void;
  /** 点击分享按钮时的回调 */
  onShare?: () => void;
  /** 关闭分享面板时的回调 */
  onCloseShare?: () => void;
  /** 复制链接时的回调，type 区分复制视频地址还是嵌入代码 */
  onCopyLink?: (type: 'html' | 'iframe') => void;
}

/**
 * 结尾组件
 * 视频播放结束后展示结尾面板，支持 UP 主信息展示、互动操作、相关视频推荐和分享功能
 */
export const Ending = defineComponent<EndingProps>((props, lifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================

  /** 结尾面板外层容器 DOM 引用，通过 data-select 属性控制显示哪个子面板 */
  const endingWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'endingWrapRef');

  // ============================================
  // 方法
  // ============================================

  /** 显示结尾面板，将 data-select 设为 "1" 切换到结尾内容视图 */
  const showEndWrap = (): void => {
    endingWrapRef.value?.setAttribute('data-select', '1');
    lifecycle.emit?.('showEnd');
  };

  /** 显示分享面板，将 data-select 设为 "2" 切换到分享视图 */
  const showSharePanel = (): void => {
    endingWrapRef.value?.setAttribute('data-select', '2');
    lifecycle.emit?.('showShare');
  };

  /** 关闭分享面板，将 data-select 恢复为 "1" 回到结尾内容视图 */
  const closeSharePanel = (): void => {
    endingWrapRef.value?.setAttribute('data-select', '1');
    lifecycle.emit?.('closeShare');
  };

  // ============================================
  // 渲染函数
  // ============================================

  /** 渲染结尾内容面板，包含 UP 主信息、互动按钮和相关推荐视频 */
  const renderEndingContent = (): VNode => {
    /** UP 主信息数据 */
    const upInfo = props.upInfo;
    /** 相关推荐视频数据 */
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

  /** 渲染分享面板，包含社交分享按钮、视频地址复制和嵌入代码复制 */
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
              h('div', { class: 'player-video-share-link-copy html ui ui-button', 'data-copy-value': props.videoUrl || '', onClick: () => props.onCopyLink?.('html') },
                h('div', { class: 'ui-area ui-button-blue' }, '复制')
              )
            )
          ),
          // 嵌入代码
          h('div', { class: 'player-video-share-link' },
            h('p', { class: 'player-video-share-link-label' }, '嵌入代码'),
            h('div', { class: 'player-video-share-link-content' },
              h('input', { class: 'player-video-share-link-input iframe', value: props.iframeCode || '', readOnly: true }),
              h('div', { class: 'player-video-share-link-copy iframe ui ui-button', 'data-copy-value': props.iframeCode || '', onClick: () => props.onCopyLink?.('iframe') },
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

  /** 组件挂载后，如果 isOpen 为 true 则自动显示结尾面板 */
  lifecycle.onMounted = (): void => {
    if (props.isOpen) {
      showEndWrap();
    }
  };

  // ============================================
  // 组件渲染
  // ============================================

  return h('div', { class: 'player-ending-wrap', ref: 'endingWrapRef' },
    h('div', { class: 'player-ending-back' }),
    h('div', { class: 'player-ending-panel', 'data-option': '1' }, renderEndingContent()),
    h('div', { class: 'player-share-panel', 'data-option': '2' }, renderSharePanel())
  );
});
