/**
 * mount/destroy 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, defineComponent } from '@/core/h';
import { mount, destroy, materialize, invokeLifecycle } from '@/core/mount';
import type { VNode, ComponentLifecycle } from '@/types';

describe('mount()', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should mount a simple VNode to container', () => {
    const vnode = h('div', { class: 'test' }, 'Hello');
    mount(vnode, container);
    expect(container.querySelector('.test')?.textContent).toBe('Hello');
  });

  it('should mount a text string to container', () => {
    mount('Hello World', container);
    expect(container.textContent).toBe('Hello World');
  });

  it('should mount nested VNodes', () => {
    const vnode = h('div', { class: 'parent' },
      h('span', { class: 'child' }, 'content')
    );
    mount(vnode, container);
    expect(container.querySelector('.parent .child')?.textContent).toBe('content');
  });

  it('should mount with component', () => {
    const Comp = defineComponent<{ msg: string }>((props) => h('div', {}, props.msg));
    const vnode = h(Comp, { msg: 'Component Content' });
    mount(vnode, container);
    expect(container.textContent).toBe('Component Content');
  });

  it('should invoke onMounted lifecycle', () => {
    const mounted = vi.fn();
    const Comp = defineComponent((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.onMounted = mounted;
      return h('div');
    });
    const vnode = h(Comp, {});
    mount(vnode, container);
    expect(mounted).toHaveBeenCalled();
  });

  it('should apply event listeners', () => {
    const handler = vi.fn();
    const vnode = h('button', { onClick: handler }, 'Click');
    mount(vnode, container);
    const button = container.querySelector('button')!;
    button.click();
    expect(handler).toHaveBeenCalled();
  });

  it('should apply className prop', () => {
    const vnode = h('div', { className: 'my-class' });
    mount(vnode, container);
    expect(container.querySelector('.my-class')).toBeTruthy();
  });

  it('should apply style object', () => {
    const vnode = h('div', { style: { color: 'red', fontSize: '16px' } });
    mount(vnode, container);
    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.color).toBe('red');
  });

  it('should apply ref callback', () => {
    const refEl = { current: null as HTMLElement | null };
    const vnode = h('div', { ref: (el: HTMLElement) => { refEl.current = el; } });
    mount(vnode, container);
    expect(refEl.current).toBeTruthy();
  });

  it('should apply ref object', () => {
    const refEl = { current: null as HTMLElement | null };
    const vnode = h('div', { ref: refEl });
    mount(vnode, container);
    expect(refEl.current).toBeTruthy();
  });
});

describe('destroy()', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should remove DOM element from container', () => {
    const vnode = h('div', { class: 'removable' }, 'Content');
    mount(vnode, container);
    expect(container.querySelector('.removable')).toBeTruthy();
    destroy(vnode);
    expect(container.querySelector('.removable')).toBeFalsy();
  });

  it('should invoke onBeforeDestroy lifecycle', () => {
    const beforeDestroy = vi.fn();
    const Comp = defineComponent((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.onBeforeDestroy = beforeDestroy;
      return h('div');
    });
    const vnode = h(Comp, {});
    mount(vnode, container);
    destroy(vnode);
    expect(beforeDestroy).toHaveBeenCalled();
  });

  it('should invoke onDestroyed lifecycle', () => {
    const onDestroyed = vi.fn();
    const Comp = defineComponent((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.onDestroyed = onDestroyed;
      return h('div');
    });
    const vnode = h(Comp, {});
    mount(vnode, container);
    destroy(vnode);
    expect(onDestroyed).toHaveBeenCalled();
  });

  it('should clean up event listeners', () => {
    const handler = vi.fn();
    const vnode = h('button', { onClick: handler }, 'Click');
    mount(vnode, container);
    const button = container.querySelector('button')!;
    destroy(vnode);
    button.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle string vnode gracefully', () => {
    expect(() => destroy('text')).not.toThrow();
  });

  it('should destroy nested VNodes recursively', () => {
    const childDestroy = vi.fn();
    const ChildComp = defineComponent((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.onBeforeDestroy = childDestroy;
      return h('span');
    });
    const vnode = h('div', {}, h(ChildComp, {}));
    mount(vnode, container);
    destroy(vnode);
    expect(childDestroy).toHaveBeenCalled();
  });
});

describe('materialize()', () => {
  it('should create text node from string', () => {
    const node = materialize('Hello');
    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.textContent).toBe('Hello');
  });

  it('should create element from VNode', () => {
    const vnode = h('div', { class: 'test' });
    const node = materialize(vnode);
    expect(node.nodeType).toBe(Node.ELEMENT_NODE);
    expect((node as HTMLElement).className).toBe('test');
  });

  it('should set el reference on VNode', () => {
    const vnode = h('div');
    materialize(vnode);
    expect(vnode.el).toBeTruthy();
  });
});

describe('invokeLifecycle()', () => {
  it('should call lifecycle method on VNode', () => {
    const callback = vi.fn();
    const vnode: VNode = {
      tag: 'div',
      attrs: {},
      children: [],
      lifecycle: { onMounted: callback },
    };
    invokeLifecycle(vnode, 'onMounted');
    expect(callback).toHaveBeenCalled();
  });

  it('should skip string vnode', () => {
    expect(() => invokeLifecycle('text', 'onMounted')).not.toThrow();
  });

  it('should handle vnode without lifecycle', () => {
    const vnode: VNode = { tag: 'div', attrs: {}, children: [] };
    expect(() => invokeLifecycle(vnode, 'onMounted')).not.toThrow();
  });
});
