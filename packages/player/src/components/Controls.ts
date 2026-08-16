/**
 * ============================================
 * 控制条组件 (Controls)
 * ============================================
 * 所有 DOM 引用通过 ref 回调获取，不使用 querySelector
 */

import { h, defineComponent, ref, useContext } from "@/core";
import { isBrowser } from "@/utils";
import type {
  CtrlShowMenu,
  VolumeProgress,
  Popup,
  Tooltip,
  ControlConfig,
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
    const configCtx = useContext<ControlConfig>(ConfigContext);
    /** 控制条配置（浅拷贝，避免修改原始 props） */
    const config: ControlConfig = {
      ...configCtx,
    };

    /** 视频进度数据 */
    const videoProgress: VideoPlayerProgress = {
      bufferTime: 0,
      currentTime: 0,
    };

    /** 是否正在拖拽进度条 */
    let isDragging = false;
    /** 鼠标在进度条上的水平偏移量（像素） */
    let indicatorLeft = 0;

    /** 弹出层状态（进度条悬浮预览） */
    const popup: Popup = {
      isActive: false,
      left: 0,
      delay: null,
      currentTime: 0,
      prevTime: 0,
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
    const controlEntityRef = ref<HTMLDivElement>();
    /** 进度条区域容器元素 */
    const playerProgressAreaRef = ref<HTMLDivElement>();
    /** 阴影进度条轨道容器元素（编辑模式下的分段预览） */
    const playerShadowProgressScheduleWrapRef = ref<HTMLDivElement>();
    /** 阴影进度条区域容器元素 */
    const playerShadowProgressAreaRef = ref<HTMLDivElement>();
    /** 进度条拖拽滑块元素 */
    const progressThumbRef = ref<HTMLDivElement>();
    /** 进度条鼠标跟随指示器元素 */
    const moveIndicatorRef = ref<HTMLDivElement>();
    /** 当前播放时间文本元素 */
    const playerCtrlTimeCurrentRef = ref<HTMLDivElement>();
    /** 总时长文本元素 */
    const playerCtrlTimeDurationRef = ref<HTMLDivElement>();
    /** 进度条悬浮预览弹出层元素 */
    const progressPopupRef = ref<HTMLDivElement>();
    /** 进度条悬浮预览时间文本元素 */
    const previewTimeRef = ref<HTMLDivElement>();
    /** 音量按钮元素 */
    const ctrlVolumeBtnRef = ref<HTMLDivElement>();
    /** 音量数值文本元素 */
    const volumeNumberRef = ref<HTMLDivElement>();
    /** 音量滑块区域容器元素 */
    const volumeSliderAreaRef = ref<HTMLDivElement>();
    /** 音量进度条元素 */
    const volumeProgressbarRef = ref<HTMLDivElement>();
    /** 音量滑块拖拽手柄元素 */
    const volumeSliderThumbRef = ref<HTMLDivElement>();
    /** 倍速菜单项元素列表 */
    const backrateMenuItems: HTMLLIElement[] = [];
    /** PBP（逐行预览）面板元素 */
    const pbpRef = ref<HTMLDivElement>();

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
     * 鼠标在进度条区域移动时，更新指示器位置和预览时间
     * @param event - 鼠标事件
     */
    const mouseMove = (event: MouseEvent): void => {
      event.preventDefault();
      if (playerProgressAreaRef.current) {
        const containerRect =
          playerProgressAreaRef.current.getBoundingClientRect();
        indicatorLeft = Math.min(
          Math.max(0, event.clientX - containerRect.left + 1),
          containerRect.width,
        );
        if (moveIndicatorRef.current) {
          moveIndicatorRef.current.style.transform = `translateX(${indicatorLeft}px)`;
        }
        popup.currentTime = (indicatorLeft / containerRect.width) * duration;
        if (previewTimeRef.current) {
          previewTimeRef.current.innerHTML = formatTime(popup.currentTime);
        }
        if (indicatorLeft <= 80) {
          popup.left = 0;
        } else if (indicatorLeft >= containerRect.width - 80) {
          popup.left = containerRect.width - 160;
        } else {
          popup.left = indicatorLeft - 80;
        }
        if (progressPopupRef.current) {
          progressPopupRef.current.style.left = `${popup.left}px`;
        }
      }
    };

    /**
     * 鼠标在进度条上按下时，开始拖拽并跳转到对应时间点
     * @param event - 鼠标事件
     */
    const handleMouseDown = (event: MouseEvent): void => {
      if (!isBrowser() || !playerProgressAreaRef.current) return;
      isDragging = true;
      const containerRect =
        playerProgressAreaRef.current.getBoundingClientRect();
      const offsetX = event.clientX - containerRect.left;
      const currentTime =
        Math.min(Math.max(0.00001, offsetX / containerRect.width), 0.99999) *
        duration;
      updateCurrent(currentTime);
      lifecycle.emit?.(ComponentEventEnum.PROGRESS_CHANGE, currentTime);
      lifecycle.emit?.("seek", currentTime);
      lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, "seekStart");
      lifecycle.emit?.("seekStart");
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    };

    /**
     * 拖拽过程中鼠标移动时，实时更新播放进度
     * @param event - 鼠标事件
     */
    const handleMouseMove = (event: MouseEvent): void => {
      if (!isDragging || !playerProgressAreaRef.current) return;
      const containerRect =
        playerProgressAreaRef.current.getBoundingClientRect();
      const offsetX = event.clientX - containerRect.left;
      const currentTime =
        Math.min(Math.max(0.00001, offsetX / containerRect.width), 0.99999) *
        duration;
      updateCurrent(currentTime);
      lifecycle.emit?.(ComponentEventEnum.PROGRESS_CHANGE, currentTime);
      lifecycle.emit?.("seek", currentTime);
    };

    /**
     * 触摸拖拽过程中手指移动时，实时更新播放进度
     * @param event - 触摸事件
     */
    const handleTouchMove = (event: TouchEvent): void => {
      if (!isDragging || !playerProgressAreaRef.current) return;
      event.preventDefault();
      const offsetX =
        event.touches[0].clientX -
        playerProgressAreaRef.current.getBoundingClientRect().left;
      const currentTime =
        Math.min(
          Math.max(
            0.00001,
            offsetX /
              playerProgressAreaRef.current.getBoundingClientRect().width,
          ),
          0.99999,
        ) * duration;
      updateCurrent(currentTime);
      lifecycle.emit?.(ComponentEventEnum.PROGRESS_CHANGE, currentTime);
      lifecycle.emit?.("seek", currentTime);
    };

    /**
     * 鼠标释放时，结束进度条拖拽
     */
    const handleMouseUp = (): void => {
      isDragging = false;
      removeMouseMoveListeners();
      lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, "seekEnd");
      lifecycle.emit?.("seekEnd");
    };

    /**
     * 触摸结束时，结束进度条拖拽
     */
    const handleTouchEnd = (): void => {
      isDragging = false;
      removeMouseMoveListeners();
      lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, "seekEnd");
      lifecycle.emit?.("seekEnd");
    };

    /**
     * 移除进度条拖拽相关的鼠标和触摸事件监听
     */
    const removeMouseMoveListeners = (): void => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleTouchEnd);
    };

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
     * 音量滑块区域鼠标按下时，直接跳转到对应音量
     * @param event - 鼠标事件
     */
    /**
     * 音量拖拽过程中鼠标移动时，实时更新音量
     * @param event - 鼠标事件
     */
    const handleVolumeMouseMove = (event: MouseEvent): void => {
      if (!volumeProgress.isDragging) return;
      const offsetY = volumeProgress.startY - event.clientY;
      const currPer = offsetY / 60;
      const clampedVolume = Math.max(0, Math.min(1, volume + currPer));
      updateVolumeDisplay(clampedVolume);
      lifecycle.emit?.(ComponentEventEnum.VOLUME_CHANGE, clampedVolume);
      lifecycle.emit?.("volumeChange", clampedVolume);
      volumeProgress.startY = event.clientY;
    };

    /**
     * 音量拖拽鼠标释放时，结束音量拖拽
     */
    const handlVolumeMouseUp = (): void => {
      volumeProgress.isDragging = false;
      removeVolumeMouseMoveListeners();
    };

    /**
     * 添加音量拖拽相关的鼠标事件监听
     */
    const addVolumeMouseMoveListeners = (): void => {
      document.addEventListener("mousemove", handleVolumeMouseMove);
      document.addEventListener("mouseup", handlVolumeMouseUp);
    };

    /**
     * 移除音量拖拽相关的鼠标事件监听
     */
    const removeVolumeMouseMoveListeners = (): void => {
      document.removeEventListener("mousemove", handleVolumeMouseMove);
      document.removeEventListener("mouseup", handlVolumeMouseUp);
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
      if (!playerCtrlTimeCurrentRef.current) return;
      playerCtrlTimeCurrentRef.current.textContent = formatTime(current);
    };

    /**
     * 更新进度条拖拽滑块的位置
     * @param current - 当前时间（秒）
     */
    const updateThumbPosition = (current: number): void => {
      if (!progressThumbRef.current || !playerProgressAreaRef.current) return;
      const position =
        (current / duration) * playerProgressAreaRef.current.clientWidth - 10;
      applyTransform(progressThumbRef.current, 1, `translateX(${position}px)`);
    };

    /**
     * 更新音量显示，包括音量数值、进度条高度和滑块位置
     * @param newVolume - 新的音量值，范围 0-1
     */
    const updateVolumeDisplay = (newVolume: number): void => {
      if (volume <= 0 && newVolume > 0) {
        ctrlVolumeBtnRef.current?.classList.remove("state-muted");
      } else if (volume > 0 && newVolume <= 0) {
        ctrlVolumeBtnRef.current?.classList.add("state-muted");
      }
      volume = newVolume;
      if (
        volumeNumberRef.current &&
        volumeProgressbarRef.current &&
        volumeSliderThumbRef.current
      ) {
        volumeNumberRef.current.innerHTML = Math.floor(volume * 100).toString();
        volumeProgressbarRef.current.style.transform = `scaleY(${volume})`;
        volumeSliderThumbRef.current.style.transform = `translateY(${-(60 * volume - 6)}px)`;
      }
    };

    /**
     * 初始化总时长文本显示
     */
    const initDuration = (): void => {
      if (playerCtrlTimeDurationRef.current) {
        playerCtrlTimeDurationRef.current.innerHTML = formatTime(duration);
      }
    };

    // ============================================
    // 生命周期钩子
    // ============================================

    lifecycle.onMounted = (): void => {
      initDuration();
      initBackrate();
      initTooltip();

      // 暴露控制栏 API 给父组件
      lifecycle.emit?.("controlsMounted", {
        updateVolumeDisplay,
        showControl: () => {
          if (controlEntityRef.current) {
            controlEntityRef.current.setAttribute("data-shadow-show", "false");
          }
          pbpRef.current?.classList.add("show");
        },
        hideControl: () => {
          if (controlEntityRef.current) {
            controlEntityRef.current.setAttribute("data-shadow-show", "true");
          }
          pbpRef.current?.classList.remove("show");
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
          "data-shadow-show": "false",
          ref: controlEntityRef,
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
            ref: playerShadowProgressAreaRef,
          },
          h("div", {
            class: "player-shadow-progress-schedule-wrap",
            ref: playerShadowProgressScheduleWrapRef,
          }),
        ),
        h(PbpControls, {
          ref: pbpRef,
          onPbpClick: () => {},
          onPbpPinClick: () => {},
        }),
      ),
    );
  },
);
