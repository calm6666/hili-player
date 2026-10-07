/**
 * ============================================
 * 章节/视点选择菜单组件 (ViewpointMenu)
 * ============================================
 * 用于 LeftControls 的章节/视点选择菜单
 * 支持章节列表渲染、章节点击跳转、菜单悬停动画回调
 */

import { h, defineComponent, useTemplateRef, materialize } from "@/core";
import { useComponentUnmount } from "@/hili-player/core/componentUnmount";
import { rafTimeout, cancelRaf } from "@/utils/rafTimeout";
import type { AnimationFrameID } from "@/utils/rafTimeout";
import type { VNode } from "@/types";

/** 展开 / 收起动画的延迟（毫秒） */
const MENU_SHOW_DELAY = 120;
const MENU_HIDE_DELAY = 220;

/**
 * 章节/视点数据接口
 */
export interface ViewpointItem {
  /** 章节标题 */
  title: string;
  /** 章节起始时间（秒） */
  time: number;
}

/**
 * ViewpointMenu 组件 Props 接口
 */
export interface ViewpointMenuProps {
  /** 章节/视点列表 */
  points?: ViewpointItem[];
  /** 当前播放时间（秒） */
  currentTime?: number;
  /** 跳转到指定时间的回调函数 */
  onSeek?: (time: number) => void;
}

/**
 * ViewpointMenu 组件 - 使用 defineComponent 创建独立组件
 * 渲染章节/视点选择菜单，支持当前章节高亮
 */
export type ViewpointMenuEvents = {
  seek: number;
  viewpointMenuMounted: { rebuildPoints: (next: ViewpointItem[]) => void };
};

export const ViewpointMenu = defineComponent<
  ViewpointMenuProps,
  ViewpointMenuEvents
>((props, lifecycle) => {
  /** 章节列表（可被 rebuildPoints 整体替换） */
  let points = props.points ?? [];
  const { currentTime = 0 } = props;

  // ============================================
  // DOM 引用
  // ============================================

  /** 章节显示文本元素引用 */
  const viewpointTextRef = useTemplateRef<HTMLDivElement>(
    lifecycle,
    "viewpointTextRef",
  );

  /** 章节列表容器元素引用 */
  const menuRef = useTemplateRef<HTMLUListElement>(
    lifecycle,
    "viewpointMenuRef",
  );

  /** 章节按钮根元素引用（面板显隐的类名挂载点） */
  const rootRef = useTemplateRef<HTMLDivElement>(lifecycle, "viewpointRootRef");

  /** 展开定时器 */
  let showTimer: AnimationFrameID | null = null;

  /** 收起定时器 */
  let hideTimer: AnimationFrameID | null = null;

  /**
   * 落地面板展开态：直接给自己根节点的 DOM 加 / 去状态类
   * @param show - 是否展开
   */
  const setShown = (show: boolean): void => {
    rootRef.value?.classList.toggle("state-show", show);
  };

  /** 取消两个方向的排队任务 */
  const clearTimers = (): void => {
    cancelRaf(showTimer!);
    cancelRaf(hideTimer!);
    showTimer = null;
    hideTimer = null;
  };

  /**
   * 用新的章节数据重建列表 DOM（时长到手后重建，使章节时间与进度条同轴）
   * @param next - 归一后的章节数据
   */
  const rebuildPoints = (next: ViewpointItem[]): void => {
    points = next ?? [];
    const menu = menuRef.value;
    if (!menu) return;
    menu.replaceChildren(
      ...points.map((point, index) =>
        materialize(renderViewpointItem(point, index)),
      ),
    );
    if (viewpointTextRef.value && points.length > 0) {
      const current = points.find((point, index) =>
        isCurrentPoint(point.time, index),
      );
      viewpointTextRef.value.innerText =
        "章节 · " + (current?.title ?? points[0].title);
    }
  };

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 鼠标进入章节按钮：延迟展开面板（面板显隐由本组件自己负责）
   */
  const handleMouseEnter = (): void => {
    cancelRaf(hideTimer!);
    hideTimer = null;
    if (showTimer !== null) return;
    showTimer = rafTimeout(() => {
      showTimer = null;
      setShown(true);
    }, MENU_SHOW_DELAY);
  };

  /**
   * 鼠标离开章节按钮：延迟收起面板
   */
  const handleMouseLeave = (): void => {
    cancelRaf(showTimer!);
    showTimer = null;
    if (hideTimer !== null) return;
    hideTimer = rafTimeout(() => {
      hideTimer = null;
      setShown(false);
    }, MENU_HIDE_DELAY);
  };

  // ============================================
  // 渲染辅助函数
  // ============================================

  /**
   * 判断指定时间是否属于当前章节
   * @param time - 章节起始时间
   * @param index - 章节在列表中的索引
   * @returns 是否为当前正在播放的章节
   */
  const isCurrentPoint = (time: number, index: number): boolean => {
    // 当前时间 >= 该章节时间，且 < 下一章节时间
    if (currentTime < time) return false;
    /** 下一个章节的数据 */
    const nextPoint = points[index + 1];
    if (!nextPoint) return true;
    return currentTime < nextPoint.time;
  };

  /**
   * 渲染单个章节菜单项
   * @param point - 章节数据
   * @param index - 章节在列表中的索引
   * @returns 菜单项 VNode
   */
  const renderViewpointItem = (point: ViewpointItem, index: number): VNode => {
    /** 是否为当前正在播放的章节 */
    const isActive = isCurrentPoint(point.time, index);
    return h(
      "li",
      {
        class: ["player-ctrl-viewpoint-menu-item", isActive ? "active" : ""]
          .filter(Boolean)
          .join(" "),
        "data-time": point.time,
        onClick: () => {
          lifecycle.emit?.("seek", point.time);
          // 更新章节文本显示
          if (viewpointTextRef.value) {
            viewpointTextRef.value.innerText = "章节 · " + point.title;
          }
        },
      },
      h("span", {
        class: "player-ctrl-viewpoint-menu-item-team team-blue",
        style: { opacity: "0", display: "none" },
        "data-time": point.time,
      }),
      h(
        "span",
        {
          class: "player-ctrl-viewpoint-menu-item-content",
          "data-time": point.time,
        },
        point.title,
      ),
    );
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，设置初始章节文本并通知外部组件已就绪
   */
  lifecycle.onMounted = (): void => {
    // 设置初始章节文本
    if (viewpointTextRef.value && points.length > 0) {
      // 找到当前章节
      const currentPoint = points.find((p, i) => isCurrentPoint(p.time, i));
      viewpointTextRef.value.innerText =
        "章节 · " + (currentPoint?.title ?? points[0].title);
    }
    lifecycle.emit?.("viewpointMenuMounted", { rebuildPoints });
  };

  useComponentUnmount(lifecycle, clearTimers);

  // ============================================
  // 主渲染函数
  // ============================================
  return h(
    "div",
    {
      class: "player-ctrl-btn player-ctrl-viewpoint",
      ref: "viewpointRootRef",
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    h(
      "div",
      { class: "player-ctrl-viewpoint-inner" },
      h(
        "div",
        { class: "player-ctrl-viewpoint-content" },
        // 章节文本
        h(
          "span",
          { class: "player-ctrl-viewpoint-text", ref: "viewpointTextRef" },
          points.length > 0 ? "章节 · " + points[0].title : "章节",
        ),
        // 章节图标
        h(
          "span",
          { class: "player-ctrl-viewpoint-icon" },
          h("span", { class: "common-svg-icon" }),
        ),
        // 章节下拉菜单
        h(
          "div",
          { class: "player-ctrl-viewpoint-menu-wrap" },
          h(
            "ul",
            { class: "player-ctrl-viewpoint-menu", ref: "viewpointMenuRef" },
            ...points.map((point, index) => renderViewpointItem(point, index)),
          ),
        ),
      ),
    ),
  );
});
