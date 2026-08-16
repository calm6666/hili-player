import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { transformCode } from '../../plugins/vite-plugin-hili-compile/transform';
import { hiliCompile } from '../../plugins/vite-plugin-hili-compile';

/**
 * vite-plugin-hili-compile 转换器单测
 *
 * 覆盖：
 * - dev/prod 统一编译（插件级）
 * - 递归静态提升（嵌套静态子树整体提升 + _cloneHoisted 克隆复用）
 * - 属性预分类（onXxx → __events、ref → __ref）
 * - Fragment 两种写法（字符串形式 / h(Fragment, ...) 形式，丢弃 attrs）
 * - 组件调用与 __hili_type 标记（含 export default 改写）
 * - binding 校验：不误伤其他库的 h（如 preact），支持别名导入
 * - 按需注入内部函数 import
 */

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

function run(code: string, opts = PROD_OPTS): string | null {
  return transformCode(code, 'test.ts', opts)?.code ?? null;
}

/** 构造一个模拟 serve 环境的插件实例（调用 configResolved 注入环境） */
function pluginInServe(devDefault = true): Plugin {
  const plugin = hiliCompile(devDefault ? undefined : { dev: false });
  // vite 的插件钩子是 ObjectHook：函数或 { handler } 对象，需规范化后再调用
  const hook = plugin.configResolved;
  const fn = typeof hook === 'function' ? hook : hook?.handler;
  fn?.call(undefined, {
    command: 'serve',
    isProduction: false,
  } as ResolvedConfig);
  return plugin;
}

/** 规范化 vite 插件 transform 钩子（ObjectHook）为无 this 的普通函数 */
function transformOf(plugin: Plugin): (code: string, id: string) => unknown {
  const hook = plugin.transform;
  const fn = typeof hook === 'function' ? hook : hook?.handler;
  // vite 的 transform 钩子绑定 TransformPluginContext，测试中无需真实上下文，
  // 转为无 this 的普通函数后调用
  return (code: string, id: string): unknown =>
    fn ? (fn as unknown as (code: string, id: string) => unknown)(code, id) : null;
}

describe('hili-compile: dev/prod 统一编译（Vue/Solid 模式）', () => {
  const code = `import { h } from '@/core';\nexport const A = () => h('div', { onClick: fn }, 'x');`;

  it('dev 模式默认也执行转换', () => {
    const plugin = pluginInServe();
    const result = transformOf(plugin)(code, '/src/comp.ts') as { code: string } | null;
    expect(result).not.toBeNull();
    expect(result!.code).toContain('_createEl');
  });

  it('dev: false 时开发模式跳过转换（旧行为）', () => {
    const plugin = pluginInServe(false);
    const result = transformOf(plugin)(code, '/src/comp.ts');
    expect(result).toBeNull();
  });
});

describe('hili-compile: 静态提升（递归子树）', () => {
  it('整棵嵌套静态子树提升为模块级常量，使用点克隆复用', () => {
    const code = run(
      `import { h } from '@/core';\nconst v = () => h('div', { class: 'a' }, h('span', { class: 'b' }, 'text'));`,
    );
    expect(code).toContain(
      `const _hoisted_1 = _createStaticEl("div", { class: "a" }, _createStaticEl("span", { class: "b" }, "text"));`,
    );
    expect(code).toContain('_cloneHoisted(_hoisted_1)');
    // import 按需注入且包含克隆函数
    expect(code).toContain(
      "import { _cloneHoisted, _createStaticEl } from '@/core/internal';",
    );
  });

  it('dev 模式不提升，但仍执行转换（与 Vue plugin-vue 一致）', () => {
    const code = run(
      `import { h } from '@/core';\nconst v = () => h('div', { class: 'a' }, 'text');`,
      DEV_OPTS,
    );
    expect(code).toContain("_createEl('div', { class: 'a' }, 'text')");
    expect(code).not.toContain('_hoisted_');
  });

  it('静态子树含动态兄弟时不提升外层，仅提升静态子树', () => {
    const code = run(
      `import { h } from '@/core';\nconst v = (cls) => h('div', { class: cls }, h('span', { class: 's' }, 'x'));`,
    );
    // 外层动态 → _createEl；内层静态 → 提升
    expect(code).toContain("_createEl('div', { class: cls }");
    expect(code).toContain('_cloneHoisted(_hoisted_1)');
  });
});

describe('hili-compile: 属性预分类与元素转换', () => {
  it('onXxx 提取为 __events，ref 重命名为 __ref', () => {
    const code = run(
      `import { h } from '@/core';\nconst v = () => h('input', { class: 'i', value: val, onInput: fn, ref: r });`,
    );
    expect(code).toContain(
      `_createEl('input', { class: 'i', value: val, __ref: r, __events: { input: fn } })`,
    );
  });

  it('SVG 标签转换为 _createSvgEl（嵌套也转换）', () => {
    const code = run(
      `import { h } from '@/core';\nconst v = () => h('svg', { viewBox: '0 0 1 1' }, h('circle', { r: 1 }));`,
    );
    expect(code).toContain(
      `const _hoisted_1 = _createSvgEl("svg", { viewBox: "0 0 1 1" }, _createSvgEl("circle", { r: 1 }));`,
    );
  });

  it('attrs 参数内的 h() 调用不转换（不是子节点）', () => {
    const code = run(
      `import { h } from '@/core';\nconst v = () => h('div', { title: h('span', {}, 'x') });`,
    );
    expect(code).toContain(`_createEl('div', { title: h('span', {}, 'x') })`);
  });

  it('按需注入 import：只注入实际使用的内部函数', () => {
    const code = run(
      `import { h } from '@/core';\nconst v = () => h('div', { onClick: fn }, 'x');`,
    );
    expect(code).toContain("import { _createEl } from '@/core/internal';");
    expect(code).not.toContain('_createStaticEl');
    expect(code).not.toContain('_cloneHoisted');
  });
});

describe('hili-compile: Fragment', () => {
  it('字符串形式丢弃 attrs 参数（不把 {} 当子节点）', () => {
    const code = run(
      `import { h } from '@/core';\nconst v = (child) => h('fragment', {}, child);`,
    );
    expect(code).toContain('_createFragment(child)');
    expect(code).not.toContain('_createFragment({');
  });

  it('h(Fragment, {}, ...) 组件形式同样优化', () => {
    const code = run(
      `import { h, Fragment } from '@/core';\nconst v = () => h(Fragment, {}, h('div', {}, 'A'));`,
    );
    expect(code).toContain('_createFragment(_cloneHoisted(_hoisted_1))');
  });
});

describe('hili-compile: 组件类型标记', () => {
  it('const MyComp = defineComponent(...) 注入 __hili_type = fn', () => {
    const code = run(
      `import { h, defineComponent } from '@/core';\nconst MyComp = defineComponent(() => h('div', {}, 'x'));`,
    );
    expect(code).toContain(`MyComp.__hili_type = 'fn'`);
  });

  it('export default defineComponent(...) 改写为临时变量并标记', () => {
    const code = run(
      `import { defineComponent } from '@/core';\nexport default defineComponent(() => h('div', {}, 'x'));`,
    );
    expect(code).toContain(`_defaultComponent_1.__hili_type = 'fn'`);
    expect(code).toContain('export default _defaultComponent_1');
  });

  it('class extends Component 注入 __hili_type = class', () => {
    const code = run(
      `import { Component } from '@/core';\nclass Foo extends Component { render() { return 'x'; } }`,
    );
    expect(code).toContain(`Foo.__hili_type = 'class'`);
  });
});

describe('hili-compile: binding 校验（不误伤其他库）', () => {
  it('preact 的 h 调用不被转换', () => {
    expect(run(`import { h } from 'preact';\nconst v = h('div', {}, 'x');`)).toBeNull();
  });

  it('局部函数 h 不被转换', () => {
    expect(
      run(`function h(tag) { return tag; }\nexport const v = h('div');`),
    ).toBeNull();
  });

  it('别名导入 import { h as create } 也能转换', () => {
    const code = run(
      `import { h as create } from '@/core';\nconst v = () => create('div', { onClick: fn }, 'x');`,
    );
    expect(code).toContain(`_createEl('div', { __events: { click: fn } }, 'x')`);
  });

  it('其他库的 defineComponent 不被标记', () => {
    expect(
      run(`import { defineComponent } from 'vue';\nconst C = defineComponent({});`),
    ).toBeNull();
  });

  it('未 import 框架 API 的文件不转换', () => {
    expect(run(`export const a = 1;`)).toBeNull();
  });
});

describe('hili-compile: 真实组件文件冒烟测试', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'packages/player/src/components/Ending.ts'),
    'utf-8',
  );

  it('Ending.ts dev/prod 均能转换，prod 额外静态提升', () => {
    const dev = transformCode(source, 'Ending.ts', DEV_OPTS);
    const prod = transformCode(source, 'Ending.ts', PROD_OPTS);

    expect(dev).not.toBeNull();
    expect(prod).not.toBeNull();

    // dev：转换但不提升；prod：静态提升生效
    expect(dev!.code).not.toContain('_hoisted_');
    expect(prod!.code).toContain('_hoisted_');
    expect(prod!.code).toContain('_cloneHoisted(');

    // 内部函数 import 注入且只出现一次
    const devImportLines = dev!.code
      .split('\n')
      .filter((l) => l.includes("@/core/internal"));
    expect(devImportLines.length).toBe(1);
    expect(devImportLines[0]).toContain('_createEl');
  });
});
