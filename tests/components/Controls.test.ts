/**
 * Controls 组件单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, mount, destroy } from '@/core';

// Mock child components to simplify testing
vi.mock('@/hili-player/components/LeftControls', () => ({
  LeftControls: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-ctrl-left' }, children: [] })),
}));
vi.mock('@/hili-player/components/RightControls', () => ({
  RightControls: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-ctrl-right' }, children: [] })),
}));
vi.mock('@/hili-player/components/TopControls', () => ({
  TopControls: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-ctrl-top' }, children: [] })),
}));
vi.mock('@/hili-player/components/PbpControls', () => ({
  PbpControls: vi.fn((_props) => ({ tag: 'div', attrs: { class: 'player-ctrl-pbp' }, children: [] })),
}));
vi.mock('@/utils/formatTime', () => ({
  formatTime: (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },
}));
vi.mock('@/utils/rafTimeout', () => ({
  rafTimeout: (fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    return id;
  },
  cancelRaf: (id: number | null) => {
    if (id !== null) clearTimeout(id);
  },
}));

import { Controls } from '@/hili-player/components/Controls';
import type { ControlsAPI } from '@/hili-player/components/Controls';

describe('Controls', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should render Controls component', () => {
    const vnode = h(Controls, {
      duration: 120,
      volume: 0.5,
      backrate: 1,
      config: { prev: true, next: true, viewpoint: false, quality: true, eplist: false, setting: true, pip: true, wide: true, web: true, progressViewPoints: [] },
      isEdit: false,
    });
    mount(vnode, container);
    expect(container.querySelector('.player-control-wrap')).toBeTruthy();
  });

  it('should render control entity with data-shadow-show attribute', () => {
    const vnode = h(Controls, {
      duration: 120,
      volume: 0.5,
      backrate: 1,
      config: { prev: true, next: true, viewpoint: false, quality: true, eplist: false, setting: true, pip: true, wide: true, web: true, progressViewPoints: [] },
      isEdit: false,
    });
    mount(vnode, container);
    const entity = container.querySelector('.player-control-entity') as HTMLElement;
    expect(entity).toBeTruthy();
    expect(entity.getAttribute('data-shadow-show')).toBe('false');
  });

  it('should expose ControlsAPI via onControlsMounted callback', () => {
    let api: ControlsAPI | undefined;
    const vnode = h(Controls, {
      duration: 120,
      volume: 0.5,
      backrate: 1,
      config: { prev: true, next: true, viewpoint: false, quality: true, eplist: false, setting: true, pip: true, wide: true, web: true, progressViewPoints: [] },
      isEdit: false,
      onControlsMounted: (a: ControlsAPI) => { api = a; },
    });
    mount(vnode, container);
    expect(api).toBeDefined();
    expect(typeof api?.showControl).toBe('function');
    expect(typeof api?.hideControl).toBe('function');
    expect(typeof api?.updateVolumeDisplay).toBe('function');
    expect(typeof api?.updateMute).toBe('function');
    expect(typeof api?.updateBuffer).toBe('function');
    expect(typeof api?.updateCurrent).toBe('function');
    expect(typeof api?.initDuration).toBe('function');
  });

  it('should set data-shadow-show to true on hideControl', () => {
    let api: ControlsAPI | undefined;
    const vnode = h(Controls, {
      duration: 120,
      volume: 0.5,
      backrate: 1,
      config: { prev: true, next: true, viewpoint: false, quality: true, eplist: false, setting: true, pip: true, wide: true, web: true, progressViewPoints: [] },
      isEdit: false,
      onControlsMounted: (a: ControlsAPI) => { api = a; },
    });
    mount(vnode, container);
    api?.hideControl();
    const entity = container.querySelector('.player-control-entity') as HTMLElement;
    expect(entity.getAttribute('data-shadow-show')).toBe('true');
  });

  it('should set data-shadow-show to false on showControl', () => {
    let api: ControlsAPI | undefined;
    const vnode = h(Controls, {
      duration: 120,
      volume: 0.5,
      backrate: 1,
      config: { prev: true, next: true, viewpoint: false, quality: true, eplist: false, setting: true, pip: true, wide: true, web: true, progressViewPoints: [] },
      isEdit: false,
      onControlsMounted: (a: ControlsAPI) => { api = a; },
    });
    mount(vnode, container);
    api?.hideControl();
    api?.showControl();
    const entity = container.querySelector('.player-control-entity') as HTMLElement;
    expect(entity.getAttribute('data-shadow-show')).toBe('false');
  });

  it('should update volume display', () => {
    let api: ControlsAPI | undefined;
    const vnode = h(Controls, {
      duration: 120,
      volume: 0.5,
      backrate: 1,
      config: { prev: true, next: true, viewpoint: false, quality: true, eplist: false, setting: true, pip: true, wide: true, web: true, progressViewPoints: [] },
      isEdit: false,
      onControlsMounted: (a: ControlsAPI) => { api = a; },
    });
    mount(vnode, container);
    // updateVolumeDisplay should not throw
    expect(() => api?.updateVolumeDisplay(0.8)).not.toThrow();
  });

  it('should update mute state', () => {
    let api: ControlsAPI | undefined;
    const vnode = h(Controls, {
      duration: 120,
      volume: 0.5,
      backrate: 1,
      config: { prev: true, next: true, viewpoint: false, quality: true, eplist: false, setting: true, pip: true, wide: true, web: true, progressViewPoints: [] },
      isEdit: false,
      onControlsMounted: (a: ControlsAPI) => { api = a; },
    });
    mount(vnode, container);
    expect(() => api?.updateMute(true)).not.toThrow();
    expect(() => api?.updateMute(false)).not.toThrow();
  });
});
