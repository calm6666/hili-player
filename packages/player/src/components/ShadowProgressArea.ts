/**
 * ============================================
 * 底部影子进度条组件 (ShadowProgressArea)
 * ============================================
 *
 * 对应参考实现 `src/component/controls/index.ts` 的
 * `.player-shadow-progress-area > .player-shadow-progress-schedule-wrap`：
 * 控制栏隐藏时常驻在控制条下沿的细进度条（2px），与顶部进度条同源同几何，
 * 逐分段镜像缓冲条 / 已播放条；`.permanent` 时高度抬到 30px 并显示分段文本。
 *
 * 显隐时机不在这里判断：由祖先 `.player-control-entity[data-shadow-show]` 上的
 * CSS 规则控制（showControl → "false" 隐藏影子条，hideControl → "true" 显示）。
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import { useComponentUnmount } from '@/hili-player/core/componentUnmount';
import type { ProgressSegment } from '@/types';
import { computeSegmentBox, computeSegmentRatio } from './ProgressBar';

/** 影子进度条挂载后回传的控制 API */
export interface ShadowProgressAreaApi {
  /** 更新已播放进度 */
  updateProgress: (time: number) => void;
  /** 更新缓冲进度 */
  updateBuffer: (buffer: number) => void;
  /** 更新视频总时长 */
  setDuration: (duration: number) => void;
  /** 重建分段（progress.segments 运行时变化时调用） */
  rebuildSegments: (segments?: ProgressSegment[]) => void;
  /** 切换「高能进度条」常驻形态（高度 30px + 显示分段文本） */
  setPermanent: (permanent: boolean) => void;
}

export interface ShadowProgressAreaProps {
  /** 视频总时长（秒） */
  duration?: number;
  /** 进度条分段信息（与顶部进度条同一份数据） */
  progressSegments?: ProgressSegment[];
  /** 是否常驻形态（参考实现为 isEdit 且存在多个分段） */
  permanent?: boolean;
}

export type ShadowProgressAreaEvents = {
  shadowProgressAreaMounted: ShadowProgressAreaApi;
};

export const ShadowProgressArea = defineComponent<
  ShadowProgressAreaProps,
  ShadowProgressAreaEvents
>((props, lifecycle) => {
  /** 视频总时长（秒），元数据加载后通过 setDuration 更新 */
  let duration = props.duration ?? 0;

  /** 当前分段数据 */
  let segments: ProgressSegment[] = props.progressSegments ?? [];

  /** 是否常驻形态（参考实现为 isEdit 且存在多个分段） */
  let permanent = props.permanent === true;

  /** 影子进度条容器 */
  const areaRef = useTemplateRef<HTMLDivElement>(lifecycle, 'shadowAreaRef');

  /** 影子进度条分段容器 */
  const wrapRef = useTemplateRef<HTMLDivElement>(
    lifecycle,
    'shadowScheduleWrapRef',
  );

  /**
   * 解析当前生效的分段区间列表
   * 多分段直接用各段自身区间；单分段 / 无分段时整条视作 [0, duration]
   */
  const resolveSegments = (): Array<
    Pick<ProgressSegment, 'startTime' | 'endTime'>
  > => {
    if (segments.length > 1) return segments;
    return [{ startTime: 0, endTime: duration }];
  };

  /** 影子分段基础元素列表（与分段顺序一一对应） */
  const getScheduleElements = (): HTMLDivElement[] => {
    if (!wrapRef.value) return [];
    return Array.from(
      wrapRef.value.querySelectorAll<HTMLDivElement>('.player-progress-schedule'),
    );
  };

  /**
   * 按分段逐个更新影子子元素的填充比例
   * @param value - 当前时间或缓冲时间（秒）
   * @param childClass - 需要设置 scaleX 的子元素类名
   */
  const updateSegmentFills = (value: number, childClass: string): void => {
    const rangeList = resolveSegments();
    getScheduleElements().forEach((schedule, index) => {
      const range = rangeList[index];
      if (!range) return;
      if (range.endTime <= range.startTime) return;
      const ratio = computeSegmentRatio(value, range.startTime, range.endTime);
      schedule
        .querySelectorAll<HTMLDivElement>(`.${childClass}`)
        .forEach((el) => {
          el.style.transform = `scaleX(${ratio})`;
        });
    });
  };

  /** 创建影子分段元素（与参考实现的 createViewPointElement 一致：buffer + current + text） */
  const createSegmentElement = (
    hasSegments: boolean,
    index?: number,
    segment?: ProgressSegment,
  ): HTMLDivElement => {
    const schedule = document.createElement('div');
    schedule.classList.add(
      'player-progress-schedule',
      ...(hasSegments ? ['player-progress-schedule-segment'] : []),
    );

    const buffer = document.createElement('div');
    buffer.classList.add('player-progress-schedule-buffer');
    buffer.style.transform = 'scaleX(0)';

    const current = document.createElement('div');
    current.classList.add('player-progress-schedule-current');
    current.style.transform = 'scaleX(0)';

    const text = document.createElement('div');
    text.classList.add('player-progress-schedule-text');
    // 文本仅在常驻形态（.permanent）下填充，与参考实现一致
    // （参考：仅 isEdit 且多分段时写入 pointText）

    schedule.appendChild(buffer);
    schedule.appendChild(current);
    schedule.appendChild(text);

    if (segment && typeof index === 'number') {
      const { left, width, marginRight } = computeSegmentBox(
        segment,
        index,
        segments.length,
        duration,
      );
      schedule.style.left = left;
      schedule.style.width = width;
      if (marginRight) {
        schedule.style.marginRight = marginRight;
      }
      segment.shadowElement = schedule;
      segment.shadowBufferElement = buffer;
      segment.shadowCurrentElement = current;
      segment.shadowTextElement = text;
    }

    return schedule;
  };

  /** 按当前分段数据重建影子分段 DOM */
  const build = (): void => {
    const wrap = wrapRef.value;
    if (!wrap) return;

    wrap.textContent = '';
    segments.forEach((segment) => {
      segment.shadowElement = undefined;
      segment.shadowBufferElement = undefined;
      segment.shadowCurrentElement = undefined;
      segment.shadowTextElement = undefined;
    });

    const hasSegments = segments.length > 1;
    if (hasSegments) {
      segments.forEach((segment, index) => {
        wrap.appendChild(createSegmentElement(true, index, segment));
      });
    } else {
      wrap.appendChild(createSegmentElement(false));
    }
    applyPermanent();
  };

  /** 应用常驻形态：类名 + 逐分段文本（仅在常驻时填充文本） */
  const applyPermanent = (): void => {
    areaRef.value?.classList.toggle('permanent', permanent);
    segments.forEach((segment) => {
      const text = segment.shadowTextElement;
      if (!text) return;
      text.textContent = permanent ? segment.label : '';
    });
  };

  /** 切换常驻形态 */
  const setPermanent = (next: boolean): void => {
    permanent = next;
    applyPermanent();
  };

  /** 更新已播放进度（影子条与顶部进度条同步） */
  const updateProgress = (time: number): void => {
    if (duration <= 0) return;
    updateSegmentFills(time, 'player-progress-schedule-current');
  };

  /** 更新缓冲进度 */
  const updateBuffer = (buffer: number): void => {
    if (duration <= 0) return;
    updateSegmentFills(buffer, 'player-progress-schedule-buffer');
  };

  /** 更新视频总时长 */
  const setDuration = (value: number): void => {
    duration = value;
  };

  /** 重建分段 */
  const rebuildSegments = (nextSegments?: ProgressSegment[]): void => {
    if (nextSegments) segments = nextSegments;
    build();
  };

  lifecycle.onMounted = (): void => {
    build();
    setPermanent(props.permanent === true);
    lifecycle.emit?.('shadowProgressAreaMounted', {
      updateProgress,
      updateBuffer,
      setDuration,
      rebuildSegments,
      setPermanent,
    });
  };

  useComponentUnmount(lifecycle, (): void => {
    segments.forEach((segment) => {
      segment.shadowElement = undefined;
      segment.shadowBufferElement = undefined;
      segment.shadowCurrentElement = undefined;
      segment.shadowTextElement = undefined;
    });
  });

  return h(
    'div',
    { class: 'player-shadow-progress-area', ref: 'shadowAreaRef' },
    h('div', {
      class: 'player-shadow-progress-schedule-wrap',
      ref: 'shadowScheduleWrapRef',
    }),
  );
});
