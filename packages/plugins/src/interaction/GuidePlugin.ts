/**
 * ============================================
 * GuidePlugin — 点赞关注子插件
 * ============================================
 * 渲染点赞/投币/收藏/关注卡片到互动容器
 */

import type { InteractionSubPlugin, InteractionGuideThree } from './types';
import { bindDragInEditMode } from './dragEditor';
import { isBrowser } from '@/utils';

// ============================================
// 图标定义（使用简单SVG字符串）
// ============================================

const FillLikeIcon = '<svg viewBox="0 0 28 28"><path d="M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4z"/></svg>';
const FillCoinIcon = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="10"/></svg>';
const FillCollectIcon = '<svg viewBox="0 0 28 28"><path d="M14 2l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z"/></svg>';
const PlusIcon = '<svg viewBox="0 0 28 28"><path d="M14 2v24M2 14h24"/></svg>';

// ============================================
// 类名常量
// ============================================

const CLASS_NAMES = {
  HL_GUIDE: 'hl-guide',
  HL_GUIDE_THREE: 'hl-guide-three',
  HL_GUIDE_THREE_LIKE: 'hl-guide-three-like',
  HL_GUIDE_THREE_COIN: 'hl-guide-three-coin',
  HL_GUIDE_THREE_COLLECT: 'hl-guide-three-collect',
  HL_GUIDE_FOLLOW: 'hl-guide-follow',
  HL_GUIDE_FOLLOW_0: 'hl-guide-follow-0',
  HL_GUIDE_FOLLOW_1: 'hl-guide-follow-1',
  HL_EDITOR: 'hl-editor',
  HL_EDITOR_NO_GUIDE_THREE: 'hl-editor-no-guide-three',
  HL_EDITOR_NO_FOLLOW: 'hl-editor-no-follow',
  IS_ACTIVE: 'is_active',
  NO_FOLLOW: 'no-follow',
  HL_HIDE: 'hl-hide',
  HL_CARD_HIDE: 'hl-card-hide',
} as const;

// ============================================
// 回调选项接口
// ============================================

interface GuidePluginOptions {
  onLike?: () => void;
  onCoin?: () => void;
  onCollect?: () => void;
  onFollow?: () => void;
  isEdit?: boolean;
}

// ============================================
// GuidePlugin 实现
// ============================================

export class GuidePlugin implements InteractionSubPlugin {
  readonly name = 'guide';
  readonly type = 'guide' as const;

  private item: InteractionGuideThree;
  private element: HTMLDivElement | null = null;
  private options: GuidePluginOptions;
  private dragCleanup: (() => void) | null = null;
  private lastCurrentTime = 0;
  private closeTime: number | undefined;
  private isClose = false;

  constructor(item: InteractionGuideThree, options?: GuidePluginOptions) {
    this.item = item;
    this.options = options ?? {};
  }

  /**
   * 构建根元素类名，根据 type 决定是否隐藏三连或关注区域
   */
  private buildClassName(): string {
    let className = `${CLASS_NAMES.HL_GUIDE} ${CLASS_NAMES.HL_CARD_HIDE}`;
    if (this.options.isEdit) {
      className += ` ${CLASS_NAMES.HL_EDITOR}`;
    }
    if (this.item.type === 2) {
      className += ` ${CLASS_NAMES.HL_EDITOR_NO_FOLLOW}`;
    } else if (this.item.type === 3) {
      className += ` ${CLASS_NAMES.HL_EDITOR_NO_GUIDE_THREE}`;
    }
    return className;
  }

  /**
   * 渲染点赞关注卡片到容器
   */
  render(container: HTMLElement): void {
    if (!isBrowser()) return;

    const className = this.buildClassName();
    const html = `
      <div class="${className}" style="--top: ${this.item.top}%; --left: ${this.item.left}%;">
        <div class="${CLASS_NAMES.HL_GUIDE_THREE}">
          <span class="${CLASS_NAMES.HL_GUIDE_THREE_LIKE} ${CLASS_NAMES.IS_ACTIVE}">
            ${FillLikeIcon}
          </span>
          <span class="${CLASS_NAMES.HL_GUIDE_THREE_COIN}">
            ${FillCoinIcon}
          </span>
          <span class="${CLASS_NAMES.HL_GUIDE_THREE_COLLECT}">
            ${FillCollectIcon}
          </span>
        </div>
        <div class="${CLASS_NAMES.HL_GUIDE_FOLLOW} ${CLASS_NAMES.NO_FOLLOW}">
          <span class="${CLASS_NAMES.HL_GUIDE_FOLLOW_0}">
            ${PlusIcon}
            <span>关注</span>
          </span>
          <span class="${CLASS_NAMES.HL_GUIDE_FOLLOW_1}">已关注</span>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const firstChild = wrapper.firstChild;
    if (firstChild instanceof HTMLDivElement) {
      this.element = firstChild;
    } else {
      this.element = document.createElement('div');
    }

    container.appendChild(this.element);

    this.bindClickEvents();

    if (this.options.isEdit && this.element) {
      this.dragCleanup = bindDragInEditMode(this.element, (top: number, left: number): void => {
        this.item.top = top;
        this.item.left = left;
      });
    }
  }

  /**
   * 绑定点赞/投币/收藏/关注点击事件
   */
  private bindClickEvents(): void {
    if (!this.element) return;

    const likeBtn = this.element.querySelector(`.${CLASS_NAMES.HL_GUIDE_THREE_LIKE}`);
    const coinBtn = this.element.querySelector(`.${CLASS_NAMES.HL_GUIDE_THREE_COIN}`);
    const collectBtn = this.element.querySelector(`.${CLASS_NAMES.HL_GUIDE_THREE_COLLECT}`);
    const followBtn = this.element.querySelector(`.${CLASS_NAMES.HL_GUIDE_FOLLOW_0}`);

    likeBtn?.addEventListener('click', (e: Event): void => {
      e.stopPropagation();
      likeBtn.classList.toggle(CLASS_NAMES.IS_ACTIVE);
      this.options.onLike?.();
    });

    coinBtn?.addEventListener('click', (e: Event): void => {
      e.stopPropagation();
      coinBtn.classList.toggle(CLASS_NAMES.IS_ACTIVE);
      this.options.onCoin?.();
    });

    collectBtn?.addEventListener('click', (e: Event): void => {
      e.stopPropagation();
      collectBtn.classList.toggle(CLASS_NAMES.IS_ACTIVE);
      this.options.onCollect?.();
    });

    followBtn?.addEventListener('click', (e: Event): void => {
      e.stopPropagation();
      const followWrap = this.element?.querySelector(`.${CLASS_NAMES.HL_GUIDE_FOLLOW}`);
      if (followWrap) {
        followWrap.classList.toggle(CLASS_NAMES.NO_FOLLOW);
      }
      this.options.onFollow?.();
    });
  }

  /**
   * 关闭卡片（外部调用）
   */
  close(): void {
    this.isClose = true;
    this.closeTime = this.lastCurrentTime;
    this.element?.classList.add(CLASS_NAMES.HL_CARD_HIDE);
  }

  /**
   * 根据当前时间控制卡片显示/隐藏，包含 closeTime 逻辑
   */
  updateTime(currentTime: number): void {
    if (!this.element) return;

    this.lastCurrentTime = currentTime;

    // 处理关闭时间逻辑：如果当前时间已超过关闭时间，重置关闭状态
    if (this.closeTime !== undefined && this.closeTime > currentTime) {
      this.isClose = false;
    }

    // 如果已关闭且未超过关闭时间，跳过显示
    if (this.closeTime !== undefined && this.closeTime <= currentTime && this.isClose === true) {
      return;
    }

    const { timeStart, timeEnd } = this.item;
    if (timeStart === undefined || timeEnd === undefined) return;

    if (currentTime < timeEnd && timeStart <= currentTime) {
      // 在显示时间范围内：完全显示
      this.element.classList.remove(CLASS_NAMES.HL_CARD_HIDE, CLASS_NAMES.HL_HIDE);
    } else if (timeEnd - 0.6 <= currentTime && timeEnd + 0.6 > currentTime) {
      // 在消失动画时间内：显示消失动画
      this.element.classList.remove(CLASS_NAMES.HL_CARD_HIDE);
      this.element.classList.add(CLASS_NAMES.HL_HIDE);
    } else if (currentTime < timeStart - 0.6 || timeEnd + 0.6 < currentTime) {
      // 在显示范围外：完全隐藏
      this.element.classList.remove(CLASS_NAMES.HL_HIDE);
      this.element.classList.add(CLASS_NAMES.HL_CARD_HIDE);
    }
  }

  /**
   * 销毁卡片，移除DOM元素并清理引用
   */
  destroy(): void {
    if (this.dragCleanup) {
      this.dragCleanup();
      this.dragCleanup = null;
    }
    if (this.element?.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}
