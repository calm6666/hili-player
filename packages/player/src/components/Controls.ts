/**
 * ============================================
 * 控制条组件 (Controls)
 * ============================================
 * 所有 DOM 引用通过 useTemplateRef 获取
 */

import { h, defineComponent, useTemplateRef, useContext, useState } from "@/core";
import type {
  VolumeProgress,
  Tooltip,
  ControlsConfig,
} from "@/hili-player/types";
import type { ProgressSegment } from "@/types";
import type { ProgressPreviewSource } from "@/hili-player/utils/media/progressPreview";
import type { EnergyProgressData } from "@/hili-player/utils/media/energyProgress";
import {
  ConfigContext,
  PlayerStateKeyEnum,
  StateContext,
} from "@/store/runtimeState";
import type {
  PlayerStateMap,
  TypedStateManager,
} from "@/store/runtimeState";
import { formatTime } from "@/utils/formatTime";
import { rafTimeout, cancelRaf } from "@/utils/rafTimeout";
import type { AnimationFrameID } from "@/utils/rafTimeout";
import { ComponentEventEnum } from "@/core/events";
import { LeftControls } from "./LeftControls";
import { RightControls } from "./RightControls";
import { TopControls } from "./TopControls";
import { PbpControls } from "./PbpControls";
import { ShadowProgressArea } from "./ShadowProgressArea";
import type { ShadowProgressAreaApi } from "./ShadowProgressArea";
import type { ProgressBarApi } from "./ProgressBar";

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
  /** 选集面板选择某一集，值为列表下标 */
  eplistChange: number;
  subtitleToggle: boolean;
  subtitleLangChange: string;
  subtitleStyleChange: {
    fontSize?: number;
    color?: string;
    position?: "top" | "bottom";
    offset?: number;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
    scale?: boolean;
    fade?: boolean;
  };
  bilingualChange: boolean;
  settingChange: { key: string; value: boolean | string | number };
  moreSettingClick: undefined;
  showTooltip: Tooltip;
  hideTooltip: Tooltip;
  progressChange: number;
  stateChange: unknown;
  /** 顶部进度条挂载完成，向上层回传其更新 API */
  progressBarMounted: ProgressBarApi;
};

export interface ControlsProps {
  duration: number;
  volume: number;
  backrate: number;
  /** 预览数据提供者（雪碧图或逐帧，透传给顶部进度条） */
  getPreviewFrames?: () => ProgressPreviewSource | string[] | null;
  /** 高能进度条数据提供者（/x/player/pbp 采样点，透传给 PbpControls） */
  getEnergyProgress?: () => EnergyProgressData | null;
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
  /** 更新总时长（底部影子进度条与进度条分段共用） */
  setDuration: (duration: number) => void;
  /** 重建底部影子进度条分段（progress.segments 运行时变化时调用） */
  setProgressSegments: (segments?: ProgressSegment[]) => void;
}

/**
 * 控制条组件
 */
export const Controls = defineComponent<ControlsProps, ControlsEvents>(
  (props, lifecycle) => {
    // ============================================
    // 状态数据
    // ============================================

    /** 视频总时长（秒），元数据加载后由 setDuration 更新 */
    let duration = props.duration;
    /** 当前音量，范围 0-1 */
    let volume = props.volume;
    /** 当前播放倍速 */
    const backrate = props.backrate;
    const configCtx = useContext<ControlsConfig>(ConfigContext);
    /** 控制条配置（浅拷贝，避免修改原始 props） */
    const config: ControlsConfig = {
      ...configCtx,
    };

    const stateMgr = useContext<TypedStateManager<PlayerStateMap> | null>(
      StateContext,
    );

    /** 底部影子进度条 API（由 ShadowProgressArea 挂载后填充） */
    let shadowApi: ShadowProgressAreaApi | null = null;

    /** 高能进度条常驻态：存在多个分段即常驻，之后由 `.player-pbp-pin` 或设置面板切换 */
    let permanent = (config.progressSegments?.length ?? 0) > 1;

    // 常驻态是全局状态，写入运行时状态（PbpControls / 影子进度条 / 设置面板订阅同一份）
    stateMgr?.set(PlayerStateKeyEnum.PBP_PERMANENT, permanent);

    /** 应用常驻态到运行时状态（订阅方据此更新影子进度条与高能进度条） */
    const applyPermanent = (next: boolean): void => {
      permanent = next;
      stateMgr?.set(PlayerStateKeyEnum.PBP_PERMANENT, next);
    };

    /** 视频进度数据 */
    const videoProgress: VideoPlayerProgress = {
      bufferTime: 0,
      currentTime: 0,
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

    /** 提示按钮名 → 选择器（按钮由左右控制栏子组件渲染，父层挂载后才可检索到） */
    const TOOLTIP_SELECTORS: Record<string, string> = {
      prev: ".player-ctrl-btn.player-ctrl-prev",
      next: ".player-ctrl-btn.player-ctrl-next",
      pip: ".player-ctrl-btn.player-ctrl-pip",
      wide: ".player-ctrl-btn.player-ctrl-wide",
      web: ".player-ctrl-btn.player-ctrl-web",
      full: ".player-ctrl-btn.player-ctrl-full",
    };

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
    // 高能进度条 API（由 PbpControls 挂载后填充）
    let pbpApi: {
      setShow: (show: boolean) => void;
      setPermanent: (permanent: boolean) => void;
      setEnergy: (data: EnergyProgressData | null) => void;
      setProgress: (time: number) => void;
      setDuration: (duration: number) => void;
    } | null = null;

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
      // 底部影子进度条与顶部进度条同源：控制栏隐藏时显示的就是它
      shadowApi?.updateProgress(current);
      // 高能进度条按同一进度重绘已播放面积
      pbpApi?.setProgress(current);
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
        volumeNumberRef.value.textContent = Math.floor(volume * 100).toString();
        volumeProgressbarRef.value.style.transform = `scaleY(${volume})`;
        volumeSliderThumbRef.value.style.transform = `translateY(${-(60 * volume - 6)}px)`;
      }
    };

    /**
     * 初始化总时长文本显示
     */
    const initDuration = (): void => {
      if (playerCtrlTimeDurationRef.value) {
        playerCtrlTimeDurationRef.value.textContent = formatTime(duration);
      }
    };

    /**
     * 更新总时长，并同步到底部影子进度条
     * @param value - 视频总时长（秒）
     */
    const setDuration = (value: number): void => {
      duration = value;
      shadowApi?.setDuration(value);
      // 高能进度条需要总时长把播放进度换算成采样点下标
      pbpApi?.setDuration(value);
      initDuration();
    };

    /**
     * 重建底部影子进度条分段（顶部进度条由上层经 ProgressBarApi 重建）
     * @param next - 最新分段数据
     */
    const setProgressSegments = (next?: ProgressSegment[]): void => {
      shadowApi?.rebuildSegments(next);
      applyPermanent((next?.length ?? 0) > 1);
    };

    // ============================================
    // 生命周期钩子
    // ============================================

    let shadowShow = true;
    let shadowObserver: MutationObserver | null = null;

    const applyShadowShow = (show: boolean): void => {
      shadowShow = show;
      controlEntityRef.value?.setAttribute(
        "data-shadow-show",
        show ? "true" : "false",
      );
      pbpApi?.setShow(!show);
    };

    const shadowObserve = (): void => {
      controlEntityRef.value?.setAttribute(
        "data-shadow-show",
        shadowShow ? "true" : "false",
      );
      const container = controlEntityRef.value?.closest(".player-container");
      if (!container || typeof MutationObserver === "undefined") return;
      shadowObserver?.disconnect();
      shadowObserver = new MutationObserver(() => {
        controlEntityRef.value?.setAttribute(
          "data-shadow-show",
          shadowShow ? "true" : "false",
        );
      });
      shadowObserver.observe(container, {
        attributeFilter: ["data-screen"],
        attributes: true,
      });
    };

    lifecycle.onMounted = (): void => {
      initDuration();
      initBackrate();

      // 常驻态订阅：设置面板勾选 / 图钉点击任一处写入运行时状态，这里落到影子条与高能条
      if (stateMgr) {
        useState(
          stateMgr,
          PlayerStateKeyEnum.PBP_PERMANENT,
          (value) => {
            permanent = value;
            shadowApi?.setPermanent(value);
            pbpApi?.setPermanent(value);
          },
          lifecycle,
        );
      }
      shadowApi?.setPermanent(permanent);
      pbpApi?.setPermanent(permanent);

      // 填充菜单配置：子组件（LeftControls / RightControls）先于父组件挂载，
      // 此处控制条主体 DOM 已就绪，可直接在实体容器内检索各菜单挂载点
      // （与既有实现 initMenu 的 querySelector 初始化方式一致）
      const entity = controlEntityRef.value;
      if (entity) {
        tooltipBtns.forEach((btn) => {
          btn.element = entity.querySelector<HTMLDivElement>(
            TOOLTIP_SELECTORS[btn.name] ?? "",
          );
        });
        initTooltip();
      }

      shadowObserve();

      // 暴露控制栏 API 给父组件
      lifecycle.emit?.("controlsMounted", {
        updateVolumeDisplay,
        showControl: () => {
          applyShadowShow(false);
        },
        hideControl: () => {
          applyShadowShow(true);
        },
        updateMute: (isMuted: boolean) => {
          volumeProgress.isMuted = isMuted;
        },
        updateBuffer: (buffer: number) => {
          updateMainProgress(buffer);
          shadowApi?.updateBuffer(buffer);
        },
        updateCurrent,
        initDuration,
        setDuration,
        setProgressSegments,
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

    /** 选集面板选择某一集：仅透传下标，由上层接到 VideoPlayer.switchTo(index) */
    /** 字幕：开关向上转发 */
    const handleRightSubtitleToggle = (visible: boolean): void => {
      lifecycle.emit?.("subtitleToggle", visible);
    };

    /** 字幕：语言切换向上转发 */
    const handleRightSubtitleLangChange = (lang: string): void => {
      lifecycle.emit?.("subtitleLangChange", lang);
    };

    /** 字幕：样式变化向上转发 */
    const handleRightSubtitleStyleChange = (patch: {
      fontSize?: number;
      color?: string;
      position?: "top" | "bottom";
      offset?: number;
      strokeColor?: string;
      strokeWidth?: number;
      opacity?: number;
      scale?: boolean;
      fade?: boolean;
    }): void => {
      lifecycle.emit?.("subtitleStyleChange", patch);
    };

    /** 字幕：双语开关向上转发 */
    const handleRightBilingualChange = (enabled: boolean): void => {
      lifecycle.emit?.("bilingualChange", enabled);
    };

    const handleRightEplistChange = (index: number): void => {
      lifecycle.emit?.("eplistChange", index);
    };

    const handleRightSettingChange = (payload: {
      key: string;
      value: boolean | string | number;
    }): void => {
      lifecycle.emit?.("settingChange", payload);
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
          getPreviewFrames: props.getPreviewFrames,
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
            onEplistChange: handleRightEplistChange,
            onSubtitleToggle: handleRightSubtitleToggle,
            onSubtitleLangChange: handleRightSubtitleLangChange,
            onSubtitleStyleChange: handleRightSubtitleStyleChange,
            onBilingualChange: handleRightBilingualChange,
            onSettingChange: handleRightSettingChange,
            onMoreSettingClick: () => lifecycle.emit?.("moreSettingClick"),
          }),
        ),
        // 底部影子进度条（控制栏隐藏时常驻下沿，与顶部进度条同几何同数据源）
        h(ShadowProgressArea, {
          duration,
          progressSegments: config.progressSegments,
          permanent,
          onShadowProgressAreaMounted: (api: ShadowProgressAreaApi) => {
            shadowApi = api;
            api.setPermanent(permanent);
          },
        }),
        // 高能进度条（常驻 DOM，控制栏展开时由 setShow(true) 抬到控制栏之上）
        h(PbpControls, {
          onPbpControlsMounted: (api: {
            setShow: (show: boolean) => void;
            setPermanent: (permanent: boolean) => void;
            setEnergy: (data: EnergyProgressData | null) => void;
            setProgress: (time: number) => void;
            setDuration: (duration: number) => void;
          }) => {
            pbpApi = api;
            // 数据与常驻态可能早于组件挂载到达：挂载时补一次
            api.setDuration(duration);
            api.setPermanent(permanent);
            api.setEnergy(props.getEnergyProgress?.() ?? null);
            api.setProgress(videoProgress.currentTime);
          },
          onPbpClick: () => {},
          // 图钉：切换《高能进度条》常驻（与提示文案语义一致）
          onPbpPinClick: () => {
            applyPermanent(!permanent);
          },
        }),
      ),
    );
  },
);
