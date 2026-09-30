/**
 * ============================================
 * 播放器主容器组件 (PlayerDocker)
 * ============================================
 */

import { defineComponent, h, useTemplateRef, useContext } from "@/core";
import type { TypedStateManager } from "@/core";
import type { PlayerEventBus } from "@/core/events";
import {
  createHotkeyHandler,
  type HotkeyContext,
} from "@/hili-player/core/hotkeys";
import {
  isBrowser,
  safeResizeObserver,
  safeIntersectionObserver,
} from "@/utils";
import { Controls } from "@/hili-player/components/Controls";
import { RowDm } from "@/hili-player/components/RowDm";
import { SubtitleLayer } from "@/hili-player/components/SubtitleLayer";
import { InteractionLayer } from "@/hili-player/components/InteractionLayer";
import { Dialog } from "@/hili-player/components/Dialog";
import { PlayerEventEnum } from "@/core/events";
import {
  PlayerStateKeyEnum,
  ConfigContext,
  StateContext,
  type PlayerStateMap,
} from "@/store/runtimeState";
import { PlayerState } from "@/types";
import type { ControlConfig } from "@/hili-player/types";

// ============================================
// 组件 API 接口定义
// ============================================

/** 弹幕层 API */
interface DanmakuLayerAPI {
  /** 根据当前时间创建弹幕 */
  createDanmaku: (currentTime: number) => void;
  /** 切换弹幕播放/暂停状态 */
  playPause: (state: "playing" | "paused") => void;
  /** 显示弹幕提示信息 */
  showDmTip: (event: MouseEvent, element: HTMLElement) => void;
  /** 隐藏弹幕提示信息 */
  hideDmTip: (element: HTMLElement) => void;
}

/** 字幕层 API */
interface SubtitleLayerAPI {
  /** 字幕容器元素 */
  subtitleWrap: HTMLElement | null;
  /** 设置字幕字体大小 */
  setFontSize: (size: number) => void;
  /** 设置字幕颜色 */
  setColor: (color: string) => void;
  /** 设置字幕背景颜色 */
  setBackgroundColor: (color: string) => void;
  /** 设置字幕位置（顶部/居中/底部） */
  setPosition: (position: "top" | "center" | "bottom") => void;
}

/** 互动层 API */
interface InteractionLayerAPI {
  /** 互动层容器元素 */
  container: HTMLElement | null;
}

/** 对话框 API */
interface DialogAPI {
  /** 对话框容器元素 */
  dialogWrap: HTMLElement | null;
  /** 显示弹幕提示详情 */
  showDmTip: (
    dmTip: {
      content: string;
      timePoint: number;
      user?: string;
      color?: string;
      mode?: string;
      fontSize?: number;
    },
    container: HTMLElement,
  ) => void;
  /** 隐藏弹幕提示详情 */
  hideDmTip: (element?: HTMLElement) => void;
}

// ============================================
// 组件事件类型
// ============================================

export type PlayerDockerEvents = {
  mounted: {
    container: HTMLElement;
    videoArea: HTMLElement;
    videoWrap: HTMLElement;
    video: HTMLVideoElement;
    sendingArea: HTMLElement;
  };
  videoCreated: { video: HTMLVideoElement };
  loadedMetadata: { duration: number };
  timeUpdate: { currentTime: number };
  progress: { buffer: number };
  play: undefined;
  pause: undefined;
  ended: undefined;
  waiting: undefined;
  canplay: undefined;

  // ===== HTML5 媒体元素标准事件（完整 21 个）=====
  /** 开始加载媒体 */
  loadStart: undefined;
  /** 首帧数据加载完成 */
  loadedData: undefined;
  /** 媒体时长变化 */
  durationChange: { duration: number };
  /** 实际开始播放（缓冲结束后） */
  playing: undefined;
  /** 跳转开始 */
  seeking: { currentTime: number };
  /** 跳转完成 */
  seeked: { currentTime: number };
  /** 音量 / 静音变化 */
  volumeChange: { volume: number; muted: boolean };
  /** 播放速率变化 */
  rateChange: { rate: number };
  /** 浏览器主动暂停加载（非错误） */
  suspend: undefined;
  /** 数据停滞 */
  stalled: undefined;
  /** 加载被中止 */
  abort: undefined;
  /** 媒体被清空 */
  emptied: undefined;
  /** 加载 / 解码错误 */
  error: { error: MediaError | null | undefined };

  contextMenu: { x: number; y: number };
  playerLoaded: undefined;
  danmakuLayerMounted: DanmakuLayerAPI;
  showDmTip: { event: MouseEvent; element: HTMLElement };
  hideDmTip: { element: HTMLElement };
  subtitleLayerMounted: SubtitleLayerAPI;
  interactionLayerMounted: InteractionLayerAPI;
  dialogMounted: DialogAPI;
  pipToggle: undefined;
  prev: undefined;
  next: undefined;
  like: undefined;
  coin: undefined;
  favorite: undefined;
  tripleLike: undefined;
  follow: undefined;
  danmakuToggle: undefined;
  sendDanmaku: undefined;
};

// ============================================
// 组件属性接口
// ============================================

export interface PlayerDockerProps {
  events?: PlayerEventBus;
}

// ============================================
// 播放器主容器组件
// ============================================

/**
 * 播放器主容器组件
 */
export const PlayerDocker = defineComponent<
  PlayerDockerProps,
  PlayerDockerEvents
>((props, lifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================

  /** 视频元素 */
  const videoRef = useTemplateRef<HTMLVideoElement>(lifecycle, 'videoRef');

  /** 播放器外层容器 */
  const playerDockerRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerDockerRef');

  /** 播放器容器 */
  const playerContainerRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerContainerRef');

  /** 视频区域 */
  const playerVideoAreaRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerVideoAreaRef');

  /** 视频占位容器 */
  const playerVideoPerchRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerVideoPerchRef');

  /** 视频包装容器 */
  const playerVideoWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerVideoWrapRef');

  /** 发送区域 */
  const playerSendingAreaRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerSendingAreaRef');

  // ============================================
  // 状态管理器（通过 Context 获取，无需 props 传递）
  // ============================================

  const configCtx = useContext<ControlConfig>(ConfigContext);

  const stateMgr = useContext<TypedStateManager<PlayerStateMap> | null>(
    StateContext,
  );

  // ============================================
  // 状态数据
  // ============================================

  /** 播放器状态信息 */
  const playerInfo = {
    /** 当前屏幕模式：normal/web/full/mini */
    dataScreen: "normal",
    /** 是否处于画中画模式 */
    isPip: false,
    /** 是否处于宽屏模式 */
    isWide: false,
    /** 当前音量，范围 0-1 */
    volume: props.volume ?? 0.3,
    /** 是否静音 */
    isMuted: props.muted ?? false,
    /** 视频画面比例 */
    videoRatio: "auto",
    /** 是否处于迷你播放器模式 */
    isMinPlayer: false,
    /** 是否正在播放 */
    isPlaying: false,
    /** 当前播放倍速 */
    backrate: 1,
    /** 当前画质索引 */
    qualityIndex: 0,
  };

  /** 是否处于网页全屏模式 */
  let isWebFullscreen = false;

  /** 视频播放信息 */
  const videoInfo = {
    /** 视频总时长（秒） */
    duration: 0,
    /** 缓冲进度时间（秒） */
    buffer: 0,
    /** 当前播放时间（秒） */
    currentTime: 0,
  };

  // ============================================
  // 初始化方法
  // ============================================

  /**
   * 判断视频源是否可直接播放（不需要流媒体插件）
   * .m3u8/.mpd/.flv/.json 等需要通过 HLS/DASH/FLV 插件加载
   */
  const isDirectPlayableSrc = (src: string): boolean => {
    const streamingExts = [".m3u8", ".mpd", ".flv", ".json"];
    const lower = src.split("?")[0].toLowerCase();
    return !streamingExts.some((ext) => lower.endsWith(ext));
  };

  /**
   * 初始化视频元素，创建 video 标签并绑定事件
   */
  const initVideo = (): void => {
    const video = videoRef.value;
    if (!video) return;

    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.playsInline = true;
    video.setAttribute("playsinline", "");

    // 仅对可直接播放的源设置 video.src
    // 流媒体源（.m3u8/.mpd/.flv/.json manifest）由插件负责加载
    if (props.src && isDirectPlayableSrc(props.src)) {
      video.src = props.src;
    }

    video.volume = playerInfo.volume;
    video.muted = playerInfo.isMuted;

    if (props.autoplay) {
      video.autoplay = true;
    }

    // ===== HTML5 媒体元素标准事件（完整 21 个）=====
    // 加载生命周期
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("progress", handleProgress);
    video.addEventListener("suspend", handleSuspend);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("abort", handleAbort);
    video.addEventListener("emptied", handleEmptied);
    video.addEventListener("error", handleError);
    // 播放状态
    video.addEventListener("play", handlePlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    // 进度与跳转
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeked);
    // 音量与速率
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("ratechange", handleRateChange);
    // 缓冲等待
    video.addEventListener("waiting", handleWaiting);

    lifecycle.emit?.("videoCreated", { video });
  };

  // ============================================
  // 事件处理器
  // ============================================

  /**
   * 视频元数据加载完成时，初始化时长显示和音量状态
   */
  const handleLoadedMetadata = (): void => {
    if (!videoRef.value) return;
    videoInfo.duration = videoRef.value.duration;
    stateMgr?.set(PlayerStateKeyEnum.DURATION, videoInfo.duration);
    lifecycle.emit?.("loadedMetadata", { duration: videoInfo.duration });

    // 延迟初始化控制栏（确保 Controls 组件已挂载）
    controlsApi.initDuration?.();
    controlsApi.updateVolumeDisplay?.(playerInfo.volume);
    if (playerInfo.isMuted) {
      controlsApi.updateMute?.(true);
    }
  };

  /**
   * 视频播放时间更新时，同步更新控制栏进度和弹幕
   */
  const handleTimeUpdate = (): void => {
    if (!videoRef.value) return;
    videoInfo.currentTime = videoRef.value.currentTime;
    stateMgr?.set(PlayerStateKeyEnum.CURRENT_TIME, videoInfo.currentTime);
    controlsApi.updateCurrent?.(videoInfo.currentTime);
    rowDmApi.createDanmaku?.(videoInfo.currentTime);
    lifecycle.emit?.("timeUpdate", { currentTime: videoInfo.currentTime });
    props.events?.emit(PlayerEventEnum.TIME_UPDATE, {
      time: videoInfo.currentTime,
    });
  };

  /**
   * 视频缓冲进度更新时，同步更新控制栏缓冲进度
   */
  const handleProgress = (): void => {
    if (!videoRef.value) return;
    const buffered = videoRef.value.buffered;
    if (buffered.length > 0) {
      videoInfo.buffer = buffered.end(buffered.length - 1);
      stateMgr?.set(PlayerStateKeyEnum.BUFFERED, videoInfo.buffer);
      controlsApi.updateBuffer?.(videoInfo.buffer);
      lifecycle.emit?.("progress", { buffer: videoInfo.buffer });
    }
  };

  /**
   * 视频开始播放时，更新播放状态和弹幕
   */
  const handlePlay = (): void => {
    playerInfo.isPlaying = true;
    playerContainerRef.value?.classList.remove("state-paused");
    rowDmApi.playPause?.("playing");
    stateMgr?.set(PlayerStateKeyEnum.STATE, PlayerState.PLAYING);
    lifecycle.emit?.("play");
  };

  /**
   * 视频暂停时，更新暂停状态和弹幕
   */
  const handlePause = (): void => {
    playerInfo.isPlaying = false;
    playerContainerRef.value?.classList.add("state-paused");
    rowDmApi.playPause?.("paused");
    stateMgr?.set(PlayerStateKeyEnum.STATE, PlayerState.PAUSED);
    lifecycle.emit?.("pause");
  };

  /**
   * 视频播放结束时，更新播放状态
   */
  const handleEnded = (): void => {
    playerInfo.isPlaying = false;
    stateMgr?.set(PlayerStateKeyEnum.STATE, PlayerState.ENDED);
    lifecycle.emit?.("ended");
  };

  /**
   * 视频缓冲等待时，添加缓冲状态样式
   */
  const handleWaiting = (): void => {
    playerContainerRef.value?.classList.add("state-buff");
    stateMgr?.set(PlayerStateKeyEnum.IS_LOADING, true);
    lifecycle.emit?.("waiting");
  };

  /**
   * 视频缓冲完成可播放时，移除缓冲状态样式
   */
  const handleCanPlay = (): void => {
    playerContainerRef.value?.classList.remove("state-buff");
    stateMgr?.set(PlayerStateKeyEnum.IS_LOADING, false);
    lifecycle.emit?.("canplay");
  };

  // ============================================
  // HTML5 媒体元素标准事件处理器（补全）
  // ============================================

  /** loadstart：开始加载媒体 */
  const handleLoadStart = (): void => {
    stateMgr?.set(PlayerStateKeyEnum.IS_LOADING, true);
    lifecycle.emit?.("loadStart");
  };

  /** loadeddata：首帧数据加载完成 */
  const handleLoadedData = (): void => {
    lifecycle.emit?.("loadedData");
  };

  /** durationchange：时长变化，同步时长显示 */
  const handleDurationChange = (): void => {
    if (!videoRef.value) return;
    videoInfo.duration = videoRef.value.duration;
    stateMgr?.set(PlayerStateKeyEnum.DURATION, videoInfo.duration);
    controlsApi.initDuration?.();
    lifecycle.emit?.("durationChange", { duration: videoInfo.duration });
  };

  /** playing：实际开始播放（缓冲结束后） */
  const handlePlaying = (): void => {
    playerContainerRef.value?.classList.remove("state-buff");
    playerInfo.isPlaying = true;
    stateMgr?.set(PlayerStateKeyEnum.IS_LOADING, false);
    lifecycle.emit?.("playing");
  };

  /** seeking：跳转开始 */
  const handleSeeking = (): void => {
    playerContainerRef.value?.classList.add("state-buff");
    lifecycle.emit?.("seeking", {
      currentTime: videoRef.value?.currentTime ?? 0,
    });
  };

  /** seeked：跳转完成 */
  const handleSeeked = (): void => {
    playerContainerRef.value?.classList.remove("state-buff");
    const currentTime = videoRef.value?.currentTime ?? 0;
    stateMgr?.set(PlayerStateKeyEnum.CURRENT_TIME, currentTime);
    controlsApi.updateCurrent?.(currentTime);
    lifecycle.emit?.("seeked", { currentTime });
  };

  /** volumechange：音量 / 静音变化 */
  const handleVolumeChange = (): void => {
    if (!videoRef.value) return;
    playerInfo.volume = videoRef.value.volume;
    playerInfo.isMuted = videoRef.value.muted;
    stateMgr?.set(PlayerStateKeyEnum.VOLUME, videoRef.value.volume);
    stateMgr?.set(PlayerStateKeyEnum.MUTED, videoRef.value.muted);
    controlsApi.updateVolumeDisplay?.(videoRef.value.volume);
    controlsApi.updateMute?.(videoRef.value.muted);
    lifecycle.emit?.("volumeChange", {
      volume: videoRef.value.volume,
      muted: videoRef.value.muted,
    });
  };

  /** ratechange：播放速率变化 */
  const handleRateChange = (): void => {
    if (!videoRef.value) return;
    stateMgr?.set(PlayerStateKeyEnum.PLAYBACK_RATE, videoRef.value.playbackRate);
    lifecycle.emit?.("rateChange", { rate: videoRef.value.playbackRate });
  };

  /** suspend：浏览器主动暂停加载（非错误） */
  const handleSuspend = (): void => {
    lifecycle.emit?.("suspend");
  };

  /** stalled：数据停滞 */
  const handleStalled = (): void => {
    lifecycle.emit?.("stalled");
  };

  /** abort：加载被中止 */
  const handleAbort = (): void => {
    stateMgr?.set(PlayerStateKeyEnum.IS_LOADING, false);
    lifecycle.emit?.("abort");
  };

  /** emptied：媒体被清空（重新加载前） */
  const handleEmptied = (): void => {
    lifecycle.emit?.("emptied");
  };

  /** error：加载 / 解码错误 */
  const handleError = (): void => {
    lifecycle.emit?.("error", { error: videoRef.value?.error });
  };

  // ============================================
  // 控制栏 API（延迟初始化后赋值）
  // ============================================

  /** 控制栏组件 API，由 Controls 组件挂载后填充 */
  const controlsApi: {
    /** 更新音量显示 */
    updateVolumeDisplay?: (vol: number) => void;
    /** 显示控制栏 */
    showControl?: () => void;
    /** 隐藏控制栏 */
    hideControl?: () => void;
    /** 更新静音状态 */
    updateMute?: (isMuted: boolean) => void;
    /** 更新缓冲进度 */
    updateBuffer?: (buffer: number) => void;
    /** 更新当前播放时间 */
    updateCurrent?: (current: number) => void;
    /** 初始化时长显示 */
    initDuration?: () => void;
  } = {};

  /** 弹幕组件 API，由 RowDm 组件挂载后填充 */
  const rowDmApi: {
    /** 根据当前时间创建弹幕 */
    createDanmaku?: (currentTime: number) => void;
    /** 切换弹幕播放/暂停状态 */
    playPause?: (state: "playing" | "paused") => void;
    /** 显示弹幕提示信息 */
    showDmTip?: (event: MouseEvent, element: HTMLElement) => void;
    /** 隐藏弹幕提示信息 */
    hideDmTip?: (element: HTMLElement) => void;
  } = {};

  /** 字幕组件 API，由 SubtitleLayer 组件挂载后填充 */
  const subtitleApi: {
    /** 字幕容器元素 */
    subtitleWrap?: HTMLElement | null;
    /** 设置字幕字体大小 */
    setFontSize?: (size: number) => void;
    /** 设置字幕颜色 */
    setColor?: (color: string) => void;
    /** 设置字幕背景颜色 */
    setBackgroundColor?: (color: string) => void;
    /** 设置字幕位置 */
    setPosition?: (position: "top" | "center" | "bottom") => void;
  } = {};

  /** 互动层组件 API，由 InteractionLayer 组件挂载后填充 */
  const interactionApi: {
    /** 互动层容器元素 */
    container?: HTMLElement | null;
  } = {};

  /** 对话框组件 API，由 Dialog 组件挂载后填充 */
  const dialogApi: {
    /** 对话框容器元素 */
    dialogWrap?: HTMLElement | null;
    /** 显示弹幕提示详情 */
    showDmTip?: (
      dmTip: {
        content: string;
        timePoint: number;
        user?: string;
        color?: string;
        mode?: string;
        fontSize?: number;
      },
      container: HTMLElement,
    ) => void;
    /** 隐藏弹幕提示详情 */
    hideDmTip?: (element?: HTMLElement) => void;
  } = {};

  // ============================================
  // 控制栏自动隐藏定时器
  // ============================================

  /** 自动隐藏定时器 ID */
  let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  /** 自动隐藏延迟（毫秒） */
  const AUTO_HIDE_DELAY = 3000;

  // ============================================
  // 事件清理函数集合
  // ============================================

  /** 存储所有需要清理的事件解绑函数 */
  const cleanupFns: (() => void)[] = [];

  // ============================================
  // 播放控制方法
  // ============================================

  /** 切换播放/暂停 */
  const togglePlayPause = (): void => {
    if (!videoRef.value) return;
    if (playerInfo.isPlaying) {
      videoRef.value.pause();
    } else {
      videoRef.value.play();
    }
  };

  /** 切换全屏模式 */
  const toggleFullscreen = (): void => {
    if (!playerContainerRef.value) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerContainerRef.value.requestFullscreen();
    }
  };

  /** 切换网页全屏模式 */
  const toggleWebFullscreen = (): void => {
    if (!playerDockerRef.value || !playerContainerRef.value) return;
    if (isWebFullscreen) {
      playerDockerRef.value.classList.remove("mode-webscreen");
      document.body.classList.remove("webscreen-fix");
      playerContainerRef.value.setAttribute("data-screen", "normal");
      isWebFullscreen = false;
      stateMgr?.set(PlayerStateKeyEnum.IS_WEB_FULLSCREEN, false);
    } else {
      playerDockerRef.value.classList.add("mode-webscreen");
      document.body.classList.add("webscreen-fix");
      playerContainerRef.value.setAttribute("data-screen", "web");
      isWebFullscreen = true;
      stateMgr?.set(PlayerStateKeyEnum.IS_WEB_FULLSCREEN, true);
    }
  };

  /** 切换静音状态 */
  const toggleMute = (): void => {
    playerInfo.isMuted = !playerInfo.isMuted;
    if (videoRef.value) {
      videoRef.value.muted = playerInfo.isMuted;
    }
    stateMgr?.set(PlayerStateKeyEnum.MUTED, playerInfo.isMuted);
    controlsApi.updateMute?.(playerInfo.isMuted);
  };

  /** 设置音量，限制在 0-1 范围内 */
  const setVolume = (vol: number): void => {
    const clamped = Math.min(1, Math.max(0, vol));
    playerInfo.volume = clamped;
    if (videoRef.value) videoRef.value.volume = clamped;
    stateMgr?.set(PlayerStateKeyEnum.VOLUME, clamped);
    controlsApi.updateVolumeDisplay?.(clamped);
  };

  /** 显示控制栏并重置自动隐藏定时器 */
  const showControls = (): void => {
    if (!playerContainerRef.value) return;
    playerContainerRef.value.setAttribute("data-ctrl-hidden", "false");
    playerContainerRef.value.classList.remove("state-no-cursor");
    controlsApi.showControl?.();
    resetAutoHideTimer();
  };

  /** 隐藏控制栏 */
  const hideControls = (): void => {
    if (!playerContainerRef.value) return;
    playerContainerRef.value.setAttribute("data-ctrl-hidden", "true");
    playerContainerRef.value.classList.add("state-no-cursor");
    controlsApi.hideControl?.();
  };

  /** 重置自动隐藏定时器，播放中 3 秒后自动隐藏控制栏 */
  const resetAutoHideTimer = (): void => {
    if (autoHideTimer !== null) {
      clearTimeout(autoHideTimer);
    }
    autoHideTimer = setTimeout(() => {
      if (playerInfo.isPlaying) {
        hideControls();
      }
      autoHideTimer = null;
    }, AUTO_HIDE_DELAY);
  };

  // ============================================
  // 快捷键处理器
  // ============================================

  const hotkeyCtx: HotkeyContext = {
    videoRef,
    togglePlayPause,
    toggleFullscreen,
    toggleMute,
    setVolume,
    like: () => {
      lifecycle.emit?.("like");
    },
    coin: () => {
      lifecycle.emit?.("coin");
    },
    favorite: () => {
      lifecycle.emit?.("favorite");
    },
    tripleLike: () => {
      lifecycle.emit?.("tripleLike");
    },
    follow: () => {
      lifecycle.emit?.("follow");
    },
    toggleDanmaku: () => {
      lifecycle.emit?.("danmakuToggle");
    },
    sendDanmaku: () => {
      lifecycle.emit?.("sendDanmaku");
    },
    prevEpisode: () => {
      lifecycle.emit?.("prev");
    },
    nextEpisode: () => {
      lifecycle.emit?.("next");
    },
    setPlaybackRate: (rate: number): void => {
      playerInfo.backrate = rate;
      if (videoRef.value) {
        videoRef.value.playbackRate = rate;
      }
      stateMgr?.set(PlayerStateKeyEnum.PLAYBACK_RATE, rate);
    },
  };

  const onKeyboard = createHotkeyHandler(hotkeyCtx);

  /**
   * 全屏状态变化时，更新屏幕模式属性
   */
  const onFullscreenChange = (): void => {
    if (!playerContainerRef.value) return;
    if (document.fullscreenElement) {
      playerContainerRef.value.setAttribute("data-screen", "full");
      playerInfo.dataScreen = "full";
      stateMgr?.set(PlayerStateKeyEnum.IS_FULLSCREEN, true);
    } else {
      playerContainerRef.value.setAttribute("data-screen", "normal");
      playerInfo.dataScreen = "normal";
      stateMgr?.set(PlayerStateKeyEnum.IS_FULLSCREEN, false);
    }
  };

  /**
   * 画中画状态变化时，更新画中画标志
   */
  const onPipChange = (): void => {
    playerInfo.isPip = document.pictureInPictureElement !== null;
    stateMgr?.set(PlayerStateKeyEnum.IS_PIP, playerInfo.isPip);
  };

  /**
   * 右键菜单处理，阻止默认菜单并触发自定义菜单事件
   * @param event - 鼠标事件
   */
  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    lifecycle.emit?.("contextMenu", { x: event.clientX, y: event.clientY });
  };

  /** 容器尺寸变化观察器，通知事件总线容器大小变化 */
  const resizeObserver = safeResizeObserver((entries) => {
    entries.forEach(() => {
      props.events?.emit(PlayerEventEnum.RESIZE, {
        width: playerDockerRef.value?.clientWidth ?? 0,
        height: playerDockerRef.value?.clientHeight ?? 0,
      });
    });
  });

  // ============================================
  // 迷你播放器 IntersectionObserver
  // ============================================

  /** 迷你播放器可见性观察器 */
  let miniPlayerObserver: IntersectionObserver | null = null;

  // ============================================
  // 事件绑定与解绑
  // ============================================

  /**
   * 初始化所有 DOM 事件监听
   * 在 onMounted 中调用
   */
  const initEvent = (): void => {
    const container = playerContainerRef.value;
    const videoArea = playerVideoAreaRef.value;
    const perch = playerVideoPerchRef.value;
    const docker = playerDockerRef.value;

    if (!container || !videoArea || !perch || !docker) return;

    // --- ResizeObserver 容器尺寸变化 ---
    resizeObserver?.observe(docker);

    // --- mouseleave on videoArea → 隐藏控制栏 ---
    const onMouseLeaveVideoArea = (): void => {
      hideControls();
    };
    videoArea.addEventListener("mouseleave", onMouseLeaveVideoArea);
    cleanupFns.push(() =>
      videoArea.removeEventListener("mouseleave", onMouseLeaveVideoArea),
    );

    // --- dblclick on perch → 切换全屏 ---
    const onDblClickPerch = (event: MouseEvent): void => {
      event.preventDefault();
      toggleFullscreen();
    };
    perch.addEventListener("dblclick", onDblClickPerch);
    cleanupFns.push(() =>
      perch.removeEventListener("dblclick", onDblClickPerch),
    );

    // --- mousemove on perch → 显示控制栏并重置自动隐藏 ---
    const onMouseMovePerch = (): void => {
      showControls();
    };
    videoArea.addEventListener("mousemove", onMouseMovePerch);
    cleanupFns.push(() =>
      videoArea.removeEventListener("mousemove", onMouseMovePerch),
    );

    // --- click on perch → 切换播放/暂停（400ms 延迟区分双击） ---
    /** 点击延迟定时器，用于区分单击和双击 */
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    const onClickPerch = (): void => {
      if (clickTimer !== null) {
        clearTimeout(clickTimer);
        clickTimer = null;
        return; // 双击的第二次点击，忽略
      }
      clickTimer = setTimeout(() => {
        togglePlayPause();
        clickTimer = null;
      }, 400);
    };
    perch.addEventListener("click", onClickPerch);
    cleanupFns.push(() => perch.removeEventListener("click", onClickPerch));

    // --- fullscreenchange 监听 ---
    document.addEventListener("fullscreenchange", onFullscreenChange);
    cleanupFns.push(() =>
      document.removeEventListener("fullscreenchange", onFullscreenChange),
    );

    // --- 画中画事件监听 ---
    document.addEventListener("enterpictureinpicture", onPipChange);
    cleanupFns.push(() =>
      document.removeEventListener("enterpictureinpicture", onPipChange),
    );
    document.addEventListener("leavepictureinpicture", onPipChange);
    cleanupFns.push(() =>
      document.removeEventListener("leavepictureinpicture", onPipChange),
    );

    // --- 键盘事件监听 ---
    document.addEventListener("keydown", onKeyboard);
    cleanupFns.push(() => document.removeEventListener("keydown", onKeyboard));

    // --- 右键菜单监听 ---
    container.addEventListener("contextmenu", onContextMenu);
    cleanupFns.push(() =>
      container.removeEventListener("contextmenu", onContextMenu),
    );

    // --- IntersectionObserver 迷你播放器 ---
    miniPlayerObserver = safeIntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            requestAnimationFrame(() => {
              // 播放器不可见 → 进入迷你播放器模式
              playerInfo.isMinPlayer = true;
              docker.classList.add("mode-mini");
              playerContainerRef.value?.setAttribute("data-screen", "mini");
            });
          } else {
            requestAnimationFrame(() => {
              // 播放器可见 → 退出迷你播放器模式
              playerInfo.isMinPlayer = false;
              docker.classList.remove("mode-mini");
              playerContainerRef.value?.setAttribute("data-screen", "normal");
            });
          }
        });
      },
      { threshold: 0.5 },
    );
    if (miniPlayerObserver) {
      miniPlayerObserver.observe(docker);
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    // 初始化视频
    initVideo();
    // 绑定所有 DOM 事件
    initEvent();

    // 触发挂载完成回调
    if (
      playerDockerRef.value &&
      playerVideoAreaRef.value &&
      playerVideoWrapRef.value &&
      videoRef.value &&
      playerSendingAreaRef.value
    ) {
      lifecycle.emit?.("mounted", {
        container: playerDockerRef.value,
        videoArea: playerVideoAreaRef.value,
        videoWrap: playerVideoWrapRef.value,
        video: videoRef.value,
        sendingArea: playerSendingAreaRef.value,
      });
    }

    // 触发播放器加载完成事件
    lifecycle.emit?.("playerLoaded");
  };

  lifecycle.onBeforeDestroy = (): void => {
    // 清理自动隐藏定时器
    if (autoHideTimer !== null) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }

    // 清理网页全屏状态
    if (isWebFullscreen && isBrowser()) {
      playerDockerRef.value?.classList.remove("mode-webscreen");
      document.body.classList.remove("webscreen-fix");
    }

    // 清理视频事件监听
    if (videoRef.value) {
      videoRef.value.removeEventListener(
        "loadedmetadata",
        handleLoadedMetadata,
      );
      videoRef.value.removeEventListener("timeupdate", handleTimeUpdate);
      videoRef.value.removeEventListener("progress", handleProgress);
      videoRef.value.removeEventListener("play", handlePlay);
      videoRef.value.removeEventListener("pause", handlePause);
      videoRef.value.removeEventListener("ended", handleEnded);
      videoRef.value.removeEventListener("waiting", handleWaiting);
      videoRef.value.removeEventListener("canplay", handleCanPlay);
    }

    // 清理所有 DOM 事件监听
    cleanupFns.forEach((fn) => fn());
    cleanupFns.length = 0;

    // 断开 ResizeObserver
    resizeObserver?.disconnect();

    // 断开 IntersectionObserver
    if (miniPlayerObserver) {
      miniPlayerObserver.disconnect();
      miniPlayerObserver = null;
    }
  };

  // ============================================
  // 渲染输出
  // ============================================

  /**
   * 渲染播放器主容器
   */
  return h(
    "div",
    {
      class: "player-docker player-docker-major",
      "data-injector": "nano",
      ref: 'playerDockerRef',
    },
    h(
      "div",
      {
        class:
          "player-container state-paused state-no-cursor state-disable-box-shadow",
        "data-angle": "d3d11",
        "data-screen": "normal",
        "data-ctrl-hidden": "false",
        "aria-label": props.playerName || "嗨哩播放器",
        ref: 'playerContainerRef',
      },
      h(
        "div",
        { class: "player-primary-area" },
        // 视频区域
        h(
          "div",
          {
            class: "player-video-area",
            ref: 'playerVideoAreaRef',
          },
          // 视频占位容器
          h(
            "div",
            {
              class: "player-video-perch",
              ref: 'playerVideoPerchRef',
            },
            // 视频包装容器
            h(
              "div",
              {
                class: "player-video-wrap",
                ref: 'playerVideoWrapRef',
              },
              h("video", {
                class: "player-video",
                crossorigin: "anonymous",
                preload: "auto",
                playsinline: "",
                ref: 'videoRef',
              }),
            ),
          ),
          // 视频海报
          h("div", {
            class: "player-video-poster",
            hidden: true,
          }),
          // 弹幕容器
          h(RowDm, {
            isOpen: true,
            onDanmakuLayerMounted: (data: DanmakuLayerAPI) => {
              rowDmApi.createDanmaku = data.createDanmaku;
              rowDmApi.playPause = data.playPause;
              rowDmApi.showDmTip = data.showDmTip;
              rowDmApi.hideDmTip = data.hideDmTip;
              lifecycle.emit?.("danmakuLayerMounted", data);
              // 弹幕层挂载完成，通知插件系统（不使用 DANMAKU_TOGGLE，那是切换弹幕可见性的事件）
            },
            onShowDmTip: (data: {
              event: MouseEvent;
              element: HTMLElement;
            }) => {
              lifecycle.emit?.("showDmTip", data);
              // Bridge to Dialog's showDmTip
              dialogApi.showDmTip?.(
                {
                  content: data.element?.textContent ?? "",
                  timePoint: videoInfo.currentTime,
                },
                data.element,
              );
            },
            onHideDmTip: (data: { element: HTMLElement }) => {
              lifecycle.emit?.("hideDmTip", data);
              // Bridge to Dialog's hideDmTip
              dialogApi.hideDmTip?.(data.element);
            },
          }),
          // 字幕容器
          h(SubtitleLayer, {
            visible: true,
            onSubtitleLayerMounted: (data: SubtitleLayerAPI) => {
              subtitleApi.subtitleWrap = data.subtitleWrap;
              subtitleApi.setFontSize = data.setFontSize;
              subtitleApi.setColor = data.setColor;
              subtitleApi.setBackgroundColor = data.setBackgroundColor;
              subtitleApi.setPosition = data.setPosition;
              lifecycle.emit?.("subtitleLayerMounted", data);
              // 字幕层挂载完成，通知插件系统（不使用 SUBTITLE_TOGGLE，那是切换字幕可见性的事件）
            },
          }),
          // 互动容器
          h(InteractionLayer, {
            showLines: false,
            onInteractionLayerMounted: (data: InteractionLayerAPI) => {
              interactionApi.container = data.container;
              lifecycle.emit?.("interactionLayerMounted", data);
              props.events?.emit("interactionLayerMounted", data);
            },
          }),
          // 对话框容器
          h(Dialog, {
            onDialogMounted: (data: DialogAPI) => {
              dialogApi.dialogWrap = data.dialogWrap;
              dialogApi.showDmTip = data.showDmTip;
              dialogApi.hideDmTip = data.hideDmTip;
              lifecycle.emit?.("dialogMounted", data);
            },
          }),
          // 视频控制栏
          h(Controls, {
            duration: videoInfo.duration,
            volume: playerInfo.volume,
            backrate: playerInfo.backrate,
          }),
        ),
        // 发送区域（弹幕输入等）
        h("div", {
          class: "player-sending-area",
          ref: 'playerSendingAreaRef',
        }),
      ),
    ),
  );
});

export default PlayerDocker;
