/**
 * ============================================
 * 顶部进度条组件 (TopControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent } from "@/core";
import { ProgressBar, type ProgressBarApi } from "./ProgressBar";
import type { ProgressSegment } from "@/types";
import type { ProgressPreviewSource } from "@/hili-player/utils/media/progressPreview";

/**
 * TopControls 组件 Props 接口
 */
export interface TopControlsProps {
  /** 视频总时长（秒） */
  duration?: number;
  /** 进度条分段信息 */
  progressSegments?: ProgressSegment[];
  /** 预览数据提供者（雪碧图或逐帧，透传给 ProgressBar） */
  getPreviewFrames?: () => ProgressPreviewSource | string[] | null;
}

export type TopControlsEvents = {
  seek: number;
  seekStart: undefined;
  seekEnd: undefined;
  topControlsMounted: undefined;
  /** ProgressBar 挂载完成，向上层回传其更新 API */
  progressBarMounted: ProgressBarApi;
};

export const TopControls = defineComponent<TopControlsProps, TopControlsEvents>((props, lifecycle) => {
  const {
    duration = 0,
    progressSegments,
    getPreviewFrames,
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
      getPreviewSource: getPreviewFrames,
      onSeek: (time) => lifecycle.emit?.('seek', time),
      onSeekStart: () => lifecycle.emit?.('seekStart'),
      onSeekEnd: () => lifecycle.emit?.('seekEnd'),
      // 进度条挂载后拿到其更新 API，继续向上层（Controls → PlayerDocker）回传
      onProgressBarMounted: (api) => lifecycle.emit?.('progressBarMounted', api),
    }),
  );
});
