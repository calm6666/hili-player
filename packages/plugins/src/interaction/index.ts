/**
 * ============================================
 * 交互插件 (InteractionPlugin)
 * ============================================
 * 互动命令功能插件，通过事件总线实现跨组件通信
 * 支持点赞关注、外链视频、投票、评分等互动卡片
 *
 * 使用方式：
 * import { InteractionPlugin } from '@hili-player/plugins';
 *
 * plugins: [
 *   InteractionPlugin({
 *     isEdit: false,
 *     onLike: () => console.log('liked'),
 *     onVoteSelect: (voteIndex, optionIndex) => console.log(voteIndex, optionIndex)
 *   })
 * ]
 *
 * 事件通信：
 * - interaction:like - 点赞
 * - interaction:coin - 投币
 * - interaction:collect - 收藏
 * - interaction:follow - 关注
 * - interaction:linkClick - 链接点击
 * - interaction:voteSelect - 投票选择
 * - interaction:scoreSelect - 评分选择
 * - interaction:positionChange - 位置变更
 * - interaction:cardClose - 卡片关闭
 * - interaction:currentTimeChange - 当前时间变更
 */

import type { Plugin } from '@hili-player/player';
import type {
  CardType,
  PositionEvent,
  InteractionType,
  InteractionGuideThree,
  InteractionLink,
  InteractionVote,
  InteractionScore,
  InteractionCard,
  InteractionPluginConfig,
} from './types';

// 重新导出类型
export type {
  CardType,
  PositionEvent,
  InteractionType,
  VoteOption,
  InteractionGuideThree,
  InteractionLink,
  InteractionVote,
  InteractionScore,
  InteractionCard,
  InteractionPluginConfig,
} from './types';

// ============================================
// 类型谓词函数（用于替代 as 类型断言）
// ============================================

/** 播放器事件接口 */
interface PlayerEvents {
  on: (event: string, handler: (data: unknown) => void) => () => void;
  emit: (event: string, data?: unknown) => void;
}

/** 检查对象是否拥有 events 属性 */
function hasPlayerEvents(obj: unknown): obj is { events: PlayerEvents } {
  return typeof obj === 'object' && obj !== null && 'events' in obj;
}

/** 检查对象是否拥有 container 属性 */
function hasContainerProperty(obj: unknown): obj is { container?: HTMLElement } {
  return typeof obj === 'object' && obj !== null && 'container' in obj;
}

/** 检查对象是否拥有 item 属性且为 InteractionGuideThree */
function isGuideItemData(obj: unknown): obj is { item: InteractionGuideThree } {
  return typeof obj === 'object' && obj !== null && 'item' in obj &&
    typeof obj.item === 'object' && obj.item !== null && 'top' in obj.item && 'left' in obj.item;
}

/** 检查对象是否拥有 item 属性且为 InteractionLink */
function isLinkItemData(obj: unknown): obj is { item: InteractionLink } {
  return typeof obj === 'object' && obj !== null && 'item' in obj &&
    typeof obj.item === 'object' && obj.item !== null && 'top' in obj.item && 'left' in obj.item && 'link_content' in obj.item;
}

/** 检查对象是否拥有 item 属性且为 InteractionVote */
function isVoteItemData(obj: unknown): obj is { item: InteractionVote } {
  return typeof obj === 'object' && obj !== null && 'item' in obj &&
    typeof obj.item === 'object' && obj.item !== null && 'question' in obj.item && 'options' in obj.item && 'top' in obj.item && 'left' in obj.item;
}

/** 检查对象是否拥有 item 属性且为 InteractionScore */
function isScoreItemData(obj: unknown): obj is { item: InteractionScore } {
  return typeof obj === 'object' && obj !== null && 'item' in obj &&
    typeof obj.item === 'object' && obj.item !== null && 'title' in obj.item && 'scoreType' in obj.item && 'top' in obj.item && 'left' in obj.item;
}

/** 检查对象是否拥有 type 和 index 属性 */
function hasTypeAndIndex(obj: unknown): obj is { type: CardType; index: number } {
  return typeof obj === 'object' && obj !== null && 'type' in obj && 'index' in obj;
}

/** 检查对象是否拥有 element 属性 */
function hasElementProperty(obj: unknown): obj is { element?: HTMLDivElement } {
  return typeof obj === 'object' && obj !== null && 'element' in obj;
}

/** 交互插件已解析配置类型 */
type InteractionResolvedConfig = {
  isEdit: boolean;
  data: Partial<InteractionCard>;
  onPositionChange: ((event: PositionEvent) => void) | null;
  onCardClose: ((type: CardType, index: number) => void) | null;
  onLike: (() => void) | null;
  onCoin: (() => void) | null;
  onCollect: (() => void) | null;
  onFollow: (() => void) | null;
  onLinkClick: ((link: InteractionLink) => void) | null;
  onVoteSelect: ((voteIndex: number, optionIndex: number) => void) | null;
  onScoreSelect: ((scoreIndex: number, value: number) => void) | null;
};

// ============================================
// 图标定义（使用简单SVG字符串）
// ============================================

/** 点赞图标 SVG */
const FillLikeIcon = '<svg viewBox="0 0 28 28"><path d="M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4z"/></svg>';

/** 投币图标 SVG */
const FillCoinIcon = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="10"/></svg>';

/** 收藏图标 SVG */
const FillCollectIcon = '<svg viewBox="0 0 28 28"><path d="M14 2l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z"/></svg>';

/** 加号图标 SVG */
const PlusIcon = '<svg viewBox="0 0 28 28"><path d="M14 2v24M2 14h24"/></svg>';

/** 稍后再看图标 SVG */
const SeeLaterIcon = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="10"/><path d="M14 8v6l4 2"/></svg>';

/** 星星图标 SVG */
const StarIcon = '<svg viewBox="0 0 28 28"><path d="M14 2l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z"/></svg>';

/** 爱心图标 SVG */
const LoveIcon = '<svg viewBox="0 0 28 28"><path d="M14 26s-9-6-9-13a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13z"/></svg>';

/** 柠檬图标 SVG */
const LemonIcon = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="10"/></svg>';

// ============================================
// 类名常量（与既有实现保持一致）
// ============================================

const CLASS_NAMES = {
  PLAYER_CMD_DM_WRAP: 'player-cmd-dm-wrap',
  PLAYER_CMD_DM_INSIDE: 'player-cmd-dm-inside',
  HL_GUIDE_THREE: 'hl-guide-three',
  HL_GUIDE_THREE_LIKE: 'hl-guide-three-like',
  HL_GUIDE_THREE_COIN: 'hl-guide-three-coin',
  HL_GUIDE_THREE_COLLECT: 'hl-guide-three-collect',
  HL_GUIDE_FOLLOW: 'hl-guide-follow',
  HL_GUIDE_FOLLOW_0: 'hl-guide-follow-0',
  HL_GUIDE_FOLLOW_1: 'hl-guide-follow-1',
  HL_LINK: 'hl-link',
  HL_CIRCLE: 'hl-circle',
  HL_LINK_LEFT: 'hl-link-left',
  HL_LINK_ICON: 'hl-link-icon',
  HL_LINK_MSG: 'hl-link-msg',
  HL_LINK_LINE: 'hl-link-line',
  HL_LINK_RIGHT: 'hl-link-right',
  HL_LINK_WATCHLATER: 'hl-link-watchlater',
  HL_LINK_WATCHLATER_ICON: 'hl-link-watchlater-icon',
  HL_VOTE: 'hl-vote',
  HL_VOTE_QUESTION: 'hl-vote-question',
  HL_VOTE_AN: 'hl-vote-an',
  HL_VOTE_AN_BG: 'hl-vote-an-bg',
  HL_VOTE_AN_BG_BUFFER: 'hl-vote-an-bg-buffer',
  HL_VOTE_AN_TEXT: 'hl-vote-an-text',
  HL_VOTE_AN_TEXT_INDEX: 'hl-vote-an-text-index',
  HL_VOTE_AN_TEXT_DOC: 'hl-vote-an-text-doc',
  HL_SCORE: 'hl-score',
  HL_SCORE_TITLE: 'score-title',
  HL_SCORE_AREA: 'hl-score-area',
  HL_SCORE_AREA_ITEM: 'hl-score-area-item',
  HL_EDITOR: 'hl-editor',
  HL_EDITOR_NO_GUIDE_THREE: 'hl-editor-no-guide-three',
  HL_EDITOR_NO_FOLLOW: 'hl-editor-no-follow',
  HL_HIDE: 'hl-hide',
  HL_CARD_HIDE: 'hl-card-hide',
} as const;

// ============================================
// 交互插件类
// ============================================

class InteractionPluginClass implements Plugin {
  readonly name = 'interaction';
  readonly version = '1.0.0';
  readonly description = '互动命令插件';

  private container: HTMLElement | null = null;
  private cmdDmWrapElement: HTMLDivElement | null = null;
  private dmInsideElement: HTMLDivElement | null = null;

  private config: InteractionResolvedConfig;
  private interactCard: InteractionCard = {
    guideList: [],
    linkList: [],
    voteList: [],
    scoreList: [],
  };
  private currentTime = 0;

  // 事件发射器
  private emit: ((event: string, data?: unknown) => void) | null = null;

  constructor(config?: InteractionPluginConfig) {
    this.config = {
      isEdit: config?.isEdit ?? false,
      data: config?.data ?? {},
      onPositionChange: config?.onPositionChange ?? null,
      onCardClose: config?.onCardClose ?? null,
      onLike: config?.onLike ?? null,
      onCoin: config?.onCoin ?? null,
      onCollect: config?.onCollect ?? null,
      onFollow: config?.onFollow ?? null,
      onLinkClick: config?.onLinkClick ?? null,
      onVoteSelect: config?.onVoteSelect ?? null,
      onScoreSelect: config?.onScoreSelect ?? null,
    };

    // 初始化数据
    if (config?.data) {
      this.interactCard = {
        guideList: config.data.guideList || [],
        linkList: config.data.linkList || [],
        voteList: config.data.voteList || [],
        scoreList: config.data.scoreList || [],
      };
    }
  }

  install(player: unknown): void {
    const playerContainer = hasContainerProperty(player) ? player.container : undefined;
    const playerEvents = hasPlayerEvents(player) ? player.events : undefined;

    if (playerContainer) {
      this.container = playerContainer;
      this.createContainer();
    }

    // 保存事件发射器
    if (playerEvents) {
      this.emit = (event: string, data?: unknown) => playerEvents.emit(event, data);

      // 监听播放器事件
      playerEvents.on('player:mounted', (data: unknown) => {
        if (hasContainerProperty(data) && data.container && !this.container) {
          this.container = data.container;
          this.createContainer();
        }
      });

      // 监听时间变更
      playerEvents.on('video:timeUpdate', (data: unknown) => {
        if (typeof data === 'object' && data !== null && 'currentTime' in data && typeof data.currentTime === 'number') {
          this.currentTimeChange(data.currentTime);
        }
      });

      // 监听交互控制事件
      this.bindControlEvents(playerEvents);
    }

    // 发射初始化完成事件
    this.emit?.('interaction:initialized', { data: this.interactCard });
  }

  /**
   * 创建容器
   */
  private createContainer(): void {
    if (!this.container) return;

    this.cmdDmWrapElement = document.createElement('div');
    this.cmdDmWrapElement.className = CLASS_NAMES.PLAYER_CMD_DM_WRAP;

    this.dmInsideElement = document.createElement('div');
    this.dmInsideElement.className = CLASS_NAMES.PLAYER_CMD_DM_INSIDE;
    this.dmInsideElement.style.cssText = 'width: 100%; height: 100%;';

    this.cmdDmWrapElement.appendChild(this.dmInsideElement);
    this.container.appendChild(this.cmdDmWrapElement);

    // 渲染初始数据
    this.renderInitialData();
  }

  /**
   * 渲染初始数据
   */
  private renderInitialData(): void {
    this.interactCard.guideList.forEach((item, index) => {
      this.addGuideThree(item, index);
    });
    this.interactCard.linkList.forEach((item, index) => {
      this.addLink(item, index);
    });
    this.interactCard.voteList.forEach((item, index) => {
      this.addVote(item, index);
    });
    this.interactCard.scoreList.forEach((item, index) => {
      this.addScore(item, index);
    });
  }

  /**
   * 绑定控制事件
   */
  private bindControlEvents(events: { on: (event: string, handler: (data: unknown) => void) => () => void }): void {
    // 添加点赞关注
    events.on('interaction:addGuide', (data: unknown) => {
      if (isGuideItemData(data)) {
        this.addGuideThree(data.item);
      }
    });

    // 添加链接
    events.on('interaction:addLink', (data: unknown) => {
      if (isLinkItemData(data)) {
        this.addLink(data.item);
      }
    });

    // 添加投票
    events.on('interaction:addVote', (data: unknown) => {
      if (isVoteItemData(data)) {
        this.addVote(data.item);
      }
    });

    // 添加评分
    events.on('interaction:addScore', (data: unknown) => {
      if (isScoreItemData(data)) {
        this.addScore(data.item);
      }
    });

    // 移除卡片
    events.on('interaction:removeCard', (data: unknown) => {
      if (hasTypeAndIndex(data) && typeof data.index === 'number') {
        this.removeCard(data.type, data.index);
      }
    });

    // 更新时间
    events.on('interaction:currentTimeChange', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'currentTime' in data && typeof data.currentTime === 'number') {
        this.currentTimeChange(data.currentTime);
      }
    });

    // 获取状态
    events.on('interaction:getStatus', () => {
      this.emit?.('interaction:status', this.getStatus());
    });
  }

  uninstall(): void {
    // 清理所有卡片元素
    this.interactCard.guideList.forEach((item) => {
      if (item.element?.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });
    this.interactCard.linkList.forEach((item) => {
      if (item.element?.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });
    this.interactCard.voteList.forEach((item) => {
      if (item.element?.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });
    this.interactCard.scoreList.forEach((item) => {
      if (item.element?.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });

    // 移除容器
    if (this.cmdDmWrapElement && this.container) {
      this.container.removeChild(this.cmdDmWrapElement);
    }

    this.container = null;
    this.cmdDmWrapElement = null;
    this.dmInsideElement = null;
    this.emit = null;
  }

  // ==================== 渲染方法 ====================

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
   * 初始化编辑器类名
   */
  private initEditorClassName(type: number): string {
    let className = `${CLASS_NAMES.HL_EDITOR} ${CLASS_NAMES.HL_CARD_HIDE}`;
    if (type === 2) {
      className += ` ${CLASS_NAMES.HL_EDITOR_NO_FOLLOW}`;
    } else if (type === 3) {
      className += ` ${CLASS_NAMES.HL_EDITOR_NO_GUIDE_THREE}`;
    }
    return className;
  }

  /**
   * 创建DOM元素
   */
  private createElement(html: string): HTMLDivElement {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    const firstChild = div.firstChild;
    if (firstChild instanceof HTMLDivElement) {
      return firstChild;
    }
    return document.createElement('div');
  }

  /**
   * 添加点赞关注卡片
   */
  addGuideThree(item: InteractionGuideThree, index?: number): HTMLDivElement {
    const className = this.initEditorClassName(item.type || 1);
    const html = `
      <div class="${className}" style="--top: ${item.top}%; --left: ${item.left}%;">
        <div class="${CLASS_NAMES.HL_GUIDE_THREE}">
          <span class="${CLASS_NAMES.HL_GUIDE_THREE_LIKE} is_active">
            ${FillLikeIcon}
          </span>
          <span class="${CLASS_NAMES.HL_GUIDE_THREE_COIN}">
            ${FillCoinIcon}
          </span>
          <span class="${CLASS_NAMES.HL_GUIDE_THREE_COLLECT}">
            ${FillCollectIcon}
          </span>
        </div>
        <div class="${CLASS_NAMES.HL_GUIDE_FOLLOW} no-follow">
          <span class="${CLASS_NAMES.HL_GUIDE_FOLLOW_0}">
            ${PlusIcon}
            <span>关注</span>
          </span>
          <span class="${CLASS_NAMES.HL_GUIDE_FOLLOW_1}">已关注</span>
        </div>
      </div>
    `;

    const element = this.createElement(html);
    this.dmInsideElement?.appendChild(element);

    // 绑定事件
    const likeBtn = element.querySelector(`.${CLASS_NAMES.HL_GUIDE_THREE_LIKE}`);
    const coinBtn = element.querySelector(`.${CLASS_NAMES.HL_GUIDE_THREE_COIN}`);
    const collectBtn = element.querySelector(`.${CLASS_NAMES.HL_GUIDE_THREE_COLLECT}`);
    const followBtn = element.querySelector(`.${CLASS_NAMES.HL_GUIDE_FOLLOW_0}`);

    likeBtn?.addEventListener('click', () => {
      this.config.onLike?.();
      this.emit?.('interaction:like', {});
    });

    coinBtn?.addEventListener('click', () => {
      this.config.onCoin?.();
      this.emit?.('interaction:coin', {});
    });

    collectBtn?.addEventListener('click', () => {
      this.config.onCollect?.();
      this.emit?.('interaction:collect', {});
    });

    followBtn?.addEventListener('click', () => {
      this.config.onFollow?.();
      this.emit?.('interaction:follow', {});
    });

    const newItem: InteractionGuideThree = { ...item, element };
    if (index !== undefined) {
      this.interactCard.guideList[index] = newItem;
    } else {
      this.interactCard.guideList.push(newItem);
    }

    return element;
  }

  /**
   * 添加链接卡片
   */
  addLink(item: InteractionLink, index?: number): HTMLDivElement {
    const html = `
      <div class="${CLASS_NAMES.HL_LINK} ${CLASS_NAMES.HL_CARD_HIDE}" style="--top: ${item.top}%; --left: ${item.left}%;">
        <span class="${CLASS_NAMES.HL_CIRCLE}"></span>
        <div class="${CLASS_NAMES.HL_LINK_LEFT}">
          <div class="${CLASS_NAMES.HL_LINK_ICON}"></div>
          <div class="${CLASS_NAMES.HL_LINK_MSG}">${item.link_content || '这是一个什么视频'}</div>
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

    const element = this.createElement(html);
    this.dmInsideElement?.appendChild(element);

    // 绑定点击事件
    element.addEventListener('click', () => {
      this.config.onLinkClick?.(item);
      this.emit?.('interaction:linkClick', { item });
    });

    // 关闭按钮事件
    if (!this.config.isEdit) {
      const closeBtn = element.querySelector(`.${CLASS_NAMES.HL_CIRCLE}`);
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = index ?? this.interactCard.linkList.length;
        this.closeCard('link', idx);
      });
    }

    const newItem: InteractionLink = { ...item, element };
    if (index !== undefined) {
      this.interactCard.linkList[index] = newItem;
    } else {
      this.interactCard.linkList.push(newItem);
    }

    return element;
  }

  /**
   * 添加投票卡片
   */
  addVote(item: InteractionVote, index?: number): HTMLDivElement {
    const optionsHtml = item.options.map((opt, idx) => `
      <div class="${CLASS_NAMES.HL_VOTE_AN} hl-vote-an-flag-1" data-index="${idx}">
        <div class="${CLASS_NAMES.HL_VOTE_AN_BG}">
          <div class="${CLASS_NAMES.HL_VOTE_AN_BG_BUFFER}"></div>
        </div>
        <div class="${CLASS_NAMES.HL_VOTE_AN_TEXT}">
          <div class="${CLASS_NAMES.HL_VOTE_AN_TEXT_INDEX}">${String.fromCharCode(65 + idx)}</div>
          <div class="${CLASS_NAMES.HL_VOTE_AN_TEXT_DOC}">${opt.optionText}</div>
        </div>
      </div>
    `).join('');

    const html = `
      <div class="${CLASS_NAMES.HL_VOTE}" style="--top: ${item.top}%; --left: ${item.left}%;">
        <span class="${CLASS_NAMES.HL_CIRCLE}"></span>
        <div class="${CLASS_NAMES.HL_VOTE_QUESTION}">${item.question}</div>
        ${optionsHtml}
      </div>
    `;

    const element = this.createElement(html);
    this.dmInsideElement?.appendChild(element);

    // 绑定选项点击事件
    const optionElements = element.querySelectorAll(`.${CLASS_NAMES.HL_VOTE_AN}`);
    optionElements.forEach((optEl, idx) => {
      optEl.addEventListener('click', () => {
        const itemIndex = index ?? this.interactCard.voteList.length - 1;
        this.config.onVoteSelect?.(itemIndex, idx);
        this.emit?.('interaction:voteSelect', { voteIndex: itemIndex, optionIndex: idx });
      });
    });

    // 关闭按钮事件
    if (!this.config.isEdit) {
      const closeBtn = element.querySelector(`.${CLASS_NAMES.HL_CIRCLE}`);
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = index ?? this.interactCard.voteList.length;
        this.closeCard('vote', idx);
      });
    }

    const newItem: InteractionVote = { ...item, element };
    if (index !== undefined) {
      this.interactCard.voteList[index] = newItem;
    } else {
      this.interactCard.voteList.push(newItem);
    }

    return element;
  }

  /**
   * 添加评分卡片
   */
  addScore(item: InteractionScore, index?: number): HTMLDivElement {
    const scoreItems = Array.from({ length: 5 }, (_, i) => `
      <div class="${CLASS_NAMES.HL_SCORE_AREA_ITEM}" data-val="${i + 1}">
        <span>${this.getScoreIcon(item.scoreType)}</span>
        <span>5</span>
      </div>
    `).join('');

    const html = `
      <div class="${CLASS_NAMES.HL_SCORE} ${CLASS_NAMES.HL_CARD_HIDE}" style="--top: ${item.top}%; --left: ${item.left}%; --scale: 1;">
        <span class="${CLASS_NAMES.HL_CIRCLE}"></span>
        <div class="${CLASS_NAMES.HL_SCORE_TITLE}">${item.title}</div>
        <div class="${CLASS_NAMES.HL_SCORE_AREA}">${scoreItems}</div>
        <div class="hl-score-result">平均 <span style="color: undefined;">NaN</span></div>
        <div class="hl-score-count">0人参与</div>
      </div>
    `;

    const element = this.createElement(html);
    this.dmInsideElement?.appendChild(element);

    // 绑定评分项点击事件
    const scoreElements = element.querySelectorAll(`.${CLASS_NAMES.HL_SCORE_AREA_ITEM}`);
    scoreElements.forEach((scoreEl, idx) => {
      scoreEl.addEventListener('click', () => {
        const itemIndex = index ?? this.interactCard.scoreList.length - 1;
        const value = idx + 1;
        this.config.onScoreSelect?.(itemIndex, value);
        this.emit?.('interaction:scoreSelect', { scoreIndex: itemIndex, value });
      });
    });

    // 关闭按钮事件
    if (!this.config.isEdit) {
      const closeBtn = element.querySelector(`.${CLASS_NAMES.HL_CIRCLE}`);
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = index ?? this.interactCard.scoreList.length;
        this.closeCard('score', idx);
      });
    }

    const newItem: InteractionScore = { ...item, element };
    if (index !== undefined) {
      this.interactCard.scoreList[index] = newItem;
    } else {
      this.interactCard.scoreList.push(newItem);
    }

    return element;
  }

  // ==================== 显示控制 ====================

  /**
   * 关闭卡片
   */
  closeCard(type: CardType, index: number): void {
    let list: (InteractionLink | InteractionVote | InteractionScore)[] = [];
    switch (type) {
      case 'link':
        list = this.interactCard.linkList;
        break;
      case 'vote':
        list = this.interactCard.voteList;
        break;
      case 'score':
        list = this.interactCard.scoreList;
        break;
    }

    const item = list[index];
    if (item) {
      item.isClose = true;
      item.closeTime = this.currentTime;
      item.element?.classList.add(CLASS_NAMES.HL_CARD_HIDE);
      this.config.onCardClose?.(type, index);
      this.emit?.('interaction:cardClose', { type, index });
    }
  }

  /**
   * 移除卡片
   */
  removeCard(type: CardType, index: number): void {
    let list: unknown[] = [];
    switch (type) {
      case 'guideThree':
        list = this.interactCard.guideList;
        break;
      case 'link':
        list = this.interactCard.linkList;
        break;
      case 'vote':
        list = this.interactCard.voteList;
        break;
      case 'score':
        list = this.interactCard.scoreList;
        break;
    }

    const item = list[index];
    if (hasElementProperty(item) && item.element?.parentNode) {
      item.element.parentNode.removeChild(item.element);
    }
    list.splice(index, 1);
  }

  /**
   * 当前时间变更处理
   */
  currentTimeChange(currentTime: number): void {
    this.currentTime = currentTime;

    // 更新所有卡片的显示状态
    this.displayItems(this.interactCard.guideList, currentTime);
    this.displayItems(this.interactCard.linkList, currentTime);
    this.displayItems(this.interactCard.voteList, currentTime);
    this.displayItems(this.interactCard.scoreList, currentTime);

    this.emit?.('interaction:currentTimeChange', { currentTime });
  }

  /**
   * 显示项目
   */
  private displayItems<T extends { timeStart?: number; timeEnd?: number; closeTime?: number; isClose?: boolean; element?: HTMLDivElement }>(
    list: T[],
    currTimePoint: number
  ): void {
    list.forEach((item) => {
      // 处理关闭时间逻辑
      if (item.closeTime !== undefined && item.closeTime > currTimePoint) {
        item.isClose = false;
      }

      // 如果已关闭且未到关闭时间，跳过
      if (item.closeTime !== undefined && item.closeTime <= currTimePoint && item.isClose === true) {
        return;
      }

      // 根据时间范围控制显示状态
      if (item.timeStart !== undefined && item.timeEnd !== undefined) {
        if (currTimePoint < item.timeEnd && item.timeStart <= currTimePoint) {
          // 在显示时间范围内：完全显示
          item.element?.classList.remove(CLASS_NAMES.HL_CARD_HIDE, CLASS_NAMES.HL_HIDE);
        } else if (item.timeEnd - 0.6 <= currTimePoint && item.timeEnd + 0.6 > currTimePoint) {
          // 在消失动画时间内：显示消失动画
          item.element?.classList.remove(CLASS_NAMES.HL_CARD_HIDE);
          item.element?.classList.add(CLASS_NAMES.HL_HIDE);
        } else if (currTimePoint < item.timeStart - 0.6 || item.timeEnd + 0.6 < currTimePoint) {
          // 在显示范围外：完全隐藏
          item.element?.classList.remove(CLASS_NAMES.HL_HIDE);
          item.element?.classList.add(CLASS_NAMES.HL_CARD_HIDE);
        }
      }
    });
  }

  // ==================== 公共 API ====================

  /**
   * 获取状态
   */
  getStatus(): InteractionCard {
    return { ...this.interactCard };
  }

  /**
   * 更新数据
   */
  updateData(data: Partial<InteractionCard>): void {
    if (data.guideList) {
      this.interactCard.guideList = data.guideList;
    }
    if (data.linkList) {
      this.interactCard.linkList = data.linkList;
    }
    if (data.voteList) {
      this.interactCard.voteList = data.voteList;
    }
    if (data.scoreList) {
      this.interactCard.scoreList = data.scoreList;
    }
    this.emit?.('interaction:dataUpdate', { data: this.interactCard });
  }
}

/**
 * 交互插件工厂函数
 */
export function InteractionPlugin(config?: InteractionPluginConfig): Plugin {
  return new InteractionPluginClass(config);
}
