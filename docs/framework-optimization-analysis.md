# 框架优化分析报告：h 函数与 vite-plugin-hili-compile

> 分析范围：`core/h.ts`、`core/internal.ts`、`core/mount.ts`、`core/ssr.ts`、`plugins/vite-plugin-hili-compile/*`
> 结论先行：编译插件的思路（h() → 专用内部函数）方向正确，但目前存在 **3 个编译路径下的功能性 Bug**、**1 个架构性缺陷（dev/prod 双路径不一致）**，以及若干未完成的优化点。h 函数本身有少量可减的分配开销。

---

## 一、整体架构回顾

框架是"无响应式 + 手动 DOM 更新"的极简 VNode 框架：

- `h(tag, attrs, ...children)` 返回纯数据 VNode；
- `mount/materialize` 递归创建 DOM；`hydrate` 复用 SSR 的 DOM；
- 编译插件在生产构建时把 `h()` 替换为 `_createStaticEl/_createEl/_createSvgEl/_createFragment/_createComp`，跳过运行时类型判断，并把静态调用提升为模块级常量。

这个设计和 Vue 3 的 `transformElement + hoistStatic`、Solid 的编译思路一致，方向没问题。问题出在**双路径一致性**和**编译产物覆盖不完整**上。

---

## 二、P0：编译路径下的 3 个功能性 Bug

### Bug 1：SSR 会把 `__events` 序列化成垃圾属性

- 位置：`core/ssr.ts` `SKIP_ATTRS`（L59-71）
- 现象：编译后的代码 `_createEl('div', { __events: { click: fn } })` 走 SSR 时，`serializeAttrs` 遍历 attrs：`__events` 不在 SKIP_ATTRS 里，也不以 `on` 开头，值又是对象 → 输出 `__events="[object Object]"` 到 HTML。
- 对比：dev 模式下 `h()` 不产生 `__events`，所以这个 Bug 只在"生产构建 + SSR"时出现——正是最不容易被发现的位置。
- 修复：`SKIP_ATTRS` 加入 `"__events"`（与 `__ref`/`__providers` 并列）。

### Bug 2：hydrate 不认 `__ref`，编译后水合丢失 ref 绑定

- 位置：`core/mount.ts` L838 `const refValue = attrs.ref;`
- 现象：`applyAttrs` 用 `attrs.__ref ?? attrs.ref`（L301），但 `hydrateNode` 只读 `attrs.ref`。编译后 ref 被改名为 `__ref`，水合时 ref 完全失效（回调 ref / 对象 ref 都不执行）。
- 修复：hydrateNode 改为 `const refValue = attrs.__ref ?? attrs.ref;`，与 applyAttrs 对齐。

### Bug 3：`_createEl/_createStaticEl` 不提取元素级 `__providers`

- 位置：`core/internal.ts` L38-71；`core/mount.ts` L336-420（applyAttrs 的 key 跳过清单）
- 现象：`h()` 的元素分支会提取 `__providers` 并写入 `vnode.__providers`（h.ts L349-356），但编译后的 `_createEl` 原样保留 attrs → `applyAttrs` 遍历时执行 `el.setAttribute('__providers', '[object Object]')`，且 `useContext` 沿 `__parent` 链找不到 Provider。框架文档（context.ts L73）明确支持 `h('div', { __providers: [...] }, children)` 这种写法，编译后即失效。
- 修复：`_createEl`（含静态分支）提取 `__providers` 到 `vnode.__providers` 并从 attrs 删除；`applyAttrs` 的跳过清单补上 `__providers` 兜底。

> 这三个 Bug 同根同源：**编译产物引入的新内部字段（`__events`/`__ref`/`__providers`）没有在所有消费点（mount / hydrate / SSR）同步处理**。建议先统一为一份"内部字段清单"，三处消费点共用。

---

## 三、P1：架构性缺陷——dev/prod 双路径不一致

当前插件 dev 模式 `transform` 直接 `return null`，只有 prod 走编译路径。后果：

1. 上面 3 个 Bug 在 `vite dev` 下永远不会复现，上线才炸；
2. dev 与 prod 的 VNode 结构、attrs 内容、错误行为都可能不同（如 SVG 根节点 xmlns、`__providers` 提取），"dev 正常 prod 异常"排查成本极高；
3. `__hili_type` 标记、`_create*` 函数在 dev 下零覆盖。

Vue/Solid 的做法是 **dev 和 prod 编译同一份代码**，差异只由 `__DEV__` 条件分支 + DCE 决定。本插件已经注入了 `__HILI_DEV__`，完全可以：

- dev 也执行转换（生成 `_create*`），只是保留 `if (__HILI_DEV__)` 包裹的开发警告；
- 或至少：新增"编译产物级"集成测试，把 transformCode 的输出喂给 jsdom 跑 mount/SSR/hydrate，覆盖编译路径。

---

## 四、P1：插件自身的正确性风险

### 4.1 `isHCall` 不校验 `h` 的来源，会误伤其他库

- `transform.ts` L128-130：只要 callee 是标识符 `h` 就转换；`index.ts` L73-78 的 `usesFrameworkAPI` 正则也不检查 import 的**来源模块**。
- 后果：文件里 `import { h } from 'preact'`（或用户自己的局部 `h` 函数），只要同时 import 了本框架的任意 API，preact 的 `h(...)` 会被改写成 `_createComp(...)` → 静默破坏。
- 修复：在 traverse 里用 babel scope 解析 `h` 的 binding，确认其来自框架模块；`usesFrameworkAPI` 的正则把 `from ['"]...` 的来源也纳入匹配（只认 `@/core`、`hili-player` 等已知入口）。

### 4.2 静态提升不递归：真实代码几乎提升不动

- `transform.ts` `isAllStatic` L157-173：参数里出现任何 CallExpression（包括嵌套的 `h(...)`）即判为非静态。
- 实际代码（如 `Ending.ts`、`SettingMenu.ts`、`ColorPanel.ts`）几乎全是"外层 h + 嵌套 h"的树，当前策略下只有孤立的叶子节点能提升，收益很小。
- 修复：参考 Vue 的 `isStaticNode`：递归判定整棵子树静态后整体提升，提升代码里嵌套调用换成 `_createStaticEl`，并保证提升顺序（子先父后）。

### 4.3 提升的静态节点被多处挂载时会互相污染

- `_hoisted_N` 是模块级共享对象，`materialize` 会写 `vnode.el`（mount.ts L203-205）、`child.__parent`；若同一静态节点在树中出现两次（或同一组件两次渲染复用），后挂载的会覆盖 `el`，`destroy` 只移除最后一个。
- 修复：Vue 的做法是 `cloneVNode(hoisted)`——提升常量使用时包一层浅拷贝，或在 `materialize` 入口对"无 `__parent` 的已挂载节点"做克隆。

### 4.4 其他小问题

- `export default defineComponent(...)` 不注入 `__hili_type`（transform.ts L353-358），prod 下仍走反射 fallback——可用"本地 const + 重新 export default"改写。
- `markClassComponent` 只认字面名为 `Component` 的父类（L380-381）。
- `markComponentType` 用 `s.appendRight(node.end, ';\n...')` 注入，遇到 `export const X = defineComponent(...)` 等写法是合法的，但没有针对 ASI/注释边界做测试。
- SVG 标签表在 `core/h.ts` 与 `plugins/.../svgTags.ts` **双份维护**（内容相同），必然漂移——应只保留一份，两处 import。
- 注入的 `import { _createStaticEl, ... } from '@/core/internal'` 硬编码别名 `@/core`：用户项目必须恰好配了同名 alias 才能用这个插件；应从框架解析路径推导，或支持配置。
- 只要发生任何转换就注入全部 5 个函数（transform.ts L33-34），应跟踪实际用到的函数按需注入（rollup 能摇掉，但产物更干净）。

---

## 五、P2：h 函数本身的优化点

### 5.1 子节点扁平化分配过多

- `h.ts` L232-234：`children.flat(3).filter(...)`——每次调用产生最多 4 个中间数组。
- 修复：单次遍历的手写 flatten（维护一个栈/深度），`null/undefined` 内联过滤，一次分配。`core/internal.ts` 的 `flattenChildren` 同样处理。

### 5.2 组件 props 双重展开

- `h.ts` L254 `const attrsWithoutRef = { ...rawAttrs }` + L263 `props = { ...attrsWithoutRef, children }`：两次对象展开。
- 修复：一次遍历拷贝并剔除 `ref`/`__providers`，最后补 `children`。

### 5.3 dev 下组件类型反射可缓存

- `getComponentType`（h.ts L115-131）在无 `__hili_type` 标记时每次做 `Object.getOwnPropertyDescriptor` 反射。prod 有标记没问题，dev 可用 `WeakMap<Function, 'fn'|'class'>` 缓存（class 身份稳定，缓存安全）。

### 5.4 小项

- `when(false, vnode)` 返回 `""`，mount 时会创建一个空文本节点；可返回 `null` 让 `h()` 过滤（需同步改类型）。
- `show()` 每次调用深拷贝 style（L574-601）——这是 P1-8 的修复产物，行为正确，但高频调用下成本存在；若热路径需要，可改为惰性拷贝。

---

## 六、P2：构建产物层面的优化机会

1. `packages/player/vite.config.ts` `minify: false`：`isDev()` 是函数调用，esbuild define 只替换 `__HILI_DEV__`，**不做 minify 就不会发生 DCE**，lib 构建产物里 dev 警告代码全部保留。建议 lib 构建开 `minify: 'esbuild'`（或把 `isDev()` 内联为可折叠的常量表达式）。
2. `include: [/\.tsx?$/]` 默认不含 `.js/.mjs`：消费方若用 JS 写组件，编译优化完全缺席（demo 是 .ts 无感，但对外提供时要注意）。
3. 插件对 `each`/`when`/`show` 没有任何编译处理——`each` 每次渲染全量重建数组（无 key diff），这是设计决策（无响应式），但如果要做性能提升，`each` 的 keyed diff 是下一个大头，建议单独立项评估。

---

## 七、建议的落地顺序

| 优先级 | 事项 | 工作量 |
|--------|------|--------|
| P0 | 修 3 个编译路径 Bug（`__events` SSR、hydrate `__ref`、元素级 `__providers`） | 小（~1 天） |
| P1 | 插件补测试：transform 单测（快照）+ 编译产物跑 mount/SSR/hydrate 集成测试 | 中（~2 天） |
| P1 | `isHCall` 来源校验（babel scope） | 小 |
| P1 | 静态提升递归化 + 提升节点 clone 复用 | 中（~2 天） |
| P2 | SVG 表去重、按需注入 import、`export default` 标记、alias 可配置 | 小 |
| P2 | h() flatten 单遍化、props 单次展开、dev 类型缓存 | 小 |
| P2 | lib 构建开 minify 让 `__HILI_DEV__` DCE 生效 | 小 |

> 注：本次分析过程中 `pnpm test` 因沙箱限制（esbuild spawn EPERM）无法执行，上述结论全部基于静态代码阅读；建议修复后在本地跑一遍 `pnpm test` 和 `pnpm build` 验证。
