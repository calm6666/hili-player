/**
 * 编译期 DOM 化阶段 1：静态子树模板化测试
 *
 * tmplStatic 开启后，静态提升目标从「VNode 常量 + _cloneHoisted 克隆」
 * 改为「HTML 字符串常量 + _tmpl() 惰性 <template> cloneNode」：
 * - mount：一次 cloneNode 替代整棵子树的 VNode 解释
 * - SSR：renderToString 直拼模板 HTML
 * - 水合：直接采用 SSR 已输出的 DOM 段
 *
 * 不适用模板的场景必须回退 VNode 提升路径（_cloneHoisted）：
 * 裸 SVG 子标签 / ref 等运行时属性 / 表格上下文根标签 /
 * fragment 顶层非元素子节点 / 属性槽误传
 */

import { describe, it, expect } from 'vitest';
import { transformCode } from '../../plugins/vite-plugin-lumina-compile/transform';

/** 生产环境 + 模板化开启（demo 已 opt-in 的配置形态） */
const PROD_TMPL_OPTS = {
  isProduction: true,
  hoistStatic: true,
  tmplStatic: true,
  compileComponentType: true,
  compileAttrs: true,
};

/** 生产环境 + 模板化关闭（默认路径：VNode 常量 + _cloneHoisted） */
const PROD_VNODE_OPTS = {
  isProduction: true,
  hoistStatic: true,
  compileComponentType: true,
  compileAttrs: true,
};

/** 开发环境 + 模板化开启（tmplStatic 激活时 dev 也执行静态提升） */
const DEV_TMPL_OPTS = {
  isProduction: false,
  hoistStatic: true,
  tmplStatic: true,
  compileComponentType: true,
  compileAttrs: true,
};

describe('tmpl: 基本模板化路径', () => {
  it('完全静态子树生成 _tmpl 工厂调用，跳过 VNode 解释', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_tmpl("<div class=\\"a\\">text</div>", 1)');
    // 按需注入 _tmpl import
    expect(out).toContain("import { _tmpl } from '@/core/internal'");
    // 不应再走 VNode 克隆路径
    expect(out).not.toContain('_cloneHoisted');
    expect(out).not.toContain('{ tag:');
  });

  it('嵌套静态子树递归拼接 HTML', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, h('span', { class: 'b' }, 'txt'));`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain(
      '_tmpl("<div class=\\"a\\"><span class=\\"b\\">txt</span></div>", 1)',
    );
  });

  it('fragment 多根模板：roots 计数 = 顶层子节点数', () => {
    const code = `import { h } from '@/core';
export const v = h('fragment', {}, h('span', {}, 'a'), h('span', {}, 'b'));`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_tmpl("<span>a</span><span>b</span>", 2)');
    expect(out).not.toContain('_cloneHoisted');
  });

  it('tmplStatic 关闭时保持 VNode 提升路径（默认行为不变）', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_VNODE_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_cloneHoisted');
    expect(out).not.toContain('_tmpl(');
    // VNode 回退路径：静态提升常量 + 使用点克隆（当前实现为 _createStaticEl 调用形态）
    expect(out).toContain('_hoisted_');
  });

  it('dev + tmplStatic 开启时同样走模板路径（dev 即验证）', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, 'text');`;
    const r = transformCode(code, 'test.ts', DEV_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_tmpl(');
    expect(out).not.toContain('_cloneHoisted');
  });

  it('falsy attrs 槽（null）按无属性模板化', () => {
    const code = `import { h } from '@/core';
export const v = h('div', null, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_tmpl("<div>text</div>", 1)');
  });
});

describe('tmpl: HTML 序列化语义（严格镜像 core/ssr.ts）', () => {
  it('class 数组 + 对象：编译期 normalizeClass', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: ['a', { b: true, c: false }] });`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // truthy 对象键名拼接，falsy 键剔除（镜像 normalizeClass）
    expect(out).toContain('_tmpl("<div class=\\"a b\\"></div>", 1)');
  });

  it('style 对象：编译期 serializeStyle（camelCase → kebab-case）', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { style: { color: 'red', marginTop: '4px' } });`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // 'prop: value;' 自闭合格式（镜像 serializeStyle）
    expect(out).toContain('_tmpl("<div style=\\"color: red; margin-top: 4px;\\"></div>", 1)');
  });

  it('布尔属性存在即输出，false 不输出（镜像 isBooleanAttr）', () => {
    const code = `import { h } from '@/core';
export const v = h('input', { type: 'checkbox', checked: true, readOnly: true, hidden: false });`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // void 元素无闭合标签；checked/readonly 布尔属性存在即可；hidden: false 剔除；
    // readOnly 走 DOM property → HTML 属性映射
    expect(out).toContain('_tmpl("<input type=\\"checkbox\\" checked readonly>", 1)');
  });

  it('非布尔属性的布尔值输出 "true"/"false"（镜像 SSR）', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { draggable: true });`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_tmpl("<div draggable=\\"true\\"></div>", 1)');
  });

  it('文本子节点 HTML 转义（镜像 escapeHtml 5 字符表）', () => {
    // 构造含 < > & " ' 的文本，转义到源码字符串字面量中
    const text = '<b>&"\'';
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const code = `import { h } from '@/core';
export const v = h('div', {}, "${escaped}");`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_tmpl("<div>&lt;b&gt;&amp;&quot;&#39;</div>", 1)');
  });

  it('null 子节点过滤（镜像 flattenChildren）', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a' }, null, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_tmpl("<div class=\\"a\\">text</div>", 1)');
  });

  it('内部字段 key 静默跳过（镜像 SKIP_ATTRS）', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { key: 'x', class: 'a' }, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_tmpl("<div class=\\"a\\">text</div>", 1)');
  });

  it('svg 根 + 嵌套图形标签模板化（SVG 命名空间由解析器建立）', () => {
    const code = `import { h } from '@/core';
export const v = h('svg', { viewBox: '0 0 24 24' }, h('path', { d: 'M0 0' }));`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain(
      '_tmpl("<svg viewBox=\\"0 0 24 24\\"><path d=\\"M0 0\\"></path></svg>", 1)',
    );
    expect(out).not.toContain('_cloneHoisted');
  });
});

describe('tmpl: 回退条件（保持 VNode 提升路径）', () => {
  it('裸 SVG 子标签回退：HTML 解析器无法建立 SVG 命名空间', () => {
    const code = `import { h } from '@/core';
export const v = h('path', { d: 'M0 0' });`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_cloneHoisted');
    expect(out).not.toContain('_tmpl(');
  });

  it('含 ref 的子树回退：ref 需要运行时 bindRef', () => {
    const code = `import { h } from '@/core';
export const v = h('div', { class: 'a', ref: 'myRef' }, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_cloneHoisted');
    expect(out).not.toContain('_tmpl(');
  });

  it('表格上下文根标签回退：<template> 解析器会丢弃这些标签', () => {
    const code = `import { h } from '@/core';
export const v = h('tr', {}, h('td', {}, 'x'));`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_cloneHoisted');
    expect(out).not.toContain('_tmpl(');
  });

  it('fragment 顶层含文本子节点回退：roots 计数无法与水合游标对齐', () => {
    const code = `import { h } from '@/core';
export const v = h('fragment', {}, 'text', h('span', {}, 'a'));`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_cloneHoisted');
    expect(out).not.toContain('_tmpl(');
  });

  it('属性槽误传子节点（h(div, "text")）回退：保持现行为', () => {
    const code = `import { h } from '@/core';
export const v = h('div', 'text');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_cloneHoisted');
    expect(out).not.toContain('_tmpl(');
  });

  it('动态子树不受影响：仍走 _createEl 解释路径', () => {
    const code = `import { h } from '@/core';
const cond = Math.random() > 0.5;
export const v = h('div', { class: cond ? 'a' : 'b' }, 'text');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('_createEl');
    expect(out).not.toContain('_tmpl(');
    expect(out).not.toContain('_cloneHoisted');
  });
});

describe('attrs 预分类：手写运行时协议字段透传', () => {
  it('手写 __reactiveAttrs 原样保留，不被二次包装为 getter 条目', () => {
    // 回归场景：plugins 包（未经编译设计的运行时协议）源码手写
    // __reactiveAttrs: { style: () => ... }，若被「动态属性」分类包装为
    // __reactiveAttrs: { '__reactiveAttrs': () => ({...}) }，运行时
    // applyReactiveAttrs 会把对象 String() 后 setAttribute 写入 DOM
    //（__reactiveattrs="[object Object]"），且响应式更新全部失效
    const code = `import { h } from '@/core';
export const v = h('span', { class: 'a', __reactiveAttrs: { style: () => 'color: red' } }, 'x');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    // 手写协议字段原样透传（键与 getter 均未被改写）
    expect(out).toContain('__reactiveAttrs: { style: () =>');
    // 不得出现「键名本身被包装为 getter 条目」的二次包装特征
    expect(out).not.toContain(`'__reactiveAttrs': () =>`);
    expect(out).not.toContain('"__reactiveAttrs": () =>');
    // 含运行时协议的子树保持 VNode 解释路径（非静态可模板化）
    expect(out).toContain('_createEl');
  });

  it('手写 __events / __ref / __providers 同样原样保留', () => {
    const code = `import { h } from '@/core';
export const v = h('span', { __events: { click: fn }, __ref: r, __providers: ps }, 'x');`;
    const r = transformCode(code, 'test.ts', PROD_TMPL_OPTS);
    expect(r).not.toBeNull();
    const out = r!.code;
    expect(out).toContain('__events: { click: fn }');
    expect(out).toContain('__ref: r');
    expect(out).toContain('__providers: ps');
  });
});
