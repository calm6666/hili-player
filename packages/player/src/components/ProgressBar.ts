import { h, defineComponent, useTemplateRef } from "@/core";
import type { VNode } from "@/types";
import type { ProgressSegment } from "@/types";
import { isBrowser } from "@/utils";
import { formatTime } from "@/utils/formatTime";

export interface ProgressBarProps {
  duration: number;
  progressSegments?: Array<ProgressSegment>;
}

export type ProgressBarEvents = {
  seek: number;
  seekStart: undefined;
  seekEnd: undefined;
  progressBarMounted: {
    updateProgress: (time: number) => void;
    updateBuffer: (buffer: number) => void;
  };
};

type ProgressStrategy = (
  vp: ProgressSegment,
  duration: number,
) => {
  left: string;
  width: string;
  marginRight?: string;
};

export const ProgressBar = defineComponent<ProgressBarProps, ProgressBarEvents>(
  (props, lifecycle) => {
    const { duration, progressSegments } = props;

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

    /** 缓冲进度条元素引用 */
    const bufferBarRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "bufferBarRef",
    );

    /** 预览弹窗元素引用 */
    const popupRef = useTemplateRef<HTMLDivElement>(lifecycle, "popupRef");

    /** 预览时间文本元素引用 */
    const previewTimeRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "previewTimeRef",
    );

    /** 光标元素引用 */
    const cursorRef = useTemplateRef<HTMLDivElement>(lifecycle, "cursorRef");

    // ============================================
    // 状态
    // ============================================

    /** 是否正在拖拽 */
    let isDragging = false;

    /** 拖拽时的鼠标移动处理函数引用 */
    let dragMouseMove: ((e: MouseEvent) => void) | null = null;

    /** 拖拽时的鼠标释放处理函数引用 */
    let dragMouseUp: ((e: MouseEvent) => void) | null = null;

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
     * 更新缓冲条 UI
     * @param buffer - 缓冲时间（秒）
     */
    const updateBufferUI = (buffer: number): void => {
      if (duration <= 0) return;
      /** 缓冲时间占总时长的百分比 */
      const percent = Math.max(0, Math.min(100, (buffer / duration) * 100));
      if (bufferBarRef.value) {
        bufferBarRef.value.style.width = `${percent}%`;
      }
    };

    /**
     * 更新预览弹窗位置和时间
     * @param clientX - 鼠标 X 坐标
     */
    const updatePopup = (clientX: number): void => {
      if (!progressAreaRef.value || !popupRef.value) return;

      /** 进度条区域的边界矩形 */
      const rect = progressAreaRef.value.getBoundingClientRect();
      /** 鼠标位置在进度条上的比例 (0-1) */
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      /** 鼠标位置对应的时间（秒） */
      const time = ratio * duration;

      // 更新预览时间文本
      if (previewTimeRef.value) {
        previewTimeRef.value.innerText = formatTime(time);
      }

      // 更新弹窗位置
      /** 弹窗宽度 */
      const popupWidth = popupRef.value.offsetWidth || 120;
      /** 弹窗左侧偏移量 */
      let left = ratio * rect.width - popupWidth / 2;
      left = Math.max(0, Math.min(left, rect.width - popupWidth));
      popupRef.value.style.left = `${left}px`;
      popupRef.value.style.display = "";
    };

    /**
     * 隐藏预览弹窗
     */
    const hidePopup = (): void => {
      if (popupRef.value) {
        popupRef.value.style.display = "none";
      }
    };

    // ============================================
    // 事件处理函数
    // ============================================

    /**
     * 鼠标移动处理，更新预览弹窗和光标位置
     */
    const handleMouseMove = (event: MouseEvent): void => {
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
     * 鼠标按下处理 - 开始拖拽
     */
    const handleMouseDown = (event: MouseEvent): void => {
      if (!isBrowser()) return;
      event.preventDefault();
      isDragging = true;

      /** 鼠标位置对应的时间 */
      // const time = getTimeFromX(event.clientX);
      // updateProgressUI(time);

      lifecycle.emit?.("seekStart");

      /**
       * 拖拽过程中鼠标移动的处理函数
       */
      const onMouseMove = (e: MouseEvent): void => {
        if (!isDragging) return;
        /** 鼠标位置对应的时间 */
        // const t = getTimeFromX(e.clientX);
        // updateProgressUI(t);
        updatePopup(e.clientX);
      };

      /**
       * 拖拽结束时鼠标释放的处理函数
       */
      const onMouseUp = (e: MouseEvent): void => {
        isDragging = false;
        /** 鼠标释放位置对应的时间 */
        const t = getTimeFromX(e.clientX);
        // updateProgressUI(t);
        lifecycle.emit?.("seek", t);
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
     * 鼠标离开进度条区域时隐藏预览弹窗
     */
    const handleMouseLeave = (): void => {
      if (!isDragging) {
        hidePopup();
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
     * 计算基础样式与偏移量的策略
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
     * 为视点分配进度条元素
     * @param bufferElement 缓冲进度条元素
     * @param currentElement 当前进度条元素
     * @param textElement 文本元素
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
      if (progressSegments && progressSegments.length > 1) {
        progressSegments[index].bufferElement = bufferElement;
        progressSegments[index].currentElement = currentElement;
      } else if (progressSegments && progressSegments.length === 1) {
        progressSegments[0].bufferElement = bufferElement;
        progressSegments[0].currentElement = currentElement;
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
     * 应用进度条样式
     * @param element 进度条元素
     * @param shadowElement 阴影进度条元素
     * @param viewPoint 视点对象
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
      const strategy =
        index === 0 ? "first" : index === total - 1 ? "last" : "default";

      const { left, width, marginRight } = strategies[strategy](
        progressSegment,
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
      console.log(
        `Created progress element for view point ${index}:`,
        progress,
        progressSegment,
      );
      if (
        progressSegment &&
        typeof index === "number" &&
        index !== undefined &&
        progressSegments
      ) {
        applyProgressStyle(
          progress,
          progressSegment,
          index,
          progressSegments.length,
          duration,
        );
        progress.onmouseenter = (event: MouseEvent): void => {
          progressPointMove(progress, event);
        };
        progress.onmouseleave = (event: MouseEvent): void => {
          progressPointLeave(progress, event);
        };
      }
      if (
        progressSegments &&
        progressSegments.length > 1 &&
        index !== undefined
      ) {
        progressSegments[index].element = progress;
      } else if (progressSegments && progressSegments.length === 1) {
        progressSegments[0].element = progress;
        console.log(
          "Assigned progress element to single view point:",
          progressSegments,
        );
      }
      scheduleWrapRef.value?.appendChild(progress);
    };

    /**
     * 设置进度条元素
     */
    const setupProgressElements = (): void => {
      const hasMultipleSegments =
        (progressSegments && progressSegments.length > 1) || false;
      if (hasMultipleSegments && progressSegments) {
        progressSegments.forEach((progressSegment, index) => {
          createAndAppend(hasMultipleSegments, progressSegment, index);
        });
        // if (this.isEdit) {
        //   this.playerShadowProgressArea?.classList.add("permanent");
        // }
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
      // updateProgressUI(time);
    };

    /**
     * 更新缓冲进度
     */
    const updateBuffer = (buffer: number): void => {
      updateBufferUI(buffer);
    };

    // ============================================
    // 生命周期钩子
    // ============================================

    /**
     * 组件挂载后，初始化进度条状态并向上层暴露更新方法
     */
    lifecycle.onMounted = (): void => {
      // updateProgressUI(0);
      // updateBufferUI(0);
      setupProgressElements();
      hidePopup();
      console.log("[ProgressBar] 组件挂载完成", progressAreaRef.value);
      lifecycle.emit?.("progressBarMounted", { updateProgress, updateBuffer });
    };

    /**
     * 组件销毁前，移除 document 级别的事件监听并重置拖拽状态
     */
    lifecycle.onBeforeDestroy = (): void => {
      isDragging = false;
      if (dragMouseMove) {
        document.removeEventListener("mousemove", dragMouseMove);
        dragMouseMove = null;
      }
      if (dragMouseUp) {
        document.removeEventListener("mouseup", dragMouseUp);
        dragMouseUp = null;
      }
    };

    // ============================================
    // 主渲染函数
    // ============================================
    return h(
      "div",
      {
        class: "player-progress-area",
        ref: "progressAreaRef",
        onMouseMove: handleMouseMove,
        onMouseDown: handleMouseDown,
        onMouseLeave: handleMouseLeave,
      },
      h(
        "div",
        { class: "player-progress-wrap" },
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
            },
            h("div", { class: "player-progress-move-indicator-down" }),
            h("div", { class: "player-progress-move-indicator-up" }),
          ),
          // 预览弹窗
          h(
            "div",
            {
              class: "player-progress-popup",
              ref: "popupRef",
              style: { display: "none" },
            },
            h(
              "div",
              { class: "player-progress-preview" },
              h("img", {
                class: "player-progress-preview-image",
              }),
              h("div", {
                class: "player-progress-preview-time",
                ref: "previewTimeRef",
              }),
            ),
            h("div", { class: "player-progress-hotspot" }),
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
