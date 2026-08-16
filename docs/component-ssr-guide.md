# 组件开发规范 — SSR 与水合安全

## 一、核心原则

本项目**没有虚拟 DOM 和响应式系统**，`h()` 直接创建真实 DOM。SSR 时 `h()` 只创建 VNode（纯 JS 对象），`mount()` 阶段才创建真实 DOM。水合（hydration）时复用服务端已有的 DOM，只绑定 ref 和事件。

**核心原则：setup 函数必须是纯函数，所有副作用延迟到 onMounted。**

---

## 二、SSR 安全规则

### 规则 1：setup 中禁止直接访问浏览器 API

```typescript
// ❌ 错误 — setup 中直接访问 DOM
export const MyComponent = defineComponent((props, lifecycle) => {
  const width = window.innerWidth;                    // SSR 崩溃
  const el = document.createElement('div');           // SSR 崩溃
  const rect = someRef.current.getBoundingClientRect(); // ref 还没绑定

  return h('div', {});
});

// ✅ 正确 — 延迟到 onMounted
export const MyComponent = defineComponent((props, lifecycle) => {
  const myRef = ref<HTMLElement>();

  lifecycle.onMounted = () => {
    const width = window.innerWidth;
    const rect = myRef.current?.getBoundingClientRect();
  };

  return h('div', { ref: myRef });
});
```

### 规则 2：所有 document/window 调用必须加 isBrowser() 保护

即使代码在 onMounted 或事件处理器中，也必须添加防御性检查，防止水合前被外部 API 调用。

```typescript
import { isBrowser } from '@/utils';

// ✅ 正确
const handleClick = (): void => {
  if (!isBrowser()) return;
  document.addEventListener('mousemove', handleMove);
};

const showTip = (): void => {
  if (!isBrowser()) return;
  const el = document.createElement('div');
  container.appendChild(el);
};
```

### 规则 3：禁止使用非空断言访问 ref

```typescript
// ❌ 错误 — SSR 时 ref.current 为 undefined
someRef.current!.appendChild(element);
someRef.current!.style.setProperty(key, value);

// ✅ 正确 — 使用可选链
someRef.current?.appendChild(element);
someRef.current?.style.setProperty(key, value);
```

### 规则 4：useState 回调中必须检查 ref 存在性

useState 的回调在微任务中执行，水合完成前 ref.current 可能为 undefined。

```typescript
// ✅ 正确
useState(state, PlayerStateKeyEnum.MUTED, (newMuted) => {
  if (!volumeIconRef.current) return;  // 水合前 ref 可能为 undefined
  volumeIconRef.current.setSequenceSlot(newMuted ? 2 : 0);
  volumeIconRef.current.play();
}, lifecycle);
```

### 规则 5：组件必须提供 SSR 骨架

每个组件应在 setup 开头检测 `isServer()`，返回简化骨架 VNode：

```typescript
import { isServer } from '@/utils';

export const MyComponent = defineComponent((props, lifecycle) => {
  // SSR 骨架：只返回结构，不绑定事件、不创建 ref
  if (isServer()) {
    return h('div', { class: 'my-component' });
  }

  // 浏览器环境：完整逻辑
  const myRef = ref<HTMLElement>();

  lifecycle.onMounted = () => {
    // DOM 操作...
  };

  return h('div', { class: 'my-component', ref: myRef });
});
```

### 规则 6：使用 SSR 安全封装函数

优先使用 `@/utils` 提供的安全封装函数：

| 场景 | ❌ 直接使用 | ✅ 安全封装 |
|------|-----------|-----------|
| 创建元素 | `document.createElement('div')` | `safeCreateElement('div')` |
| 查询元素 | `el.querySelector('.cls')` | `safeQuerySelector(el, '.cls')` |
| 事件监听 | `el.addEventListener('click', fn)` | `safeAddEventListener(el, 'click', fn)` |
| 定时器 | `setTimeout(fn, 1000)` | `safeSetTimeout(fn, 1000)` |
| 尺寸获取 | `el.getBoundingClientRect()` | `safeGetBoundingClientRect(el)` |
| 视口尺寸 | `window.innerWidth` | `safeGetViewportSize().width` |
| rAF | `requestAnimationFrame(fn)` | `safeRequestAnimationFrame(fn)` |
| Observer | `new ResizeObserver(cb)` | `safeResizeObserver(cb)` |
| IntersectionObserver | `new IntersectionObserver(cb)` | `safeIntersectionObserver(cb)` |

### 规则 7：动态导入必须加 isBrowser() 保护

```typescript
// ❌ 错误 — SSR 时动态导入行为不确定
const loadModule = async () => {
  const mod = await import('some-browser-lib');
  mod.init();
};

// ✅ 正确
const loadModule = async () => {
  if (!isBrowser()) return;
  const mod = await import('some-browser-lib');
  mod.init();
};
```

---

## 三、水合安全规则

### 规则 8：SSR 骨架与客户端 VNode 结构必须一致

水合时 `hydrateNode()` 按 DOM 顺序遍历，**不校验 VNode 与 DOM 的一致性**。如果结构不一致，ref 和事件会绑定到错误的元素。

```typescript
// ❌ 错误 — SSR 骨架和客户端结构不一致
if (isServer()) {
  return h('div', {});  // SSR: 1 个子节点
}
return h('div', {},     // 客户端: 3 个子节点
  h('span', {}, 'A'),
  h('span', {}, 'B'),
  h('span', {}, 'C'),
);

// ✅ 正确 — 结构一致，SSR 只简化内容
if (isServer()) {
  return h('div', {},
    h('span', {}, ''),
    h('span', {}, ''),
    h('span', {}, ''),
  );
}
return h('div', {},
  h('span', {}, 'A'),
  h('span', {}, 'B'),
  h('span', {}, 'C'),
);
```

### 规则 9：组件函数必须是幂等的

同一组件函数在 SSR 和客户端调用时，返回的 VNode 结构必须相同（除 SSR 守卫的简化骨架外）。

```typescript
// ❌ 错误 — 使用随机值导致 SSR/客户端不一致
const id = `component-${Math.random()}`;
return h('div', { id });

// ✅ 正确 — 使用确定性值
const id = `component-${props.id}`;
return h('div', { id });
```

### 规则 10：避免在 setup 中产生副作用

```typescript
// ❌ 错误 — setup 中产生副作用
export const MyComponent = defineComponent((props, lifecycle) => {
  document.title = 'New Title';          // 副作用
  window.addEventListener('resize', fn); // 副作用
  state.set('key', value);               // 副作用（触发微任务通知）

  return h('div', {});
});

// ✅ 正确 — 副作用在 onMounted 中
export const MyComponent = defineComponent((props, lifecycle) => {
  lifecycle.onMounted = () => {
    document.title = 'New Title';
    window.addEventListener('resize', fn);
  };

  return h('div', {});
});
```

---

## 四、组件模板

### 4.1 标准 SSR 安全组件

```typescript
import { h, defineComponent, ref } from '@/core';
import type { ComponentLifecycle } from '@/types';
import { isBrowser, isServer } from '@/utils';

interface MyComponentProps {
  title: string;
  onAction?: (data: string) => void;
}

export const MyComponent = defineComponent((props: MyComponentProps, lifecycle: ComponentLifecycle) => {
  // ============================================
  // SSR 骨架
  // ============================================
  if (isServer()) {
    return h('div', { class: 'my-component' },
      h('div', { class: 'my-component-title' }),
      h('div', { class: 'my-component-content' }),
    );
  }

  // ============================================
  // DOM 引用
  // ============================================
  const titleRef = ref<HTMLElement>();
  const contentRef = ref<HTMLElement>();

  // ============================================
  // 状态订阅（通过 Context）
  // ============================================
  const stateMgr = useContext(StateContext);
  if (stateMgr) {
    useState(stateMgr, PlayerStateKeyEnum.SOME_STATE, (newVal) => {
      if (!contentRef.current) return;  // 水合前 ref 可能为 undefined
      contentRef.current.textContent = String(newVal);
    }, lifecycle);
  }

  // ============================================
  // 事件处理
  // ============================================
  const handleClick = (): void => {
    if (!isBrowser()) return;
    props.onAction?.('clicked');
  };

  // ============================================
  // 生命周期
  // ============================================
  lifecycle.onMounted = (): void => {
    if (!isBrowser()) return;
    // 初始化 DOM 操作
    if (titleRef.current) {
      titleRef.current.textContent = props.title;
    }
  };

  lifecycle.onBeforeDestroy = (): void => {
    // 清理资源
  };

  // ============================================
  // 渲染
  // ============================================
  return h('div', { class: 'my-component' },
    h('div', { class: 'my-component-title', ref: titleRef }),
    h('div', { class: 'my-component-content', ref: contentRef, onClick: handleClick }),
  );
});
```

### 4.2 纯展示组件（无需 SSR 守卫）

如果组件不访问任何浏览器 API，不需要 SSR 守卫：

```typescript
export const SimpleLabel = defineComponent((props: { text: string }) => {
  return h('span', { class: 'simple-label' }, props.text);
});
```

---

## 五、检查清单

开发新组件时，逐项检查：

- [ ] setup 中没有直接访问 `window` / `document` / `navigator`
- [ ] 所有 `document.createElement` / `addEventListener` 有 `isBrowser()` 保护
- [ ] 所有 `ref.current` 使用可选链 `?.` 而非非空断言 `!`
- [ ] useState 回调中有 `if (!ref.current) return` 检查
- [ ] 有 `isServer()` 早期返回骨架
- [ ] SSR 骨架与客户端 VNode 结构一致
- [ ] 副作用（DOM 操作、事件监听、定时器）在 `onMounted` 中
- [ ] 动态导入有 `isBrowser()` 保护
- [ ] `onBeforeDestroy` 中清理所有资源（事件监听、定时器、Observer）
- [ ] 使用 `safeXxx` 封装函数替代直接浏览器 API 调用

---

## 六、4K 视频滚动卡顿分析

### 现象

播放 4K 视频时，在 demo 页面滚动网页会明显卡顿；1080p 视频则流畅。

### 根因分析

#### 1. 视频解码与合成层压力（主因）

4K 视频的像素量是 1080p 的 **4 倍**（3840×2160 vs 1920×1080），浏览器需要：

- **硬件解码**：GPU 每帧解码 830 万像素 vs 210 万像素
- **合成层渲染**：浏览器为 `<video>` 元素创建独立的合成层（compositing layer），每帧需要将 4K 纹理从 GPU 显存合成到页面
- **滚动时重绘**：页面滚动触发合成层位置变化，4K 纹理的合成开销远大于 1080p

**关键点**：即使视频只在页面中显示为小窗口，GPU 仍然需要处理完整的 4K 纹理。浏览器不会因为 CSS 缩小了显示尺寸就降低解码分辨率。

#### 2. 主线程阻塞

滚动事件在主线程处理。4K 视频解码虽然主要在 GPU，但以下操作会占用主线程：

- **`timeUpdate` 事件**：每秒 4 次触发，每次回调中更新 DOM（`innerHTML`、`style.transform`）
- **`progress` 事件**：更新缓冲进度条
- **弹幕渲染**：`RowDm` 组件的 `createDanmaku()` 在 `timeUpdate` 中调用，创建 DOM 元素并添加动画
- **StateManager 微任务**：每次 `state.set()` 调度微任务，4K 视频的缓冲/时间更新更频繁

4K 视频的缓冲策略更激进（预加载更多数据），导致 `progress` 事件更频繁，主线程压力更大。

#### 3. 内存带宽瓶颈

4K 视频帧数据占用更多内存带宽：

- 每帧 YUV 数据：3840×2160×1.5 ≈ 12.4MB（未压缩）
- 60fps 时内存带宽需求：744MB/s
- 滚动时浏览器需要同时读取视频帧 + 页面内容，内存带宽争用导致卡顿

1080p 的内存带宽需求仅 186MB/s，差距 4 倍。

#### 4. CSS 合成层爆炸

播放器组件中大量使用 CSS 动画和变换：

- 弹幕元素（`animationend` 动画）
- 进度条拖拽（`style.transform`）
- 控制栏显示/隐藏（`transition`）
- Lottie 图标动画

每个带 CSS 动画/变换的元素都会被提升为独立的合成层。4K 视频本身已经是一个大合成层，加上这些小合成层，GPU 显存和合成开销急剧增加。

### 优化建议

| 方向 | 具体措施 | 预期效果 |
|------|---------|---------|
| 降低解码分辨率 | `video.width = 1920; video.height = 1080;` CSS 缩放显示 | GPU 解码负载降低 75% |
| 减少滚动时主线程占用 | 滚动时暂停 `timeUpdate` 回调中的 DOM 更新 | 主线程帧时间减少 30-50% |
| 减少 DOM 操作 | `timeUpdate` 回调中用 `requestAnimationFrame` 合并更新 | 避免同一帧多次 DOM 写入 |
| 弹幕节流 | 4K 视频时降低弹幕创建频率 | 主线程负载降低 |
| 使用 `will-change` | 为视频容器添加 `will-change: transform` | 提示浏览器提前创建合成层 |
| 避免强制同步布局 | 不在滚动回调中读取 `getBoundingClientRect()` | 避免布局抖动 |
| `content-visibility: auto` | 对非可见区域的弹幕/控件使用 | 跳过不可见元素的渲染 |
