/**
 * ============================================
 * 播放器快捷键处理模块
 * ============================================
 *
 * 本模块负责播放器所有快捷键的配置与处理逻辑，
 * 从 PlayerDocker 组件中提取出来，实现关注点分离。
 *
 * 快捷键处理器通过 Context 获取播放器状态和操作方法，
 * 避免直接依赖组件内部实现细节。
 *
 * 快捷键分为以下几类：
 *   - 播放控制类：Space、→、←、媒体键
 *   - 音量控制类：↑、↓、M
 *   - 画面模式类：F、Esc
 *   - 互动操作类：Q、W、E、R、G
 *   - 弹幕控制类：D、Enter
 *   - 倍速控制类：Shift + 1、Shift + 2
 *   - 多P切换类：[、]
 */

import { useContext } from "@/core";
import {
  StateContext,
  type PlayerStateMap,
  // PlayerStateKeyEnum,
} from "@/store/runtimeState";
import type { TypedStateManager } from "@/core";

// ============================================
// 类型定义
// ============================================

/**
 * 快捷键执行上下文
 * 由调用方（如 PlayerDocker）提供，包含播放器状态和操作方法
 */
export type HotkeyContext = TypedStateManager<PlayerStateMap>;

/**
 * 快捷键配置项
 *
 * 每个快捷键对应一个配置项，包含按键信息、功能描述和执行动作。
 * 按键匹配通过 keyMatcher 函数实现，支持单键、组合键和媒体键。
 */
export interface HotkeyConfig {
  /**
   * 快捷键显示名称
   * 用于快捷键面板展示，如 "Space"、"Shift + 1"、"→" 等
   */
  name: string;
  /**
   * 快捷键功能描述
   * 详细说明该快捷键的作用和行为
   */
  desc: string;
  /**
   * 按键匹配函数
   * 接收 KeyboardEvent，返回是否匹配该快捷键
   * 支持单键匹配（如 Space）、组合键匹配（如 Shift + 1）、
   * 以及媒体键匹配（如 MediaPlayPause）
   */
  keyMatcher: (event: KeyboardEvent) => boolean;
  /**
   * 快捷键执行动作
   * 当按键匹配成功时调用，执行对应的播放器操作
   */
  action: (
    ctx: HotkeyContext,
    state: TypedStateManager<PlayerStateMap> | null,
  ) => void;
}

// ============================================
// 快捷键配置列表
// ============================================

/**
 * 播放器快捷键配置
 *
 * 每个快捷键包含：
 *   - name:    面板展示的按键名称
 *   - desc:    功能描述（与快捷键面板文案一致）
 *   - keyMatcher: 按键匹配逻辑
 *   - action:  匹配成功后执行的操作
 */
export const HOTKEYS: HotkeyConfig[] = [
  // ------------------------------------------
  // 互动操作类
  // ------------------------------------------

  {
    name: "Q",
    desc: "单次点赞/取消点赞，长按一键三连",
    keyMatcher: (e: KeyboardEvent) => e.key === "q" || e.key === "Q",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "W",
    desc: "投币",
    keyMatcher: (e: KeyboardEvent) => e.key === "w" || e.key === "W",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "E",
    desc: "收藏",
    keyMatcher: (e: KeyboardEvent) => e.key === "e" || e.key === "E",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "R",
    desc: "长按一键三连",
    keyMatcher: (e: KeyboardEvent) => e.key === "r" || e.key === "R",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "G",
    desc: "关注up主",
    keyMatcher: (e: KeyboardEvent) => e.key === "g" || e.key === "G",
    action: (_ctx: HotkeyContext): void => {},
  },

  // ------------------------------------------
  // 播放控制类
  // ------------------------------------------

  {
    name: "Space",
    desc: "播放/暂停",
    keyMatcher: (e: KeyboardEvent) => e.key === " ",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "→",
    desc: "单次快进5s，长按倍速播放",
    keyMatcher: (e: KeyboardEvent) => e.key === "ArrowRight",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "←",
    desc: "快退5s",
    keyMatcher: (e: KeyboardEvent) => e.key === "ArrowLeft",
    action: (_ctx: HotkeyContext): void => {},
  },

  // ------------------------------------------
  // 音量控制类
  // ------------------------------------------

  {
    name: "↑",
    desc: "音量增加10%",
    keyMatcher: (e: KeyboardEvent) => e.key === "ArrowUp",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "↓",
    desc: "音量降低10%",
    keyMatcher: (e: KeyboardEvent) => e.key === "ArrowDown",
    action: (_ctx: HotkeyContext): void => {},
  },

  // ------------------------------------------
  // 画面模式类
  // ------------------------------------------

  {
    name: "Esc",
    desc: "退出全屏",
    keyMatcher: (e: KeyboardEvent) => e.key === "Escape",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "媒体键 play/pause",
    desc: "播放/暂停",
    keyMatcher: (e: KeyboardEvent) => e.key === "MediaPlayPause",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "F",
    desc: "全屏/退出全屏",
    keyMatcher: (e: KeyboardEvent) => e.key === "f" || e.key === "F",
    action: (_ctx: HotkeyContext): void => {},
  },

  // ------------------------------------------
  // 多P切换类
  // ------------------------------------------

  {
    name: "[",
    desc: "多P 上一个",
    keyMatcher: (e: KeyboardEvent) => e.key === "[",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "]",
    desc: "多P 下一个",
    keyMatcher: (e: KeyboardEvent) => e.key === "]",
    action: (_ctx: HotkeyContext): void => {},
  },

  // ------------------------------------------
  // 弹幕控制类
  // ------------------------------------------

  {
    name: "Enter",
    desc: "发弹幕",
    keyMatcher: (e: KeyboardEvent) => e.key === "Enter",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "D",
    desc: "开启/关闭弹幕",
    keyMatcher: (e: KeyboardEvent) => e.key === "d" || e.key === "D",
    action: (_ctx: HotkeyContext): void => {},
  },

  // ------------------------------------------
  // 静音控制类
  // ------------------------------------------

  {
    name: "M",
    desc: "开启/关闭静音",
    keyMatcher: (e: KeyboardEvent) => e.key === "m" || e.key === "M",
    action: (_ctx: HotkeyContext): void => {},
  },

  // ------------------------------------------
  // 倍速控制类
  // ------------------------------------------

  {
    name: "Shift + 1",
    desc: "一倍速（正常倍速）",
    keyMatcher: (e: KeyboardEvent) => e.shiftKey && e.key === "!",
    action: (_ctx: HotkeyContext): void => {},
  },
  {
    name: "Shift + 2",
    desc: "二倍速",
    keyMatcher: (e: KeyboardEvent) => e.shiftKey && e.key === "@",
    action: (_ctx: HotkeyContext): void => {},
  },
];

// ============================================
// 快捷键处理器工厂
// ============================================

/**
 * 创建快捷键事件处理器
 *
 * 根据传入的上下文对象，返回一个 keydown 事件处理函数。
 * 该函数遍历所有快捷键配置，按顺序匹配第一个命中的快捷键并执行其动作。
 *
 * 处理器内部通过 useContext(StateContext) 获取状态管理器，
 * 用于读取当前播放状态（如音量、播放进度等）。
 *
 * 匹配规则：
 *   - 按配置数组顺序依次匹配，命中后立即执行并停止
 *   - Space 和方向键会阻止默认行为（防止页面滚动）
 *   - 未匹配任何快捷键的事件不做处理
 *
 * @param ctx - 快捷键执行上下文，提供播放器操作方法
 * @returns keydown 事件处理函数，可直接传给 addEventListener
 */
export function createHotkeyHandler(
  ctx: HotkeyContext,
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent): void => {
    // 通过 Context 获取状态管理器
    const state = useContext(StateContext);

    for (const hotkey of HOTKEYS) {
      if (hotkey.keyMatcher(event)) {
        if (
          event.key === " " ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown"
        ) {
          event.preventDefault();
        }
        hotkey.action(ctx, state);
        return;
      }
    }
  };
}
