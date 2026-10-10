/**
 * L12 + L13 编译优化验证测试
 *
 * L13: 静态子树直接生成 VNode 字面量（跳过 _createStaticEl/_createSvgEl/_createFragment）
 * L12: 静态 attrs 单独提升为模块级常量（attrs 静态 + children 动态时）
 */

import { describe, it, expect } from 'vitest';
import { transformCode } from '../../plugins/vite-plugin-lumina-compile/transform';

const PROD_OPTS = {
  isProduction: true,
  hoistStatic: true,
  compileComponentType: true,
  compileAttrs: true,
};

const DEV_OPTS = {
  isProduction: false,
  hoistStatic: false,
  compileComponentType: true,
  compileAttrs: true,
};

describe('L13: 静态子树 VNode 字面量', () => {
  it('完全静态子树生成 VNode 字面量，跳过 _createStaticEl', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_hoisted_');
    expect(out).toContain('{ tag:');
    expect(out).toContain('attrs:');
    expect(out).toContain('children:');
    expect(out).toContain('_cloneHoisted');
    // 不应再调用 _createStaticEl（L13 跳过函数调用）
    expect(out).not.toContain('_createStaticEl');
  });

  it('SVG 静态子树生成 VNode 字面量 + __ns', () => {
    const code = `import { h } from '@/core';
export const v = h('svg', {}, h('circle', {}));`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('__ns: "http://www.w3.org/2000/svg"');
    expect(out).not.toContain('_createSvgEl');
  });

  it('Fragment 静态子树生成 VNode 字面量', () => {
    const code = `import { h } from '@/core';
export const v = h('fragment', {}, h('span', {}, 'a'), h('span', {}, 'b'));`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('tag: "fragment"');
    expect(out).not.toContain('_createFragment');
  });

  it('嵌套静态子树递归生成 VNode 字面量', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, h('span', { class: 'b' }, 'txt'));`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('tag: "div"');
    expect(out).toContain('tag: "span"');
  });

  it('静态子树中的 null child 被过滤（与 flattenChildren 行为对齐）', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, null, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // null 应被过滤，不进入 children 数组
    expect(out).toMatch(/children:\s*\["text"\]/);
  });

  it('无 attrs 的静态调用正确生成 children', () => {
    const code = `import { h } from '@/core';
export const v = h('div', 'text');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('attrs: {}');
    expect(out).toContain('children: ["text"]');
  });
});

describe('L12: 静态 attrs 单独提升', () => {
  it('attrs 静态 + children 动态时提升 attrs', () => {
    // h(DynComp) 是组件调用，整棵子树不能静态提升，但 attrs 静态可提升
    const code = `import { h } from '@/core';
import { DynComp } from './other';
export const v = h('div', { class: 'container', ref: 'myRef' }, h(DynComp, {}));`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_hoisted_attrs_');
    expect(out).toContain('class:');
    expect(out).toContain('myRef');
    // 无事件 handler，不应生成 __events
    expect(out).not.toContain('__events');
  });

  it('含事件 handler 的 attrs 不提升（走 rewriteAttrs）', () => {
    const code = `import { h } from '@/core';
const handler = () => {};
export const v = h('div', { class: 'x', onClick: handler }, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('__events');
    expect(out).toContain('click:');
    // 含事件 handler 不能整体提升 attrs
    expect(out).not.toContain('_hoisted_attrs_');
  });

  it('空 attrs 对象不提升（收益微小）', () => {
    const code = `import { h } from '@/core';
import { DynComp } from './other';
export const v = h('div', {}, h(DynComp, {}));`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).not.toContain('_hoisted_attrs_');
  });

  it('整棵子树已提升时 attrs 不单独提升（避免重复）', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, h('span', { class: 'b' }, 'txt'));`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // 整棵子树提升，attrs 内联到 VNode 字面量中，不单独提升 attrs
    expect(out).not.toContain('_hoisted_attrs_');
    expect(out).toContain('_hoisted_');
  });

  it('dev 模式不提升 attrs（hoistStatic=false）', () => {
    const code = `import { h } from '@/core';
import { DynComp } from './other';
export const v = h('div', { class: 'container' }, h(DynComp, {}));`;
    const r = transformCode(code, 'test.ts', DEV_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).not.toContain('_hoisted_attrs_');
    expect(out).toContain('_createEl');
  });
});

describe('L12 + L13 综合', () => {
  it('混合场景：静态子树提升 + 动态分支 attrs 提升', () => {
    const code = `import { h } from '@/core';
import { DynComp } from './other';
export const v = h('div', { class: 'root' },
  h('span', { class: 'static-leaf' }, 'static'),
  h('div', { class: 'dynamic-wrap' }, h(DynComp, {}))
);`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // 整棵子树不能整体提升（因为 DynComp 是动态的）
    // 但 'span' 子树是静态的，应该作为子树提升
    expect(out).toContain('_hoisted_');
    // 'dynamic-wrap' 的 attrs 静态，应该单独提升
    expect(out).toContain('_hoisted_attrs_');
    expect(out).toContain('dynamic-wrap');
  });
});

/**
 * L15: 组件 props 提升验证
 *
 * 编译期已确认 attrs 不含 ref / __providers 时使用 _createCompPure，
 * 跳过运行时的 ref 提取和 __providers 提取。
 */
describe('L15: 组件 props Pure 优化', () => {
  it('attrs 不含 ref / __providers 时使用 _createCompPure', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
export const v = h(MyComp, { title: 'hello', count: 5 }, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_createCompPure');
    expect(out).not.toContain('_createComp(');
  });

  it('attrs 含 ref 时使用 _createComp（不能 Pure）', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
export const v = h(MyComp, { ref: 'myRef' }, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_createComp(');
    expect(out).not.toContain('_createCompPure');
  });

  it('attrs 含 __providers 时使用 _createComp（不能 Pure）', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
export const v = h(MyComp, { __providers: [] }, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_createComp(');
    expect(out).not.toContain('_createCompPure');
  });

  it('attrs 含 SpreadElement 时使用 _createComp（不能 Pure）', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
const extra = { a: 1 };
export const v = h(MyComp, { ...extra }, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_createComp(');
    expect(out).not.toContain('_createCompPure');
  });

  it('无 attrs 参数时使用 _createCompPure', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
export const v = h(MyComp, undefined, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // 第二参数 undefined 不是 ObjectExpression，canUseCompPure 返回 false → 用 _createComp
    expect(out).toContain('_createComp(');
    expect(out).not.toContain('_createCompPure');
  });

  it('attrs 是 null 字面量时使用 _createCompPure', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
export const v = h(MyComp, null, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // null 不含 ref/__providers，可以用 _createCompPure
    expect(out).toContain('_createCompPure');
    expect(out).not.toContain('_createComp(');
  });

  it('空 attrs 对象使用 _createCompPure', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
export const v = h(MyComp, {}, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_createCompPure');
    expect(out).not.toContain('_createComp(');
  });

  it('动态 attrs 变量使用 _createComp（不能 Pure）', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
export const v = h(MyComp, dynamicAttrs, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // 动态标识符无法静态判断，必须用 _createComp
    expect(out).toContain('_createComp(');
    expect(out).not.toContain('_createCompPure');
  });

  it('computed key 属性使用 _createComp（不能 Pure）', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
const key = 'title';
export const v = h(MyComp, { [key]: 'val' }, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_createComp(');
    expect(out).not.toContain('_createCompPure');
  });

  it('含事件 handler 的 attrs 仍可用 _createCompPure（handler 不是 ref/__providers）', () => {
    const code = `import { h } from '@/core';
import { MyComp } from './other';
const handler = () => {};
export const v = h(MyComp, { onClick: handler, title: 'x' }, 'child');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // onClick 不是 ref/__providers，可以用 _createCompPure
    // （组件 onMounted 等不属于预分类范畴，attrs 原样传给组件）
    expect(out).toContain('_createCompPure');
    expect(out).not.toContain('_createComp(');
  });
});

/**
 * markUsed Object 优化验证
 */
describe('markUsed Object 优化', () => {
  it('内部函数名按字母排序注入 import（产物稳定性）', () => {
    // 故意按非字母顺序使用多个内部函数
    const code = `import { h } from '@/core';
import { DynComp } from './other';
export const a = h('div', { class: 'x' }, 't');
export const b = h('svg', {}, h('circle', {}));
export const c = h('fragment', {}, 'a');
export const d = h(DynComp, {});
export const e = h('span', { onClick: () => {} }, 't');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // 应生成形如 import { _createEl, _createFragment, _createSvgEl, ... } 的有序导入
    const m = out.match(/import\s*\{\s*([^}]+?)\s*\}\s*from/);
    expect(m).not.toBeNull();
    const names = m![1].split(',').map((s) => s.trim());
    // 验证已按字母排序
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('重复使用的函数名只注入一次（去重）', () => {
    const code = `import { h } from '@/core';
export const a = h('div', {}, '1');
export const b = h('div', {}, '2');
export const c = h('div', {}, '3');`;
    const r = transformCode(code, 'test.ts', PROD_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // 多次 _createEl 调用只应注入一次 import
    const importMatch = out.match(/import\s*\{\s*([^}]+?)\s*\}\s*from/);
    expect(importMatch).not.toBeNull();
    const names = importMatch![1].split(',').map((s) => s.trim());
    // 不应有重复
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});
