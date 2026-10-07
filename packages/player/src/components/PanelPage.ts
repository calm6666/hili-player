/**
 * 分页面板（.ui-panel-wrap / .ui-panel-move / .ui-panel-item）的切页与复位
 *
 * 两页并排放在 .ui-panel-move 上，切页 = 目标页加 .ui-panel-item-active ＋ move 位移
 * 一页宽 ＋ 外框（.ui-panel-wrap）尺寸跟到目标页；过渡由各面板 scss 上的 transition 承担。
 */

export interface PanelPageTarget {
  /** 面板根元素（.ui-panel-wrap 的祖先） */
  root: HTMLElement | null;
  /** 目标页下标，0 为第一页 */
  index: number;
  /** 是否把面板根（.ui-area）的尺寸一起跟到目标页 */
  resizeArea?: boolean;
}

/**
 * 取一页的盒尺寸
 *
 * 优先用行内尺寸：面板收起时是 display:none，getBoundingClientRect 全是 0，
 * 而每页的宽高本来就写在 .ui-panel-item 的行内样式上（第一页 132x140 / 320x322 等）。
 * @param item - 页元素
 * @returns 尺寸字符串；拿不到返回 null
 */
const pageBox = (
  item: HTMLElement | undefined,
): { width: string; height: string } | null => {
  if (!item) return null;
  if (item.style.width && item.style.height) {
    return { width: item.style.width, height: item.style.height };
  }
  const measured = item.getBoundingClientRect();
  if (!(measured.width > 0 && measured.height > 0)) return null;
  return {
    width: `${Math.round(measured.width)}px`,
    height: `${Math.round(measured.height)}px`,
  };
};

/**
 * 切到指定页
 * @param target - 面板根、目标页下标与是否同步面板根尺寸
 */
export const switchPanelPage = ({
  root,
  index,
  resizeArea,
}: PanelPageTarget): void => {
  if (!root) return;
  const items = root.querySelectorAll<HTMLElement>('.ui-panel-item');
  if (items.length === 0) return;

  items.forEach((item, itemIndex) => {
    item.classList.toggle('ui-panel-item-active', itemIndex === index);
  });
  root.querySelector('.ui-area')?.classList.toggle('state-show-right', index > 0);

  const box = pageBox(items[index]);
  const wrap = root.querySelector<HTMLElement>('.ui-panel-wrap');
  if (wrap && box) {
    wrap.style.width = box.width;
    wrap.style.height = box.height;
  }
  if (resizeArea && box) {
    root.style.width = box.width;
    root.style.height = box.height;
  }

  const move = root.querySelector<HTMLElement>('.ui-panel-move');
  const first = items[0];
  if (!move || !first) return;
  if (index === 0) {
    move.style.transform = 'translateX(0px)';
    return;
  }
  const measured = first.getBoundingClientRect().width;
  const firstWidth =
    measured > 0 ? Math.round(measured) : parseFloat(first.style.width);
  if (firstWidth > 0) {
    move.style.transform = `translateX(-${firstWidth}px)`;
  }
};
