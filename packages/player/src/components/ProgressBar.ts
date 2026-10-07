import { h, defineComponent, useTemplateRef } from "@/core";
import { useComponentUnmount } from "@/hili-player/core/componentUnmount";
import { resolveProgressPreviewSlice } from "@/hili-player/utils/media/progressPreview";
import type { ProgressPreviewSource } from "@/hili-player/utils/media/progressPreview";
import type { ProgressSegment } from "@/types";
import { isBrowser } from "@/utils";
import { formatTime } from "@/utils/formatTime";
import { createLogger } from "@/utils";
import { isDev } from "@/core/warning";

/** 进度条组件日志（仅 error 级别的异常 / 非法配置诊断） */
const logger = createLogger('ProgressBar');

/**
 * 计算单个分段在当前时间下的填充比例（纯函数，便于单元测试）
 *
 * 语义：某个分段只表示它自身 [startTime, endTime] 区间内的进度，
 * 因此同一时刻各分段的填充比例不同，未进入区间时为 0，走完后为 1。
 *
 * @param time - 当前时间（秒）
 * @param startTime - 分段起始时间（秒）
 * @param endTime - 分段结束时间（秒）
 * @returns 0-1 之间的比例；区间非法（endTime <= startTime）时返回 0，避免除零得到 NaN/Infinity
 */
export const computeSegmentRatio = (
  time: number,
  startTime: number,
  endTime: number,
): number => {
  // 脏分段（时段为 0 或倒挂）直接返回 0，防止 (time - start) / 0 产生 NaN/Infinity
  if (endTime <= startTime) return 0;
  if (time <= startTime) return 0;
  if (time >= endTime) return 1;
  return (time - startTime) / (endTime - startTime);
};

export interface ProgressBarProps {
  duration: number;
  progressSegments?: Array<ProgressSegment>;
  /**
   * 预览数据提供者（懒取值，供无 diff 框架下后到的数据使用）
   * 兼容两种形态：逐帧 data URL 数组（preview.bin）或雪碧图参数（sprite）
   */
  getPreviewSource?: () => ProgressPreviewSource | string[] | null;
}

/**
 * ProgressBar 挂载后向上层暴露的更新 API
 */
export interface ProgressBarApi {
  /** 更新已播放进度 */
  updateProgress: (time: number) => void;
  /** 更新缓冲进度 */
  updateBuffer: (buffer: number) => void;
  /** 更新视频总时长（元数据加载后由上层回传） */
  setDuration: (duration: number) => void;
  /** 重建进度条分段（progress.segments 运行时变化时由上层调用） */
  rebuildSegments: (segments?: ProgressSegment[]) => void;
}

export type ProgressBarEvents = {
  seek: number;
  seekStart: undefined;
  seekEnd: undefined;
  progressBarMounted: ProgressBarApi;
};

type ProgressStrategy = (
  vp: ProgressSegment,
  duration: number,
) => {
  left: string;
  width: string;
  marginRight?: string;
};

/**
 * 分段几何计算策略
 *
 * 与参考实现 `controls/index.ts` 的 strategies 一致：
 * - first：left 固定 0%，右侧留 0.15% 缺口 + 0.3% 间隔
 * - last：左侧让出 0.15% 缺口，右侧不留间隔
 * - default：两侧各让出 0.15% 缺口，右侧留 0.3% 间隔
 */
const strategies: Record<"first" | "last" | "default", ProgressStrategy> = {
  first: (vp, duration) => ({
    left: "0%",
    width: `${((vp.endTime - vp.startTime) / duration) * 100 - 0.15}%`,
    marginRight: "0.3%",
  }),
  last: (vp, duration) => ({
    left: `${(vp.startTime / duration) * 100 + 0.15}%`,
    width: `${((vp.endTime - vp.startTime) / duration) * 100 - 0.15}%`,
  }),
  default: (vp, duration) => ({
    left: `${(vp.startTime / duration) * 100 + 0.15}%`,
    width: `${((vp.endTime - vp.startTime) / duration) * 100 - 0.3}%`,
    marginRight: "0.3%",
  }),
};

/**
 * 计算单个分段的几何盒子（底部影子进度条与本进度条共用，保证两条完全对齐）
 *
 * @param segment - 分段数据
 * @param index - 分段下标
 * @param total - 分段总数
 * @param duration - 视频总时长（秒）
 * @returns left / width / marginRight 三个内联样式值
 */
export function computeSegmentBox(
  segment: ProgressSegment,
  index: number,
  total: number,
  duration: number,
): { left: string; width: string; marginRight?: string } {
  const strategy =
    index === 0 ? "first" : index === total - 1 ? "last" : "default";
  return strategies[strategy](segment, duration);
}


export const ProgressBar = defineComponent<ProgressBarProps, ProgressBarEvents>(
  (props, lifecycle) => {
    const { progressSegments: initialSegments } = props;

    /** 视频总时长（秒），初值取自 props，元数据加载后通过 setDuration 更新 */
    let duration = props.duration;

    /** 当前分段数据（挂载时为 props 快照，后续可经 rebuildSegments 整体替换） */
    let segments: ProgressSegment[] = initialSegments ?? [];

    // ============================================
    // DOM 引用
    // ============================================

    /** 进度条区域容器元素引用 */
    const progressAreaRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "progressAreaRef",
    );

    /** 进度条内层包裹元素引用 */
    const scheduleWrapRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "scheduleWrapRef",
    );

    /** 进度条外层包裹元素引用（悬停态 state-active 类挂载点，与既有实现一致） */
    const progressWrapRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "progressWrapRef",
    );

    /** 预览弹窗元素引用 */
    const popupRef = useTemplateRef<HTMLDivElement>(lifecycle, "popupRef");

    /** 预览时间文本元素引用 */
    const previewTimeRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "previewTimeRef",
    );

    /** 预览图元素引用（分段预览帧） */
    const previewImageRef = useTemplateRef<HTMLImageElement>(
      lifecycle,
      "previewImageRef",
    );

    /** 分段名称文本元素引用（预览弹窗左下角） */
    const hotspotRef = useTemplateRef<HTMLDivElement>(lifecycle, "hotspotRef");

    /** 移动指示器元素引用 */
    const moveIndicatorRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "moveIndicatorRef",
    );

    /** 光标元素引用 */
    const cursorRef = useTemplateRef<HTMLDivElement>(lifecycle, "cursorRef");

    /** 拖拽滑块元素引用 */
    const thumbRef = useTemplateRef<HTMLDivElement>(lifecycle, "thumbRef");

    // ============================================
    // 状态
    // ============================================

    /** 是否正在拖拽 */
    let isDragging = false;

    /** 悬停显示预览弹窗的延迟定时器 ID（与既有实现 mouseEnter 的 300ms 延迟一致） */
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;

    /** 悬停位置对应的时间（秒），供延迟显示弹窗时更新时间文本 */
    let hoverTime = 0;

    /** 拖拽时的鼠标移动处理函数引用 */
    let dragMouseMove: ((e: MouseEvent) => void) | null = null;

    /** 拖拽时的鼠标释放处理函数引用 */
    let dragMouseUp: ((e: MouseEvent) => void) | null = null;

    /** 是否已提示过非法分段，避免每次 timeupdate 重复打印 */
    let hasWarnedInvalidSegment = false;

    // ============================================
    // 辅助函数
    // ============================================

    /**
     * 根据鼠标位置计算时间
     * @param clientX - 鼠标 X 坐标
     * @returns 对应的时间（秒）
     */
    const getTimeFromX = (clientX: number): number => {
      if (!progressAreaRef.value || duration <= 0) return 0;
      /** 进度条区域的边界矩形 */
      const rect = progressAreaRef.value.getBoundingClientRect();
      /** 鼠标位置在进度条上的比例 (0-1) */
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * duration;
    };

    /**
     * 获取进度条容器内的分段基础元素列表（.player-progress-schedule）
     *
     * 说明：分段基础元素、缓冲条、已播放条均由 setupProgressElements / rebuildSegments
     * 通过 document.createElement 在运行时创建，模板 ref 无法绑定，
     * 只能以容器 scheduleWrapRef 为根用 querySelectorAll 检索；返回顺序与分段顺序一致。
     * @returns 分段基础元素数组（单分段 / 无分段时为长度 1）
     */
    const getScheduleElements = (): HTMLDivElement[] => {
      if (!scheduleWrapRef.value) return [];
      return Array.from(
        scheduleWrapRef.value.querySelectorAll<HTMLDivElement>(
          ".player-progress-schedule",
        ),
      );
    };

    /**
     * 解析当前生效的分段区间列表
     * - 多分段（length > 1）：直接使用各分段自身的 [startTime, endTime]，逐段独立计算进度
     * - 单分段 / 无分段：整条进度条视作一个 [0, duration] 分段，退化为整体比例
     * @returns 用于逐段计算的比例区间列表
     */
    const resolveSegments = (): Array<Pick<ProgressSegment, "startTime" | "endTime">> => {
      if (segments.length > 1) return segments;
      return [{ startTime: 0, endTime: duration }];
    };

    /**
     * 开发环境提示一次非法分段（endTime <= startTime），生产环境静默
     */
    const warnInvalidSegment = (): void => {
      if (hasWarnedInvalidSegment || !isDev()) return;
      hasWarnedInvalidSegment = true;
      logger.error(
        "[ProgressBar] 检测到非法分段（endTime <= startTime），已跳过该分段的进度渲染",
      );
    };

    /**
     * 按分段逐个更新指定子元素的填充比例
     *
     * 多分段时每个分段只表示自身 [startTime, endTime] 区间内的进度，
     * 因此同一时刻各分段填充比例不同；单分段 / 无分段时整条视作一个分段。
     * @param value - 当前时间或缓冲时间（秒）
     * @param childClass - 需要设置 scaleX 的子元素类名（缓冲条 / 已播放条）
     */
    const updateSegmentFills = (value: number, childClass: string): void => {
      const rangeList = resolveSegments();
      getScheduleElements().forEach((schedule, index) => {
        const range = rangeList[index];
        if (!range) return;
        // 脏分段（endTime <= startTime）跳过，避免除零产生 NaN/Infinity
        if (range.endTime <= range.startTime) {
          warnInvalidSegment();
          return;
        }
        /** 该分段自身的填充比例（0-1） */
        const ratio = computeSegmentRatio(
          value,
          range.startTime,
          range.endTime,
        );
        schedule
          .querySelectorAll<HTMLDivElement>(`.${childClass}`)
          .forEach((el) => {
            // SCSS 以 transform: scaleX 驱动进度条（transform-origin: 0 0）
            el.style.transform = `scaleX(${ratio})`;
          });
      });
    };

    /**
     * 更新缓冲条 UI
     * 缓冲条元素（.player-progress-schedule-buffer）由 setupProgressElements 动态创建，
     * 无法通过 useTemplateRef 绑定，故在 updateSegmentFills 中按容器检索子元素；
     * 缓冲按 buffered 时间范围与分段区间求交后计算比例（等价于 computeSegmentRatio(buffer, start, end)）
     * @param buffer - 缓冲时间（秒）
     */
    const updateBufferUI = (buffer: number): void => {
      if (duration <= 0) return;
      updateSegmentFills(buffer, "player-progress-schedule-buffer");
    };

    /**
     * 更新已播放进度 UI（各分段已播放条填充比例 + 拖拽滑块位置）
     * 参照既有实现 updateSegmentedProgress 与 updateThumbPosition
     * @param time - 当前播放时间（秒）
     */
    const updateProgressUI = (time: number): void => {
      // 边界处理：总时长非正时直接返回，避免除零得到 NaN/Infinity
      if (duration <= 0) return;

      // 更新各分段已播放进度条：每段按自身区间独立计算比例
      // 已播放条元素（.player-progress-schedule-current）同样动态创建，无法用 ref 绑定
      updateSegmentFills(time, "player-progress-schedule-current");

      // 滑块唯一：按当前时间在整条时间轴上的比例定位（与既有实现 updateThumbPosition 一致）
      // .player-progress-thumb 是 flex 子项、非 position:absolute，故用 translateX 而非 left
      if (thumbRef.value && progressAreaRef.value) {
        /** 滑块的水平偏移量（像素），按整条比例换算并减去滑块自身宽度的一半 */
        const position =
          (time / duration) * progressAreaRef.value.clientWidth - 10;
        thumbRef.value.style.transform = `translateX(${position}px)`;
      }
    };

    /**
     * 更新预览弹窗位置和时间（与既有实现 mouseMove 的位置算法一致：
     * 指示器贴边时弹窗随之收敛在可视范围内）
     * @param clientX - 鼠标 X 坐标
     */
    const updatePopup = (clientX: number): void => {
      if (!progressAreaRef.value || !popupRef.value) return;

      /** 进度条区域的边界矩形 */
      const rect = progressAreaRef.value.getBoundingClientRect();
      /** 鼠标位置相对进度条左侧的偏移（像素，钳制在 [0, width]） */
      const indicatorLeft = Math.min(
        Math.max(0, clientX - rect.left + 1),
        rect.width,
      );
      /** 鼠标位置对应的时间（秒） */
      hoverTime = (indicatorLeft / rect.width) * duration;

      // 更新预览时间文本
      if (previewTimeRef.value) {
        previewTimeRef.value.innerText = formatTime(hoverTime);
      }

      // 更新移动指示器位置
      if (moveIndicatorRef.value) {
        moveIndicatorRef.value.style.transform = `translateX(${indicatorLeft}px)`;
      }

      // 更新弹窗位置：贴左 / 贴右时收敛，其余时间居中于指针（与既有实现一致）
      /** 弹窗宽度（与既有实现的 160px 弹窗宽度一致） */
      const popupWidth = 160;
      let left: number;
      if (indicatorLeft <= 80) {
        left = 0;
      } else if (indicatorLeft >= rect.width - 80) {
        left = rect.width - popupWidth;
      } else {
        left = indicatorLeft - 80;
      }
      popupRef.value.style.left = `${left}px`;

      // 分段预览：按悬停时间取对应预览帧，并在弹窗内显示所在分段的名称
      updatePreviewFrame(hoverTime);
      updateHotspotLabel(hoverTime);
    };

    /**
     * 更新预览图（兼容雪碧图与逐帧两种数据源）
     * @param time - 悬停时间（秒）
     */
    const updatePreviewFrame = (time: number): void => {
      const image = previewImageRef.value;
      if (!image) return;

      const slice = resolveProgressPreviewSlice(
        props.getPreviewSource?.() ?? null,
        time,
        duration,
      );

      if (!slice) {
        image.removeAttribute("src");
        image.removeAttribute("style");
        return;
      }

      if (image.getAttribute("src") !== slice.url) {
        image.setAttribute("src", slice.url);
      }

      if (slice.sprite) {
        image.style.width = slice.sprite.width;
        image.style.height = slice.sprite.height;
        image.style.objectFit = slice.sprite.objectFit;
        image.style.objectPosition = slice.sprite.objectPosition;
        return;
      }

      image.style.width = "";
      image.style.height = "";
      image.style.objectFit = "";
      image.style.objectPosition = "";
    };

    /**
     * 更新预览弹窗内的分段名称（命中 [startTime, endTime) 的分段）
     * @param time - 悬停时间（秒）
     */
    const updateHotspotLabel = (time: number): void => {
      const hotspot = hotspotRef.value;
      if (!hotspot) return;
      const hit = segments.find(
        (segment) => time >= segment.startTime && time < segment.endTime,
      );
      const text = segments.length > 1 && hit ? hit.label : "";
      if (hotspot.textContent !== text) {
        hotspot.textContent = text;
      }
    };

    /**
     * 鼠标进入进度条区域：300ms 延迟后为 .player-progress-wrap 添加 state-active 类
     * （弹窗与指示器的显隐由该类配合 CSS 控制，与既有实现 mouseEnter 行为一致）
     */
    const handleMouseEnter = (): void => {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
      }
      hoverTimer = setTimeout(() => {
        if (progressWrapRef.value) {
          progressWrapRef.value.classList.add("state-active");
        }
        if (previewTimeRef.value) {
          previewTimeRef.value.innerText = formatTime(hoverTime);
        }
        hoverTimer = null;
      }, 300);
    };

    // ============================================
    // 事件处理函数
    // ============================================

    /**
     * 鼠标移动处理，更新预览弹窗、移动指示器和光标位置
     */
    const handleMouseMove = (event: MouseEvent): void => {
      event.preventDefault();
      if (isDragging) return;
      updatePopup(event.clientX);

      // 更新光标位置
      if (cursorRef.value && progressAreaRef.value) {
        /** 进度条区域的边界矩形 */
        const rect = progressAreaRef.value.getBoundingClientRect();
        /** 鼠标位置在进度条上的比例 (0-1) */
        const ratio = Math.max(
          0,
          Math.min(1, (event.clientX - rect.left) / rect.width),
        );
        cursorRef.value.style.left = `${ratio * 100}%`;
      }
    };

    /**
     * 鼠标按下处理（与既有实现 handleMouseDown 一致：点击立即跳转，
     * 随后进入拖拽状态，拖拽过程中连续 seek）
     */
    const handleMouseDown = (event: MouseEvent): void => {
      if (!isBrowser()) return;
      event.preventDefault();
      isDragging = true;

      lifecycle.emit?.("seekStart");

      // 点击立即 seek（与既有实现一致）
      /** 按下位置对应的时间 */
      const initialTime = getTimeFromX(event.clientX);
      updateProgressUI(initialTime);
      lifecycle.emit?.("seek", initialTime);

      /**
       * 拖拽过程中鼠标移动的处理函数：连续 seek（挂载在 document 上）
       */
      const onMouseMove = (e: MouseEvent): void => {
        if (!isDragging) return;
        e.preventDefault();
        /** 拖拽位置对应的时间 */
        const t = getTimeFromX(e.clientX);
        updateProgressUI(t);
        updatePopup(e.clientX);
        lifecycle.emit?.("seek", t);
      };

      /**
       * 拖拽结束时鼠标释放的处理函数
       */
      const onMouseUp = (): void => {
        isDragging = false;
        lifecycle.emit?.("seekEnd");

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        dragMouseMove = null;
        dragMouseUp = null;
      };

      dragMouseMove = onMouseMove;
      dragMouseUp = onMouseUp;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    /**
     * 鼠标离开进度条区域时移除 state-active 类（收起预览弹窗与指示器）
     */
    const handleMouseLeave = (): void => {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      if (!isDragging && progressWrapRef.value) {
        progressWrapRef.value.classList.remove("state-active");
      }
    };

    /**
     * 创建缓冲进度条元素
     * @returns 缓冲进度条元素
     */
    const createBufferElement = (): HTMLDivElement => {
      const buffer = document.createElement("div");
      buffer.classList.add("player-progress-schedule-buffer");
      buffer.style.transform = "scaleX(0)";
      return buffer;
    };
    /**
     * 创建当前进度条元素
     * @returns 当前进度条元素
     */
    const createCurrentElement = (): HTMLDivElement => {
      const current = document.createElement("div");
      current.classList.add("player-progress-schedule-current");
      current.style.transform = "scaleX(0)";
      return current;
    };

    /**
     * 创建基础进度条元素
     * @param hasSegments 是否有分段
     * @returns 基础进度条元素
     */
    const createBaseElement = (hasSegments: boolean): HTMLDivElement => {
      const element = document.createElement("div");
      element.classList.add(
        "player-progress-schedule",
        ...(hasSegments ? ["player-progress-schedule-segment"] : []),
      );
      return element;
    };

    /**
     * 为视点分配进度条元素
     * @param bufferElement 缓冲进度条元素
     * @param currentElement 当前进度条元素
     * @param index 视点索引
     * @param isNew 是否为新创建的元素
     * @param viewPoint 视点对象
     */
    const assignElementsToViewPoint = (
      bufferElement: HTMLDivElement,
      currentElement: HTMLDivElement,
      index: number = 0,
      isNew: boolean = false,
      viewPoint?: ProgressSegment,
    ): void => {
      if (isNew && viewPoint !== undefined) {
        viewPoint.bufferElement = bufferElement;
        viewPoint.currentElement = currentElement;
        return;
      }
      if (segments.length > 1) {
        segments[index].bufferElement = bufferElement;
        segments[index].currentElement = currentElement;
      } else if (segments.length === 1) {
        segments[0].bufferElement = bufferElement;
        segments[0].currentElement = currentElement;
      }
    };

    /**
     * 创建进度条元素
     * @param hasSegments 是否有分段
     * @param index 视点索引
     * @param isNew 是否为新创建的元素
     * @param viewPoint 视点对象
     * @returns 进度条元素
     */
    const createProgressElement = (
      hasSegments: boolean,
      index?: number,
      isNew: boolean = false,
      progressSegment?: ProgressSegment,
    ): HTMLDivElement => {
      const progress = createBaseElement(hasSegments);
      const bufferElement = createBufferElement();
      const currentElement = createCurrentElement();

      assignElementsToViewPoint(
        bufferElement,
        currentElement,
        index,
        isNew,
        progressSegment,
      );

      [bufferElement, currentElement].forEach((child) => {
        progress.appendChild(child);
      });

      return progress;
    };

    /**
     * 应用进度条样式（几何计算与底部影子进度条共用 computeSegmentBox）
     * @param element 进度条元素
     * @param progressSegment 视点对象
     * @param index 视点索引
     * @param total 视点总数
     * @param duration 视频总时长
     */
    const applyProgressStyle = (
      element: HTMLDivElement,
      progressSegment: ProgressSegment,
      index: number,
      total: number,
      duration: number,
    ): void => {
      const { left, width, marginRight } = computeSegmentBox(
        progressSegment,
        index,
        total,
        duration,
      );

      element.style.left = left;
      element.style.width = width;
      if (marginRight) {
        element.style.marginRight = marginRight;
      } else {
        element.style.removeProperty("margin-right");
      }
    };

    /**
     * 处理进度点鼠标移动事件
     * @param element 进度点元素
     * @param event 鼠标事件
     */
    const progressPointMove = (
      element: HTMLDivElement,
      event: MouseEvent,
    ): void => {
      event.preventDefault();
      element.classList.add("hover");
    };
    /**
     * 处理进度点鼠标离开事件
     * @param element 进度点元素
     * @param event 鼠标事件
     */
    const progressPointLeave = (
      element: HTMLDivElement,
      event: MouseEvent,
    ): void => {
      event.preventDefault();
      element.classList.remove("hover");
    };

    /**
     * 创建并追加进度条元素
     * @param hasMultipleSegments 是否有多个分段
     * @param viewPoint 视点对象
     * @param index 视点索引
     */
    const createAndAppend = (
      hasMultipleSegments: boolean,
      progressSegment?: ProgressSegment,
      index?: number,
    ): void => {
      const progress = createProgressElement(hasMultipleSegments, index!);
      if (
        progressSegment &&
        typeof index === "number" &&
        index !== undefined &&
        segments.length > 0
      ) {
        applyProgressStyle(
          progress,
          progressSegment,
          index,
          segments.length,
          duration,
        );
        progress.onmouseenter = (event: MouseEvent): void => {
          progressPointMove(progress, event);
        };
        progress.onmouseleave = (event: MouseEvent): void => {
          progressPointLeave(progress, event);
        };
      }
      if (segments.length > 1 && index !== undefined) {
        segments[index].element = progress;
      } else if (segments.length === 1) {
        segments[0].element = progress;
      }
      scheduleWrapRef.value?.appendChild(progress);
    };

    /**
     * 重建分段 DOM
     *
     * 分段数量 / 区间发生运行时变化（如配置动态更新）时调用：
     * 清空容器内旧的分段元素，并按最新的分段数据重新创建各分段的 buffer / current 元素。
     * @param nextSegments 最新的分段数据；不传则沿用当前数据重建
     */
    const rebuildSegments = (nextSegments?: ProgressSegment[]): void => {
      if (nextSegments) {
        segments = nextSegments;
      }
      if (!scheduleWrapRef.value) return;
      // 清空旧 DOM，并清理分段对象上已失效的元素引用
      scheduleWrapRef.value.innerHTML = "";
      segments.forEach((segment) => {
        segment.element = undefined;
        segment.bufferElement = undefined;
        segment.currentElement = undefined;
      });
      setupProgressElements();
    };

    /**
     * 设置进度条元素
     */
    const setupProgressElements = (): void => {
      const hasMultipleSegments = segments.length > 1;
      if (hasMultipleSegments) {
        segments.forEach((progressSegment, index) => {
          createAndAppend(hasMultipleSegments, progressSegment, index);
        });
      } else {
        createAndAppend(hasMultipleSegments);
      }
    };

    // ============================================
    // API 方法
    // ============================================

    /**
     * 更新播放进度
     */
    const updateProgress = (time: number): void => {
      updateProgressUI(time);
    };

    /**
     * 更新缓冲进度
     */
    const updateBuffer = (buffer: number): void => {
      updateBufferUI(buffer);
    };

    /**
     * 更新视频总时长
     * 组件挂载时 props.duration 可能仍为 0，元数据加载后由上层通过该 API 回传
     */
    const setDuration = (value: number): void => {
      duration = value;
    };

    // ============================================
    // 生命周期钩子
    // ============================================

    /**
     * 组件挂载后，初始化进度条状态并向上层暴露更新方法
     */
    lifecycle.onMounted = (): void => {
      // 按当前分段数据初始化（后续分段变化可再次调用 rebuildSegments）
      rebuildSegments();
      lifecycle.emit?.("progressBarMounted", {
        updateProgress,
        updateBuffer,
        setDuration,
        rebuildSegments,
      });
    };

    /**
     * 组件销毁前，移除 document 级别的事件监听并重置拖拽状态
     *
     * 幂等：既是统一卸载入口（最深子组件 → 根），也是契约钩子。
     */
    const teardown = (): void => {
      isDragging = false;
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      if (dragMouseMove) {
        document.removeEventListener("mousemove", dragMouseMove);
        dragMouseMove = null;
      }
      if (dragMouseUp) {
        document.removeEventListener("mouseup", dragMouseUp);
        dragMouseUp = null;
      }
    };

    useComponentUnmount(lifecycle, teardown);
    lifecycle.onBeforeDestroy = teardown;

    // ============================================
    // 主渲染函数
    // ============================================
    return h(
      "div",
      {
        class: "player-progress-area",
        ref: "progressAreaRef",
        onMouseEnter: handleMouseEnter,
        onMouseMove: handleMouseMove,
        onMouseDown: handleMouseDown,
        onMouseLeave: handleMouseLeave,
      },
      h(
        "div",
        { class: "player-progress-wrap", ref: "progressWrapRef" },
        h(
          "div",
          { class: "player-progress", style: { height: "4px" } },
          // 当前播放进度条
          h("div", {
            class: "player-progress-schedule-wrap",
            ref: "scheduleWrapRef",
          }),
          // 进度点容器
          h("div", { class: "player-progress-point-wrap" }),
          // 拖拽滑块
          h(
            "div",
            {
              class: "player-progress-thumb",
              ref: "thumbRef",
              style: { left: "0%" },
            },
            h(
              "div",
              {
                class:
                  "player-progress-thumb-icon player-progress-thumb-icon-dynamic player-progress-thumb-active",
              },
              h("span", { class: "common-svg-icon" }),
            ),
          ),
          // 移动指示器
          h(
            "div",
            {
              class: "player-progress-move-indicator",
              ref: "moveIndicatorRef",
            },
            h("div", { class: "player-progress-move-indicator-down" }),
            h("div", { class: "player-progress-move-indicator-up" }),
          ),
          // 预览弹窗（显隐由 .player-progress-wrap 的 state-active 类配合 CSS 控制）
          h(
            "div",
            {
              class: "player-progress-popup",
              ref: "popupRef",
            },
            h(
              "div",
              { class: "player-progress-preview" },
              h("img", {
                class: "player-progress-preview-image",
                ref: "previewImageRef",
              }),
              h("div", {
                class: "player-progress-preview-time",
                ref: "previewTimeRef",
              }),
            ),
            h("div", { class: "player-progress-hotspot", ref: "hotspotRef" }),
          ),
          // 拉拽指示器
          h(
            "div",
            {
              class: "player-progress-pull-indicator",
              style: { transform: "translateX(0px)" },
            },
            h("span", { class: "common-svg-icon" }),
          ),
          // 光标
          h("div", { class: "player-progress-cursor", ref: "cursorRef" }),
        ),
      ),
    );
  },
);
