/**
 * ============================================
 * 交互插件 (InteractionPlugin)
 * ============================================
 * 互动命令功能插件，通过 PlayerEventEnum 事件实现跨组件通信
 * 在 MOUNTED 时查找 .player-cmd-dm-inside 容器（不自行创建容器）
 * 使用 4 个子插件（GuidePlugin, LinkPlugin, VotePlugin, ScorePlugin）渲染卡片
 * 使用 diffAlgorithm（binarySearchByTime + updateCardsDiff）进行时间驱动的卡片可见性控制
 * 在编辑模式下使用 dragEditor（bindDragInEditMode）提供拖拽定位
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
 */

import type { Plugin, PluginOptions } from '@/types/plugin';
import type { VideoPlayer } from '../../../player/src/player/VideoPlayer';
import type { PlayerEventBus } from '../../../player/src/core/plugin';
import { PlayerEventEnum } from '@/core/events';
import { GuidePlugin } from './GuidePlugin';
import { LinkPlugin } from './LinkPlugin';
import { VotePlugin } from './VotePlugin';
import { ScorePlugin } from './ScorePlugin';
import { binarySearchByTime, updateCardsDiff } from './diffAlgorithm';
import { bindDragInEditMode } from './dragEditor';
import { isBrowser } from '@/utils';
import type {
  CardType,
  PositionEvent,
  InteractionGuideThree,
  InteractionLink,
  InteractionVote,
  InteractionScore,
  InteractionCard,
  InteractionPluginConfig,
  InteractionSubPlugin,
} from './types';

// ============================================
// 类型定义
// ============================================

/** 交互插件已解析配置 */
interface InteractionResolvedConfig {
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
}

/** 拖拽清理函数类型 */
type DragCleanup = () => void;

// ============================================
// 互动插件 API 接口
// ============================================

/** 互动插件完整 API 接口 */
export interface InteractionPluginAPI extends Plugin {
  /** 添加引导卡片 */
  addGuide(item: InteractionGuideThree): void;
  /** 添加链接卡片 */
  addLink(item: InteractionLink): void;
  /** 添加投票卡片 */
  addVote(item: InteractionVote): void;
  /** 添加评分卡片 */
  addScore(item: InteractionScore): void;
  /** 获取容器 */
  getContainer(): HTMLElement | null;
  /** 关闭卡片 */
  closeCard(type: CardType, index: number): void;
  /** 获取状态 */
  getStatus(): InteractionCard;
  /** 更新数据 */
  updateData(data: Partial<InteractionCard>): void;
}

// ============================================
// 交互插件类
// ============================================

class InteractionPluginClass implements InteractionPluginAPI {
  readonly name = 'interaction';
  readonly version = '1.0.0';
  readonly description = '互动命令插件';
  readonly options?: PluginOptions;

  private container: HTMLElement | null = null;
  private dmInsideElement: HTMLElement | null = null;

  private config: InteractionResolvedConfig;
  private interactCard: InteractionCard = {
    guideList: [],
    linkList: [],
    voteList: [],
    scoreList: [],
  };

  // 子插件实例列表
  private guidePlugins: GuidePlugin[] = [];
  private linkPlugins: LinkPlugin[] = [];
  private votePlugins: VotePlugin[] = [];
  private scorePlugins: ScorePlugin[] = [];

  // 拖拽清理函数列表
  private dragCleanups: DragCleanup[] = [];

  // 时间追踪（用于 diffAlgorithm）
  private currentTime = 0;
  private prevTime = 0;

  // 事件取消订阅
  private unsubscribers: Array<() => void> = [];

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
        guideList: config.data.guideList ?? [],
        linkList: config.data.linkList ?? [],
        voteList: config.data.voteList ?? [],
        scoreList: config.data.scoreList ?? [],
      };
    }

    this.options = undefined;
  }

  install(player: VideoPlayer): void {
    if (!isBrowser()) return;

    const events: PlayerEventBus = player.events;

    const unsubMounted = events.on(PlayerEventEnum.MOUNTED, (data): void => {
      if (data.container) {
        this.container = data.container;
        // 查找 .player-cmd-dm-inside 容器（不自行创建）
        this.dmInsideElement = data.container.querySelector('.player-cmd-dm-inside') ?? null;

        // 渲染初始数据
        if (this.dmInsideElement) {
          this.renderInitialData();
        }
      }
    });
    this.unsubscribers.push(unsubMounted);

    // 订阅 TIME_UPDATE 事件：使用 diffAlgorithm 更新卡片可见性
    const unsubTimeUpdate = events.on(PlayerEventEnum.TIME_UPDATE, (data): void => {
      this.handleTimeUpdate(data.time);
    });
    this.unsubscribers.push(unsubTimeUpdate);

    // 订阅 INTERACTION_LIKE 事件
    const unsubLike = events.on(PlayerEventEnum.INTERACTION_LIKE, (): void => {
      this.config.onLike?.();
    });
    this.unsubscribers.push(unsubLike);

    // 订阅 INTERACTION_COIN 事件
    const unsubCoin = events.on(PlayerEventEnum.INTERACTION_COIN, (): void => {
      this.config.onCoin?.();
    });
    this.unsubscribers.push(unsubCoin);

    // 订阅 INTERACTION_COLLECT 事件
    const unsubCollect = events.on(PlayerEventEnum.INTERACTION_COLLECT, (): void => {
      this.config.onCollect?.();
    });
    this.unsubscribers.push(unsubCollect);

    // 订阅 INTERACTION_FOLLOW 事件
    const unsubFollow = events.on(PlayerEventEnum.INTERACTION_FOLLOW, (): void => {
      this.config.onFollow?.();
    });
    this.unsubscribers.push(unsubFollow);

    // 订阅 INTERACTION_LINK_CLICK 事件
    const unsubLinkClick = events.on(PlayerEventEnum.INTERACTION_LINK_CLICK, (): void => {
      // 链接点击回调由子插件内部触发
    });
    this.unsubscribers.push(unsubLinkClick);

    // 订阅 INTERACTION_VOTE_SELECT 事件
    const unsubVoteSelect = events.on(PlayerEventEnum.INTERACTION_VOTE_SELECT, (data): void => {
      this.config.onVoteSelect?.(data.voteIndex, data.optionIndex);
    });
    this.unsubscribers.push(unsubVoteSelect);

    // 订阅 INTERACTION_SCORE_SELECT 事件
    const unsubScoreSelect = events.on(PlayerEventEnum.INTERACTION_SCORE_SELECT, (data): void => {
      this.config.onScoreSelect?.(data.scoreIndex, data.value);
    });
    this.unsubscribers.push(unsubScoreSelect);

    // 订阅 INTERACTION_CARD_CLOSE 事件
    const unsubCardClose = events.on(PlayerEventEnum.INTERACTION_CARD_CLOSE, (data): void => {
      this.config.onCardClose?.(data.type as CardType, data.index);
    });
    this.unsubscribers.push(unsubCardClose);

    // 订阅 INTERACTION_POSITION_CHANGE 事件
    const unsubPositionChange = events.on(PlayerEventEnum.INTERACTION_POSITION_CHANGE, (data): void => {
      this.config.onPositionChange?.({
        type: data.type as CardType,
        index: data.index,
        top: data.top,
        left: data.left,
      });
    });
    this.unsubscribers.push(unsubPositionChange);
  }

  uninstall(): void {
    // 取消所有事件订阅
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // 清理拖拽
    this.dragCleanups.forEach(cleanup => cleanup());
    this.dragCleanups = [];

    // 销毁所有子插件
    this.guidePlugins.forEach(p => p.destroy());
    this.linkPlugins.forEach(p => p.destroy());
    this.votePlugins.forEach(p => p.destroy());
    this.scorePlugins.forEach(p => p.destroy());

    this.guidePlugins = [];
    this.linkPlugins = [];
    this.votePlugins = [];
    this.scorePlugins = [];

    this.dmInsideElement = null;
    this.container = null;
  }

  // ==================== 渲染方法 ====================

  /**
   * 渲染初始数据
   */
  private renderInitialData(): void {
    if (!this.dmInsideElement) return;

    this.interactCard.guideList.forEach((item): void => {
      this.addGuide(item);
    });
    this.interactCard.linkList.forEach((item): void => {
      this.addLink(item);
    });
    this.interactCard.voteList.forEach((item): void => {
      this.addVote(item);
    });
    this.interactCard.scoreList.forEach((item): void => {
      this.addScore(item);
    });
  }

  /**
   * 添加点赞关注卡片（使用 GuidePlugin 子插件）
   */
  addGuide(item: InteractionGuideThree): void {
    if (!this.dmInsideElement) return;

    const plugin = new GuidePlugin(item);
    plugin.render(this.dmInsideElement);
    this.guidePlugins.push(plugin);

    // 在编辑模式下绑定拖拽
    if (this.config.isEdit) {
      const element = this.getLastGuideElement();
      if (element) {
        const index = this.guidePlugins.length - 1;
        const cleanup = bindDragInEditMode(element, (top: number, left: number): void => {
          item.top = top;
          item.left = left;
          this.config.onPositionChange?.({
            type: 'guideThree',
            index,
            top,
            left,
          });
        });
        this.dragCleanups.push(cleanup);
      }
    }
  }

  /**
   * 添加外链卡片（使用 LinkPlugin 子插件）
   */
  addLink(item: InteractionLink): void {
    if (!this.dmInsideElement) return;

    const plugin = new LinkPlugin(item);
    plugin.render(this.dmInsideElement);
    this.linkPlugins.push(plugin);

    // 在编辑模式下绑定拖拽
    if (this.config.isEdit) {
      const element = this.getLastLinkElement();
      if (element) {
        const index = this.linkPlugins.length - 1;
        const cleanup = bindDragInEditMode(element, (top: number, left: number): void => {
          item.top = top;
          item.left = left;
          this.config.onPositionChange?.({
            type: 'link',
            index,
            top,
            left,
          });
        });
        this.dragCleanups.push(cleanup);
      }
    }
  }

  /**
   * 添加投票卡片（使用 VotePlugin 子插件）
   */
  addVote(item: InteractionVote): void {
    if (!this.dmInsideElement) return;

    const plugin = new VotePlugin(item);
    plugin.render(this.dmInsideElement);
    this.votePlugins.push(plugin);

    // 在编辑模式下绑定拖拽
    if (this.config.isEdit) {
      const element = this.getLastVoteElement();
      if (element) {
        const index = this.votePlugins.length - 1;
        const cleanup = bindDragInEditMode(element, (top: number, left: number): void => {
          item.top = top;
          item.left = left;
          this.config.onPositionChange?.({
            type: 'vote',
            index,
            top,
            left,
          });
        });
        this.dragCleanups.push(cleanup);
      }
    }
  }

  /**
   * 添加评分卡片（使用 ScorePlugin 子插件）
   */
  addScore(item: InteractionScore): void {
    if (!this.dmInsideElement) return;

    const plugin = new ScorePlugin(item);
    plugin.render(this.dmInsideElement);
    this.scorePlugins.push(plugin);

    // 在编辑模式下绑定拖拽
    if (this.config.isEdit) {
      const element = this.getLastScoreElement();
      if (element) {
        const index = this.scorePlugins.length - 1;
        const cleanup = bindDragInEditMode(element, (top: number, left: number): void => {
          item.top = top;
          item.left = left;
          this.config.onPositionChange?.({
            type: 'score',
            index,
            top,
            left,
          });
        });
        this.dragCleanups.push(cleanup);
      }
    }
  }

  // ==================== 时间更新与 diffAlgorithm ====================

  /**
   * 处理时间更新：使用 diffAlgorithm 增量更新卡片可见性
   * 使用 binarySearchByTime 定位起始索引，updateCardsDiff 增量更新
   */
  private handleTimeUpdate(currentTime: number): void {
    this.prevTime = this.currentTime;
    this.currentTime = currentTime;

    // 使用 binarySearchByTime 快速定位当前时间点在各类卡片列表中的位置
    // 用于日志和调试追踪
    const guideStartIndex = binarySearchByTime(this.interactCard.guideList, this.currentTime);
    const linkStartIndex = binarySearchByTime(this.interactCard.linkList, this.currentTime);
    const voteStartIndex = binarySearchByTime(this.interactCard.voteList, this.currentTime);
    const scoreStartIndex = binarySearchByTime(this.interactCard.scoreList, this.currentTime);

    // 使用 updateCardsDiff 对各类卡片进行增量 diff 更新
    updateCardsDiff(
      this.interactCard.guideList,
      this.currentTime,
      this.prevTime,
      (card: InteractionGuideThree): void => {
        const index = this.interactCard.guideList.indexOf(card);
        if (index >= guideStartIndex && index < this.guidePlugins.length) {
          this.guidePlugins[index].updateTime(this.currentTime);
        }
      }
    );

    updateCardsDiff(
      this.interactCard.linkList,
      this.currentTime,
      this.prevTime,
      (card: InteractionLink): void => {
        const index = this.interactCard.linkList.indexOf(card);
        if (index >= linkStartIndex && index < this.linkPlugins.length) {
          this.linkPlugins[index].updateTime(this.currentTime);
        }
      }
    );

    updateCardsDiff(
      this.interactCard.voteList,
      this.currentTime,
      this.prevTime,
      (card: InteractionVote): void => {
        const index = this.interactCard.voteList.indexOf(card);
        if (index >= voteStartIndex && index < this.votePlugins.length) {
          this.votePlugins[index].updateTime(this.currentTime);
        }
      }
    );

    updateCardsDiff(
      this.interactCard.scoreList,
      this.currentTime,
      this.prevTime,
      (card: InteractionScore): void => {
        const index = this.interactCard.scoreList.indexOf(card);
        if (index >= scoreStartIndex && index < this.scorePlugins.length) {
          this.scorePlugins[index].updateTime(this.currentTime);
        }
      }
    );
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取最后一个 GuidePlugin 渲染的元素
   */
  private getLastGuideElement(): HTMLDivElement | null {
    if (this.guidePlugins.length === 0) return null;
    return this.getSubPluginElement(this.guidePlugins[this.guidePlugins.length - 1]);
  }

  /**
   * 获取最后一个 LinkPlugin 渲染的元素
   */
  private getLastLinkElement(): HTMLDivElement | null {
    if (this.linkPlugins.length === 0) return null;
    return this.getSubPluginElement(this.linkPlugins[this.linkPlugins.length - 1]);
  }

  /**
   * 获取最后一个 VotePlugin 渲染的元素
   */
  private getLastVoteElement(): HTMLDivElement | null {
    if (this.votePlugins.length === 0) return null;
    return this.getSubPluginElement(this.votePlugins[this.votePlugins.length - 1]);
  }

  /**
   * 获取最后一个 ScorePlugin 渲染的元素
   */
  private getLastScoreElement(): HTMLDivElement | null {
    if (this.scorePlugins.length === 0) return null;
    return this.getSubPluginElement(this.scorePlugins[this.scorePlugins.length - 1]);
  }

  /**
   * 从子插件获取其渲染的 DOM 元素
   * 通过子插件的 element 属性获取其渲染的根元素
   */
  private getSubPluginElement(plugin: InteractionSubPlugin): HTMLDivElement | null {
    // 子插件渲染后会在容器中创建元素，通过子插件类型和容器查找对应元素
    const className = this.getSubPluginClassName(plugin);
    if (!className || !this.dmInsideElement) return null;
    const elements = this.dmInsideElement.querySelectorAll(`.${className}`);
    const lastElement = elements[elements.length - 1];
    return lastElement instanceof HTMLDivElement ? lastElement : null;
  }

  /**
   * 根据子插件类型获取对应的 CSS 类名
   */
  private getSubPluginClassName(plugin: InteractionSubPlugin): string {
    switch (plugin.type) {
      case 'guide': return 'hl-guide';
      case 'link': return 'hl-link';
      case 'vote': return 'hl-vote';
      case 'score': return 'hl-score';
    }
  }

  // ==================== 公共 API ====================

  /**
   * 获取互动层容器元素
   * @returns 容器元素，未挂载返回 null
   */
  getContainer(): HTMLElement | null {
    return this.container;
  }

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
      this.config.onCardClose?.(type, index);
    }
  }

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
    // 销毁旧的子插件
    this.guidePlugins.forEach(p => p.destroy());
    this.linkPlugins.forEach(p => p.destroy());
    this.votePlugins.forEach(p => p.destroy());
    this.scorePlugins.forEach(p => p.destroy());

    this.guidePlugins = [];
    this.linkPlugins = [];
    this.votePlugins = [];
    this.scorePlugins = [];

    // 清理拖拽
    this.dragCleanups.forEach(cleanup => cleanup());
    this.dragCleanups = [];

    // 更新数据
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

    // 重新渲染
    this.renderInitialData();
  }
}

/**
 * 交互插件工厂函数
 *
 * @param config - 插件配置
 * @returns Plugin 实例
 *
 * @example
 * plugins: [
 *   InteractionPlugin({
 *     isEdit: false,
 *     onLike: () => console.log('liked'),
 *     onVoteSelect: (voteIndex, optionIndex) => console.log(voteIndex, optionIndex)
 *   })
 * ]
 */
export function InteractionPlugin(config?: InteractionPluginConfig): InteractionPluginAPI {
  return new InteractionPluginClass(config);
}

// 重新导出类型
export type { InteractionPluginConfig } from './types';
