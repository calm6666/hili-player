/**
 * ============================================
 * 字幕容器组件 (SubtitleLayer)
 * ============================================
 * 字幕DOM容器在player侧，字幕逻辑实现在插件侧
 * 与弹幕(RowDm)和互动(InteractionLayer)采用相同的低耦合模式
 * 字幕插件将自身DOM注入到 .nova-player-subtitle-wrap 容器中
 *
 * 声明式响应式版本：字号/文字色/背景色/位置四组样式状态由内部
 * signal 驱动，容器 style 由派生对象经 __reactiveAttrs 增量更新
 * （prev 属性自动清除，等价于原命令式的 top=""/transform="" 清空）。
 *
 * 对外保留 setFontSize/setColor/setBackgroundColor/setPosition
 * 命令式 API 契约不变（PlayerDocker / VideoPlayer 经事件持有引用，
 * 零改动）；API 内部仅写 signal，不再触碰 DOM。
 *
 * 保留命令式的部分：onBeforeDestroy 清空插件注入的子节点
 * （容器子树由插件所有，非本组件渲染数据）。
 */

import { h, defineComponent, useTemplateRef, signal } from "@/core";
import type { ComponentLifecycle } from "@/types";

// ============================================
// 字幕位置类型
// ============================================

/** 字幕显示位置类型：顶部、居中、底部 */
export type SubtitlePosition = "top" | "center" | "bottom";

// ============================================
// SubtitleLayer 组件 Props 接口
// ============================================

/** 字幕容器组件属性接口 */
export interface SubtitleLayerProps {
  /** 是否显示字幕层 */
  visible?: boolean;
}

// ============================================
// SubtitleLayer 组件
// ============================================

/**
 * SubtitleLayer 组件 - 使用 defineComponent 创建独立组件
 * 提供字幕插件注入 DOM 的容器
 * 类名使用 'nova-player-subtitle-wrap'
 */
export const SubtitleLayer = defineComponent<SubtitleLayerProps>(
  (props, lifecycle: ComponentLifecycle) => {
    // ============================================
    // DOM 引用
    // ============================================

    /** 字幕容器 DOM 引用，字幕插件将内容注入到此容器 */
    const subtitleWrapRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "subtitleWrapRef",
    );

    // ============================================
    // 响应式状态（渲染层唯一数据源；
    // 初值 null 表示未设置，与原实现初始不写对应内联样式一致）
    // ============================================

    /** 字幕字体大小（px），null 表示未设置 */
    const fontSizeSig = signal<number | null>(null);

    /** 字幕文字颜色，null 表示未设置 */
    const colorSig = signal<string | null>(null);

    /** 字幕背景颜色，null 表示未设置 */
    const backgroundColorSig = signal<string | null>(null);

    /** 字幕显示位置（初值 bottom，与原实现初始 bottom:10% 一致） */
    const positionSig = signal<SubtitlePosition>("bottom");

    // ============================================
    // 样式控制方法（对外 API——内部仅写 signal）
    // ============================================

    /**
     * 设置字幕字体大小
     * @param size - 字体大小（px）
     */
    const setFontSize = (size: number): void => {
      fontSizeSig.value = size;
    };

    /**
     * 设置字幕文字颜色
     * @param color - CSS 颜色值
     */
    const setColor = (color: string): void => {
      colorSig.value = color;
    };

    /**
     * 设置字幕背景颜色
     * @param color - CSS 颜色值
     */
    const setBackgroundColor = (color: string): void => {
      backgroundColorSig.value = color;
    };

    /**
     * 设置字幕位置
     * @param position - 字幕位置（top / center / bottom）
     */
    const setPosition = (position: SubtitlePosition): void => {
      positionSig.value = position;
    };

    // ============================================
    // 生命周期
    // ============================================

    /** 组件挂载后对外暴露字幕容器引用和样式控制方法 */
    lifecycle.onMounted = (): void => {
      lifecycle.emit?.("subtitleLayerMounted", {
        subtitleWrap: subtitleWrapRef.value,
        setFontSize,
        setColor,
        setBackgroundColor,
        setPosition,
      });
    };

    /** 组件销毁前清理字幕容器内的所有子节点 */
    lifecycle.onBeforeDestroy = (): void => {
      // 容器子树由字幕插件注入并所有，命令式清空（非本组件渲染数据）
      if (subtitleWrapRef.value) {
        while (subtitleWrapRef.value.firstChild) {
          subtitleWrapRef.value.removeChild(subtitleWrapRef.value.firstChild);
        }
      }
    };

    // ============================================
    // 渲染输出
    // ============================================

    /**
     * 派生容器完整样式（渲染层唯一数据源）
     * 读取各样式 signal + 定位 signal，由 __reactiveAttrs 的 effect 调用：
     * 信号变化时增量更新（上次绑定属性集合自动清除，
     * 等价于原命令式 setPosition 内 top=""/transform="" 的清空语义）
     */
    const buildStyle = (): Record<string, string> => {
      const style: Record<string, string> = {
        position: "absolute",
        left: "0",
        width: "100%",
        textAlign: "center",
        pointerEvents: "none",
        zIndex: "15",
        display: props.visible === false ? "none" : "",
      };
      const fontSize = fontSizeSig.value;
      if (fontSize !== null) style.fontSize = `${fontSize}px`;
      const color = colorSig.value;
      if (color !== null) style.color = color;
      const backgroundColor = backgroundColorSig.value;
      if (backgroundColor !== null) style.backgroundColor = backgroundColor;
      switch (positionSig.value) {
        case "top":
          style.top = "10%";
          break;
        case "center":
          style.top = "50%";
          style.transform = "translateY(-50%)";
          break;
        case "bottom":
          style.bottom = "10%";
          break;
      }
      return style;
    };

    return h("div", {
      class: "nova-player-subtitle-wrap",
      ref: "subtitleWrapRef",
      style: buildStyle(),
    });
  },
);

export default SubtitleLayer;
