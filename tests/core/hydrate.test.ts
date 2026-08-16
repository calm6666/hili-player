import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, defineComponent, hydrate, ref } from '@/core';

describe('hydrate', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should bind ref to existing DOM element', () => {
    container.innerHTML = '<div class="test">Content</div>';
    const divRef = ref<HTMLDivElement>();

    const vnode = h('div', { class: 'test', ref: divRef }, 'Content');
    hydrate(vnode, container);

    expect(divRef.current).toBe(container.firstChild);
  });

  it('should bind event listener to existing DOM element', () => {
    container.innerHTML = '<button class="btn">Click</button>';
    const handler = vi.fn();

    const vnode = h('button', { class: 'btn', onClick: handler }, 'Click');
    hydrate(vnode, container);

    const button = container.querySelector('button')!;
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle nested elements', () => {
    container.innerHTML = '<div class="outer"><span class="inner">Hello</span></div>';
    const spanRef = ref<HTMLSpanElement>();

    const vnode = h('div', { class: 'outer' },
      h('span', { class: 'inner', ref: spanRef }, 'Hello')
    );
    hydrate(vnode, container);

    const span = container.querySelector('span')!;
    expect(spanRef.current).toBe(span);
  });

  it('should handle function components', () => {
    container.innerHTML = '<div class="component">Content</div>';
    const divRef = ref<HTMLDivElement>();

    const MyComponent = defineComponent(() => {
      return h('div', { class: 'component', ref: divRef }, 'Content');
    });

    const vnode = h(MyComponent, {});
    hydrate(vnode, container);

    expect(divRef.current).toBe(container.firstChild);
  });

  it('should not modify existing DOM structure', () => {
    container.innerHTML = '<div class="test">Content</div>';
    const originalChild = container.firstChild;

    const vnode = h('div', { class: 'test' }, 'Content');
    hydrate(vnode, container);

    expect(container.firstChild).toBe(originalChild);
    expect(container.childNodes.length).toBe(1);
  });

  it('should bind multiple refs in nested structure', () => {
    container.innerHTML = '<div class="outer"><div class="inner"></div></div>';
    const outerRef = ref<HTMLDivElement>();
    const innerRef = ref<HTMLDivElement>();

    const vnode = h('div', { class: 'outer', ref: outerRef },
      h('div', { class: 'inner', ref: innerRef })
    );
    hydrate(vnode, container);

    expect(outerRef.current).toBe(container.querySelector('.outer'));
    expect(innerRef.current).toBe(container.querySelector('.inner'));
  });

  it('should handle text children', () => {
    container.innerHTML = '<p>Hello World</p>';

    const vnode = h('p', {}, 'Hello World');
    hydrate(vnode, container);

    expect(container.textContent).toBe('Hello World');
  });
});
