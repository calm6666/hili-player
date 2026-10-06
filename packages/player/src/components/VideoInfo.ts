/**
 * ============================================
 * 视频统计信息组件 (VideoInfo)
 * ============================================
 *
 * DOM 结构与 CSS 类名与既有实现保持一致：
 *   .player-info-container
 *     .player-info-title（含 .player-info-close > .common-svg-icon）
 *     .player-info-panel
 *       .info-line > .info-title + .info-data
 *
 * 显隐由根节点上的 player-active 类控制（基态 display: none），
 * 与既有实现的 open()/close() 行为一致。
 *
 * 数据来源：stateMgr 运行时状态（video.width / video.height / player.buffered），
 * 面板打开期间以 1s 定时刷新；码率 / Host 等无真实数据源的项保留参考占位文本。
 */

import { h, defineComponent, useTemplateRef, useContext } from '@/core';
import type { ComponentLifecycle } from '@/types';
import type { VNode } from '@/types';
import type { TypedStateManager } from '@/core/state';
import {
  StateContext,
  PlayerStateKeyEnum,
  type PlayerStateMap,
} from '@/store/runtimeState';

/**
 * 视频信息项接口
 * 描述单条视频统计信息的标题和数据
 */
export interface VideoInfoItem {
  /** 信息项标题 */
  title: string;
  /** 信息项数据内容 */
  data: string;
}

/**
 * 视频信息组件 Props 接口
 */
export interface VideoInfoProps {
  /** 视频源地址（用于解析视频 Host） */
  src?: string;
  /** 信息项数组，未提供时使用默认信息项 */
  items?: VideoInfoItem[];
  /** 关闭面板的回调函数 */
  onClose?: () => void;
}

/**
 * 视频信息面板对外暴露的 API
 */
export interface VideoInfoApi {
  /** 打开面板 */
  open: () => void;
  /** 关闭面板 */
  close: () => void;
  /** 更新指定标题的信息项数据 */
  updateItem: (title: string, data: string) => void;
}

/** 刷新间隔（毫秒），与既有实现的静态展示相比补充了轻量定时刷新 */
const REFRESH_INTERVAL = 1000;

/** 关闭图标（与既有实现的 Close 图标一致） */
const CloseIcon = (): VNode =>
  h(
    'svg',
    { viewBox: '0 0 1024 1024', version: '1.1', xmlns: 'http://www.w3.org/2000/svg' },
    h('path', {
      d: 'M512 444.16l297.088-297.088c17.088-17.152 46.208-15.872 64.96 2.88 18.752 18.752 20.032 47.872 2.88 64.96L579.904 512l297.024 297.088c17.152 17.088 15.872 46.208-2.88 64.96-18.752 18.752-47.872 20.032-64.96 2.88L512 579.904l-297.088 297.024c-17.088 17.152-46.208 15.872-64.96-2.88-18.752-18.752-20.032-47.872-2.88-64.96L444.096 512 147.072 214.912c-17.152-17.088-15.872-46.208 2.88-64.96 18.752-18.752 47.872-20.032 64.96-2.88L512 444.096z',
    }),
  );

/**
 * 默认信息项列表（标题与既有实现一致）
 */
const DEFAULT_INFO_ITEMS: VideoInfoItem[] = [
  { title: '媒体类型:', data: 'video/mp4;codecs="av01.0.00M.10.0.110.01.01.01.0",audio/mp4;codecs="mp4a.40.2"' },
  { title: '播放器类型:', data: 'DashPlayer' },
  { title: '分辨率:', data: '1280 x 720@30.000' },
  { title: '视频码率:', data: '1223 Kbps' },
  { title: '音频码率:', data: '112 Kbps' },
  { title: '视频 Host:', data: 'io.v.hblog.top' },
  { title: '音频 Host:', data: 'io.v.hblog.top' },
  { title: '视频缓存速度:', data: '9900 Kbps' },
  { title: '音频缓冲速度:', data: '4507 Kbps' },
];

/**
 * 视频信息组件
 */
export const VideoInfo = defineComponent<VideoInfoProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // 状态管理器（通过 Context 获取）
  // ============================================

  /** 运行时状态管理器，用于读取分辨率 / 缓冲等实时数据 */
  const stateMgr = useContext<TypedStateManager<PlayerStateMap> | null>(
    StateContext,
  );

  // ============================================
  // DOM 引用
  // ============================================

  /** 信息面板外层容器 DOM 引用 */
  const infoContainerRef = useTemplateRef<HTMLDivElement>(lifecycle, 'infoContainerRef');

  /** 信息面板内容区域 DOM 引用 */
  const panelRef = useTemplateRef<HTMLDivElement>(lifecycle, 'panelRef');

  /** 定时刷新计时器 ID */
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  /** 实际渲染的信息项列表 */
  const infoItems: VideoInfoItem[] = props.items ?? DEFAULT_INFO_ITEMS;

  // ============================================
  // 数据刷新
  // ============================================

  /**
   * 从视频源地址解析主机名
   * @returns 主机名；解析失败时返回空字符串
   */
  const resolveHost = (): string => {
    if (!props.src) return '';
    try {
      return new URL(props.src).hostname;
    } catch {
      return '';
    }
  };

  /**
   * 读取运行时状态并刷新可动态获取的信息项
   * 分辨率取自 video.width / video.height；缓冲取自 player.buffered；
   * Host 取自视频源地址；无数据源时不覆盖（保留初始占位文本）。
   */
  const refreshInfo = (): void => {
    if (stateMgr) {
      /** 视频宽度 */
      const width = stateMgr.get(PlayerStateKeyEnum.VIDEO_WIDTH) ?? 0;
      /** 视频高度 */
      const height = stateMgr.get(PlayerStateKeyEnum.VIDEO_HEIGHT) ?? 0;
      if (width > 0 && height > 0) {
        updateItem('分辨率:', `${width} x ${height}`);
      }
      /** 缓冲进度（秒） */
      const buffered = stateMgr.get(PlayerStateKeyEnum.BUFFERED) ?? 0;
      if (buffered > 0) {
        updateItem('视频缓存速度:', `已缓冲 ${buffered.toFixed(1)}s`);
      }
    }
    /** 视频源主机名 */
    const host = resolveHost();
    if (host) {
      updateItem('视频 Host:', host);
      updateItem('音频 Host:', host);
    }
  };

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 更新指定标题的信息项数据
   * @param title - 要更新的信息项标题
   * @param data - 新的数据内容
   */
  const updateItem = (title: string, data: string): void => {
    if (panelRef.value) {
      /** 所有信息行元素 */
      const lines = panelRef.value.querySelectorAll('.info-line');
      lines.forEach((line) => {
        /** 当前行标题元素 */
        const titleEl = line.querySelector('.info-title');
        if (titleEl && titleEl.textContent === title) {
          /** 当前行数据元素 */
          const dataEl = line.querySelector('.info-data');
          if (dataEl) {
            dataEl.textContent = data;
          }
        }
      });
    }
  };

  // ============================================
  // 显隐控制（player-active 类机制，与既有实现一致）
  // ============================================

  /** 显示信息面板，并启动定时刷新 */
  const open = (): void => {
    infoContainerRef.value?.classList.add('player-active');
    if (refreshTimer === null) {
      // 打开时立即刷新一次，随后定时刷新
      refreshInfo();
      refreshTimer = setInterval(refreshInfo, REFRESH_INTERVAL);
    }
  };

  /** 隐藏信息面板，并停止定时刷新 */
  const close = (): void => {
    infoContainerRef.value?.classList.remove('player-active');
    if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，通过事件向外暴露控制方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('videoInfoMounted', { open, close, updateItem } satisfies VideoInfoApi);
  };

  /**
   * 组件销毁前，停止定时刷新
   */
  lifecycle.onBeforeDestroy = (): void => {
    if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  // ============================================
  // 组件渲染（DOM 结构与既有实现一致）
  // ============================================

  return h(
    'div',
    {
      class: 'player-info-container',
      ref: 'infoContainerRef',
    },
    h(
      'div',
      { class: 'player-info-title' },
      '统计信息',
      h(
        'span',
        { class: 'player-info-close', onClick: () => { close(); props.onClose?.(); } },
        h('span', { class: 'common-svg-icon' }, CloseIcon()),
      ),
    ),
    h(
      'div',
      { class: 'player-info-panel', ref: 'panelRef' },
      ...infoItems.map((item) =>
        h(
          'div',
          { class: 'info-line' },
          h('span', { class: 'info-title' }, item.title),
          h('span', { class: 'info-data' }, item.data),
        ),
      ),
    ),
  );
});
