/**
 * ============================================
 * ScorePlugin — 评分子插件
 * ============================================
 * 渲染评分卡片到互动容器，支持评分选择与结果展示
 */

import type { InteractionSubPlugin, InteractionScore, InteractionType } from './types';
import { bindDragInEditMode } from './dragEditor';
import { isBrowser } from '@/utils';

// ============================================
// 图标定义
// ============================================

const StarIcon = '<svg viewBox="0 0 28 28"><path d="M14 2l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z"/></svg>';
const LoveIcon = '<svg viewBox="0 0 28 28"><path d="M14 26s-9-6-9-13a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13z"/></svg>';
const LemonIcon = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="10"/></svg>';

// ============================================
// 类名常量
// ============================================

const CLASS_NAMES = {
  HL_SCORE: 'hl-score',
  HL_CIRCLE: 'hl-circle',
  HL_SCORE_TITLE: 'hl-score-title',
  HL_SCORE_AREA: 'hl-score-area',
  HL_SCORE_AREA_ITEM: 'hl-score-area-item',
  HL_SCORE_AREA_ITEM_ACTIVE: 'hl-score-area-item-active',
  HL_SCORE_RESULT: 'hl-score-result',
  HL_SCORE_COUNT: 'hl-score-count',
  HL_SCORE_VOTED: 'hl-score-voted',
  HL_HIDE: 'hl-hide',
  HL_CARD_HIDE: 'hl-card-hide',
} as const;

// ============================================
// 回调选项接口
// ============================================

interface ScorePluginOptions {
  onScoreSelect?: (scoreIndex: number, value: number) => void;
  isEdit?: boolean;
  index?: number;
}

// ============================================
// ScorePlugin 实现
// ============================================

export class ScorePlugin implements InteractionSubPlugin {
  readonly name = 'score';
  readonly type = 'score' as const;

  private item: InteractionScore;
  private element: HTMLDivElement | null = null;
  private options: ScorePluginOptions;
  private dragCleanup: (() => void) | null = null;
  private lastCurrentTime = 0;
  private hasVoted = false;
  private selectedValue = 0;
  private totalScore = 0;
  private totalCount = 0;

  constructor(item: InteractionScore, options?: ScorePluginOptions) {
    this.item = item;
    this.options = options ?? {};
  }

  /**
   * 获取评分图标
   */
  private getScoreIcon(scoreType: InteractionType): string {
    switch (scoreType) {
      case 1:
        return StarIcon;
      case 2:
        return LoveIcon;
      case 3:
        return LemonIcon;
      default:
        return StarIcon;
    }
  }

  /**
   * 渲染评分卡片到容器
   */
  render(container: HTMLElement): void {
    if (!isBrowser()) return;

    const scoreItems = Array.from({ length: 5 }, (_, i): string => `
      <div class="${CLASS_NAMES.HL_SCORE_AREA_ITEM}" data-val="${i + 1}">
        <span>${this.getScoreIcon(this.item.scoreType)}</span>
      </div>
    `).join('');

    const html = `
      <div class="${CLASS_NAMES.HL_SCORE} ${CLASS_NAMES.HL_CARD_HIDE}" style="--top: ${this.item.top}%; --left: ${this.item.left}%; --scale: 1;">
        <span class="${CLASS_NAMES.HL_CIRCLE}"></span>
        <div class="${CLASS_NAMES.HL_SCORE_TITLE}">${this.item.title}</div>
        <div class="${CLASS_NAMES.HL_SCORE_AREA}">${scoreItems}</div>
        <div class="${CLASS_NAMES.HL_SCORE_RESULT}">平均 <span>0</span></div>
        <div class="${CLASS_NAMES.HL_SCORE_COUNT}">0人参与</div>
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
   * 绑定评分项点击事件和关闭按钮事件
   */
  private bindClickEvents(): void {
    if (!this.element) return;

    // 绑定评分项点击事件
    const scoreElements = this.element.querySelectorAll(`.${CLASS_NAMES.HL_SCORE_AREA_ITEM}`);
    scoreElements.forEach((scoreEl): void => {
      scoreEl.addEventListener('click', (e: Event): void => {
        e.stopPropagation();
        if (this.hasVoted) return;

        const val = (scoreEl as HTMLElement).dataset.val;
        if (val === undefined) return;

        this.selectedValue = parseInt(val, 10);
        this.hasVoted = true;

        // 更新评分数据
        this.totalScore += this.selectedValue;
        this.totalCount += 1;

        // 显示评分结果
        this.showScoreResult();

        // 触发回调
        const scoreIndex = this.options.index ?? 0;
        this.options.onScoreSelect?.(scoreIndex, this.selectedValue);
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
   * 显示评分结果，更新平均分和参与人数
   */
  private showScoreResult(): void {
    if (!this.element) return;

    // 标记已投票状态
    this.element.classList.add(CLASS_NAMES.HL_SCORE_VOTED);

    // 高亮选中的评分项（1 到 selectedValue 的所有项）
    const scoreElements = this.element.querySelectorAll(`.${CLASS_NAMES.HL_SCORE_AREA_ITEM}`);
    scoreElements.forEach((scoreEl, idx): void => {
      if (idx < this.selectedValue) {
        scoreEl.classList.add(CLASS_NAMES.HL_SCORE_AREA_ITEM_ACTIVE);
      }
    });

    // 更新平均分
    const average = this.totalCount > 0 ? (this.totalScore / this.totalCount).toFixed(1) : '0';
    const resultEl = this.element.querySelector(`.${CLASS_NAMES.HL_SCORE_RESULT} span`);
    if (resultEl instanceof HTMLElement) {
      resultEl.textContent = average;
    }

    // 更新参与人数
    const countEl = this.element.querySelector(`.${CLASS_NAMES.HL_SCORE_COUNT}`);
    if (countEl instanceof HTMLElement) {
      countEl.textContent = `${this.totalCount}人参与`;
    }
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
