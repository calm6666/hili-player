/**
 * ============================================
 * 控制条组件类型定义
 * ============================================
 * 定义 Controls 组件所需的所有类型和接口
 */

import type { AnimationFrameID } from '@/utils/rafTimeout';

/**
 * 菜单显示状态项
 */
export interface CtrlShowMenuItem {
  showTimer: AnimationFrameID | null;
  hideTimer: AnimationFrameID | null;
}

/**
 * 菜单显示状态
 */
export interface CtrlShowMenu {
  viewpoint: CtrlShowMenuItem;
  quality: CtrlShowMenuItem;
  eplist: CtrlShowMenuItem;
  playbackrate: CtrlShowMenuItem;
  volume: CtrlShowMenuItem;
  setting: CtrlShowMenuItem;
}

/**
 * 音量进度状态
 */
export interface VolumeProgress {
  isDragging: boolean;
  startY: number;
}

/**
 * 弹出层状态
 */
export interface Popup {
  isActive: boolean;
  left: number;
  delay: AnimationFrameID | null;
  currentTime: number;
  prevTime: number;
}

/**
 * 提示按钮
 */
export interface Tooltip {
  element: HTMLElement | null;
  name: string;
  dataName: string;
}

/**
 * 控制配置
 */
export interface ControlConfig {
  progressViewPoints?: ProgressViewPoint[];
  prev?: boolean;
  next?: boolean;
  viewpoint?: boolean;
  quality?: boolean;
  eplist?: boolean;
  setting?: boolean;
  pip?: boolean;
  wide?: boolean;
  web?: boolean;
}

/**
 * 切换按钮
 */
export interface SwitchBtns {
  btn1?: unknown;
  btn2?: unknown;
  btn3?: unknown;
}

/**
 * 进度条视点
 */
export interface ProgressViewPoint {
  element?: HTMLDivElement;
  shadowElement?: HTMLDivElement;
  bufferElement?: HTMLDivElement;
  currentElement?: HTMLDivElement;
  shadowBufferElement?: HTMLDivElement;
  shadowCurrentElement?: HTMLDivElement;
  shadowTextElement?: HTMLDivElement;
  pointText: string;
  startTime: number;
  endTime: number;
}
