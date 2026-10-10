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
 * 给定当前时间和上一次时间，只更新「视觉状态可能发生变化」的卡片。
 *
 * 卡片的视觉状态区间为 [timeStart - 0.6, timeEnd + 0.6]（0.6 秒为出现/消失
 * 动画的缓冲时间）：播放头处于该区间内时，卡片可能处于显示、动画或隐藏三种
 * 状态之间切换。播放头本帧扫过的时间窗口为 [minTime, maxTime]（取 prevTime
 * 与 currentTime 的较小/较大值，兼容 seek 双向跳转）。两者有交集的卡片才需要
 * 调用 onUpdate 刷新可见性。
 *
 * 注意：不能用 binarySearchByTime(minTime - bufferTime) 作为遍历起点——它返回
 * 「第一个 timeStart >= minTime - 0.6」的下标，会把 timeStart 更早、正在显示
 * 中（等待越过 timeEnd 被隐藏）的卡片跳过，导致这些卡片越过 timeEnd 后永远
 * 收不到 updateTime 而无法隐藏。因此起点必须从头开始，仅利用 timeStart 升序
 * 做上界剪枝，再用 timeEnd 下界跳过早已隐藏的过期卡片。
 *
 * 适用于卡片已按 timeStart 升序排列的场景，复杂度 O(log n + k)，k 为窗口
 * 涉及的卡片数（含已隐藏但 timeStart 仍未越过上界的过期卡片）。
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

  // 确定本帧播放头扫过的时间范围：[minTime, maxTime]
  const minTime = Math.min(prevTime, currentTime);
  const maxTime = Math.max(prevTime, currentTime);

  // 0.6 秒为出现/消失动画的缓冲时间
  const bufferTime = 0.6;

  // 二分查找遍历上界：第一个 timeStart >= maxTime + 0.6 的卡片下标。
  // timeStart 晚于播放窗口的「未来卡片」本帧不涉及任何状态变化，直接排除
  const endIndex = binarySearchByTime(cards, maxTime + bufferTime);

  // 从头遍历到上界：显示中的卡片（timeStart 早于窗口）不能被起点下标跳过
  for (let i = 0; i < endIndex; i++) {
    const card = cards[i];
    // timeEnd 未定义视为永不结束（一直需要根据播放位置刷新可见性）
    const cardEnd = card.timeEnd ?? Number.POSITIVE_INFINITY;

    // 卡片早已越过 timeEnd + 缓冲且整体位于窗口左侧：
    // 已处于完全隐藏的稳态，本帧无需刷新
    if (cardEnd < minTime - bufferTime) {
      continue;
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
