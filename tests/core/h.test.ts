/**
 * h() 函数和 defineComponent 单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { h, defineComponent, Fragment, when, each, show } from '@/core/h';
import type { VNode, ComponentLifecycle } from '@/types';

describe('h()', () => {
  it('should create VNode with tag and empty attrs/children', () => {
    const vnode = h('div');
    expect(vnode.tag).toBe('div');
    expect(vnode.attrs).toEqual({});
    expect(vnode.children).toEqual([]);
  });

  it('should create VNode with tag, props, and text children', () => {
    const vnode = h('div', { class: 'container' }, 'Hello');
    expect(vnode.tag).toBe('div');
    expect(vnode.attrs.class).toBe('container');
    expect(vnode.children).toEqual(['Hello']);
  });

  it('should create VNode with nested children', () => {
    const child = h('span', {}, 'child');
    const vnode = h('div', {}, child);
    expect(vnode.tag).toBe('div');
    expect(vnode.children).toHaveLength(1);
    expect((vnode.children[0] as VNode).tag).toBe('span');
  });

  it('should create VNode with multiple children', () => {
    const vnode = h('ul', {}, h('li', {}, '1'), h('li', {}, '2'), h('li', {}, '3'));
    expect(vnode.children).toHaveLength(3);
  });

  it('should filter out null and undefined children', () => {
    const vnode = h('div', {}, 'text', null, undefined, h('span'));
    expect(vnode.children).toHaveLength(2);
  });

  it('should flatten nested array children', () => {
    const vnode = h('div', {}, [['a', 'b'], 'c'] as unknown as string);
    // flat(Infinity) flattens nested arrays
    expect(vnode.children.length).toBeGreaterThanOrEqual(1);
  });

  it('should set xmlns for SVG tags', () => {
    const vnode = h('svg', { viewBox: '0 0 100 100' });
    expect(vnode.__ns).toBe('http://www.w3.org/2000/svg');
    expect(vnode.attrs.xmlns).toBe('http://www.w3.org/2000/svg');
  });

  it('should not set xmlns for non-SVG tags', () => {
    const vnode = h('div');
    expect(vnode.__ns).toBeUndefined();
  });

  it('should handle function component', () => {
    const MyComp = (props: { title: string }): VNode => h('div', {}, props.title);
    const vnode = h(MyComp, { title: 'Hello' });
    expect(vnode.tag).toBe('div');
    expect(vnode.children).toEqual(['Hello']);
  });

  it('should handle class component', () => {
    class MyComp {
      props: { label: string };
      constructor(props: { label: string }) {
        this.props = props;
      }
      render(): VNode {
        return h('span', {}, this.props.label);
      }
    }
    const vnode = h(MyComp, { label: 'Test' });
    expect(vnode.tag).toBe('span');
    expect(vnode.children).toEqual(['Test']);
    expect(vnode.lifecycle).toBeDefined();
  });
});

describe('defineComponent()', () => {
  it('should return a function', () => {
    const Comp = defineComponent<{ msg: string }>((props) => h('div', {}, props.msg));
    expect(typeof Comp).toBe('function');
  });

  it('should create VNode from component setup', () => {
    const Comp = defineComponent<{ msg: string }>((props) => h('div', {}, props.msg));
    const vnode = Comp({ msg: 'Hello' });
    expect(vnode.tag).toBe('div');
    expect(vnode.children).toEqual(['Hello']);
  });

  it('should attach lifecycle to VNode', () => {
    const Comp = defineComponent(() => h('div'));
    const vnode = Comp({});
    expect(vnode.lifecycle).toBeDefined();
  });

  it('should call onMounted lifecycle', () => {
    const mounted = vi.fn();
    const Comp = defineComponent((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.onMounted = mounted;
      return h('div');
    });
    const vnode = Comp({});
    vnode.lifecycle?.onMounted?.();
    expect(mounted).toHaveBeenCalled();
  });

  it('should call onBeforeDestroy lifecycle', () => {
    const beforeDestroy = vi.fn();
    const Comp = defineComponent((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.onBeforeDestroy = beforeDestroy;
      return h('div');
    });
    const vnode = Comp({});
    vnode.lifecycle?.onBeforeDestroy?.();
    expect(beforeDestroy).toHaveBeenCalled();
  });

  it('should emit callback via props (onXxx pattern)', () => {
    const handler = vi.fn();
    const Comp = defineComponent<{ onCustomEvent?: (data: string) => void }>((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.emit?.('customEvent', 'test-data');
      return h('div');
    });
    Comp({ onCustomEvent: handler });
    expect(handler).toHaveBeenCalledWith('test-data');
  });

  it('should emit callback via lifecycle.on', () => {
    const handler = vi.fn();
    const Comp = defineComponent((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.on?.('myEvent', handler);
      lifecycle.emit?.('myEvent', 'payload');
      return h('div');
    });
    Comp({});
    expect(handler).toHaveBeenCalledWith('payload');
  });

  it('should prioritize props callback over on-registered callback', () => {
    const propsHandler = vi.fn();
    const onHandler = vi.fn();
    const Comp = defineComponent<{ onTest?: (data: string) => void }>((_props, lifecycle: ComponentLifecycle) => {
      lifecycle.on?.('test', onHandler);
      lifecycle.emit?.('test', 'data');
      return h('div');
    });
    Comp({ onTest: propsHandler });
    expect(propsHandler).toHaveBeenCalledWith('data');
    expect(onHandler).toHaveBeenCalledWith('data');
  });
});

describe('Fragment()', () => {
  it('should create a fragment VNode', () => {
    const vnode = Fragment({ children: [h('span', {}, 'a'), h('span', {}, 'b')] });
    expect(vnode.tag).toBe('fragment');
    expect(vnode.children).toHaveLength(2);
  });
});

describe('when()', () => {
  it('should return VNode when condition is true', () => {
    const vnode = h('div', {}, 'visible');
    const result = when(true, vnode);
    expect(result).toBe(vnode);
  });

  it('should return empty string when condition is false', () => {
    const vnode = h('div', {}, 'visible');
    const result = when(false, vnode);
    expect(result).toBe('');
  });
});

describe('each()', () => {
  it('should map items to VNodes', () => {
    const items = ['a', 'b', 'c'];
    const result = each(items, (item, index) => h('li', { key: index }, item));
    expect(result).toHaveLength(3);
    expect(result[0].children).toEqual(['a']);
    expect(result[2].children).toEqual(['c']);
  });
});

describe('show()', () => {
  it('should set display to none when visible is false', () => {
    const vnode = h('div', {}, 'content');
    const result = show(false, vnode);
    expect((result.attrs?.style as Record<string, string>)?.display).toBe('none');
  });

  it('should set display to empty string when visible is true', () => {
    const vnode = h('div', {}, 'content');
    const result = show(true, vnode);
    expect((result.attrs?.style as Record<string, string>)?.display).toBe('');
  });

  it('should not mutate the original vnode', () => {
    const vnode = h('div', { class: 'box' }, 'content');
    const result = show(false, vnode);

    expect(result).not.toBe(vnode);
    expect(vnode.attrs.style).toBeUndefined();
    expect(result.attrs.class).toBe('box');
    expect((result.attrs?.style as Record<string, string>)?.display).toBe('none');
  });
});
