/**
 * ============================================
 * 片尾推荐面板组件 (Ending)
 * ============================================
 *
 * DOM 结构与 CSS 类名与既有实现保持一致：
 *   .player-ending-wrap（data-select="1" 显示片尾面板 / "2" 显示分享面板）
 *     .player-ending-backdrop
 *     .player-ending-panel[data-option="1"]
 *       .player-ending
 *         .player-ending-content[screen-mode="second-screen"]
 *           .player-ending-functions（UP 主信息 + 重播/好评/投币/收藏/分享按钮）
 *           .player-ending-related（相关推荐列表容器）
 *     .player-share-panel[data-option="2"]
 *       .player-video-share-box（分享面板）
 *
 * 显隐由根节点 data-select 属性配合 CSS 控制（基态 visibility: hidden）。
 * 相关推荐列表没有真实数据源，仅渲染容器结构、列表为空，不臆造数据。
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import type { VNode } from '@/types';

/**
 * Ending 组件 Props 接口
 */
export interface EndingProps {
  /** 点击重播按钮时的回调 */
  onRestart?: () => void;
  /** 点击关注按钮时的回调 */
  onFollow?: () => void;
  /** 点击点赞（好评）按钮时的回调 */
  onLike?: () => void;
  /** 点击投币按钮时的回调 */
  onCoin?: () => void;
  /** 点击收藏按钮时的回调 */
  onCollect?: () => void;
  /** 点击分享按钮时的回调（内部会切换到分享面板） */
  onShare?: () => void;
  /** 关闭分享面板时的回调（内部会回到片尾面板） */
  onCloseShare?: () => void;
}

/**
 * 片尾面板对外暴露的 API
 */
export interface EndingApi {
  /** 显示片尾面板（data-select="1"） */
  showEndWrap: () => void;
  /** 关闭片尾面板（移除 data-select） */
  closeEndWrap: () => void;
  /** 显示分享面板（data-select="2"） */
  showShareWrap: () => void;
  /** 关闭分享面板（回到片尾面板 data-select="1"） */
  closeShareWrap: () => void;
}

/** 通用装饰图标（静态 SVG，与既有实现的静态图标一致；控制栏图标不在此列） */
const SimpleIcon = (path: string): VNode =>
  h(
    'svg',
    { viewBox: '0 0 1024 1024', version: '1.1', xmlns: 'http://www.w3.org/2000/svg' },
    h('path', { d: path }),
  );

/** 关注（加号）图标 */
const ADD_ICON =
  'M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m224 480H544v192a32 32 0 0 1-64 0V544H288a32 32 0 0 1 0-64h192V288a32 32 0 0 1 64 0v192h192a32 32 0 0 1 0 64z';
/** 重播图标 */
const RESTART_ICON =
  'M512 128c-106 0-202 46.4-267.8 120L160 163.8V384h220.2l-90.5-90.5C344.6 240 424.6 208 512 208c167.6 0 304 136.4 304 304s-136.4 304-304 304-304-136.4-304-304h-80c0 212 172 384 384 384s384-172 384-384S724 128 512 128z';
/** 点赞图标 */
const LIKE_ICON =
  'M885.9 533.7c16.8-22.2 26.1-49.4 26.1-77.7 0-44.9-25.1-87.4-65.5-111.1a67.67 67.67 0 0 0-34.3-9.3H572.4l6-122.9c1.4-29.7-9.1-57.9-29.5-79.4A106.62 106.62 0 0 0 468.9 96c-28.1 0-53.6 13.4-68.9 35.9L224 471.4v493.8c0 32.1 26.1 58.2 58.2 58.2h458.9c22.7 0 43.1-13.5 52-34.3l101.9-230.6c2.9-6.7 4.5-13.9 4.5-21.1V576c0-15.2-4.5-29.7-13.6-42.3z';
/** 投币图标 */
const COIN_ICON =
  'M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z m48-532v96h-96v-96c0-26.5-21.5-48-48-48s-48 21.5-48 48v96h-32c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32h32v64h-32c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32h32v96c0 26.5 21.5 48 48 48s48-21.5 48-48v-96h96v96c0 26.5 21.5 48 48 48s48-21.5 48-48v-96h32c17.7 0 32-14.3 32-32v-64c0-17.7-14.3-32-32-32h-32v-64h32c17.7 0 32-14.3 32-32v-64c0-17.7-14.3-32-32-32h-32v-96c0-26.5-21.5-48-48-48s-48 21.5-48 48z';
/** 收藏图标 */
const COLLECT_ICON =
  'M908.1 353.1l-253.9-36.9L540.7 86.1c-3.1-6.3-8.2-11.4-14.5-14.5-15.8-7.8-35-1.3-42.9 14.5L369.8 316.2l-253.9 36.9c-7 1-13.4 3.8-18.5 8.2-12.8 11.8-13.6 31.8-1.8 44.6l185.1 180.4-43.7 254.1c-1.2 7-0.5 14.2 2.1 20.7 6.1 15.4 23.6 23 39 16.9L512 754.3l227.7 119.7c6.5 3.4 14 4.4 21 3.1 16.9-3.2 28-19.5 24.8-36.4l-43.7-254.1 184.6-179.9c5.1-4.9 8.6-11.3 9.7-18.3 2.6-16.9-8.9-32.6-26-35.3z';
/** 分享图标 */
const SHARE_ICON =
  'M725.3 128a106.7 106.7 0 1 1-88.1 166.5L401.1 425.9a106.8 106.8 0 0 1 0 172.2l236.1 131.4A106.7 106.7 0 1 1 618.7 768c0-6.2 0.5-12.3 1.5-18.2L384.1 618.4a106.7 106.7 0 1 1 0-212.8l236.1-131.4c-1-5.9-1.5-12-1.5-18.2A106.7 106.7 0 0 1 725.3 128z';
/** 关闭图标 */
const CLOSE_ICON =
  'M512 444.16l297.088-297.088c17.088-17.152 46.208-15.872 64.96 2.88 18.752 18.752 20.032 47.872 2.88 64.96L579.904 512l297.024 297.088c17.152 17.088 15.872 46.208-2.88 64.96-18.752 18.752-47.872 20.032-64.96 2.88L512 579.904l-297.088 297.024c-17.088 17.152-46.208 15.872-64.96-2.88-18.752-18.752-20.032-47.872-2.88-64.96L444.096 512 147.072 214.912c-17.152-17.088-15.872-46.208 2.88-64.96 18.752-18.752 47.872-20.032 64.96-2.88L512 444.096z';

/**
 * 片尾推荐面板组件
 */
export const Ending = defineComponent<EndingProps>((props, lifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================

  /** 片尾面板外层容器 DOM 引用，通过 data-select 属性控制显示哪个子面板 */
  const endingWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'endingWrapRef');

  // ============================================
  // 面板显隐（data-select 属性机制，与既有实现一致）
  // ============================================

  /** 显示片尾面板（data-select="1"） */
  const showEndWrap = (): void => {
    endingWrapRef.value?.setAttribute('data-select', '1');
  };

  /** 关闭片尾面板（移除 data-select） */
  const closeEndWrap = (): void => {
    endingWrapRef.value?.removeAttribute('data-select');
  };

  /** 显示分享面板（data-select="2"） */
  const showShareWrap = (): void => {
    endingWrapRef.value?.setAttribute('data-select', '2');
  };

  /** 关闭分享面板，回到片尾面板（data-select="1"） */
  const closeShareWrap = (): void => {
    endingWrapRef.value?.setAttribute('data-select', '1');
  };

  // ============================================
  // 渲染函数
  // ============================================

  /** 渲染片尾内容面板（结构与既有实现一致；无真实数据源时相关列表为空） */
  const renderEndingContent = (): VNode =>
    h('div', { class: 'player-ending' },
      h('div', {
        class: 'player-ending-content',
        'screen-mode': 'second-screen',
      },
        h('div', { class: 'player-ending-functions' },
          // UP 主头像（无真实数据源，仅保留结构）
          h('div', { class: 'player-ending-functions-avatar', 'data-action': 'upinfo' },
            h('a', {}, h('img', {})),
          ),
          // UP 主信息
          h('div', { class: 'player-ending-functions-upinfo', 'data-action': 'upinfo' },
            h('div', { class: 'player-ending-functions-name' }, h('a', {})),
            h('div', { class: 'player-ending-functions-buttons' },
              h('div', { class: 'player-ending-functions-electric state-little' }),
              h('div', {
                class: 'player-ending-functions-follow',
                'data-action': 'follow',
                onClick: props.onFollow,
              },
                h('span', { class: 'common-svg-icon' }, SimpleIcon(ADD_ICON)),
                '关注',
              ),
            ),
          ),
          // 功能按钮
          h('div', { class: 'player-ending-functions-common' },
            h('div', {
              class: 'player-ending-functions-btn',
              'data-action': 'restart',
              onClick: props.onRestart,
            },
              h('span', { class: 'common-svg-icon' }, SimpleIcon(RESTART_ICON)),
              '重播',
            ),
            h('div', { class: 'player-ending-functions-pagecallback' },
              h('div', { class: 'player-ending-functions-btn', 'data-action': 'grade' }),
              h('div', {
                class: 'player-ending-functions-btn state-active',
                'data-action': 'like',
                onClick: props.onLike,
              },
                h('span', { class: 'common-svg-icon' }, SimpleIcon(LIKE_ICON)),
                '好评',
              ),
              h('div', {
                class: 'player-ending-functions-btn',
                'data-action': 'coin',
                onClick: props.onCoin,
              },
                h('span', { class: 'common-svg-icon' }, SimpleIcon(COIN_ICON)),
                '投币',
              ),
              h('div', {
                class: 'player-ending-functions-btn',
                'data-action': 'collect',
                onClick: props.onCollect,
              },
                h('span', { class: 'common-svg-icon' }, SimpleIcon(COLLECT_ICON)),
                '收藏',
              ),
              h('div', {
                class: 'player-ending-functions-btn',
                'data-action': 'share',
                onClick: () => {
                  props.onShare?.();
                  showShareWrap();
                },
              },
                h('span', { class: 'common-svg-icon' }, SimpleIcon(SHARE_ICON)),
                '分享',
              ),
            ),
          ),
        ),
        // 相关推荐列表（无真实数据源，仅渲染容器结构、列表为空）
        h('div', { class: 'player-ending-related' }),
      ),
    );

  /** 渲染分享面板（结构与既有实现一致；分享地址无真实数据源，值为空） */
  const renderSharePanel = (): VNode =>
    h('div', { class: 'player-video-share-box' },
      h('div', { class: 'player-video-share-header' },
        h('span', {
          class: 'player-video-share-close',
          onClick: () => {
            props.onCloseShare?.();
            closeShareWrap();
          },
        },
          h('span', { class: 'common-svg-icon' }, SimpleIcon(CLOSE_ICON)),
        ),
      ),
      h('div', { class: 'player-video-share-content' },
        h('div', { class: 'player-video-share-left' },
          // 分享渠道按钮
          h('div', { class: 'player-video-share-source' },
            h('div', { class: 'player-video-share-btn weibo' },
              h('span', { class: 'common-svg-icon' }),
            ),
            h('div', { class: 'player-video-share-btn qq' },
              h('span', { class: 'common-svg-icon' }),
            ),
          ),
          // 视频地址
          h('div', { class: 'player-video-share-link' },
            h('p', { class: 'player-video-share-link-label' }, '视频地址'),
            h('div', { class: 'player-video-share-link-content' },
              h('input', { class: 'player-video-share-link-input html', readOnly: true }),
              h('div', {
                class: 'player-video-share-link-copy html ui ui-button',
                onClick: (event: MouseEvent) => {
                  if (event.currentTarget instanceof HTMLElement) {
                    /** 待复制的视频地址 */
                    const value = event.currentTarget.getAttribute('value') ?? '';
                    if (navigator.clipboard) {
                      void navigator.clipboard.writeText(value);
                    }
                  }
                },
              },
                h('div', { class: 'ui-area ui-button-blue' }, '复制'),
              ),
            ),
          ),
          // 嵌入代码
          h('div', { class: 'player-video-share-link' },
            h('p', { class: 'player-video-share-link-label' }, '嵌入代码'),
            h('div', { class: 'player-video-share-link-content' },
              h('input', { class: 'player-video-share-link-input iframe', readOnly: true }),
              h('div', {
                class: 'player-video-share-link-copy iframe ui ui-button',
                onClick: (event: MouseEvent) => {
                  if (event.currentTarget instanceof HTMLElement) {
                    /** 待复制的嵌入代码 */
                    const value = event.currentTarget.getAttribute('value') ?? '';
                    if (navigator.clipboard) {
                      void navigator.clipboard.writeText(value);
                    }
                  }
                },
              },
                h('div', { class: 'ui-area ui-button-blue' }, '复制'),
              ),
            ),
          ),
        ),
        // 二维码
        h('div', { class: 'player-video-share-right' },
          h('div', { class: 'player-video-share-qrcode' },
            h('span', {}, '分享到微信'),
            h('span', { class: 'player-video-share-qrcode-img' },
              h('canvas', { width: 150, height: 150 }),
            ),
          ),
        ),
      ),
    );

  // ============================================
  // 生命周期
  // ============================================

  /** 组件挂载后，通过事件向外暴露面板显隐控制方法 */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('endingMounted', {
      showEndWrap,
      closeEndWrap,
      showShareWrap,
      closeShareWrap,
    } satisfies EndingApi);
  };

  // ============================================
  // 组件渲染（DOM 结构与既有实现一致）
  // ============================================

  return h('div', { class: 'player-ending-wrap', ref: 'endingWrapRef' },
    h('div', { class: 'player-ending-backdrop' }),
    h('div', { class: 'player-ending-panel', 'data-option': '1' }, renderEndingContent()),
    h('div', { class: 'player-share-panel', 'data-option': '2' }, renderSharePanel()),
  );
});
