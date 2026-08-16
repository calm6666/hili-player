/**
 * ============================================
 * VotePlugin — 投票子插件
 * ============================================
 * 渲染投票卡片到互动容器，支持投票选择与结果展示
 */

import type { InteractionSubPlugin, InteractionVote } from './types';
import { bindDragInEditMode } from './dragEditor';
import { isBrowser } from '@/utils';

// ============================================
// 类名常量
// ============================================

const CLASS_NAMES = {
  HL_VOTE: 'hl-vote',
  HL_CIRCLE: 'hl-circle',
  HL_VOTE_QUESTION: 'hl-vote-question',
  HL_VOTE_AN: 'hl-vote-an',
  HL_VOTE_AN_BG: 'hl-vote-an-bg',
  HL_VOTE_AN_BG_BUFFER: 'hl-vote-an-bg-buffer',
  HL_VOTE_AN_TEXT: 'hl-vote-an-text',
  HL_VOTE_AN_TEXT_INDEX: 'hl-vote-an-text-index',
  HL_VOTE_AN_TEXT_DOC: 'hl-vote-an-text-doc',
  HL_VOTE_AN_PERCENT: 'hl-vote-an-percent',
  HL_VOTE_AN_SELECTED: 'hl-vote-an-selected',
  HL_VOTE_AN_VOTED: 'hl-vote-an-voted',
  HL_HIDE: 'hl-hide',
  HL_CARD_HIDE: 'hl-card-hide',
} as const;

// ============================================
// 回调选项接口
// ============================================

interface VotePluginOptions {
  onVoteSelect?: (voteIndex: number, optionIndex: number) => void;
  isEdit?: boolean;
  index?: number;
}

// ============================================
// VotePlugin 实现
// ============================================

export class VotePlugin implements InteractionSubPlugin {
  readonly name = 'vote';
  readonly type = 'vote' as const;

  private item: InteractionVote;
  private element: HTMLDivElement | null = null;
  private options: VotePluginOptions;
  private dragCleanup: (() => void) | null = null;
  private lastCurrentTime = 0;
  private hasVoted = false;
  private selectedIndex = -1;

  constructor(item: InteractionVote, options?: VotePluginOptions) {
    this.item = item;
    this.options = options ?? {};
  }

  /**
   * 渲染投票卡片到容器
   */
  render(container: HTMLElement): void {
    if (!isBrowser()) return;

    const optionsHtml = this.item.options.map((opt, idx) => `
      <div class="${CLASS_NAMES.HL_VOTE_AN}" data-index="${idx}">
        <div class="${CLASS_NAMES.HL_VOTE_AN_BG}">
          <div class="${CLASS_NAMES.HL_VOTE_AN_BG_BUFFER}"></div>
        </div>
        <div class="${CLASS_NAMES.HL_VOTE_AN_TEXT}">
          <div class="${CLASS_NAMES.HL_VOTE_AN_TEXT_INDEX}">${String.fromCharCode(65 + idx)}</div>
          <div class="${CLASS_NAMES.HL_VOTE_AN_TEXT_DOC}">${opt.optionText}</div>
        </div>
        <div class="${CLASS_NAMES.HL_VOTE_AN_PERCENT}"></div>
      </div>
    `).join('');

    const html = `
      <div class="${CLASS_NAMES.HL_VOTE}" style="--top: ${this.item.top}%; --left: ${this.item.left}%;">
        <span class="${CLASS_NAMES.HL_CIRCLE}"></span>
        <div class="${CLASS_NAMES.HL_VOTE_QUESTION}">${this.item.question}</div>
        ${optionsHtml}
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
   * 绑定选项点击事件和关闭按钮事件
   */
  private bindClickEvents(): void {
    if (!this.element) return;

    // 绑定选项点击事件
    const optionElements = this.element.querySelectorAll(`.${CLASS_NAMES.HL_VOTE_AN}`);
    optionElements.forEach((optEl, idx): void => {
      optEl.addEventListener('click', (e: Event): void => {
        e.stopPropagation();
        if (this.hasVoted) return;

        this.selectedIndex = idx;
        this.hasVoted = true;

        // 增加选中选项的投票数
        if (this.item.options[idx].votes === undefined) {
          this.item.options[idx].votes = 0;
        }
        this.item.options[idx].votes! += 1;

        // 显示投票结果
        this.showVoteResult();

        // 触发回调
        const voteIndex = this.options.index ?? 0;
        this.options.onVoteSelect?.(voteIndex, idx);
      });
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
   * 显示投票结果，更新进度条和百分比
   */
  private showVoteResult(): void {
    if (!this.element) return;

    // 计算总票数
    let totalVotes = 0;
    this.item.options.forEach((opt): void => {
      totalVotes += opt.votes ?? 0;
    });

    if (totalVotes === 0) return;

    // 标记已投票状态
    this.element.classList.add(CLASS_NAMES.HL_VOTE_AN_VOTED);

    // 更新每个选项的进度条和百分比
    const optionElements = this.element.querySelectorAll(`.${CLASS_NAMES.HL_VOTE_AN}`);
    optionElements.forEach((optEl, idx): void => {
      const votes = this.item.options[idx].votes ?? 0;
      const percent = Math.round((votes / totalVotes) * 100);

      // 更新进度条宽度
      const buffer = optEl.querySelector(`.${CLASS_NAMES.HL_VOTE_AN_BG_BUFFER}`);
      if (buffer instanceof HTMLElement) {
        buffer.style.width = `${percent}%`;
      }

      // 更新百分比文本
      const percentEl = optEl.querySelector(`.${CLASS_NAMES.HL_VOTE_AN_PERCENT}`);
      if (percentEl instanceof HTMLElement) {
        percentEl.textContent = `${percent}%`;
      }

      // 标记选中项
      if (idx === this.selectedIndex) {
        optEl.classList.add(CLASS_NAMES.HL_VOTE_AN_SELECTED);
      }
    });
  }

  /**
   * 关闭卡片
   */
  close(): void {
    this.item.isClose = true;
    this.item.closeTime = this.lastCurrentTime;
    this.element?.classList.add(CLASS_NAMES.HL_CARD_HIDE);
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
