/**
 * ============================================
 * 音量提示组件
 * ============================================
 */

import { h, defineComponent, useTemplateRef } from "@/core";
import type { ComponentLifecycle } from "@/types";
import { rafTimeout, cancelRaf } from "@/utils/rafTimeout";
import type { AnimationFrameID } from "@/utils/rafTimeout";
import { Volume, Mute } from "@/hili-player/components/icons";

/**
 * 音量提示组件 Props 接口
 */
export interface VolumeHintProps {
  /** 当前音量，范围 0-1 */
  volume?: number;
  /** 是否显示音量提示 */
  visible?: boolean;
}

/**
 * 音量提示组件
 */
export const VolumeHint = defineComponent<VolumeHintProps>(
  (props, lifecycle: ComponentLifecycle) => {
    // ============================================
    // DOM 引用
    // ============================================

    /** 音量提示容器元素引用 */
    const hintRef = useTemplateRef<HTMLDivElement>(lifecycle, "hintRef");
    /** 音量数值文本元素引用 */
    const textRef = useTemplateRef<HTMLSpanElement>(lifecycle, "textRef");
    /** 音量图标元素引用 */
    const iconRef = useTemplateRef<HTMLSpanElement>(lifecycle, "iconRef");

    // ============================================
    // 自动消失定时器（与既有实现的
    // volumeHintShow.hintTimer / delayTimer 行为一致）
    // ============================================

    /** 显示 3 秒后开始淡出的定时器 */
    let hintTimer: AnimationFrameID | null = null;
    /** 淡出后延迟隐藏 display 的定时器 */
    let delayTimer: AnimationFrameID | null = null;

    // ============================================
    // DOM 更新方法
    // ============================================

    /**
     * 显示音量提示并更新音量数值
     *
     * 与既有实现的 show 一致：
     * 先取消上一次的定时器，再显示；3 秒后淡出（opacity 0），
     * 再延时 300ms 隐藏 display，实现「显示后延时自动消失」
     * @param volume - 当前音量，范围 0-1
     */
    const show = (volume: number): void => {
      cancelRaf(hintTimer!);
      cancelRaf(delayTimer!);
      if (hintRef.value) {
        // 使用 removeProperty 而非 setProperty(_, null)
        // setProperty 的 value 参数不接受 null，会被转为字符串 "null" 导致无效 CSS
        hintRef.value.style.removeProperty("display");
        hintRef.value.style.opacity = "1";
      }
      if (textRef.value) {
        if (volume === 0) {
          textRef.value.textContent = "静音";
        } else {
          textRef.value.textContent = `${Math.floor(volume * 100)}%`;
        }
      }
      if (iconRef.value) {
        if (volume === 0) {
          iconRef.value.classList.add("player-volume-muted");
        } else {
          iconRef.value.classList.remove("player-volume-muted");
        }
      }
      // 3 秒后淡出，再 300ms 后隐藏（与既有实现定时器逻辑一致）
      hintTimer = rafTimeout(() => {
        if (!hintRef.value) return;
        hintRef.value.style.opacity = "0";
        delayTimer = rafTimeout(() => {
          if (!hintRef.value) return;
          hintRef.value.style.display = "none";
        }, 300);
      }, 3000);
    };

    /**
     * 隐藏音量提示（同时清理自动消失定时器）
     */
    const hide = (): void => {
      cancelRaf(hintTimer!);
      cancelRaf(delayTimer!);
      if (hintRef.value) {
        hintRef.value.style.opacity = "0";
        hintRef.value.style.display = "none";
      }
    };

    /**
     * 更新音量数值文本
     * @param volume - 当前音量，范围 0-1
     */
    const setVolume = (volume: number): void => {
      if (textRef.value) {
        if (volume === 0) {
          textRef.value.textContent = "静音";
        } else {
          textRef.value.textContent = `${Math.floor(volume * 100)}%`;
        }
      }
    };

    /**
     * 切换静音图标状态
     * @param isMuted - 是否静音
     */
    const setMuted = (isMuted: boolean): void => {
      if (iconRef.value) {
        if (isMuted) {
          iconRef.value.classList.add("player-volume-muted");
        } else {
          iconRef.value.classList.remove("player-volume-muted");
        }
      }
    };

    // ============================================
    // 生命周期钩子
    // ============================================

    lifecycle.onMounted = (): void => {
      lifecycle.emit?.("volumeHintMounted", {
        show,
        hide,
        setVolume,
        setMuted,
      });
    };

    lifecycle.onBeforeDestroy = (): void => {
      // 组件销毁前清理自动消失定时器，避免泄漏
      cancelRaf(hintTimer!);
      cancelRaf(delayTimer!);
    };

    return h(
      "div",
      {
        class: "player-volume-hint",
        ref: "hintRef",
        style: {
          display: props.visible ? "" : "none",
          opacity: props.visible ? "1" : "0",
        },
      },
      h(
        "span",
        {
          class: "player-volume-hint-icon",
          ref: "iconRef",
          // 音量/静音图标：既有实现 icons 的 Volume、Mute SVG（禁止 unicode 字符当图标）；
          // 两个 SVG 均为 .player-volume-hint-icon 的直接子元素，供
          // .player-volume-muted 的 svg:nth-child(1)/(2) 规则切换显隐
        },
        Volume(),
        Mute(),
      ),
      h(
        "span",
        {
          class: "player-volume-hint-text",
          ref: "textRef",
        },
        (props.volume ?? 0) === 0
          ? "静音"
          : `${Math.floor((props.volume ?? 0) * 100)}%`,
      ),
    );
  },
);
