/**
 * ============================================
 * 控制条组件 (Controls)
 * ============================================
 * 使用 h 函数框架实现的播放器控制条组件
 * 保持与老播放器完全相同的 DOM 结构和类名
 * 所有 DOM 引用通过 ref 回调获取，不使用 querySelector
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';
import type {
  CtrlShowMenu,
  VolumeProgress,
  Popup,
  Tooltip,
  ControlConfig,
  ProgressViewPoint,
} from '@/hili-player/types';
import { formatTime } from '@/utils/formatTime';
import { rafTimeout, cancelRaf } from '@/utils/rafTimeout';
import type { AnimationFrameID } from '@/utils/rafTimeout';
import { ComponentEventEnum } from '@/core/events';
import { LeftControls } from './LeftControls';
import { RightControls } from './RightControls';
import { TopControls } from './TopControls';
import { PbpControls } from './PbpControls';


/**
 * 菜单类型
 */
type MenuType = 'viewpoint' | 'quality' | 'eplist' | 'playbackrate' | 'volume' | 'setting';

/**
 * 菜单元素配置
 */
interface MenuElement {
  element: HTMLDivElement | null;
  extraElements?: HTMLDivElement[];
}

/**
 * 菜单配置映射
 */
interface MenuConfig {
  viewpoint?: MenuElement;
  quality?: MenuElement;
  eplist?: MenuElement;
  playbackrate?: MenuElement;
  setting?: MenuElement;
  volume?: MenuElement;
  pip?: MenuElement;
  wide?: MenuElement;
  web?: MenuElement;
}

/**
 * 视频进度数据
 */
interface VideoPlayerProgress {
  bufferTime: number;
  currentTime: number;
}

/**
 * 进度条样式策略函数类型
 */
type ProgressStrategy = (vp: ProgressViewPoint, duration: number) => {
  left: string;
  width: string;
  marginRight?: string;
};

/**
 * Controls 组件 Props 接口
 */
export interface ControlsProps {
  /** 视频总时长 */
  duration: number;
  /** 初始音量 */
  volume: number;
  /** 初始播放倍速 */
  backrate: number;
  /** 控制条配置 */
  config: ControlConfig;
  /** 是否处于编辑模式 */
  isEdit: boolean;
  /** 播放/暂停回调 */
  onPlayPause?: () => void;
  /** 进度跳转回调 */
  onSeek?: (time: number) => void;
  /** 开始拖拽回调 */
  onSeekStart?: () => void;
  /** 结束拖拽回调 */
  onSeekEnd?: () => void;
  /** 音量变化回调 */
  onVolumeChange?: (volume: number) => void;
  /** 静音切换回调 */
  onMuteToggle?: () => void;
  /** 倍速变化回调 */
  onBackrateChange?: (backrate: number) => void;
  /** 全屏切换回调 */
  onFullscreenToggle?: () => void;
  /** 网页全屏切换回调 */
  onWebFullscreenToggle?: () => void;
  /** 画中画切换回调 */
  onPipToggle?: () => void;
  /** 显示提示回调 */
  onShowTooltip?: (tooltip: Tooltip) => void;
  /** 隐藏提示回调 */
  onHideTooltip?: (tooltip: Tooltip) => void;
  /** 上一集回调 */
  onPrev?: () => void;
  /** 下一集回调 */
  onNext?: () => void;
  /** 画质切换回调 */
  onQualityChange?: (quality: string) => void;
  /** 选集切换回调 */
  onEplistChange?: (cid: string) => void;
  /** 设置项变化回调 */
  onSettingChange?: (key: string, value: boolean) => void;
  /** 更多设置点击回调 */
  onMoreSettingClick?: () => void;
}

/**
 * 控制条组件
 * 使用 h 函数实现，保持与老播放器完全相同的 DOM 结构和类名
 */
export const Controls = defineComponent<ControlsProps>((props, lifecycle) => {
  // ============================================
  // 状态数据
  // ============================================

  /** 视频总时长 */
  let duration = props.duration;
  /** 当前音量 */
  let volume = props.volume;
  /** 当前播放倍速 */
  let backrate = props.backrate;
  /** 控制条配置（高性能深拷贝） */
  const config: ControlConfig = {
    ...props.config,
    progressViewPoints: props.config.progressViewPoints?.map((vp: ProgressViewPoint) => ({ ...vp })),
  };
  /** 是否处于编辑模式 */
  const isEdit = props.isEdit;

  /** 视频进度数据 */
  const videoProgress: VideoPlayerProgress = {
    bufferTime: 0,
    currentTime: 0,
  };

  /** 是否正在拖拽进度条 */
  let isDragging = false;
  /** 指示器位置 */
  let indicatorLeft = 0;
  /** 调整比例 */
  const ADJUSTMENT_RATIO = 0.0015;

  /** 预览图数据 */
  const videoshot: string[] = [];

  /** 弹出层状态 */
  const popup: Popup = {
    isActive: false,
    left: 0,
    delay: null,
    currentTime: 0,
    prevTime: 0,
  };

  /** 菜单显示状态 */
  const ctrlShowMenu: CtrlShowMenu = {
    viewpoint: { showTimer: null, hideTimer: null },
    quality: { showTimer: null, hideTimer: null },
    eplist: { showTimer: null, hideTimer: null },
    playbackrate: { showTimer: null, hideTimer: null },
    volume: { showTimer: null, hideTimer: null },
    setting: { showTimer: null, hideTimer: null },
  };

  /** 菜单配置 */
  const menuConfig: MenuConfig = {};

  /** 音量进度状态 */
  const volumeProgress: VolumeProgress = {
    isDragging: false,
    startY: 0,
  };

  /** 提示按钮数据 */
  const tooltipBtns: Tooltip[] = [
    { element: null, name: 'prev', dataName: 'ctrl:prev' },
    { element: null, name: 'next', dataName: 'ctrl:next' },
    { element: null, name: 'pip', dataName: 'ctrl:pip' },
    { element: null, name: 'wide', dataName: 'ctrl:widescreen' },
    { element: null, name: 'web', dataName: 'ctrl:webscreen' },
    { element: null, name: 'full', dataName: 'ctrl:fullscreen' },
  ];

  /** 定时器引用 */
  let inTimer: AnimationFrameID | null = null;

  // ============================================
  // DOM 元素引用（全部通过 ref 对象获取）
  // ============================================

  const controlEntityRef: { current: HTMLDivElement | null } = { current: null };
  const pbpRef: { current: HTMLDivElement | null } = { current: null };
  const playerProgressAreaRef: { current: HTMLDivElement | null } = { current: null };
  const playerProgressScheduleWrapRef: { current: HTMLDivElement | null } = { current: null };
  const playerShadowProgressScheduleWrapRef: { current: HTMLDivElement | null } = { current: null };
  const playerShadowProgressAreaRef: { current: HTMLDivElement | null } = { current: null };
  const progressThumbRef: { current: HTMLDivElement | null } = { current: null };
  const moveIndicatorRef: { current: HTMLDivElement | null } = { current: null };
  const playerCtrlTimeCurrentRef: { current: HTMLDivElement | null } = { current: null };
  const playerCtrlTimeDurationRef: { current: HTMLDivElement | null } = { current: null };
  const progressPopupRef: { current: HTMLDivElement | null } = { current: null };
  const previewTimeRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlVolumeBtnRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlBackrateBtnRef: { current: HTMLDivElement | null } = { current: null };
  const volumeNumberRef: { current: HTMLDivElement | null } = { current: null };
  const volumeSliderAreaRef: { current: HTMLDivElement | null } = { current: null };
  const volumeProgressbarRef: { current: HTMLDivElement | null } = { current: null };
  const volumeSliderThumbRef: { current: HTMLDivElement | null } = { current: null };
  const viewpointTextRef: { current: HTMLDivElement | null } = { current: null };
  const backrateResultTextRef: { current: HTMLDivElement | null } = { current: null };
  let backrateMenuItems: HTMLLIElement[] = [];



  // ============================================
  // 工具函数
  // ============================================

  const applyTransform = (element: HTMLDivElement | null | undefined, scale?: number, extraTransform = ''): void => {
    if (!element) return;
    const clampedScale = Math.min(Math.max(scale ?? 0, 0), 1);
    element.style.transform = `scaleX(${clampedScale}) ${extraTransform}`.trim();
  };

  const calculateTimeRange = (vp: ProgressViewPoint, index: number): [number, number] => {
    const adjustment = duration * ADJUSTMENT_RATIO;
    const totalPoints = config.progressViewPoints?.length || 0;
    let start = vp.startTime;
    let end = vp.endTime;
    if (totalPoints > 1) {
      if (index === 0) { end -= adjustment; }
      else if (index === totalPoints - 1) { start += adjustment; end = duration; }
      else { start += adjustment; end -= adjustment; }
    }
    return [start, end];
  };

  const calculateSegmentScale = (value: number, start: number, end: number): number => {
    if (value <= start) return 0;
    if (value >= end) return 1;
    return (value - start) / (end - start);
  };

  const strategies: Record<'first' | 'last' | 'default', ProgressStrategy> = {
    first: (vp, dur) => ({ left: '0%', width: `${((vp.endTime - vp.startTime) / dur) * 100 - 0.15}%`, marginRight: '0.3%' }),
    last: (vp, dur) => ({ left: `${(vp.startTime / dur) * 100 + 0.15}%`, width: `${((vp.endTime - vp.startTime) / dur) * 100 - 0.15}%` }),
    default: (vp, dur) => ({ left: `${(vp.startTime / dur) * 100 + 0.15}%`, width: `${((vp.endTime - vp.startTime) / dur) * 100 - 0.3}%`, marginRight: '0.3%' }),
  };

  const applyProgressStyle = (element: HTMLDivElement, shadowElement: HTMLDivElement, viewPoint: ProgressViewPoint, index: number, total: number, dur: number): void => {
    const strategy = index === 0 ? 'first' : index === total - 1 ? 'last' : 'default';
    const { left, width, marginRight } = strategies[strategy](viewPoint, dur);
    element.style.left = left;
    shadowElement.style.left = left;
    element.style.width = width;
    shadowElement.style.width = width;
    if (marginRight) { element.style.marginRight = marginRight; shadowElement.style.marginRight = marginRight; }
    else { element.style.removeProperty('margin-right'); shadowElement.style.removeProperty('margin-right'); }
  };

  // ============================================
  // 进度条元素创建
  // ============================================

  const createBaseElement = (hasSegments: boolean): HTMLDivElement => {
    const element = document.createElement('div');
    element.classList.add('player-progress-schedule', ...(hasSegments ? ['player-progress-schedule-segment'] : []));
    return element;
  };

  const createBufferElement = (): HTMLDivElement => {
    const buffer = document.createElement('div');
    buffer.classList.add('player-progress-schedule-buffer');
    buffer.style.transform = 'scaleX(0)';
    return buffer;
  };

  const createCurrentElement = (): HTMLDivElement => {
    const current = document.createElement('div');
    current.classList.add('player-progress-schedule-current');
    current.style.transform = 'scaleX(0)';
    return current;
  };

  const createScheduleTextElement = (): HTMLDivElement => {
    const text = document.createElement('div');
    text.classList.add('player-progress-schedule-text');
    return text;
  };

  const assignElementsToViewPoint = (bufferElement: HTMLDivElement, currentElement: HTMLDivElement, textElement: HTMLDivElement | undefined, index = 0, isNew = false, viewPoint?: ProgressViewPoint): void => {
    // 确保 progressViewPoints 存在且有元素
    if (!config.progressViewPoints || config.progressViewPoints.length === 0) {
      return;
    }
    if (textElement) {
      if (isNew && viewPoint !== undefined) {
        viewPoint.shadowBufferElement = bufferElement;
        viewPoint.shadowCurrentElement = currentElement;
        viewPoint.shadowTextElement = textElement;
        return;
      }
      if (config.progressViewPoints.length > 1 && index < config.progressViewPoints.length) {
        config.progressViewPoints[index].shadowBufferElement = bufferElement;
        config.progressViewPoints[index].shadowCurrentElement = currentElement;
        config.progressViewPoints[index].shadowTextElement = textElement;
      } else if (config.progressViewPoints.length > 0) {
        config.progressViewPoints[0].shadowBufferElement = bufferElement;
        config.progressViewPoints[0].shadowCurrentElement = currentElement;
        config.progressViewPoints[0].shadowTextElement = textElement;
      }
    } else {
      if (isNew && viewPoint !== undefined) {
        viewPoint.bufferElement = bufferElement;
        viewPoint.currentElement = currentElement;
        return;
      }
      if (config.progressViewPoints.length > 1 && index < config.progressViewPoints.length) {
        config.progressViewPoints[index].bufferElement = bufferElement;
        config.progressViewPoints[index].currentElement = currentElement;
      } else if (config.progressViewPoints.length > 0) {
        config.progressViewPoints[0].bufferElement = bufferElement;
        config.progressViewPoints[0].currentElement = currentElement;
      }
    }
  };

  const createProgressElement = (hasSegments: boolean, index?: number, isNew = false, viewPoint?: ProgressViewPoint): HTMLDivElement => {
    const progress = createBaseElement(hasSegments);
    const bufferElement = createBufferElement();
    const currentElement = createCurrentElement();
    assignElementsToViewPoint(bufferElement, currentElement, undefined, index, isNew, viewPoint);
    [bufferElement, currentElement].forEach((child) => { progress.appendChild(child); });
    return progress;
  };

  const createViewPointElement = (hasSegments: boolean, index?: number, viewPoint?: ProgressViewPoint, isNew = false): HTMLDivElement => {
    const shadowProgress = createBaseElement(hasSegments);
    const bufferElement = createBufferElement();
    const currentElement = createCurrentElement();
    const progressTextElement = createScheduleTextElement();
    if (isEdit && config.progressViewPoints && config.progressViewPoints.length > 1 && viewPoint) {
      progressTextElement.innerHTML = viewPoint.pointText;
    }
    assignElementsToViewPoint(bufferElement, currentElement, progressTextElement, index, isNew, viewPoint);
    [bufferElement, currentElement, progressTextElement].forEach((child) => { shadowProgress.appendChild(child); });
    return shadowProgress;
  };

  const createAndAppend = (hasMultipleSegments: boolean, viewPoint?: ProgressViewPoint, index?: number): void => {
    // 确保 progressViewPoints 存在且有元素
    if (!config.progressViewPoints || config.progressViewPoints.length === 0) {
      return;
    }
    const progress = createProgressElement(hasMultipleSegments, index!);
    const shadowProgress = createViewPointElement(hasMultipleSegments, index!, viewPoint);
    if (viewPoint && typeof index === 'number' && index !== undefined) {
      applyProgressStyle(progress, shadowProgress, viewPoint, index, config.progressViewPoints.length, duration);
      progress.onmouseenter = (event: MouseEvent): void => { progressPointMove(progress, event); };
      progress.onmouseleave = (event: MouseEvent): void => { progressPointLeave(progress, event); };
    }
    if (config.progressViewPoints.length > 1 && index !== undefined && index < config.progressViewPoints.length) {
      config.progressViewPoints[index].element = progress;
      config.progressViewPoints[index].shadowElement = shadowProgress;
    } else if (config.progressViewPoints.length > 0) {
      config.progressViewPoints[0].element = progress;
      config.progressViewPoints[0].shadowElement = shadowProgress;
    }
    playerProgressScheduleWrapRef.current?.appendChild(progress);
    playerShadowProgressScheduleWrapRef.current?.appendChild(shadowProgress);
  };

  const progressPointMove = (element: HTMLDivElement, event: MouseEvent): void => {
    event.preventDefault();
    element.classList.add('hover');
  };

  const progressPointLeave = (element: HTMLDivElement, event: MouseEvent): void => {
    event.preventDefault();
    element.classList.remove('hover');
  };

  const setupProgressElements = (): void => {
    // 如果没有进度视点数据，直接返回
    if (!config.progressViewPoints || config.progressViewPoints.length === 0) {
      return;
    }
    const hasMultipleSegments = config.progressViewPoints.length > 1;
    if (hasMultipleSegments) {
      config.progressViewPoints.forEach((viewPoint: ProgressViewPoint, index: number) => { createAndAppend(hasMultipleSegments, viewPoint, index); });
      if (isEdit) { playerShadowProgressAreaRef.current?.classList.add('permanent'); }
    } else {
      createAndAppend(hasMultipleSegments);
    }
  };

  // ============================================
  // 事件处理函数
  // ============================================

  const togglePlayPause = (): void => { lifecycle.emit?.(ComponentEventEnum.PLAY_CLICK); props.onPlayPause?.(); };
  const handlePrev = (): void => { lifecycle.emit?.(ComponentEventEnum.PREV_CLICK); props.onPrev?.(); };
  const handleNext = (): void => { lifecycle.emit?.(ComponentEventEnum.NEXT_CLICK); props.onNext?.(); };
  const toggleFullscreen = (): void => { lifecycle.emit?.(ComponentEventEnum.FULLSCREEN_CLICK); props.onFullscreenToggle?.(); };
  const toggleWebFullscreen = (): void => { lifecycle.emit?.(ComponentEventEnum.FULLSCREEN_CLICK); props.onWebFullscreenToggle?.(); };
  const togglePip = (): void => { lifecycle.emit?.(ComponentEventEnum.PIP_CLICK); props.onPipToggle?.(); };
  const toggleWide = (): void => { lifecycle.emit?.(ComponentEventEnum.FULLSCREEN_CLICK); };
  const toggleMute = (): void => { lifecycle.emit?.(ComponentEventEnum.VOLUME_CHANGE); props.onMuteToggle?.(); };

  const mouseMove = (event: MouseEvent): void => {
    event.preventDefault();
    if (playerProgressAreaRef.current) {
      const containerRect = playerProgressAreaRef.current.getBoundingClientRect();
      indicatorLeft = Math.min(Math.max(0, event.clientX - containerRect.left + 1), containerRect.width);
      if (moveIndicatorRef.current) { moveIndicatorRef.current.style.transform = `translateX(${indicatorLeft}px)`; }
      popup.currentTime = (indicatorLeft / containerRect.width) * duration;
      if (previewTimeRef.current) { previewTimeRef.current.innerHTML = formatTime(popup.currentTime); }
      if (indicatorLeft <= 80) { popup.left = 0; }
      else if (indicatorLeft >= containerRect.width - 80) { popup.left = containerRect.width - 160; }
      else { popup.left = indicatorLeft - 80; }
      if (progressPopupRef.current) { progressPopupRef.current.style.left = `${popup.left}px`; }
    }
  };

  const handleMouseDown = (event: MouseEvent): void => {
    if (!playerProgressAreaRef.current) return;
    isDragging = true;
    const containerRect = playerProgressAreaRef.current.getBoundingClientRect();
    const offsetX = event.clientX - containerRect.left;
    const currentTime = Math.min(Math.max(0.00001, offsetX / containerRect.width), 0.99999) * duration;
    updateCurrent(currentTime);
    lifecycle.emit?.(ComponentEventEnum.PROGRESS_CHANGE, currentTime);
    props.onSeek?.(currentTime);
    lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, 'seekStart');
    props.onSeekStart?.();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    playerProgressAreaRef.current.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleMouseMove = (event: MouseEvent): void => {
    if (!isDragging || !playerProgressAreaRef.current) return;
    const containerRect = playerProgressAreaRef.current.getBoundingClientRect();
    const offsetX = event.clientX - containerRect.left;
    const currentTime = Math.min(Math.max(0.00001, offsetX / containerRect.width), 0.99999) * duration;
    updateCurrent(currentTime);
    lifecycle.emit?.(ComponentEventEnum.PROGRESS_CHANGE, currentTime);
    props.onSeek?.(currentTime);
  };

  const handleTouchMove = (event: TouchEvent): void => {
    if (!isDragging || !playerProgressAreaRef.current) return;
    event.preventDefault();
    const offsetX = event.touches[0].clientX - playerProgressAreaRef.current.getBoundingClientRect().left;
    const currentTime = Math.min(Math.max(0.00001, offsetX / playerProgressAreaRef.current.getBoundingClientRect().width), 0.99999) * duration;
    updateCurrent(currentTime);
    lifecycle.emit?.(ComponentEventEnum.PROGRESS_CHANGE, currentTime);
    props.onSeek?.(currentTime);
  };

  const handleMouseUp = (): void => {
    isDragging = false;
    removeMouseMoveListeners();
    lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, 'seekEnd');
    props.onSeekEnd?.();
  };

  const handleTouchEnd = (): void => {
    isDragging = false;
    removeMouseMoveListeners();
    lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, 'seekEnd');
    props.onSeekEnd?.();
  };

  const removeMouseMoveListeners = (): void => {
    if (!playerProgressAreaRef.current) return;
    playerProgressAreaRef.current.removeEventListener('mousemove', handleMouseMove);
    playerProgressAreaRef.current.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  const handleMenuAnimation = (type: MenuType, action: 'show' | 'hide'): void => {
    const menuCfg = menuConfig[type];
    // 如果菜单配置不存在，直接返回
    if (!menuCfg) {
      return;
    }
    const control = ctrlShowMenu[type];
    cancelRaf(control.showTimer!);
    cancelRaf(control.hideTimer!);
    const timerType = action === 'show' ? 'showTimer' : 'hideTimer';
    control[timerType] = rafTimeout(() => {
      menuCfg.element?.classList.toggle('state-show', action === 'show');
      if (type === 'setting') {
        menuCfg.extraElements?.forEach((el, index) => {
          const classes = ['state-show-right', 'player-ctrl-seting-more-area'];
          el?.classList.remove(classes[index]);
        });
      }
    }, 300);
  };

  const volumeMouseDown = (event: MouseEvent): void => {
    if (!volumeSliderAreaRef.current) return;
    const offsetY = volumeSliderAreaRef.current.getBoundingClientRect().bottom - event.clientY;
    const currPer = offsetY / 60;
    const clampedVolume = Math.max(0, Math.min(1, currPer));
    updateVolumeDisplay(clampedVolume);
    lifecycle.emit?.(ComponentEventEnum.VOLUME_CHANGE, clampedVolume);
    props.onVolumeChange?.(clampedVolume);
  };

  const handlVolumeMouseDown = (event: MouseEvent): void => {
    if (!volumeSliderAreaRef.current) return;
    volumeProgress.isDragging = true;
    volumeProgress.startY = event.clientY;
    addVolumeMouseMoveListeners();
  };

  const handleVolumeMouseMove = (event: MouseEvent): void => {
    if (!volumeProgress.isDragging) return;
    const offsetY = volumeProgress.startY - event.clientY;
    const currPer = offsetY / 60;
    const clampedVolume = Math.max(0, Math.min(1, volume + currPer));
    updateVolumeDisplay(clampedVolume);
    lifecycle.emit?.(ComponentEventEnum.VOLUME_CHANGE, clampedVolume);
    props.onVolumeChange?.(clampedVolume);
    volumeProgress.startY = event.clientY;
  };

  const handlVolumeMouseUp = (): void => {
    volumeProgress.isDragging = false;
    removeVolumeMouseMoveListeners();
  };

  const addVolumeMouseMoveListeners = (): void => {
    document.addEventListener('mousemove', handleVolumeMouseMove);
    document.addEventListener('mouseup', handlVolumeMouseUp);
  };

  const removeVolumeMouseMoveListeners = (): void => {
    document.removeEventListener('mousemove', handleVolumeMouseMove);
    document.removeEventListener('mouseup', handlVolumeMouseUp);
  };

  const changeBackrate = (newBackrate: number, element: HTMLElement): void => {
    if (backrate === newBackrate) return;
    backrateMenuItems.forEach((item) => { item.classList.remove('player-state-active'); });
    element.classList.add('player-state-active');
    ctrlBackrateBtnRef.current?.classList.remove('state-show');
    backrate = newBackrate;
    if (backrateResultTextRef.current) {
      if (backrate === 1) { backrateResultTextRef.current.innerHTML = '倍速'; }
      else if (backrate === 2) { backrateResultTextRef.current.innerHTML = `${backrate}.0X`; }
      else { backrateResultTextRef.current.innerHTML = `${backrate}X`; }
    }
    lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, { backrate });
    props.onBackrateChange?.(backrate);
  };

  const initBackrate = (): void => {
    backrateMenuItems.forEach((item) => {
      if (item.getAttribute('data-value') === backrate.toString()) { item.classList.add('player-state-active'); }
    });
  };

  const initTooltip = (): void => {
    tooltipBtns.forEach((btn) => {
      btn.element?.addEventListener('mouseenter', () => {
        cancelRaf(inTimer!);
        inTimer = rafTimeout(() => {
          lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, { tooltip: btn, action: 'show' });
          props.onShowTooltip?.(btn);
        }, 300);
      });
      btn.element?.addEventListener('mouseleave', () => {
        cancelRaf(inTimer!);
        lifecycle.emit?.(ComponentEventEnum.STATE_CHANGE, { tooltip: btn, action: 'hide' });
        props.onHideTooltip?.(btn);
      });
    });
  };

  // ============================================
  // 更新函数
  // ============================================

  const updateBuffer = (buffer: number): void => {
    videoProgress.bufferTime = buffer;
    updateSegmentedBuffer(buffer);
  };

  const updateCurrent = (current: number): void => {
    videoProgress.currentTime = current;
    updateMainProgress(current);
    updateThumbPosition(current);
    updateSegmentedProgress(current);
  };

  const updateMainProgress = (current: number): void => {
    if (!playerCtrlTimeCurrentRef.current) return;
    playerCtrlTimeCurrentRef.current.textContent = formatTime(current);
  };

  const updateThumbPosition = (current: number): void => {
    if (!progressThumbRef.current || !playerProgressAreaRef.current) return;
    const position = (current / duration) * playerProgressAreaRef.current.clientWidth - 10;
    applyTransform(progressThumbRef.current, 1, `translateX(${position}px)`);
  };

  const updateSegmentedProgress = (current: number): void => {
    const points = config.progressViewPoints;
    if (!points?.length) return;
    if (points.length > 1) {
      points.forEach((vp: ProgressViewPoint, index: number) => {
        const [start, end] = calculateTimeRange(vp, index);
        const scale = calculateSegmentScale(current, start, end);
        applyTransform(vp.currentElement, scale);
        applyTransform(vp.shadowCurrentElement, scale);
        if (vp.startTime <= current && current < vp.endTime) {
          if (viewpointTextRef.current && viewpointTextRef.current.innerText !== '章节 · ' + vp.pointText) {
            viewpointTextRef.current.innerHTML = '章节 · ' + vp.pointText;
          }
        }
      });
    } else {
      points.forEach((vp: ProgressViewPoint) => {
        applyTransform(vp.currentElement, current / duration);
        applyTransform(vp.shadowCurrentElement, current / duration);
      });
    }
  };

  const updateSegmentedBuffer = (buffer: number): void => {
    const points = config.progressViewPoints;
    if (!points?.length) return;
    if (points.length > 1) {
      points.forEach((vp: ProgressViewPoint, index: number) => {
        const [start, end] = calculateTimeRange(vp, index);
        const scale = calculateSegmentScale(buffer, start, end);
        applyTransform(vp.bufferElement, scale);
        applyTransform(vp.shadowBufferElement, scale);
      });
    } else {
      points.forEach((vp: ProgressViewPoint) => {
        applyTransform(vp.bufferElement, buffer / duration);
        applyTransform(vp.shadowBufferElement, buffer / duration);
      });
    }
  };

  const updateVolumeDisplay = (newVolume: number): void => {
    if (volume <= 0 && newVolume > 0) { ctrlVolumeBtnRef.current?.classList.remove('state-muted'); }
    else if (volume > 0 && newVolume <= 0) { ctrlVolumeBtnRef.current?.classList.add('state-muted'); }
    volume = newVolume;
    if (volumeNumberRef.current && volumeProgressbarRef.current && volumeSliderThumbRef.current) {
      volumeNumberRef.current.innerHTML = Math.floor(volume * 100).toString();
      volumeProgressbarRef.current.style.transform = `scaleY(${volume})`;
      volumeSliderThumbRef.current.style.transform = `translateY(${-(60 * volume - 6)}px)`;
    }
  };

  const updateMute = (isMuted: boolean): void => {
    if (isMuted) { ctrlVolumeBtnRef.current?.classList.add('state-muted'); }
    else { ctrlVolumeBtnRef.current?.classList.remove('state-muted'); }
  };

  const showControl = (): void => {
    controlEntityRef.current?.setAttribute('data-shadow-show', 'false');
    pbpRef.current?.classList.add('show');
  };

  const hideControl = (): void => {
    controlEntityRef.current?.setAttribute('data-shadow-show', 'true');
    pbpRef.current?.classList.remove('show');
  };

  const initDuration = (): void => {
    if (playerCtrlTimeDurationRef.current) { playerCtrlTimeDurationRef.current.innerHTML = formatTime(duration); }
  };

  // ============================================
  // 渲染辅助函数
  // ============================================

  const renderBackrateItem = (value: string, label: string): VNode => {
    return h('li', {
      class: 'player-ctrl-playbackrate-menu-item',
      'data-value': value,
      ref: (el: HTMLElement) => { if (el instanceof HTMLLIElement) backrateMenuItems.push(el); },
      onClick: (event: MouseEvent) => {
        if (event.currentTarget instanceof HTMLElement) {
          changeBackrate(Number(value), event.currentTarget);
        }
      },
    }, label);
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    initDuration();
    setupProgressElements();
    initBackrate();
    initTooltip();
  };

  // ============================================
  // 子组件事件处理函数
  // ============================================

  const handleLeftControlsEvent = (event: string, ...args: any[]): void => {
    switch (event) {
      case 'prev':
        props.onPrev?.();
        break;
      case 'next':
        props.onNext?.();
        break;
      case 'playPause':
        props.onPlayPause?.();
        break;
      case 'seek':
        props.onSeek?.(args[0]);
        break;
      case 'menuAnimation':
        if (args[0] && args[1]) {
          handleMenuAnimation(args[0], args[1]);
        }
        break;
    }
  };

  const handleRightControlsEvent = (event: string, ...args: any[]): void => {
    switch (event) {
      case 'fullscreen':
        props.onFullscreenToggle?.();
        break;
      case 'webFullscreen':
        props.onWebFullscreenToggle?.();
        break;
      case 'pip':
        props.onPipToggle?.();
        break;
      case 'wide':
        // wide 处理
        break;
      case 'mute':
        props.onMuteToggle?.();
        break;
      case 'backrateChange':
        props.onBackrateChange?.(args[0]);
        break;
      case 'volumeMouseDown':
        if (args[0] instanceof MouseEvent) volumeMouseDown(args[0]);
        break;
      case 'handlVolumeMouseDown':
        if (args[0] instanceof MouseEvent) handlVolumeMouseDown(args[0]);
        break;
      case 'menuAnimation':
        if (args[0] && args[1]) {
          handleMenuAnimation(args[0], args[1]);
        }
        break;
      case 'moreSettingClick':
        props.onMoreSettingClick?.();
        break;
    }
  };

  const handleTopControlsEvent = (event: string, ...args: any[]): void => {
    switch (event) {
      case 'progressMouseMove':
        if (args[0] instanceof MouseEvent) mouseMove(args[0]);
        break;
      case 'progressMouseDown':
        if (args[0] instanceof MouseEvent) handleMouseDown(args[0]);
        break;
    }
  };

  const handlePbpControlsEvent = (event: string): void => {
    switch (event) {
      case 'pbpClick':
        // pbp 点击处理
        break;
      case 'pbpPinClick':
        // pbp pin 点击处理
        break;
    }
  };

  // ============================================
  // 主渲染函数
  // ============================================

  return h('div', { class: 'player-control-wrap' },
    h('div', { class: 'player-control-mask' }),
    h('div', { class: 'player-control-entity', 'data-shadow-show': 'false', ref: controlEntityRef },
      h(TopControls, {
        onProgressMouseMove: (e: MouseEvent) => handleTopControlsEvent('progressMouseMove', e),
        onProgressMouseDown: (e: MouseEvent) => handleTopControlsEvent('progressMouseDown', e)
      }),
      h('div', { class: 'player-control-bottom' },
        h(LeftControls, {
          config,
          duration,
          onPrev: () => handleLeftControlsEvent('prev'),
          onNext: () => handleLeftControlsEvent('next'),
          onPlayPause: () => handleLeftControlsEvent('playPause'),
          onSeek: (time: number) => handleLeftControlsEvent('seek', time),
          onMenuAnimation: (type: string, action: string) => handleLeftControlsEvent('menuAnimation', type, action)
        }),
        h('div', { class: 'player-control-bottom-center' }),
        h(RightControls, {
          config,
          onFullscreen: () => handleRightControlsEvent('fullscreen'),
          onWebFullscreen: () => handleRightControlsEvent('webFullscreen'),
          onPip: () => handleRightControlsEvent('pip'),
          onWide: () => handleRightControlsEvent('wide'),
          onMute: () => handleRightControlsEvent('mute'),
          onBackrateChange: (rate: number) => handleRightControlsEvent('backrateChange', rate),
          onVolumeMouseDown: (e: MouseEvent) => handleRightControlsEvent('volumeMouseDown', e),
          onHandlVolumeMouseDown: (e: MouseEvent) => handleRightControlsEvent('handlVolumeMouseDown', e),
          onMenuAnimation: (type: string, action: string) => handleRightControlsEvent('menuAnimation', type, action),
          onMoreSettingClick: () => handleRightControlsEvent('moreSettingClick')
        })
      ),
      h('div', { class: 'player-shadow-progress-area', ref: playerShadowProgressAreaRef },
        h('div', { class: 'player-shadow-progress-schedule-wrap', ref: playerShadowProgressScheduleWrapRef })
      ),
      h(PbpControls, {
        onPbpClick: () => handlePbpControlsEvent('pbpClick'),
        onPbpPinClick: () => handlePbpControlsEvent('pbpPinClick')
      })
    )
  );
});
