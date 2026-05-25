/**
 * 交互插件类型定义
 * 与既有实现 types/interaction.ts 保持一致
 */

/** 互动类型 */
export type InteractionType = 1 | 2 | 3;

/** 互动卡片类型 */
export type CardType = 'guideThree' | 'link' | 'vote' | 'score';

/** 位置事件 */
export interface PositionEvent {
  type: CardType;
  index: number;
  top: number;
  left: number;
}

/** 投票选项 */
export interface VoteOption {
  optionText: string;
  votes?: number;
}

/** 点赞关注配置 */
export interface InteractionGuideThree {
  type?: 1 | 2 | 3;
  top: number;
  left: number;
  timeStart?: number;
  timeEnd?: number;
  element?: HTMLDivElement;
}

/** 外链视频配置 */
export interface InteractionLink {
  top: number;
  left: number;
  link_content?: string;
  timeStart?: number;
  timeEnd?: number;
  closeTime?: number;
  isClose?: boolean;
  element?: HTMLDivElement;
  closeBtn?: unknown;
}

/** 投票配置 */
export interface InteractionVote {
  top: number;
  left: number;
  question: string;
  options: VoteOption[];
  timeStart?: number;
  timeEnd?: number;
  closeTime?: number;
  isClose?: boolean;
  element?: HTMLDivElement;
  closeBtn?: unknown;
}

/** 评分配置 */
export interface InteractionScore {
  top: number;
  left: number;
  title: string;
  scoreType: InteractionType;
  timeStart?: number;
  timeEnd?: number;
  closeTime?: number;
  isClose?: boolean;
  element?: HTMLDivElement;
  closeBtn?: unknown;
}

/** 互动卡片集合 */
export interface InteractionCard {
  guideList: InteractionGuideThree[];
  linkList: InteractionLink[];
  voteList: InteractionVote[];
  scoreList: InteractionScore[];
}

/** 互动插件配置 */
export interface InteractionPluginConfig {
  /** 是否编辑模式 */
  isEdit?: boolean;
  /** 初始数据 */
  data?: Partial<InteractionCard>;
  /** 位置变更回调 */
  onPositionChange?: (event: PositionEvent) => void;
  /** 卡片关闭回调 */
  onCardClose?: (type: CardType, index: number) => void;
  /** 点赞回调 */
  onLike?: () => void;
  /** 投币回调 */
  onCoin?: () => void;
  /** 收藏回调 */
  onCollect?: () => void;
  /** 关注回调 */
  onFollow?: () => void;
  /** 链接点击回调 */
  onLinkClick?: (link: InteractionLink) => void;
  /** 投票选择回调 */
  onVoteSelect?: (voteIndex: number, optionIndex: number) => void;
  /** 评分选择回调 */
  onScoreSelect?: (scoreIndex: number, value: number) => void;
}
