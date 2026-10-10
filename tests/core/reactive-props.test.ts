/**
 * 组件 props 响应式（props 惰性代理）回归测试
 *
 * 框架能力验证：h() / _createComp / SSR 调用组件前检测 props 中的
 * Signal / _rp thunk，存在时包装为惰性代理——组件内部在 effect /
 * 响应式 getter 中读取 props.x 时穿透到 signal，自动建立依赖。
 *
 * 覆盖场景：
 * 1. 直接传 Signal：onEffect 内读取 → signal 变化驱动 DOM 更新
 * 2. _rp thunk（模拟编译产物 rewriteCompAttrs 的 _rp(() => expr)）
 * 3. thunk 返回 Signal 本体（模拟 h(Comp, { x: sig }) 的编译形态）
 * 4. 事件回调与函数值 props 原样透传（与 _rp 混合时不被误调用）
 * 5. 纯静态 props 直通（无代理开销路径的行为回归）
 * 6. 控制流组件豁免：Show/For/Dynamic 的 Signal/getter 本体协议不被破坏
 * 7. SSR：手工构建的组件 VNode 直连 renderComponentToString 时代理解包
 */

import { describe, it, expect } from 'vitest';
import { h, defineComponent, mount, Show, For, Dynamic, signal, onEffect } from '@/core';
import { _rp } from '@/core/internal';
import { renderToString } from '@/core/ssr';
import { transformCode } from '../../plugins/vite-plugin-lumina-compile/transform';
import type { VNode, VNodeChild } from '@/types';

/**
 * 等待 signals 的异步调度队列 flush
 * preact signals 的 effect 重跑是异步调度的，测试中修改 signal 后
 * 必须等待一个宏任务再断言 DOM 更新
 */
const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('组件 props 响应式（props 惰性代理）', () => {
  it('直接传 Signal：onEffect 内读取 props 即建立依赖，signal 变化驱动 DOM', async () => {
    const container = document.createElement('div');
    const visSig = signal<boolean>(true);

    const Child = defineComponent<{ visible: boolean }>((props, lifecycle) => {
      const box = h('div', { class: 'box' }, '');
      onEffect(lifecycle, () => {
        const el = box.el;
        if (el instanceof HTMLElement) {
          // props.visible 穿透代理读取 signal.value → effect 内建立依赖
          el.classList.toggle('state-show', props.visible);
        }
      });
      return box;
    });

    mount(h(Child, { visible: visSig }), container);

    const box = container.querySelector('.box');
    expect(box?.classList.contains('state-show')).toBe(true);

    visSig.value = false;
    await flush();
    expect(box?.classList.contains('state-show')).toBe(false);
  });

  it('_rp thunk（编译产物形态）：动态表达式惰性求值 + 响应式追踪', async () => {
    const container = document.createElement('div');
    const titleSig = signal<string>('a');

    const Child = defineComponent<{ text: string }>((props, lifecycle) => {
      const span = h('span', {}, '');
      onEffect(lifecycle, () => {
        const el = span.el;
        if (el instanceof HTMLElement) {
          el.textContent = props.text;
        }
      });
      return span;
    });

    // 模拟 rewriteCompAttrs 的产物：{ text: _rp(() => (titleSig.value)) }
    mount(h(Child, { text: _rp(() => titleSig.value) }), container);

    expect(container.querySelector('span')?.textContent).toBe('a');

    titleSig.value = 'b';
    await flush();
    expect(container.querySelector('span')?.textContent).toBe('b');
  });

  it('thunk 返回 Signal 本体：代理二次解包（h(Comp, { x: sig }) 的编译形态）', async () => {
    const container = document.createElement('div');
    const titleSig = signal<string>('v1');

    const Child = defineComponent<{ text: string }>((props, lifecycle) => {
      const span = h('span', {}, '');
      onEffect(lifecycle, () => {
        const el = span.el;
        if (el instanceof HTMLElement) {
          el.textContent = props.text;
        }
      });
      return span;
    });

    // 模拟编译产物：标识符直接传 Signal → _rp(() => sig)，thunk 求值返回
    // Signal 本体，由 props 代理继续解包 .value
    mount(h(Child, { text: _rp(() => titleSig) }), container);

    expect(container.querySelector('span')?.textContent).toBe('v1');

    titleSig.value = 'v2';
    await flush();
    expect(container.querySelector('span')?.textContent).toBe('v2');
  });

  it('事件回调与函数值 props 原样透传，与 _rp 混合时不被误调用', () => {
    const container = document.createElement('div');
    const countSig = signal<number>(7);
    const events: string[] = [];
    /** 函数值 prop 是否收到函数本体（而非被代理调用后的返回值） */
    let renderResult = '';

    const Child = defineComponent<{
      onDone?: () => void;
      render: (item: number) => string;
      count: number;
    }>((props, lifecycle) => {
      // 函数值 prop：调用收到的本体，验证代理没有把它当 getter 调用
      renderResult = typeof props.render === 'function' ? props.render(1) : 'NOT_FN';
      lifecycle.onMounted = () => {
        props.onDone?.();
      };
      return h('div', {}, '');
    });

    mount(
      h(Child, {
        onDone: () => events.push('done'),
        render: (item: number) => `item-${item}`,
        count: _rp(() => countSig.value),
      }),
      container,
    );

    // 事件回调正常触达（emit → props.onDone）
    expect(events).toEqual(['done']);
    // 函数值 prop 是本体，可正常调用
    expect(renderResult).toBe('item-1');
  });

  it('纯静态 props 直通：setup 顶层读取当前值，行为与改造前一致', () => {
    const container = document.createElement('div');

    const Child = defineComponent<{ title: string }>((props) => {
      // setup 顶层读取 = 调用时刻的当前值（快照语义）
      return h('div', { class: 'plain' }, props.title);
    });

    mount(h(Child, { title: 'static-value' }), container);
    expect(container.querySelector('.plain')?.textContent).toBe('static-value');
  });

  it('props.children 数组经代理透传不变形', () => {
    const container = document.createElement('div');
    const visSig = signal<boolean>(true);

    const Child = defineComponent<{
      visible: boolean;
      children?: VNodeChild[];
    }>((props) => {
      // visible 为 Signal → props 走代理路径，children 数组须原样透传
      const kids: VNodeChild[] = props.children ?? [];
      return h('div', { class: 'wrapper' }, ...kids);
    });

    mount(
      h(Child, { visible: visSig }, h('span', { class: 'inner' }, 'inner-text')),
      container,
    );
    expect(container.querySelector('.inner')?.textContent).toBe('inner-text');
  });
});

describe('控制流组件豁免（props 保持原始形态）', () => {
  it('Show 的 when 直接传 Signal 本体：切换显隐仍工作', async () => {
    const container = document.createElement('div');
    const whenSig = signal<boolean>(true);

    mount(
      h(Show, { when: whenSig }, h('div', { class: 'content' }, 'c')),
      container,
    );
    expect(container.querySelector('.content')).not.toBeNull();

    whenSig.value = false;
    await flush();
    expect(container.querySelector('.content')).toBeNull();
  });

  it('For 的 each 直接传 Signal 本体：列表精准更新仍工作', async () => {
    const container = document.createElement('div');
    const listSig = signal<string[]>(['a']);

    mount(
      h(
        For,
        {
          each: listSig,
          render: (item: unknown) => h('li', {}, String(item)),
        },
      ),
      container,
    );
    expect(container.querySelectorAll('li').length).toBe(1);

    listSig.value = ['a', 'b'];
    await flush();
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  it('Dynamic 的 restProps 保留 thunk 原体：经 h() 重建后子组件仍响应', async () => {
    const container = document.createElement('div');
    const labelSig = signal<string>('L1');

    const DynChild = defineComponent<{ label: string }>((props, lifecycle) => {
      const span = h('span', {}, '');
      onEffect(lifecycle, () => {
        const el = span.el;
        if (el instanceof HTMLElement) {
          el.textContent = props.label;
        }
      });
      return span;
    });

    // Dynamic 豁免代理 → restProps.label 为 thunk 原体 →
    // initDynamic 用 h(comp, flow.props) 重建时重新检测 → 子组件获得响应式
    //（component 用 Signal 形态：直接传组件函数会被 toGetter 误判为 getter）
    mount(
      h(Dynamic, {
        component: signal(DynChild),
        label: _rp(() => labelSig.value),
      }),
      container,
    );
    expect(container.querySelector('span')?.textContent).toBe('L1');

    labelSig.value = 'L2';
    await flush();
    expect(container.querySelector('span')?.textContent).toBe('L2');
  });
});

describe('SSR 路径的 props 响应式', () => {
  it('手工构建的组件 VNode：Signal prop 在同步渲染期解包为当前值', () => {
    const titleSig = signal<string>('ssr-value');

    const Child = defineComponent<{ title: string }>((props) =>
      h('div', { class: 'ssr' }, props.title),
    );

    // 手工构建（不经 h()/_createComp 的组件调用）：直连 renderComponentToString
    const vnode: VNode = {
      tag: Child,
      attrs: { title: titleSig },
      children: [],
    };
    const html = renderToString(vnode);
    expect(html).toContain('ssr-value');
  });
});

describe('编译插件 rewriteCompAttrs（_rp 包装规则）', () => {
  /** 生产环境 + 属性编译开启（demo 已 opt-in 的配置形态） */
  const PROD_OPTS = {
    isProduction: true,
    hoistStatic: true,
    compileComponentType: true,
    compileAttrs: true,
  };

  it('动态 prop 表达式包装为 _rp thunk，事件/函数值/静态值原样透传', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
const sig = { value: true };
export const v = h(MyComp, { visible: sig.value, onDone: () => {}, render: (i) => i, title: 'x' }, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;

    // 动态表达式 → _rp thunk（括号包裹）
    expect(out).toContain('visible: _rp(() => (sig.value))');
    // 按需注入 _rp import（与 _createComp 同源）
    expect(out).toContain('_rp');
    expect(out).toContain("from '@/core/internal'");
    // 事件回调不包装
    expect(out).toContain('onDone: () => {}');
    // 函数值 prop（回调）不包装
    expect(out).toContain('render: (i) => i');
    // 静态值不包装
    expect(out).toContain("title: 'x'");
    // _rp 只出现在 visible 的包装与 import 中（onDone/render/title 均未被包装）
    expect(out.match(/_rp\(/g)?.length).toBe(1);
  });

  it('控制流组件（For/Show 等）豁免：attrs 原样透传不做 _rp 包装', () => {
    const code = `import { h, For } from '@/core';
const list = { value: [1, 2] };
export const v = h(For, { each: () => list.value, render: (item, index) => h('li', {}, String(item)) });`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;

    // 不生成任何 _rp 包装（each 是手写 getter 协议，需要函数本体）
    expect(out).not.toContain('_rp(');
    // 也不注入 _rp import
    expect(out).not.toContain('_rp,');
  });

  it('compileAttrs 关闭时不做 _rp 包装（向后兼容）', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
const sig = { value: true };
export const v = h(MyComp, { visible: sig.value }, 'child');`;
    const r = transformCode(code, 'test.ts', {
      ...PROD_OPTS,
      compileAttrs: false,
    });
    expect(r).not.toBeNull();
    expect(r!.code).not.toContain('_rp');
  });
});
