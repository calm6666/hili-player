/**
 * ============================================
 * 互动卡片 diff 算法 — 基于时间排序
 * ============================================
 * 使用二分查找定位需要更新的卡片，O(log n + k) 复杂度
 */

import type { InteractionGuideThree, InteractionLink, InteractionVote, InteractionScore } from './types';

/** 带时间范围的卡片基础类型 */
interface TimedCard {
  timeStart?: number;
  timeEnd?: number;
}

/**
 * 二分查找：在按 timeStart 排序的卡片数组中，
 * 找到第一个 timeStart >= target 的卡片索引
 *
 * @param cards - 按 timeStart 升序排列的卡片数组
 * @param target - 目标时间
 * @returns 第一个 timeStart >= target 的索引，若不存在则返回 cards.length
 */
export function binarySearchByTime<T extends TimedCard>(cards: T[], target: number): number {
  let low = 0;
  let high = cards.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    const midStart = cards[mid].timeStart ?? 0;
    if (midStart < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * 增量更新：基于二分查找的 diff 算法
 *
 * 给定当前时间和上一次时间，只更新时间范围与 [prevTime, currentTime] 有交集的卡片。
 * 适用于卡片已按 timeStart 升序排列的场景，复杂度 O(log n + k)，k 为受影响的卡片数。
 *
 * @param cards - 按 timeStart 升序排列的卡片数组
 * @param currentTime - 当前播放时间
 * @param prevTime - 上一帧播放时间
 * @param onUpdate - 对受影响卡片的回调
 */
export function updateCardsDiff<T extends TimedCard>(
  cards: T[],
  currentTime: number,
  prevTime: number,
  onUpdate: (card: T) => void
): void {
  if (cards.length === 0) return;

  // 确定搜索范围：[minTime, maxTime]
  const minTime = Math.min(prevTime, currentTime);
  const maxTime = Math.max(prevTime, currentTime);

  // 二分查找起始位置：第一个 timeStart >= minTime - 0.6 的卡片
  // 0.6 秒为消失动画的缓冲时间
  const bufferTime = 0.6;
  const startIndex = binarySearchByTime(cards, minTime - bufferTime);

  // 从 startIndex 向后遍历，直到 timeStart > maxTime + bufferTime
  for (let i = startIndex; i < cards.length; i++) {
    const card = cards[i];
    const cardStart = card.timeStart ?? 0;

    // 卡片的起始时间已经超过搜索范围，后续无需检查
    if (cardStart > maxTime + bufferTime) {
      break;
    }

    onUpdate(card);
  }
}

/**
 * 对各类卡片列表执行 diff 更新
 *
 * @param guideList - 点赞关注卡片列表
 * @param linkList - 外链卡片列表
 * @param voteList - 投票卡片列表
 * @param scoreList - 评分卡片列表
 * @param currentTime - 当前播放时间
 * @param prevTime - 上一帧播放时间
 * @param onGuideUpdate - 点赞关注卡片更新回调
 * @param onLinkUpdate - 外链卡片更新回调
 * @param onVoteUpdate - 投票卡片更新回调
 * @param onScoreUpdate - 评分卡片更新回调
 */
export function diffAllCards(
  guideList: InteractionGuideThree[],
  linkList: InteractionLink[],
  voteList: InteractionVote[],
  scoreList: InteractionScore[],
  currentTime: number,
  prevTime: number,
  onGuideUpdate: (card: InteractionGuideThree) => void,
  onLinkUpdate: (card: InteractionLink) => void,
  onVoteUpdate: (card: InteractionVote) => void,
  onScoreUpdate: (card: InteractionScore) => void
): void {
  updateCardsDiff(guideList, currentTime, prevTime, onGuideUpdate);
  updateCardsDiff(linkList, currentTime, prevTime, onLinkUpdate);
  updateCardsDiff(voteList, currentTime, prevTime, onVoteUpdate);
  updateCardsDiff(scoreList, currentTime, prevTime, onScoreUpdate);
}
