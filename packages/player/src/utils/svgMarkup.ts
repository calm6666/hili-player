/**
 * SVG 标记 → 元素
 *
 * 用于「必须保留原样」的图标与图表：不重抄 path、不用 innerHTML，
 * 而是把标记文本交给浏览器解析后整颗挂载（保留 defs / filter / use 等结构）。
 */

/**
 * 解析一段以 <svg> 为根的标记文本
 * @param markup - SVG 标记文本
 * @returns 解析出的 svg 元素；环境不支持或标记非法时返回 null
 */
export function parseSvgMarkup(markup: string): SVGElement | null {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const root = parsed.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') return null;
    return root as unknown as SVGElement;
  } catch {
    return null;
  }
}

/**
 * 用一段 SVG 标记替换容器的全部子节点
 * @param container - 目标容器
 * @param markup - SVG 标记文本
 */
export function renderSvgMarkup(container: Element | null, markup: string): void {
  if (!container) return;
  const root = parseSvgMarkup(markup);
  if (!root) {
    container.replaceChildren();
    return;
  }
  container.replaceChildren(root);
}
