/**
 * ============================================
 * 互动命令组件 (RowCmd)
 * ============================================
 * 使用 h 函数实现，保持与老播放器完全相同的 DOM 结构和类名
 * 支持点赞关注、外链视频、投票、评分等互动卡片
 */

import { defineComponent, h } from '@/core';
import type { VNode } from '@/types';
import type { ComponentLifecycle } from '@/types';
import type {
  CardType,
  PositionEvent,
  InteractionType,
  InteractionOptions,
  VoteOption,
  InteractionGuideThree,
  InteractionLink,
  InteractionVote,
  InteractionScore,
  InteractionCard,
  MergeResult,
} from '@/hili-player/types';

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
// RowCmd 组件属性接口
// ============================================

/**
 * RowCmd 组件属性接口
 * 定义组件接收的所有属性和回调函数
 */
export interface RowCmdProps {
  /** 是否编辑模式 */
  isEdit: boolean;
  /** 位置变更回调 - 当互动卡片位置发生变化时触发 */
  onPositionChange?: (event: PositionEvent) => void;
  /** 卡片关闭回调 - 当互动卡片被关闭时触发 */
  onCardClose?: (type: CardType, index: number) => void;
  /** 点赞回调 - 当用户点击点赞按钮时触发 */
  onLike?: () => void;
  /** 投币回调 - 当用户点击投币按钮时触发 */
  onCoin?: () => void;
  /** 收藏回调 - 当用户点击收藏按钮时触发 */
  onCollect?: () => void;
  /** 关注回调 - 当用户点击关注按钮时触发 */
  onFollow?: () => void;
  /** 链接点击回调 - 当用户点击外链视频时触发 */
  onLinkClick?: (link: InteractionLink) => void;
  /** 投票选项点击回调 - 当用户选择投票选项时触发 */
  onVoteSelect?: (voteIndex: number, optionIndex: number) => void;
  /** 评分点击回调 - 当用户点击评分项时触发 */
  onScoreSelect?: (scoreIndex: number, value: number) => void;
}

// ============================================
// 互动命令组件
// ============================================

/**
 * 互动命令组件
 * 使用 h 函数实现，保持与老播放器完全相同的 DOM 结构和类名
 * 管理所有互动卡片的渲染、显示/隐藏逻辑
 */
export const RowCmd = defineComponent<RowCmdProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================

  /** 互动命令外层容器元素引用 */
  const cmdDmWrapRef: { current: HTMLDivElement | null } = { current: null };

  /** 互动命令内部容器元素引用 */
  const dmInsideRef: { current: HTMLDivElement | null } = { current: null };

  // ============================================
  // 状态数据
  // ============================================

  /** 当前播放时间（秒） */
  let currentTime = 0;

  /**
   * 互动卡片数据集合
   * 包含所有类型的互动卡片列表
   */
  const interactCard: InteractionCard = {
    /** 点赞关注卡片列表 */
    guideList: [],
    /** 外链视频卡片列表 */
    linkList: [],
    /** 投票卡片列表 */
    voteList: [],
    /** 评分卡片列表 */
    scoreList: [],
  };



  // ============================================
  // 工具函数
  // ============================================

  /**
   * 获取评分图标
   * 根据评分类型返回对应的SVG图标
   *
   * @param scoreType - 评分类型（1=星星，2=爱心，3=柠檬）
   * @returns 对应的SVG图标字符串
   */
  const getScoreIcon = (scoreType: InteractionType): string => {
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
  };

  /**
   * 初始化编辑器类名
   * 根据类型生成对应的CSS类名
   *
   * @param type - 编辑器类型（1=完整，2=无关注，3=无点赞）
   * @returns 完整的CSS类名字符串
   */
  const initEditorClassName = (type: number): string => {
    // 基础类名：编辑器容器 + 默认隐藏
    let className = 'hl-editor hl-card-hide';

    // 根据类型添加特定类名
    if (type === 2) {
      // 类型2：不显示关注按钮
      className += ' hl-editor-no-follow';
    } else if (type === 3) {
      // 类型3：不显示点赞区域
      className += ' hl-editor-no-guide-three';
    }

    return className;
  };

  // ============================================
  // 渲染函数
  // ============================================

  /**
   * 渲染点赞关注模板
   * 创建点赞、投币、收藏按钮和关注按钮的DOM结构
   *
   * @param guideThree - 点赞关注数据对象
   * @returns 点赞关注卡片的VNode
   */
  const renderGuideThreeTemplate = (guideThree: InteractionGuideThree): VNode => {
    // 根据类型生成类名
    const className = initEditorClassName(guideThree.type || 1);

    // 创建点赞关注卡片
    return h('div', {
      class: className,
      style: { '--top': `${guideThree.top}%`, '--left': `${guideThree.left}%` },
    },
      // 点赞投币收藏区域
      h('div', { class: 'hl-guide-three' },
        // 点赞按钮
        h('span', {
          class: ['hl-guide-three-like', 'is_active'],
          onClick: () => {
            props.onLike?.();
            lifecycle.emit?.('like');
          },
        }, h('span', { innerHTML: FillLikeIcon })),
        // 投币按钮
        h('span', {
          class: 'hl-guide-three-coin',
          onClick: () => {
            props.onCoin?.();
            lifecycle.emit?.('coin');
          },
        }, h('span', { innerHTML: FillCoinIcon })),
        // 收藏按钮
        h('span', {
          class: 'hl-guide-three-collect',
          onClick: () => {
            props.onCollect?.();
            lifecycle.emit?.('collect');
          },
        }, h('span', { innerHTML: FillCollectIcon })),
      ),
      // 关注区域
      h('div', { class: 'hl-guide-follow no-follow' },
        // 关注按钮（未关注状态）
        h('span', {
          class: 'hl-guide-follow-0',
          onClick: () => {
            props.onFollow?.();
            lifecycle.emit?.('follow');
          },
        },
          h('span', { innerHTML: PlusIcon }),
          h('span', null, '关注'),
        ),
        // 已关注状态
        h('span', { class: 'hl-guide-follow-1' }, '已关注'),
      ),
    );
  };

  /**
   * 渲染链接模板
   * 创建外链视频卡片的DOM结构
   *
   * @param link - 外链视频数据对象
   * @returns 外链视频卡片的VNode
   */
  const renderLinkTemplate = (link: InteractionLink): VNode => {
    return h('div', {
      class: ['hl-link', 'hl-card-hide'],
      style: { '--top': `${link.top}%`, '--left': `${link.left}%` },
    },
      // 圆圈指示器
      h('span', { class: 'hl-circle' }),
      // 左侧内容区域
      h('div', { class: 'hl-link-left' },
        // 视频图标
        h('div', { class: 'hl-link-icon' }),
        // 视频描述文字
        h('div', { class: 'hl-link-msg' }, link.link_content || '这是一个什么视频'),
      ),
      // 中间分隔线
      h('div', { class: 'hl-link-line' }),
      // 右侧操作区域
      h('div', { class: 'hl-link-right' },
        // 稍后再看按钮
        h('div', { class: 'hl-link-watchlater' },
          h('span', { class: 'hl-link-watchlater-icon', innerHTML: SeeLaterIcon }),
          h('span', null, '稍后再看'),
        ),
      ),
    );
  };

  /**
   * 渲染投票模板
   * 创建投票卡片的DOM结构
   *
   * @param vote - 投票数据对象
   * @returns 投票卡片的VNode
   */
  const renderVoteTemplate = (vote: InteractionVote): VNode => {
    return h('div', {
      class: 'hl-vote',
      style: { '--top': `${vote.top}%`, '--left': `${vote.left}%` },
    },
      // 圆圈指示器
      h('span', { class: 'hl-circle' }),
      // 投票问题
      h('div', { class: 'hl-vote-question' }, vote.question),
    );
  };

  /**
   * 渲染投票选项内容
   * 创建单个投票选项的DOM结构
   *
   * @param voteOption - 投票选项数据对象
   * @param index - 选项索引（0=A, 1=B, 2=C...）
   * @returns 投票选项的VNode
   */
  const renderVoteContent = (voteOption: VoteOption, index: number): VNode => {
    return h('div', { class: 'hl-vote-an hl-vote-an-flag-1' },
      // 背景进度条
      h('div', { class: 'hl-vote-an-bg' },
        h('div', { class: 'hl-vote-an-bg-buffer' }),
      ),
      // 选项文字区域
      h('div', { class: 'hl-vote-an-text' },
        // 选项序号（A, B, C...）
        h('div', { class: 'hl-vote-an-text-index' }, String.fromCharCode(65 + index)),
        // 选项文字内容
        h('div', { class: 'hl-vote-an-text-doc' }, voteOption.optionText),
      ),
    );
  };

  /**
   * 渲染评分模板
   * 创建评分卡片的DOM结构
   *
   * @param score - 评分数据对象
   * @returns 评分卡片的VNode
   */
  const renderScoreTemplate = (score: InteractionScore): VNode => {
    // 生成5个评分项
    const scoreItems: VNode[] = [];
    for (let i = 1; i <= 5; i++) {
      scoreItems.push(
        h('div', {
          class: 'hl-score-area-item',
          'data-val': i.toString(),
          onClick: () => {
            const scoreIndex = interactCard.scoreList.findIndex((s) => s === score);
            props.onScoreSelect?.(scoreIndex, i);
            lifecycle.emit?.('scoreSelect', { scoreIndex, value: i });
          },
        },
          // 评分图标
          h('span', { innerHTML: getScoreIcon(score.scoreType) }),
          // 评分值
          h('span', null, '5'),
        )
      );
    }

    return h('div', {
      class: ['hl-score', 'hl-card-hide'],
      style: { '--top': `${score.top}%`, '--left': `${score.left}%`, '--scale': '1' },
    },
      // 圆圈指示器
      h('span', { class: 'hl-circle' }),
      // 评分标题
      h('div', { class: 'score-title' }, score.title),
      // 评分区域（5个评分项）
      h('div', { class: 'hl-score-area' }, ...scoreItems),
      // 评分结果
      h('div', { class: 'hl-score-result' }, '平均 ', h('span', { style: { color: 'undefined' } }, 'NaN')),
      // 参与人数
      h('div', { class: 'hl-score-count' }, '0人参与'),
    );
  };

  // ============================================
  // 显示控制函数
  // ============================================

  /**
   * 显示项目
   * 根据当前时间控制互动卡片的显示/隐藏状态
   *
   * @param list - 互动卡片列表
   * @param currTimePoint - 当前时间点（秒）
   * @param type - 卡片类型
   */
  const displayItem = <T extends InteractionGuideThree | InteractionLink | InteractionVote | InteractionScore>(
    list: T[],
    currTimePoint: number,
    type: string
  ): void => {
    list.forEach((item, index) => {
      // 处理关闭时间逻辑
      if ('closeTime' in item && item.closeTime !== undefined && item.closeTime > currTimePoint) {
        if ('isClose' in item) item.isClose = false;
      }

      // 如果已关闭且未到关闭时间，跳过
      if (
        'closeTime' in item &&
        item.closeTime !== undefined &&
        item.closeTime <= currTimePoint &&
        'isClose' in item && item.isClose === true
      ) {
        return;
      }

      // 根据时间范围控制显示状态
      if (item.timeStart !== undefined && item.timeEnd !== undefined) {
        if (currTimePoint < item.timeEnd && item.timeStart <= currTimePoint) {
          // 在显示时间范围内：完全显示
          list[index].element?.classList.remove('hl-card-hide', 'hl-hide');
        } else if (item.timeEnd - 0.6 <= currTimePoint && item.timeEnd + 0.6 > currTimePoint) {
          // 在消失动画时间内：显示消失动画
          list[index].element?.classList.remove('hl-card-hide');
          list[index].element?.classList.add('hl-hide');
        } else if (currTimePoint < item.timeStart - 0.6 || item.timeEnd + 0.6 < currTimePoint) {
          // 在显示范围外：完全隐藏
          list[index].element?.classList.remove('hl-hide');
          list[index].element?.classList.add('hl-card-hide');
        }
      }
    });
  };

  /**
   * 显示点赞关注
   * 根据当前时间控制点赞关注卡片的显示状态
   *
   * @param currTimePoint - 当前时间点（秒）
   */
  const displayGuide = (currTimePoint: number): void => {
    displayItem(interactCard.guideList, currTimePoint, 'guideThree');
  };

  /**
   * 显示链接
   * 根据当前时间控制外链视频卡片的显示状态
   *
   * @param currTimePoint - 当前时间点（秒）
   */
  const displayLink = (currTimePoint: number): void => {
    displayItem(interactCard.linkList, currTimePoint, 'link');
  };

  /**
   * 显示投票
   * 根据当前时间控制投票卡片的显示状态
   *
   * @param currTimePoint - 当前时间点（秒）
   */
  const displayVote = (currTimePoint: number): void => {
    displayItem(interactCard.voteList, currTimePoint, 'vote');
  };

  /**
   * 显示评分
   * 根据当前时间控制评分卡片的显示状态
   *
   * @param currTimePoint - 当前时间点（秒）
   */
  const displayScore = (currTimePoint: number): void => {
    displayItem(interactCard.scoreList, currTimePoint, 'score');
  };

  // ============================================
  // 时间更新处理
  // ============================================

  /**
   * 当前时间变更处理
   * 当视频播放时间变化时，更新所有互动卡片的显示状态
   *
   * @param time - 当前播放时间（秒）
   */
  const currentTimeChange = (time: number): void => {
    currentTime = time;

    // 更新点赞关注卡片显示状态
    if (interactCard.guideList.length !== 0) {
      displayGuide(time);
    }

    // 更新外链视频卡片显示状态
    if (interactCard.linkList.length !== 0) {
      displayLink(time);
    }

    // 更新投票卡片显示状态
    if (interactCard.voteList.length !== 0) {
      displayVote(time);
    }

    // 更新评分卡片显示状态
    if (interactCard.scoreList.length !== 0) {
      displayScore(time);
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件销毁前清理
   * 移除所有互动卡片的DOM元素
   */
  lifecycle.onBeforeDestroy = () => {
    // 清理点赞关注卡片
    interactCard.guideList.forEach((item) => {
      if (item.element?.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });

    // 清理外链视频卡片
    interactCard.linkList.forEach((item) => {
      if (item.element?.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });

    // 清理投票卡片
    interactCard.voteList.forEach((item) => {
      if (item.element?.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });

    // 清理评分卡片
    interactCard.scoreList.forEach((item) => {
      if (item.element?.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });
  };

  // ============================================
  // 渲染输出
  // ============================================

  /**
   * 渲染互动命令组件
   * 返回组件的VNode结构
   */
  return h('div', { class: 'player-cmd-dm-wrap', ref: cmdDmWrapRef },
    h('div', { class: 'player-cmd-dm-inside', ref: dmInsideRef })
  );
});
