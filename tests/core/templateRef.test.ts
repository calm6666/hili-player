import { describe, it, expect } from 'vitest';
import {
  h,
  mount,
  destroy,
  defineComponent,
  ref,
  useTemplateRef,
  signal,
} from '@/core';
import type { Signal } from '@/core';

/**
 * useTemplateRef（Vue 3.5 风格）测试
 *
 * 覆盖：
 * - 字符串 key 绑定 DOM（useTemplateRef + ref: 'key'）
 * - Signal 直接作为 ref 绑定
 * - 销毁时自动清空（Signal → null，无悬挂引用）
 * - 旧 {current} 对象 ref / 回调 ref 向后兼容
 * - 组件 ref：字符串 key / Signal（拿到子组件 expose 的 API）
 */
describe('useTemplateRef（Vue 3.5 风格模板引用）', () => {
  it('字符串 key 绑定 DOM 元素', () => {
    const Comp = defineComponent((_props, lc) => {
      const divRef = useTemplateRef<HTMLDivElement>(lc, 'box');
      lc.onMounted = () => {
        divRef.value?.classList.add('bound');
      };
      return h('div', { class: 'box', ref: 'box' }, '内容');
    });

    const container = document.createElement('div');
    mount(h(Comp, {}), container);

    const el = container.querySelector('.box')!;
    expect(el.classList.contains('bound')).toBe(true);
  });

  it('Signal 直接作为 ref 绑定（无需字符串）', () => {
    const elRef = signal<HTMLDivElement | null>(null);
    const vnode = h('div', { class: 'x', ref: elRef }, 'hello');
    const container = document.createElement('div');
    mount(vnode, container);

    expect(elRef.value).toBe(container.querySelector('.x'));
  });

  it('销毁时自动清空模板引用 Signal（无悬挂引用）', () => {
    let boxRef: Signal<HTMLDivElement | null> | undefined;

    const Comp = defineComponent((_props, lc) => {
      boxRef = useTemplateRef<HTMLDivElement>(lc, 'box');
      return h('div', { class: 'box', ref: 'box' });
    });

    const container = document.createElement('div');
    const vnode = h(Comp, {});
    mount(vnode, container);

    expect(boxRef!.value).toBe(container.querySelector('.box'));

    destroy(vnode);
    expect(boxRef!.value).toBeNull();
  });

  it('旧 {current} 对象 ref 向后兼容', () => {
    const legacyRef = ref<HTMLDivElement>();
    const vnode = h('div', { class: 'legacy', ref: legacyRef });
    const container = document.createElement('div');
    mount(vnode, container);

    expect(legacyRef.current).toBe(container.querySelector('.legacy'));

    destroy(vnode);
    expect(legacyRef.current).toBeNull();
  });

  it('回调 ref 向后兼容', () => {
    let boundEl: Element | null = null;
    const vnode = h('div', { class: 'cb', ref: (el) => { boundEl = el; } });
    const container = document.createElement('div');
    mount(vnode, container);

    expect(boundEl).toBe(container.querySelector('.cb'));
  });

  it('组件 ref：字符串 key 拿到子组件 expose 的 API', () => {
    const Child = defineComponent<Record<string, never>, { focus(): void }>(
      (_props, lc) => {
        lc.expose?.({ focus: () => { /* noop */ } });
        return h('div', { class: 'child' });
      },
    );

    let childApi: Signal<{ focus(): void } | null> | undefined;

    const Parent = defineComponent((_props, lc) => {
      childApi = useTemplateRef<never>(lc, 'child') as unknown as Signal<{ focus(): void } | null>;
      return h('div', {}, h(Child, { ref: 'child' }));
    });

    const container = document.createElement('div');
    mount(h(Parent, {}), container);

    expect(childApi!.value).toHaveProperty('focus');
  });

  it('组件 ref：Signal 直接绑定', () => {
    const Child = defineComponent<Record<string, never>, { ping(): string }>(
      (_props, lc) => {
        lc.expose?.({ ping: () => 'pong' });
        return h('div', { class: 'child' });
      },
    );

    const childRef = signal<{ ping(): string } | null>(null);
    const Parent = defineComponent(() => {
      return h('div', {}, h(Child, { ref: childRef }));
    });

    const container = document.createElement('div');
    mount(h(Parent, {}), container);

    expect(childRef.value?.ping()).toBe('pong');
  });
});
