# Vite 编译插件设计（零配置版）

> 参照 Vue/Solid/Svelte 插件设计模式：零配置、自动检测环境、编译期分流。
> 用户只需 `plugins: [hiliCompile()]`，无需任何选项。

---

## 一、设计理念

### 与 Vue/Solid/Svelte 插件的对照

| 维度 | Vue plugin-vue | Solid vite-plugin-solid | **本插件 hili-compile** |
|------|---------------|------------------------|----------------------|
| 环境检测 | `configResolved` 读 `isProduction` | `config` 读 `command` | `configResolved` 读 `command` + `isProduction` |
| Dev 行为 | 保留 source map + HMR | alias 重定向到 `/dev` 入口 | 最小转换，保持 HMR 速度 |
| Prod 行为 | 传 `isProd` 给编译器 | `define.DEV=false` 触发 DCE | 全量优化转换 |
| 环境注入 | 不用 define | `define: { DEV: true/false }` | `define: { __HILI_DEV__: true/false }` |
| 用户配置 | 零配置 | 零配置 | **零配置** |
| 编译产物 | 模板 → render 函数 | JSX → createSignal/createEffect | h() → 专用内部函数 |

### 核心思路

不是在 h() 调用上"打补丁"注入标记，而是**将 h() 调用编译为专用内部函数**，从根源消除运行时判断：

```
源码 h('div', { onClick: fn }, 'hello')
         ↓ 编译期转换
优化后 _createEl('div', { __events: { click: fn } }, 'hello')
         ↓ 运行时
直接创建 DOM，跳过所有类型判断、属性遍历、事件检测
```

---

## 二、自动环境检测机制

### 插件骨架

```typescript
// plugins/vite-plugin-hili-compile/index.ts
import type { Plugin, ResolvedConfig } from 'vite';
import { transformCode } from './transform';

export function hiliCompile(): Plugin {
  let isServe = false;
  let isProduction = false;

  return {
    name: 'hili-compile',

    /**
     * configResolved 钩子：自动检测当前环境
     * 与 Vue/Svelte 插件完全一致的模式
     * - serve: vite dev 启动开发服务器
     * - build: vite build 生产打包
     */
    configResolved(resolvedConfig: ResolvedConfig) {
      isServe = resolvedConfig.command === 'serve';
      isProduction = resolvedConfig.isProduction;
    },

    /**
     * config 钩子：自动注入环境变量
     * 与 Solid 插件的 define: { DEV: true/false } 模式一致
     * 框架代码中用 if (__HILI_DEV__) 做条件分支，
     * 生产环境被 esbuild 替换为 false 后触发死代码消除
     */
    config() {
      return {
        define: {
          __HILI_DEV__: JSON.stringify(!isProduction),
        },
      };
    },

    /**
     * transform 钩子：根据环境自动分流
     * - dev: 跳过优化转换，仅注入 HMR 支持，保持快速热更新
     * - prod: 全量优化（静态提升、组件类型预计算、属性预分类）
     */
    transform(code: string, id: string) {
      // 只处理 .ts/.tsx 文件
      if (!/\.[jt]sx?$/.test(id)) return null;
      // 跳过 node_modules 和测试文件
      if (id.includes('node_modules') || /\.test\./.test(id)) return null;

      // 开发模式：不做转换，保持 HMR 速度
      if (isServe && !isProduction) {
        return null; // 原样返回，Vite 自行处理
      }

      // 生产模式：全量优化转换
      return transformCode(code, id, { isProduction: true });
    },
  };
}
```

### 关键设计点

1. **零配置**：`hiliCompile()` 无参数，环境检测全自动
2. **Dev 零开销**：开发模式直接 `return null`，不做任何转换，HMR 不受影响
3. **Prod 全量优化**：生产模式才执行 AST 转换
4. **自动注入 `__HILI_DEV__`**：框架代码中的 `if (__HILI_DEV__)` 在生产环境被 esbuild 替换为 `if (false)`，触发死代码消除

---

## 三、编译转换策略

### 核心思想：h() → 专用内部函数

当前 `h()` 是一个"万能函数"，每次调用都要做全套判断。编译后，根据 AST 分析结果，将 h() 调用替换为**专用的内部函数**，每个函数只做一件事：

| 源码调用 | 编译后调用 | 跳过的运行时判断 |
|---------|-----------|----------------|
| `h('div', { class: 'x' }, 'text')` | `_createStaticEl(...)` | 组件类型判断、SVG 判断、Fragment 判断 |
| `h('div', { onClick: fn }, child)` | `_createEl('div', { __events: { click: fn } }, child)` | 事件属性遍历、startsWith 判断 |
| `h(MyComponent, { prop: val })` | `_createComp(MyComponent, { prop: val })` | isClassComponent/isFnComponent 反射 |
| `h('svg', {}, h('circle', {}))` | `_createSvgEl('svg', {}, _createSvgEl('circle', {}))` | SVG_TAGS.has() 查找 |

### 转换示例 1：静态元素

**源码：**
```typescript
h('div', { class: 'header' }, '标题')
```

**编译后：**
```typescript
// 纯静态，提升到模块级常量
const _hoisted_1 = _createStaticEl('div', { class: 'header' }, ['标题']);
// 使用时直接引用
_hoisted_1
```

`_createStaticEl` 是极简函数，不做任何判断：
```typescript
function _createStaticEl(tag: string, attrs: VNodeAttrs, children: VNodeChild[]): VNode {
  return { tag, attrs, children, el: undefined };
}
```

### 转换示例 2：动态元素

**源码：**
```typescript
h('input', {
  type: 'text',
  value: props.value,
  onInput: handleInput,
  class: 'input-field',
  ref: inputRef,
})
```

**编译后：**
```typescript
_createEl('input', {
  type: 'text',
  class: 'input-field',
  __events: { input: handleInput },
  __ref: inputRef,
  __dynamic: { value: () => props.value }  // 动态属性标记
}, [])
```

`_createEl` 跳过事件检测（直接读 `__events`）和 ref 检测（直接读 `__ref`）：
```typescript
function _createEl(tag: string, attrs: VNodeAttrs, children: VNodeChild[]): VNode {
  const vnode = { tag, attrs, children, el: undefined };
  // 事件已预分类，无需遍历
  if (attrs.__events) vnode._eventCleanups = [];
  return vnode;
}
```

### 转换示例 3：组件调用

**源码：**
```typescript
import { defineComponent } from '@/core';

const MyComp = defineComponent<{ name: string }>((props, lc) => {
  return h('div', {}, props.name);
});

h(MyComp, { name: 'test', onClick: handleClick })
```

**编译后：**
```typescript
import { defineComponent } from '@/core';

const MyComp = defineComponent<{ name: string }>((props, lc) => {
  return h('div', {}, props.name);
});
// 编译期注入：标记组件类型，运行时不再反射判断
MyComp.__hili_type = 'fn';

// h(MyComp, ...) → _createComp(MyComp, ...)
_createComp(MyComp, {
  name: 'test',
  __events: { click: handleClick },
})
```

`_createComp` 直接读 `__hili_type`，跳过 `Object.getOwnPropertyDescriptor`：
```typescript
function _createComp(component: Function, props: Record<string, unknown>): VNode {
  const type = (component as any).__hili_type;
  // type === 'fn' → 直接调用 component(props)
  // type === 'class' → new component(props).render()
  // undefined → fallback 到运行时判断（兼容未编译代码）
  if (type === 'fn') {
    return component(props);
  } else if (type === 'class') {
    return new (component as any)(props).render();
  }
  // fallback
  return h(component as any, props);
}
```

### 转换示例 4：SVG 元素

**源码：**
```typescript
h('svg', { viewBox: '0 0 100 100' },
  h('circle', { cx: 50, cy: 50, r: 40, fill: 'red' }),
  h('text', { x: 10, y: 20 }, 'Hello'),
)
```

**编译后：**
```typescript
// SVG 标签在编译期已知，直接使用 _createSvgEl
// 无需运行时 SVG_TAGS.has() 查找
_createSvgEl('svg', { viewBox: '0 0 100 100' }, [
  _createSvgEl('circle', { cx: 50, cy: 50, r: 40, fill: 'red' }, []),
  _createSvgEl('text', { x: 10, y: 20 }, ['Hello']),
])
```

`_createSvgEl` 预设命名空间：
```typescript
function _createSvgEl(tag: string, attrs: VNodeAttrs, children: VNodeChild[]): VNode {
  return { tag, attrs, children, __ns: 'http://www.w3.org/2000/svg', el: undefined };
}
```

### 转换示例 5：Fragment

**源码：**
```typescript
h('fragment', {}, h('div', {}, 'A'), h('div', {}, 'B'))
```

**编译后：**
```typescript
_createFragment([
  _createStaticEl('div', {}, ['A']),
  _createStaticEl('div', {}, ['B']),
])
```

---

## 四、AST 转换实现

### 转换流程

```
源码字符串
    ↓
@babel/parser 解析为 AST
    ↓
遍历 AST，收集信息：
  ├── 识别所有 h() 调用
  ├── 判断每个 h() 的参数是否全为字面量
  ├── 识别 defineComponent() 调用
  ├── 识别 class extends Component 声明
  └── 识别 SVG 标签字符串
    ↓
生成优化后的代码（用 magic-string 做源码替换）
    ↓
生成 sourcemap
    ↓
返回 { code, map }
``### 核心转换器代码结构

```typescript
// plugins/vite-plugin-hili-compile/transform.ts
import { parse } from '@babel/parser';
import { traverse } from '@babel/traverse';
import * as t from '@babel/types';
import MagicString from 'magic-string';
import { SVG_TAGS } from './svgTags';

interface TransformContext {
  isProduction: boolean;
  hoistedCount: number;
}

export function transformCode(
  code: string,
  filename: string,
  options: { isProduction: boolean }
): { code: string; map: any } | null {
  const s = new MagicString(code);
  const ctx: TransformContext = {
    isProduction: options.isProduction,
    hoistedCount: 0,
  };

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      filename,
    });
  } catch {
    // 解析失败，返回原码
    return null;
  }

  traverse(ast, {
    // 1. 标记 defineComponent 返回值为函数组件
    CallExpression(path) {
      markComponentType(path, s, ctx);
    },

    // 2. 标记 class extends Component 为类组件
    ClassDeclaration(path) {
      markClassComponent(path, s, ctx);
    },

    // 3. 转换 h() 调用
    CallExpression(path) {
      transformHCall(path, s, ctx);
    },
  });

  // 如果没有修改，返回 null
  if (!s.hasChanged()) return null;

  return {
    code: s.toString(),
    map: s.generateMap({ source: filename, hires: true }),
  };
}

/**
 * 转换 h() 调用
 */
function transformHCall(
  path: any,
  s: MagicString,
  ctx: TransformContext
): void {
  const { node } = path;

  // 判断是否为 h() 调用
  if (!isHCall(node)) return;

  const args = node.arguments;
  if (args.length === 0) return;

  const tagArg = args[0];

  // 情况 1：标签为字符串字面量
  if (t.isStringLiteral(tagArg)) {
    const tag = tagArg.value;

    // SVG 标签 → _createSvgEl
    if (SVG_TAGS.has(tag)) {
      s.overwrite(node.callee.start, node.callee.end, '_createSvgEl');
      return;
    }

    // Fragment → _createFragment
    if (tag === 'fragment') {
      s.overwrite(node.callee.start, node.callee.end, '_createFragment');
      return;
    }

    // 普通元素 → 检查是否全静态
    if (isAllStatic(args)) {
      // 静态提升到模块级
      const hoistedName = `_hoisted_${++ctx.hoistedCount}`;
      const callCode = s.slice(node.start, node.end);
      s.prepend(`const ${hoistedName} = ${callCode.replace(/^\s*h\(/, '_createStaticEl(')};\n`);
      s.overwrite(node.start, node.end, hoistedName);
    } else {
      // 动态元素 → _createEl + 属性预分类
      s.overwrite(node.callee.start, node.callee.end, '_createEl');
      rewriteAttrs(node, s);
    }
    return;
  }

  // 情况 2：标签为标识符（组件引用）
  if (t.isIdentifier(tagArg) || t.isMemberExpression(tagArg)) {
    s.overwrite(node.callee.start, node.callee.end, '_createComp');
    rewriteAttrs(node, s);
    return;
  }
}

/**
 * 属性预分类：将 onXxx 提取为 __events，ref 提取为 __ref
 */
function rewriteAttrs(node: any, s: MagicString): void {
  if (node.arguments.length < 2) return;
  const attrsArg = node.arguments[1];
  if (!t.isObjectExpression(attrsArg)) return;

  const events: string[] = [];
  let hasRef = false;

  for (const prop of attrsArg.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const keyName = prop.key.name || prop.key.value;

    if (keyName.startsWith('on') && typeof keyName === 'string') {
      // onInput → __events.input
      const eventName = keyName.slice(2).toLowerCase();
      events.push(`${eventName}: ${s.slice(prop.value.start, prop.value.end)}`);
      // 移除原属性
      s.remove(prop.start, prop.end + (prop.trailingComma ? 1 : 0));
    }

    if (keyName === 'ref') {
      hasRef = true;
      // ref 保留在属性中，但标记为 __ref
      s.overwrite(prop.key.start, prop.key.end, '__ref');
    }
  }

  // 注入 __events
  if (events.length > 0) {
    const insertPos = attrsArg.end - 1; // 闭合 } 前
    s.appendRight(insertPos, `__events: { ${events.join(', ')} }, `);
  }
}

/**
 * 判断 h() 调用的所有参数是否全为静态字面量
 */
function isAllStatic(args: any[]): boolean {
  return args.every(arg => {
    if (t.isStringLiteral(arg)) return true;
    if (t.isNumericLiteral(arg)) return true;
    if (t.isBooleanLiteral(arg)) return true;
    if (t.isNullLiteral(arg)) return true;
    if (t.isObjectExpression(arg)) {
      return arg.properties.every((p: any) =>
        t.isObjectProperty(p) && isStaticValue(p.value)
      );
    }
    return false;
  });
}

function isStaticValue(node: any): boolean {
  return t.isStringLiteral(node) ||
         t.isNumericLiteral(node) ||
         t.isBooleanLiteral(node) ||
         t.isNullLiteral(node);
}

function isHCall(node: any): boolean {
  return t.isCallExpression(node) &&
         t.isIdentifier(node.callee) &&
         node.callee.name === 'h';
}

/**
 * 标记 defineComponent 返回值为函数组件
 */
function markComponentType(path: any, s: MagicString, ctx: TransformContext): void {
  const { node } = path;
  if (!t.isCallExpression(node)) return;

  const callee = node.callee;
  if (!t.isIdentifier(callee) || callee.name !== 'defineComponent') return;

  // 找到赋值目标：const MyComp = defineComponent(...)
  const parent = path.parent;
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
    const compName = parent.id.name;
    // 在 defineComponent 调用后注入类型标记
    const insertPos = node.end;
    s.appendRight(insertPos, `;\n${compName}.__hili_type = 'fn'`);
  }
}

/**
 * 标记 class extends Component 为类组件
 */
function markClassComponent(path: any, s: MagicString, ctx: TransformContext): void {
  const { node } = path;
  if (!t.isClassDeclaration(node)) return;

  // 检查是否 extends Component
  const superClass = node.superClass;
  if (!superClass) return;
  const superName = t.isIdentifier(superClass) ? superClass.name : '';
  if (superName !== 'Component') return;

  const className = node.id?.name;
  if (!className) return;

  // 在类声明后注入类型标记
  const insertPos = node.end;
  s.appendRight(insertPos, `;\n${className}.__hili_type = 'class'`);
}
```

---

## 五、运行时代码修改

### 5.1 新增内部函数（core/internal.ts）

```typescript
/**
 * 编译期生成的专用内部函数
 * 这些函数只做一件事，跳过所有运行时类型判断
 * 未编译的代码（开发模式）仍走 h() 通用路径
 */

/** 创建纯静态元素（无动态属性、无事件、无 ref） */
export function _createStaticEl(
  tag: string,
  attrs: VNodeAttrs,
  children: VNodeChild[],
): VNode {
  return { tag, attrs, children };
}

/** 创建动态元素（可能有事件、ref、动态属性） */
export function _createEl(
  tag: string,
  attrs: VNodeAttrs,
  children: VNodeChild[],
): VNode {
  return { tag, attrs, children };
}

/** 创建 SVG 元素（预设命名空间） */
export function _createSvgEl(
  tag: string,
  attrs: VNodeAttrs,
  children: VNodeChild[],
): VNode {
  return { tag, attrs, children, __ns: 'http://www.w3.org/2000/svg' };
}

/** 创建 Fragment（不产生真实 DOM） */
export function _createFragment(children: VNodeChild[]): VNode {
  return { tag: 'fragment', attrs: {}, children };
}

/** 创建组件 VNode（跳过运行时组件类型判断） */
export function _createComp(
  component: Function,
  props: Record<string, unknown>,
): VNode {
  const type = (component as any).__hili_type;
  if (type === 'fn') {
    return (component as FnComponent)(props);
  }
  if (type === 'class') {
    return new (component as any)(props).render();
  }
  // fallback：未编译的代码走通用路径
  return h(component as any, props);
}
```

### 5.2 修改 core/h.ts

```typescript
// isClassComponent / isFnComponent 增加 __hili_type 快速路径
function getComponentType(fn: unknown): 'class' | 'fn' | null {
  if (typeof fn !== 'function') return null;

  // 编译期标记优先（O(1) 属性读取，无需反射）
  const marker = (fn as { __hili_type?: string }).__hili_type;
  if (marker === 'class' || marker === 'fn') return marker;

  // fallback：运行时反射判断（开发模式或未编译代码）
  if (isClassComponent(fn)) return 'class';
  if (isFnComponent(fn)) return 'fn';
  return null;
}

// h() 中用 getComponentType 替代直接调用 isClassComponent/isFnComponent
```

### 5.3 修改 core/mount.ts

```typescript
// applyAttrs 中增加 __events / __ref 预分类读取
function applyAttrs(el: Element, attrs: VNodeAttrs, vnode: VNode): void {
  // 优先读取编译期预分类字段
  if (attrs.__events) {
    const events = attrs.__events as Record<string, EventListener>;
    for (const evt in events) {
      el.addEventListener(evt, events[evt]);
      cleanups.push(() => el.removeEventListener(evt, events[evt]));
    }
  }

  if (attrs.__ref) {
    const refValue = attrs.__ref;
    if (typeof refValue === 'function') {
      refValue(el, vnode);
    } else if (isRefObject(refValue)) {
      refValue.current = el;
    }
  }

  // 遍历剩余属性（跳过已预分类的）
  const keys = Object.keys(attrs);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key === '__events' || key === '__ref') continue; // 已处理
    // ... 原有属性处理逻辑
  }
}
```

### 5.4 修改 core/warning.ts

```typescript
// isDev() 不再需要手动注入 __HILI_DEV__
// 插件通过 config.define 自动注入
export function isDev(): boolean {
  // __HILI_DEV__ 由 Vite 插件自动注入：
  // - dev 模式: __HILI_DEV__ = true
  // - prod 模式: __HILI_DEV__ = false（触发死代码消除）
  return typeof __HILI_DEV__ !== 'undefined' ? __HILI_DEV__ : true;
}
```

---

## 六、用户使用方式

### 零配置使用

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { hiliCompile } from './plugins/vite-plugin-hili-compile';

export default defineConfig({
  plugins: [
    hiliCompile(),  // 零配置，自动检测环境
  ],
});
```

### 无需修改任何业务代码

业务代码中的 `h()`、`defineComponent()` 调用完全不变，插件在编译期自动转换：

```typescript
// 业务代码（不变）
import { h, defineComponent } from '@/core';

const MyComp = defineComponent<{ name: string }>((props, lc) => {
  return h('div', { class: 'greeting' }, `Hello, ${props.name}!`);
});

// 渲染
h(MyComp, { name: 'World', onClick: () => console.log('clicked') });
```

### 开发模式行为

```
vite dev
  → 插件 configResolved 检测到 command === 'serve'
  → define 注入 __HILI_DEV__ = true
  → transform 钩子 return null（不做转换）
  → 代码原样执行，HMR 正常工作
  → isDev() 返回 true，开发警告正常输出
```

### 生产模式行为

```
vite build
  → 插件 configResolved 检测到 command === 'build'
  → define 注入 __HILI_DEV__ = false
  → transform 钩子执行 AST 转换
  → h() 调用被替换为 _createEl/_createComp/_createSvgEl
  → defineComponent 后注入 __hili_type 标记
  → 静态 h() 调用被提升为模块级常量
  → __HILI_DEV__ = false 触发 esbuild 死代码消除
  → isDev() 返回 false，开发警告代码被移除
```

---

## 七、开发计划

### 阶段 1：插件骨架 + 环境检测（1天）

- [ ] 创建 `plugins/vite-plugin-hili-compile/` 目录
- [ ] 实现 `configResolved` 自动检测 dev/prod
- [ ] 实现 `config` 自动注入 `__HILI_DEV__`
- [ ] 实现 `transform` 钩子骨架（dev return null，prod 调用 transformCode）
- [ ] 验证：`vite dev` 正常启动，`vite build` 正常打包

### 阶段 2：内部函数 + 运行时修改（1天）

- [ ] 新增 `core/internal.ts`（_createStaticEl/_createEl/_createSvgEl/_createFragment/_createComp）
- [ ] 修改 `core/h.ts`（getComponentType 快速路径）
- [ ] 修改 `core/mount.ts`（applyAttrs 支持 __events/__ref）
- [ ] 导出内部函数供编译产物引用
- [ ] 验证：不启用插件时所有测试通过

### 阶段 3：AST 转换核心（3天）

- [ ] 实现 h() 调用识别和分类（静态/动态/SVG/Fragment/组件）
- [ ] 实现静态提升（hoistStatic）
- [ ] 实现属性预分类（onXxx → __events，ref → __ref）
- [ ] 实现 defineComponent 类型标记注入
- [ ] 实现 class extends Component 类型标记注入
- [ ] 生成 sourcemap
- [ ] 验证：编译产物正确，运行行为不变

### 阶段 4：HMR 支持（1天）

- [ ] dev 模式下注入组件 HMR 边界代码
- [ ] 验证 dev 模式热更新正常

### 阶段 5：集成测试 + 性能基准（1天）

- [ ] 在 demo 项目中集成插件
- [ ] 运行完整测试套件
- [ ] 性能基准对比（dev/prod）
- [ ] 编写文档

**总计：7 天**

---

## 八、与旧设计的对比

| 维度 | 旧设计 | 新设计 |
|------|--------|--------|
| 配置 | 需手动指定 `hoistStatic`/`compileComponentType` 等选项 | **零配置**，`hiliCompile()` 无参数 |
| 环境检测 | 需手动写 `process.env.NODE_ENV === 'production'` | **自动检测**，`configResolved` 读取 |
| Dev 模式 | 需手动配置 `dev: false` | **自动跳过**，dev 模式 return null |
| __HILI_DEV__ 注入 | 需用户在 vite.config 中手动 define | **自动注入**，插件 config 钩子处理 |
| 编译策略 | 在 h() 调用上"打补丁"注入标记 | **编译为专用内部函数**，彻底消除判断 |
| 与 Vue/Solid 相似度 | 低（自定义模式） | **高**（相同的设计模式） |
| 开发周期 | 10-15 天 | **7 天**（更聚焦） |
| 业务代码改动 | 需少量改动 | **零改动** |
