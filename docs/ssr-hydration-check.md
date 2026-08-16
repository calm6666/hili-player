# SSR 兼容性与水合（Hydration）检查报告

## 一、项目 SSR 架构总览

### 1.1 SSR 支持层次

| 层次 | 文件 | 职责 |
|------|------|------|
| 环境检测 | `utils/ssr.ts` | `isBrowser()` / `isServer()` 及 20+ 个安全封装函数 |
| VNode 创建 | `core/h.ts` | 纯函数，无 DOM 操作，天然 SSR 安全 |
| HTML 序列化 | `core/ssr.ts` | `renderToString()` 将 VNode 树转为 HTML 字符串 |
| DOM 挂载 | `core/mount.ts` | 服务端跳过挂载/返回 mock 节点；客户端提供 `hydrate()` |
| 组件层 | `PlayerDocker.ts` / `VideoPlayer.ts` | 服务端渲染简化骨架 |
| 入口层 | `packages/player/src/player/index.ts` | `mountPlayer` 服务端跳过挂载；`createSSRPlayer` 工厂 |

### 1.2 SSR 渲染流程

```
服务端：
  createSSRPlayer({ src: '...', ssr: { enabled: true } })
    → VideoPlayer.render()
      → isServer() === true → 返回简化骨架 VNode
    → renderToString(vnode)
      → HTML 字符串
    → 发送到客户端

客户端水合：
  createSSRPlayer({ src: '...', ssr: { enabled: false } })
    → VideoPlayer.render()
      → isServer() === false → 返回完整 VNode
    → hydrate(vnode, container)
      → 遍历 VNode 树，绑定 ref 和事件到已有 DOM
      → 不重新创建 DOM，复用服务端渲染的 HTML
```

### 1.3 水合（Hydration）实现

`core/mount.ts` 中的 `hydrate()` 函数：

```typescript
export function hydrate(vnode: VNode | string, container: HTMLElement): void {
  if (!isBrowser()) return;
  if (typeof vnode === 'string') return;
  const firstChild = container.firstChild;
  if (firstChild) {
    hydrateNode(vnode, firstChild);
  }
}
```

`hydrateNode()` 做三件事：
1. **组件类型**：调用组件函数获取子 VNode，递归水合
2. **原生元素**：绑定 ref 和事件监听器到已有 DOM
3. **子节点**：递归水合所有子节点

---

## 二、组件 SSR 兼容性检查

### 2.1 已支持 SSR 的组件

| 组件 | SSR 保护方式 | 骨架内容 |
|------|------------|---------|
| PlayerDocker | `isServer()` 早期返回 | 简化 div 骨架（无 video、无事件） |
| VideoPlayer | `isServer()` 条件渲染 | 简化 div 骨架 |

### 2.2 未支持 SSR 的组件（35 个）

除 PlayerDocker 外，**所有组件均没有 `isServer()` 早期返回守卫**。但大部分组件的 DOM 访问被延迟到 `onMounted` 或事件处理器内部，在 SSR 阶段不会立即执行，因此**大部分组件在 SSR 时不会崩溃**，但存在以下隐患。

---

## 三、问题分级

### 3.1 严重问题（SSR 时会直接崩溃）

| # | 组件 | 位置 | 问题描述 | 修复建议 |
|---|------|------|---------|---------|
| 1 | RowDm | L313 | `playerBasDmWrapRef.current!.appendChild(element)` — 非空断言 `!`，SSR 时 ref.current 为 undefined | 改为 `playerBasDmWrapRef.current?.appendChild(element)` |
| 2 | InteractionLayer | L99 | `cmdDmWrapRef.current!.style.setProperty(...)` — 非空断言，SSR 时崩溃 | 改为 `cmdDmWrapRef.current?.style.setProperty(...)` |
| 3 | Controls | L369-401 | `document.createElement('div')` 在多个辅助函数中，如果通过暴露的 API 在水合前调用会崩溃 | 在辅助函数内添加 `if (!isBrowser()) return;` |
| 4 | Dialog | L80-132 | `document.createElement()` 和 `appendChild()` 在 `showDmTip()` 中，水合前调用会崩溃 | 添加 `if (!isBrowser()) return;` |
| 5 | Context | L117 | `navigator.clipboard.writeText(document.URL)` — `navigator` 和 `document.URL` 在 SSR 时不可用 | 添加 `if (!isBrowser()) return;` |

### 3.2 高风险问题（缺少 isBrowser() 保护）

| # | 组件 | 位置 | 问题描述 | 修复建议 |
|---|------|------|---------|---------|
| 6 | Controls | L591-594 | `document.addEventListener('mousemove/touchmove/mouseup/touchend', ...)` 在拖拽处理中 | 添加 `if (!isBrowser()) return;` |
| 7 | Controls | L732-733 | `document.addEventListener('mousemove/mouseup', ...)` 在音量拖拽中 | 添加 `if (!isBrowser()) return;` |
| 8 | VolumeSlider | L281-282 | `document.addEventListener('mousemove/mouseup', ...)` | 添加 `if (!isBrowser()) return;` |
| 9 | ProgressBar | L256-257 | `document.addEventListener('mousemove/mouseup', ...)` | 添加 `if (!isBrowser()) return;` |
| 10 | Slider | L140-141 | `document.addEventListener('mousemove/mouseup', ...)` | 添加 `if (!isBrowser()) return;` |
| 11 | Context | L94 | `document.addEventListener('click', hideMenu)` | 添加 `if (!isBrowser()) return;` |
| 12 | LottieIcon | L372 | `await import('lottie-web')` 动态导入，SSR 行为不确定 | 添加 `if (!isBrowser()) return;` 或使用条件导入 |

### 3.3 中风险问题（useState 更新回调中访问 ref.current）

这些回调在微任务中执行，SSR 时 ref.current 为 undefined。由于使用了可选链 `?.` 或 if 判断，不会崩溃，但回调会静默失败。

| # | 组件 | 位置 | 问题描述 |
|---|------|------|---------|
| 13 | VolumeSlider | L188-194 | `volumeIconRef.current.setSequenceSlot()` / `volumeIconRef.current.play()` 在 useState 回调中 |
| 14 | RightControls | L203-254 | `fullBtnRef.current.classList.toggle()` 等 4 个 ref 在 useState 回调中 |
| 15 | LeftControls | L186-223 | `playerCtrlTimeCurrentRef.current.innerHTML` 等 3 个 ref 在 useState 回调中 |

**说明**：这些在 SSR 阶段不会执行，因为 `useState` 的回调只在 `state.set()` 被调用后触发，而 SSR 阶段不会有状态写入。但在水合完成前如果状态被写入，回调会因 ref.current 为 undefined 而静默失败。建议在回调内添加 ref 存在性检查。

### 3.4 低风险问题（onMounted 内的 DOM 访问）

这些访问在 `onMounted` 回调中，SSR 时 `mount()` 函数会跳过实际挂载，`onMounted` 不会被调用。实际安全，但缺少防御性编程。

| 组件 | 问题 |
|------|------|
| PlaybackRateMenu | `querySelectorAll` 在 onMounted 中 |
| SendBar | `addEventListener` 在 onMounted 中 |
| QualityMenu | `innerText` 在 onMounted 中 |
| ViewpointMenu | `innerText` 在 onMounted 中 |
| 所有组件的 onBeforeDestroy | `document.removeEventListener()` / `removeChild()` 等 |

---

## 四、水合（Hydration）潜在问题

### 4.1 SSR/客户端 VNode 不一致

**问题**：服务端 `renderToString()` 调用组件函数获取 VNode，但组件函数在 SSR 时和客户端时可能返回不同的 VNode 结构。

**当前实现**：
- PlayerDocker 在 SSR 时返回简化骨架（`isServer()` 早期返回）
- 客户端水合时，`hydrate()` 会重新调用组件函数获取完整 VNode
- `hydrateNode()` 按 DOM 顺序遍历，不校验 VNode 与 DOM 的一致性

**风险**：如果 SSR 骨架和客户端完整 VNode 的 DOM 结构不一致（如子节点数量、标签类型不同），`hydrateNode()` 会将 ref 和事件绑定到错误的 DOM 元素上。

**当前状态**：PlayerDocker 的 SSR 骨架是简化版（只有 div 容器），客户端水合时会创建完整 DOM。由于 `hydrate()` 只处理 `container.firstChild`，而 SSR 骨架已有子节点，可能导致水合跳过或错位。

### 4.2 hydrateNode 的组件处理

```typescript
function hydrateNode(vnode: VNode, el: Node): void {
  if (typeof vnode.tag === 'function') {
    const result = (tag as FnComponent)(attrs);  // 重新调用组件函数
    if (result && typeof result !== 'string') {
      hydrateNode(result, el);  // 递归水合子 VNode
    }
    return;  // 组件节点不绑定 ref 和事件
  }
  // 原生元素：绑定 ref 和事件
}
```

**问题**：
1. 组件函数被重新调用，但 `defineComponent` 中的 `setup()` 会重新执行，注册新的 `useState` 订阅
2. `lifecycle.onMounted` 会在 `hydrate()` 完成后被调用，此时 DOM 已存在，是安全的
3. 但 `setCurrentVNode` / `setPendingProviders` 的全局状态可能在水合过程中被污染

### 4.3 defineComponent 在水合中的行为

`hydrateNode()` 调用组件函数时，会触发 `defineComponent` 的完整流程：
1. 创建 `contextVNode`（含 `__parent` 链）
2. 消费 `pendingProviders`
3. 设置 `setCurrentVNode(contextVNode)`
4. 执行 `setup()`
5. 恢复 `setCurrentVNode`

**风险**：如果水合是异步进行的（如 `deferHydration: true`），全局状态可能在多个水合调用之间交叉污染。

### 4.4 事件绑定遗漏

`hydrateNode()` 只绑定 `onXxx` 形式的事件（如 `onClick`、`onMouseDown`），但组件中大量使用 `addEventListener()` 在 `onMounted` 中手动绑定的事件不会被 `hydrate()` 处理。

**当前状态**：这不是问题，因为 `onMounted` 在水合后会被调用，手动 `addEventListener` 会正常执行。但需要确保 `onMounted` 在水合完成后才被调用。

### 4.5 ref 绑定

`hydrateNode()` 会将 ref 绑定到对应的 DOM 元素：

```typescript
const refValue = attrs.ref;
if (refValue !== undefined && refValue !== null) {
  if (typeof refValue === 'function') {
    (refValue as (el: HTMLElement) => void)(el);
  } else if (typeof refValue === 'object' && 'current' in refValue) {
    (refValue as Ref<HTMLElement>).current = el;
  }
}
```

**风险**：如果 SSR 骨架和客户端 VNode 的 DOM 结构不一致，ref 可能绑定到错误的元素。

---

## 五、修复建议

### 5.1 紧急修复（严重问题）

```typescript
// RowDm.ts L313 — 移除非空断言
- playerBasDmWrapRef.current!.appendChild(element);
+ playerBasDmWrapRef.current?.appendChild(element);

// InteractionLayer.ts L99 — 移除非空断言
- cmdDmWrapRef.current!.style.setProperty(...);
+ cmdDmWrapRef.current?.style.setProperty(...);

// Context.ts L117 — 添加环境检查
+ if (!isBrowser()) return;
  navigator.clipboard.writeText(document.URL);

// Dialog.ts showDmTip() — 添加环境检查
+ if (!isBrowser()) return;
  const tipEl = document.createElement('div');

// Controls.ts 辅助函数 — 添加环境检查
+ if (!isBrowser()) return document.createElement('div');
```

### 5.2 建议修复（高风险问题）

为所有 `document.addEventListener` 调用添加 `isBrowser()` 保护：

```typescript
// 拖拽处理
const handleMouseDown = (e: MouseEvent): void => {
  if (!isBrowser()) return;
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

### 5.3 组件级 SSR 守卫（推荐）

为每个组件添加 `isServer()` 早期返回，参照 PlayerDocker 的模式：

```typescript
export const MyComponent = defineComponent((props, lifecycle) => {
  if (isServer()) {
    return h('div', { class: 'my-component' });
  }

  // 正常浏览器环境逻辑
  const myRef = ref<HTMLElement>();
  // ...
  return h('div', { class: 'my-component', ref: myRef });
});
```

### 5.4 水合一致性保障

1. **SSR 骨架与客户端 VNode 结构必须一致**：服务端渲染的 HTML 结构必须与客户端水合时的 VNode 结构匹配
2. **组件函数必须是幂等的**：同一组件函数在 SSR 和客户端调用时，返回的 VNode 结构必须相同（除 SSR 守卫的简化骨架外）
3. **避免在 setup 中产生副作用**：所有 DOM 操作、事件监听、定时器等必须在 `onMounted` 中执行
4. **useState 回调内检查 ref 存在性**：

```typescript
useState(state, PlayerStateKeyEnum.MUTED, (newMuted) => {
  if (!volumeIconRef.current) return;  // 水合前 ref 可能为 undefined
  volumeIconRef.current.setSequenceSlot(newMuted ? 2 : 0);
  volumeIconRef.current.play();
}, lifecycle);
```

---

## 六、SSR 安全封装函数清单

`utils/ssr.ts` 提供的安全封装函数，组件应优先使用这些函数而非直接调用浏览器 API：

| 函数 | 替代 | 说明 |
|------|------|------|
| `isBrowser()` | `typeof window !== 'undefined'` | 环境检测 |
| `isServer()` | `typeof window === 'undefined'` | 环境检测 |
| `getWindow()` | `window` | 安全获取 window |
| `getDocument()` | `document` | 安全获取 document |
| `safeBrowserOperation(fn)` | 直接调用 | 安全执行浏览器操作 |
| `safeSetTimeout(fn, ms)` | `setTimeout(fn, ms)` | 安全定时器 |
| `safeAddEventListener(el, type, fn)` | `el.addEventListener(type, fn)` | 安全事件监听 |
| `safeCreateElement(tag)` | `document.createElement(tag)` | 安全 DOM 创建 |
| `safeCreateElementNS(ns, tag)` | `document.createElementNS(ns, tag)` | 安全命名空间 DOM 创建 |
| `safeCreateTextNode(text)` | `document.createTextNode(text)` | 安全文本节点创建 |
| `safeQuerySelector(el, sel)` | `el.querySelector(sel)` | 安全 DOM 查询 |
| `safeQuerySelectorAll(el, sel)` | `el.querySelectorAll(sel)` | 安全 DOM 查询 |
| `safeGetBoundingClientRect(el)` | `el.getBoundingClientRect()` | 安全尺寸获取 |
| `safeGetViewportSize()` | `window.innerWidth/innerHeight` | 安全视口尺寸 |
| `safeRequestAnimationFrame(fn)` | `requestAnimationFrame(fn)` | 安全 rAF |
| `safeResizeObserver(cb)` | `new ResizeObserver(cb)` | 安全 ResizeObserver |
| `safeIntersectionObserver(cb, opts)` | `new IntersectionObserver(cb, opts)` | 安全 IntersectionObserver |

---

## 七、组件 SSR 兼容性总表

| 组件 | SSR 守卫 | 严重问题 | 高风险 | 中风险 | 状态 |
|------|---------|---------|--------|--------|------|
| PlayerDocker | ✅ `isServer()` | 0 | 0 | 0 | ✅ 安全 |
| VideoPlayer | ✅ `isServer()` | 0 | 0 | 0 | ✅ 安全 |
| Controls | ❌ | 1 | 2 | 0 | ⚠️ 需修复 |
| Dialog | ❌ | 1 | 0 | 0 | ⚠️ 需修复 |
| RowDm | ❌ | 1 | 0 | 0 | ⚠️ 需修复 |
| InteractionLayer | ❌ | 1 | 0 | 0 | ⚠️ 需修复 |
| Context | ❌ | 1 | 1 | 0 | ⚠️ 需修复 |
| VolumeSlider | ❌ | 0 | 1 | 1 | ⚠️ 需修复 |
| ProgressBar | ❌ | 0 | 1 | 0 | ⚠️ 需修复 |
| Slider | ❌ | 0 | 1 | 0 | ⚠️ 需修复 |
| LottieIcon | ❌ | 0 | 1 | 0 | ⚠️ 需修复 |
| RightControls | ❌ | 0 | 0 | 1 | ⚡ 低风险 |
| LeftControls | ❌ | 0 | 0 | 1 | ⚡ 低风险 |
| SendBar | ❌ | 0 | 0 | 0 | ⚡ 低风险 |
| PlaybackRateMenu | ❌ | 0 | 0 | 0 | ⚡ 低风险 |
| SettingMenu | ❌ | 0 | 0 | 0 | ⚡ 低风险 |
| VideoInfo | ❌ | 0 | 0 | 0 | ⚡ 低风险 |
| SubtitleLayer | ❌ | 0 | 0 | 0 | ⚡ 低风险 |
| TopControls | ❌ | 0 | 0 | 0 | ✅ 安全 |
| 其余 17 个组件 | ❌ | 0 | 0 | 0 | ✅ 安全 |

**统计**：
- 严重问题：5 个（需立即修复）
- 高风险问题：7 个（建议修复）
- 中风险问题：3 个（建议添加 ref 检查）
- 低风险/安全：28 个组件
