/**
 * ============================================
 * 互动命令组件 (RowCmd)
 * ============================================
 * 支持点赞关注、外链视频、投票、评分等互动卡片
 */

import { defineComponent, h, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type {
  CardType,
  PositionEvent,
  InteractionLink,
  InteractionCard,
} from '@/hili-player/types';

// ============================================
// RowCmd 组件属性接口
// ============================================

/**
 * RowCmd 组件属性接口
 * 定义组件接收的所有属性和回调函数
 */
export interface RowCmdProps {
  /** 是否处于编辑模式 */
  isEdit: boolean;
  /** 互动卡片位置变更时的回调 */
  onPositionChange?: (event: PositionEvent) => void;
  /** 互动卡片被关闭时的回调 */
  onCardClose?: (type: CardType, index: number) => void;
  /** 点击点赞按钮时的回调 */
  onLike?: () => void;
  /** 点击投币按钮时的回调 */
  onCoin?: () => void;
  /** 点击收藏按钮时的回调 */
  onCollect?: () => void;
  /** 点击关注按钮时的回调 */
  onFollow?: () => void;
  /** 点击外链视频时的回调 */
  onLinkClick?: (link: InteractionLink) => void;
  /** 选择投票选项时的回调 */
  onVoteSelect?: (voteIndex: number, optionIndex: number) => void;
  /** 点击评分项时的回调 */
  onScoreSelect?: (scoreIndex: number, value: number) => void;
}

// ============================================
// 互动命令组件
// ============================================

/**
 * 互动命令组件
 * 管理所有互动卡片的渲染、显示/隐藏逻辑
 */
export const RowCmd = defineComponent<RowCmdProps>((_props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================

  /** 互动命令外层容器 DOM 引用 */
  const cmdDmWrapRef = ref<HTMLDivElement>();

  /** 互动命令内部容器 DOM 引用，互动卡片将挂载到此容器中 */
  const dmInsideRef = ref<HTMLDivElement>();

  // ============================================
  // 状态数据
  // ============================================

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
  // 生命周期钩子
  // ============================================

  /** 组件销毁前清理所有互动卡片的 DOM 元素 */
  lifecycle.onBeforeDestroy = (): void => {
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
   * 返回组件的 VNode 结构
   */
  return h('div', { class: 'player-cmd-dm-wrap', ref: cmdDmWrapRef },
    h('div', { class: 'player-cmd-dm-inside', ref: dmInsideRef })
  );
});
