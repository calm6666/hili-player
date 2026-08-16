/**
 * ============================================
 * 顶部进度条组件 (TopControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent } from "@/core";
import { ProgressBar } from "./ProgressBar";
import type { ProgressSegment } from "@/types";

/**
 * TopControls 组件 Props 接口
 */
export interface TopControlsProps {
  /** 视频总时长（秒） */
  duration?: number;
  /** 进度条分段信息 */
  progressSegments?: ProgressSegment[];
}

export type TopControlsEvents = {
  seek: number;
  seekStart: undefined;
  seekEnd: undefined;
  topControlsMounted: undefined;
};

export const TopControls = defineComponent<TopControlsProps, TopControlsEvents>((props, lifecycle) => {
  const {
    duration = 0,
    progressSegments,
  } = props;
   /**
   * 组件挂载后，通知上层组件
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('topControlsMounted');
  };
  // ============================================
  // 主渲染函数
  // ============================================
  return h(
    "div",
    { class: "player-control-top" },
    h(ProgressBar, {
      duration,
      progressSegments,
      onSeek: (time) => lifecycle.emit?.('seek', time),
      onSeekStart: () => lifecycle.emit?.('seekStart'),
      onSeekEnd: () => lifecycle.emit?.('seekEnd'),
    }),
  );
});
