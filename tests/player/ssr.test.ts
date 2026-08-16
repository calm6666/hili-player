import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, renderToString, hydrate, ref } from '@/core';

describe('SSR Full Flow', () => {
  it('should render player skeleton to HTML string', () => {
    const vnode = h('div', {
      class: 'player-docker player-docker-major',
      'data-injector': 'nano',
    },
      h('div', {
        class: 'player-container state-paused state-no-cursor',
        'data-screen': 'normal',
        'data-ctrl-hidden': 'false',
      },
        h('div', { class: 'player-primary-area' },
          h('div', { class: 'player-video-area' },
            h('div', { class: 'player-video-perch' },
              h('div', { class: 'player-video-wrap' })
            ),
            h('div', { class: 'player-video-poster', hidden: true })
          )
        )
      )
    );

    const html = renderToString(vnode);

    expect(html).toContain('player-docker');
    expect(html).toContain('player-container');
    expect(html).toContain('state-paused');
    expect(html).toContain('player-video-wrap');
    expect(html).toContain('data-screen="normal"');
    expect(html).toContain('data-ctrl-hidden="false"');
    expect(html).toContain('hidden');
    expect(html).not.toContain('<video'); // SSR skeleton should not have video element
  });

  it('should hydrate SSR-rendered player skeleton', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      h('div', { class: 'player-container' },
        h('div', { class: 'player-video-wrap' })
      )
    );

    const wrapRef = ref<HTMLDivElement>();
    const vnode = h('div', { class: 'player-container', ref: wrapRef },
      h('div', { class: 'player-video-wrap' })
    );

    hydrate(vnode, container);

    expect(wrapRef.current).toBe(container.firstChild);
    expect(container.querySelector('.player-video-wrap')).toBeTruthy();
  });

  it('should render and hydrate component with events', () => {
    const handler = vi.fn();

    // SSR: render to string
    const vnode = h('button', { class: 'play-btn', onClick: handler }, 'Play');
    const html = renderToString(vnode);
    expect(html).toBe('<button class="play-btn">Play</button>');
    expect(html).not.toContain('onClick'); // Events should not be in SSR output

    // Client: hydrate
    const container = document.createElement('div');
    container.innerHTML = html;
    hydrate(vnode, container);

    const button = container.querySelector('button')!;
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should preserve data attributes through SSR + hydration', () => {
    const vnode = h('div', {
      class: 'player-container',
      'data-screen': 'full',
      'data-ctrl-hidden': 'true',
      'aria-label': 'Video Player',
    });

    const html = renderToString(vnode);
    expect(html).toContain('data-screen="full"');
    expect(html).toContain('data-ctrl-hidden="true"');
    expect(html).toContain('aria-label="Video Player"');

    // Hydrate and verify
    const container = document.createElement('div');
    container.innerHTML = html;
    const divRef = ref<HTMLDivElement>();

    const hydrateVnode = h('div', {
      class: 'player-container',
      'data-screen': 'full',
      'data-ctrl-hidden': 'true',
      'aria-label': 'Video Player',
      ref: divRef,
    });

    hydrate(hydrateVnode, container);

    expect(divRef.current?.getAttribute('data-screen')).toBe('full');
    expect(divRef.current?.getAttribute('data-ctrl-hidden')).toBe('true');
    expect(divRef.current?.getAttribute('aria-label')).toBe('Video Player');
  });
});
