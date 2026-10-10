/**
 * ============================================
 * 卡片拖拽编辑器 — 仅在 edit 模式下激活
 * ============================================
 * 为交互卡片提供拖拽定位能力，通过 CSS 变量 --top/--left 控制位置
 *
 * 对齐参考实现（rowcmd）的完整行为：
 * - 边界夹取：按卡片自身尺寸计算允许拖拽范围（视觉边缘保留 SAFE_MARGIN 安全边距）
 * - 贴边辅助线：拖拽贴边时经 onAlignLines 回调向外报告「视觉安全边界」位置
 *   （左 3% / 右 97% / 上 5% / 下 85%，即卡片边缘贴到的极限位置），
 *   辅助线 UI 由响应式组件 AlignLines 渲染（本模块不再直接操作辅助线 DOM）
 * - 拖拽结束：报告全部隐藏并回调最终位置（百分比）
 *
 * 保留的命令式 DOM 操作（性能关键逐帧场景，符合框架规范）：
 * - 卡片自身的 --top/--left 定位（拖拽逐帧跟随，走响应式反而引入延迟）
 * - 拖拽期间的 zIndex / cursor 提示
 */

/** 拖拽过程状态 */
interface DragState {
  isDragging: boolean;
  /** mousedown 时的鼠标 clientX/clientY */
  startClientX: number;
  startClientY: number;
  /** mousedown 时卡片的布局位置（offsetLeft/offsetTop，px） */
  startOffsetLeft: number;
  startOffsetTop: number;
  /** 允许拖拽的边界（百分比，相对卡片定位参照容器） */
  minLeft: number;
  minTop: number;
  maxLeft: number;
  maxTop: number;
}

/**
 * 拖拽安全边距（百分比）：卡片视觉边缘距容器边缘的最小保留空间
 *
 * 辅助线语义：四根线画在「视觉安全边界」处（左 3% / 右 97% / 上 5% / 下 85%），
 * 即卡片边缘被夹取贴边时能达到的极限位置——"卡片不能拖出这条线"，
 * 与卡片自身尺寸无关；底部 15% 预留控制栏空间
 */
export const SAFE_MARGIN = {
  left: 3,
  right: 3,
  top: 5,
  bottom: 15,
} as const;

/**
 * 拖拽贴边时活跃的对齐辅助线（null = 全部隐藏）
 *
 * 语义：某方向贴边时携带该边界的「视觉安全边界」百分比位置（线的绘制位置，
 * 与卡片尺寸无关，区别于含半宽/半高偏移的布局位置）；
 * 对应的 -show 显隐由消费方（AlignLines 组件）依据字段是否存在推导
 */
export interface AlignLineBounds {
  /** 左缘贴边：左竖线位置（= 容器左起 SAFE_MARGIN.left%，即 3%） */
  left?: number;
  /** 右缘贴边：右竖线位置（= 容器左起 100 - SAFE_MARGIN.right%，即 97%） */
  right?: number;
  /** 顶缘贴边：上横线位置（= 容器顶部 SAFE_MARGIN.top%，即 5%） */
  top?: number;
  /** 底缘贴边：下横线位置（= 容器顶部 100 - SAFE_MARGIN.bottom%，即 85%） */
  bottom?: number;
}

/**
 * 获取卡片绝对定位的参照容器（即最近的可定位祖先元素）
 * 卡片的 --top/--left 百分比即相对该容器解析
 */
function getPositionContainer(element: HTMLDivElement): HTMLElement | null {
  const offsetParent = element.offsetParent;
  if (offsetParent instanceof HTMLElement) return offsetParent;
  return element.parentElement;
}

/**
 * 计算卡片允许拖拽的边界（百分比）
 *
 * 卡片使用 translate(-50%, -50%) 居中于 --top/--left 百分比位置，
 * 因此布局位置（left% 值）需要加上半个卡片宽高的偏移量，
 * 才能保证视觉边缘不越过容器边界：
 * - 视觉左缘 >= 3%   → 布局位置 >= offsetX*100 + 3
 * - 视觉顶缘 >= 5%   → 布局位置 >= offsetY*100 + 5
 * - 视觉右缘 <= 97%  → 布局位置 <= 100 - offsetX*100 - 3
 * - 视觉底缘 <= 85%  → 布局位置 <= 100 - offsetY*100 - 15（底部预留控制栏空间）
 */
function computeDragBounds(
  element: HTMLDivElement,
  container: HTMLElement,
): Pick<DragState, "minLeft" | "minTop" | "maxLeft" | "maxTop"> {
  // 半宽/半高占容器尺寸的比例（%）
  const offsetX = element.clientWidth / (2 * container.clientWidth);
  const offsetY = element.clientHeight / (2 * container.clientHeight);
  return {
    minLeft: offsetX * 100 + SAFE_MARGIN.left,
    minTop: offsetY * 100 + SAFE_MARGIN.top,
    maxLeft: 100 - offsetX * 100 - SAFE_MARGIN.right,
    maxTop: 100 - offsetY * 100 - SAFE_MARGIN.bottom,
  };
}

/**
 * 在编辑模式下绑定拖拽功能
 *
 * @param element - 需要拖拽的卡片元素
 * @param onPositionChange - 拖拽结束后的位置回调，返回 top/left 百分比值
 * @param onAlignLines - 贴边辅助线回调：拖拽过程中随贴边状态持续触发
 *   （携带边界位置或 null=隐藏全部），拖拽结束时以 null 收尾
 * @returns 清理函数，调用后移除所有事件监听
 */
export function bindDragInEditMode(
  element: HTMLDivElement,
  onPositionChange: (top: number, left: number) => void,
  onAlignLines?: (bounds: AlignLineBounds | null) => void,
): () => void {
  const state: DragState = {
    isDragging: false,
    startClientX: 0,
    startClientY: 0,
    startOffsetLeft: 0,
    startOffsetTop: 0,
    minLeft: 0,
    minTop: 0,
    maxLeft: 100,
    maxTop: 100,
  };

  /** 拖拽结束时的最终位置（百分比），mouseUp 时回调用 */
  let finalTop = 0;
  let finalLeft = 0;

  function onMouseDown(e: MouseEvent): void {
    // 只响应左键
    if (e.button !== 0) return;
    const container = getPositionContainer(element);
    if (!container) return;
    e.preventDefault();

    // 计算本次拖拽的边界（卡片尺寸可能变化，每次按下时重新计算）
    const bounds = computeDragBounds(element, container);
    state.isDragging = true;
    state.startClientX = e.clientX;
    state.startClientY = e.clientY;
    state.startOffsetLeft = element.offsetLeft;
    state.startOffsetTop = element.offsetTop;
    state.minLeft = bounds.minLeft;
    state.minTop = bounds.minTop;
    state.maxLeft = bounds.maxLeft;
    state.maxTop = bounds.maxTop;

    // 拖拽时提升层级
    element.style.zIndex = "9999";
    element.style.cursor = "grabbing";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent): void {
    if (!state.isDragging) return;
    const container = getPositionContainer(element);
    if (!container) return;

    // 像素位移换算为容器百分比（对齐参考实现 offsetLeft + 位移 的口径）
    const deltaX = e.clientX - state.startClientX;
    const deltaY = e.clientY - state.startClientY;
    let newLeft =
      ((state.startOffsetLeft + deltaX) / container.clientWidth) * 100;
    let newTop =
      ((state.startOffsetTop + deltaY) / container.clientHeight) * 100;

    // 边界夹取：保证卡片视觉边缘不越过容器安全区
    newLeft = Math.min(Math.max(state.minLeft, newLeft), state.maxLeft);
    newTop = Math.min(Math.max(state.minTop, newTop), state.maxTop);
    finalLeft = newLeft;
    finalTop = newTop;

    element.style.setProperty("--top", `${newTop}%`);
    element.style.setProperty("--left", `${newLeft}%`);

    // 贴边时向外报告辅助线边界（未定义字段即隐藏对应线段）
    // 线位置 = 视觉安全边界（卡片边缘贴到的极限位置），与卡片尺寸无关：
    // 若报告含半宽偏移的布局位置（minLeft/maxLeft），线会画到卡片中心
    if (onAlignLines) {
      const bounds: AlignLineBounds = {};
      if (newLeft <= state.minLeft) {
        bounds.left = SAFE_MARGIN.left;
      } else if (newLeft >= state.maxLeft) {
        bounds.right = 100 - SAFE_MARGIN.right;
      }
      if (newTop <= state.minTop) {
        bounds.top = SAFE_MARGIN.top;
      } else if (newTop >= state.maxTop) {
        bounds.bottom = 100 - SAFE_MARGIN.bottom;
      }
      onAlignLines(bounds);
    }
  }

  function onMouseUp(): void {
    if (!state.isDragging) return;

    // 恢复样式
    element.style.zIndex = "";
    element.style.cursor = "";

    // 辅助线全部隐藏
    if (onAlignLines) {
      onAlignLines(null);
    }

    state.isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    // 通知位置变更
    onPositionChange(finalTop, finalLeft);
  }

  // 绑定 mousedown
  element.style.cursor = "grab";
  element.addEventListener("mousedown", onMouseDown);

  // 返回清理函数
  return () => {
    element.style.cursor = "";
    element.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };
}
