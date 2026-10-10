# 框架优化修复计划文档

> 目标：在不改变当前功能的前提下，修复框架核心代码中的 45 项问题，提升健壮性、一致性和可维护性。

## 修复原则

1. **向后兼容**：不破坏现有 API 签名和调用方式
2. **最小改动**：只修复问题本身，不做额外重构
3. **分阶段执行**：按严重度从高到低修复，每个 Phase 完成后验证
4. **保留测试**：所有现有测试必须通过

---

## Phase 1：高严重度问题（可能导致功能错误）

### P1-1 onBeforeMount 语义错误（DOM 插入后才触发）
- **文件**：`core/mount.ts` L36-64
- **问题**：`mount()` 先 `appendChild`，再触发 `onBeforeMount`，语义错误
- **修复**：调整顺序，先触发 `onBeforeMount`，再 `appendChild`
- **验证**：onBeforeMount 中无法访问父容器中的元素位置

### P1-2 CSS 自定义属性用 setAttribute 覆盖整个 style
- **文件**：`core/mount.ts` L323-324
- **问题**：`--xxx` 属性用 `el.setAttribute("style", val)` 覆盖所有内联样式
- **修复**：改用 `el.style.setProperty(prop, String(val))`
- **验证**：CSS 自定义属性与其他 style 属性共存

### P1-3 input.value 等 DOM property 用 setAttribute 不生效
- **文件**：`core/mount.ts` L342
- **问题**：`value`、`checked`、`selected` 等用 setAttribute 不生效
- **修复**：增加 DOM property 白名单，对这些属性直接赋值 `el[key] = value`
- **白名单**：`value`、`checked`、`selected`、`disabled`、`readOnly`、`defaultValue`、`defaultChecked`、`indeterminate`、`textContent`、`innerHTML`
- **验证**：input.value 正确设置，SSR 水合后值不丢失

### P1-4 hydrate 只处理第一个子节点
- **文件**：`core/mount.ts` L617-619
- **问题**：只水合 `container.firstChild`，忽略多余子节点
- **修复**：遍历所有子节点，但只水合 VNode 对应的 DOM 节点；多余节点跳过并开发环境警告
- **验证**：容器中有 script 标签时不影响水合

### P1-5 水合子节点无 mismatch 检测
- **文件**：`core/mount.ts` L743-751
- **问题**：不验证标签名/属性是否一致
- **修复**：水合时检查 VNode.tag 与 DOM.tagName 是否匹配，不匹配时开发环境警告
- **验证**：SSR/客户端不一致时有警告

### P1-6 回调 ref 在 hydrate 中缺少第二个参数
- **文件**：`core/mount.ts` L701
- **问题**：`(refValue as RefValue)(el)` 缺少 vnode 参数
- **修复**：改为 `(refValue as RefValue)(el, vnode)`
- **验证**：回调 ref 签名一致

### P1-7 ref fallback 缺失（组件未 expose 时 ref 为 null）
- **文件**：`core/mount.ts` L528-535
- **问题**：组件未调用 expose() 时，ref.current 保持 null
- **修复**：当 `_exposed === undefined` 时，fallback 到 `vnode.lifecycle.el ?? vnode.el`
- **验证**：未 expose 的组件 ref 指向根 DOM

### P1-8 show() 直接突变传入的 VNode
- **文件**：`core/h.ts` L485-499
- **问题**：直接修改传入 VNode 的 attrs.style
- **修复**：深拷贝 attrs 和 style 后修改
- **验证**：同一 VNode 多次引用不互相污染

### P1-9 materialize() 修改子 VNode 的 __parent
- **文件**：`core/mount.ts` L126
- **问题**：多次 mount 会覆盖 __parent
- **修复**：mount 前不修改 __parent（由 h() 设置），只在 vnode.__parent 未定义时设置
- **验证**：SSR + 客户端双 mount 不冲突

### P1-10 useState 替换 onDestroyed 导致清理丢失
- **文件**：`core/state.ts` L342-347
- **问题**：多次 useState 会互相覆盖 onDestroyed
- **修复**：改为收集清理函数到 lifecycle._cleanups 数组，destroy 时统一调用
- **验证**：多次 useState 订阅都能正确取消

---

## Phase 2：中严重度问题（行为不完善或不一致）

### P2-1 SSR/客户端错误处理不一致
- **文件**：`core/ssr.ts` L175-184
- **问题**：SSR 用 safeCall 吞错误，客户端直接 throw
- **修复**：SSR 也改为 throw（报告后重抛），保持一致
- **验证**：SSR 和客户端行为一致

### P2-2 SSR style 中 CSS 自定义属性 camelToKebab 处理错误
- **文件**：`core/ssr.ts` L247-250
- **问题**：`--primaryColor` 会被转为 `---primary-color`
- **修复**：CSS 自定义属性（以 `--` 开头）跳过 camelToKebab 转换
- **验证**：SSR 输出的 CSS 自定义属性名正确

### P2-3 SSR 不处理 className 属性
- **文件**：`core/ssr.ts` L214-262
- **问题**：SSR 输出 `className="xxx"` 而非 `class="xxx"`
- **修复**：serializeAttrs 中增加 `className → class` 映射
- **验证**：SSR 输出正确的 class 属性

### P2-4 SSR 事件处理器过滤逻辑不显式
- **文件**：`core/ssr.ts` L50-57
- **问题**：通过 `typeof value === "function"` 隐式过滤事件
- **修复**：在 SKIP_ATTRS 检查后，显式检查 `key.startsWith("on") && typeof value === "function"` 跳过
- **验证**：事件处理器不输出到 HTML

### P2-5 Context 全局状态非并发安全
- **文件**：`core/context.ts` L148-166
- **问题**：模块级全局变量，多请求并发干扰
- **修复**：保持现状（单线程 JS 不真正并发），但增加 saveContext/restoreContext 工具函数供 SSR 批量处理使用
- **验证**：SSR 批量渲染时上下文隔离

### P2-6 hydrateNode 组件判断不区分类/函数组件
- **文件**：`core/mount.ts` L643
- **问题**：用 `typeof vnode.tag === "function"` 判断
- **修复**：导入并使用 isClassComponent/isFnComponent（从 h.ts 导出）
- **验证**：类组件水合正确

### P2-7 hydrateNode SVG 判断使用 SVGAElement
- **文件**：`core/mount.ts` L679
- **问题**：SVGAElement 只是 `<a>` 元素
- **修复**：改为 `SVGElement`
- **验证**：所有 SVG 元素都能水合

### P2-8 destroy 中 removeChild 可能抛异常
- **文件**：`core/mount.ts` L470-471
- **问题**：子节点已被手动移除时抛异常
- **修复**：用 try-catch 包裹 removeChild
- **验证**：手动移除后 destroy 不崩溃

### P2-9 事件名大小写处理
- **文件**：`core/mount.ts` L305
- **问题**：`toLowerCase()` 对自定义事件可能有问题
- **修复**：保持 toLowerCase（浏览器原生事件全小写），添加注释说明
- **验证**：原生事件正常工作

### P2-10 Fragment 在客户端创建真实 DOM
- **文件**：`core/mount.ts` L101-104
- **问题**：`materialize` 对 fragment 没有特殊处理
- **修复**：materialize 中检测 fragment tag，只创建并返回子节点的 DocumentFragment
- **验证**：Fragment 不产生真实 DOM 元素

---

## Phase 3：低严重度问题（可维护性和健壮性）

### P3-1 __LUMINA_DEV__ 默认返回 true
- **文件**：`core/warning.ts` L103-108
- **修复**：默认返回 false（生产安全优先）
- **验证**：生产环境无多余警告

### P3-2 SVG image 标签可引用外部资源
- **文件**：`core/mount.ts` L404
- **修复**：removeUnsafeNodes 中增加对 image 标签 href 的检查
- **验证**：SVG image 的 javascript: href 被移除

### P3-3 SVG_TAGS 列表不完整
- **文件**：`core/h.ts` L34-57
- **修复**：补充 title、desc、metadata、switch、animate、animateTransform、set、feMerge、feGaussianBlur 等标签
- **验证**：所有 SVG 标签正确创建

### P3-4 hydrate 不处理指令
- **文件**：`core/mount.ts` L690-726
- **修复**：hydrate 中增加指令处理逻辑
- **验证**：hydrate 后指令生效

### P3-5 clone() 不支持 Date/RegExp/Map/Set
- **文件**：`core/state.ts` L179-195
- **修复**：增加对这些类型的支持
- **验证**：状态中包含 Date 等类型时正确克隆

### P3-6 状态比较用 === 对对象不触发
- **文件**：`core/state.ts` L235
- **修复**：保持 ===（设计决策），添加注释明确禁止 mutate
- **验证**：文档清晰

### P3-7 状态路径 setValue 自动覆盖中间节点
- **文件**：`core/state.ts` L151-170
- **修复**：setValue 时如果中间节点是非对象，开发环境警告
- **验证**：路径冲突有警告

### P3-8 expose 无类型约束
- **文件**：`types/index.ts` L98
- **修复**：保持 unknown（运行时无法约束），添加注释
- **验证**：类型清晰

### P3-9 core/index.ts 从 player 包导入
- **文件**：`core/index.ts` L30
- **修复**：将 PlayerStateKeyEnum 的导出移到 player 包的 index 中
- **验证**：core 不依赖 player

### P3-10 escapeHtml 性能
- **文件**：`core/ssr.ts` L271-278
- **修复**：改为单次遍历查表替换
- **验证**：SSR 性能提升

### P3-11 camelToKebab 只在 SSR 使用
- **文件**：`core/ssr.ts` L286-288
- **修复**：提取为共享工具函数
- **验证**：复用性提升

### P3-12 defineComponent _callbacks 冗余检查
- **文件**：`core/h.ts` L344
- **修复**：移除冗余的 undefined 检查
- **验证**：逻辑简化

### P3-13 HookSystem 类型约束不足
- **文件**：`core/hooks.ts` L85-96
- **修复**：添加注释说明类型限制
- **验证**：文档清晰

### P3-14 EventBus off 引用比对
- **文件**：`core/eventBus.ts` L93-109
- **修复**：保持现状（标准行为），添加注释
- **验证**：行为一致

### P3-15 hydrate SVG 判断条件冗余
- **文件**：`core/mount.ts` L676-680
- **修复**：简化为 `el instanceof Element`
- **验证**：所有元素都能水合

---

## Phase 4：架构层面问题（设计优化）

### P4-1 无 key 支持
- **修复**：在 each() 中支持 key 属性（仅类型层面，运行时暂不实现 diff）
- **验证**：key 属性被接受但不影响行为

### P4-2 无错误边界
- **修复**：增加 ErrorBoundary 组件（可选使用）
- **验证**：组件错误不中断渲染

### P4-3 Context 无响应式
- **修复**：保持现状（设计决策），文档强调
- **验证**：文档清晰

### P4-4 hydrate 不检查属性差异
- **修复**：开发环境下检查关键属性差异并警告
- **验证**：属性不一致有警告

### P4-5 事件总线监听器累积
- **修复**：在组件 onDestroyed 中自动清理（提供工具函数）
- **验证**：监听器不累积

### P4-6 全局 Provider 栈无边界检查
- **修复**：添加最大深度限制（100 层）
- **验证**：超深嵌套有友好错误

### P4-7 VNode 重复 mount 检测
- **修复**：开发环境检测 VNode 已挂载并警告
- **验证**：重复挂载有警告

---

## 执行顺序

1. **Phase 1**（高严重度）→ 验证测试
2. **Phase 2**（中严重度）→ 验证测试
3. **Phase 3**（低严重度）→ 验证测试
4. **Phase 4**（架构层面）→ 验证测试

每个 Phase 完成后运行 `npm test` 确保无回归。
