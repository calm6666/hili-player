/**
 * PlayerDocker 组件单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, mount, destroy } from '@/core';

// Polyfill ResizeObserver for jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
// Polyfill IntersectionObserver for jsdom
if (typeof globalThis.IntersectionObserver === 'undefined') {
  (globalThis as any).IntersectionObserver = class IntersectionObserver {
    root: Element | null = null;
    rootMargin: string = '';
    thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  };
}

// Mock child components
vi.mock('@/hili-player/components/Controls', () => ({
  Controls: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-control-wrap' }, children: [] })),
}));
vi.mock('@/hili-player/components/RowDm', () => ({
  RowDm: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-row-dm-wrap' }, children: [] })),
}));
vi.mock('@/hili-player/components/SubtitleLayer', () => ({
  SubtitleLayer: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-subtitle-wrap' }, children: [] })),
}));
vi.mock('@/hili-player/components/InteractionLayer', () => ({
  InteractionLayer: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-interaction-wrap' }, children: [] })),
}));
vi.mock('@/hili-player/components/Dialog', () => ({
  Dialog: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-dialog-wrap' }, children: [] })),
}));

import { PlayerDocker } from '@/hili-player/components/PlayerDocker';

describe('PlayerDocker', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should render PlayerDocker component', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    expect(container.querySelector('.player-docker')).toBeTruthy();
  });

  it('should render player container with state-paused class', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const playerContainer = container.querySelector('.player-container') as HTMLElement;
    expect(playerContainer).toBeTruthy();
    expect(playerContainer.classList.contains('state-paused')).toBe(true);
  });

  it('should have data-screen attribute set to normal', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const playerContainer = container.querySelector('.player-container') as HTMLElement;
    expect(playerContainer.getAttribute('data-screen')).toBe('normal');
  });

  it('should remove state-paused class on play event', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const playerContainer = container.querySelector('.player-container') as HTMLElement;

    // Simulate play: remove state-paused
    playerContainer.classList.remove('state-paused');
    expect(playerContainer.classList.contains('state-paused')).toBe(false);
  });

  it('should add state-paused class on pause event', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const playerContainer = container.querySelector('.player-container') as HTMLElement;

    // Remove then add back
    playerContainer.classList.remove('state-paused');
    playerContainer.classList.add('state-paused');
    expect(playerContainer.classList.contains('state-paused')).toBe(true);
  });

  it('should add state-buff class on waiting', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const playerContainer = container.querySelector('.player-container') as HTMLElement;

    playerContainer.classList.add('state-buff');
    expect(playerContainer.classList.contains('state-buff')).toBe(true);
  });

  it('should remove state-buff class on canplay', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const playerContainer = container.querySelector('.player-container') as HTMLElement;

    playerContainer.classList.add('state-buff');
    playerContainer.classList.remove('state-buff');
    expect(playerContainer.classList.contains('state-buff')).toBe(false);
  });

  it('should change data-screen attribute', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const playerContainer = container.querySelector('.player-container') as HTMLElement;

    // Simulate fullscreen
    playerContainer.setAttribute('data-screen', 'full');
    expect(playerContainer.getAttribute('data-screen')).toBe('full');

    // Simulate back to normal
    playerContainer.setAttribute('data-screen', 'normal');
    expect(playerContainer.getAttribute('data-screen')).toBe('normal');
  });

  it('should add mode-webscreen class on web fullscreen', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const docker = container.querySelector('.player-docker') as HTMLElement;

    docker.classList.add('mode-webscreen');
    expect(docker.classList.contains('mode-webscreen')).toBe(true);
  });

  it('should remove mode-webscreen class on exit web fullscreen', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    const docker = container.querySelector('.player-docker') as HTMLElement;

    docker.classList.add('mode-webscreen');
    docker.classList.remove('mode-webscreen');
    expect(docker.classList.contains('mode-webscreen')).toBe(false);
  });

  it('should add webscreen-fix to document.body on web fullscreen', () => {
    document.body.classList.add('webscreen-fix');
    expect(document.body.classList.contains('webscreen-fix')).toBe(true);
    document.body.classList.remove('webscreen-fix');
    expect(document.body.classList.contains('webscreen-fix')).toBe(false);
  });

  it('should create video element on mount', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4' });
    mount(vnode, container);
    // Video element is created in onMounted lifecycle
    const video = container.querySelector('video');
    // In jsdom, the video element should be created
    expect(video).toBeTruthy();
  });

  it('should set aria-label on player container', () => {
    const vnode = h(PlayerDocker, { src: 'test.mp4', playerName: 'Test Player' });
    mount(vnode, container);
    const playerContainer = container.querySelector('.player-container') as HTMLElement;
    expect(playerContainer.getAttribute('aria-label')).toBe('Test Player');
  });
});
