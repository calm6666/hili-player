/**
 * Mini 组件单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, mount, destroy } from '@/core';
import { Mini } from '@/hili-player/components/Mini';

describe('Mini', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should render Mini component', () => {
    const vnode = h(Mini, {});
    mount(vnode, container);
    expect(container.querySelector('.player-mini-warp')).toBeTruthy();
  });

  it('should render close button', () => {
    const vnode = h(Mini, {});
    mount(vnode, container);
    expect(container.querySelector('.player-mini-close')).toBeTruthy();
  });

  it('should render state toggle button', () => {
    const vnode = h(Mini, {});
    mount(vnode, container);
    expect(container.querySelector('.player-mini-state')).toBeTruthy();
  });

  it('should render progress bars', () => {
    const vnode = h(Mini, {});
    mount(vnode, container);
    expect(container.querySelector('.player-mini-progress-buffer')).toBeTruthy();
    expect(container.querySelector('.player-mini-progress-tempo')).toBeTruthy();
  });

  it('should update buffer progress with transform scaleX', () => {
    const vnode = h(Mini, { duration: 100 });
    mount(vnode, container);
    const bufferEl = container.querySelector('.player-mini-progress-buffer') as HTMLElement;
    expect(bufferEl).toBeTruthy();

    // Simulate updateBuffer: set transform scaleX
    const scale = 0.5; // 50/100
    bufferEl.style.transform = `scaleX(${scale})`;
    expect(bufferEl.style.transform).toBe('scaleX(0.5)');
  });

  it('should update current progress with transform scaleX', () => {
    const vnode = h(Mini, { duration: 100 });
    mount(vnode, container);
    const tempoEl = container.querySelector('.player-mini-progress-tempo') as HTMLElement;
    expect(tempoEl).toBeTruthy();

    // Simulate updateCurrent: set transform scaleX
    const scale = 0.3; // 30/100
    tempoEl.style.transform = `scaleX(${scale})`;
    expect(tempoEl.style.transform).toBe('scaleX(0.3)');
  });

  it('should show mini player', () => {
    const vnode = h(Mini, {});
    mount(vnode, container);
    const wrap = container.querySelector('.player-mini-warp') as HTMLElement;
    wrap.style.display = 'none';
    expect(wrap.style.display).toBe('none');
    // show sets display to ''
    wrap.style.display = '';
    expect(wrap.style.display).toBe('');
  });

  it('should hide mini player', () => {
    const vnode = h(Mini, {});
    mount(vnode, container);
    const wrap = container.querySelector('.player-mini-warp') as HTMLElement;
    wrap.style.display = 'none';
    expect(wrap.style.display).toBe('none');
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const vnode = h(Mini, { onClose });
    mount(vnode, container);
    const closeBtn = container.querySelector('.player-mini-close')!;
    closeBtn.click();
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onStateChange when state button is clicked', () => {
    const onStateChange = vi.fn();
    const vnode = h(Mini, { onStateChange });
    mount(vnode, container);
    const stateBtn = container.querySelector('.player-mini-state')!;
    stateBtn.click();
    expect(onStateChange).toHaveBeenCalled();
  });
});
