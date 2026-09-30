import { describe, it, expect } from 'vitest';
import {
  signal,
  computed,
  effect,
  onEffect,
  mount,
  destroy,
  h,
  defineComponent,
  ref,
  createTypedStateManager,
} from '@/core';
import type { Signal, TypedStateManager } from '@/core';

/**
 * 响应式信号 + effect（基于 @preact/signals-core）集成测试
 *
 * 覆盖：
 * - signal/computed/effect 基础响应
 * - onEffect 挂载后启动、signal 变化自动更新 DOM、销毁时自动 dispose
 * - 父组件把 signal 作为 prop 传给子组件，子组件 effect 追踪响应
 */
describe('响应式信号 + effect', () => {
  it('signal + effect 基本响应与 dispose', () => {
    const s = signal(1);
    let seen = 0;
    const dispose = effect(() => {
      seen = s.value;
    });

    expect(seen).toBe(1); // effect 首次同步执行
    s.value = 2;
    expect(seen).toBe(2);

    dispose();
    s.value = 3;
    expect(seen).toBe(2); // dispose 后不再追踪
  });

  it('computed 派生值', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.value + b.value);

    let seen = 0;
    effect(() => {
      seen = sum.value;
    });
    expect(seen).toBe(5);

    a.value = 10;
    expect(seen).toBe(13);
  });

  it('onEffect 挂载后启动、signal 变化更新 DOM、销毁后清理', () => {
    const count = signal(0);
    let renders = 0;

    const Comp = defineComponent<{ count: Signal<number> }>((props, lc) => {
      const el = ref<HTMLSpanElement>();
      onEffect(lc, () => {
        renders++;
        if (el.current) el.current.textContent = String(props.count.value);
      });
      return h('span', { ref: el });
    });

    const container = document.createElement('div');
    const vnode = h(Comp, { count });
    mount(vnode, container);

    // 挂载后 effect 首次执行完成初始渲染
    expect(renders).toBe(1);
    expect(container.firstChild).not.toBeNull();
    expect(container.firstChild!.textContent).toBe('0');

    // signal 变化自动更新 DOM
    count.value = 5;
    expect(renders).toBe(2);
    expect(container.firstChild!.textContent).toBe('5');

    // 销毁后 effect 被 dispose，不再触发
    destroy(vnode);
    count.value = 99;
    expect(renders).toBe(2);
  });

  it('父组件传 signal 给子组件，子组件 effect 追踪响应', () => {
    const count = signal(0);

    const Child = defineComponent<{ count: Signal<number> }>((props, lc) => {
      const el = ref<HTMLSpanElement>();
      onEffect(lc, () => {
        if (el.current) {
          el.current.textContent = `count=${props.count.value}`;
        }
      });
      return h('span', { class: 'child', ref: el });
    });

    const Parent = defineComponent<{ count: Signal<number> }>((props) => {
      // props 引用传递、无解包，signal 对象原样传给子组件
      return h('div', { class: 'parent' }, h(Child, { count: props.count }));
    });

    const container = document.createElement('div');
    mount(h(Parent, { count }), container);

    const child = container.querySelector('.child')!;
    expect(child.textContent).toBe('count=0');

    // 父组件持有的 signal 变化 → 子组件 effect 自动响应
    count.value = 42;
    expect(child.textContent).toBe('count=42');
  });

  it('多个 effect 与用户 onMounted 共存，顺序正确', () => {
    const a = signal('a');
    const b = signal('b');
    const order: string[] = [];

    const Comp = defineComponent<{ a: Signal<string>; b: Signal<string> }>(
      (props, lc) => {
        const elA = ref<HTMLSpanElement>();
        const elB = ref<HTMLSpanElement>();
        onEffect(lc, () => {
          if (elA.current) elA.current.textContent = props.a.value;
        });
        onEffect(lc, () => {
          if (elB.current) elB.current.textContent = props.b.value;
        });
        lc.onMounted = () => {
          order.push('mounted');
        };
        return h('div', {}, h('span', { class: 'a', ref: elA }), h('span', { class: 'b', ref: elB }));
      },
    );

    const container = document.createElement('div');
    mount(h(Comp, { a, b }), container);

    expect(container.querySelector('.a')!.textContent).toBe('a');
    expect(container.querySelector('.b')!.textContent).toBe('b');
    expect(order).toEqual(['mounted']);

    a.value = 'A1';
    expect(container.querySelector('.a')!.textContent).toBe('A1');
    b.value = 'B1';
    expect(container.querySelector('.b')!.textContent).toBe('B1');
  });

  it('状态管理器与 signals 统一：state.signal(path) + onEffect', () => {
    type Map = { count: number };
    const state = createTypedStateManager<Map>({ count: 0 });

    const Comp = defineComponent<{ state: TypedStateManager<Map> }>(
      (props, lc) => {
        const el = ref<HTMLSpanElement>();
        // state.signal(path) 返回响应式 Signal，与 useState 共用同一引擎
        const countSig = props.state.signal('count');
        onEffect(lc, () => {
          if (el.current) el.current.textContent = String(countSig.value);
        });
        return h('span', { class: 'count', ref: el });
      },
    );

    const container = document.createElement('div');
    mount(h(Comp, { state }), container);

    expect(container.querySelector('.count')!.textContent).toBe('0');

    state.set('count', 42);
    expect(container.querySelector('.count')!.textContent).toBe('42');
  });
});
