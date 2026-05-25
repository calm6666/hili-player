/**
 * ============================================
 * 弹幕容器组件 (RowDm)
 * ============================================
 * 使用 h 函数实现，保持与既有实现完全相同的 DOM 结构和类名
 * 参考 player/src/component/rowdm/index.ts 实现
 * 弹幕逻辑使用 src/utils/danmaku 中的 DanmakuManager
 */

import { defineComponent, h } from '@/core';
import type { VNode, ComponentLifecycle } from '@/types';

// ============================================
// 弹幕类型定义
// ============================================

export type DanmakuMode = 'scroll' | 'top' | 'bottom';

export interface DanmakuItem {
  /** 弹幕内容 */
  content: string;
  /** 弹幕时间（秒） */
  timePoint: number;
  /** 弹幕模式 */
  mode: DanmakuMode;
  /** 弹幕速度 */
  speed: string;
  /** 字体大小 */
  fontSize?: number;
  /** 颜色 */
  color?: string;
}

export interface DanmakuInfo {
  /** 弹幕列表 */
  danmakuList: DanmakuItem[];
  /** 最后一个时间点 */
  lastTimePoint: number;
  /** 滚动弹幕轨道 */
  rollRow: number[];
  /** 顶部弹幕轨道 */
  topRow: number[];
  /** 底部弹幕轨道 */
  bottomRow: number[];
}

export interface DmTip {
  /** 弹幕元素 */
  element: HTMLElement;
  /** 弹幕数据 */
  danmaku: DanmakuItem;
  /** 位置 */
  position: { x: number; y: number };
}

// ============================================
// 组件属性接口
// ============================================

export interface RowDmProps {
  /** 是否开启弹幕 */
  isOpen?: boolean;
  /** 弹幕数据列表 */
  danmakuList?: DanmakuItem[];
  /** 底部偏移 */
  dmBottom?: number;
}

// ============================================
// 弹幕容器组件
// ============================================

/**
 * 弹幕容器组件
 * 使用 h 函数实现，保持与既有实现完全相同的 DOM 结构和类名
 */
export const RowDm = defineComponent<RowDmProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================

  /** 弹幕外层容器 */
  const playerRowDmWrapRef: { current: HTMLDivElement | null } = { current: null };

  /** 高级弹幕容器 */
  const playerAdvDmWrapRef: { current: HTMLDivElement | null } = { current: null };

  /** 基础弹幕容器 */
  const playerBasDmWrapRef: { current: HTMLDivElement | null } = { current: null };

  /** 旋转弹幕容器 */
  const danmakuXRotateRef: { current: HTMLDivElement | null } = { current: null };

  // ============================================
  // 状态数据
  // ============================================

  const danmakuInfo: DanmakuInfo = {
    danmakuList: props.danmakuList || [],
    lastTimePoint: -1,
    rollRow: new Array(12).fill(-1),
    topRow: new Array(12).fill(-1),
    bottomRow: new Array(12).fill(-1),
  };

  const dmBottom = props.dmBottom ?? 90;

  // ============================================
  // 工具函数
  // ============================================

  /**
   * 查找空闲轨道
   */
  const findAvailablePosition = (trackArray: number[], currTimePoint: number): { index: number; full: boolean } => {
    let i = 0;
    let min = Infinity;
    let minIndex = 0;
    let foundFreeSlot = false;

    // 更新轨道状态，释放已结束的弹幕轨道
    for (i = 0; i < trackArray.length; i++) {
      if (trackArray[i] < currTimePoint) {
        trackArray[i] = -1;
      }
    }

    // 查找空闲轨道
    for (i = 0; i < trackArray.length; i++) {
      if (trackArray[i] === -1) {
        foundFreeSlot = true;
        return { index: i, full: false };
      }
      if (trackArray[i] < min && trackArray[i] >= currTimePoint) {
        min = trackArray[i];
        minIndex = i;
      }
    }

    // 如果所有轨道都被占用，寻找上下方的空闲轨道
    if (!foundFreeSlot) {
      const topTrack = Math.max(0, minIndex - 1);
      const bottomTrack = Math.min(trackArray.length - 1, minIndex + 1);

      if (trackArray[topTrack] === -1) {
        return { index: topTrack, full: true };
      }
      if (trackArray[bottomTrack] === -1) {
        return { index: bottomTrack, full: true };
      }
    }

    return { index: minIndex, full: true };
  };

  /**
   * 创建弹幕元素
   */
  const createDanmuElement = (danmaku: DanmakuItem): HTMLElement => {
    const danmuElement = document.createElement('div');
    danmuElement.className = 'danmaku-x-dm';
    danmuElement.textContent = danmaku.content;

    // 设置样式
    danmuElement.style.cssText = `
      position: absolute;
      white-space: nowrap;
      font-size: ${danmaku.fontSize || 25}px;
      color: ${danmaku.color || '#ffffff'};
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      pointer-events: auto;
      cursor: pointer;
      z-index: 10;
    `;

    // 绑定悬停事件
    danmuElement.addEventListener('mouseover', (event) => {
      if (event instanceof MouseEvent) {
        showDmTip(event, danmuElement, danmaku);
      }
    });

    danmuElement.addEventListener('mouseout', () => {
      hideDmTip();
    });

    return danmuElement;
  };

  /**
   * 处理滚动弹幕
   */
  const handleScrollDanmu = (danmuElement: HTMLElement, currTimePoint: number, speed: string): void => {
    let dmSpeed = 75;
    switch (speed) {
      case 'verySlow':
        dmSpeed = 50;
        break;
      case 'slow':
        dmSpeed = 60;
        break;
      case 'moderate':
        dmSpeed = 75;
        break;
      case 'fast':
        dmSpeed = 90;
        break;
      case 'veryFast':
        dmSpeed = 100;
        break;
    }

    danmuElement.classList.add('danmaku-x-roll');
    const contentWidth = danmuElement.offsetWidth;
    if (!playerRowDmWrapRef.current) return;

    const distance = playerRowDmWrapRef.current.offsetWidth + contentWidth;
    danmuElement.style.setProperty('--offset', `${playerRowDmWrapRef.current.offsetWidth}px`);
    danmuElement.style.setProperty('--translateX', `-${distance}px`);
    danmuElement.style.setProperty('--duration', `${(distance + contentWidth) / dmSpeed}s`);

    const rowOutTime = contentWidth / dmSpeed + currTimePoint;
    const positionInfo = findAvailablePosition(danmakuInfo.rollRow, currTimePoint);
    if (positionInfo.full) {
      danmuElement.classList.add('danmaku-x-high');
    }
    danmuElement.style.setProperty('--top', `${positionInfo.index * 30 + 10}px`);
    danmakuInfo.rollRow[positionInfo.index] = rowOutTime;
  };

  /**
   * 处理固定弹幕
   */
  const handleFixedDanmu = (danmaku: DanmakuItem, danmuElement: HTMLElement, currTimePoint: number, trackArray: number[]): void => {
    danmuElement.classList.add('danmaku-x-high');
    danmuElement.classList.add('danmaku-x-center');
    danmuElement.style.setProperty('--duration', '4s');
    const rowOutTime = 4 + currTimePoint;

    const positionInfo = findAvailablePosition(trackArray, currTimePoint);
    if (positionInfo.full) {
      danmuElement.classList.add('danmaku-x-high');
    }
    if (danmaku.mode === 'top') {
      danmuElement.style.setProperty('--translateY', `${positionInfo.index * 30 + 10}px`);
    } else {
      const rowDmHeight = playerRowDmWrapRef.current?.getBoundingClientRect().height;
      danmuElement.style.setProperty('--translateY', `${positionInfo.index * 30 + Math.floor((rowDmHeight || 0) - dmBottom)}px`);
    }
    trackArray[positionInfo.index] = rowOutTime;
  };

  /**
   * 显示弹幕提示
   */
  const showDmTip = (event: MouseEvent, element: HTMLElement, danmaku: DanmakuItem): void => {
    const dmTip: DmTip = {
      element,
      danmaku,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
    };
    lifecycle.emit?.('showDmTip', dmTip);
  };

  /**
   * 隐藏弹幕提示
   */
  const hideDmTip = (): void => {
    lifecycle.emit?.('hideDmTip', {});
  };

  /**
   * 查询时间点弹幕
   */
  const getTimePointDm = (currTimePoint: number): DanmakuItem[] => {
    const danmakuList = danmakuInfo.danmakuList.filter(
      (danmaku: DanmakuItem) => danmakuInfo.lastTimePoint < danmaku.timePoint && danmaku.timePoint <= currTimePoint
    );
    danmakuInfo.lastTimePoint = currTimePoint;
    return danmakuList;
  };

  /**
   * 更新轨道状态
   */
  const updateTrackStatus = (trackArray: number[], currTimePoint: number): void => {
    for (let i = 0; i < trackArray.length; i++) {
      if (trackArray[i] < currTimePoint) {
        trackArray[i] = -1;
      }
    }
  };

  /**
   * 加载展示弹幕
   */
  const displayDanmus = (currTimePoint: number): void => {
    if (!playerRowDmWrapRef.current) return;

    const danmakuList = getTimePointDm(currTimePoint);

    // 更新轨道状态
    updateTrackStatus(danmakuInfo.rollRow, currTimePoint);
    updateTrackStatus(danmakuInfo.topRow, currTimePoint);
    updateTrackStatus(danmakuInfo.bottomRow, currTimePoint);

    // 遍历当前时间点的弹幕
    danmakuList.forEach((danmaku: DanmakuItem) => {
      if (!playerRowDmWrapRef.current) return;

      const danmuElement = createDanmuElement(danmaku);
      playerRowDmWrapRef.current.appendChild(danmuElement);

      if (danmaku.mode === 'scroll') {
        handleScrollDanmu(danmuElement, currTimePoint, danmaku.speed);
      } else if (danmaku.mode === 'top') {
        handleFixedDanmu(danmaku, danmuElement, currTimePoint, danmakuInfo.topRow);
      } else {
        handleFixedDanmu(danmaku, danmuElement, currTimePoint, danmakuInfo.bottomRow);
      }

      // 动画结束移除元素
      danmuElement.addEventListener('animationend', () => {
        if (danmuElement.parentNode) {
          danmuElement.parentNode.removeChild(danmuElement);
        }
      });
    });
  };

  // ============================================
  // 渲染输出
  // ============================================

  /**
   * 渲染弹幕容器
   * 保持与既有实现完全相同的 DOM 结构和类名
   */
  return h('div', {
    class: ['player-row-dm-wrap', 'danmaku-x-paused'],
    ref: playerRowDmWrapRef,
  },
    // 高级弹幕容器
    h('div', {
      class: 'player-adv-dm-wrap',
      ref: playerAdvDmWrapRef,
    }),
    // 基础弹幕容器
    h('div', {
      class: 'player-bas-dm-wrap',
      ref: playerBasDmWrapRef,
    },
      h('div', {
        class: 'bas-danmaku bas-danmaku-pause',
        style: { width: '100%' },
      })
    ),
    // 旋转弹幕容器
    h('div', {
      class: 'danmaku-x-dm-rotate',
      ref: danmakuXRotateRef,
    })
  );
});

export default RowDm;
