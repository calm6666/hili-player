/**
 * ============================================
 * 视频信息组件
 * ============================================
 * 使用 h 函数实现的视频信息组件
 */

import { h, defineComponent } from '@/core';

/**
 * 视频信息项接口
 */
export interface VideoInfoItem {
  /** 标题 */
  title: string;
  /** 数据 */
  data: string;
}

/**
 * 视频信息组件 Props 接口
 */
export interface VideoInfoProps {
  /** 是否显示 */
  visible?: boolean;
  /** 信息项数组 */
  items?: VideoInfoItem[];
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 默认信息项
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
 * 使用 h 函数实现，保持与原组件相同的 DOM 结构和类名
 */
export const VideoInfo = defineComponent<VideoInfoProps>((props) => {
  /**
   * 信息容器元素引用
   */
  const infoContainerRef: { current: HTMLDivElement | null } = { current: null };

  /**
   * 处理关闭
   */
  const handleClose = (): void => {
    props.onClose?.();
  };

  /**
   * 渲染信息项
   */
  const renderInfoItems = (): VideoInfoItem[] => {
    return props.items ?? DEFAULT_INFO_ITEMS;
  };

  const infoItems = renderInfoItems();

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
      { class: 'player-info-panel' },
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
