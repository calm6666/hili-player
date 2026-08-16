/**
 * ============================================
 * 视频信息组件
 * ============================================
 */

import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';

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
  /** 是否显示面板 */
  visible?: boolean;
  /** 信息项数组，未提供时使用默认信息项 */
  items?: VideoInfoItem[];
  /** 关闭面板的回调函数 */
  onClose?: () => void;
}

/**
 * 默认信息项列表
 * 包含视频播放的默认统计信息
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
 * 展示视频播放的统计信息，如媒体类型、分辨率、码率等
 */
export const VideoInfo = defineComponent<VideoInfoProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 引用
  // ============================================

  /** 信息面板外层容器 DOM 引用 */
  const infoContainerRef = ref<HTMLDivElement>();

  /** 信息面板内容区域 DOM 引用 */
  const panelRef = ref<HTMLDivElement>();

  /**
   * 处理关闭面板操作
   */
  const handleClose = (): void => {
    props.onClose?.();
  };

  /**
   * 获取要渲染的信息项列表
   * @returns 信息项数组
   */
  const renderInfoItems = (): VideoInfoItem[] => {
    return props.items ?? DEFAULT_INFO_ITEMS;
  };

  /** 实际渲染的信息项列表 */
  const infoItems = renderInfoItems();

  // ============================================
  // DOM 更新方法
  // ============================================

  /**
   * 更新指定标题的信息项数据
   * @param title - 要更新的信息项标题
   * @param data - 新的数据内容
   */
  const updateItem = (title: string, data: string): void => {
    if (panelRef.current) {
      const lines = panelRef.current.querySelectorAll('.info-line');
      lines.forEach((line) => {
        const titleEl = line.querySelector('.info-title');
        if (titleEl && titleEl.textContent === title) {
          const dataEl = line.querySelector('.info-data');
          if (dataEl) {
            dataEl.textContent = data;
          }
        }
      });
    }
  };

  /**
   * 显示信息面板
   */
  const show = (): void => {
    if (infoContainerRef.current) {
      infoContainerRef.current.style.display = '';
    }
  };

  /**
   * 隐藏信息面板
   */
  const hide = (): void => {
    if (infoContainerRef.current) {
      infoContainerRef.current.style.display = 'none';
    }
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，通过事件向外暴露控制方法
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('videoInfoMounted', { updateItem, show, hide });
  };

  /**
   * 组件销毁前，清空 DOM 引用以防止内存泄漏
   */
  lifecycle.onBeforeDestroy = (): void => {
  };

  return h(
    'div',
    {
      class: 'player-info-container',
      ref: infoContainerRef,
    },
    h(
      'div',
      { class: 'player-info-title' },
      '统计信息',
      h(
        'span',
        { class: 'player-info-close', onClick: handleClose },
        h('span', { class: 'common-svg-icon' }, '×')
      )
    ),
    h(
      'div',
      { class: 'player-info-panel', ref: panelRef },
      ...infoItems.map((item) =>
        h(
          'div',
          { class: 'info-line' },
          h('span', { class: 'info-title' }, item.title),
          h('span', { class: 'info-data' }, item.data)
        )
      )
    )
  );
});
