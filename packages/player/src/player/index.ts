/**
 * ============================================
 * 播放器模块统一导出
 * ============================================
 */

export { VideoPlayer, getPlayerInstance } from './VideoPlayer';

import { VideoPlayer } from './VideoPlayer';
import type { PlayerConfig } from '@/types';
import { isServer } from '@/utils';

export { renderToString } from '@/core';

/**
 * 创建播放器实例
 *
 * @param config - 播放器配置
 * @returns 播放器实例
 *
 * @example
 * const player = createPlayer({
 *   src: 'https://example.com/video.mp4',
 *   autoplay: true,
 * });
 * player.mount(document.getElementById('player-container')!);
 */
export function createPlayer(config: PlayerConfig): VideoPlayer {
  return new VideoPlayer(config);
}

/**
 * 快速创建并挂载播放器
 * 在服务端环境中只创建实例，不挂载到 DOM
 *
 * @param container - 容器元素或选择器
 * @param config - 播放器配置
 * @returns 播放器实例
 *
 * @example
 * const player = mountPlayer('#player', {
 *   src: 'https://example.com/video.mp4',
 * });
 */
export function mountPlayer(
  container: string | HTMLElement,
  config: PlayerConfig
): VideoPlayer {
  /**
   * 服务端环境只创建实例，不挂载
   */
  if (isServer()) {
    return createPlayer(config);
  }

  const el = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!el) {
    throw new Error(`Container not found: ${typeof container === 'string' ? container : 'HTMLElement'}`);
  }

  if (!(el instanceof HTMLElement)) {
    throw new Error('Container must be an HTMLElement');
  }

  const player = createPlayer(config);
  player.mount(el);
  return player;
}

/**
 * SSR 辅助函数：创建 SSR 安全的播放器
 * 在服务端渲染骨架 HTML，在客户端激活水合
 *
 * @param config - 播放器配置（必须包含 ssr.enabled = true）
 * @returns 播放器实例
 *
 * @example
 * // 服务端
 * const player = createSSRPlayer({
 *   src: 'https://example.com/video.mp4',
 *   ssr: { enabled: true },
 * });
 * const html = renderToString(player.render());
 *
 * // 客户端
 * const container = document.getElementById('player')!;
 * const player = createSSRPlayer({
 *   src: 'https://example.com/video.mp4',
 *   ssr: { enabled: false },
 * });
 * player.hydrate(container);
 */
export function createSSRPlayer(config: PlayerConfig): VideoPlayer {
  const ssrConfig = config.ssr || { enabled: false };
  return new VideoPlayer({ ...config, ssr: ssrConfig });
}
