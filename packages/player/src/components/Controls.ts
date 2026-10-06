/**
 * ============================================
 * 控制条组件 (Controls)
 * ============================================
 * 所有 DOM 引用通过 ref 回调获取，不使用 querySelector
 */

import { h, defineComponent, useTemplateRef, useContext } from "@/core";
import type {
  CtrlShowMenu,
  VolumeProgress,
  Tooltip,
  ControlsConfig,
} from "@/hili-player/types";
import { ConfigContext } from "@/store/runtimeState";
import { formatTime } from "@/utils/formatTime";
import { rafTimeout, cancelRaf } from "@/utils/rafTimeout";
import type { AnimationFrameID } from "@/utils/rafTimeout";
import { ComponentEventEnum } from "@/core/events";
import { LeftControls } from "./LeftControls";
import { RightControls } from "./RightControls";
import { TopControls } from "./TopControls";
import { PbpControls } from "./PbpControls";
import type { ProgressBarApi } from "./ProgressBar";

/**
 * 菜单类型
 */
type MenuType =
  | "viewpoint"
  | "quality"
  | "eplist"
  | "playbackrate"
  | "volume"
  | "setting";

/**
 * 菜单元素配置
 */
interface MenuElement {
  /** 菜单主元素 */
  element: HTMLDivElement | null;
  /** 菜单附加元素列表（如设置面板的子面板） */
  extraElements?: HTMLDivElement[];
}

/**
 * 菜单配置映射
 */
interface MenuConfig {
  /** 视点菜单元素配置 */
  viewpoint?: MenuElement;
  /** 画质菜单元素配置 */
  quality?: MenuElement;
  /** 选集菜单元素配置 */
  eplist?: MenuElement;
  /** 播放倍速菜单元素配置 */
  playbackrate?: MenuElement;
  /** 设置菜单元素配置 */
  setting?: MenuElement;
  /** 音量菜单元素配置 */
  volume?: MenuElement;
  /** 画中画按钮元素配置 */
  pip?: MenuElement;
  /** 宽屏按钮元素配置 */
  wide?: MenuElement;
  /** 网页全屏按钮元素配置 */
  web?: MenuElement;
}

/**
 * 视频进度数据
 */
interface VideoPlayerProgress {
  /** 缓冲进度时间（秒） */
  bufferTime: number;
  /** 当前播放时间（秒） */
  currentTime: number;
}

/**
 * Controls 组件 Props 接口
 */
export type ControlsEvents = {
  controlsMounted: ControlsAPI;
  playPause: undefined;
  seek: number;
  seekStart: undefined;
  seekEnd: undefined;
  volumeChange: number;
  muteToggle: undefined;
  backrateChange: number;
  fullscreenToggle: undefined;
  webFullscreenToggle: undefined;
  pipToggle: undefined;
  prev: undefined;
  next: undefined;
  qualityChange: string;
  eplistChange: string;
  settingChange: { key: string; value: boolean | string | number };
  moreSettingClick: undefined;
  showTooltip: Tooltip;
  hideTooltip: Tooltip;
  menuAnimation: { type: MenuType; action: "show" | "hide" };
  progressChange: number;
  stateChange: unknown;
  /** 顶部进度条挂载完成，向上层回传其更新 API */
  progressBarMounted: ProgressBarApi;
};

export interface ControlsProps {
  duration: number;
  volume: number;
  backrate: number;
  isEdit?: boolean;
}

/**
 * 控制栏暴露的 API 接口
 */
export interface ControlsAPI {
  /** 更新音量显示 */
  updateVolumeDisplay: (vol: number) => void;
  /** 显示控制栏 */
  showControl: () => void;
  /** 隐藏控制栏 */
  hideControl: () => void;
  /** 更新静音状态 */
  updateMute: (isMuted: boolean) => void;
  /** 更新缓冲进度 */
  updateBuffer: (buffer: number) => void;
  /** 更新当前播放时间 */
  updateCurrent: (current: number) => void;
  /** 初始化时长显示 */
  initDuration: () => void;
}

/**
 * 控制条组件
 */
export const Controls = defineComponent<ControlsProps, ControlsEvents>(
  (props, lifecycle) => {
    // ============================================
    // 状态数据
    // ============================================

    /** 视频总时长（秒） */
    const duration = props.duration;
    /** 当前音量，范围 0-1 */
    let volume = props.volume;
    /** 当前播放倍速 */
    const backrate = props.backrate;
    const configCtx = useContext<ControlsConfig>(ConfigContext);
    /** 控制条配置（浅拷贝，避免修改原始 props） */
    const config: ControlsConfig = {
      ...configCtx,
    };

    /** 视频进度数据 */
    const videoProgress: VideoPlayerProgress = {
      bufferTime: 0,
      currentTime: 0,
    };

    /** 各菜单的显示/隐藏定时器状态 */
    const ctrlShowMenu: CtrlShowMenu = {
      viewpoint: { showTimer: null, hideTimer: null },
      quality: { showTimer: null, hideTimer: null },
      eplist: { showTimer: null, hideTimer: null },
      playbackrate: { showTimer: null, hideTimer: null },
      volume: { showTimer: null, hideTimer: null },
      setting: { showTimer: null, hideTimer: null },
    };

    /** 各菜单的 DOM 元素引用配置 */
    const menuConfig: MenuConfig = {};

    /**
     * 菜单类型 → 菜单挂载点（按钮容器）选择器
     * 与既有实现 CLASS_NAMES.CTRL_*_BTN 保持一致：
     * state-show 类加在按钮容器上，由 CSS `.state-show .player-ctrl-*-menu-wrap` 控制菜单展开
     */
    const MENU_SELECTORS: Record<MenuType, string> = {
      viewpoint: ".player-ctrl-btn.player-ctrl-viewpoint",
      quality: ".player-ctrl-btn.player-ctrl-quality",
      eplist: ".player-ctrl-btn.player-ctrl-eplist",
      playbackrate: ".player-ctrl-btn.player-ctrl-playbackrate",
      volume: ".player-ctrl-btn.player-ctrl-volume",
      setting: ".player-ctrl-btn.player-ctrl-setting",
    };

    /** 音量滑块拖拽状态 */
    const volumeProgress: VolumeProgress = {
      isDragging: false,
      startY: 0,
      isMuted: false,
    };

    /** 需要显示提示信息的按钮列表 */
    const tooltipBtns: Tooltip[] = [
      { element: null, name: "prev", dataName: "ctrl:prev" },
      { element: null, name: "next", dataName: "ctrl:next" },
      { element: null, name: "pip", dataName: "ctrl:pip" },
      { element: null, name: "wide", dataName: "ctrl:widescreen" },
      { element: null, name: "web", dataName: "ctrl:webscreen" },
      { element: null, name: "full", dataName: "ctrl:fullscreen" },
    ];

    /** 提示按钮延迟显示的定时器 */
    let inTimer: AnimationFrameID | null = null;

    // ============================================
    // DOM 元素引用（全部通过 ref 对象获取）
    // ============================================

    /** 控制栏主体容器元素 */
    const controlEntityRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "controlEntityRef",
    );
    /** 进度条区域容器元素 */
    const playerProgressAreaRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "playerProgressAreaRef",
    );
    /** 进度条拖拽滑块元素 */
    const progressThumbRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "progressThumbRef",
    );
    /** 当前播放时间文本元素 */
    const playerCtrlTimeCurrentRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "playerCtrlTimeCurrentRef",
    );
    /** 总时长文本元素 */
    const playerCtrlTimeDurationRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "playerCtrlTimeDurationRef",
    );
    /** 音量按钮元素 */
    const ctrlVolumeBtnRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "ctrlVolumeBtnRef",
    );
    /** 音量数值文本元素 */
    const volumeNumberRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "volumeNumberRef",
    );
    /** 音量进度条元素 */
    const volumeProgressbarRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "volumeProgressbarRef",
    );
    /** 音量滑块拖拽手柄元素 */
    const volumeSliderThumbRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "volumeSliderThumbRef",
    );
    /** 倍速菜单项元素列表 */
    const backrateMenuItems: HTMLLIElement[] = [];
    /** PBP（逐行预览）面板元素 */
    const pbpRef = useTemplateRef<HTMLDivElement>(lifecycle, "pbpRef");

    // ============================================
    // 工具函数
    // ============================================

    /**
     * 对元素应用 scaleX 变换，用于更新进度条填充比例
     * @param element - 目标 DOM 元素
     * @param scale - 缩放比例，会被限制在 0-1 之间
     * @param extraTransform - 额外的 CSS transform 字符串
     */
    const applyTransform = (
      element: HTMLDivElement | null | undefined,
      scale?: number,
      extraTransform = "",
    ): void => {
      if (!element) return;
      const clampedScale = Math.min(Math.max(scale ?? 0, 0), 1);
      element.style.transform =
        `scaleX(${clampedScale}) ${extraTransform}`.trim();
    };

    // ============================================
    // 进度条元素创建
    // ============================================

    // ============================================
    // 事件处理函数
    // ============================================

    /**
     * 控制菜单的显示/隐藏动画，带 300ms 延迟
     * @param type - 菜单类型
     * @param action - 动作：'show' 显示或 'hide' 隐藏
     */
    const handleMenuAnimation = (
      type: MenuType,
      action: "show" | "hide",
    ): void => {
      const menuCfg = menuConfig[type];
      if (!menuCfg) {
        return;
      }
      const control = ctrlShowMenu[type];
      cancelRaf(control.showTimer!);
      cancelRaf(control.hideTimer!);
      const timerType = action === "show" ? "showTimer" : "hideTimer";
      control[timerType] = rafTimeout(() => {
        menuCfg.element?.classList.toggle("state-show", action === "show");
        if (type === "setting") {
          menuCfg.extraElements?.forEach((el, index) => {
            const classes = [
              "state-show-right",
              "player-ctrl-seting-more-area",
            ];
            el?.classList.remove(classes[index]);
          });
        }
      }, 300);
    };

    /**
     * 初始化倍速菜单项，为当前倍速添加激活样式
     */
    const initBackrate = (): void => {
      backrateMenuItems.forEach((item) => {
        if (item.getAttribute("data-value") === backrate.toString()) {
          item.classList.add("player-state-active");
        }
      });
    };

    /**
     * 初始化提示按钮的鼠标悬浮事件，延迟 300ms 显示/隐藏提示
     */
    const initTooltip = (): void => {
      tooltipBtns.forEach((btn) => {
        btn.element?.addEventListener("mouseenter", () => {
          cancelRaf(inTimer!);
          inTimer = rafTimeout(() => {
            lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, {
              tooltip: btn,
              action: "show",
            });
            lifecycle.emit?.("showTooltip", btn);
          }, 300);
        });
        btn.element?.addEventListener("mouseleave", () => {
          cancelRaf(inTimer!);
          lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, {
            tooltip: btn,
            action: "hide",
          });
          lifecycle.emit?.("hideTooltip", btn);
        });
      });
    };

    // ============================================
    // 更新函数
    // ============================================

    /**
     * 更新当前播放时间，同步更新进度条、时间文本和滑块位置
     * @param current - 当前播放时间（秒）
     */
    const updateCurrent = (current: number): void => {
      videoProgress.currentTime = current;
      updateMainProgress(current);
      updateThumbPosition(current);
    };

    /**
     * 更新主进度条的时间文本显示
     * @param current - 当前时间（秒）
     */
    const updateMainProgress = (current: number): void => {
      if (!playerCtrlTimeCurrentRef.value) return;
      playerCtrlTimeCurrentRef.value.textContent = formatTime(current);
    };

    /**
     * 更新进度条拖拽滑块的位置
     * @param current - 当前时间（秒）
     */
    const updateThumbPosition = (current: number): void => {
      // 总时长非法时跳过，避免除零产生 NaN/Infinity（与 ProgressBar 的边界处理一致）
      if (!progressThumbRef.value || !playerProgressAreaRef.value) return;
      if (duration <= 0) return;
      const position =
        (current / duration) * playerProgressAreaRef.value.clientWidth - 10;
      applyTransform(progressThumbRef.value, 1, `translateX(${position}px)`);
    };

    /**
     * 更新音量显示，包括音量数值、进度条高度和滑块位置
     * @param newVolume - 新的音量值，范围 0-1
     */
    const updateVolumeDisplay = (newVolume: number): void => {
      if (volume <= 0 && newVolume > 0) {
        ctrlVolumeBtnRef.value?.classList.remove("state-muted");
      } else if (volume > 0 && newVolume <= 0) {
        ctrlVolumeBtnRef.value?.classList.add("state-muted");
      }
      volume = newVolume;
      if (
        volumeNumberRef.value &&
        volumeProgressbarRef.value &&
        volumeSliderThumbRef.value
      ) {
        volumeNumberRef.value.innerHTML = Math.floor(volume * 100).toString();
        volumeProgressbarRef.value.style.transform = `scaleY(${volume})`;
        volumeSliderThumbRef.value.style.transform = `translateY(${-(60 * volume - 6)}px)`;
      }
    };

    /**
     * 初始化总时长文本显示
     */
    const initDuration = (): void => {
      if (playerCtrlTimeDurationRef.value) {
        playerCtrlTimeDurationRef.value.innerHTML = formatTime(duration);
      }
    };

    // ============================================
    // 生命周期钩子
    // ============================================

    lifecycle.onMounted = (): void => {
      initDuration();
      initBackrate();
      initTooltip();

      // 填充菜单配置：子组件（LeftControls / RightControls）先于父组件挂载，
      // 此处控制条主体 DOM 已就绪，可直接在实体容器内检索各菜单挂载点
      // （与既有实现 initMenu 的 querySelector 初始化方式一致）
      const entity = controlEntityRef.value;
      if (entity) {
        (Object.keys(MENU_SELECTORS) as MenuType[]).forEach((type) => {
          menuConfig[type] = {
            element: entity.querySelector<HTMLDivElement>(MENU_SELECTORS[type]),
          };
        });
        // 设置面板的附加元素（二级面板区域），与既有实现 menuConfig.setting.extraElements 一致
        const settingElement = menuConfig.setting?.element ?? null;
        if (settingElement) {
          const extraElements = [
            settingElement.querySelector<HTMLDivElement>(
              ".player-ctrl-setting-menu.ui .ui-area",
            ),
            settingElement.querySelector<HTMLDivElement>(
              ".player-ctrl-setting-menu.ui .ui-area .player-ctrl-seting-menu-right",
            ),
          ].filter((el): el is HTMLDivElement => el !== null);
          if (extraElements.length > 0) {
            menuConfig.setting = {
              element: settingElement,
              extraElements,
            };
          }
        }
      }

      // 暴露控制栏 API 给父组件
      lifecycle.emit?.("controlsMounted", {
        updateVolumeDisplay,
        showControl: () => {
          if (controlEntityRef.value) {
            controlEntityRef.value.setAttribute("data-shadow-show", "false");
          }
          pbpRef.value?.classList.add("show");
        },
        hideControl: () => {
          if (controlEntityRef.value) {
            controlEntityRef.value.setAttribute("data-shadow-show", "true");
          }
          pbpRef.value?.classList.remove("show");
        },
        updateMute: (isMuted: boolean) => {
          volumeProgress.isMuted = isMuted;
        },
        updateBuffer: (buffer: number) => {
          updateMainProgress(buffer);
        },
        updateCurrent,
        initDuration,
      });
    };

    // ============================================
    // 子组件事件处理函数
    // ============================================

    /**
     * 处理左侧控制栏组件的事件分发
     * @param event - 事件名称
     * @param arg1 - 事件参数1
     * @param arg2 - 事件参数2
     */
    const handleLeftSeek = (time: number): void => {
      lifecycle.emit?.("seek", time);
    };

    const handleLeftMenuAnimation = (payload: {
      type: MenuType;
      action: "show" | "hide";
    }): void => {
      handleMenuAnimation(payload.type, payload.action);
    };

    /**
     * 处理右侧控制栏组件的事件分发
     * @param event - 事件名称
     * @param arg1 - 事件参数1（可能是鼠标事件、数字或字符串）
     * @param arg2 - 事件参数2
     */
    const handleRightBackrateChange = (rate: number): void => {
      lifecycle.emit?.("backrateChange", rate);
    };

    const handleRightQualityChange = (quality: string): void => {
      lifecycle.emit?.("qualityChange", quality);
    };

    const handleRightSettingChange = (payload: {
      key: string;
      value: boolean | string | number;
    }): void => {
      lifecycle.emit?.("settingChange", payload);
    };

    const handleRightMenuAnimation = (payload: {
      type: MenuType;
      action: "show" | "hide";
    }): void => {
      handleMenuAnimation(payload.type, payload.action);
    };

    // ============================================
    // 主渲染函数
    // ============================================

    return h(
      "div",
      { class: "player-control-wrap" },
      h("div", { class: "player-control-mask" }),
      h(
        "div",
        {
          class: "player-control-entity",
          // 初始为 "true"（与既有实现一致）：
          // scss 中 data-shadow-show="false" 会强制显示 .player-control-top（进度条），
          // 而 data-ctrl-hidden 只控制 .player-control-bottom 的显隐。
          // 若初始为 "false"，会出现「进度条显示了但底部按钮没一起显示」的不同步现象。
          "data-shadow-show": "true",
          ref: "controlEntityRef",
        },
        h(TopControls, {
          progressSegments: config.progressSegments,
          onSeek: (time) => {
            updateCurrent(time);
            lifecycle.emit?.("seek", time);
          },
          onSeekStart: () => {
            lifecycle.emit?.("seekStart");
          },
          onSeekEnd: () => {
            lifecycle.emit?.("seekEnd");
          },
          // 继续向上转发 ProgressBar 的更新 API，最终由 PlayerDocker 持有
          onProgressBarMounted: (api) =>
            lifecycle.emit?.("progressBarMounted", api),
        }),
        h(
          "div",
          { class: "player-control-bottom" },
          h(LeftControls, {
            onPrev: () => lifecycle.emit?.("prev"),
            onNext: () => lifecycle.emit?.("next"),
            onPlayPause: () => lifecycle.emit?.("playPause"),
            onSeek: handleLeftSeek,
            onMenuAnimation: handleLeftMenuAnimation,
          }),
          h("div", { class: "player-control-bottom-center" }),
          h(RightControls, {
            onFullscreen: () => lifecycle.emit?.("fullscreenToggle"),
            onWebFullscreen: () => lifecycle.emit?.("webFullscreenToggle"),
            onPip: () => lifecycle.emit?.("pipToggle"),
            onWide: () => {},
            onMute: () => lifecycle.emit?.("muteToggle"),
            onBackrateChange: handleRightBackrateChange,
            onVolumeChange: (vol) => {
              updateVolumeDisplay(vol);
              lifecycle.emit?.("volumeChange", vol);
            },
            onMuteToggle: () => lifecycle.emit?.("muteToggle"),
            onQualityChange: handleRightQualityChange,
            onSettingChange: handleRightSettingChange,
            onMenuAnimation: handleRightMenuAnimation,
            onMoreSettingClick: () => lifecycle.emit?.("moreSettingClick"),
          }),
        ),
        h(
          "div",
          {
            class: "player-shadow-progress-area",
          },
          h("div", {
            class: "player-shadow-progress-schedule-wrap",
          }),
        ),
        h(PbpControls, {
          ref: "pbpRef",
          onPbpClick: () => {},
          onPbpPinClick: () => {},
        }),
      ),
    );
  },
);
