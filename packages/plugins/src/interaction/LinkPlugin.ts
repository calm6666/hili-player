/**
 * ============================================
 * LinkPlugin — 外链子插件
 * ============================================
 * 渲染外链视频卡片到互动容器
 */

import type { InteractionSubPlugin, InteractionLink } from './types';
import { bindDragInEditMode } from './dragEditor';
import { isBrowser } from '@/utils';

// ============================================
// 图标定义
// ============================================

const SeeLaterIcon = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="10"/><path d="M14 8v6l4 2"/></svg>';

// ============================================
// 类名常量
// ============================================

const CLASS_NAMES = {
  HL_LINK: 'hl-link',
  HL_CIRCLE: 'hl-circle',
  HL_LINK_LEFT: 'hl-link-left',
  HL_LINK_ICON: 'hl-link-icon',
  HL_LINK_MSG: 'hl-link-msg',
  HL_LINK_LINE: 'hl-link-line',
  HL_LINK_RIGHT: 'hl-link-right',
  HL_LINK_WATCHLATER: 'hl-link-watchlater',
  HL_LINK_WATCHLATER_ICON: 'hl-link-watchlater-icon',
  HL_HIDE: 'hl-hide',
  HL_CARD_HIDE: 'hl-card-hide',
} as const;

// ============================================
// 回调选项接口
// ============================================

interface LinkPluginOptions {
  onLinkClick?: (link: InteractionLink) => void;
  onWatchLater?: () => void;
  /** 卡片关闭回调（关闭按钮点击后触发） */
  onClose?: () => void;
  isEdit?: boolean;
}

// ============================================
// LinkPlugin 实现
// ============================================

export class LinkPlugin implements InteractionSubPlugin {
  readonly name = 'link';
  readonly type = 'link' as const;

  private item: InteractionLink;
  private element: HTMLDivElement | null = null;
  private options: LinkPluginOptions;
  private dragCleanup: (() => void) | null = null;
  private lastCurrentTime = 0;

  constructor(item: InteractionLink, options?: LinkPluginOptions) {
    this.item = item;
    this.options = options ?? {};
  }

  /**
   * 渲染外链视频卡片到容器
   */
  render(container: HTMLElement): void {
    if (!isBrowser()) return;

    const html = `
      <div class="${CLASS_NAMES.HL_LINK} ${CLASS_NAMES.HL_CARD_HIDE}" style="--top: ${this.item.top}%; --left: ${this.item.left}%;">
        <span class="${CLASS_NAMES.HL_CIRCLE}"></span>
        <div class="${CLASS_NAMES.HL_LINK_LEFT}">
          <div class="${CLASS_NAMES.HL_LINK_ICON}"></div>
          <div class="${CLASS_NAMES.HL_LINK_MSG}">${this.item.link_content || '这是一个什么视频'}</div>
        </div>
        <div class="${CLASS_NAMES.HL_LINK_LINE}"></div>
        <div class="${CLASS_NAMES.HL_LINK_RIGHT}">
          <div class="${CLASS_NAMES.HL_LINK_WATCHLATER}">
            <span class="${CLASS_NAMES.HL_LINK_WATCHLATER_ICON}">${SeeLaterIcon}</span>
            <span>稍后再看</span>
          </div>
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
   * 绑定链接点击和稍后再看点击事件
   */
  private bindClickEvents(): void {
    if (!this.element) return;

    // 链接左侧点击事件
    const linkLeft = this.element.querySelector(`.${CLASS_NAMES.HL_LINK_LEFT}`);
    linkLeft?.addEventListener('click', (e: Event): void => {
      e.stopPropagation();
      this.options.onLinkClick?.(this.item);
    });

    // 稍后再看点击事件
    const watchlaterBtn = this.element.querySelector(`.${CLASS_NAMES.HL_LINK_WATCHLATER}`);
    watchlaterBtn?.addEventListener('click', (e: Event): void => {
      e.stopPropagation();
      this.options.onWatchLater?.();
    });

    // 关闭按钮事件（非编辑模式下）
    if (!this.options.isEdit) {
      const closeBtn = this.element.querySelector(`.${CLASS_NAMES.HL_CIRCLE}`);
      closeBtn?.addEventListener('click', (e: Event): void => {
        e.stopPropagation();
        this.close();
      });
    }
  }

  /**
   * 关闭卡片
   */
  close(): void {
    this.item.isClose = true;
    this.item.closeTime = this.lastCurrentTime;
    this.element?.classList.add(CLASS_NAMES.HL_CARD_HIDE);
    // 通知外部卡片已关闭
    this.options.onClose?.();
  }

  /**
   * 根据当前时间控制卡片显示/隐藏，包含 closeTime 逻辑
   */
  updateTime(currentTime: number): void {
    if (!this.element) return;

    this.lastCurrentTime = currentTime;

    // 处理关闭时间逻辑：如果当前时间已超过关闭时间，重置关闭状态
    if (this.item.closeTime !== undefined && this.item.closeTime > currentTime) {
      this.item.isClose = false;
    }

    // 如果已关闭且未超过关闭时间，跳过显示
    if (this.item.closeTime !== undefined && this.item.closeTime <= currentTime && this.item.isClose === true) {
      return;
    }

    const { timeStart, timeEnd } = this.item;
    if (timeStart === undefined || timeEnd === undefined) return;

    if (currentTime < timeEnd && timeStart <= currentTime) {
      this.element.classList.remove(CLASS_NAMES.HL_CARD_HIDE, CLASS_NAMES.HL_HIDE);
    } else if (timeEnd - 0.6 <= currentTime && timeEnd + 0.6 > currentTime) {
      this.element.classList.remove(CLASS_NAMES.HL_CARD_HIDE);
      this.element.classList.add(CLASS_NAMES.HL_HIDE);
    } else if (currentTime < timeStart - 0.6 || timeEnd + 0.6 < currentTime) {
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
