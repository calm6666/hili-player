/**
 * ============================================
 * 卡片拖拽编辑器 — 仅在 edit 模式下激活
 * ============================================
 * 为交互卡片提供拖拽定位能力，通过 CSS 变量 --top/--left 控制位置
 */

export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  target: HTMLDivElement | null;
  initialTop: number;
  initialLeft: number;
}

/**
 * 在编辑模式下绑定拖拽功能
 *
 * @param element - 需要拖拽的卡片元素
 * @param onPositionChange - 拖拽结束后的位置回调，返回 top/left 百分比值
 * @returns 清理函数，调用后移除所有事件监听
 */
export function bindDragInEditMode(
  element: HTMLDivElement,
  onPositionChange: (top: number, left: number) => void
): () => void {
  const state: DragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    target: null,
    initialTop: 0,
    initialLeft: 0,
  };

  /** 从 CSS 变量读取当前 top/left 百分比 */
  function readPosition(el: HTMLDivElement): { top: number; left: number } {
    const style = getComputedStyle(el);
    const top = parseFloat(style.getPropertyValue('--top')) || 0;
    const left = parseFloat(style.getPropertyValue('--left')) || 0;
    return { top, left };
  }

  /** 将 top/left 百分比写入 CSS 变量 */
  function applyPosition(el: HTMLDivElement, top: number, left: number): void {
    el.style.setProperty('--top', `${top}%`);
    el.style.setProperty('--left', `${left}%`);
  }

  function onMouseDown(e: MouseEvent): void {
    // 只响应左键
    if (e.button !== 0) return;
    e.preventDefault();

    const pos = readPosition(element);
    state.isDragging = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.target = element;
    state.initialTop = pos.top;
    state.initialLeft = pos.left;

    // 拖拽时提升层级
    element.style.zIndex = '9999';
    element.style.cursor = 'grabbing';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent): void {
    if (!state.isDragging || !state.target) return;

    const parent = state.target.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();

    // 计算像素偏移量转换为百分比
    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    const percentX = (deltaX / parentRect.width) * 100;
    const percentY = (deltaY / parentRect.height) * 100;

    // 限制在 0-100 范围内
    const newTop = Math.max(0, Math.min(100, state.initialTop + percentY));
    const newLeft = Math.max(0, Math.min(100, state.initialLeft + percentX));

    applyPosition(state.target, newTop, newLeft);
  }

  function onMouseUp(): void {
    if (!state.isDragging || !state.target) return;

    const pos = readPosition(state.target);

    // 恢复样式
    state.target.style.zIndex = '';
    state.target.style.cursor = '';

    state.isDragging = false;
    state.target = null;

    // 通知位置变更
    onPositionChange(pos.top, pos.left);

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  // 绑定 mousedown
  element.style.cursor = 'grab';
  element.addEventListener('mousedown', onMouseDown);

  // 返回清理函数
  return () => {
    element.style.cursor = '';
    element.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}
