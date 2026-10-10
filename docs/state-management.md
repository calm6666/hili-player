# Nova 播放器状态管理详细分析

## 一、架构总览

播放器存在 **三套独立的状态系统**，由 `VideoPlayer` 统一协调，每次状态变更时**同时更新三个系统**以保持数据一致性：

```
┌──────────────────────────────────────────────────────────────────┐
│                         VideoPlayer                               │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │TypedStateManager  │  │   PlayerStore    │  │  TypedEventBus  │ │
│  │   (this.state)   │  │  (this.store)    │  │ (this.events)   │ │
│  │                  │  │                  │  │                 │ │
│  │  类型安全路径式  │  │  持久化+运行时    │  │  类型安全事件    │ │
│  │  路径式访问      │  │  localStorage    │  │  发布/订阅       │ │
│  │  subscribe()     │  │  subscribe()     │  │  on/off/emit     │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘ │
│           │                     │                      │          │
│  VideoPlayer 方法同时更新三个系统                              │
│  例: play() → store.setPlaying() + state.set() + events.emit() │
└───────────┬─────────────────────┬──────────────────────┬────────┘
            │                     │                      │
     ┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
     │   组件层     │       │   插件层     │       │  外部使用者  │
     │             │       │             │       │             │
     │ useContext  │       │ events.on   │       │ player.on   │
     │ useState()  │       │ (主要方式)   │       │ callbacks   │
     │ Props 传值  │       │ player.state│       │ player.state│
     │ API 回调    │       │             │       │             │
     │ lifecycle   │       │             │       │             │
     └─────────────┘       └─────────────┘       └─────────────┘
```

### 三套状态系统对比

| 特性 | TypedStateManager | PlayerStore | TypedEventBus |
|------|-------------------|-------------|---------------|
| **存储位置** | 内存 | 内存 + localStorage | 无存储（纯事件） |
| **数据持久化** | ❌ 页面刷新丢失 | ✅ localStorage 持久化 | ❌ 不存储数据 |
| **通知策略** | ✅ 批量微任务调度（不阻塞主线程） | ✅ 批量微任务调度（不阻塞主线程） | ✅ 同步调用 + try-catch 异常隔离 |
| **访问方式** | `state.get('player.volume')` | `store.getState().volume` | `events.on('volumeChange', cb)` |
| **订阅方式** | `state.subscribe('player.volume', cb)` | `store.subscribe('volume', cb)` | `events.on('volumeChange', cb)` |
| **类型安全** | ✅ `TypedStateManager<PlayerStateMap>` | ✅ `subscribe<K extends keyof PlayerState>` | ✅ `TypedEventBus<PlayerEventMap>` |
| **主要用途** | 路径式状态读写 | 持久化偏好设置 | 跨模块事件通知 |
| **组件层使用** | ✅ `useState()` + `useContext(StateContext)` | ❌ 组件不直接使用 | 仅 PlayerDocker 转发事件 |

---

## 二、TypedStateManager（类型安全的运行时内存状态）

### 2.1 核心接口

定义于 `core/state.ts`：

```typescript
export interface TypedStateManager<TMap extends Record<string, unknown>> {
  getState(): Record<string, unknown>;
  get<K extends keyof TMap & string>(path: K): TMap[K] | undefined;
  set<K extends keyof TMap & string>(path: K, value: TMap[K], silent?: boolean): void;
  subscribe<K extends keyof TMap & string>(
    path: K,
    listener: (newVal: TMap[K], oldVal: TMap[K]) => void
  ): () => void;
}
```

### 2.2 PlayerStateMap 类型映射

定义于 `packages/player/src/store/runtimeState.ts`：

```typescript
export type PlayerStateMap = {
  'player.state': PlayerState;
  'player.currentTime': number;
  'player.duration': number;
  'player.buffered': number;
  'player.volume': number;
  'player.muted': boolean;
  'player.playbackRate': number;
  'player.quality': string;
  'player.isFullscreen': boolean;
  'player.isPip': boolean;
  'player.isWebFullscreen': boolean;
  'player.isWideScreen': boolean;
  'video.width': number;
  'video.height': number;
  'video.aspectRatio': number;
  'player.errorCode': number;
  'player.errorMessage': string;
  'player.isLoading': boolean;
  'player.loadProgress': number;
  'player.controlsVisible': boolean;
  'player.controlsHover': boolean;
  'player.danmakuVisible': boolean;
  'player.danmakuOpacity': number;
  'player.danmakuSpeed': number;
  'player.danmakuDensity': number;
  'player.subtitleVisible': boolean;
  'player.subtitleLang': string;
  'browser': unknown;
} & Record<string, unknown>;
```

### 2.3 类型安全效果

```typescript
const state: TypedStateManager<PlayerStateMap> = player.state;

// 路径和值类型自动推断，无需手动泛型
state.get('player.volume');           // → number | undefined
state.set('player.volume', 0.5);      // ✅ value 必须为 number
state.set('player.volume', 'loud');   // ❌ 编译错误
state.set('player.volum', 0.5);       // ❌ 路径拼写错误

// subscribe 的 listener 参数类型自动推断
state.subscribe('player.volume', (newVal, oldVal) => {
  // newVal: number, oldVal: number
});
state.subscribe('player.muted', (newVal, oldVal) => {
  // newVal: boolean, oldVal: boolean
});
```

### 2.4 PlayerStateKeyEnum 统一

`PlayerStateKeyEnum` 现在只有一份定义，位于 `packages/player/src/store/runtimeState.ts`，值为路径式字符串，与 `PlayerStateMap` 的 key 完全一致：

```typescript
export enum PlayerStateKeyEnum {
  STATE = 'player.state',
  CURRENT_TIME = 'player.currentTime',
  DURATION = 'player.duration',
  VOLUME = 'player.volume',
  MUTED = 'player.muted',
  // ...
}
```

**之前的问题（已修复）**：`core/events.ts` 和 `packages/player/src/core/events.ts` 中曾存在两份 `PlayerStateKeyEnum`，值为扁平字符串（如 `'STATE'`、`'VOLUME'`），与初始化的嵌套结构 `{ player: { state: ... } }` 不匹配，导致 `state.get('STATE')` 和 `state.get('player.state')` 返回不同的值。

### 2.5 初始状态结构

VideoPlayer 构造函数中初始化：

```typescript
this.state = createTypedStateManager<PlayerStateMap>({
  player: {
    state: PlayerState.IDLE,
    currentTime: 0,
    duration: 0,
    volume: this.props.volume,
    muted: this.props.muted,
    playbackRate: this.props.playbackRate,
    buffered: 0,
    isFullscreen: false,
    isPip: false,
    isSeeking: false,
    quality: this.props.defaultQuality,
    playMode: this.props.playMode,
    isLoading: false,
    loadProgress: 0,
    controlsVisible: true,
    controlsHover: false,
    danmakuVisible: true,
    danmakuOpacity: 1,
    danmakuSpeed: 1,
    danmakuDensity: 0.5,
    subtitleVisible: true,
    subtitleLang: 'zh-CN',
    errorCode: 0,
    errorMessage: '',
    isWebFullscreen: false,
    isWideScreen: false,
  },
  video: {
    width: 0,
    height: 0,
    aspectRatio: 0,
  },
});
```

### 2.6 值相同时跳过通知

TypedStateManager 的 `set` 方法内置去重机制：

```typescript
set: (path, value, silent = false) => {
  const oldVal = getValue(state, path);
  if (oldVal === value) return;  // 值相同则跳过，不触发监听器
  setValue(state, path, value);
  if (!silent) notify(path, value, oldVal);
}
```

这意味着如果连续设置相同的音量值，监听器不会被重复触发。

### 2.7 通知策略

三套状态系统采用不同的通知策略，根据各自的使用场景选择最优方案：

#### TypedStateManager / PlayerStore：批量微任务调度

状态管理器的监听器是 UI 更新回调（更新时间显示、音量滑块、图标等），频率高（timeupdate 每 250ms），适合异步执行：

```typescript
const notify = (path, newVal, oldVal): void => {
  const set = listeners.get(path);
  if (!set) return;
  const fns = [...set];                    // 快照，防止迭代中修改
  queueMicrotask(() => {                    // 一个微任务处理所有监听器
    for (const fn of fns) {
      try { fn(newVal, oldVal); }
      catch (e) { console.error(e); }       // 异常隔离
    }
  });
};
```

- `set()` 立即返回，不阻塞主线程
- 同一次 set 的所有监听器在同一个微任务中顺序执行
- 不同状态按 FIFO 排队，先 set 的先通知
- 状态值本身同步更新，`get()` 立即可读到新值

#### TypedEventBus：同步调用 + try-catch 异常隔离

事件总线的监听器是控制流回调（插件初始化、播放控制、错误处理等），存在严格的依赖关系，必须同步执行：

```typescript
emit: (event, ...args): void => {
  const payload = args[0];
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of set) {
    try { fn(payload); }
    catch (e) { console.error(e); }         // 异常隔离
  }
};
```

**为什么 EventBus 必须同步？**

播放器中存在事件间依赖关系，例如：

```
VideoPlayer.onMounted:
  1. events.emit('player:mounted', { video })   // DashPlugin 监听此事件获取 videoElement
  2. streamMiddleware.load({ url, format })      // DashPlugin.load() 需要 videoElement
```

如果 `emit` 是异步的，第 1 步的监听器还没执行，第 2 步 `load()` 时 `videoElement` 仍为 null，导致流媒体加载失败。

**方案对比**：

| 方案 | 阻塞主线程 | 事件内顺序 | 事件间依赖 | 异常隔离 | 适用系统 |
|------|-----------|-----------|-----------|---------|---------|
| 同步调用 + try-catch | ❌ 阻塞 | ✅ 有序 | ✅ 保证 | ✅ 隔离 | EventBus |
| 批量微任务调度 | ✅ 不阻塞 | ✅ 有序 | ❌ 不保证 | ✅ 隔离 | StateManager |
| 每个监听器单独 microtask | ✅ 不阻塞 | ❌ 可能乱序 | ❌ 不保证 | ✅ 隔离 | 不适用 |
| `setTimeout(fn, 0)` | ✅ 不阻塞 | ❌ 可能乱序 | ❌ 不保证 + 延迟 | ✅ 隔离 | 不适用 |

### 2.8 组件内使用状态：useState()

`useState()` 是组件层直接使用 TypedStateManager 的工具函数，定义于 `core/state.ts`：

```typescript
export function useState<TMap extends Record<string, unknown>, K extends keyof TMap & string>(
  state: TypedStateManager<TMap>,
  path: K,
  updater: (newVal: TMap[K], oldVal: TMap[K]) => void,
  lifecycle: { onDestroyed?: () => void }
): TMap[K] | undefined
```

**功能**：
1. 读取 `state.get(path)` 的当前值并返回
2. 自动订阅 `path` 的变化，变化时在微任务中调用 `updater` 更新 DOM（不阻塞主线程）
3. 组件销毁时自动取消订阅（通过 `lifecycle.onDestroyed`）

**使用示例**：

```typescript
import { h, defineComponent, useState, useContext } from '@/core';
import { PlayerStateKeyEnum, StateContext } from '@/store/runtimeState';

const VolumeDisplay = defineComponent<{}>((props, lifecycle) => {
  const volumeText = h('span', { class: 'volume-text' });

  // 通过 useContext 获取状态管理器（无需 props 传递）
  const state = useContext(StateContext);

  if (state) {
    // 订阅音量状态，变化时自动更新 DOM
    useState(
      state,
      PlayerStateKeyEnum.VOLUME,
      (newVol) => {
        (volumeText.el as HTMLElement).textContent = `${Math.round((newVol as number) * 100)}%`;
      },
      lifecycle
    );
  }

  return volumeText;
});
```

**与旧模式的对比**：

| 特性 | 旧模式（Props + API 反向调用） | 新模式（useState + useContext） |
|------|------|------|
| 状态传递 | PlayerDocker → Controls → RightControls → VolumeSlider | `useContext(StateContext)` 直接获取 |
| 更新方式 | 父组件调用 `controlsApi.updateVolumeDisplay(vol)` | `updater` 回调在微任务中执行 |
| 层级穿透 | 每层都需要传递 props 和回调 | 无穿透，Context 自动注入 |
| 自动清理 | 需手动管理 | `lifecycle.onDestroyed` 自动取消订阅 |
| 类型安全 | 依赖回调签名 | `PlayerStateMap` 自动推断 |

**注意**：`useState` + `useContext` 是可选的便捷工具，现有组件可以继续使用 Props + API 模式，两种模式可以共存。

### 2.9 Context 系统：跨组件层级传递状态管理器

定义于 `core/context.ts`，提供类似 React Context 的轻量级上下文机制，避免 props 逐层穿透。

**核心 API**：

```typescript
// 创建 Context（定义默认值）
export const StateContext = createContext<TypedStateManager<PlayerStateMap> | null>(null);

// 在父组件中提供值（通过 h() 的 __providers 属性）
h(PlayerDocker, {
  __providers: [{ contextId: StateContext.id, value: state }],
  ...otherProps,
})

// 在子组件中获取值
const state = useContext(StateContext);
```

**工作原理**：

1. `createContext()` 创建一个带有唯一 `symbol` 标识符的 Context 对象
2. 父组件通过 `h()` 的 `__providers` 属性注入上下文值
3. `h()` 在调用组件函数前，将 `__providers` 存入 pending providers
4. `defineComponent` 在创建 `contextVNode` 时消费 pending providers，设置到 `contextVNode.__providers`
5. `useContext()` 从当前 VNode 沿 `__parent` 链向上查找最近的 Provider 值
6. 如果没有 Provider，返回 Context 的 `defaultValue`

**Pending Providers 机制**：

`__providers` 存在时序问题：`h()` 设置 `__providers` 在 `defineComponent` 返回之后，但 `useContext` 在 `defineComponent` 内部 setup 执行时就需要沿 `__parent` 链找到 Provider。解决方案：

```
h() 调用流程：
  1. 从 attrs 提取 __providers
  2. setPendingProviders(providers)        ← 存入待注入的 Provider
  3. 调用组件函数 (defineComponent wrapper)

defineComponent 调用流程：
  1. 创建 contextVNode（含 __parent 链）
  2. contextVNode.__providers = getPendingProviders()  ← 消费 pending providers
  3. setPendingProviders(undefined)       ← 清空
  4. setCurrentVNode(contextVNode)
  5. 执行 setup（子组件 useContext 可沿 __parent 链找到 Provider）
  6. 恢复 setCurrentVNode
```

**与 React Context 的区别**：
- 没有 Consumer 组件，直接用 `useContext()` 函数获取
- Provider 不是独立组件，而是 `h()` 的内置属性
- 无响应式更新，Context 值变化不会自动触发子组件重渲染
  （本项目没有虚拟 DOM 和响应式系统，所有 DOM 操作手动完成）

**StateContext 定义于** `packages/player/src/store/runtimeState.ts`：

```typescript
export const StateContext = createContext<TypedStateManager<PlayerStateMap> | null>(null);
```

**在 VideoPlayer 中注入 Provider**：

VideoPlayer 创建 PlayerDocker 时，通过 `__providers` 注入 StateContext：

```typescript
// VideoPlayer.ts
return h(PlayerDocker, {
  src: this.getCurrentSourceUrl(),
  playerName: this.props.playerName,
  // ...其他 props
  __providers: [{ contextId: StateContext.id, value: this.state }],
  onMounted: (elements) => { ... },
});
```

**完整数据流路径**：

```
VideoPlayer (注入 __providers)
  → h(PlayerDocker, { __providers: [StateContext] })
    → PlayerDocker (contextVNode.__providers = [StateContext])
      → Controls (contextVNode.__parent = PlayerDocker.contextVNode)
        → LeftControls (useContext 沿 __parent 链找到 Provider ✓)
        → RightControls (useContext 沿 __parent 链找到 Provider ✓)
          → VolumeSlider (useContext 沿 __parent 链找到 Provider ✓)
```

---

## 三、PlayerStore（持久化 + 运行时状态）

### 3.1 持久化状态（localStorage）

定义于 `store/types.ts` 的 `PlayerPersistentState`：

| 字段 | 类型 | localStorage key | 说明 |
|------|------|-----------------|------|
| `volume` | `number` | `nova_player_profile.volume` | 音量 (0-1) |
| `isMuted` | `boolean` | `nova_player_profile.isMuted` | 是否静音 |
| `playbackRate` | `number` | `nova_player_profile.playbackRate` | 播放速度 |
| `codecPreferType` | `number` | `nova_player_profile.codecPreferType` + 独立 key | 编解码器偏好 |
| `isWideScreen` | `boolean` | `nova_player_profile.isWideScreen` | 宽屏模式 |
| `gpuRenderer` | `string` | `nova_player_profile.gpuRenderer` | GPU 渲染器信息 |
| `maxVideoQn` | `number` | `nova_player_profile.maxVideoQn` | 最高视频清晰度 |
| `maxAudioQn` | `number` | `nova_player_profile.maxAudioQn` | 最高音频质量 |
| `pbpHeight` | `string` | `nova_player_profile.pbpHeight` | 进度条高度 |
| `pbpOpacity` | `string` | `nova_player_profile.pbpOpacity` | 进度条不透明度 |
| `pbpPin` | `number` | `nova_player_profile.pbpPin` | 进度条固定 |
| `pbpTheme` | `string` | `nova_player_profile.pbpTheme` | 进度条主题色 |
| `pbpState` | `number` | `nova_player_profile.pbpState` | 进度条开关 |
| `userPreferences` | `UserPreferences` | `nova_player_profile.userPreferences` | 用户偏好 |

### 3.2 运行时状态（仅内存）

定义于 `store/types.ts` 的 `PlayerRuntimeState`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `isPlaying` | `boolean` | 是否正在播放 |
| `isPaused` | `boolean` | 是否已暂停 |
| `isLoading` | `boolean` | 是否正在加载 |
| `isEnded` | `boolean` | 是否已结束 |
| `isWaiting` | `boolean` | 是否等待缓冲 |
| `duration` | `number` | 视频总时长 |
| `buffered` | `number` | 已缓冲时长 |
| `currentQuality` | `number` | 当前画质编号 |
| `currentAudioQuality` | `number` | 当前音频质量编号 |
| `availableQualities` | `QualityOption[]` | 可用画质列表 |
| `availablePlaybackRates` | `number[]` | 可用播放速度列表 |
| `screenMode` | `'normal' \| 'wide' \| 'web_fullscreen' \| 'fullscreen'` | 屏幕模式 |
| `isPip` | `boolean` | 是否画中画 |

### 3.3 订阅机制（类型安全）

PlayerStore 的 `subscribe` 是类型安全的：

```typescript
// key 与 listener 的类型参数一致
store.subscribe('volume', (newVal: number, oldVal: number) => { ... });
store.subscribe('isMuted', (newVal: boolean, oldVal: boolean) => { ... });
store.subscribe('screenMode', (newVal: string, oldVal: string) => { ... });
```

---

## 四、TypedEventBus（类型安全事件总线）

### 4.1 核心接口

定义于 `core/eventBus.ts`：

```typescript
export interface TypedEventBus<TMap extends Record<string, unknown>> {
  on<K extends keyof TMap>(
    event: K,
    handler: TMap[K] extends undefined ? () => void : (payload: TMap[K]) => void
  ): () => void;

  off<K extends keyof TMap>(
    event: K,
    handler: TMap[K] extends undefined ? () => void : (payload: TMap[K]) => void
  ): void;

  emit<K extends keyof TMap>(
    event: K,
    ...args: TMap[K] extends undefined ? [] : [payload: TMap[K]]
  ): void;
}
```

### 4.2 通知策略

TypedEventBus 的 `emit` 采用同步调用 + try-catch 异常隔离（详见 2.7 节）：

- `emit()` 调用后监听器立即同步执行，零延迟
- 每个监听器用 try-catch 包裹，异常不会影响其他监听器
- 保证事件间依赖关系（如 `player:mounted` → `load()` 的顺序）

### 4.3 类型推断效果

```typescript
const events: PlayerEventBus = player.events;

// 无 payload 事件 → handler 自动推断为 () => void
events.on('play', () => { ... });

// 有 payload 事件 → handler 自动推断 payload 类型
events.on('volumeChange', (payload) => {
  // payload 自动推断为 { volume: number; muted: boolean }
  console.log(payload.volume);
});

// 事件名拼写错误 → 编译时报错
events.on('volumChange', ...);  // ❌ TS 错误
```

---

## 五、逐状态详细分析

### 5.1 播放状态（player.state）

**含义**：播放器当前处于哪个阶段

| 枚举值 | 说明 |
|--------|------|
| `PlayerState.IDLE` | 空闲（初始/元数据加载完成） |
| `PlayerState.LOADING` | 加载中 |
| `PlayerState.PLAYING` | 播放中 |
| `PlayerState.PAUSED` | 已暂停 |
| `PlayerState.ENDED` | 播放结束 |
| `PlayerState.ERROR` | 发生错误 |
| `PlayerState.BUFFERING` | 缓冲中 |

**三系统同步更新时机**：

| 触发场景 | TypedStateManager | PlayerStore | EventBus |
|----------|-------------------|-------------|----------|
| `loadstart` 事件 | `state.set(PlayerStateKeyEnum.STATE, PlayerState.LOADING)` | `store.setLoading(true)` | `events.emit('stateChange', 'loading')` |
| `loadedmetadata` 事件 | `state.set(PlayerStateKeyEnum.STATE, PlayerState.IDLE)` | `store.setLoading(false)` | `events.emit('stateChange', 'idle')` |
| `play()` 成功 | `state.set(PlayerStateKeyEnum.STATE, PlayerState.PLAYING)` | `store.setPlaying(true)` + `setPaused(false)` + `setEnded(false)` | `events.emit('stateChange', 'playing')` + `emit('play')` |
| `pause()` | `state.set(PlayerStateKeyEnum.STATE, PlayerState.PAUSED)` | `store.setPlaying(false)` + `setPaused(true)` | `events.emit('stateChange', 'paused')` + `emit('pause')` |
| `ended` 事件 | `state.set(PlayerStateKeyEnum.STATE, PlayerState.ENDED)` | `store.setPlaying(false)` + `setEnded(true)` | `events.emit('stateChange', 'ended')` + `emit('ended')` |

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.isPlaying`，通过 video 元素的 `play`/`pause`/`ended` 事件更新
- Controls 通过 `onPlayPause` 回调通知父组件切换播放/暂停
- State 组件通过 `lifecycle.emit('stateMounted', { showPlayIcon, hidePlayIcon })` 暴露 API，父组件调用 `showPlayIcon()` / `hidePlayIcon()` 更新播放图标

**插件监听方式**：
```typescript
player.events.on('stateChange', (state) => { ... });
player.events.on('play', () => { ... });
player.events.on('pause', () => { ... });
player.events.on('ended', () => { ... });
```

---

### 5.2 音量（player.volume）

**类型**：`number` (0-1)

**三系统同步更新时机**（`VideoPlayer.setVolume()` 第 890-910 行）：

| 系统 | 调用 |
|------|------|
| TypedStateManager | `state.set(PlayerStateKeyEnum.VOLUME, clampedVolume)` |
| PlayerStore | `store.setVolume(clampedVolume)` → 同时写入 localStorage |
| EventBus | `events.emit('volumeChange', { volume, muted })` |
| HTMLVideoElement | `videoEl.volume = clampedVolume` |
| 用户回调 | `callbacks.volumechange?.(volume, muted)` |

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.volume`，初始化为 `props.volume ?? 0.3`
- 通过 props 传递：`PlayerDocker → Controls → RightControls → VolumeSlider`
- VolumeSlider 内部维护 `currentVolume`，通过 `lifecycle.emit('volumeSliderMounted', { setVolume })` 暴露更新 API
- VolumeHint 通过 `lifecycle.emit('volumeHintMounted', { setVolume })` 暴露更新 API

**组件更新流程**：
```
用户拖动音量滑块
  → VolumeSlider.lifecycle.emit('volumeChange', vol)
  → RightControls 接收回调 → lifecycle.emit('volumeChange', vol)
  → Controls 接收回调 → props.onVolumeChange(vol)
  → PlayerDocker 接收回调 → playerInfo.volume = vol
  → PlayerDocker 调用 controlsApi.updateVolumeDisplay(vol)
  → 同时调用 VideoPlayer.setVolume(vol) 更新三系统
```

**插件监听方式**：
```typescript
player.events.on('volumeChange', (payload) => {
  console.log(payload.volume, payload.muted);
});
```

---

### 5.3 静音（player.muted）

**类型**：`boolean`

**三系统同步更新时机**：

| 触发场景 | TypedStateManager | PlayerStore | EventBus | videoEl |
|----------|-------------------|-------------|----------|---------|
| `setVolume(vol)` 且 vol=0 | `state.set(PlayerStateKeyEnum.MUTED, true)` | `store.setMuted(true)` | `emit('volumeChange', { muted: true })` | `videoEl.muted = true` |
| `setMuted(true/false)` | `state.set(PlayerStateKeyEnum.MUTED, muted)` | `store.setMuted(muted)` | `emit('mutedChange', muted)` | `videoEl.muted = muted` |
| `toggleMute()` | 读取当前值后调用 `setMuted(!current)` | 同上 | 同上 | 同上 |

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.isMuted`，初始化为 `props.muted ?? false`
- 通过 props 传递：`PlayerDocker → Controls → RightControls → VolumeSlider`
- VolumeSlider 内部维护 `isMuted`，通过 `lifecycle.emit('volumeSliderMounted', { setMuted })` 暴露更新 API
- VolumeHint 通过 `lifecycle.emit('volumeHintMounted', { setMuted })` 暴露更新 API

**插件监听方式**：
```typescript
player.events.on('mutedChange', (muted) => { ... });
player.events.on('volumeChange', (payload) => { ... });  // payload.muted
```

---

### 5.4 当前时间（player.currentTime）

**类型**：`number`（秒）

**更新时机**（`bindVideoEvents` 第 570-576 行）：

| 系统 | 调用 |
|------|------|
| TypedStateManager | `state.set(PlayerStateKeyEnum.CURRENT_TIME, currentTime)` |
| EventBus | `events.emit('timeUpdate', { time: currentTime })` |
| 用户回调 | `callbacks.timeupdate?.(currentTime, duration)` |

**⚠️ 注意**：`timeupdate` 是高频事件（约每 250ms 触发一次），**不更新 PlayerStore**（避免频繁 localStorage 写入）。

**组件获取方式**：
- PlayerDocker 内部维护 `videoInfo.currentTime`，通过 video 元素的 `timeupdate` 事件更新
- 通过 `controlsApi.updateCurrent(time)` 主动推送给 Controls
- ProgressBar 通过 `lifecycle.emit('progressBarMounted', { updateProgress })` 暴露更新 API
- Mini 通过 `lifecycle.emit('miniMounted', { updateCurrent })` 暴露更新 API

**插件监听方式**：
```typescript
player.events.on('timeUpdate', (payload) => {
  console.log(payload.time);
});
```

---

### 5.5 时长（player.duration）

**类型**：`number`（秒）

**更新时机**（`bindVideoEvents` 第 528-533 行）：

| 系统 | 调用 |
|------|------|
| TypedStateManager | `state.set(PlayerStateKeyEnum.DURATION, duration)` |
| PlayerStore | `store.setDuration(duration)` |
| EventBus | 无专门事件（通过 `stateChange` 间接通知） |

**组件获取方式**：
- PlayerDocker 内部维护 `videoInfo.duration`，通过 video 元素的 `loadedmetadata` 事件更新
- 通过 props 传递：`PlayerDocker → Controls(duration) → TopControls → ProgressBar`
- Controls 通过 `controlsApi.initDuration()` 初始化时长显示

---

### 5.6 缓冲进度（player.buffered）

**类型**：`number`（秒）

**更新时机**（`bindVideoEvents` 第 560-566 行）：

| 系统 | 调用 |
|------|------|
| TypedStateManager | `state.set(PlayerStateKeyEnum.BUFFERED, bufferedEnd)` |
| PlayerStore | `store.setBuffered(bufferedEnd)` |
| 用户回调 | `callbacks.progress?.(buffered)` |

**组件获取方式**：
- PlayerDocker 内部维护 `videoInfo.buffer`，通过 video 元素的 `progress` 事件更新
- 通过 `controlsApi.updateBuffer(buffer)` 主动推送给 Controls
- ProgressBar 通过 `lifecycle.emit('progressBarMounted', { updateBuffer })` 暴露更新 API
- Mini 通过 `lifecycle.emit('miniMounted', { updateBuffer })` 暴露更新 API

---

### 5.7 全屏状态（player.isFullscreen）

**类型**：`boolean`

**更新时机**：

| 触发场景 | TypedStateManager | PlayerStore | EventBus |
|----------|-------------------|-------------|----------|
| 浏览器 `fullscreenchange` 事件 | `state.set(PlayerStateKeyEnum.IS_FULLSCREEN, isFullscreen)` | `store.setScreenMode('fullscreen'/'normal')` | `events.emit('fullscreenChange', { isFullscreen })` |
| `toggleFullscreen()` 主动切换 | 同上 | 同上 | 同上 |

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.dataScreen`，通过 `document.fullscreenchange` 事件更新
- PlayerDocker 监听 `dblclick` 事件调用 `toggleFullscreen()`

**插件监听方式**：
```typescript
player.events.on('fullscreenChange', (payload) => {
  console.log(payload.isFullscreen);
});
```

---

### 5.8 画中画状态（player.isPip）

**类型**：`boolean`

**更新时机**：

| 触发场景 | TypedStateManager | PlayerStore | EventBus |
|----------|-------------------|-------------|----------|
| `enterpictureinpicture` 事件 | `state.set(PlayerStateKeyEnum.IS_PIP, true)` | `store.setPip(true)` | `events.emit('pipChange', { isPip: true })` |
| `leavepictureinpicture` 事件 | `state.set(PlayerStateKeyEnum.IS_PIP, false)` | `store.setPip(false)` | `events.emit('pipChange', { isPip: false })` |
| `togglePip()` 主动切换 | 同上 | 同上 | 同上 |

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.isPip`，通过 `enterpictureinpicture`/`leavepictureinpicture` 事件更新

**插件监听方式**：
```typescript
player.events.on('pipChange', (payload) => {
  console.log(payload.isPip);
});
```

---

### 5.9 播放速度（player.playbackRate）

**类型**：`number`

**三系统同步更新时机**（`VideoPlayer.setPlaybackRate()` 第 947-961 行）：

| 系统 | 调用 |
|------|------|
| TypedStateManager | `state.set(PlayerStateKeyEnum.PLAYBACK_RATE, rate)` |
| PlayerStore | `store.setPlaybackRate(rate)` → 同时写入 localStorage |
| EventBus | `events.emit('rateChange', rate)` |
| HTMLVideoElement | `videoEl.playbackRate = rate` |
| 用户回调 | `callbacks.ratechange?.(rate)` |

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.backrate`
- 通过 props 传递：`PlayerDocker → Controls(backrate) → RightControls(rate) → PlaybackRateMenu(rate)`
- PlaybackRateMenu 通过 `lifecycle.emit('rateChange', rateValue)` 通知父组件

**插件监听方式**：
```typescript
player.events.on('rateChange', (rate) => { ... });
```

---

### 5.10 画质（player.quality）

**类型**：`QualityLevel`（string）

**三系统同步更新时机**（`VideoPlayer.setQuality()` 第 1000-1008 行）：

| 系统 | 调用 |
|------|------|
| TypedStateManager | `state.set(PlayerStateKeyEnum.QUALITY, quality)` |
| EventBus | `events.emit('qualityChange', { quality })` |

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.qualityIndex`
- 通过 props 传递：`PlayerDocker → Controls → RightControls(qualities, currentQuality) → QualityMenu`
- QualityMenu 通过 `lifecycle.emit('qualityChange', value)` 通知父组件

**插件监听方式**：
```typescript
player.events.on('qualityChange', (payload) => {
  console.log(payload.quality);
});
```

---

### 5.11 加载状态（player.isLoading）

**类型**：`boolean`

**更新时机**：

| 触发场景 | TypedStateManager | PlayerStore |
|----------|-------------------|-------------|
| `loadstart` 事件 | `state.set(PlayerStateKeyEnum.IS_LOADING, true)` | `store.setLoading(true)` |
| `loadedmetadata` 事件 | `state.set(PlayerStateKeyEnum.IS_LOADING, false)` | `store.setLoading(false)` |

**组件获取方式**：
- Loading 组件通过 `lifecycle.emit('loadingMounted', { show, hide })` 暴露 API
- PlayerDocker 在 `waiting` 事件时调用 `loadingApi.show()`，在 `canplay` 事件时调用 `loadingApi.hide()`

---

### 5.12 缓冲等待状态（isWaiting）

**类型**：`boolean`

**更新时机**：

| 触发场景 | PlayerStore | EventBus |
|----------|-------------|----------|
| `waiting` 事件 | `store.setWaiting(true)` | `events.emit('waiting')` |
| `canplay` 事件 | `store.setWaiting(false)` | `events.emit('canPlay')` |

**组件获取方式**：
- State 组件通过 `lifecycle.emit('stateMounted', { showBuffering, hideBuffering })` 暴露 API
- PlayerDocker 在 `waiting` 事件时调用 `stateApi.showBuffering()`，在 `canplay` 事件时调用 `stateApi.hideBuffering()`

---

### 5.13 Seek 状态（player.isSeeking）

**类型**：`boolean`

**更新时机**（`VideoPlayer.seek()` 第 869-883 行）：

| 系统 | 调用 |
|------|------|
| EventBus | `events.emit('seekStart', { time, previousTime })` |
| HTMLVideoElement | `videoEl.currentTime = clampedTime` |
| EventBus | `events.emit('seekEnd', { time, previousTime })` |

**组件获取方式**：
- ProgressBar 拖拽时通过 `lifecycle.emit('seekStart')` / `lifecycle.emit('seek', t)` / `lifecycle.emit('seekEnd')` 通知
- Controls 接收后调用 `props.onSeekStart()` / `props.onSeek(time)` / `props.onSeekEnd()`

**插件监听方式**：
```typescript
player.events.on('seekStart', (payload) => {
  console.log(payload.time, payload.previousTime);
});
player.events.on('seekEnd', (payload) => {
  console.log(payload.time, payload.previousTime);
});
```

---

### 5.14 错误状态（error.code / error.message）

**类型**：`{ code: number; message: string }`

**更新时机**（`VideoPlayer.reload()` 第 1046-1047 行）：

| 系统 | 调用 |
|------|------|
| TypedStateManager | `state.set(PlayerStateKeyEnum.ERROR_CODE, 0)` + `state.set(PlayerStateKeyEnum.ERROR_MESSAGE, '')` |
| EventBus | `events.emit('error', { error, code, message })` |

**插件监听方式**：
```typescript
player.events.on('error', (payload) => {
  console.log(payload.code, payload.message);
});
```

---

### 5.15 屏幕模式（screenMode）

**类型**：`'normal' | 'wide' | 'web_fullscreen' | 'fullscreen'`

**存储位置**：仅 PlayerStore

| 触发场景 | PlayerStore |
|----------|-------------|
| `fullscreenchange` 事件 | `store.setScreenMode('fullscreen'/'normal')` |
| `toggleFullscreen()` | 同上 |

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.dataScreen`
- RightControls 通过 `lifecycle.emit('fullscreen')` / `lifecycle.emit('webFullscreen')` 通知切换

---

### 5.16 宽屏模式（isWideScreen）

**类型**：`boolean`

**存储位置**：PlayerStore（持久化）

**组件获取方式**：
- PlayerDocker 内部维护 `playerInfo.isWide`
- RightControls 通过 `lifecycle.emit('wide')` 通知切换

---

## 六、组件层状态通信模式

### 6.1 核心原则：组件可通过 useState + useContext 直接订阅状态

UI 组件现在有两种方式与状态系统交互：

**方式一：useState + useContext 直接订阅（推荐，新组件优先使用）**

```typescript
// 通过 Context 获取状态管理器，无需 props 传递
const state = useContext(StateContext);

if (state) {
  useState(
    state,
    PlayerStateKeyEnum.VOLUME,
    (newVol) => { el.textContent = `${Math.round((newVol as number) * 100)}%`; },
    lifecycle
  );
}
```

**方式二：Props + 回调 + API 反向调用（旧模式，现有组件继续使用）**

组件通过 Props 下传、回调上抛、API 反向推送与状态系统交互，不直接调用 `state.get()` / `state.set()` / `store.getXxx()`。

两种模式可以共存，`useState` + `useContext` 是可选的便捷工具。

```
┌─────────────────────────────────────────────────────────────┐
│                      PlayerDocker                            │
│                   （组件层状态中枢）                            │
│                                                              │
│  内部状态: playerInfo / videoInfo                             │
│  监听: video 元素事件 + DOM 事件                               │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Props    │  │ 回调     │  │ API 调用  │                   │
│  │ 下传     │  │ 上抛     │  │ 反向推送  │                   │
│  │ 父→子    │  │ 子→父    │  │ 父→子    │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       │              │              │                         │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐                   │
│  │Controls  │  │onPlayPause│  │updateCurr│                   │
│  │Volume    │  │onSeek     │  │updateBuff│                   │
│  │Progress  │  │onVolumeChg│ │updateMute│                   │
│  │...       │  │onMuteToggl│  │show/hide │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 三种通信模式详解

#### 模式一：Props 下传（父→子，初始状态传递）

父组件持有主状态，通过 props 传递具体值给子组件：

```typescript
// PlayerDocker 传给 Controls
h(Controls, {
  duration: videoInfo.duration,   // 时长
  volume: playerInfo.volume,      // 音量
  backrate: playerInfo.backrate,  // 倍速
  config: { ... },                // 控制栏配置
})

// Controls 传给 RightControls
h(RightControls, {
  volume,                         // 音量
  muted,                          // 静音
  qualities,                      // 画质列表
  currentQuality,                 // 当前画质
  rate,                           // 倍速
})

// RightControls 传给 VolumeSlider
h(VolumeSlider, {
  volume,                         // 音量
  muted,                          // 静音
})
```

**特点**：单向数据流，子组件只读不写。

#### 模式二：回调上抛（子→父，用户交互通知）

子组件通过 `props.onXxx` 回调通知父组件状态变化：

```typescript
// VolumeSlider → RightControls → Controls → PlayerDocker
// 用户拖动音量滑块
VolumeSlider.lifecycle.emit('volumeChange', vol)
  → RightControls.props.onVolumeChange(vol)
  → Controls.props.onVolumeChange(vol)
  → PlayerDocker 调用 VideoPlayer.setVolume(vol)
```

**特点**：事件冒泡式，每一层都需要手动传递回调。

#### 模式三：API 反向调用（父→子，运行时状态更新）

子组件挂载时通过 `lifecycle.emit` 暴露 API 方法，父组件保存引用后主动调用：

```typescript
// 子组件暴露 API
lifecycle.onMounted = () => {
  lifecycle.emit?.('volumeSliderMounted', { setVolume, setMuted });
};

// 父组件保存引用并调用
const volumeSliderApi = { setVolume: () => {}, setMuted: () => {} };
// ... 在 onVolumeSliderMounted 回调中保存
volumeSliderApi.setVolume(0.5);
volumeSliderApi.setMuted(true);
```

**特点**：父组件主动推送更新，子组件被动接收。适用于高频更新场景（如 `timeupdate`）。

### 6.3 所有组件暴露的 API 一览

| 组件 | 暴露事件名 | API 方法 |
|------|-----------|---------|
| Controls | `controlsMounted` | `updateVolumeDisplay`, `showControl`, `hideControl`, `updateMute`, `updateBuffer`, `updateCurrent`, `initDuration` |
| ProgressBar | `progressBarMounted` | `updateProgress`, `updateBuffer` |
| VolumeSlider | `volumeSliderMounted` | `setVolume`, `setMuted` |
| State | `stateMounted` | `updateBufferSpeed`, `showBuffering`, `hideBuffering`, `showPlayIcon`, `hidePlayIcon` |
| Loading | `loadingMounted` | `show`, `hide`, `setText` |
| Mini | `miniMounted` | `updateBuffer`, `updateCurrent`, `show`, `hide` |
| VolumeHint | `volumeHintMounted` | `show`, `hide`, `setVolume`, `setMuted` |
| Top | `topMounted` | `setTitle`, `setAvatar`, `show`, `hide` |
| RowDm | `danmakuLayerMounted` | `playPause`, `createDanmaku`, `showDmTip`, `hideDmTip` |
| SubtitleLayer | `subtitleLayerMounted` | `setFontSize`, `setColor`, `setBackgroundColor`, `setPosition` |
| InteractionLayer | `interactionLayerMounted` | `container` |
| Dialog | `dialogMounted` | `showDmTip`, `hideDmTip` |
| SendBar | `sendBarMounted` | `setInputValue`, `setDanmakuSwitch`, `focusInput`, `blurInput` |
| DmSetting | `dmSettingMounted` | `setOpacity`, `setArea`, `setFontsize`, `setSpeed` |
| ColorPanel | `colorPanelMounted` | `setSaturate`, `setBrightness`, `setContrast`, `show`, `hide` |
| Selection | `selectionMounted` | `setColor`, `setMode`, `setSize` |
| HotkeyPanel | `hotkeyPanelMounted` | `show`, `hide` |
| PbpControls | `pbpControlsMounted` | `show`, `hide` |

---

## 七、插件层状态监听方式

插件通过 `player.events.on()` 监听状态变化，这是**跨模块通信的主要方式**：

```typescript
// 弹幕插件示例
const events: PlayerEventBus = player.events;

const unsubPlay = events.on(PlayerEventEnum.PLAY, () => { ... });
const unsubPause = events.on(PlayerEventEnum.PAUSE, () => { ... });
const unsubTimeUpdate = events.on(PlayerEventEnum.TIME_UPDATE, (payload) => { ... });
const unsubFullscreen = events.on(PlayerEventEnum.FULLSCREEN_CHANGE, (payload) => { ... });
const unsubVolume = events.on(PlayerEventEnum.VOLUME_CHANGE, (payload) => { ... });
```

插件也可以直接读取 TypedStateManager 和 PlayerStore：

```typescript
// 读取当前状态（类型安全，自动推断返回类型）
const volume = player.state.get(PlayerStateKeyEnum.VOLUME);     // number | undefined
const isPlaying = player.store.getState().isPlaying;

// 订阅状态变化（类型安全，listener 参数自动推断）
player.state.subscribe(PlayerStateKeyEnum.VOLUME, (newVal, oldVal) => {
  // newVal: number, oldVal: number
});
player.store.subscribe('volume', (newVal, oldVal) => { ... });
```

---

## 八、完整事件映射表

### PlayerEventMap 中所有事件的 payload 类型和触发时机

| 事件名 | Payload 类型 | 触发时机 |
|--------|-------------|---------|
| `stateChange` | `string` | 播放状态变化（IDLE/LOADING/PLAYING/PAUSED/ENDED） |
| `play` | `undefined` | 播放成功 |
| `pause` | `undefined` | 暂停 |
| `ended` | `undefined` | 播放结束 |
| `timeUpdate` | `{ time: number }` | 播放时间更新（~250ms） |
| `volumeChange` | `{ volume: number; muted: boolean }` | 音量变化 |
| `mutedChange` | `boolean` | 静音状态变化 |
| `rateChange` | `number` | 播放速度变化 |
| `qualityChange` | `{ quality: string; name?: string; isBackup?: boolean } \| string` | 画质变化 |
| `fullscreenChange` | `{ isFullscreen: boolean }` | 全屏状态变化 |
| `pipChange` | `{ isPip: boolean }` | 画中画状态变化 |
| `seekStart` | `{ time: number; previousTime: number }` | 开始 seek |
| `seekEnd` | `{ time: number; previousTime: number }` | seek 完成 |
| `waiting` | `undefined` | 缓冲等待开始 |
| `canPlay` | `undefined` | 可以播放 |
| `ready` | `undefined` | 播放器就绪 |
| `mounted` | `{ container?; video?; sendingArea? }` | 播放器挂载完成 |
| `destroy` | `undefined` | 播放器销毁 |
| `error` | `{ error: unknown; code?: number; message?: string }` | 错误发生 |
| `resize` | `Record<string, unknown>` | 容器尺寸变化 |
| `controlsShow` | `undefined` | 控制栏显示 |
| `controlsHide` | `undefined` | 控制栏隐藏 |
| `danmakuToggle` | `undefined` | 弹幕开关切换 |
| `danmakuSend` | `{ text: string; options?: Record<string, unknown> }` | 发送弹幕 |
| `subtitleSwitch` | `{ lang: string }` | 字幕语言切换 |
| `subtitleToggle` | `undefined` | 字幕开关切换 |
| `streamLoadComplete` | `Record<string, unknown>` | 流媒体加载完成 |
| `streamError` | `{ message?; error?; [key: string]: unknown }` | 流媒体错误 |
| `streamStatsUpdate` | `Record<string, unknown>` | 流媒体统计更新 |
| `streamMetadataLoaded` | `Record<string, unknown>` | 流媒体元数据加载 |
| `streamPlayStart` | `undefined` | 流媒体播放开始 |
| `streamPlayPause` | `undefined` | 流媒体播放暂停 |
| `streamBufferStart` | `undefined` | 流媒体缓冲开始 |
| `streamBufferEnd` | `undefined` | 流媒体缓冲结束 |
| `streamNetworkError` | `Record<string, unknown>` | 流媒体网络错误 |
| `streamDecodeError` | `Record<string, unknown>` | 流媒体解码错误 |

---

## 九、数据流完整示例

### 示例：用户拖动音量滑块

```
1. 用户鼠标拖动 VolumeSlider 滑块
   ↓
2. VolumeSlider 内部更新 currentVolume
   ↓
3. VolumeSlider.lifecycle.emit('volumeChange', vol)
   ↓
4. RightControls 接收 → lifecycle.emit('volumeChange', vol)
   ↓
5. Controls 接收 → props.onVolumeChange(vol)
   ↓
6. PlayerDocker 接收 → 更新 playerInfo.volume
   ↓
7. PlayerDocker 调用 VideoPlayer.setVolume(vol)
   ├→ state.set(PlayerStateKeyEnum.VOLUME, vol)                    // TypedStateManager 更新
   ├→ state.set(PlayerStateKeyEnum.MUTED, vol === 0)               // TypedStateManager 更新
   ├→ store.setVolume(vol)                        // PlayerStore + localStorage 更新
   ├→ store.setMuted(vol === 0)                   // PlayerStore + localStorage 更新
   ├→ videoEl.volume = vol                        // HTMLVideoElement 更新
   ├→ videoEl.muted = vol === 0                   // HTMLVideoElement 更新
   ├→ events.emit('volumeChange', { volume, muted })  // EventBus 通知插件
   └→ callbacks.volumechange?.(vol, muted)        // 用户回调
   ↓
8. PlayerDocker 调用 controlsApi.updateVolumeDisplay(vol)  // 反向推送更新 UI
   ↓
9. PlayerDocker 调用 volumeHintApi.setVolume(vol)          // 反向推送更新音量提示
   ↓
10. 插件通过 events.on('volumeChange', cb) 收到通知
```

### 示例：视频播放时间更新

```
1. HTMLVideoElement 触发 'timeupdate' 事件
   ↓
2. VideoPlayer.bindVideoEvents 中的 timeupdate 处理器
   ├→ state.set(PlayerStateKeyEnum.CURRENT_TIME, currentTime)              // TypedStateManager 更新
   ├→ events.emit('timeUpdate', { time: currentTime })    // EventBus 通知插件
   └→ callbacks.timeupdate?.(currentTime, duration)       // 用户回调
   ↓
3. PlayerDocker 内部 timeupdate 处理器
   ├→ videoInfo.currentTime = currentTime                 // 内部状态更新
   ├→ controlsApi.updateCurrent(currentTime)              // 反向推送 Controls
   ├→ miniApi.updateCurrent(currentTime)                  // 反向推送 Mini
   └→ props.events?.emit('timeUpdate', { time })          // 转发给外部 EventBus
   ↓
4. Controls 接收 updateCurrent
   ├→ 更新进度条显示
   └→ 更新时间文本
   ↓
5. 插件通过 events.on('timeUpdate', cb) 收到通知
```

---

## 十、PlayerStateKeyEnum 完整枚举值

### 统一定义（`packages/player/src/store/runtimeState.ts`）

`PlayerStateKeyEnum` 现在只有一份定义，枚举值为路径式字符串，与 `PlayerStateMap` 的 key 完全一致，确保 `state.get(PlayerStateKeyEnum.XXX)` 的路径与类型映射表对应。

#### 播放状态

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `STATE` | `'player.state'` | `PlayerState` | setState()、play()、pause() |
| `CURRENT_TIME` | `'player.currentTime'` | `number` | bindVideoEvents/timeupdate、seek() |
| `DURATION` | `'player.duration'` | `number` | bindVideoEvents/loadedmetadata、seek() |
| `BUFFERED` | `'player.buffered'` | `number` | bindVideoEvents/progress |

#### 音量状态

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `VOLUME` | `'player.volume'` | `number` | setVolume()、toggleMute() |
| `MUTED` | `'player.muted'` | `boolean` | setVolume()、setMuted()、toggleMute() |

#### 播放属性

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `PLAYBACK_RATE` | `'player.playbackRate'` | `number` | setPlaybackRate() |
| `QUALITY` | `'player.quality'` | `string` | setQuality() |

#### 显示状态

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `IS_FULLSCREEN` | `'player.isFullscreen'` | `boolean` | toggleFullscreen()、fullscreenchange |
| `IS_PIP` | `'player.isPip'` | `boolean` | togglePip() |
| `IS_WEB_FULLSCREEN` | `'player.isWebFullscreen'` | `boolean` | 预留 |
| `IS_WIDE_SCREEN` | `'player.isWideScreen'` | `boolean` | 预留 |

#### 视频属性

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `VIDEO_WIDTH` | `'video.width'` | `number` | 预留 |
| `VIDEO_HEIGHT` | `'video.height'` | `number` | 预留 |
| `ASPECT_RATIO` | `'video.aspectRatio'` | `number` | 预留 |

#### 错误状态

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `ERROR_CODE` | `'player.errorCode'` | `number` | reload() |
| `ERROR_MESSAGE` | `'player.errorMessage'` | `string` | reload() |

#### 加载状态

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `IS_LOADING` | `'player.isLoading'` | `boolean` | bindVideoEvents/loadstart/loadedmetadata |
| `LOAD_PROGRESS` | `'player.loadProgress'` | `number` | 预留 |

#### 控制栏状态

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `CONTROLS_VISIBLE` | `'player.controlsVisible'` | `boolean` | 预留 |
| `CONTROLS_HOVER` | `'player.controlsHover'` | `boolean` | 预留 |

#### 弹幕状态

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `DANMAKU_VISIBLE` | `'player.danmakuVisible'` | `boolean` | 预留 |
| `DANMAKU_OPACITY` | `'player.danmakuOpacity'` | `number` | 预留 |
| `DANMAKU_SPEED` | `'player.danmakuSpeed'` | `number` | 预留 |
| `DANMAKU_DENSITY` | `'player.danmakuDensity'` | `number` | 预留 |

#### 字幕状态

| 枚举名 | 值 | PlayerStateMap 类型 | VideoPlayer 中使用位置 |
|--------|---|---------------------|----------------------|
| `SUBTITLE_VISIBLE` | `'player.subtitleVisible'` | `boolean` | 预留 |
| `SUBTITLE_LANG` | `'player.subtitleLang'` | `string` | 预留 |
