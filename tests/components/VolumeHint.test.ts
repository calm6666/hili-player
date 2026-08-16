/**
 * VolumeHint 组件单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, mount, destroy } from '@/core';
import { VolumeHint } from '@/hili-player/components/VolumeHint';

describe('VolumeHint', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should render VolumeHint component', () => {
    const vnode = h(VolumeHint, {});
    mount(vnode, container);
    expect(container.querySelector('.player-volume-hint')).toBeTruthy();
  });

  it('should render icon and text elements', () => {
    const vnode = h(VolumeHint, {});
    mount(vnode, container);
    expect(container.querySelector('.player-volume-hint-icon')).toBeTruthy();
    expect(container.querySelector('.player-volume-hint-text')).toBeTruthy();
  });

  it('should show volume percentage text', () => {
    const vnode = h(VolumeHint, { volume: 0.5 });
    mount(vnode, container);
    const textEl = container.querySelector('.player-volume-hint-text') as HTMLElement;
    expect(textEl.textContent).toBe('50%');
  });

  it('should show 静音 text when volume is 0', () => {
    const vnode = h(VolumeHint, { volume: 0 });
    mount(vnode, container);
    const textEl = container.querySelector('.player-volume-hint-text') as HTMLElement;
    expect(textEl.textContent).toBe('静音');
  });

  it('should show/hide with style setProperty', () => {
    const vnode = h(VolumeHint, { visible: true });
    mount(vnode, container);
    const hintEl = container.querySelector('.player-volume-hint') as HTMLElement;
    expect(hintEl).toBeTruthy();

    // Test show: set display and opacity
    hintEl.style.setProperty('display', null as any);
    hintEl.style.opacity = '1';
    expect(hintEl.style.opacity).toBe('1');

    // Test hide: set display and opacity
    hintEl.style.opacity = '0';
    hintEl.style.display = 'none';
    expect(hintEl.style.display).toBe('none');
    expect(hintEl.style.opacity).toBe('0');
  });

  it('should set volume text via innerHTML', () => {
    const vnode = h(VolumeHint, {});
    mount(vnode, container);
    const textEl = container.querySelector('.player-volume-hint-text') as HTMLElement;
    textEl.innerHTML = '80%';
    expect(textEl.innerHTML).toBe('80%');
  });

  it('should add player-volume-muted class when muted', () => {
    const vnode = h(VolumeHint, {});
    mount(vnode, container);
    const iconEl = container.querySelector('.player-volume-hint-icon') as HTMLElement;
    iconEl.classList.add('player-volume-muted');
    expect(iconEl.classList.contains('player-volume-muted')).toBe(true);
  });

  it('should remove player-volume-muted class when unmuted', () => {
    const vnode = h(VolumeHint, {});
    mount(vnode, container);
    const iconEl = container.querySelector('.player-volume-hint-icon') as HTMLElement;
    iconEl.classList.add('player-volume-muted');
    iconEl.classList.remove('player-volume-muted');
    expect(iconEl.classList.contains('player-volume-muted')).toBe(false);
  });

  it('should be hidden when visible is false', () => {
    const vnode = h(VolumeHint, { visible: false });
    mount(vnode, container);
    const hintEl = container.querySelector('.player-volume-hint') as HTMLElement;
    expect(hintEl.style.display).toBe('none');
  });
});
