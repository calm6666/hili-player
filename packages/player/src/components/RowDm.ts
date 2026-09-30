/**
 * ============================================
 * 弹幕容器组件 (RowDm)
 * ============================================
 * 弹幕逻辑使用 src/utils/danmaku 中的 DanmakuManager
 */

import { defineComponent, h, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';

// ============================================
// 弹幕类型定义
// ============================================

/** 弹幕显示模式类型：滚动、顶部固定、底部固定 */
export type DanmakuMode = 'scroll' | 'top' | 'bottom';

/** 单条弹幕数据项 */
export interface DanmakuItem {
  /** 弹幕文本内容 */
  content: string;
  /** 弹幕出现的时间点（秒） */
  timePoint: number;
  /** 弹幕显示模式 */
  mode: DanmakuMode;
  /** 弹幕移动速度标识，对应 SPEED_MAP 中的键名 */
  speed: string;
  /** 弹幕字体大小（像素），默认 25 */
  fontSize?: number;
  /** 弹幕文字颜色，CSS 颜色值，默认白色 */
  color?: string;
  /** 弹幕字重，默认 400，700 及以上标记为 UP 主弹幕 */
  fontWeight?: number;
  /** 弹幕透明度，范围 0-1，默认 1 */
  opacity?: number;
  /** 弹幕文字阴影，CSS 值，默认 none */
  textShadow?: string;
}

/** 弹幕运行时信息，包含弹幕列表和各轨道占用状态 */
export interface DanmakuInfo {
  /** 当前弹幕数据列表 */
  danmakuList: DanmakuItem[];
  /** 上一次处理到的时间点，用于增量筛选新弹幕 */
  lastTimePoint: number;
  /** 滚动弹幕轨道占用时间数组，每个元素表示该轨道可被重新占用的最早时间 */
  rollRow: number[];
  /** 顶部固定弹幕轨道占用时间数组 */
  topRow: number[];
  /** 底部固定弹幕轨道占用时间数组 */
  bottomRow: number[];
}

/** 弹幕提示信息，用于弹幕悬停时显示详情 */
export interface DmTip {
  /** 触发提示的弹幕 DOM 元素 */
  element: HTMLElement;
  /** 弹幕数据 */
  danmaku: DanmakuItem;
  /** 弹幕在容器中的位置坐标 */
  position: { x: number; y: number };
}

// ============================================
// 组件属性接口
// ============================================

/** 弹幕容器组件属性接口 */
export interface RowDmProps {
  /** 是否开启弹幕显示 */
  isOpen?: boolean;
  /** 弹幕数据列表 */
  danmakuList?: DanmakuItem[];
  /** 弹幕底部偏移量（像素），用于避免弹幕遮挡底部控件 */
  dmBottom?: number;
}

// ============================================
// 速度映射
// ============================================

/** 弹幕速度标识到像素速度的映射表 */
const SPEED_MAP: Record<string, number> = {
  /** 极慢速度，50px/s */
  verySlow: 50,
  /** 慢速，60px/s */
  slow: 60,
  /** 中等速度，75px/s */
  moderate: 75,
  /** 快速，90px/s */
  fast: 90,
  /** 极快速度，100px/s */
  veryFast: 100,
};

/** 弹幕轨道总数量 */
const TRACK_COUNT = 12;

/** 固定弹幕（顶部/底部）的持续显示时间（秒） */
const FIXED_DURATION = 5;

// ============================================
// 弹幕容器组件
// ============================================

/**
 * 弹幕容器组件
 * 负责弹幕的渲染、轨道分配和动画控制
 */
export const RowDm = defineComponent<RowDmProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================

  /** 弹幕外层容器 DOM 引用，控制整体暂停状态 */
  const playerRowDmWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerRowDmWrapRef');

  /** 高级弹幕容器 DOM 引用，用于放置特殊效果弹幕 */
  const playerAdvDmWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerAdvDmWrapRef');

  /** 基础弹幕容器 DOM 引用，用于放置普通滚动和固定弹幕 */
  const playerBasDmWrapRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerBasDmWrapRef');

  /** 旋转弹幕容器 DOM 引用，用于放置旋转特效弹幕 */
  const danmakuXRotateRef = useTemplateRef<HTMLDivElement>(lifecycle, 'danmakuXRotateRef');

  // ============================================
  // 弹幕状态
  // ============================================

  /** 弹幕运行时信息，包含弹幕列表和各轨道的占用状态 */
  const danmakuInfo: DanmakuInfo = {
    danmakuList: props.danmakuList ?? [],
    lastTimePoint: 0,
    rollRow: new Array<number>(TRACK_COUNT).fill(-1),
    topRow: new Array<number>(TRACK_COUNT).fill(-1),
    bottomRow: new Array<number>(TRACK_COUNT).fill(-1),
  };

  /** 弹幕底部偏移量，避免弹幕遮挡底部控件区域 */
  const dmBottom: number = props.dmBottom ?? 90;

  // ============================================
  // 弹幕创建逻辑
  // ============================================

  /**
   * 获取指定时间点范围内的弹幕
   * 筛选 lastTimePoint < timePoint <= currTimePoint 的弹幕，实现增量加载
   * @param currTimePoint - 当前播放时间点（秒）
   * @returns 当前时间范围内需要显示的弹幕列表
   */
  const getTimePointDm = (currTimePoint: number): DanmakuItem[] => {
    return danmakuInfo.danmakuList.filter(
      (dm: DanmakuItem) =>
        dm.timePoint > danmakuInfo.lastTimePoint && dm.timePoint <= currTimePoint
    );
  };

  /**
   * 查找可用轨道位置
   * @param trackArray - 轨道占用时间数组
   * @param currTimePoint - 当前时间点
   * @returns 可用轨道索引，-1 表示所有轨道均被占用
   */
  const findAvailablePosition = (trackArray: number[], currTimePoint: number): number => {
    for (let i = 0; i < trackArray.length; i++) {
      if (trackArray[i] <= currTimePoint) {
        return i;
      }
    }
    return -1;
  };

  /**
   * 创建弹幕 DOM 元素并设置样式
   * @param danmaku - 弹幕数据
   * @returns 设置好样式的弹幕 DOM 元素
   */
  const createDanmuElement = (danmaku: DanmakuItem): HTMLDivElement => {
    /** 弹幕 DOM 元素 */
    const element = document.createElement('div');
    element.className = 'danmaku-x-dm danmaku-x-show';
    element.textContent = danmaku.content;

    /** 弹幕透明度，默认 1 */
    const opacity = danmaku.opacity ?? 1;
    /** 弹幕字体大小（px），默认 25 */
    const fontSize = danmaku.fontSize ?? 25;
    /** 弹幕字重，默认 400 */
    const fontWeight = danmaku.fontWeight ?? 400;
    /** 弹幕文字阴影，默认 none */
    const textShadow = danmaku.textShadow ?? 'none';
    /** 弹幕文字颜色，默认白色 */
    const color = danmaku.color ?? '#FFFFFF';

    element.style.setProperty('--opacity', String(opacity));
    element.style.setProperty('--fontSize', `${fontSize}px`);
    element.style.setProperty('--fontWeight', String(fontWeight));
    element.style.setProperty('--textShadow', textShadow);
    element.style.setProperty('--color', color);

    return element;
  };

  /**
   * 处理滚动弹幕的轨道分配和动画设置
   * 添加 .danmaku-x-roll 类，通过 CSS 变量控制滚动动画的起始位置、距离和时长
   * @param element - 弹幕 DOM 元素
   * @param currTimePoint - 当前时间点
   * @param speed - 弹幕移动速度（像素/秒）
   */
  const handleScrollDanmu = (element: HTMLDivElement, currTimePoint: number, speed: number): void => {
    /** 滚动弹幕分配到的轨道索引 */
    const trackIndex = findAvailablePosition(danmakuInfo.rollRow, currTimePoint);
    if (trackIndex === -1) return;

    element.classList.add('danmaku-x-roll');

    /** 弹幕容器的宽度（像素） */
    const containerWidth = playerRowDmWrapRef.value?.offsetWidth ?? 800;
    /** 弹幕元素自身的宽度（像素） */
    const elementWidth = element.offsetWidth || 200;
    /** 弹幕起始偏移量，从容器右侧开始 */
    const offset = containerWidth;
    /** 弹幕需要横向移动的总距离（负值，表示向左移动） */
    const translateX = -(elementWidth + offset);
    /** 弹幕滚动动画的持续时间（秒） */
    const duration = (containerWidth + elementWidth) / speed;
    /** 弹幕垂直方向的位置（像素），由轨道索引和底部偏移量计算 */
    const top = trackIndex * 40 + dmBottom;

    element.style.setProperty('--offset', `${offset}px`);
    element.style.setProperty('--translateX', `${translateX}px`);
    element.style.setProperty('--duration', `${duration}s`);
    element.style.setProperty('--top', `${top}px`);

    // 占用轨道：当前时间 + 持续时间
    danmakuInfo.rollRow[trackIndex] = currTimePoint + duration;

    // 动画结束后移除元素
    element.addEventListener('animationend', () => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  };

  /**
   * 处理固定弹幕（顶部/底部）的轨道分配和动画设置
   * 添加 .danmaku-x-center 类，通过 CSS 变量控制垂直位置和显示时长
   * @param danmaku - 弹幕数据
   * @param element - 弹幕 DOM 元素
   * @param currTimePoint - 当前时间点
   * @param trackArray - 轨道占用时间数组（topRow 或 bottomRow）
   */
  const handleFixedDanmu = (
    danmaku: DanmakuItem,
    element: HTMLDivElement,
    currTimePoint: number,
    trackArray: number[]
  ): void => {
    /** 固定弹幕分配到的轨道索引 */
    const trackIndex = findAvailablePosition(trackArray, currTimePoint);
    if (trackIndex === -1) {
      // 轨道溢出时标记为高优先级弹幕
      element.classList.add('danmaku-x-high');
      return;
    }

    element.classList.add('danmaku-x-center');

    // UP主弹幕样式（粗体弹幕标记为UP主弹幕）
    if (danmaku.fontWeight && danmaku.fontWeight >= 700) {
      element.classList.add('danmaku-x-up');
    }

    /** 弹幕垂直方向的位置（像素），由轨道索引和底部偏移量计算 */
    const translateY = trackIndex * 40 + dmBottom;
    /** 固定弹幕的显示持续时间（秒） */
    const duration = FIXED_DURATION;

    element.style.setProperty('--translateY', `${translateY}px`);
    element.style.setProperty('--duration', `${duration}s`);

    // 占用轨道：当前时间 + 持续时间
    trackArray[trackIndex] = currTimePoint + duration;

    // 动画结束后移除元素
    element.addEventListener('animationend', () => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  };

  /**
   * 根据当前播放时间创建弹幕
   * 筛选时间范围内的弹幕并根据模式分配到对应轨道
   * @param currentTime - 当前播放时间点（秒）
   */
  const createDanmaku = (currentTime: number): void => {
    if (!playerBasDmWrapRef.value) return;

    /** 当前时间范围内需要显示的弹幕列表 */
    const danmakuList = getTimePointDm(currentTime);

    danmakuList.forEach((danmaku: DanmakuItem) => {
      /** 创建弹幕 DOM 元素 */
      const element = createDanmuElement(danmaku);

      // 先将元素添加到容器以获取正确的 offsetWidth
      playerBasDmWrapRef.value?.appendChild(element);

      /** 弹幕速度标识键名，默认 moderate */
      const speedKey = danmaku.speed ?? 'moderate';
      /** 弹幕实际移动速度（像素/秒） */
      const speed = SPEED_MAP[speedKey] ?? SPEED_MAP.moderate;

      switch (danmaku.mode) {
        case 'scroll':
          handleScrollDanmu(element, currentTime, speed);
          break;
        case 'top':
          handleFixedDanmu(danmaku, element, currentTime, danmakuInfo.topRow);
          break;
        case 'bottom':
          handleFixedDanmu(danmaku, element, currentTime, danmakuInfo.bottomRow);
          break;
        default:
          handleScrollDanmu(element, currentTime, speed);
          break;
      }
    });

    // 更新最后时间点
    danmakuInfo.lastTimePoint = currentTime;
  };

  // ============================================
  // 弹幕提示（DmTip）
  // ============================================

  /**
   * 显示弹幕提示，通知上层组件展示弹幕详情
   * @param event - 鼠标事件
   * @param element - 弹幕 DOM 元素
   */
  const showDmTip = (event: MouseEvent, element: HTMLElement): void => {
    lifecycle.emit?.('showDmTip', { event, element });
  };

  /**
   * 隐藏弹幕提示，通知上层组件关闭弹幕详情
   * @param element - 弹幕 DOM 元素
   */
  const hideDmTip = (element: HTMLElement): void => {
    lifecycle.emit?.('hideDmTip', { element });
  };

  // ============================================
  // 播放/暂停控制
  // ============================================

  /**
   * 切换弹幕的播放/暂停状态
   * @param playState - 播放状态，'playing' 恢复动画，'paused' 暂停动画
   */
  const playPause = (playState: 'playing' | 'paused'): void => {
    if (playerRowDmWrapRef.value) {
      if (playState === 'playing') {
        playerRowDmWrapRef.value.classList.remove('danmaku-x-paused');
      } else if (playState === 'paused') {
        playerRowDmWrapRef.value.classList.add('danmaku-x-paused');
      }
    }
  };

  // ============================================
  // 生命周期
  // ============================================

  /** 组件挂载后对外暴露弹幕容器引用和控制方法 */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('danmakuLayerMounted', {
      playerRowDmWrap: playerRowDmWrapRef.value,
      playerAdvDmWrap: playerAdvDmWrapRef.value,
      playerBasDmWrap: playerBasDmWrapRef.value,
      danmakuXRotate: danmakuXRotateRef.value,
      playPause,
      createDanmaku,
      showDmTip,
      hideDmTip,
    });
  };

  /** 组件销毁前清理所有弹幕容器内的子节点 */
  lifecycle.onBeforeDestroy = (): void => {
    // 清理基础弹幕容器内所有子节点
    if (playerBasDmWrapRef.value) {
      while (playerBasDmWrapRef.value.firstChild) {
        playerBasDmWrapRef.value.removeChild(playerBasDmWrapRef.value.firstChild);
      }
    }
    // 清理高级弹幕容器内所有子节点
    if (playerAdvDmWrapRef.value) {
      while (playerAdvDmWrapRef.value.firstChild) {
        playerAdvDmWrapRef.value.removeChild(playerAdvDmWrapRef.value.firstChild);
      }
    }
    // 清理旋转弹幕容器内所有子节点
    if (danmakuXRotateRef.value) {
      while (danmakuXRotateRef.value.firstChild) {
        danmakuXRotateRef.value.removeChild(danmakuXRotateRef.value.firstChild);
      }
    }
  };

  // ============================================
  // 渲染输出
  // ============================================

  /**
   * 渲染弹幕容器
   * .player-row-dm-wrap.danmaku-x-paused > .player-adv-dm-wrap + .player-bas-dm-wrap > .bas-danmaku.bas-danmaku-pause + .danmaku-x-dm-rotate
   */
  return h('div', {
    class: 'player-row-dm-wrap danmaku-x-paused',
    ref: 'playerRowDmWrapRef',
  },
    // 高级弹幕容器
    h('div', {
      class: 'player-adv-dm-wrap',
      ref: 'playerAdvDmWrapRef',
    }),
    // 基础弹幕容器
    h('div', {
      class: 'player-bas-dm-wrap',
      ref: 'playerBasDmWrapRef',
    },
      h('div', {
        class: 'bas-danmaku bas-danmaku-pause',
        style: { width: '100%' },
      })
    ),
    // 旋转弹幕容器
    h('div', {
      class: 'danmaku-x-dm-rotate',
      ref: 'danmakuXRotateRef',
    })
  );
});

export default RowDm;
