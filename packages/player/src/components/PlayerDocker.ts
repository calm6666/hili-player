/**
 * ============================================
 * 播放器主容器组件 (PlayerDocker)
 * ============================================
 * 使用 h 函数实现，保持与既有实现完全相同的 DOM 结构和类名
 * 参考 player/src/player.ts 实现
 */

import { defineComponent, h } from '@/core';
import type { ComponentLifecycle } from '@/types';
import { Controls } from '@/hili-player/components/Controls'

// ============================================
// 组件属性接口
// ============================================

export interface PlayerDockerProps {
  /** 视频源 URL */
  src?: string;
  /** 播放器名称 */
  playerName?: string;
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 默认音量 */
  volume?: number;
  /** 是否静音 */
  muted?: boolean;
  /** 播放器挂载完成回调 */
  onMounted?: (elements: {
    container: HTMLElement;
    videoArea: HTMLElement;
    videoWrap: HTMLElement;
    video: HTMLVideoElement;
    sendingArea: HTMLElement;
  }) => void;
}

// ============================================
// 播放器主容器组件
// ============================================

/**
 * 播放器主容器组件
 * 使用 h 函数实现，保持与既有实现完全相同的 DOM 结构和类名
 */
export const PlayerDocker = defineComponent<PlayerDockerProps>((props, lifecycle: ComponentLifecycle) => {
  // ============================================
  // DOM 元素引用
  // ============================================

  /** 播放器外层容器 */
  const playerDockerRef: { current: HTMLDivElement | null } = { current: null };

  /** 播放器容器 */
  const playerContainerRef: { current: HTMLDivElement | null } = { current: null };

  /** 视频区域 */
  const playerVideoAreaRef: { current: HTMLDivElement | null } = { current: null };

  /** 视频占位容器 */
  const playerVideoPerchRef: { current: HTMLDivElement | null } = { current: null };

  /** 视频包装容器 */
  const playerVideoWrapRef: { current: HTMLDivElement | null } = { current: null };

  /** 视频海报 */
  const playerVideoPosterRef: { current: HTMLDivElement | null } = { current: null };

  /** 发送区域 */
  const playerSendingAreaRef: { current: HTMLDivElement | null } = { current: null };

  /** 视频元素 */
  const videoRef: { current: HTMLVideoElement | null } = { current: null };

  // ============================================
  // 状态数据
  // ============================================

  const playerInfo = {
    dataScreen: 'normal',
    isPip: false,
    isWide: false,
    volume: props.volume ?? 0.3,
    isMuted: props.muted ?? false,
    videoRatio: 'auto',
    isMinPlayer: false,
    isPlaying: false,
    backrate: 1,
    qualityIndex: 0,
  };

  const videoInfo = {
    duration: 0,
    buffer: 0,
    currentTime: 0,
  };

  // ============================================
  // 初始化方法
  // ============================================

  /**
   * 初始化视频元素
   */
  const initVideo = (): void => {
    if (!playerVideoWrapRef.current) return;

    const video = document.createElement('video');
    video.className = 'player-video';
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    props.src ? video.src = props.src:
    video.volume = playerInfo.volume;
    video.muted = playerInfo.isMuted;

    if (props.autoplay) {
      video.autoplay = true;
    }

    // 绑定视频事件
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);

    playerVideoWrapRef.current.appendChild(video);
    videoRef.current = video;

    // 触发视频创建事件
    lifecycle.emit?.('videoCreated', { video });
  };

  // ============================================
  // 事件处理器
  // ============================================

  const handleLoadedMetadata = (): void => {
    if (!videoRef.current) return;
    videoInfo.duration = videoRef.current.duration;
    lifecycle.emit?.('loadedMetadata', { duration: videoInfo.duration });
  };

  const handleTimeUpdate = (): void => {
    if (!videoRef.current) return;
    videoInfo.currentTime = videoRef.current.currentTime;
    lifecycle.emit?.('timeUpdate', { currentTime: videoInfo.currentTime });
  };

  const handleProgress = (): void => {
    if (!videoRef.current) return;
    const buffered = videoRef.current.buffered;
    if (buffered.length > 0) {
      videoInfo.buffer = buffered.end(buffered.length - 1);
      lifecycle.emit?.('progress', { buffer: videoInfo.buffer });
    }
  };

  const handlePlay = (): void => {
    playerInfo.isPlaying = true;
    lifecycle.emit?.('play', {});
  };

  const handlePause = (): void => {
    playerInfo.isPlaying = false;
    lifecycle.emit?.('pause', {});
  };

  const handleEnded = (): void => {
    playerInfo.isPlaying = false;
    lifecycle.emit?.('ended', {});
  };

  const handleWaiting = (): void => {
    lifecycle.emit?.('waiting', {});
  };

  const handleCanPlay = (): void => {
    lifecycle.emit?.('canplay', {});
  };

  // 创建视频容器大小监听
  const resizeObserver = new ResizeObserver((entries) => {
        entries.forEach(() => {
            
        });
  });

  // ============================================
  // 生命周期钩子
  // ============================================

  lifecycle.onMounted = (): void => {
    // 初始化视频
    initVideo();

    // 设置 aria-label
    if (playerContainerRef.current && props.playerName) {
      playerContainerRef.current.setAttribute('aria-label', props.playerName);
    }

    // 触发挂载完成回调
    if (props.onMounted && playerDockerRef.current && playerVideoAreaRef.current &&
        playerVideoWrapRef.current && videoRef.current && playerSendingAreaRef.current) {
      props.onMounted({
        container: playerDockerRef.current,
        videoArea: playerVideoAreaRef.current,
        videoWrap: playerVideoWrapRef.current,
        video: videoRef.current,
        sendingArea: playerSendingAreaRef.current,
      });
    }

    resizeObserver.observe(playerDockerRef.current!);

    // 触发播放器加载完成事件
    lifecycle.emit?.('playerLoaded', {});
  };

  lifecycle.onBeforeDestroy = (): void => {
    // 清理视频事件监听
    if (videoRef.current) {
      videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      videoRef.current.removeEventListener('progress', handleProgress);
      videoRef.current.removeEventListener('play', handlePlay);
      videoRef.current.removeEventListener('pause', handlePause);
      videoRef.current.removeEventListener('ended', handleEnded);
      videoRef.current.removeEventListener('waiting', handleWaiting);
      videoRef.current.removeEventListener('canplay', handleCanPlay);
    }
  };

  // ============================================
  // 渲染输出
  // ============================================

  /**
   * 渲染播放器主容器
   */
  return h('div', {
    class: 'player-docker player-docker-major',
    'data-injector': 'nano',
    ref: playerDockerRef,
  },
    h('div', {
      class: 'player-container state-paused state-no-cursor state-disable-box-shadow',
      'data-angle': 'd3d11',
      'data-screen': 'normal',
      'data-ctrl-hidden': 'false',
      ref: playerContainerRef,
    },
      h('div', { class: 'player-primary-area' },
        // 视频区域
        h('div', {
          class: 'player-video-area',
          ref: playerVideoAreaRef,
        },
          // 视频占位容器
          h('div', {
            class: 'player-video-perch',
            ref: playerVideoPerchRef,
          },
            // 视频包装容器
            h('div', {
              class: 'player-video-wrap',
              ref: playerVideoWrapRef,
            })
          ),
          // 视频海报
          h('div', {
            class: 'player-video-poster',
            hidden: true,
            ref: playerVideoPosterRef,
          }),
          // 视频控制栏
          h(Controls, {
            duration: videoInfo.duration,
            volume: playerInfo.volume,
            backrate: playerInfo.backrate,
            config: {
              prev: true,
              next: true,
              viewpoint: false,
              quality: true,
              eplist: false,
              setting: true,
              pip: true,
              wide: true,
              web: true,
              progressViewPoints: [],
            },
            isEdit: false,
            onPlayPause: () => {
              if (videoRef.current) {
                if (playerInfo.isPlaying) {
                  videoRef.current.pause();
                } else {
                  videoRef.current.play();
                }
              }
            },
            onSeek: (time: number) => {
              if (videoRef.current) {
                videoRef.current.currentTime = time;
              }
            },
            onVolumeChange: (vol: number) => {
              playerInfo.volume = vol;
              if (videoRef.current) {
                videoRef.current.volume = vol;
              }
            },
            onMuteToggle: () => {
              playerInfo.isMuted = !playerInfo.isMuted;
              if (videoRef.current) {
                videoRef.current.muted = playerInfo.isMuted;
              }
            },
            onBackrateChange: (rate: number) => {
              playerInfo.backrate = rate;
              if (videoRef.current) {
                videoRef.current.playbackRate = rate;
              }
            },
            onFullscreenToggle: () => {
              lifecycle.emit?.('fullscreenToggle');
            },
            onWebFullscreenToggle: () => {
              lifecycle.emit?.('webFullscreenToggle');
            },
            onPipToggle: () => {
              lifecycle.emit?.('pipToggle');
            },
            onPrev: () => {
              lifecycle.emit?.('prev');
            },
            onNext: () => {
              lifecycle.emit?.('next');
            },
          })
        ),
        // 发送区域（弹幕输入等）
        h('div', {
          class: 'player-sending-area',
          ref: playerSendingAreaRef,
        })
      )
    )
  );
});

export default PlayerDocker;
