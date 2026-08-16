# hili-player 开发与设计文档

> 版本: 5.0 | 日期: 2026-05-25

---

## 目录

1. [项目说明](#1-项目说明)
2. [编码规范](#2-编码规范)
3. [渲染机制](#3-渲染机制)
4. [类型系统](#4-类型系统)
5. [代码去重](#5-代码去重)
6. [插件接口设计](#6-插件接口设计)
7. [Debug 模式](#7-debug-模式)
8. [弹幕系统](#8-弹幕系统)
9. [流媒体插件](#9-流媒体插件)
10. [StreamMiddleware 中间件](#10-streammiddleware-中间件)
11. [回调与事件系统](#11-回调与事件系统)
12. [码率监控修复](#12-码率监控修复)
13. [浏览器检测](#13-浏览器检测)
14. [SSR 方案](#14-ssr-方案)
15. [文件结构](#15-文件结构)
16. [实施路线图](#16-实施路线图)
17. [附录 A: PlayerDocker 入口组件](#17-附录-a-playerdocker-入口组件)
18. [附录 B: Controls 控制条组件](#18-附录-b-controls-控制条组件)
19. [附录 C: LeftControls 左按钮组](#19-附录-c-leftcontrols-左按钮组)
20. [附录 D: RightControls 右按钮组](#20-附录-d-rightcontrols-右按钮组)
21. [附录 E: TopControls 进度条区域](#21-附录-e-topcontrols-进度条区域)
22. [附录 F: PbpControls 高能进度条](#22-附录-f-pbpcontrols-高能进度条)
23. [附录 G: SendBar 发送栏](#23-附录-g-sendbar-发送栏)
24. [附录 H: DmSetting 弹幕设置](#24-附录-h-dmsetting-弹幕设置)
25. [附录 I: Selection 模式选择](#25-附录-i-selection-模式选择)
26. [附录 J: Ending 结束面板](#26-附录-j-ending-结束面板)
27. [附录 K: RowCmd 互动命令](#27-附录-k-rowcmd-互动命令)
28. [附录 L: RowDm 弹幕容器](#28-附录-l-rowdm-弹幕容器)
29. [附录 M: 其余组件](#29-附录-m-其余组件)
30. [附录 N: VideoPlayer 核心类](#30-附录-n-videoplayer-核心类)
31. [附录 O: 各组件详细 h() 代码](#附录-o-各组件详细-h-代码)
32. [附录 P: 精细化拆分子组件](#附录-p-精细化拆分子组件)
33. [附录 Q: Lottie 图标系统](#附录-q-lottie-图标系统)
34. [附录 R: 组件 API 参考](#附录-r-组件-api-参考)
35. [附录 S: 跨组件事件通信 — EventBus 设计](#附录-s-跨组件事件通信--eventbus-设计)
36. [附录 T: 互动插件重构](#附录-t-互动插件重构)

---

## 1. 项目说明

### 1.1 目录结构

```
hili-player/
├── player-reference/     # [参考] 禁止修改
│   └── src/
│       ├── player.ts                     # 主入口
│       ├── component/component.ts        # Component 基类
│       └── component/<组件名>/           # 26个组件 (各含 index.ts + index.scss)
│
├── packages/
│   ├── player/src/
│   │   ├── player/VideoPlayer.ts         # 核心播放器
│   │   ├── components/                   # h() 函数组件
│   │   │   ├── PlayerDocker.ts           # 入口容器
│   │   │   ├── Controls.ts              # 控制条
│   │   │   ├── LeftControls.ts          # 左按钮组
│   │   │   ├── RightControls.ts         # 右按钮组
│   │   │   ├── TopControls.ts           # 进度条区域
│   │   │   ├── PbpControls.ts           # 高能进度条
│   │   │   ├── SendBar.ts              # 发送栏
│   │   │   ├── DmSetting.ts            # 弹幕设置面板
│   │   │   ├── Selection.ts            # 模式/颜色选择
│   │   │   ├── Top.ts                  # 顶部标题栏
│   │   │   ├── State.ts                # 暂停/缓冲图标
│   │   │   ├── Loading.ts              # 加载动画
│   │   │   ├── Toast.ts                # Toast提示
│   │   │   ├── Dialog.ts               # 弹幕详情弹窗
│   │   │   ├── Ending.ts               # 结束面板
│   │   │   ├── InteractionLayer.ts     # [新增] 互动容器 (替代RowCmd)
│   │   │   ├── RowDm.ts                # DOM弹幕容器
│   │   │   ├── Mini.ts                 # 迷你播放器
│   │   │   ├── Checkbox.ts             # 复选框
│   │   │   ├── Switch.ts               # 开关
│   │   │   ├── Slider.ts               # 滑块
│   │   │   ├── ColorPanel.ts           # 色彩调整面板
│   │   │   ├── HotkeyPanel.ts          # 快捷键面板
│   │   │   ├── VideoInfo.ts            # 统计信息面板
│   │   │   ├── ProgressClose.ts        # 进度关闭按钮
│   │   │   ├── VolumeHint.ts           # 音量提示
│   │   │   ├── Context.ts              # 右键菜单
│   │   │   └── Tooltips.ts             # 工具提示
│   │   ├── core/plugin.ts              # Plugin接口定义
│   │   ├── core/pluginManager.ts       # 插件管理器
│   │   ├── core/events.ts              # 事件枚举
│   │   └── utils/
│   │       ├── media/                  # 监控/图表
│   │       └── browserCapabilityDetector.ts
│   │
│   └── plugins/src/
│       ├── danmaku/
│       │   ├── index.ts                # DanmakuPlugin (插件入口)
│       │   ├── types.ts                # DanmakuPlugin 专用类型
│       │   └── engine/                 # 弹幕引擎 (插件内部，player 不碰)
│       │       ├── DanmakuManager.ts
│       │       ├── CanvasEngine.ts
│       │       ├── DOMEngine.ts
│       │       ├── Scheduler.ts
│       │       ├── TrackManager.ts
│       │       ├── ObjectPool.ts
│       │       ├── ScaleHelper.ts
│       │       └── types.ts
│       ├── subtitle/
│       │   ├── index.ts                # SubtitlePlugin (插件入口)
│       │   ├── types.ts
│       │   └── subtitleGenerator.ts
│       ├── interaction/
│       │   ├── index.ts                 # InteractionPlugin (主插件, 管理子插件)
│       │   ├── GuidePlugin.ts           # [新] 点赞关注子插件
│       │   ├── LinkPlugin.ts            # [新] 外链子插件
│       │   ├── VotePlugin.ts            # [新] 投票子插件
│       │   └── ScorePlugin.ts           # [新] 评分子插件
│       ├── hls/HlsPlugin.ts            # HlsPlugin
│       ├── dash/DashPlugin.ts          # DashPlugin
│       ├── flv/FlvPlugin.ts            # FlvPlugin
│       └── stream/                     # StreamPlugin 类型
│
├── core/                               # h() / mount() / state / eventBus / hooks
├── types/index.ts                      # VNode, PlayerConfig 等全局类型
├── media/                              # 独立监控工具
└── utils/rafInterval.ts                # RAF工具
```

### 1.2 既有播放器说明

`player-reference/src/` 是既有实现的播放器实现，使用 `Component` 基类模式：

- `template()` 返回 HTML 字符串定义 DOM
- `setup()` 中用 `querySelector` 获取元素引用并绑定事件
- 子组件通过 `new ChildComponent(container)` 实例化，传入容器元素
- 子组件向父组件通信用 `this.trigger("事件名", data)`
- 父组件监听子组件用 `child.on("事件名", handler)`

**我们从这个既有播放器提取**：DOM 结构、CSS 类名、交互逻辑。
**我们不使用**：Component 基类模式 — 改为 h() + defineComponent。

### 1.3 新框架说明

`packages/player/src/` 是使用 h() 函数的播放器实现：

- `h()` 创建 VNode 描述对象 → `materialize()` 构建真实 DOM → `mount()` 插入
- 组件使用 `defineComponent(setupFn)` 定义
- DOM 引用通过 `ref` 对象保存 (`{ current: HTMLElement | null }`)
- 组件间通信通过 Props (父→子) 和 Callback (子→父)
- 更新时不重新 render，直接操作 `ref.current`

---

## 2. 编码规范

> 以下规范来源于 `andrej-karpathy-skills/` skill，作为**硬性约束**嵌入所有开发工作。

### 2.1 Karpathy 四大原则

#### 原则一：编码前思考

**不要假设。不要隐藏困惑。呈现权衡。**

- **明确说明假设** — 如果不确定，询问而不是猜测
- **呈现多种解释** — 当存在歧义时，不要默默选择
- **适时提出异议** — 如果存在更简单的方法，说出来
- **困惑时停下来** — 指出不清楚的地方并要求澄清

#### 原则二：简洁优先

**用最少的代码解决问题。不要过度推测。**

- 不添加需求之外的功能
- 不为一次性代码创建抽象
- 不添加未要求的"灵活性"或"可配置性"
- 不为不可能发生的场景做错误处理
- **如果 200 行代码可以写成 50 行，重写它**
- 检验标准：资深工程师会觉得这过于复杂吗？

#### 原则三：精准修改

**只碰必须碰的。只清理自己造成的混乱。**

- 不要"改进"相邻的代码、注释或格式
- 不要重构没坏的东西
- 匹配现有风格，即使你更倾向不同的写法
- 只删除因你的改动而产生的孤儿代码
- 检验标准：每一行修改都应该能直接追溯到用户的请求

#### 原则四：目标驱动执行

**定义成功标准。循环验证直到达成。**

- 将指令式任务转化为可验证的目标
- 多步骤任务需要简短计划 + 验证步骤
- 强有力的成功标准让每个阶段可独立验证

### 2.2 注释规范

#### 文件头注释 (必须)

```typescript
/**
 * ============================================
 * [模块/组件名称]
 * ============================================
 * [功能描述：一句话说明这个模块做什么]
 *
 * [详细说明：架构设计、关键决策、使用场景]
 *
 * @module [模块标识]
 */
```

#### 类注释 (必须 — 带 @ 类型标注)

```typescript
/**
 * 视频播放器核心类
 *
 * 提供播放、暂停、进度控制、音量管理、全屏切换、
 * 画中画、插件注册管理等完整的视频播放功能。
 * 使用 h() 函数构建 DOM 结构，通过 ref 对象进行精准更新。
 *
 * 使用示例:
 * ```typescript
 * const player = new VideoPlayer({ src: 'video.mp4', autoplay: true });
 * player.mount(document.getElementById('player-container')!);
 * ```
 */
export class VideoPlayer implements ComponentInstance<PlayerConfig>, PlayerMethods { }
```

#### 方法/函数注释 (必须 — 带 @param @returns)

```typescript
/**
 * 设置音量并同步到持久化存储
 *
 * 将音量值钳制在 [0, 1] 范围内，更新 video 元素的 volume 属性，
 * 同时将音量值写入 localStorage 以便下次启动恢复。
 * 音量为 0 时自动切换为静音状态。
 *
 * @param volume - 目标音量值，范围 0 ～ 1（0 为静音，1 为最大音量）
 * @returns 无返回值 — 副作用：更新 DOM 和持久化存储
 */
setVolume(volume: number): void { ... }
```

#### 函数内部关键步骤注释

```typescript
// 步骤1: 钳制音量值到合法范围
const clampedVolume = clamp(volume, 0, 1);
// 步骤2: 音量为 0 时自动静音
const isMuted = clampedVolume === 0;
// 步骤3: 更新运行时状态 (触发 UI 更新)
this.state.set(PlayerStateKeyEnum.VOLUME, clampedVolume);
// 步骤4: 持久化到 localStorage
this.store.setVolume(clampedVolume);
```

#### 属性/字段注释

```typescript
/** 播放器配置 — 合并默认值后的完整配置对象 */
props: PlayerConfig;
/** 视频元素引用 — 挂载后赋值，销毁时置 null */
private videoEl: HTMLVideoElement | null = null;
```

#### 约束

- 注释用中文，代码标识符用英文
- 类/方法/函数必须带 `@param` / `@returns` / `@throws` 等 JSDoc 标注
- 函数内部关键步骤用 `// 步骤N: 描述` 注释
- 禁止写 "added for X flow"、"used by Y"、"handles the case from issue #Z" 等外部上下文引用
- 既有代码（不能动的）用 `[参考/不动]` 标记
- 已有正确代码用 `[已有/正确]` 标记
- 需要修改的代码用 `[已有/需改]` 标记

### 2.3 代码质量约束

- 每文件 ≤ 500 行，超过则拆分
- 每函数 ≤ 50 行，超过则提取子函数
- 禁止魔法数字，提取为命名常量
- 命名即文档：好的变量/函数名优先于注释

### 2.4 组件设计约束 — 高内聚低耦合

**这是硬性要求，每个组件必须遵守：**

```
父组件 (PlayerDocker)
  │
  │ Props (数据向下)              Callback (事件向上)
  ▼                                ▲
子组件 (Controls)                   │
  │  props: { duration, volume }   │  onPlayPause()
  │  ref: 内部 DOM, 外部不碰       │  onSeek(time)
  │  lifecycle.emit: 通知父组件    │  onVolumeChange(vol)
  ▼                                │
孙组件 (LeftControls) ─────────────┘
```

**核心规则**:
1. 子组件**不直接访问**父组件的 DOM 或状态 — 只能通过 `props` 接收数据
2. 父组件**不直接操作**子组件内部的 `ref.current` — 只能通过子组件暴露的 API
3. 数据向下: `Props` 接口 → 子组件
4. 事件向上: `Callback Props` + `lifecycle.emit()` → 父组件
5. 每个组件**只管理自己的 DOM** — 不跨组件操作元素

**组件拆分原则**:
- 单一职责 — 一个组件只做一件事
- 可复用的 UI 片段独立成组件 (如 Slider, Switch, Checkbox)
- 超过 500 行的组件必须拆分
- Controls > 500 行 → 拆分为 LeftControls / RightControls / TopControls / PbpControls / VolumeSlider / QualityMenu / PlaybackRateMenu / SettingMenu

### 2.5 新增的精细化拆分子组件

基于低耦合原则，以下组件从 Controls 中进一步拆分:

| 组件 | 从...拆分 | 职责 |
|------|----------|------|
| `VolumeSlider` | RightControls 中音量部分 | 音量滑块 (垂直 slider + 数值显示 + 静音切换) |
| `QualityMenu` | RightControls 中画质部分 | 画质选择菜单 |
| `PlaybackRateMenu` | RightControls 中倍速部分 | 倍速选择菜单 |
| `SettingMenu` | RightControls 中设置部分 | 设置面板 (镜像/循环/自动开播/比例/编码) |
| `ProgressBar` | TopControls 中进度条部分 | 进度条 (分段/缓冲/拖拽/预览) |
| `ViewpointMenu` | LeftControls 中章节部分 | 章节选择菜单 |

Controls 的 Props 透传给这些子组件，子组件通过 callback 回报事件，Controls 汇总后统一通知 PlayerDocker。

---

## 3. 渲染机制

### 3.1 整体流程

```
初始渲染:
  h('div', { class: 'player', ref: myRef }, children)
    → VNode { tag: 'div', attrs: { class: 'player' }, children: [...] }
    → materialize(vnode) → document.createElement('div') → 设置属性 → 绑定ref
    → mount(vnode, container) → container.appendChild(dom)

DOM 更新 (不重新 render):
  myRef.current.textContent = '01:23'
  myRef.current.classList.add('state-paused')
  myRef.current.style.transform = 'scaleX(0.5)'
  myRef.current.setAttribute('data-screen', 'full')
```

### 3.2 ref 绑定

```typescript
// 定义 ref 对象
const elRef: { current: HTMLDivElement | null } = { current: null };

// h() 中传入 — materialize 时自动赋值: refValue.current = 真实DOM元素
// 见 core/mount.ts applyAttrs() 第 220-221 行
h('div', { ref: elRef, class: 'xxx' })

// 之后随时操作
elRef.current?.classList.add('active');
elRef.current?.setAttribute('data-screen', 'full');
```

### 3.3 defineComponent 模板

```typescript
/**
 * 组件事件映射类型
 * key 为事件名，value 为 payload 类型（undefined 表示无 payload）
 */
type XxxEvents = {
  toggle: undefined;
  change: { value: string };
};

export const Xxx = defineComponent<XxxProps, XxxEvents>((props, lifecycle) => {
  // 1. ref 对象
  const rootRef: { current: HTMLDivElement | null } = { current: null };

  // 2. 内部状态 (闭包变量)
  let isActive = false;

  // 3. 更新函数 (直接操作 ref.current)
  const toggle = (): void => {
    isActive = !isActive;
    rootRef.current?.classList.toggle('active', isActive);
    // 通过 lifecycle.emit 触发事件（类型安全，事件名和 payload 自动推断）
    lifecycle.emit?.('toggle');
    lifecycle.emit?.('change', { value: isActive ? 'active' : 'inactive' });
  };

  // 4. 生命周期
  lifecycle.onMounted = (): void => { /* DOM已挂载 */ };
  lifecycle.onBeforeDestroy = (): void => { /* 清理 */ };

  // 5. 返回 VNode (只调用一次)
  return h('div', { class: 'xxx', ref: rootRef },
    h('span', {}, '内容')
  );
});

// 父组件使用时，onXxx 回调自动生成（onToggle, onChange）
// h(Xxx, { onToggle: () => {...}, onChange: (payload) => {...} })
```

---

## 4. 类型系统

### 4.0 组件事件类型系统

组件使用 `defineComponent<Props, Events>` 双泛型参数定义，第二个泛型 `Events` 为事件映射类型：

```typescript
/**
 * 事件映射类型定义规则：
 * - key 为事件名（小驼峰）
 * - value 为 payload 类型
 * - undefined 表示无 payload 的事件
 *
 * defineComponent<Props, Events> 会自动：
 * 1. lifecycle.emit 变为 TypedEmit<Events>，约束事件名和 payload 类型
 * 2. lifecycle.on 变为 TypedOn<Events>，约束回调参数类型
 * 3. h() 调用时自动生成 onXxx 回调属性（EventCallbacks<Events>）
 */
type QualityMenuEvents = {
  qualityChange: { quality: string };
};

const QualityMenu = defineComponent<QualityMenuProps, QualityMenuEvents>(
  (props, lifecycle) => {
    const handleClick = (quality: string): void => {
      // 类型安全：事件名 'qualityChange' 和 payload { quality } 自动校验
      lifecycle.emit?.('qualityChange', { quality });
    };
    // ...
  }
);

// 父组件使用：onXxx 回调自动生成
h(QualityMenu, {
  current: '1080p',
  qualities: ['auto', '480p', '720p', '1080p'],
  onQualityChange: (payload) => {
    // payload 自动推断为 { quality: string }
    console.log(payload.quality);
  },
});
```

**框架核心不可消除的 `as` 类型桥接**（运行时类型桥接，无法通过类型守卫消除）：

| 位置 | `as` 表达式 | 原因 |
|------|------------|------|
| `defineComponent` 返回值 | `}) as ExposedComponent<P, E>` | 闭包函数类型到 ExposedComponent 的桥接 |
| `defineComponent` 内部 | `lc as TypedComponentLifecycle<E>` | 无类型 lifecycle 到类型安全 lifecycle 的桥接 |
| `defineComponent` emit | `callbackName as keyof typeof props` | 动态事件名到 props key 的映射 |
| `h()` 函数组件调用 | `tag as FnComponent` | Component 联合类型到可调用 FnComponent 的收窄 |

### 4.1 问题

当前 Plugin/StreamPlugin 接口分别定义在：
- `packages/player/src/core/plugin.ts`
- `packages/plugins/src/stream/types.ts`

导致 plugins 包需要反向依赖 player 包获取 Plugin 类型，并且 StreamPlugin 的依赖关系不清晰。

### 4.2 解决方案

提取所有插件相关类型到根级 `types/` 目录：

**新增 `types/plugin.ts`**:

```typescript
/**
 * ============================================
 * 插件系统核心类型
 * ============================================
 * Plugin 基接口、PluginContext、StateManager、EventBus、HookSystem
 * 所有插件相关类型的唯一来源 — player 和 plugins 包均从此导入
 */
import type { VideoPlayer } from '../packages/player/src/player/VideoPlayer';

/** 插件通用选项 */
export interface PluginOptions {
  /** 是否开启调试模式，默认继承播放器的 debug 设置 */
  debug?: boolean;
}

/** 插件基接口 — 所有插件必须实现 */
export interface Plugin {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly dependencies?: string[];
  readonly options?: PluginOptions;
  /** 安装插件 — 在播放器初始化时调用 */
  install(player: VideoPlayer): void;
  /** 卸载插件 — 清理资源 (可选) */
  uninstall?(player: VideoPlayer): void;
  enable?(): void;
  disable?(): void;
}

/** 插件工厂函数类型 */
export type PluginFactory<TConfig = Record<string, unknown>> =
  (config?: TConfig & PluginOptions) => Plugin;

export interface PluginContext {
  player: VideoPlayer;
  state: StateManager;
  events: EventBus;
  hooks: HookSystem;
  log: (msg: string) => void;
}

export interface StateManager {
  getState(): Record<string, unknown>;
  get<R>(path: string): R | undefined;
  set(path: string, value: unknown, silent?: boolean): void;
  subscribe(path: string, listener: (newVal: unknown, oldVal: unknown) => void): () => void;
}

export interface EventBus {
  on<T>(event: string, handler: (payload: T) => void): () => void;
  once<T>(event: string, handler: (payload: T) => void): () => void;
  off<T>(event: string, handler: (payload: T) => void): void;
  offAll(event?: string): void;
  emit<T>(event: string, payload?: T): void;
}

export interface HookSystem {
  register<T, R>(name: string, handler: (ctx: T) => R): () => void;
  run<T, R>(name: string, context: T): R;
}

export const PlayerHooks = {
  BEFORE_PLAY: 'player:beforePlay',
  AFTER_PLAY: 'player:afterPlay',
  BEFORE_SEEK: 'player:beforeSeek',
  AFTER_SEEK: 'player:afterSeek',
} as const;
```

**新增 `types/streamPlugin.ts`**:

```typescript
/**
 * ============================================
 * 流媒体插件类型
 * ============================================
 * StreamPlugin 继承 Plugin，添加流媒体专有方法
 */
import type { Plugin } from './plugin';

export enum StreamPluginTypeEnum { HLS = 'hls', DASH = 'dash', FLV = 'flv' }
export enum StreamFormatEnum { HLS = 'hls', DASH = 'dash', FLV = 'flv', MP4 = 'mp4' }

export enum StreamPluginEventEnum {
  LOAD_COMPLETE = 'STREAM_LOAD_COMPLETE',
  METADATA_LOADED = 'STREAM_METADATA_LOADED',
  PLAY_START = 'STREAM_PLAY_START',
  PLAY_PAUSE = 'STREAM_PLAY_PAUSE',
  BUFFER_START = 'STREAM_BUFFER_START',
  BUFFER_END = 'STREAM_BUFFER_END',
  STATS_UPDATE = 'STREAM_STATS_UPDATE',
  NETWORK_ERROR = 'STREAM_NETWORK_ERROR',
  DECODE_ERROR = 'STREAM_DECODE_ERROR',
  ERROR = 'STREAM_ERROR',
}

export interface BufferInfo { start: number; end: number; length: number; }

export interface StreamStats {
  downloadSpeed: number; videoBitrate: number; audioBitrate: number;
  dropRate: number; bufferLength: number; currentTime: number;
  duration: number; firstFrameTime: number; totalStallCount: number;
  totalStallTime: number; videoCodec?: string; audioCodec?: string;
  resolution?: { width: number; height: number };
}

export interface StreamConfig {
  url: string; format: StreamFormatEnum;
  isLive?: boolean; startTime?: number; custom?: Record<string, unknown>;
}

/** 流媒体插件接口 — 继承 Plugin */
export interface StreamPlugin extends Plugin {
  readonly type: StreamPluginTypeEnum;
  videoElement: HTMLVideoElement | null;
  eventBus: unknown | null;
  isSupported(): boolean;
  load(config: StreamConfig): void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  destroy(): void;
  getBufferInfo(): BufferInfo;
  getStats(): Partial<StreamStats>;
}
```

**新增 `types/callbacks.ts`**:

```typescript
/**
 * ============================================
 * 回调类型定义
 * ============================================
 */

import type { DanmakuItem, DanmakuRenderItem, DanmakuSegment, PerformanceStats, RenderMode } from './danmaku';

/** 弹幕插件回调 */
export interface DanmakuCallbacks {
  /** 发送弹幕 → 服务器确认 (异步) */
  onSend?: (danmaku: DanmakuItem) => Promise<DanmakuItem>;
  onSendSuccess?: (danmaku: DanmakuItem) => void;
  onSendError?: (error: Error, danmaku: DanmakuItem) => void;
  onEnter?: (item: DanmakuRenderItem) => void;
  onLeave?: (item: DanmakuRenderItem) => void;
  onClick?: (item: DanmakuItem, event: MouseEvent) => void;
  /** 增量更新: 新弹幕到达 */
  onIncrementalUpdate?: (newItems: DanmakuItem[], totalCount: number) => void;
  onSegmentLoaded?: (segment: DanmakuSegment) => void;
  onAllLoaded?: (totalCount: number) => void;
  onPerformanceWarning?: (stats: PerformanceStats) => void;
  onModeChange?: (mode: RenderMode) => void;
}

/** 播放器回调 */
export interface PlayerCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onVolumeChange?: (volume: number, muted: boolean) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onPlayerModeChange?: (mode: 'native' | 'streaming') => void;
}
```

### 4.3 导入路径变更

| 旧导入 | 新导入 |
|--------|--------|
| `import { Plugin } from '@hili-player/player'` | `import { Plugin } from '@/types/plugin'` |
| `import { StreamPlugin } from '../stream/types'` | `import { StreamPlugin } from '@/types/streamPlugin'` |

### 4.4 接口继承关系

```
Plugin                              ← types/plugin.ts
  └── StreamPlugin                  ← types/streamPlugin.ts (extends Plugin)
        ├── HlsPlugin               ← implements StreamPlugin
        ├── DashPlugin              ← implements StreamPlugin
        └── FlvPlugin               ← implements StreamPlugin
  ├── DanmakuPlugin                 ← implements Plugin
  ├── SubtitlePlugin                ← implements Plugin
  └── InteractionPlugin             ← implements Plugin
```

### 4.5 修复要点

```typescript
// ❌ 修复前: 冗余的 implements
class HlsPlugin implements Plugin, StreamPlugin { ... }

// ✅ 修复后: StreamPlugin 已继承 Plugin
class HlsPlugin implements StreamPlugin { ... }

// ❌ 修复前: install 签名使用 unknown
install(player: unknown): void { ... }

// ✅ 修复后: 使用明确的 VideoPlayer 类型
install(player: VideoPlayer): void { ... }
```

---

## 5. 代码去重

### 5.1 重复文件

`packages/plugins/src/utils/` 与 `packages/player/src/utils/` 中的以下文件完全重复：

```
packages/plugins/src/utils/danmaku/  (8文件) — 与 packages/player/src/utils/danmaku/ 完全重复
packages/plugins/src/utils/subtitle/ (3文件) — 与 packages/player/src/utils/subtitle/ 完全重复
```

### 5.2 根因分析

plugins 包复制了 player 包的 util 文件，而不是通过共享接口访问。这违反了低耦合原则 — 插件直接依赖播放器内部实现。

**关键区分**：

| 内容 | 性质 | 谁使用 |
|------|------|--------|
| Danmaku 类型 (DanmakuItem, DanmakuOptions, 枚举等) | 纯类型定义 | player + plugin 都需要 |
| Danmaku 引擎 (DanmakuManager, CanvasEngine, DOMEngine等) | 播放器运行时引擎 | 只有 player 使用 |
| Subtitle 类型 (SubtitleItem, SubtitleFormat等) | 纯类型定义 | player + plugin 都需要 |
| Subtitle 解析器 (parseSRT/ASS/VTT) | 共享解析工具 | player + plugin 都需要 |

### 5.3 解决方案 — 低耦合分离

```
类型 → 提取到 types/              (纯接口，零耦合)
解析工具 → 提取到根 utils/        (独立工具，不依赖 player 或 plugin)
引擎代码 → 留在 player/src/utils/  (播放器私有实现)
重复文件 → 删除 plugins/src/utils/ (错误的拷贝)
```

**具体操作**：

| 操作 | 详情 | 耦合度 |
|------|------|--------|
| **创建 `types/danmaku.ts`** | DanmakuItem/DanmakuOptions/DanmakuType 等纯类型定义 | 零耦合 |
| **创建 `types/subtitle.ts`** | SubtitleItem/SubtitleFormat/ParsedSubtitle 等类型 | 零耦合 |
| **删除 player 侧重复文件** | `packages/player/src/utils/danmaku/` (8文件) 和 `packages/player/src/utils/subtitle/` (3文件) — **这些是 plugins 的拷贝，引擎归插件** | player 解耦 |
| **保留 plugins 侧原始文件** | `packages/plugins/src/utils/danmaku/` + `packages/plugins/src/utils/subtitle/` — 引擎和解析器归插件所有 | 插件内部实现 |

**修复后的依赖关系**：

```
types/danmaku.ts          ← 纯类型，player 和 plugin 都导入
types/subtitle.ts         ← 纯类型，player 和 plugin 都导入
    ↑            ↑
    │            │
packages/player  packages/plugins
    │            │
    │            ├── utils/danmaku/    ← 弹幕引擎 (插件内部，player 不碰)
    │            ├── utils/subtitle/   ← 字幕解析器 (插件内部)
    │            └── danmaku/index.ts  ← DanmakuPlugin (插件入口)
    │
    └── (不拥有弹幕引擎和字幕解析器)
```

**关键点**：
- 弹幕引擎和字幕解析器归插件所有 — player 不能直接导入它们
- Player 通过 `player.use(DanmakuPlugin(...))` 启用弹幕，通过 EventBus 通信
- 所有共享类型在 `types/` — 纯 TypeScript 接口/枚举

---

## 6. 插件接口设计

### 6.1 PluginManager 增强

```typescript
// packages/player/src/core/pluginManager.ts

install(plugin: Plugin): void {
  // 1. 类型守卫 — 验证是否有 install 方法
  if (typeof plugin.install !== 'function') {
    logger.error('无效插件: 缺少 install 方法');
    return;
  }
  // 2. 去重
  if (this.plugins.has(plugin.name)) return;
  // 3. debug 继承 — 插件未设置 debug 时继承播放器设置
  if (plugin.options && plugin.options.debug === undefined) {
    plugin.options.debug = this.player.props.debug;
  }
  // 4. 安装
  plugin.install(this.player);
  this.plugins.set(plugin.name, plugin);
  // 5. 检测 StreamPlugin — 通知中间件
  if (this.isStreamPlugin(plugin)) {
    this.player.streamMiddleware?.registerStreamPlugin(plugin);
  }
}

/** 类型守卫: 判断是否为 StreamPlugin */
private isStreamPlugin(p: Plugin): p is StreamPlugin {
  return 'type' in p && 'load' in p && 'getStats' in p;
}
```

### 6.2 注册方式

```typescript
// 方式1: 配置数组
new VideoPlayer({ plugins: [DanmakuPlugin({ debug: true }), HlsPlugin()] });

// 方式2: 链式调用
player.use(DanmakuPlugin()).use(HlsPlugin());

// 方式3: 直接 new 实例
player.use(new HlsPlugin({ autoplay: true }));

// 方式4: 异步动态
const { MyPlugin } = await import('./my-plugin');
player.use(MyPlugin({ debug: true }));
```

---

## 7. Debug 模式

### 7.1 两级 Debug

```typescript
// 播放器级 debug → 插件继承
const player = new VideoPlayer({
  debug: true,
  plugins: [
    DanmakuPlugin(),               // debug: true (继承)
    HlsPlugin({ debug: false }),   // debug: false (覆盖)
  ],
});
```

### 7.2 输出格式

```
[Player] 初始化完成, 浏览器: Chrome 120
[Plugin:danmaku] 安装中, renderMode=canvas
[Plugin:hls] 清单解析完成, 可用画质: 4
[StreamMiddleware] 切换到 Streaming 模式
[Danmaku] FPS: 58, 渲染: 234条, 池使用率: 67%
```

---

## 8. 弹幕系统

### 8.1 Canvas 懒创建

当前 `CanvasEngine` 在构造函数中直接创建 Canvas 并 appendChild。修改为仅在切换到 Canvas 模式时才创建和插入 DOM。

```typescript
// packages/plugins/src/danmaku/engine/CanvasEngine.ts

class CanvasEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isAttached = false;

  /** 仅在 Canvas 模式时调用 — 创建 Canvas 并插入 DOM */
  ensureCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'hili-danmaku-canvas';
      this.canvas.style.cssText =
        'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50';
      this.ctx = this.canvas.getContext('2d')!;
    }
    if (!this.isAttached) {
      this.container.appendChild(this.canvas);
      this.isAttached = true;
    }
    return this.canvas;
  }

  /** DOM 模式时移除 Canvas */
  detachCanvas(): void {
    this.canvas?.remove();
    this.isAttached = false;
  }

  destroy(): void {
    this.detachCanvas();
    this.canvas = null;
    this.ctx = null;
  }
}
```

### 8.2 独立 RAF 渲染循环

当前绑定 `video.addEventListener('timeupdate', ...)` → 改为独立 `requestAnimationFrame` 循环。

```typescript
// packages/plugins/src/danmaku/engine/DanmakuManager.ts

class DanmakuManager {
  private lastRenderTime = 0;
  private readonly FRAME_INTERVAL = 1000 / 60; // ~60fps

  // ❌ 旧: this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
  // ✅ 新: 独立 RAF 循环
  private renderLoop = (timestamp: number): void => {
    if (!this.isPlaying) return;
    const elapsed = timestamp - this.lastRenderTime;
    if (elapsed < this.FRAME_INTERVAL) {
      this.animationId = requestAnimationFrame(this.renderLoop);
      return;
    }
    // 直接从 video 读取当前时间
    const currentTime = this.video.currentTime;
    const danmakuToRender = this.scheduler.getDanmakuInWindow(
      currentTime - 0.5, currentTime + 2.0, 20
    );
    if (danmakuToRender.length > 0) {
      this.renderDanmaku(danmakuToRender, currentTime);
    }
    this.lastRenderTime = timestamp;
    this.animationId = requestAnimationFrame(this.renderLoop);
  };
}
```

### 8.3 双缓冲 resize 防闪烁

```typescript
class CanvasEngine {
  private lastSnapshot: ImageData | null = null;

  resize(): void {
    if (!this.canvas || !this.ctx) return;

    // 步骤1: 保存当前画面快照
    try {
      this.lastSnapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } catch { /* canvas 未初始化 */ }

    // 步骤2: 调整尺寸
    const dpr = window.devicePixelRatio || 1;
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 步骤3: 立即恢复快照 (避免白屏闪烁)
    if (this.lastSnapshot) {
      this.ctx.putImageData(this.lastSnapshot, 0, 0);
    }

    // 步骤4: 下一帧清除快照引用
    requestAnimationFrame(() => { this.lastSnapshot = null; });
  }
}
```

### 8.4 增量加载

```typescript
// packages/plugins/src/danmaku/engine/Scheduler.ts

class DanmakuScheduler {
  private pendingFetches = new Map<number, Promise<DanmakuItem[]>>();
  private loadCallback: ((s: number, e: number) => Promise<DanmakuItem[]>) | null = null;

  setLoadCallback(cb: (s: number, e: number) => Promise<DanmakuItem[]>): void {
    this.loadCallback = cb;
  }

  /** 异步加载分段 (带去重) */
  async loadSegment(index: number): Promise<DanmakuItem[]> {
    const seg = this.segments[index];
    if (!seg || seg.loaded) return seg?.danmakuList ?? [];
    if (this.pendingFetches.has(index)) return this.pendingFetches.get(index)!;

    const promise = this.loadCallback!(seg.startTime, seg.endTime).then(items => {
      seg.danmakuList = items; seg.loaded = true;
      this.pendingFetches.delete(index);
      return items;
    });
    this.pendingFetches.set(index, promise);
    return promise;
  }

  /** 预加载后续 N 个分段 */
  prefetch(currentIndex: number, count = 3): void {
    for (let i = 1; i <= count; i++) {
      const idx = currentIndex + i;
      if (idx < this.segments.length && !this.segments[idx].loaded) {
        this.loadSegment(idx);
      }
    }
  }
}
```

---

## 9. 流媒体插件

### 9.1 HLS 插件 — 支持 fork 版 hls.js

```typescript
// packages/plugins/src/hls/HlsPlugin.ts

interface HlsPluginConfig extends PluginOptions {
  autoplay?: boolean;
  /** 使用根目录 fork 版 hls.js — 支持直接传对象 { media, source } */
  useLocalHls?: boolean;
  hlsConfig?: Record<string, unknown>;
}

export class HlsPlugin implements StreamPlugin {
  // ... StreamPlugin 成员 ...

  load(config: StreamConfig): void {
    if (!this.videoElement) return;

    const loader = this.pluginConfig.useLocalHls
      ? import('/hls.js')      // fork 版: 支持 new Hls({ media, source })
      : import('hls.js');      // npm 版: 需要 attachMedia + loadSource

    loader.then((mod) => {
      const HlsClass = mod.default || mod;

      if (this.pluginConfig.useLocalHls) {
        // fork 版 — 直接传入对象 (类似 dash.js)
        this.hlsPlayer = new HlsClass({
          media: this.videoElement,
          source: config.url,
          autoStartLoad: true,
          ...this.pluginConfig.hlsConfig,
        });
      } else {
        // npm 版 — 传统两步
        this.hlsPlayer = new HlsClass(this.pluginConfig.hlsConfig);
        this.hlsPlayer.attachMedia(this.videoElement);
        this.hlsPlayer.loadSource(config.url);
      }

      this.bindEvents();
      if (this.pluginConfig.autoplay) this.play();
    });
  }
}
```

### 9.2 DASH 插件

保持现有实现。dash.js 本身支持对象传参 `MediaPlayer.create().initialize(view, source, autoplay)`。

### 9.3 FLV 插件

保持现有实现。flv.js 通过 `createPlayer({ type, url, ... })` 接受配置对象。

---

## 10. StreamMiddleware 中间件

### 10.1 设计

```
PlayerMode.NATIVE    → video.src 直接播放 (调试帧率/码率)
PlayerMode.STREAMING → StreamPlugin 接管 video 元素
```

当 PluginManager 检测到 StreamPlugin 安装时自动切换模式。中间件统一提供 `getStats()` / `getBufferInfo()`。

### 10.2 实现

```typescript
// packages/player/src/utils/media/streamMiddleware.ts [新增]

export enum PlayerMode { NATIVE = 'native', STREAMING = 'streaming' }

export class StreamMiddleware {
  private mode: PlayerMode = PlayerMode.NATIVE;
  private activePlugin: StreamPlugin | null = null;
  private video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) { this.video = video; }

  /** PluginManager 安装 StreamPlugin 时调用 */
  registerStreamPlugin(plugin: StreamPlugin): void {
    this.activePlugin = plugin;
    this.mode = PlayerMode.STREAMING;
  }

  /** PluginManager 卸载 StreamPlugin 时调用 */
  unregisterStreamPlugin(): void {
    this.activePlugin = null;
    this.mode = PlayerMode.NATIVE;
  }

  getMode(): PlayerMode { return this.mode; }

  getStats() {
    return this.mode === PlayerMode.STREAMING
      ? this.activePlugin!.getStats()
      : { currentTime: this.video.currentTime, duration: this.video.duration };
  }

  getBufferInfo() {
    if (this.mode === PlayerMode.STREAMING) return this.activePlugin!.getBufferInfo();
    if (this.video.buffered.length === 0) return { start: 0, end: 0, length: 0 };
    const end = this.video.buffered.end(this.video.buffered.length - 1);
    return { start: 0, end, length: end - this.video.currentTime };
  }
}
```

### 10.3 VideoPlayer 集成

```typescript
// VideoPlayer 属性
streamMiddleware: StreamMiddleware | null = null;

// PlayerDocker onMounted 中:
this.streamMiddleware = new StreamMiddleware(videoElement);
```

---

## 11. 回调与事件系统

### 11.1 弹幕回调 (通过 Plugin 配置传入)

```typescript
DanmakuPlugin({
  callbacks: {
    onSend: async (danmaku) => await fetch('/api/danmaku/send', { method: 'POST', body: JSON.stringify(danmaku) }).then(r => r.json()),
    onSendSuccess: (danmaku) => console.log('发送成功:', danmaku.id),
    onIncrementalUpdate: (items, total) => console.log(`+${items.length}条, 共${total}条`),
  },
})
```

### 11.2 播放器回调 (通过 PlayerConfig 传入)

```typescript
new VideoPlayer({
  callbacks: {
    onTimeUpdate: (time) => { /* 外部状态同步 */ },
    onPlayerModeChange: (mode) => { /* 模式切换通知 */ },
  },
})
```

---

## 12. 码率监控修复

### 12.1 问题

`media/monitor.ts` 和 `packages/player/src/utils/media/monitor.ts` 中 `getStats().videoBitrate` 取值链路：
`hlsPlayer.levels[currentLevel].bitrate` — 这是清单中画质的**静态标称码率**，不是实际网络吞吐量，所以 SVG 曲线呈直线。

### 12.2 修复

```typescript
// 滑动窗口平均计算实时吞吐量 (bps)
private calculateThroughput(currentBytes: number): number {
  const timeDelta = (performance.now() - this.lastCheckTime) / 1000;
  const bytesDelta = currentBytes - this.lastCheckBytes;
  const throughput = (bytesDelta * 8) / timeDelta;
  // 滑动窗口平均...
  return Math.round(average);
}
```

SVG 图表 Y 轴改为动态范围：`yMax = max + range * 0.1`, `yMin = max(0, min - range * 0.1)`。

---

## 13. 浏览器检测

`packages/player/src/utils/browserCapabilityDetector.ts` 已实现。VideoPlayer 初始化时调用，结果存入 `state.browser`。`recommendProtocol()`: iOS→HLS, 桌面 MSE→DASH, 降级→MP4。

---

## 14. SSR 方案

### 14.1 流程

```
服务端: h() → VNode → materialize (SSR: mock节点) → 序列化为 HTML
客户端: hydrate(containerEl) → 复用已有DOM → 绑定ref → 绑定事件 → 创建video
```

### 14.2 hydrate 实现

```typescript
// VideoPlayer 新增方法
hydrate(container: HTMLElement): void {
  this.containerEl = container;
  this.videoEl = container.querySelector('video') || document.createElement('video');
  // 绑定 ref — 通过 data-ref 属性映射
  container.querySelectorAll('[data-ref]').forEach(el => {
    const name = el.getAttribute('data-ref');
    // 查找对应 ref 对象并赋值
  });
  this.bindVideoEvents();
  this.registerPlugins();
}
```

---

## 15. 文件结构

```
hili-player/
├── player-reference/     # [参考] 不修改
├── packages/
│   ├── player/src/
│   │   ├── player/VideoPlayer.ts          # [需改] +SSR, +StreamMiddleware
│   │   ├── components/                    # h()组件
│   │   │   ├── LottieIcon.ts              # [新增] 通用Lottie动画图标组件
│   │   │   ├── PlayerDocker.ts            # [需改] 补充全屏/键盘/迷你播放器
│   │   │   ├── Controls.ts               # [需改] 拆分子组件引用+Lottie图标
│   │   │   ├── LeftControls.ts           # [需改] 播放按钮用LottieIcon
│   │   │   ├── RightControls.ts           # [需改] 替换为子组件组装+Lottie图标
│   │   │   ├── TopControls.ts             # [需改] 进度条改为ProgressBar+Thumb Lottie
│   │   │   ├── ProgressBar.ts             # [新增] 进度条 (从TopControls拆分)
│   │   │   ├── VolumeSlider.ts            # [新增] 音量滑块+Lottie动画
│   │   │   ├── QualityMenu.ts             # [新增] 画质菜单
│   │   │   ├── PlaybackRateMenu.ts        # [新增] 倍速菜单
│   │   │   ├── SettingMenu.ts             # [新增] 设置面板+Lottie图标
│   │   │   ├── ViewpointMenu.ts           # [新增] 章节选择
│   │   │   ├── PbpControls.ts            # [正确]
│   │   │   ├── SendBar.ts                # [正确]
│   │   │   ├── DmSetting.ts              # [正确]
│   │   │   ├── Selection.ts              # [正确]
│   │   │   └── ... (其余17个)              # [正确]
│   │   ├── core/pluginManager.ts          # [需改] +StreamPlugin检测, +debug继承
│   │   ├── core/events.ts                # [需改] +新事件枚举
│   │   ├── utils/media/                   # [需改] +streamMiddleware, 码率修复
│   │   └── utils/browserCapabilityDetector.ts  # [正确]
│   │
│   └── plugins/src/
│       ├── danmaku/
│       │   ├── index.ts                    # DanmakuPlugin (插件入口)
│       │   ├── types.ts                    # DanmakuPlugin 专用类型
│       │   └── engine/                     # 弹幕引擎 (插件内部，player 不碰)
│       │       ├── DanmakuManager.ts       # [需改] 独立RAF, 懒Canvas
│       │       ├── CanvasEngine.ts         # [需改] 懒创建+双缓冲
│       │       ├── DOMEngine.ts            # [正确]
│       │       ├── Scheduler.ts            # [需改] 增量加载
│       │       ├── TrackManager.ts         # [正确]
│       │       ├── ObjectPool.ts           # [正确]
│       │       ├── ScaleHelper.ts          # [正确]
│       │       └── types.ts                # 弹幕引擎内部类型
│       ├── subtitle/
│       │   ├── index.ts                    # SubtitlePlugin (插件入口)
│       │   ├── types.ts                    # 字幕类型
│       │   └── subtitleGenerator.ts        # 字幕解析器 (SRT/ASS/VTT)
│       ├── interaction/
│       │   ├── index.ts                   # InteractionPlugin (主插件)
│       │   ├── GuidePlugin.ts             # [新] 点赞关注子插件
│       │   ├── LinkPlugin.ts              # [新] 外链子插件
│       │   ├── VotePlugin.ts              # [新] 投票子插件
│       │   └── ScorePlugin.ts             # [新] 评分子插件
│       ├── hls/HlsPlugin.ts               # [需改] implements StreamPlugin, +useLocalHls
│       ├── dash/DashPlugin.ts             # [需改] implements StreamPlugin
│       ├── flv/FlvPlugin.ts               # [需改] implements StreamPlugin
│       └── utils/                         # [删] 11个重复文件
│
├── types/
│   ├── index.ts                           # [已有] VNode, PlayerConfig
│   ├── plugin.ts                          # [新增] Plugin, PluginContext, EventBus等
│   ├── streamPlugin.ts                    # [新增] StreamPlugin, StreamConfig等
│   ├── danmaku.ts                         # [新增] DanmakuItem, DanmakuOptions, 枚举等
│   ├── subtitle.ts                        # [新增] SubtitleItem, SubtitleFormat等
│   └── callbacks.ts                       # [新增] DanmakuCallbacks, PlayerCallbacks
│
├── assets/                                # [新增] 静态资源
│   ├── lottie-icon/                       # Lottie 动画 JSON (18个文件)
│   └── images/                            # 降级静态图片 (5个文件)
│
├── core/                                  # [已有] h(), mount(), state, eventBus, hooks
├── utils/
│   └── rafInterval.ts                     # [已有] RAF 工具
│
└── media/                                 # [已有] monitor, chart, playerInfoPanel
```

---

## 16. 实施路线图

### Phase 0: 类型提取 + 去重 (阻塞后续 — 必须最先做)

| # | 任务 | 涉及文件 | 验证 |
|---|------|---------|------|
| 0.1 | 创建 `types/plugin.ts` — Plugin/PluginContext/EventBus等 | types/plugin.ts [新] | player+plugins 编译通过 |
| 0.2 | 创建 `types/streamPlugin.ts` — StreamPlugin/StreamConfig等 | types/streamPlugin.ts [新] | 同上 |
| 0.3 | 创建 `types/danmaku.ts` — 合并 player 和 plugin 的弹幕类型 | types/danmaku.ts [新] | 只有纯类型，零运行时依赖 |
| 0.4 | 创建 `types/subtitle.ts` — 合并 player 和 plugin 的字幕类型 | types/subtitle.ts [新] | 只有纯类型 |
| 0.5 | 创建 `types/callbacks.ts` — 回调类型 | types/callbacks.ts [新] | 同上 |
| 0.6 | 删除 player 侧重复: `packages/player/src/utils/danmaku/` (8文件) + `packages/player/src/utils/subtitle/` (3文件) — 引擎归插件 | player 侧删除 | 编译通过 |
| 0.7 | 全部导入路径更新 | player/src/, plugins/src/ | 编译通过 |
| 0.9 | 修复 3 个流媒体插件 `implements Plugin, StreamPlugin` → `implements StreamPlugin` | HlsPlugin, DashPlugin, FlvPlugin | 编译通过 |
| 0.10 | 修复 3 个功能插件 `install(player: unknown)` → `install(player: VideoPlayer)` | DanmakuPlugin, SubtitlePlugin, InteractionPlugin | 编译通过 |

### Phase 1: 播放器核心修正

| # | 任务 | 验证 |
|---|------|------|
| 1.1 | PluginManager: StreamPlugin 检测 + debug 继承 | 安装 HlsPlugin 时自动通知中间件 |
| 1.2 | VideoPlayer: 集成 StreamMiddleware | getMode() 返回正确模式 |
| 1.3 | PlayerDocker: 补充全屏切换/键盘事件/迷你播放器逻辑 | 与参考行为一致 |
| 1.4 | 实现 LottieIcon 通用组件 — 封装 lottie-web | `LottieIcon.ts` [新]，支持 play/pause/stop/hover/降级 |
| 1.5 | 精细化拆分: ProgressBar/VolumeSlider/QualityMenu/PlaybackRateMenu/SettingMenu/ViewpointMenu | 6 个新子组件，低耦合，独立 Props/Callback |
| 1.6 | RightControls 改为子组件组装 + LottieIcon 图标 | 不内联 DOM，用 h(VolumeSlider, ...) + h(LottieIcon, ...) |
| 1.7 | TopControls 改为引用 ProgressBar + Thumb Lottie | 不内联进度条 DOM |
| 1.8 | LeftControls 改为引用 ViewpointMenu + 播放按钮 Lottie | 不内联章节菜单 DOM |
| 1.9 | 实现 InteractionLayer 容器组件 (替代 RowCmd) | 只渲染 `.player-cmd-dm-inside` 容器 |
| 1.10 | ESLint 升级: `no-explicit-any: error`, `no-unsafe-*: error` | 0 个 any/unknown 违规 |
| 1.11 | 互动插件重构: 四子插件拆分 (Guide/Link/Vote/Score) | 每个子插件独立 Props |
| 1.12 | 互动 diff 算法重写 (二分查找 + 增量更新) | O(log n + k) |
| 1.13 | 编辑模式拖拽实现 | mousedown/move/up 手动更新 CSS 变量 |

### Phase 1.5: media-manifest 集成 + 流媒体

| # | 任务 | 验证 |
|---|------|------|
| 1.5.1 | 复制 `media-manifest/hls.js/` → `hls.js/` | fork 版编译通过 |
| 1.5.2 | 复制 `media-manifest/src/core/` 流媒体核心逻辑 → `packages/player/src/media-core/` | 类型正确 |
| 1.5.3 | HLS 插件: 改为引用 `hls.js/` fork 版, 支持 URL + 对象注入 | 两种播放方式均正常 |
| 1.5.4 | DASH 插件: `pnpm add dashjs` + 参考 manifest-to-dash.ts 实现对象注入 | 同上 |
| 1.5.5 | FLV 插件: `pnpm add flv.js` | URL 播放正常 |
| 1.5.6 | `pnpm add lottie-web` | LottieIcon 正常渲染 |
| 1.5.7 | 配置 `preinstall: only-allow pnpm` | npm/yarn 安装时报错 |

### Phase 2: 弹幕引擎修正

| # | 任务 | 验证 |
|---|------|------|
| 2.1 | CanvasEngine: 懒创建 + 双缓冲 resize | DOM 模式无 Canvas, 全屏无闪烁 |
| 2.2 | DanmakuManager: 独立 RAF 循环 | FPS ≥ 55 |
| 2.3 | DanmakuScheduler: 增量加载 + 预取 | 网络请求按需加载不重复 |
| 2.4 | DanmakuPlugin: 回调链路 | onSend/onClick/onIncrementalUpdate 正常 |

### Phase 3: 流媒体 + 监控

| # | 任务 | 验证 |
|---|------|------|
| 3.1 | HlsPlugin: useLocalHls + 对象传参 | fork 版 hls.js 正常加载播放 |
| 3.2 | 码率修复: 滑动窗口吞吐量 | SVG 曲线有波动 |
| 3.3 | SSR: hydrate 实现 | 服务端 HTML 客户端激活可交互 |

---

## 17. 附录 A: PlayerDocker 入口组件

> **文件**: `packages/player/src/components/PlayerDocker.ts`
> **参考**: `player-reference/src/player.ts`
> **状态**: [已有/需改] — DOM 结构已正确，需补充全屏切换/键盘事件/迷你播放器/Controls 延迟初始化逻辑

```typescript
/**
 * ============================================
 * PlayerDocker — 播放器入口容器
 * ============================================
 *
 * 对应参考 player.ts 的 template() + setup() + initVideo() + initControls() + initEvent()。
 * 渲染初始 DOM 骨架，在 onMounted 中创建 video 元素和动态子组件。
 *
 * 核心流程:
 *   1. 渲染 DOM 骨架 (template)
 *   2. onMounted 中创建 video 元素 (initVideo)
 *   3. loadedmetadata 后初始化 Controls (initControls — 需要 video.duration)
 *   4. 绑定键盘/全屏/画中画/IntersectionObserver/右键菜单事件 (initEvent)
 *
 * @component
 */

export const PlayerDocker = defineComponent<PlayerDockerProps>((props, lifecycle) => {

  // ===== 第一层: DOM 引用 =====

  /** 最外层 — data-injector="nano" */
  const dockerRef: { current: HTMLDivElement | null } = { current: null };
  /** 播放器容器 — data-screen/data-angle/data-ctrl-hidden 状态属性在此修改 */
  const containerRef: { current: HTMLDivElement | null } = { current: null };
  /** 视频区域 — 所有视频相关子组件的父容器 */
  const videoAreaRef: { current: HTMLDivElement | null } = { current: null };
  /** 视频栖架 — dblclick 全屏 / click 播放暂停 / contextmenu 右键菜单 / mousemove 显示控制条 */
  const perchRef: { current: HTMLDivElement | null } = { current: null };
  /** 视频包裹 — video 元素的直接父容器 */
  const videoWrapRef: { current: HTMLDivElement | null } = { current: null };
  /** 视频海报 */
  const posterRef: { current: HTMLDivElement | null } = { current: null };
  /** 发送区域 — SendBar 的容器 */
  const sendingAreaRef: { current: HTMLDivElement | null } = { current: null };
  /** video 元素 — onMounted 中动态创建 */
  const videoRef: { current: HTMLVideoElement | null } = { current: null };

  // ===== 第二层: 状态数据 (对应参考 playerInfo + videoInfo) =====

  const playerInfo = {
    dataScreen: 'normal' as 'normal' | 'full' | 'web' | 'mini',
    isPip: false,
    isWide: false,
    volume: props.volume ?? 0.3,
    isMuted: props.muted ?? false,
    isPlaying: false,
    backrate: 1,
    qualityIndex: 0,
  };

  const videoInfo = { duration: 0, buffer: 0, currentTime: 0 };

  /** 迷你播放器拖拽状态 */
  const miniPlayer = { isShow: false, right: 84, bottom: 84 };

  // ===== 第三层: 控制条自动隐藏定时器 (对应参考 inCtrlTimer) =====

  let inCtrlTimer: AnimationFrameID | null = null;
  let clickTimer: AnimationFrameID | null = null;

  // ===== 第四层: 视频元素创建 (对应参考 initVideo) =====

  /**
   * 创建 video 元素并绑定事件
   * 对应参考: initVideo() — 第 165-186 行
   */
  const initVideo = (): void => {
    // 步骤1: 创建 video 元素
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.volume = playerInfo.volume;
    video.muted = playerInfo.isMuted;
    videoRef.current = video;
    videoWrapRef.current?.appendChild(video);

    // 步骤2: 绑定 video 原生事件
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgress);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);

    // 步骤3: 流媒体插件或直接 src
    // [条件: 如果配置了流媒体插件] → plugin.create(video, url)
    // [否则] → video.src = url
    if (props.src) {
      video.src = props.src;
    }

    // 步骤4: 通知外部 video 已创建
    lifecycle.emit?.('videoCreated', { video });
  };

  // ===== 第五层: video 事件处理 (对应参考第 257-345 行) =====

  /** 元数据加载完成 — 获取 duration 后初始化 Controls */
  const onLoadedMetadata = (): void => {
    if (!videoRef.current || videoRef.current.duration === 0) return;
    videoInfo.duration = videoRef.current.duration;
    // 初始化 Controls (需要 duration 数据)
    initControls(videoInfo.duration);
    // 初始化全局事件
    initEvent();
    // 通知外部
    lifecycle.emit?.('loadedMetadata', videoInfo.duration);
  };

  /** 时间更新 — 驱动弹幕和进度条 */
  const onTimeUpdate = (): void => {
    if (!videoRef.current) return;
    videoInfo.currentTime = videoRef.current.currentTime;
    // 更新控制条进度
    controlsApi?.updateCurrent(videoInfo.currentTime);
    // 创建弹幕 (对应 rowDm.createDanmaku)
    // 更新互动卡片 (对应 rowCmd.currentTimeChange)
    lifecycle.emit?.('timeUpdate', videoInfo.currentTime);
  };

  /** 缓冲进度更新 */
  const onProgress = (): void => {
    if (!videoRef.current || videoRef.current.buffered.length === 0) return;
    // 查找包含当前播放位置的缓冲区间 (对应参考第 329-340 行)
    for (let i = 0; i < videoRef.current.buffered.length; i++) {
      const start = videoRef.current.buffered.start(videoRef.current.buffered.length - 1 - i);
      if (start < videoRef.current.currentTime) {
        videoInfo.buffer = videoRef.current.buffered.end(videoRef.current.buffered.length - 1 - i);
        controlsApi?.updateBuffer(videoInfo.buffer);
        break;
      }
    }
  };

  /** 播放开始 — 移除 state-paused */
  const onPlay = (): void => {
    playerInfo.isPlaying = true;
    containerRef.current?.classList.remove('state-paused');
  };

  /** 暂停 — 添加 state-paused */
  const onPause = (): void => {
    playerInfo.isPlaying = false;
    containerRef.current?.classList.add('state-paused');
  };

  /** 播放结束 */
  const onEnded = (): void => {
    playerInfo.isPlaying = false;
    containerRef.current?.classList.add('state-paused');
    lifecycle.emit?.('ended');
  };

  /** 缓冲中 — 添加 state-buff */
  const onWaiting = (): void => {
    if (playerInfo.isPlaying) {
      containerRef.current?.classList.add('state-buff');
    }
  };

  /** 缓冲完成 — 移除 state-buff */
  const onCanPlay = (): void => {
    containerRef.current?.classList.remove('state-buff');
  };

  // ===== 第六层: Controls 初始化 (对应参考 initControls 第 188-214 行) =====

  let controlsApi: {
    updateCurrent: (time: number) => void;
    updateBuffer: (buffer: number) => void;
    updateVolumeDisplay: (volume: number) => void;
    upadteMute: (muted: boolean) => void;
    showControl: () => void;
    hideControl: () => void;
    getDom: (selector: string) => HTMLElement | null;
  } | null = null;

  /**
   * 初始化 Controls 组件
   * 在 loadedmetadata 后调用 (需要 video.duration)
   */
  const initControls = (duration: number): void => {
    // Controls 通过 h(Controls, {...}) 已在 VNode 树中渲染
    // 此处通过 Controls 暴露的 API 获取引用
    // [对应: new Controls(videoArea, duration, volume, backrate, config, isEdit)]
    // [事件绑定: controls.on("play-pause", togglePlayPause) 等]
  };

  // ===== 第七层: 全局事件 (对应参考 initEvent 第 216-254 行) =====

  const initEvent = (): void => {
    // ResizeObserver — 容器尺寸变化时更新进度条
    const resizeObserver = new ResizeObserver(() => {
      controlsApi?.updateCurrent(videoInfo.currentTime || 0);
    });
    resizeObserver.observe(dockerRef.current!);

    // 鼠标离开视频区域 → 隐藏控制条
    videoAreaRef.current?.addEventListener('mouseleave', () => {
      if ((playerInfo.dataScreen === 'web' || playerInfo.dataScreen === 'full')) return;
      hideControls();
    });

    // 双击 → 全屏切换
    perchRef.current?.addEventListener('dblclick', () => {
      cancelRaf(clickTimer);
      toggleFullscreen();
    });

    // 鼠标移动 → 显示控制条
    perchRef.current?.addEventListener('mousemove', () => showControls('video'));

    // 单击 → 播放暂停 (延迟 400ms 以区分双击)
    perchRef.current?.addEventListener('click', () => {
      cancelRaf(clickTimer);
      clickTimer = rafTimeout(() => togglePlayPause(), 400);
    });

    // 全屏变化监听
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // 画中画变化监听
    if ('pictureInPictureEnabled' in document) {
      document.addEventListener('enterpictureinpicture', onPipChange);
      document.addEventListener('leavepictureinpicture', onPipChange);
    }

    // 键盘事件
    document.addEventListener('keydown', onKeyboard);

    // 右键菜单
    perchRef.current?.addEventListener('contextmenu', onContextMenu);

    // IntersectionObserver — 迷你播放器 (对应参考 playerobserver 第 576-607 行)
    const playerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          closeMiniPlayer();
        } else {
          if (playerInfo.isPip) return;
          miniPlayer.isShow = true;
          containerRef.current?.setAttribute('data-screen', 'mini');
          if (containerRef.current) {
            containerRef.current.style.right = `${miniPlayer.right}px`;
            containerRef.current.style.bottom = `${miniPlayer.bottom}px`;
          }
          lifecycle.emit?.('enterMini');
        }
      });
    }, { threshold: 0 });
    if (dockerRef.current) playerObserver.observe(dockerRef.current);
  };

  // ===== 第八层: 播放控制方法 =====

  const togglePlayPause = (): void => {
    if (!videoRef.current || !containerRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      containerRef.current.classList.remove('state-paused');
    } else {
      videoRef.current.pause();
      containerRef.current.classList.add('state-paused');
    }
    showControls('video');
  };

  const toggleFullscreen = (): void => {
    if (!dockerRef.current) return;
    if (playerInfo.dataScreen === 'normal' || playerInfo.dataScreen === 'web') {
      dockerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const toggleMute = (): void => {
    if (!videoRef.current) return;
    playerInfo.isMuted = !playerInfo.isMuted;
    videoRef.current.muted = playerInfo.isMuted;
    controlsApi?.upadteMute(playerInfo.isMuted);
    controlsApi?.updateVolumeDisplay(playerInfo.isMuted ? 0 : playerInfo.volume);
  };

  const showControls = (from: 'video' | 'control' | 'top'): void => {
    cancelRaf(inCtrlTimer);
    if (!containerRef.current) return;
    containerRef.current.setAttribute('data-ctrl-hidden', 'false');
    containerRef.current.classList.remove('state-no-cursor');
    controlsApi?.showControl();
    if (from === 'video') {
      // 3 秒后自动隐藏
      inCtrlTimer = rafTimeout(() => hideControls(), 3000);
    }
  };

  const hideControls = (): void => {
    cancelRaf(inCtrlTimer);
    if (!containerRef.current) return;
    containerRef.current.setAttribute('data-ctrl-hidden', 'true');
    containerRef.current.classList.add('state-no-cursor');
    controlsApi?.hideControl();
  };

  const closeMiniPlayer = (): void => {
    containerRef.current?.setAttribute('data-screen', 'normal');
    containerRef.current?.removeAttribute('style');
    miniPlayer.isShow = false;
  };

  const onFullscreenChange = (): void => {
    if (!containerRef.current || !dockerRef.current) return;
    if (document.fullscreenElement) {
      containerRef.current.setAttribute('data-screen', 'full');
      playerInfo.dataScreen = 'full';
    } else {
      containerRef.current.setAttribute('data-screen', 'normal');
      playerInfo.dataScreen = 'normal';
    }
  };

  const onPipChange = (): void => {
    playerInfo.isPip = document.pictureInPictureElement !== null;
  };

  const onKeyboard = (event: KeyboardEvent): void => {
    // [对应参考 handleKeyboard 第 672-726 行]
    // Space → togglePlayPause, F → toggleFullscreen, M → toggleMute
    // ArrowRight → +5s, ArrowLeft → -5s, ArrowUp → vol+10%, ArrowDown → vol-10%
  };

  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    lifecycle.emit?.('contextMenu', { x: event.clientX, y: event.clientY });
  };

  // ===== 第九层: 生命周期 =====

  lifecycle.onMounted = (): void => {
    initVideo();
    if (containerRef.current && props.playerName) {
      containerRef.current.setAttribute('aria-label', props.playerName);
    }
    // 触发挂载完成 — 外部获取 DOM 引用
    props.onMounted?.({
      container: dockerRef.current!,
      videoArea: videoAreaRef.current!,
      videoWrap: videoWrapRef.current!,
      video: videoRef.current!,
      sendingArea: sendingAreaRef.current!,
    });
    lifecycle.emit?.('playerLoaded');
  };

  lifecycle.onBeforeDestroy = (): void => {
    if (videoRef.current) {
      videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoRef.current.removeEventListener('timeupdate', onTimeUpdate);
      videoRef.current.removeEventListener('progress', onProgress);
      videoRef.current.removeEventListener('play', onPlay);
      videoRef.current.removeEventListener('pause', onPause);
      videoRef.current.removeEventListener('ended', onEnded);
      videoRef.current.removeEventListener('waiting', onWaiting);
      videoRef.current.removeEventListener('canplay', onCanPlay);
    }
  };

  // ===== 第十层: 渲染 DOM 骨架 (对应参考 template() 第 102-118 行) =====

  return h('div', {
    'data-injector': 'nano',
    class: 'player-docker player-docker-major',
    ref: dockerRef,
  },
    h('div', {
      'data-angle': 'd3d11',
      'data-screen': 'normal',
      'data-ctrl-hidden': 'true',
      class: 'player-container state-paused state-no-cursor state-disable-box-shadow',
      ref: containerRef,
    },
      h('div', { class: 'player-primary-area' },

        // 视频区域 — 所有子组件的容器
        h('div', { class: 'player-video-area', ref: videoAreaRef },
          h('div', { class: 'player-video-perch', ref: perchRef },
            h('div', { class: 'player-video-wrap', ref: videoWrapRef })
            // video 元素由 initVideo() 动态创建插入
          ),
          h('div', { class: 'player-video-poster', hidden: true, ref: posterRef })

          // ===== 以下子组件由插件/播放器在 onMounted 中动态注入 =====
          // 弹幕容器 (.player-row-dm-wrap 等) — DanmakuPlugin 注入
          // 互动容器 (.player-cmd-dm-wrap)       — InteractionPlugin 注入
          // 字幕容器                              — SubtitlePlugin 注入
          // 顶部栏/状态/加载/Toast 等             — PlayerDocker 自身管理
          // Controls                              — 在 loadedmetadata 后创建
        ),

        // 发送区域 — SendBar 容器
        h('div', { class: 'player-sending-area', ref: sendingAreaRef })
        // SendBar 在 onMounted 中创建并注入

      )
    )
  );
});
```

---

## 18. 附录 B: Controls 控制条组件

> **文件**: `packages/player/src/components/Controls.ts`
> **参考**: `player-reference/src/component/controls/index.ts`
> **状态**: [已有/正确] — DOM 结构和交互逻辑已与既有实现一致，使用 defineComponent + h()

Controls 组件是控制条的总装容器，负责：
- 组装 LeftControls / RightControls / TopControls / PbpControls
- 管理进度条拖拽
- 管理菜单显示/隐藏动画 (hover 延迟 rafTimeout)
- 管理音量滑块拖拽
- 提供 API 给 VideoPlayer 调用 (updateCurrent / updateBuffer / updateVolumeDisplay / upadteMute / showControl / hideControl)

当前 `packages/player/src/components/Controls.ts` 已正确实现以上逻辑（853行），DOM 类名和结构已与既有实现一致。**无需修改**。

`LeftControls.ts` / `RightControls.ts` / `TopControls.ts` / `PbpControls.ts` 作为 Controls 的子组件也**已正确实现**。

### Controls 子组件结构

```
Controls (组装容器)
  ├── TopControls     — .player-control-top    → 进度条区域
  ├── LeftControls    — .player-control-bottom-left  → 左按钮组
  ├── (SendBar)       — .player-control-bottom-center → 发送栏 (由 PlayerDocker 管理)
  ├── RightControls   — .player-control-bottom-right → 右按钮组
  ├── (shadow)        — .player-shadow-progress-area → 迷你进度条
  └── PbpControls     — .player-pbp            → 高能进度条
```

---

## 19. 附录 C: LeftControls 左按钮组

> **文件**: `packages/player/src/components/LeftControls.ts`
> **状态**: [已有/正确]

渲染: 上一集 / 播放暂停 / 下一集 / 时间显示 / 章节选择。

DOM 结构 (类名已与既有实现一致):
```
.player-control-bottom-left
  .player-ctrl-btn.player-ctrl-prev      — 上一集 (条件: config.prev)
  .player-ctrl-btn.player-ctrl-play      — 播放/暂停
  .player-ctrl-btn.player-ctrl-next      — 下一集 (条件: config.next)
  .player-ctrl-btn.player-ctrl-time      — 时间显示
    .player-ctrl-time-label
      .player-ctrl-time-current
      .player-ctrl-time-divide
      .player-ctrl-time-duration
  .player-ctrl-btn.player-ctrl-viewpoint — 章节选择 (条件: viewpoint && points > 1)
    .player-ctrl-viewpoint-inner
      .player-ctrl-viewpoint-content
        .player-ctrl-viewpoint-text
        .player-ctrl-viewpoint-icon
        .player-ctrl-viewpoint-menu-wrap
          .player-ctrl-viewpoint-menu
            .player-ctrl-viewpoint-menu-item  (循环)
```

---

## 20. 附录 D: RightControls 右按钮组

> **文件**: `packages/player/src/components/RightControls.ts`
> **状态**: [已有/正确]

渲染: 画质 / 选集 / 倍速 / 音量 / 设置 / 画中画 / 宽屏 / 网页全屏 / 全屏。

DOM 结构:
```
.player-control-bottom-right
  .player-ctrl-btn.player-ctrl-quality         — 画质 (条件: config.quality)
    .player-ctrl-quality-result
    .player-ctrl-quality-menu-wrap
      .player-ctrl-quality-menu
  .player-ctrl-btn.player-ctrl-eplist          — 选集 (条件: config.eplist)
    .player-ctrl-eplist-result
    .player-ctrl-eplist-menu-wrap
  .player-ctrl-btn.player-ctrl-playbackrate    — 倍速
    .player-ctrl-playbackrate-result
    .player-ctrl-playbackrate-menu-wrap
      .player-ctrl-playbackrate-menu
  .player-ctrl-btn.player-ctrl-volume          — 音量
    .player-ctrl-volume-icon / .player-ctrl-muted-icon
    .player-ctrl-volume-box
      .player-ctrl-volume-number
      .player-ctrl-volume-progress.slider
        .slider-area
          .slider-bar-wrap > .slider-bar
          .slider-thumb > .slider-thumb-dot
  .player-ctrl-btn.player-ctrl-setting         — 设置 (条件: config.setting)
    .player-ctrl-setting-box
      .player-ctrl-setting-menu.ui.ui-panel.ui-dark
        .player-ctrl-seting-menu-left
          .player-ctrl-seting-menu-left-item (×4)
        .player-ctrl-seting-menu-right
          .player-ctrl-setting-handoff / .aspect / .codec / .others
  .player-ctrl-btn.player-ctrl-pip             — 画中画 (条件: config.pip)
  .player-ctrl-btn.player-ctrl-wide            — 宽屏 (条件: config.wide)
  .player-ctrl-btn.player-ctrl-web             — 网页全屏 (条件: config.web)
  .player-ctrl-btn.player-ctrl-full            — 全屏
```

---

## 21. 附录 E: TopControls 进度条区域

> **文件**: `packages/player/src/components/TopControls.ts`
> **状态**: [已有/正确]

DOM 结构:
```
.player-control-top
  .player-progress-area
    .player-progress-wrap
      .player-progress[style=height:4px]
        .player-progress-schedule-wrap
        .player-progress-point-wrap
        .player-progress-thumb
          .player-progress-thumb-icon.player-progress-thumb-icon-dynamic.player-progress-thumb-active
        .player-progress-move-indicator
          .player-progress-move-indicator-down
          .player-progress-move-indicator-up
        .player-progress-popup
          .player-progress-preview
            img.player-progress-preview-image
            .player-progress-preview-time
          .player-progress-hotspot
        .player-progress-pull-indicator
        .player-progress-cursor
```

---

## 22. 附录 F: PbpControls 高能进度条

> **文件**: `packages/player/src/components/PbpControls.ts`
> **状态**: [已有/正确]

DOM 结构:
```
.player-pbp
  span.common-svg-icon
  .player-pbp-pin
    .player-pbp-pin-icon
      span.common-svg-icon
      span.player-pbp-pin-tip "打开《高能进度条》常驻"
```

---

## 23. 附录 G: SendBar 发送栏

> **文件**: `packages/player/src/components/SendBar.ts`
> **参考**: `player-reference/src/component/sendbar/index.ts`
> **状态**: [已有/正确] — DOM 和子组件注入已与既有实现一致

DOM 结构:
```
.player-sending-bar
  .player-video-info
    .player-video-info-online
      b (1000+)
      "人正在看"
    .player-video-info-divide (，)
    .player-video-info-dm (已装填 N 条弹幕)
  .player-dm-root
    .player-dm-switch.danmaku-switch
      .switch-area
        input.danmaku-switch-input[type=checkbox][checked]
        label.danmaku-switch-label
          span.danmaku-switch-on > span.common-svg-icon
          span.danmaku-switch-off > span.common-svg-icon
    .player-dm-setting
      span.common-svg-icon
      .player-dm-setting-wrap
        .player-dm-setting-box.ui.ui-panel.ui-dark
          [DmSetting 子组件]
    .player-video-inputbar.player-checkBox-hide
      .player-video-inputbar-wrap[data-v-risk=fingerprint]
        .player-video-btn-dm
          span.player-iconfont.player-iconfont-danmakutype > span.common-svg-icon
          .player-mode-selection-container
            [DmSelection 子组件]
        .player-dm-wrap[style=display:none]
          "请先" a[data-action=login] "或" a[data-action=login]
        input.player-dm-input[placeholder=...][autocomplete=off][style=display:block]
      .player-dm-btn-send.player-button.disabled[data-v-risk=fingerprint]
        .button-blue "发送"
```

动态逻辑 (已实现):
- 设置按钮 hover → rafTimeout 300ms → `classList.add('player-dm-setting-show')`
- 类型按钮 hover → rafTimeout 300ms → `classList.add('player-mode-selection-show')`
- 弹幕开关 change → trigger switch-dm
- 输入框 focus/blur → trigger input-focus/input-blur
- 开关 hover → rafTimeout 300ms → show tooltip
- 发送按钮点击 → trigger send-danmaku

---

## 24. 附录 H: DmSetting 弹幕设置

> **文件**: `packages/player/src/components/DmSetting.ts`
> **状态**: [已有/正确]

DOM 结构:
```
.player-dm-setting-panel-wrap
  .player-dm-setting-panel
    .player-dm-setting-block
      .player-dm-setting-block-title "按类型屏蔽"
      .player-dm-setting-block-conent
        .player-block-filter-type.player-block-typeScroll
          span.player-block-filter-image
          span.player-block-filter-label "滚动"
        .player-block-filter-type.player-block-typeTop (顶部)
        .player-block-filter-type.player-block-typeBottom (底部)
        .player-block-filter-type.player-block-typeColor (彩色)
    .player-dm-setting-panel-radio
    .player-dm-setting-panel-area (.opacity / .fontsize / .speed 结构相同)
      .player-dm-setting-panel-area-title "显示区域"
      .player-dm-setting-panel-area-content
        .ui.ui-slider.ui-dark
          .ui-area > .ui-track > .ui-bar-wrap > .ui-bar + .ui-thumb > .ui-thumb-dot
```

---

## 25. 附录 I: Selection 模式选择

> **文件**: `packages/player/src/components/Selection.ts`
> **状态**: [已有/正确]

DOM 结构:
```
.player-mode-selection-panel
  .player-mode-selection-row.fontsize
    .row-title "字号"
    .row-selection
      .hui-radio-wrap-button
        .radio-button "小" / .radio-button "标准"
  .player-mode-selection-row.mode
    .row-title "模式"
    .row-selection
      .selection-span.js-action (×3: 滚动/顶部/底部)
        span.selection-icon > svg > path
        span.selection-name
  .player-mode-selection-row.color
    .row-title "颜色"
    .row-selection
      .color-input-warp
        input[type=text]
        .color-input-box
    ul.color-picker-options
      li.color-picker-option (×14色)
```

---

## 26. 附录 J: Ending 结束面板

> **文件**: `packages/player/src/components/Ending.ts`
> **状态**: [已有/正确]

DOM 结构:
```
.player-ending-wrap
  .player-ending-backdrop
  .player-ending-panel[data-option=1]
    .player-ending
      .player-ending-content[screen-mode=second-screen]
        .player-ending-functions
          .player-ending-functions-avatar > a > img
          .player-ending-functions-upinfo
            .player-ending-functions-name > a
            .player-ending-functions-buttons
              .player-ending-functions-electric
              .player-ending-functions-follow
          .player-ending-functions-common
            .player-ending-functions-btn[data-action=restart] "重播"
            .player-ending-functions-pagecallback
              .player-ending-functions-btn[data-action=like] "好评"
              .player-ending-functions-btn[data-action=coin] "投币"
              .player-ending-functions-btn[data-action=collect] "收藏"
              .player-ending-functions-btn[data-action=share] "分享"
        .player-ending-related
          .player-ending-related-item
            .player-ending-related-item-img
            .player-ending-related-item-cover
              .player-ending-related-item-title
              .player-ending-related-item-watchlater > i
  .player-share-panel[data-option=2]
    .player-video-share-box
      .player-video-share-header > .player-video-share-close
      .player-video-share-content
        .player-video-share-left
          .player-video-share-source (.weibo / .qq)
          .player-video-share-link
            .player-video-share-link-label / .player-video-share-link-content
        .player-video-share-right
          .player-video-share-qrcode > canvas
```

---

## 27. 附录 K: RowCmd 互动命令

> **文件**: `packages/player/src/components/RowCmd.ts`
> **状态**: [已有/正确]

DOM 结构:
```
.player-cmd-dm-wrap
  .player-cmd-dm-inside
    .hl-editor.hl-card-hide              — 点赞关注卡片 (条件渲染)
      .hl-guide-three
        span.hl-guide-three-like.is_active
        span.hl-guide-three-coin
        span.hl-guide-three-collect
      .hl-guide-follow.no-follow
        span.hl-guide-follow-0 / .hl-guide-follow-1
    .hl-link.hl-card-hide                — 外链卡片 (条件渲染)
      span.hl-circle
      .hl-link-left > .hl-link-icon + .hl-link-msg
      .hl-link-line
      .hl-link-right > .hl-link-watchlater
    .hl-vote                              — 投票卡片 (条件渲染)
      span.hl-circle
      .hl-vote-question
      .hl-vote-an > .hl-vote-an-bg > .hl-vote-an-bg-buffer
                 > .hl-vote-an-text > .hl-vote-an-text-index + .hl-vote-an-text-doc
    .hl-score.hl-card-hide               — 评分卡片 (条件渲染)
      span.hl-circle
      .hl-score-title
      .hl-score-area > .hl-score-area-item (×5)
      .hl-score-result / .hl-score-count
```

动态逻辑 (已实现):
- `currentTimeChange(time)` → 根据 `timeStart/timeEnd` 控制卡片的显示/隐藏
- 卡片有 `hl-card-hide` (完全隐藏) / `hl-hide` (消失动画) 两种隐藏状态
- 卡片关闭时间 (`closeTime`) 逻辑

---

## 28. 附录 L: RowDm 弹幕容器

> **文件**: `packages/player/src/components/RowDm.ts`
> **状态**: [已有/正确]

DOM 结构:
```
.player-row-dm-wrap.danmaku-x-paused
  .player-adv-dm-wrap
  .player-bas-dm-wrap
    .bas-danmaku.bas-danmaku-pause
  .danmaku-x-dm-rotate
```

动态逻辑 (已实现):
- `createDanmaku(currentTime)` → 从 danmakuInfo.danmakuList 筛选时间匹配的弹幕
- 为每条弹幕创建 `.danmaku-x-dm` 元素并插入 `.player-row-dm-wrap`
- 滚动弹幕 → `.danmaku-x-roll` + CSS `--translateX` / `--duration` 动画
- 固定弹幕 → `.danmaku-x-center` + CSS `--translateY` 定位
- 轨道管理: 12条轨道 (rollRow / topRow / bottomRow)
- 动画结束 → `animationend` → 移除元素

---

## 29. 附录 M: 其余组件

以下组件 DOM 结构已与参考完全一致，`packages/player/src/components/` 中的现有代码正确。仅列出 DOM 结构供核对:

### Top (`Top.ts`) — 顶部标题栏

```
.player-top-wrap
  .player-top-mask[hidden]
  .player-top-title
  .player-top-follow
  .player-top-left
    .player-top-left-title
    .player-top-left-follow
      .player-follow
        img.player-follow-face
        span.player-follow-icon > span.common-svg-icon
        span.player-follow-text "关注"
  .player-top-issue
    span.player-top-issue-icon > span.common-svg-icon
```

### State (`State.ts`) — 暂停/缓冲图标

```
.player-state-wrap
  .player-state-play
  .player-state-buff-icon
  .player-state-buff-text
    span.player-state-buff-title "正在缓冲..."
    span.player-state-buff-speed
```

### Loading (`Loading.ts`) — 加载动画

```
.player-loading-panel
  .player-loading-panel-text
  .player-loading-panel-blur
    .player-loading-panel-blur-detail
```

### Toast (`Toast.ts`) — 提示

```
.player-toast-wrap
  .player-toast-auto
  .player-toast-fixed
    span.player-toast-close > span.common-svg-icon
    span.player-toast-text
    span.player-toast-time
    span.player-toast-jump "跳转"
```

### Dialog (`Dialog.ts`) — 弹窗

```
.player-dialog-wrap
```

### VolumeHint (`VolumeHint.ts`) — 音量提示

```
.player-volume-hint
  span.player-volume-hint-icon
  span.player-volume-hint-text
```

### Mini (`Mini.ts`) — 迷你播放器

```
.player-mini-warp
  .player-mini-close
  .player-mini-state
    .player-mini-state-play / .player-mini-state-pause
  .player-mini-progress
    .player-mini-progress-buffer / .player-mini-progress-tempo
```

### Context (`Context.ts`) — 右键菜单

```
.player-context-area
  ul.player-contextmenu.player-black
    li[data-action=...] (×5项)
```

### Tooltips (`Tooltips.ts`) — 工具提示

```
.player-tooltip-area
  .player-tooltip-item[data-name=...]
    .player-tooltip-title
```

### ColorPanel (`ColorPanel.ts`) — 色彩调整

```
.player-color-panel
  .player-color-panel-title
    span.player-color-panel-close
  .player-color-panel-saturate.player-color-wrap
    .player-color-panel-name + slider + .player-color-panel-value
  .player-color-panel-brightness.player-color-wrap (同上)
  .player-color-panel-contrast.player-color-wrap (同上)
  .player-color-panel-reset > .player-color-panel-btn > .ui-button-black
```

### HotkeyPanel (`HotkeyPanel.ts`) — 快捷键

```
.player-hotkey-panel
  .player-hotkey-panel-title
    span.player-hotkey-panel-close
  .player-hotkey-panel-area
    .player-hotkey-panel-content
      .player-hotkey-item (×14项)
        span.player-hotkey-name + span.player-hotkey-desc
```

### VideoInfo (`VideoInfo.ts`) — 统计信息

```
.player-info-container
  .player-info-title
    span.player-info-close
  .player-info-panel
    .info-line (×N项)
      span.info-title + span.info-data
```

### Checkbox (`Checkbox.ts`) — 复选框

```
.u-checkbox > .u-checkbox-wrap > .u-checkbox-box
  span.checkbox-box
  span.checkbox-label
```

### Switch (`Switch.ts`) — 开关

```
.ui-switch
  input[type=checkbox]
  .switch-inner
  .switch-circle
```

### Slider (`Slider.ts`) — 滑块

```
.ui-area
  .ui-progress-wrap
    .ui-progress-bar
      span.ui-progress-dot
    .ui-progress-step (可选 — 标记点)
  .ui-progress-val
```

### ProgressClose (`ProgressClose.ts`) — 进度关闭

```
svg.close-warp[viewBox="0 0 150 150"]
  circle.close-bg
  circle.progress-circle[stroke-dasharray=377]
  path[stroke=#fff] (× 号)
```

---

## 30. 附录 N: VideoPlayer 核心类

> **文件**: `packages/player/src/player/VideoPlayer.ts`
> **状态**: [已有/需改] — 核心逻辑已有，需添加 SSR hydrate 和 StreamMiddleware 集成

```typescript
/**
 * ============================================
 * VideoPlayer — 视频播放器核心类
 * ============================================
 *
 * 实现 ComponentInstance<PlayerConfig> 和 PlayerMethods 接口。
 * 使用 h() 函数渲染 PlayerDocker 组件，通过 ref 获取 DOM 引用，
 * 通过 state (StateManager) 管理运行时状态，通过 store (PlayerStore) 管理持久化。
 *
 * 原有代码基本正确，需要添加:
 *   1. streamMiddleware 属性
 *   2. hydrate() 方法 (SSR 客户端激活)
 *   3. 构造函数中调用 detectCapability()
 *   4. props.callbacks 回调支持
 */

export class VideoPlayer implements ComponentInstance<PlayerConfig>, PlayerMethods {
  props: PlayerConfig;
  el?: HTMLElement;

  // ===== DOM 引用 =====
  private videoEl: HTMLVideoElement | null = null;
  private containerEl: HTMLElement | null = null;

  // ===== 核心系统 =====
  state: StateManager;
  store: PlayerStore;
  events: EventBus;
  private pluginManager: PluginManager | null = null;

  /** [新增] 流媒体中间件 */
  streamMiddleware: StreamMiddleware | null = null;

  /** [新增] 浏览器能力检测缓存 */
  private browserCapability: BrowserCapabilityResult | null = null;

  // ===== 构造 — 已正确实现 =====
  constructor(config: PlayerConfig) {
    this.props = { ...defaultConfig, ...config };
    // ... 初始化 state/store/events/pluginManager ...
    this.registerPlugins();
    // [新增] 浏览器检测
    this.detectCapability();
  }

  // ===== 渲染 — 已正确实现 =====
  render(): VNode { return h(PlayerDocker, { ... }); }

  // ===== 挂载 — 已正确实现 =====
  mount(container: HTMLElement): void { ... }

  // ===== [新增] hydrate — SSR 客户端激活 =====
  hydrate(container: HTMLElement): void {
    this.containerEl = container;
    // 复用已有 DOM 的 video 元素
    this.videoEl = container.querySelector('video')
      || document.createElement('video');
    // 绑定 ref (通过 data-ref 属性)
    // 绑定事件
    // 初始化插件
  }

  // ===== [新增] 浏览器能力检测 =====
  private detectCapability(): void { ... }

  // ===== 播放控制 — 已正确实现 =====
  async play(): Promise<void> { ... }
  pause(): void { ... }
  toggle(): void { ... }
  seek(time: number): void { ... }
  setVolume(volume: number): void { ... }
  toggleMute(): void { ... }
  setMuted(muted: boolean): void { ... }
  setPlaybackRate(rate: number): void { ... }
  async toggleFullscreen(): Promise<void> { ... }
  async togglePip(): Promise<void> { ... }
  setQuality(quality: QualityLevel): void { ... }
  reload(): void { ... }
  destroy(): void { ... }
  getState(): PlayerStateData { ... }

  // ===== 插件管理 — 已正确实现 =====
  use(plugin: Plugin): VideoPlayer { ... }
  getPlugin<T extends Plugin>(name: string): T | undefined { ... }
  uninstallPlugin(name: string): void { ... }

  // ===== 事件 — 已正确实现 =====
  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void { ... }
  off<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void { ... }
}
```

---

## 附录 O: 各组件详细 h() 代码

以下为每个组件的完整 h() 实现代码。标注 `[已有/正确]` 的组件可参照 `packages/player/src/components/` 下的现有文件，
标注 `[已有/需改]` 的组件列出了需要修改的完整代码。

### O.1 SendBar 发送栏 [已有/正确]

`packages/player/src/components/SendBar.ts` 中的代码已正确，DOM 结构和动态逻辑与参考 `sendbar/index.ts` 一致。

关键动态逻辑（已实现）:
- 设置按钮 hover → `rafTimeout` 300ms → 切换 `player-dm-setting-show` 类名
- 类型按钮 hover → `rafTimeout` 300ms → 切换 `player-mode-selection-show` 类名
- 弹幕开关 change → 触发 `onDanmakuSwitch(checked)`
- 输入框 Enter 键 → 触发 `onSendDanmaku(text)`
- 开关区域 hover → `rafTimeout` 300ms → 显示 tooltip
- `DmSetting` 和 `DmSelection` 子组件通过 ref 容器注入

### O.2 DmSetting 弹幕设置面板 [已有/正确]

`packages/player/src/components/DmSetting.ts` 已正确实现。每个滑块使用 `ui.ui-slider.ui-dark` 结构：

```typescript
// 滑块渲染函数 (已实现)
const renderSlider = (value: number): VNode =>
  h('div', { class: 'ui ui-slider ui-dark' },
    h('div', { class: 'ui-area' },
      h('div', { class: 'ui-track' },
        h('div', { class: 'ui-bar-wrap' },
          h('div', { class: 'ui-bar ui-bar-normal', role: 'progressbar',
            style: { transform: `scaleX(${value / 100})` } })
        ),
        h('div', { class: 'ui-thumb', style: { transform: `translateX(${(value / 100) * 268}px)` } },
          h('div', { class: 'ui-thumb-dot' })
        )
      )
    )
  );
```

四个滑块: 显示区域(area) / 不透明度(opacity) / 弹幕字号(fontsize) / 弹幕速度(speed)
四个屏蔽类型按钮: 滚动(scroll) / 顶部(top) / 底部(bottom) / 彩色(color)

### O.3 Selection 模式/颜色选择 [已有/正确]

`packages/player/src/components/Selection.ts` 已正确实现。

关键逻辑:
- 14 种预设颜色 (COLOR_LIST) → `map()` 生成 `li.color-picker-option`
- 3 种弹幕模式 (滚动/顶部/底部) → `map()` 生成 `.selection-span.js-action`
- 2 种字号 (小/标准) → `.radio-button`
- 颜色输入框支持 `#RRGGBB` 格式校验
- 状态通过 `currentColor / currentMode / currentSize` 闭包变量管理

### O.4 Ending 结束面板 [已有/正确]

`packages/player/src/components/Ending.ts` 已正确实现。

关键动态逻辑（已实现）:
- `showEndWrap()` → `endingWrapRef.setAttribute('data-select', '1')` → 显示推荐面板
- `showSharePanel()` → `endingWrapRef.setAttribute('data-select', '2')` → 显示分享面板
- `closeEndWrap()` → `endingWrapRef.removeAttribute('data-select')` → 关闭
- UP 主信息、相关视频列表、分享链接/二维码 通过 props 传入
- 二维码使用 `canvas[width=150][height=150]` 元素

### O.5 RowCmd 互动命令 [已有/被替代]

`packages/player/src/components/RowCmd.ts` 现有实现正确，但将被 `InteractionLayer.ts` (容器) + `InteractionPlugin` (逻辑) 替代，详见附录 T。

关键动态逻辑（已实现）:
- `currentTimeChange(time)` → 遍历所有卡片，根据 `timeStart/timeEnd` 控制显示:
  - 在时间范围内 → `classList.remove('hl-card-hide', 'hl-hide')` 完全显示
  - 消失动画时间内 (endTime±0.6s) → `classList.add('hl-hide')` 播放消失动画
  - 在范围外 → `classList.add('hl-card-hide')` 完全隐藏
- 卡片关闭时间 (`closeTime`) 逻辑: closeTime > currentTime 时重置 isClose
- 四种卡片: guideThree (点赞关注) / link (外链) / vote (投票) / score (评分)
- 卡片 DOM 在 setup 中创建并插入 `.player-cmd-dm-inside`，运行时只切换类名

```typescript
// 卡片显示控制核心逻辑 (已实现)
const displayItem = <T extends { timeStart?: number; timeEnd?: number; closeTime?: number; isClose?: boolean; element?: HTMLDivElement }>(
  list: T[], currTimePoint: number
): void => {
  list.forEach((item) => {
    if (item.closeTime !== undefined && item.closeTime > currTimePoint) {
      item.isClose = false;
    }
    if (item.closeTime !== undefined && item.closeTime <= currTimePoint && item.isClose) return;
    if (item.timeStart !== undefined && item.timeEnd !== undefined) {
      if (currTimePoint < item.timeEnd && item.timeStart <= currTimePoint) {
        item.element?.classList.remove('hl-card-hide', 'hl-hide');           // 完全显示
      } else if (item.timeEnd - 0.6 <= currTimePoint && item.timeEnd + 0.6 > currTimePoint) {
        item.element?.classList.remove('hl-card-hide');
        item.element?.classList.add('hl-hide');                              // 消失动画
      } else if (currTimePoint < item.timeStart - 0.6 || item.timeEnd + 0.6 < currTimePoint) {
        item.element?.classList.remove('hl-hide');
        item.element?.classList.add('hl-card-hide');                         // 完全隐藏
      }
    }
  });
};
```

### O.6 RowDm 弹幕容器 [已有/正确]

`packages/player/src/components/RowDm.ts` 已正确实现。

关键动态逻辑（已实现）:
- `getTimePointDm(currTimePoint)` → 从 `danmakuInfo.danmakuList` 筛选 `lastTimePoint < timePoint <= currTimePoint` 的弹幕
- `createDanmuElement(danmaku)` → `document.createElement('div')` + 设置 className `danmaku-x-dm` + 样式 + hover 事件
- `handleScrollDanmu(element, currTimePoint, speed)` → 添加到 `.danmaku-x-roll` + 计算 `--translateX`/`--duration` + 轨道分配
- `handleFixedDanmu(danmaku, element, currTimePoint, trackArray)` → 添加到 `.danmaku-x-center` + 计算 `--translateY` + 轨道分配
- 轨道管理: `findAvailablePosition(trackArray, currTimePoint)` → 12条轨道的空闲查找
- 动画结束 → `animationend` 事件 → `element.remove()`

```typescript
// 弹幕轨道查找 (已实现)
const findAvailablePosition = (trackArray: number[], currTimePoint: number): { index: number; full: boolean } => {
  // 释放已结束的轨道 (trackArray[i] < currTimePoint → -1)
  for (let i = 0; i < trackArray.length; i++) {
    if (trackArray[i] < currTimePoint) trackArray[i] = -1;
  }
  // 查找空闲轨道
  for (let i = 0; i < trackArray.length; i++) {
    if (trackArray[i] === -1) return { index: i, full: false };
  }
  // 所有轨道都被占用 — 找最早结束的
  let min = Infinity, minIndex = 0;
  for (let i = 0; i < trackArray.length; i++) {
    if (trackArray[i] < min && trackArray[i] >= currTimePoint) {
      min = trackArray[i]; minIndex = i;
    }
  }
  return { index: minIndex, full: true };
};
```

### O.7 Controls 控制条 [已有/正确]

`packages/player/src/components/Controls.ts` (863行) 已正确实现。

关键动态逻辑（已实现）:
- **进度条拖拽**: mousedown → 记录起始位置 → mousemove → 计算进度比例 → 更新 `progressThumb` 位置和 `player-ctrl-time-current` 文本 → mouseup → 触发 seek
- **分段进度条**: `config.progressViewPoints` 数组 → 每个分段独立渲染 `.player-progress-schedule` 元素 → `updateSegmentedProgress(current)` 逐个更新 scaleX
- **缓冲进度**: `updateSegmentedBuffer(buffer)` → 逐个分段更新 `.player-progress-schedule-buffer` 的 scaleX
- **菜单动画**: hover → `rafTimeout` → 切换菜单显示类名 → leave → `rafTimeout` → 隐藏
- **音量滑块**: 垂直拖拽 → 计算 `(startY - clientY) / height` → 更新 volume → 同步 `.slider-bar` 的 scaleY
- **预览图**: mousemove → 计算位置 → 显示 `.player-progress-popup` → 设置 previewImage src 和 previewTime 文本
- **设置面板**: 点击"更多播放设置" → 切换 `.state-show-right` 和 `.player-ctrl-seting-more-area` 类名

### O.8 其余组件 [已有/正确]

以下组件代码在 `packages/player/src/components/` 中已正确实现，与既有播放器 DOM 结构和动态逻辑一致，无需修改:

| 组件 | 文件 | 关键动态逻辑 |
|------|------|-------------|
| Top | `Top.ts` | follow 按钮点击切换 `.no-follow` / `.following` 类名 |
| State | `State.ts` | 格式化缓冲速度 bytes/s → "X.XMB/S" |
| Loading | `Loading.ts` | 通过 `classList.add('state-loading')` 显示，`remove` 隐藏 |
| Toast | `Toast.ts` | `openToast()` / `closeToast()` 控制显示，支持 jump 回调 |
| Dialog | `Dialog.ts` | `showDmTip(dmTip, container)` 在弹幕 hover 时显示弹幕详情 |
| VolumeHint | `VolumeHint.ts` | `show()` + `updateVolumeHint(volume)` 显示音量百分比 |
| Mini | `Mini.ts` | `changeTempo(time)` / `changeBuffer(buffer)` 更新迷你进度条 |
| Context | `Context.ts` | `showMenu(offset)` 定位右键菜单，`document.addEventListener('click', hide)` 代理隐藏 |
| Tooltips | `Tooltips.ts` | `openTip(element, dataName)` 定位提示框，`closeTip(dataName)` 隐藏 |
| ColorPanel | `ColorPanel.ts` | 3 个滑块 (饱和度/亮度/对比度) + 重置按钮，点击"重置"恢复默认值 100 |
| HotkeyPanel | `HotkeyPanel.ts` | 14 项快捷键列表，支持滚动 |
| VideoInfo | `VideoInfo.ts` | 9 行统计信息，关闭按钮 |
| Checkbox | `Checkbox.ts` | 点击切换 `.checkbox-checked` 类名 + 触发 onChange |
| Switch | `Switch.ts` | 点击切换 `.switch-checked` 类名 + 触发 onChange，支持 disabled |
| Slider | `Slider.ts` | mousedown → mousemove → 计算百分比 → 更新 `.ui-progress-bar` 宽度 → mouseup |
| ProgressClose | `ProgressClose.ts` | SVG circle stroke-dashoffset 动画，进度值 0-1 映射到 377-0 |

**以上所有组件的完整代码见 `packages/player/src/components/` 目录。组件与既有播放器的 DOM 结构和类名已逐一核对一致。**

---

## 附录 P: 精细化拆分子组件

以下是从 Controls 中进一步拆分的子组件，遵循高内聚低耦合原则。

### P.1 VolumeSlider — 音量滑块组件 [新增]

> **从**: RightControls 中音量部分拆分
> **Props**: `volume: number` (0-1), `muted: boolean`
> **回调**: `onVolumeChange(volume)`, `onMuteToggle()`

```typescript
/**
 * ============================================
 * VolumeSlider — 音量滑块组件
 * ============================================
 *
 * 从 RightControls 中独立拆分。管理音量滑块的拖拽交互和显示更新。
 *
 * @param volume - 当前音量 0 ～ 1
 * @param muted - 是否静音
 * @param onVolumeChange - 音量变化回调 (子→父)
 * @param onMuteToggle - 静音切换回调 (子→父)
 * @param onMenuAnimation - 菜单动画回调 (通知父 Controls 管理菜单显示/隐藏)
 *
 * @component
 */

export interface VolumeSliderProps {
  /** 当前音量 0-1 */
  volume: number;
  /** 是否静音 */
  muted: boolean;
  /** 音量变化回调 */
  onVolumeChange?: (volume: number) => void;
  /** 静音切换回调 */
  onMuteToggle?: () => void;
}

export const VolumeSlider = defineComponent<VolumeSliderProps>((props, lifecycle) => {

  // ===== DOM 引用 =====
  /** 音量按钮容器 — 挂载 state-muted 类名 */
  const volumeBtnRef: { current: HTMLDivElement | null } = { current: null };
  /** 音量数值显示 */
  const volumeNumberRef: { current: HTMLDivElement | null } = { current: null };
  /** 滑块进度条 */
  const volumeProgressbarRef: { current: HTMLDivElement | null } = { current: null };
  /** 滑块拖拽手柄 */
  const volumeSliderThumbRef: { current: HTMLDivElement | null } = { current: null };
  /** 滑块轨道区域 */
  const volumeSliderAreaRef: { current: HTMLDivElement | null } = { current: null };

  // ===== 拖拽状态 =====
  let isDragging = false;
  let startY = 0;
  const SLIDER_HEIGHT = 60; // 像素

  // ===== 更新函数 =====
  /** 更新音量显示 — 操作 DOM */
  const updateDisplay = (vol: number): void => {
    if (volumeNumberRef.current) {
      volumeNumberRef.current.innerHTML = Math.floor(vol * 100).toString();
    }
    if (volumeProgressbarRef.current) {
      volumeProgressbarRef.current.style.transform = `scaleY(${vol})`;
    }
    if (volumeSliderThumbRef.current) {
      volumeSliderThumbRef.current.style.transform = `translateY(${-(SLIDER_HEIGHT * vol - 6)}px)`;
    }
  };

  /** 更新静音状态 */
  const updateMute = (muted: boolean): void => {
    volumeBtnRef.current?.classList.toggle('state-muted', muted);
  };

  // ===== 事件处理 =====
  const handleVolumeMouseDown = (event: MouseEvent): void => {
    isDragging = true;
    startY = event.clientY;
    document.addEventListener('mousemove', handleVolumeMouseMove);
    document.addEventListener('mouseup', handleVolumeMouseUp);
  };

  const handleVolumeMouseMove = (event: MouseEvent): void => {
    if (!isDragging || !volumeSliderAreaRef.current) return;
    const deltaY = startY - event.clientY;
    const rect = volumeSliderAreaRef.current.getBoundingClientRect();
    const newVolume = Math.min(1, Math.max(0, props.volume + deltaY / rect.height));
    props.onVolumeChange?.(newVolume);
    updateDisplay(newVolume);
    startY = event.clientY;
  };

  const handleVolumeMouseUp = (): void => {
    isDragging = false;
    document.removeEventListener('mousemove', handleVolumeMouseMove);
    document.removeEventListener('mouseup', handleVolumeMouseUp);
  };

  // ===== 生命周期 =====
  lifecycle.onMounted = (): void => {
    updateDisplay(props.volume);
    updateMute(props.muted);
  };

  return h('div', {
    class: 'player-ctrl-btn player-ctrl-volume',
    role: 'button',
    'aria-label': '音量',
    ref: volumeBtnRef,
    onClick: () => props.onMuteToggle?.(),
  },
    // 音量图标 (非静音)
    h('div', { class: 'player-ctrl-btn-icon player-ctrl-volume-icon' },
      h('span', { class: 'common-svg-icon' })
    ),
    // 静音图标
    h('div', { class: 'player-ctrl-btn-icon player-ctrl-muted-icon' },
      h('span', { class: 'common-svg-icon' })
    ),
    // 音量弹出框
    h('div', { class: 'player-ctrl-volume-box' },
      h('div', { class: 'player-ctrl-volume-number', ref: volumeNumberRef }),
      h('div', { class: 'player-ctrl-volume-progress slider' },
        h('div', {
          class: 'slider-area',
          ref: volumeSliderAreaRef,
          onClick: handleVolumeMouseDown,
          onMouseDown: handleVolumeMouseDown,
        },
          h('div', { class: 'slider-bar-wrap' },
            h('div', { class: 'slider-bar', role: 'progressbar', ref: volumeProgressbarRef })
          ),
          h('div', { class: 'slider-thumb', role: 'thumb', ref: volumeSliderThumbRef },
            h('div', { class: 'slider-thumb-dot' })
          )
        )
      )
    )
  );
});
```

### P.2 QualityMenu — 画质选择菜单 [新增]

> **从**: RightControls 中画质部分拆分
> **Props**: `qualities: { label: string; value: string }[]`, `currentQuality: string`
> **回调**: `onQualityChange(quality: string)`

```typescript
export interface QualityMenuProps {
  /** 可用画质列表 */
  qualities?: { label: string; value: string; badge?: string }[];
  /** 当前选中画质 */
  currentQuality?: string;
  /** 画质切换回调 */
  onQualityChange?: (quality: string) => void;
  /** 菜单动画回调 */
  onMenuAnimation?: (type: string, action: 'show' | 'hide') => void;
}

export const QualityMenu = defineComponent<QualityMenuProps>((props, lifecycle) => {
  const resultRef: { current: HTMLDivElement | null } = { current: null };
  const menuRef: { current: HTMLUListElement | null } = { current: null };

  /** 选中画质 — 由外部调用更新 */
  const select = (quality: string): void => {
    if (resultRef.current) resultRef.current.textContent = quality;
    props.onQualityChange?.(quality);
  };

  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('qualityReady', { select });
  };

  return h('div', {
    class: 'player-ctrl-btn player-ctrl-quality',
    role: 'button',
    'aria-label': '清晰度',
    onMouseEnter: () => props.onMenuAnimation?.('quality', 'show'),
    onMouseLeave: () => props.onMenuAnimation?.('quality', 'hide'),
  },
    h('div', { class: 'player-ctrl-quality-result', ref: resultRef },
      props.currentQuality ?? '自动'
    ),
    h('div', { class: 'player-ctrl-quality-menu-wrap' },
      h('ul', { class: 'player-ctrl-quality-menu', ref: menuRef },
        ...(props.qualities ?? []).map((q) =>
          h('li', {
            class: 'player-ctrl-quality-menu-item',
            onClick: () => select(q.value),
          },
            h('span', { class: 'player-ctrl-quality-text' }, q.label),
            q.badge ? h('span', { class: `player-ctrl-quality-badge ${q.badge}` }, '大会员') : null
          )
        )
      )
    )
  );
});
```

### P.3 PlaybackRateMenu — 倍速选择菜单 [新增]

> **从**: RightControls 中倍速部分拆分

```typescript
export interface PlaybackRateMenuProps {
  /** 当前倍速 */
  rate?: number;
  /** 可用倍速列表 */
  rates?: number[];
  /** 倍速切换回调 */
  onRateChange?: (rate: number) => void;
  onMenuAnimation?: (type: string, action: 'show' | 'hide') => void;
}

export const PlaybackRateMenu = defineComponent<PlaybackRateMenuProps>((props, lifecycle) => {
  const resultRef: { current: HTMLDivElement | null } = { current: null };
  const menuRef: { current: HTMLUListElement | null } = { current: null };
  const menuItems: HTMLLIElement[] = [];

  const rates = props.rates ?? [2.0, 1.5, 1.25, 1.0, 0.75, 0.5];

  /** 选中倍速 — 高亮对应菜单项 */
  const select = (rate: number): void => {
    menuItems.forEach((item) => item.classList.remove('player-state-active'));
    if (resultRef.current) {
      resultRef.current.textContent = rate === 1 ? '倍速' : `${rate}X`;
    }
    props.onRateChange?.(rate);
  };

  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('rateReady', { select });
  };

  return h('div', {
    class: 'player-ctrl-btn player-ctrl-playbackrate',
    role: 'button',
    'aria-label': '倍速',
    onMouseEnter: () => props.onMenuAnimation?.('playbackrate', 'show'),
    onMouseLeave: () => props.onMenuAnimation?.('playbackrate', 'hide'),
  },
    h('div', { class: 'player-ctrl-playbackrate-result', ref: resultRef }, '倍速'),
    h('div', { class: 'player-ctrl-playbackrate-menu-wrap' },
      h('ul', { class: 'player-ctrl-playbackrate-menu', ref: menuRef },
        ...rates.map((rate) =>
          h('li', {
            class: `player-ctrl-playbackrate-menu-item${rate === (props.rate ?? 1) ? ' player-state-active' : ''}`,
            'data-value': String(rate),
            onClick: () => select(rate),
            // [步骤: 保存 DOM 引用用于后续高亮切换]
            ref: (el: HTMLElement) => { if (el instanceof HTMLLIElement) menuItems.push(el); },
          }, rate === 1 ? '1.0X' : `${rate}X`)
        )
      )
    )
  );
});
```

### P.4 ProgressBar — 进度条组件 [新增]

> **从**: TopControls 中进度条逻辑拆分
> **Props**: `duration: number`
> **回调**: `onSeek(time)`, `onSeekStart()`, `onSeekEnd()`

```typescript
export interface ProgressBarProps {
  /** 视频总时长 (秒) */
  duration: number;
  /** 进度跳转回调 */
  onSeek?: (time: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
}

export const ProgressBar = defineComponent<ProgressBarProps>((props, lifecycle) => {

  // ===== DOM 引用 =====
  const areaRef: { current: HTMLDivElement | null } = { current: null };
  const scheduleWrapRef: { current: HTMLDivElement | null } = { current: null };
  const thumbRef: { current: HTMLDivElement | null } = { current: null };
  const moveIndicatorRef: { current: HTMLDivElement | null } = { current: null };
  const popupRef: { current: HTMLDivElement | null } = { current: null };
  const previewImageRef: { current: HTMLImageElement | null } = { current: null };
  const previewTimeRef: { current: HTMLDivElement | null } = { current: null };

  // ===== 拖拽状态 =====
  let isDragging = false;

  /** 更新进度条位置 — 由外部 VideoPlayer timeUpdate 调用 */
  const updateCurrent = (currentTime: number): void => {
    if (!areaRef.current || !thumbRef.current) return;
    const position = (currentTime / props.duration) * areaRef.current.clientWidth - 10;
    thumbRef.current.style.transform = `translateX(${position}px)`;
  };

  /** 更新缓冲进度 */
  const updateBuffer = (bufferTime: number): void => {
    if (!scheduleWrapRef.current) return;
    const buffers = scheduleWrapRef.current.querySelectorAll('.player-progress-schedule-buffer');
    buffers.forEach((buf) => {
      (buf as HTMLDivElement).style.transform = `scaleX(${bufferTime / props.duration})`;
    });
  };

  // ===== 事件处理 =====
  const handleMouseDown = (event: MouseEvent): void => {
    isDragging = true;
    props.onSeekStart?.();
    seekFromEvent(event);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent): void => {
    if (!isDragging) return;
    seekFromEvent(event); // 拖拽时实时更新
  };

  const handleMouseUp = (): void => {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    props.onSeekEnd?.();
  };

  /** 从鼠标事件计算进度时间并触发 seek */
  const seekFromEvent = (event: MouseEvent): void => {
    if (!areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const time = ratio * props.duration;
    updateCurrent(time);
    props.onSeek?.(time);
  };

  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('progressReady', { updateCurrent, updateBuffer });
  };

  return h('div', { class: 'player-progress-area', ref: areaRef,
    onMouseMove: (e: MouseEvent) => { if (isDragging) handleMouseMove(e); },
    onMouseDown: handleMouseDown,
  },
    h('div', { class: 'player-progress-wrap' },
      h('div', { class: 'player-progress', style: { height: '4px' } },
        h('div', { class: 'player-progress-schedule-wrap', ref: scheduleWrapRef }),
        h('div', { class: 'player-progress-point-wrap' }),
        h('div', { class: 'player-progress-thumb', ref: thumbRef },
          h('div', { class: 'player-progress-thumb-icon player-progress-thumb-icon-dynamic player-progress-thumb-active' },
            h('span', { class: 'common-svg-icon' })
          )
        ),
        h('div', { class: 'player-progress-move-indicator', ref: moveIndicatorRef },
          h('div', { class: 'player-progress-move-indicator-down' }),
          h('div', { class: 'player-progress-move-indicator-up' })
        ),
        h('div', { class: 'player-progress-popup', ref: popupRef },
          h('div', { class: 'player-progress-preview' },
            h('img', { class: 'player-progress-preview-image', ref: previewImageRef }),
            h('div', { class: 'player-progress-preview-time', ref: previewTimeRef })
          ),
          h('div', { class: 'player-progress-hotspot' })
        ),
        h('div', { class: 'player-progress-pull-indicator', style: { transform: 'translateX(0px)' } },
          h('span', { class: 'common-svg-icon' })
        ),
        h('div', { class: 'player-progress-cursor' })
      )
    )
  );
});
```

### P.5 拆分后的 RightControls 简化版

拆分后 RightControls 只负责组装子组件和转发回调:

```typescript
export const RightControls = defineComponent<RightControlsProps>((props, lifecycle) => {
  // [已有/需改] — 音量/画质/倍速/设置部分 替换为独立子组件
  return h('div', { class: 'player-control-bottom-right' },

    // [条件] 画质 — 独立子组件
    props.config.quality ? h(QualityMenu, {
      currentQuality: '自动',
      qualities: [{ label: '自动', value: 'auto' }],
      onQualityChange: (q) => lifecycle.emit?.('qualityChange', q),
      onMenuAnimation: (type, action) => lifecycle.emit?.('menuAnimation', type, action),
    }) : null,

    // 倍速 — 独立子组件
    h(PlaybackRateMenu, {
      rate: 1,
      onRateChange: (r) => lifecycle.emit?.('backrateChange', r),
      onMenuAnimation: (type, action) => lifecycle.emit?.('menuAnimation', type, action),
    }),

    // 音量 — 独立子组件
    h(VolumeSlider, {
      volume: 0.3,
      muted: false,
      onVolumeChange: (v) => lifecycle.emit?.('volumeChange', v),
      onMuteToggle: () => lifecycle.emit?.('mute'),
    }),

    // 设置 / 画中画 / 宽屏 / 网页全屏 / 全屏 — 保持不变
    // [已有代码保持]
  );
});
```

### P.6 组件依赖关系图 (最终)

> LottieIcon 被所有 Controls 子组件共用 — 通过 Props 传入动画数据，不依赖任何业务逻辑。

```
LottieIcon (通用) ←──┐
                     │ 所有 Controls 子组件都使用 LottieIcon
                     │
PlayerDocker
  ├── Top.ts                (独立, Props: title/avatar, Callback: onIssueClick/onFollowClick)
  ├── State.ts              (独立, Props: bufferSpeed/buffering)
  ├── Loading.ts            (独立, Props: loading/text)
  ├── Toast.ts              (独立, Props: visible/text/jumpTime, Callback: onClose/onJump)
  ├── Dialog.ts             (独立, 按需创建)
  ├── Context.ts            (独立, Props: menuItems, Callback: onMenuClick)
  ├── Tooltips.ts           (独立, Props: items/activeName)
  ├── RowDm.ts              (独立, 弹幕容器)
  ├── InteractionLayer.ts   (独立, 互动容器 — 只渲染 .player-cmd-dm-inside)
  ├── Ending.ts             (独立, Props: upInfo/relatedVideo, Callback: onRestart/onLike/onShare等)
  ├── ColorPanel.ts         (独立, 按需创建)
  ├── HotkeyPanel.ts        (独立, 按需创建)
  ├── VideoInfo.ts          (独立, 按需创建)
  ├── VolumeHint.ts         (独立, 按需创建)
  ├── Mini.ts               (独立, 按需创建)
  ├── SendBar.ts            (独立, Callback: onSend)
  │     ├── DmSetting.ts    (子组件, 弹幕设置)
  │     └── Selection.ts    (子组件, 模式/颜色选择)
  │
  └── Controls.ts           (组装容器, Callback: onPlayPause/onSeek/onVolumeChange/...)
        ├── ProgressBar.ts    [新增] 进度条 (Props: duration, Callback: onSeek)
        ├── LeftControls.ts    (简化 — 只有: prev/play/next/time)
        │     └── ViewpointMenu.ts [新增] 章节选择
        ├── RightControls.ts   (简化 — 只组装)
        │     ├── QualityMenu.ts        [新增]
        │     ├── PlaybackRateMenu.ts   [新增]
        │     ├── VolumeSlider.ts       [新增]
        │     └── SettingMenu.ts        [新增] (保留原有设置面板逻辑)
        └── PbpControls.ts    (独立, 高能进度条)
```

---

## 附录 Q: Lottie 图标系统

### Q.0 资源清单

```
assets/
├── lottie-icon/                          # Lottie 动画 JSON 文件
│   ├── play-animation.json               # 播放图标 (18 KB)
│   ├── pause-to-play-animation.json      # 暂停 → 播放 过渡
│   ├── play-to-pause-animation.json      # 播放 → 暂停 过渡
│   ├── fast-forward-animation.json       # 快进图标
│   ├── fullscreen-animation.json         # 全屏图标
│   ├── web-fullscreen-animation.json     # 网页全屏进入
│   ├── web-exit-fullscreen-animation.json# 网页全屏退出
│   ├── wide-hover-animation.json         # 宽屏 hover
│   ├── wide-exit-hover-animation.json    # 宽屏退出 hover
│   ├── mini-window-hover-animation.json  # 画中画 hover
│   ├── mini-window-exit-hover-animation.json # 画中画退出 hover
│   ├── volume-hover-animation.json       # 音量 hover
│   ├── volume-switch-1-animation.json    # 有声 → 静音 过渡
│   ├── volume-switch-2-animation.json    # 静音 → 有声 过渡
│   ├── mute-off-animation.json           # 静音图标
│   ├── settings-animation.json           # 设置图标
│   ├── Thumb-animation.json              # 进度条滑块 (45 KB)
│   └── cursor-animation.json             # 光标图标
│
└── images/                               # 静态图片 (没有 Lottie 时使用)
    ├── ploading.png                      # 加载动画雪碧图
    ├── play.svg                          # 播放图标 (降级)
    ├── pause.svg                         # 暂停图标 (降级)
    ├── state.svg                         # 状态图标
    └── buffer.webp                       # 缓冲动画
```

### Q.1 Lottie 图标与 Controls 按钮映射

| 控件 | Lottie 文件 | 降级 (无 Lottie) | 触发条件 |
|------|-----------|------------------|---------|
| 播放/暂停按钮 | `play-to-pause-animation.json` | `play.svg` | 播放中→暂停时播放 |
| 播放/暂停按钮 | `pause-to-play-animation.json` | `pause.svg` | 暂停→播放时播放 |
| 上一集 | 无 — 旋转 play.svg 180° | `play.svg` (旋转) | 静态 |
| 下一集 | 无 — 使用 play.svg | `play.svg` | 静态 |
| 音量图标 | `volume-switch-1-animation.json` | 原 SVG 图标 | 有声→静音 时播放 |
| 音量图标 | `volume-switch-2-animation.json` | 原 SVG 图标 | 静音→有声 时播放 |
| 音量 hover | `volume-hover-animation.json` | 无 | 鼠标进入音量按钮 |
| 设置 | `settings-animation.json` | 原 SVG 图标 | 静态 + hover |
| 画中画 | `mini-window-hover-animation.json` | 原 SVG 图标 | 鼠标进入 |
| 画中画退出 | `mini-window-exit-hover-animation.json` | 原 SVG 图标 | 鼠标进入(画中画模式) |
| 宽屏 | `wide-hover-animation.json` | 原 SVG 图标 | 鼠标进入 |
| 宽屏退出 | `wide-exit-hover-animation.json` | 原 SVG 图标 | 鼠标进入(宽屏模式) |
| 网页全屏 | `web-fullscreen-animation.json` | 原 SVG 图标 | 进入网页全屏 |
| 网页全屏退出 | `web-exit-fullscreen-animation.json` | 原 SVG 图标 | 退出网页全屏 |
| 全屏 | `fullscreen-animation.json` | 原 SVG 图标 | 静态 + hover |
| 进度条滑块 | `Thumb-animation.json` | 原 SVG 图标 | 拖拽进度条时 |
| 进度条光标 | `cursor-animation.json` | 原 SVG 图标 | 鼠标在进度条上 |
| 播放状态图标 | `play-animation.json` | `play.svg` | 暂停/缓冲 状态层 |
| 加载动画 | 无 — 使用雪碧图 CSS 动画 | `ploading.png` (雪碧图) | 加载中 |
| 弹幕开关 | 无 — 使用原 SVG 图标 | 原 SVG 图标 | 静态 |
| 弹幕设置 | 无 — 使用原 SVG 图标 | 原 SVG 图标 | 静态 |

### Q.2 LottieIcon — 通用 Lottie 图标组件 [新增]

> **文件**: `packages/player/src/components/LottieIcon.ts`
> **依赖**: `lottie-web` (npm 包)
> **用途**: 封装 lottie-web 的 AnimationItem，支持播放/暂停/切换动画，支持 hover 状态

```typescript
/**
 * ============================================
 * LottieIcon — 通用 Lottie 动画图标组件
 * ============================================
 *
 * 封装 lottie-web 库，提供统一的 Lottie 动画图标渲染。
 * 使用 h() 函数创建容器元素，在 onMounted 中加载动画。
 *
 * 特性:
 *   - 支持传入 JSON 数据或 URL 路径
 *   - 支持 autoplay / loop / direction 控制
 *   - 支持 hover 状态切换 (进入/离开 不同动画)
 *   - 支持外部调用 play() / pause() / stop() / switchTo()
 *   - 销毁时自动清理 lottie 实例
 *
 * 使用示例:
 * ```typescript
 * // 基础用法: 播放一次
 * h(LottieIcon, {
 *   name: 'play',
 *   animationData: playAnimationData,
 *   autoplay: true,
 *   loop: false,
 * });
 *
 * // hover 切换: 鼠标进入/离开播放不同动画
 * h(LottieIcon, {
 *   name: 'volume',
 *   animationData: volumeIconData,
 *   hoverData: volumeHoverData,
 *   autoplay: false,
 *   loop: true,
 * });
 * ```
 *
 * @component
 */

import { h, defineComponent } from '@/core';
import type { AnimationItem } from 'lottie-web';

export interface LottieIconProps {
  /** 组件名称 — 用于 debug 和 ref 标识 */
  name: string;
  /** Lottie 动画 JSON 数据 (默认状态) */
  animationData?: unknown;
  /** Lottie 动画文件路径 (与 animationData 二选一) */
  path?: string;
  /** hover 状态的 Lottie 动画数据 — 鼠标进入时切换 */
  hoverData?: unknown;
  /** hover 状态的 Lottie 动画路径 */
  hoverPath?: string;
  /** 点击时播放一次的目标动画数据 (如 play→pause 过渡) */
  toggleData?: unknown;
  /** 是否自动播放，默认 false */
  autoplay?: boolean;
  /** 是否循环，默认 false (大多数图标动画只播放一次) */
  loop?: boolean;
  /** 播放方向: 1=正向, -1=反向 */
  direction?: 1 | -1;
  /** 播放速度，默认 1 */
  speed?: number;
  /** 容器 CSS 类名 */
  className?: string;
  /** 容器内联样式 */
  style?: Record<string, string>;
  /** 渲染器: 'svg'(默认) | 'canvas' | 'html' */
  renderer?: 'svg' | 'canvas' | 'html';
}

const LottieIcon = defineComponent<LottieIconProps>((props, lifecycle) => {

  // ===== DOM 引用 =====
  /** Lottie 动画容器 — lottie 渲染在此元素内 */
  const containerRef: { current: HTMLDivElement | null } = { current: null };

  // ===== Lottie 实例 =====
  /** 默认动画实例 */
  let animation: AnimationItem | null = null;
  /** hover 动画实例 (懒加载) */
  let hoverAnimation: AnimationItem | null = null;
  /** 当前是否 hover 状态 */
  let isHover = false;
  /** 是否已初始化 */
  let initialized = false;

  // ===== 懒加载 lottie-web =====
  /** lottie-web 模块引用 (动态导入) */
  let lottieModule: typeof import('lottie-web') | null = null;

  /**
   * 加载 lottie-web 模块 (动态导入，减小初始包体积)
   * @returns lottie-web 模块
   */
  const loadLottie = async (): Promise<typeof import('lottie-web')> => {
    if (!lottieModule) {
      lottieModule = await import('lottie-web');
    }
    return lottieModule;
  };

  /**
   * 加载并渲染 Lottie 动画
   *
   * @param animData - Lottie JSON 数据
   * @param autoplay - 是否自动播放
   * @returns AnimationItem 实例
   */
  const loadAnimation = async (
    animData: unknown,
    autoplay: boolean
  ): Promise<AnimationItem> => {
    const lottie = await loadLottie();
    if (!containerRef.current) throw new Error('容器不存在');

    const instance = lottie.default.loadAnimation({
      container: containerRef.current,
      renderer: props.renderer ?? 'svg',
      loop: props.loop ?? false,
      autoplay,
      animationData: animData,
    });

    return instance;
  };

  // ===== 公共 API (通过 lifecycle.emit 暴露给父组件) =====

  /**
   * 播放默认动画
   */
  const play = (): void => {
    if (!animation) return;
    animation.stop();
    animation.play();
  };

  /**
   * 暂停动画
   */
  const pause = (): void => {
    animation?.pause();
  };

  /**
   * 停止动画并重置到第一帧
   */
  const stop = (): void => {
    animation?.stop();
  };

  /**
   * 播放一次切换动画 (如播放→暂停过渡)
   * 播放完后自动回到默认动画
   */
  const playToggle = (): void => {
    if (!animation) return;
    // 如果有 toggleData，加载并播放一次
    if (props.toggleData) {
      animation.stop();
      // 重新设置 animationData 并播放
      // lottie 不支持直接换 animationData，需要重新加载
    }
  };

  /**
   * 切换到 hover 动画
   */
  const enterHover = async (): Promise<void> => {
    if (isHover) return;
    isHover = true;
    if (!props.hoverData && !props.hoverPath) return;

    // 懒加载 hover 动画
    if (!hoverAnimation) {
      const data = props.hoverData ?? props.hoverPath;
      if (data) {
        hoverAnimation = await loadAnimation(data, true);
        // 隐藏默认动画
        if (containerRef.current && animation) {
          const svg = containerRef.current.querySelector('svg');
          if (svg) svg.style.display = 'none';
        }
      }
    } else {
      hoverAnimation.play();
    }
  };

  /**
   * 离开 hover — 回到默认动画
   */
  const leaveHover = (): void => {
    if (!isHover) return;
    isHover = false;
    hoverAnimation?.stop();
    // 显示默认动画
    if (containerRef.current && animation) {
      const svg = containerRef.current.querySelector('svg');
      if (svg) svg.style.display = '';
    }
    animation?.play();
  };

  // ===== 生命周期 =====
  lifecycle.onMounted = async (): Promise<void> => {
    try {
      // 步骤1: 加载默认动画
      const data = props.animationData ?? props.path;
      if (data) {
        animation = await loadAnimation(data, props.autoplay ?? false);
      }
      initialized = true;

      // 步骤2: 向父组件暴露 API
      lifecycle.emit?.('lottieReady', {
        name: props.name,
        play, pause, stop, playToggle,
        enterHover, leaveHover,
        getAnimation: () => animation,
      });
    } catch (err) {
      console.error(`[LottieIcon:${props.name}] 加载失败:`, err);
    }
  };

  lifecycle.onBeforeDestroy = (): void => {
    // 销毁 lottie 实例，释放内存
    animation?.destroy();
    hoverAnimation?.destroy();
    animation = null;
    hoverAnimation = null;
  };

  // ===== 渲染 =====
  return h('div', {
    class: `lottie-icon ${props.className ?? ''}`.trim(),
    style: {
      display: 'inline-flex',
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      ...props.style,
    },
    ref: containerRef,
    'data-lottie-name': props.name,
    // hover 事件
    onMouseEnter: () => enterHover,
    onMouseLeave: () => leaveHover,
  });
});

export default LottieIcon;
```

### Q.3 LottieIcon 使用模式

#### 模式 1: 静态图标 (如 设置按钮)

```typescript
h(LottieIcon, {
  name: 'settings',
  path: '/assets/lottie-icon/settings-animation.json',
  autoplay: false,
  loop: false,
})
// 父组件通过 ref 获取 API 后调用: api.play()
```

#### 模式 2: hover 切换 (如 音量按钮)

```typescript
// 在 RightControls 中
const volumeLottieRef: { current: LottieIconAPI | null } = { current: null };

h(LottieIcon, {
  name: 'volume',
  animationData: volumeIconData,           // 默认: 音量图标
  hoverData: volumeHoverData,              // hover: 音量动画
  autoplay: false,
  loop: true,
})
// LottieIcon 自动处理 mouseEnter → enterHover, mouseLeave → leaveHover
```

#### 模式 3: 状态切换 (如 播放/暂停按钮)

```typescript
// 播放 → 暂停: 加载 play-to-pause-animation.json, 播放一次后停在最后一帧
// 暂停 → 播放: 加载 pause-to-play-animation.json, 播放一次后停在最后一帧
const switchToPlaying = () => playLottieRef.current?.loadAndPlay(pauseToPlayData);
const switchToPaused  = () => playLottieRef.current?.loadAndPlay(playToPauseData);
```

#### 模式 4: 拖拽时触发 (如 进度条滑块)

```typescript
h(LottieIcon, {
  name: 'thumb',
  path: '/assets/lottie-icon/Thumb-animation.json',
  autoplay: false,
  loop: false,
})
// 进度条 mousedown 时: thumbLottieRef.current?.play()
// 进度条 mouseup 时: thumbLottieRef.current?.stop()
```

### Q.4 无 Lottie 时的降级处理

当 Lottie 动画加载失败或未提供时，降级到既有实现的 SVG/图片：

```typescript
// LottieIcon 组件内部
lifecycle.onMounted = async (): Promise<void> => {
  try {
    if (props.animationData || props.path) {
      // 尝试 Lottie
      animation = await loadAnimation(data, props.autoplay ?? false);
    } else if (props.fallbackSrc) {
      // 降级: 渲染静态 img/svg
      renderFallback(props.fallbackSrc);
    }
  } catch {
    // 加载失败 → 降级
    if (props.fallbackSrc) renderFallback(props.fallbackSrc);
  }
};
```

降级资源表 (对应 `assets/images/`):

| 按钮 | 降级图片 |
|------|---------|
| 播放 | `assets/images/play.svg` |
| 暂停 | `assets/images/pause.svg` |
| 加载 | `assets/images/ploading.png` (CSS 雪碧图动画) |
| 状态图标 | `assets/images/state.svg` |
| 缓冲 | `assets/images/buffer.webp` |

### Q.5 Controls 按钮图标集成清单

Controls 各按钮的图标实现方式:

```
LeftControls:
  .player-ctrl-prev     → 无 Lottie, 用 CSS transform: rotate(180deg) 翻转下一集图标
  .player-ctrl-play     → LottieIcon(name:'play'), toggleData: playToPause / pauseToPlay
  .player-ctrl-next     → 无 Lottie, 用原 SVG 图标

RightControls:
  .player-ctrl-volume   → LottieIcon(name:'volume'), hoverData: volumeHover
                           toggleData: volumeSwitch1/2 (静音切换)
  .player-ctrl-setting  → LottieIcon(name:'settings'), click 时 play
  .player-ctrl-pip      → LottieIcon(name:'pip'), hoverData: miniWindowHover
  .player-ctrl-wide     → LottieIcon(name:'wide'), hoverData: wideHover
  .player-ctrl-web      → LottieIcon(name:'webFullscreen'), toggle: webFullscreen / webExitFullscreen
  .player-ctrl-full     → LottieIcon(name:'fullscreen')

TopControls:
  .player-progress-thumb-icon → LottieIcon(name:'thumb'), mousedown 时 play
  .player-progress-cursor     → LottieIcon(name:'cursor'), mousemove 时显示

State:
  .player-state-play    → LottieIcon(name:'playState'), playAnimation.json

PbpControls:
  .player-pbp           → 无 Lottie, 用原 SVG 图标

SendBar:
  .player-dm-switch     → 无 Lottie, 用原 SVG 图标 (弹幕开关 on/off)
  .player-dm-setting    → 无 Lottie, 用原 SVG 图标
  .player-video-btn-dm  → 无 Lottie, 用原 SVG 图标 (弹幕类型选择)
```

---

## 附录 R: 组件 API 参考 — 强制 Props / 回调 / 功能约束

> **阅读说明**: 每个组件列出必须实现的 Props（父→子）、回调（子→父）、暴露的公共方法（父组件可调用）。
> `[M]` = Mandatory 强制，`[O]` = Optional 可选。

### Q.1 PlayerDocker — 播放器入口

**Props**:`PlayerDockerProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `src` | `string` | [M] | 视频源 URL |
| `playerName` | `string` | [O] | 播放器名称，设置 aria-label |
| `autoplay` | `boolean` | [O] | 是否自动播放，默认 false |
| `volume` | `number` | [O] | 初始音量 0-1，默认 0.3 |
| `muted` | `boolean` | [O] | 是否静音，默认 false |
| `poster` | `string` | [O] | 封面图 URL |
| `onMounted` | `(elements: DockerElements) => void` | [M] | 挂载完成回调，返回 container/videoArea/videoWrap/video/sendingArea 引用 |

**回调 (子→父，通过 lifecycle.emit)**:

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `playerLoaded` | 无 | 播放器初始化完成 |
| `videoCreated` | `{ video: HTMLVideoElement }` | video 元素创建完成 |
| `loadedMetadata` | `duration: number` | 元数据加载完成 |
| `timeUpdate` | `currentTime: number` | 播放时间更新 |
| `ended` | 无 | 播放结束 |
| `enterMini` | 无 | 进入迷你播放器模式 |
| `contextMenu` | `{ x: number; y: number }` | 右键菜单触发 |

**暴露的公共方法 (父组件通过 onMounted 回调获取或通过 ref 调用)**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `togglePlayPause` | `() => void` | 切换播放/暂停 |
| `toggleFullscreen` | `() => void` | 切换全屏 |
| `toggleMute` | `() => void` | 切换静音 |
| `showControls` | `(from: 'video'\|'control'\|'top') => void` | 显示控制条 |
| `hideControls` | `() => void` | 隐藏控制条 |
| `closeMiniPlayer` | `() => void` | 关闭迷你播放器 |

**功能约束**:
- [M] video 元素必须在 onMounted 中动态创建，不在 VNode 中预定义
- [M] loadedmetadata 之后才能初始化 Controls（需要 video.duration）
- [M] 支持 Space/F/M/Arrow 键盘快捷键
- [M] 支持 IntersectionObserver 自动切换迷你播放器
- [M] 3 秒无操作自动隐藏控制条

---

### Q.2 Controls — 控制条组装容器

**Props**:`ControlsProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `duration` | `number` | [M] | 视频总时长 |
| `volume` | `number` | [M] | 当前音量 0-1 |
| `backrate` | `number` | [M] | 当前倍速 |
| `config` | `ControlConfig` | [M] | 控制条配置 (哪些按钮显示、progressViewPoints 等) |
| `isEdit` | `boolean` | [M] | 是否编辑模式 |

**回调 (子→父，Props 回调)**:

| 回调 | 签名 | 强制 | 说明 |
|------|------|------|------|
| `onPlayPause` | `() => void` | [M] | 播放/暂停 |
| `onSeek` | `(time: number) => void` | [M] | 进度跳转 |
| `onSeekStart` | `() => void` | [M] | 拖拽开始 |
| `onSeekEnd` | `() => void` | [M] | 拖拽结束 |
| `onVolumeChange` | `(volume: number) => void` | [M] | 音量变化 |
| `onMuteToggle` | `() => void` | [M] | 静音切换 |
| `onBackrateChange` | `(rate: number) => void` | [M] | 倍速变化 |
| `onFullscreenToggle` | `() => void` | [M] | 全屏切换 |
| `onPrev` | `() => void` | [O] | 上一集 |
| `onNext` | `() => void` | [O] | 下一集 |
| `onQualityChange` | `(quality: string) => void` | [O] | 画质切换 |
| `onSettingChange` | `(key: string, value: boolean) => void` | [O] | 设置变化 |
| `onShowTooltip` | `(tooltip: Tooltip) => void` | [O] | 显示提示 |
| `onHideTooltip` | `(tooltip: Tooltip) => void` | [O] | 隐藏提示 |

**暴露给 VideoPlayer 的公共方法 (通过 lifecycle.emit('controlsReady', api) 暴露)**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `updateCurrent` | `(time: number) => void` | VideoPlayer 每帧调用，更新进度条和当前时间显示 |
| `updateBuffer` | `(buffer: number) => void` | VideoPlayer progress 事件调用，更新缓冲进度 |
| `updateVolumeDisplay` | `(volume: number) => void` | 更新音量显示 |
| `upadteMute` | `(muted: boolean) => void` | 更新静音图标 |
| `showControl` | `() => void` | 显示控制条 |
| `hideControl` | `() => void` | 隐藏控制条 |
| `getDom` | `(selector: string) => HTMLElement \| null` | 获取子元素 DOM（全屏时 SendBar 移动用） |

**功能约束**:
- [M] 进度条拖拽: mousedown → mousemove 实时更新 → mouseup 触发 onSeek
- [M] 菜单 hover 显示/隐藏使用 rafTimeout 300ms 延迟，防止误触发
- [M] Controls 不内联子组件 DOM — 全部通过 h(SubComponent, props) 组装
- [M] Controls 自身不管理音乐/画质等业务逻辑 — 只转发事件给 VideoPlayer

---

### Q.3 ProgressBar — 进度条 [新增]

**Props**:`ProgressBarProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `duration` | `number` | [M] | 视频总时长 |
| `progressViewPoints` | `ProgressViewPoint[]` | [O] | 分段进度标记点 |
| `onSeek` | `(time: number) => void` | [M] | 进度跳转回调 |
| `onSeekStart` | `() => void` | [M] | 拖拽开始回调 |
| `onSeekEnd` | `() => void` | [M] | 拖拽结束回调 |

**暴露的公共方法 (通过 lifecycle.emit('progressReady', api) 暴露)**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `updateCurrent` | `(time: number) => void` | 更新当前进度位置 |
| `updateBuffer` | `(buffer: number) => void` | 更新缓冲进度条 |

**功能约束**:
- [M] mousedown 开始拖拽 → document 级别 mousemove/mouseup（防止鼠标移出进度条区域）
- [M] 拖拽时实时更新 thumb 位置和 popup 时间显示
- [M] 支持分段进度: 每个 ProgressViewPoint 独立渲染 `.player-progress-schedule` 元素
- [M] 预览图: mousemove 时更新 popup 位置 + previewImage src + previewTime 文本

---

### Q.4 VolumeSlider — 音量滑块 [新增]

**Props**:`VolumeSliderProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `volume` | `number` | [M] | 当前音量 0-1 |
| `muted` | `boolean` | [M] | 是否静音 |
| `onVolumeChange` | `(volume: number) => void` | [M] | 音量变化回调 |
| `onMuteToggle` | `() => void` | [M] | 静音切换回调 |

**暴露的公共方法 (通过 lifecycle.emit('volumeReady', api) 暴露)**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `updateDisplay` | `(volume: number) => void` | 更新滑块位置和数值显示 |
| `updateMute` | `(muted: boolean) => void` | 切换静音图标 |

**功能约束**:
- [M] 垂直拖拽: mousedown → mousemove 计算 deltaY → 换算音量百分比
- [M] 拖拽时 document 级别事件绑定（防止鼠标移出滑块区域）
- [M] 静音/非静音图标切换通过 CSS `state-muted` 类名

---

### Q.5 QualityMenu — 画质菜单 [新增]

**Props**:`QualityMenuProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `qualities` | `{ label: string; value: string; badge?: string }[]` | [M] | 可用画质列表 |
| `currentQuality` | `string` | [M] | 当前选中画质 |
| `onQualityChange` | `(quality: string) => void` | [M] | 画质切换回调 |
| `onMenuAnimation` | `(type: string, action: 'show'\|'hide') => void` | [M] | 菜单动画回调 |

**暴露的公共方法**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `select` | `(quality: string) => void` | 外部调用切换画质，更新显示文本 + 触发回调 |

**功能约束**:
- [M] 菜单 hover 显示/隐藏通过父组件统一管理（onMenuAnimation 回调）
- [M] 选中项用 `.player-state-active` 类名高亮

---

### Q.6 PlaybackRateMenu — 倍速菜单 [新增]

**Props**:`PlaybackRateMenuProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `rate` | `number` | [O] | 当前倍速，默认 1 |
| `rates` | `number[]` | [O] | 可用倍速列表，默认 [2.0, 1.5, 1.25, 1.0, 0.75, 0.5] |
| `onRateChange` | `(rate: number) => void` | [M] | 倍速切换回调 |
| `onMenuAnimation` | `(type: string, action: 'show'\|'hide') => void` | [M] | 菜单动画回调 |

**暴露的公共方法**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `select` | `(rate: number) => void` | 外部调用切换倍速 |

**功能约束**:
- [M] 选中项用 `player-state-active` 类名高亮
- [M] 1.0X 显示为"倍速"，其他显示为"X.X X"

---

### Q.7 SendBar — 发送栏

**Props**:`SendBarProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `onlineCount` | `string` | [O] | 在线人数，默认 "1000+" |
| `danmakuCount` | `string` | [O] | 弹幕数量，默认 "0" |
| `placeholder` | `string` | [O] | 输入框占位符 |
| `danmakuSwitch` | `boolean` | [O] | 弹幕开关初始状态，默认 true |
| `showLoginTip` | `boolean` | [O] | 是否显示登录提示 |
| `onSendDanmaku` | `(text: string) => void` | [M] | 发送弹幕回调 |
| `onDanmakuSwitch` | `(checked: boolean) => void` | [M] | 弹幕开关切换回调 |

**暴露的公共方法**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `moveDom` | `(target: HTMLElement) => void` | 全屏时把发送栏移动到控制条内 |

**功能约束**:
- [M] 设置按钮 hover 300ms → `player-dm-setting-show` 类名切换
- [M] 类型按钮 hover 300ms → `player-mode-selection-show` 类名切换
- [M] Enter 键发送弹幕，空内容时发送按钮 disabled
- [M] DmSetting 和 DmSelection 子组件在 onMounted 中通过 ref 容器注入

---

### Q.8 DmSetting — 弹幕设置面板

**Props**:`DmSettingProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `visible` | `boolean` | [O] | 是否显示 |
| `opacity` | `number` | [O] | 不透明度 0-100 |
| `area` | `number` | [O] | 显示区域 0-100 |
| `fontsize` | `number` | [O] | 弹幕字号 0-100 |
| `speed` | `number` | [O] | 弹幕速度 0-100 |
| `filter` | `{ scroll?: boolean; top?: boolean; bottom?: boolean; color?: boolean }` | [O] | 屏蔽类型 |
| `onSettingChange` | `(type: string, value: number) => void` | [M] | 设置变化回调 |

**功能约束**:
- [M] 4 个滑块 (区域/透明度/字号/速度) — 使用 `ui.ui-slider.ui-dark` 结构
- [M] 4 个屏蔽类型按钮 (滚动/顶部/底部/彩色) — 切换选中状态

---

### Q.9 Ending — 结束面板

**Props**:`EndingProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `upInfo` | `{ id: string; name: string; avatar: string; followCount: number }` | [O] | UP主信息 |
| `relatedVideo` | `{ title: string; cover: string; bvid: string }` | [O] | 相关推荐视频 |
| `bvid` | `string` | [O] | 当前视频 BV 号 |
| `videoUrl` | `string` | [O] | 视频链接 |
| `iframeCode` | `string` | [O] | 嵌入代码 |
| `onRestart` | `() => void` | [M] | 重播回调 |
| `onFollow` | `() => void` | [M] | 关注回调 |
| `onLike` | `() => void` | [M] | 点赞回调 |
| `onCoin` | `() => void` | [M] | 投币回调 |
| `onCollect` | `() => void` | [M] | 收藏回调 |
| `onShare` | `() => void` | [M] | 分享回调 |
| `onCloseShare` | `() => void` | [M] | 关闭分享回调 |
| `onCopyLink` | `(type: 'html' \| 'iframe') => void` | [M] | 复制链接回调 |

**暴露的公共方法**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `showEndWrap` | `() => void` | `data-select="1"` → 显示推荐面板 |
| `closeEndWrap` | `() => void` | `removeAttribute('data-select')` → 关闭 |
| `showSharePanel` | `() => void` | `data-select="2"` → 显示分享面板 |
| `closeSharePanel` | `() => void` | `data-select="1"` → 返回推荐面板 |

**功能约束**:
- [M] 通过 `data-select` 属性在推荐/分享/关闭 三个状态间切换
- [M] 分享面板包含二维码 canvas (150x150) 和链接复制功能

---

### Q.10 RowCmd — 互动命令卡片 [已有/被替代]

> 将被 InteractionLayer + InteractionPlugin 四子插件替代，详见附录 T。

**Props**:`RowCmdProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `isEdit` | `boolean` | [M] | 是否编辑模式 |
| `onLike` | `() => void` | [M] | 点赞回调 |
| `onCoin` | `() => void` | [M] | 投币回调 |
| `onCollect` | `() => void` | [M] | 收藏回调 |
| `onFollow` | `() => void` | [M] | 关注回调 |
| `onLinkClick` | `(link: InteractionLink) => void` | [M] | 外链点击回调 |
| `onVoteSelect` | `(voteIndex: number, optionIndex: number) => void` | [M] | 投票选择回调 |
| `onScoreSelect` | `(scoreIndex: number, value: number) => void` | [M] | 评分选择回调 |
| `onCardClose` | `(type: CardType, index: number) => void` | [M] | 卡片关闭回调 |

**暴露的公共方法**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `currentTimeChange` | `(time: number) => void` | VideoPlayer timeUpdate 调用，控制卡片显示/隐藏 |

**功能约束**:
- [M] 卡片显示逻辑: `timeStart <= currentTime < timeEnd` → 完全显示
- [M] 消失动画: `endTime - 0.6s <= currentTime < endTime + 0.6s` → `hl-hide` 类名
- [M] 完全隐藏: 其他时间 → `hl-card-hide` 类名
- [M] 卡片关闭时间 (closeTime) 逻辑: closeTime > currentTime 时重置 isClose = false

---

### Q.11 RowDm — DOM 弹幕容器

**Props**:`RowDmProps`

| 字段 | 类型 | 强制 | 说明 |
|------|------|------|------|
| `danmakuList` | `DanmakuItem[]` | [M] | 弹幕数据列表 |
| `dmBottom` | `number` | [O] | 底部安全距离，默认 90 |

**暴露的公共方法 (通过 lifecycle.emit 事件通讯)**:

| 事件/方法 | 说明 |
|----------|------|
| `createDanmaku(currentTime)` | 筛选匹配时间的弹幕并创建 DOM 元素 |
| `playPause(action)` | `"playing"` → 移除暂停类名, `"paused"` → 添加暂停类名 |

**功能约束**:
- [M] 12 条轨道管理 (rollRow/topRow/bottomRow)
- [M] 滚动弹幕: `.danmaku-x-roll` + CSS `--translateX`/`--duration` 动画
- [M] 固定弹幕: `.danmaku-x-center` + CSS `--translateY` 定位
- [M] 动画结束 `animationend` → 移除元素（避免 DOM 堆积）

---

### Q.12 其余组件 API 摘要

| 组件 | 核心 Props | 核心回调 | 暴露方法 |
|------|-----------|---------|---------|
| **Top** | `title`, `avatar`, `visible` | `onIssueClick`, `onFollowClick` | `setTitle`, `setFollowState` |
| **State** | `bufferSpeed`, `buffering` | 无 | 通过 ref 操作 |
| **Loading** | `loading`, `text` | 无 | 通过 ref 操作 |
| **Toast** | `visible`, `text`, `jumpTime` | `onClose`, `onJump` | `openToast`, `closeToast` |
| **Dialog** | 无 (通过方法调用) | 无 | `showDmTip(dmTip, container)`, `hideDmTip(element)` |
| **VolumeHint** | `volume`, `visible` | 无 | `show()`, `updateVolumeHint(volume)` |
| **Mini** | `duration`, `buffer`, `currentTime` | `onClose`, `onStateChange` | `changeTempo(time)`, `changeBuffer(buffer)` |
| **Context** | `menuItems`, `version` | `onMenuClick(action)`, `onOpenPanel(panel)` | `showMenu(offset)` |
| **Tooltips** | `items`, `activeName` | 无 | `openTip(element, dataName)`, `closeTip(dataName)`, `updateTip(name, title)` |
| **ColorPanel** | `visible`, `saturate`, `brightness`, `contrast` | `onClose`, `onReset`, `onSaturateChange`, `onBrightnessChange`, `onContrastChange` | `open()` |
| **HotkeyPanel** | `visible`, `hotkeys` | `onClose` | `open()` |
| **VideoInfo** | `visible`, `items` | `onClose` | `open()` |
| **Selection** | `initialColor`, `initialMode`, `initialSize` | `onColorChange`, `onModeChange`, `onSizeChange` | 通过 ref 操作 |
| **Checkbox** | `checked`, `label` | `onChange(checked)` | 通过 ref 操作 |
| **Switch** | `checked`, `disabled`, `loading` | `onChange(checked)` | 通过 ref 操作 |
| **Slider** | `value`, `marks`, `step` | `onChange(value)`, `onDragStart`, `onDragEnd` | 通过 ref 操作 |
| **ProgressClose** | `progress` (0-1) | `onClick` | `updateProgress(progress)` |
| **PbpControls** | 无 | 无 (通过 emit) | 通过 ref 操作 |

### Q.13 组件通信规则总结

```
┌─────────────────────────────────────────────────────────────────┐
│ 规则 1: Props 向下 — 父组件通过 h(Child, { ...props }) 传数据   │
│ 规则 2: Callback 向上 — 子组件通过 props.onXxx() 通知父组件     │
│ 规则 3: API 暴露 — 子组件通过 lifecycle.emit('ready', api) 暴露 │
│ 规则 4: DOM 隔离 — 组件只操作自己 ref.current 内的 DOM          │
│ 规则 5: 状态自管 — 组件内部状态用闭包变量，不暴露给外部          │
└─────────────────────────────────────────────────────────────────┘

示例 — VideoPlayer 调用 Controls API 的完整链路:

  VideoPlayer.timeUpdate()
    → controlsApi.updateCurrent(currentTime)     // 规则 3: 调用暴露的 API
    → ProgressBar.updateCurrent(time)             // 规则 1: 内部通过 Props 传递
    → LeftControls.updateTimeDisplay(time)        // 规则 1: 内部通过 Props 传递

示例 — 用户点击全屏按钮的回调链路:

  用户点击 .player-ctrl-full
    → RightControls onClick → props.onFullscreenToggle?.()   // 规则 2: 回调向上
    → Controls.onFullscreenToggle() → emit 给 PlayerDocker
    → PlayerDocker.toggleFullscreen() → requestFullscreen()
```

---

## 附录 S: 跨组件事件通信 — EventBus 设计

### S.1 通信方式选择规则

```
┌──────────────────────────────────────────────────────────────────┐
│ 通信距离          │ 使用方式         │ 示例                      │
├───────────────────┼─────────────────┼───────────────────────────┤
│ 父 → 子 (1级)     │ Props           │ h(Controls, { volume })   │
│ 子 → 父 (1级)     │ Callback Props  │ onVolumeChange(vol)       │
│ 子 → 父 (同级通知) │ lifecycle.emit  │ emit('controlsReady',api) │
│ 跨多级 / 多播     │ EventBus        │ events.emit(FULLSCREEN)   │
│ 插件 ↔ 播放器     │ EventBus        │ events.on(PLAY, handler)  │
│ 插件 → 插件       │ EventBus        │ danmaku:toggle 事件       │
│ 拦截/修改行为     │ HookSystem      │ hooks.run(BEFORE_PLAY)    │
└──────────────────────────────────────────────────────────────────┘
```

**核心原则**:
- 1 级通信用 Props/Callback — 明确、可追踪、类型安全
- 跨级/广播用 EventBus — 解耦、可扩展、不破坏 Props 链
- EventBus 不替代 Props — 能 Props 就不 EventBus

### S.2 EventBus 事件命名规范

```
格式: [模块]:[动作]

播放器核心事件:  player:play, player:pause, player:ended, player:timeUpdate
全屏/画中画:     player:fullscreenChange, player:pipChange
弹幕事件:        danmaku:toggle, danmaku:send, danmaku:clear
字幕事件:        subtitle:toggle, subtitle:switch
流媒体事件:      stream:loadComplete, stream:error
交互事件:        interaction:like, interaction:voteSelect
监控事件:        monitor:statsUpdate, monitor:bitrateUpdate
```

### S.3 EventBus 与 Props/Callback 的分工

#### 场景 1: 单级通信 → Props + Callback (不使用 EventBus)

```typescript
// ❌ 错误 — 1 级通信用了 EventBus
Controls 内部: events.emit('player:play')
VideoPlayer:   events.on('player:play', () => this.play())

// ✅ 正确 — 1 级通信用 Callback Props
h(Controls, { onPlayPause: () => this.play() })
```

#### 场景 2: 跨级广播 → EventBus

```typescript
// 全屏状态变化需要通知多个组件:
//   Controls → 调整 UI 布局
//   SendBar → moveDom 到控制条内
//   Tooltips → 更新提示文字
//   RowDm → 调整 dmBottom
//   DanmakuPlugin → 调整弹幕区域

// ✅ 正确 — 跨级广播用 EventBus
VideoPlayer 全屏变化时:
  this.events.emit(PlayerEventEnum.FULLSCREEN_CHANGE, { isFullscreen: true });

// 各组件/插件各自监听:
controlsReady 中:  player.events.on('FULLSCREEN_CHANGE', (data) => { ... });
DanmakuPlugin 中:  player.events.on('FULLSCREEN_CHANGE', (data) => { ... });
```

#### 场景 3: 插件间通信 → EventBus

```typescript
// DanmakuPlugin 发送弹幕 → InteractionPlugin 显示互动效果
// ❌ 不能: DanmakuPlugin 直接调用 InteractionPlugin 的方法 (强耦合)
// ✅ 正确: 通过 EventBus 广播

// DanmakuPlugin:
player.events.emit('danmaku:sent', { text, userId });

// InteractionPlugin (或其他任何关心此事件的插件):
player.events.on('danmaku:sent', (data) => { showEffect(data); });
```

### S.4 完整事件清单

```typescript
/**
 * ============================================
 * 播放器事件枚举 — 用于 EventBus 通信
 * ============================================
 *
 * 命名规则: [模块]:[动作]
 * 跨组件/跨插件通信使用 EventBus，单级通信使用 Props/Callback
 */
export enum PlayerEventEnum {
  // ===== 播放状态 (VideoPlayer → 全部) =====
  STATE_CHANGE = 'STATE_CHANGE',         // 播放状态变化 (idle/playing/paused/ended/...)
  PLAY = 'PLAY',                         // 开始播放
  PAUSE = 'PAUSE',                       // 暂停
  ENDED = 'ENDED',                       // 播放结束 → Ending 面板 + DanmakuPlugin.stop
  TIME_UPDATE = 'TIME_UPDATE',           // 时间更新 { time: number } → InteractionPlugin / Controls
  WAITING = 'WAITING',                   // 缓冲开始 → Loading/State
  CAN_PLAY = 'CAN_PLAY',                 // 缓冲完成 → Loading/State
  PROGRESS = 'PROGRESS',                 // 缓冲进度 { buffer: number } → Controls

  // ===== 全屏/画中画 (VideoPlayer → Controls/SendBar/Tooltips/RowDm/全部插件) =====
  FULLSCREEN_CHANGE = 'FULLSCREEN_CHANGE', // { isFullscreen: boolean }
  PIP_CHANGE = 'PIP_CHANGE',               // { isPip: boolean }
  WEB_FULLSCREEN_CHANGE = 'WEB_FULLSCREEN_CHANGE',

  // ===== 音量/倍速/画质 (Controls/VideoPlayer → VolumeHint/全部插件) =====
  VOLUME_CHANGE = 'VOLUME_CHANGE',       // { volume, muted }
  RATE_CHANGE = 'RATE_CHANGE',           // { rate }
  QUALITY_CHANGE = 'QUALITY_CHANGE',     // { quality }

  // ===== 生命周期 (VideoPlayer → 全部插件) =====
  READY = 'READY',                       // 播放器初始化完成 { browserCapability }
  MOUNTED = 'MOUNTED',                   // DOM 挂载完成 { container, video }
  DESTROY = 'DESTROY',                   // 播放器销毁 → 插件卸载

  // ===== 弹幕 (SendBar/RowDm/DanmakuPlugin → 其他插件/组件) =====
  DANMAKU_TOGGLE = 'DANMAKU_TOGGLE',     // 弹幕开关 { visible }
  DANMAKU_SEND = 'DANMAKU_SEND',         // 发送弹幕 { text, options }
  DANMAKU_SENT = 'DANMAKU_SENT',         // 弹幕发送成功 { danmaku }
  DANMAKU_CLEAR = 'DANMAKU_CLEAR',       // 清空弹幕
  DANMAKU_SETTING_CHANGE = 'DANMAKU_SETTING_CHANGE', // 弹幕设置变更

  // ===== 字幕 (SubtitlePlugin/Controls → 其他) =====
  SUBTITLE_TOGGLE = 'SUBTITLE_TOGGLE',
  SUBTITLE_SWITCH = 'SUBTITLE_SWITCH',

  // ===== 互动 (InteractionPlugin → 其他) =====
  INTERACTION_LIKE = 'INTERACTION_LIKE',
  INTERACTION_VOTE = 'INTERACTION_VOTE',

  // ===== 流媒体 (StreamPlugin → Monitor/InfoPanel) =====
  STREAM_LOAD_COMPLETE = 'STREAM_LOAD_COMPLETE',
  STREAM_ERROR = 'STREAM_ERROR',
  STREAM_STATS_UPDATE = 'STREAM_STATS_UPDATE',

  // ===== 监控 (Monitor → InfoPanel/Chart) =====
  MONITOR_STATS = 'MONITOR_STATS',
  MONITOR_BITRATE = 'MONITOR_BITRATE',
}
```

### S.5 EventBus 实现细节

```typescript
/**
 * ============================================
 * EventBus — 跨组件/跨插件事件通信
 * ============================================
 *
 * 基于发布-订阅模式，支持:
 *   - on(event, handler) → 订阅事件 (返回取消订阅函数)
 *   - once(event, handler) → 一次性订阅
 *   - emit(event, payload) → 触发事件
 *   - off(event, handler) → 取消订阅
 *   - offAll(event?) → 清空指定/全部事件
 *
 * 线程安全: 在 emit 过程中不允许 on/off (防止遍历时修改订阅列表)
 */
export interface EventBus {
  /**
   * 订阅事件
   * @param event - 事件名 (建议使用 PlayerEventEnum)
   * @param handler - 事件处理函数
   * @returns 取消订阅的函数
   */
  on<T>(event: string, handler: (payload: T) => void): () => void;

  /**
   * 一次性订阅 — 触发一次后自动取消
   */
  once<T>(event: string, handler: (payload: T) => void): () => void;

  /**
   * 触发事件 — 同步调用所有订阅者
   * @param event - 事件名
   * @param payload - 事件数据 (可选)
   */
  emit<T>(event: string, payload?: T): void;

  /**
   * 取消订阅
   */
  off<T>(event: string, handler: (payload: T) => void): void;

  /**
   * 清空指定事件的所有订阅者，不传则清空全部
   */
  offAll(event?: string): void;
}
```

### S.6 插件上下文 (PluginContext)

插件通过 `install(player: VideoPlayer)` 获取播放器实例，通过以下 API 与播放器和其他插件交互:

```typescript
/**
 * ============================================
 * PluginContext — 插件可访问的播放器资源
 * ============================================
 *
 * 插件安装时通过 player 实例访问以下资源。
 * 插件不直接访问 player 内部属性 (如 videoEl) — 必须通过公开 API。
 */
export interface PluginContext {
  /** 播放器实例 — 调用 play/pause/seek/setVolume 等公开方法 */
  player: VideoPlayer;

  /** 
   * 状态管理器 — 读取/写入播放器运行时状态
   * 
   * 读取: state.get('player.currentTime')
   * 写入: state.set('player.volume', 0.5)
   * 订阅: state.subscribe('player.currentTime', (newVal, oldVal) => {})
   * 
   * 注意: state 是内存状态 (不持久化)，需要持久化用 player.store
   */
  state: StateManager;

  /**
   * 事件总线 — 跨组件/跨插件事件通信
   *
   * 监听播放器事件: events.on(PlayerEventEnum.PLAY, handler)
   * 发送自定义事件: events.emit('myPlugin:ready', data)
   * 
   * 常用事件:
   *   - PlayerEventEnum.PLAY / PAUSE / ENDED / TIME_UPDATE
   *   - PlayerEventEnum.FULLSCREEN_CHANGE / PIP_CHANGE
   *   - PlayerEventEnum.MOUNTED / READY / DESTROY
   *   - PlayerEventEnum.DANMAKU_TOGGLE / DANMAKU_SEND
   */
  events: EventBus;

  /**
   * 钩子系统 — 拦截/修改播放器生命周期
   *
   * 注册: hooks.register<BeforePlayCtx>(PlayerHooks.BEFORE_PLAY, (ctx) => ctx)
   * 播放器在对应时机调用 hooks.run() 执行所有注册的钩子
   */
  hooks: HookSystem;

  /** 日志 — 自动带插件名前缀 */
  log: (msg: string) => void;
}
```

### S.7 插件使用 EventBus 的标准模式

每个插件在 `install()` 中订阅自己关心的事件，在 `uninstall()` 中取消订阅:

```typescript
/**
 * DanmakuPlugin — EventBus 使用示例
 *
 * 展示插件如何通过 EventBus 监听播放器事件、与其他插件通信
 */
class DanmakuPluginClass implements Plugin {
  readonly name = 'danmaku';
  private player: VideoPlayer | null = null;
  /** 订阅取消函数列表 — uninstall 时批量调用 */
  private unsubscribers: (() => void)[] = [];

  install(player: VideoPlayer): void {
    this.player = player;
    const { events } = player;

    // 步骤1: 监听播放器核心事件
    this.unsubscribers.push(
      events.on(PlayerEventEnum.MOUNTED, (data: { container: HTMLElement; video: HTMLVideoElement }) => {
        // 获取 video 元素，初始化 DanmakuManager
        this.initManager(data.container, data.video);
      })
    );

    this.unsubscribers.push(
      events.on(PlayerEventEnum.PLAY, () => {
        this.manager?.play();  // 播放 → 弹幕开始滚动
      })
    );

    this.unsubscribers.push(
      events.on(PlayerEventEnum.PAUSE, () => {
        this.manager?.pause(); // 暂停 → 弹幕暂停
      })
    );

    this.unsubscribers.push(
      events.on(PlayerEventEnum.ENDED, () => {
        this.manager?.stop();  // 结束 → 清空弹幕
      })
    );

    // 步骤2: 监听全屏变化 → 调整弹幕区域
    this.unsubscribers.push(
      events.on(PlayerEventEnum.FULLSCREEN_CHANGE, (data: { isFullscreen: boolean }) => {
        this.manager?.switchScreenMode(data.isFullscreen ? 'fullscreen' : 'normal');
      })
    );

    // 步骤3: 监听弹幕控制事件 (来自 SendBar/Controls UI)
    this.unsubscribers.push(
      events.on('danmaku:toggle', () => this.toggle()),
      events.on('danmaku:send', (data: { text: string }) => this.sendDanmaku(data.text)),
      events.on('danmaku:clear', () => this.clear()),
    );

    // 步骤4: 广播自己的状态变化 (其他插件可以监听)
    events.emit('danmaku:initialized', { hasManager: !!this.manager });
  }

  /**
   * 卸载 — 取消所有事件订阅，防止内存泄漏
   */
  uninstall(player: VideoPlayer): void {
    // 批量取消订阅
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.manager?.destroy();
    this.manager = null;
    this.player = null;
  }
}
```

### S.8 EventBus vs lifecycle.emit 的区别

| 特性 | lifecycle.emit | EventBus.emit |
|------|---------------|---------------|
| 作用范围 | 仅父组件可监听 (通过 Props 中的 `onXxx` 回调) | 全局 — 任何组件/插件都可以监听 |
| 使用场景 | 子组件暴露 API 给父组件 | 跨级广播、插件间通信 |
| 取消方式 | 父组件解绑 Props 回调 | events.off() 或返回的取消函数 |
| 内存管理 | 组件销毁时自动清理 | 必须在 uninstall/onBeforeDestroy 中手动取消 |

### S.9 通信反模式 (禁止)

```typescript
// ❌ 反模式 1: 插件直接操作播放器内部属性
player.videoEl.currentTime = 10;  // 错误 — videoEl 是 private

// ✅ 正确: 通过公开 API
player.seek(10);

// ❌ 反模式 2: 跨级通信用 callback 链传递
// PlayerDocker → Controls → LeftControls → ViewpointMenu
//   → onSeek → onSeek → onSeek → onSeek (层层转发)

// ✅ 正确: 跨越多级时用 EventBus 广播
player.events.emit('player:seek', { time: 10 });
// 任何组件直接监听: events.on('player:seek', handler)

// ❌ 反模式 3: 插件间直接引用
import { DanmakuPlugin } from '../danmaku';
danmakuPlugin.clear();  // 强耦合!

// ✅ 正确: 通过 EventBus
events.emit('danmaku:clear');

// ❌ 反模式 4: 忘记取消订阅 (内存泄漏)
events.on('player:play', handler);  // uninstall 中没有 off

// ✅ 正确: 保存取消函数，uninstall 中调用
this.unsubscribers.push(events.on('player:play', handler));
```

---

## 附录 T: 互动插件重构 — 从 Player 侧迁移到 Plugin 侧

### T.1 设计目标

当前互动功能实现在 `packages/player/src/components/RowCmd.ts` (播放器侧组件)。
重构后，互动逻辑迁移到 `packages/plugins/src/interaction/` (插件侧)，
播放器侧仅保留容器 DOM `.player-cmd-dm-wrap > .player-cmd-dm-inside`。

**架构变化**:

```
重构前:
  player/components/RowCmd.ts   ← 播放器侧实现全部互动逻辑
  plugins/interaction/           ← 插件侧仅有薄包装

重构后:
  player/components/InteractionLayer.ts  ← 播放器侧只有容器 DOM
  plugins/interaction/
    ├── InteractionPlugin.ts      ← 主插件: 注册子插件, 管理生命周期
    ├── GuidePlugin.ts            ← 子插件: 点赞关注 (原 guideThree)
    ├── LinkPlugin.ts             ← 子插件: 外链视频 (原 link)
    ├── VotePlugin.ts             ← 子插件: 投票 (原 vote)
    └── ScorePlugin.ts            ← 子插件: 评分 (原 score)
```

### T.2 播放器侧 — InteractionLayer 组件

> **文件**: `packages/player/src/components/InteractionLayer.ts` [新增]
> **作用**: 只渲染容器 DOM，不包含任何互动逻辑。互动插件的 DOM 注入此容器。

```typescript
/**
 * ============================================
 * InteractionLayer — 互动命令容器组件
 * ============================================
 *
 * 只提供 .player-cmd-dm-inside 容器，不实现任何互动逻辑。
 * 互动功能由 InteractionPlugin 注入此容器。
 *
 * 参考原 player-cmd-dm-wrap DOM 结构（类名 100% 一致）:
 *   .player-cmd-dm-wrap
 *     .player-cmd-dm-inside
 *
 * 包含线条标记系统（拖拽编辑时的辅助线）:
 *   .hl-danmaku-x-line-horizontal (before/after 伪元素)
 *   .hl-danmaku-x-line-vertical   (before/after 伪元素)
 *
 * Props:
 *   showLines — 是否显示编辑辅助线（编辑模式 true, 展示模式 false）
 *
 * @component
 */
export interface InteractionLayerProps {
  /** 是否显示编辑辅助线 — 编辑模式为 true */
  showLines?: boolean;
  /** 边线显示状态: top/bottom/left/right */
  lineVisibility?: {
    top?: boolean; bottom?: boolean; left?: boolean; right?: boolean;
  };
}

export const InteractionLayer = defineComponent<InteractionLayerProps>((props, lifecycle) => {
  /** 内部容器 — 插件通过此 ref 注入互动卡片 */
  const insideRef: { current: HTMLDivElement | null } = { current: null };

  lifecycle.onMounted = (): void => {
    // 向外部暴露容器引用 (插件由此注入 DOM)
    lifecycle.emit?.('interactionLayerReady', { container: insideRef.current });
  };

  return h('div', { class: 'player-cmd-dm-wrap' },
    h('div', {
      class: 'player-cmd-dm-inside',
      style: { width: '100%', height: '100%' },
      ref: insideRef,
    })
  );
});
```

### T.3 插件侧 — 四子插件拆分

#### T.3.1 InteractionPlugin — 主插件 (管理子插件)

```typescript
/**
 * ============================================
 * InteractionPlugin — 互动主插件
 * ============================================
 *
 * 注册和管理四个子插件 (Guide/Link/Vote/Score)。
 * 提供编辑模式/展示模式切换、时间更新同步。
 *
 * 使用方式:
 * ```typescript
 * plugins: [
 *   InteractionPlugin({
 *     mode: 'display',  // 'edit' | 'display'
 *     debug: true,
 *     plugins: [
 *       InteractionPlugin.GuidePlugin({ position: { top: 10, left: 20 } }),
 *       InteractionPlugin.LinkPlugin({ linkContent: '...' }),
 *       InteractionPlugin.VotePlugin({ question: '...', options: [...] }),
 *       InteractionPlugin.ScorePlugin({ title: '...', scoreType: 1 }),
 *     ],
 *   }),
 * ]
 * ```
 */

export type InteractionMode = 'edit' | 'display';

export interface InteractionPluginConfig extends PluginOptions {
  /** 模式: edit=可拖动编辑, display=仅展示 */
  mode?: InteractionMode;
  /** 子插件列表 */
  plugins?: InteractionSubPlugin[];
  /** 是否显示编辑辅助线 */
  showLines?: boolean;
}

/** 子插件基接口 */
export interface InteractionSubPlugin {
  readonly name: string;
  readonly type: 'guide' | 'link' | 'vote' | 'score';
  /** 渲染到容器 */
  render(container: HTMLElement): void;
  /** 更新时间 */
  updateTime(currentTime: number): void;
  /** 销毁 */
  destroy(): void;
}

export class InteractionPluginClass implements Plugin {
  readonly name = 'interaction';
  private subPlugins: InteractionSubPlugin[] = [];
  private container: HTMLElement | null = null;
  private mode: InteractionMode;
  private currentTime = 0;

  constructor(config?: InteractionPluginConfig) {
    this.mode = config?.mode ?? 'display';
    if (config?.plugins) {
      this.subPlugins = config.plugins;
    }
  }

  install(player: VideoPlayer): void {
    const { events } = player;

    // 步骤1: 获取容器引用
    events.on('interactionLayerReady', (data: { container: HTMLElement }) => {
      this.container = data.container;
      // 所有子插件渲染到容器
      for (const sub of this.subPlugins) {
        sub.render(this.container);
      }
    });

    // 步骤2: 监听时间更新
    events.on(PlayerEventEnum.TIME_UPDATE, (data: { time: number }) => {
      this.currentTime = data.time;
      for (const sub of this.subPlugins) {
        sub.updateTime(data.time);
      }
    });
  }

  uninstall(): void {
    for (const sub of this.subPlugins) {
      sub.destroy();
    }
    this.subPlugins = [];
    this.container = null;
  }
}
```

### T.4 禁止 `any` / `unknown` — TypeScript 严格模式

#### T.4.1 ESLint 规则升级

当前 `.eslintrc.cjs` 中 `no-explicit-any` 为 `'warn'`，升级为 `'error'`:

```javascript
// .eslintrc.cjs 修改
rules: {
  // 从 'warn' 升级为 'error' — 禁止 any
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
}
```

#### T.4.2 tsconfig.json 规则

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false,
    "skipLibCheck": true
  }
}
```

#### T.4.3 `unknown` 使用约束

`unknown` 仅允许在以下场景:

| 允许场景 | 示例 | 说明 |
|---------|------|------|
| EventBus 事件载荷 | `on<T>(event: string, handler: (payload: T) => void)` | 泛型约束后类型安全 |
| 用户输入边界 | `parseUserInput(input: string): unknown` | 需要类型守卫后才能使用 |
| 类型守卫函数参数 | `isDanmakuItem(obj: unknown): obj is DanmakuItem` | 守卫函数的标准签名 |

**禁止**: 函数返回类型为 `unknown` (必须显式声明返回类型)，任何变量声明为 `unknown` 而不经过类型守卫。

### T.5 media-manifest 集成

#### T.5.1 复制策略

将 `media-manifest/` 下以下文件直接复制到项目中，**不修改**:

```
media-manifest/hls.js/          → hils.js/              (fork 版 hls.js，HLS 插件使用)
media-manifest/src/core/        → packages/player/src/media-core/  (流媒体核心逻辑参考)
media-manifest/src/types.ts     → (参考类型定义)
```

#### T.5.2 HLS 插件 — 强制使用 fork 版 hls.js

```typescript
// packages/plugins/src/hls/HlsPlugin.ts

/**
 * HLS 插件 — 强制使用 media-manifest 的 fork 版 hls.js
 *
 * fork 版支持直接传入对象 (类似 dash.js):
 *   new Hls({ media: videoElement, source: manifestObject })
 *
 * 同时也支持传统 URL 播放:
 *   new Hls({ media: videoElement, source: 'https://xxx/video.m3u8' })
 *
 * 禁止使用 npm hls.js — 必须从 hili-player/hls.js 导入
 */

/** 检查是否为 URL 字符串 */
function isUrlString(source: unknown): source is string {
  return typeof source === 'string' && /^https?:\/\//.test(source);
}

/** 检查是否为清单对象 */
function isManifestObject(source: unknown): source is Record<string, unknown> {
  return typeof source === 'object' && source !== null;
}

export class HlsPlugin implements StreamPlugin {
  load(config: StreamConfig): void {
    if (!this.videoElement) return;

    import('/hls.js').then((mod) => {
      const HlsClass = mod.default as HlsJsConstructor;

      // 统一处理: URL 和对象都传给 source
      const hlsConfig: Record<string, unknown> = {
        media: this.videoElement,
        autoStartLoad: true,
        ...this.pluginConfig.hlsConfig,
      };

      if (typeof config.url === 'string') {
        hlsConfig.source = config.url;          // URL 字符串 → 直接播放
      } else if (isManifestObject(config.url)) {
        hlsConfig.source = config.url;          // 清单对象 → 跳过网络请求
      }

      this.hlsPlayer = new HlsClass(hlsConfig);
      this.bindEvents();
    });
  }
}
```

#### T.5.3 DASH 插件 — npm dash.js + 对象注入

```typescript
// packages/plugins/src/dash/DashPlugin.ts

/**
 * DASH 插件 — 使用 npm dash.js
 *
 * npm 安装: pnpm add dashjs
 *
 * 支持两种播放方式:
 *   1. URL: dashPlayer.initialize(video, 'https://xxx/video.mpd', autoplay)
 *   2. 对象注入: 参考 media-manifest/src/core/manifest-to-dash.ts
 *      将清单对象转换为 dash.js 可识别的格式后直接注入
 */

export class DashPlugin implements StreamPlugin {
  load(config: StreamConfig): void {
    if (!this.videoElement) return;

    import('dashjs').then((dashjs) => {
      const player = dashjs.MediaPlayer().create();

      if (typeof config.url === 'string') {
        // URL 方式
        player.initialize(this.videoElement!, config.url, this.pluginConfig.autoplay ?? true);
      } else {
        // 对象注入方式 — 参考 media-manifest/src/core/manifest-to-dash.ts
        // 将 config.url (清单对象) 转换为 MPD manifest
        const manifest = convertToDashManifest(config.url);
        player.initialize(this.videoElement!, manifest, this.pluginConfig.autoplay ?? true);
      }

      this.bindEvents();
    });
  }
}
```

#### T.5.4 FLV 插件 — npm flv.js

```typescript
// pnpm add flv.js
import flvjs from 'flv.js';

// flv.js 只支持 URL 播放 (HTTP-FLV 协议):
// flvjs.createPlayer({ type: 'flv', url: 'https://xxx/video.flv' })
```

### T.6 互动 diff 算法重写

既有实现使用时间窗口 + 循环遍历方式更新卡片显示状态，时间复杂度 O(n) per timeUpdate。
新算法使用**时间排序 + 二分查找**:

```typescript
/**
 * ============================================
 * 互动卡片 diff 算法 — 基于时间排序
 * ============================================
 *
 * 替代既有实现的 O(n) 全量遍历，使用二分查找定位需要更新的卡片。
 * 所有 DOM 操作都是手动精准更新，不使用虚拟 DOM。
 *
 * 核心思路:
 *   1. 卡片按 timeStart 升序排列 (初始化时排序一次)
 *   2. timeUpdate 时用二分查找找到 currentTime 附近的卡片
 *   3. 只更新进入/离开时间窗口的卡片 (增量更新)
 *   4. 通过 classList 切换 hl-card-hide / hl-hide 控制显示
 */

interface TimedCard {
  /** 开始时间 (秒) */
  timeStart: number;
  /** 结束时间 (秒) */
  timeEnd: number;
  /** 关闭时间 (秒) — 0 表示未关闭 */
  closeTime: number;
  /** 是否已关闭 */
  isClose: boolean;
  /** DOM 元素引用 */
  element: HTMLDivElement;
}

/**
 * 二分查找 — 找到第一个 timeStart >= target 的索引
 *
 * @param cards - 按 timeStart 升序排列的卡片数组
 * @param target - 目标时间
 * @returns 插入位置索引
 */
function binarySearchByTime(cards: TimedCard[], target: number): number {
  let low = 0;
  let high = cards.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (cards[mid].timeStart < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/**
 * 增量更新卡片显示状态
 *
 * 只处理时间窗口变化边界的卡片，不在窗口内的卡片不操作。
 *
 * @param cards - 按 timeStart 升序排列的卡片数组
 * @param currentTime - 当前播放时间
 * @param prevTime - 上次更新时间 (用于检测窗口变化方向)
 */
function updateCardsDiff(
  cards: TimedCard[],
  currentTime: number,
  prevTime: number
): void {
  // 步骤1: 关闭时间重置 — closeTime > currentTime 的卡片重置 isClose
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i];
    if (card.closeTime > 0 && card.closeTime > currentTime) {
      card.isClose = false;
    }
    if (card.closeTime <= currentTime && card.isClose) continue;
  }

  // 步骤2: 二分查找 currentTime 附近的索引范围
  const startIdx = binarySearchByTime(cards, currentTime);
  // 查找窗口: [-2 个卡片, +所有即将开始的卡片]
  const checkStart = Math.max(0, startIdx - 2);
  const checkEnd = Math.min(cards.length, startIdx + 10);

  // 步骤3: 只更新窗口内的卡片
  for (let i = checkStart; i < checkEnd; i++) {
    const card = cards[i];
    if (card.isClose && card.closeTime <= currentTime) continue;

    if (currentTime < card.timeEnd && card.timeStart <= currentTime) {
      // 在显示时间内 → 完全显示
      card.element.classList.remove('hl-card-hide', 'hl-hide');
    } else if (
      card.timeEnd - 0.6 <= currentTime &&
      currentTime < card.timeEnd + 0.6
    ) {
      // 消失动画窗口 → 播放消失动画
      card.element.classList.remove('hl-card-hide');
      card.element.classList.add('hl-hide');
    } else if (
      currentTime < card.timeStart - 0.6 ||
      card.timeEnd + 0.6 < currentTime
    ) {
      // 在显示范围外 → 完全隐藏
      card.element.classList.remove('hl-hide');
      card.element.classList.add('hl-card-hide');
    }
  }
}
```

**新算法优势**:
- 时间复杂度: O(log n + k) — k 为时间窗口内的卡片数 (通常 ≤ 10)
- 只操作 DOM 变化的卡片，不碰不变化的卡片
- 排序只需一次 (初始化或卡片列表变更时)

### T.7 包管理器 — 强制 pnpm

```json
// package.json
{
  "packageManager": "pnpm@9.0.0"
}
```

```bash
# 安装依赖必须用 pnpm
pnpm install

# 禁止使用 npm / yarn
# 如果误用，preinstall 脚本会检测并报错
```

```json
// package.json scripts
{
  "scripts": {
    "preinstall": "npx only-allow pnpm"
  }
}
```

### T.8 依赖安装清单

```bash
# 流媒体插件 (npm 包)
pnpm add dashjs          # DASH 插件
pnpm add flv.js          # FLV 插件

# 动画图标
pnpm add lottie-web      # Lottie 图标

# 类型 (dev)
pnpm add -D @types/dashjs
```

HLS 不使用 npm 包 — 直接从 `hls.js/` 目录导入 fork 版本。

### T.9 TypeScript 类型安全约束 (强制)

| 约束 | 说明 |
|------|------|
| `no-explicit-any: error` | 禁止 `any` 类型 |
| `no-unsafe-*: error` | 禁止不安全的类型操作 |
| `explicit-function-return-type: error` | 所有函数必须显式声明返回类型 |
| `explicit-module-boundary-types: error` | 模块导出必须有显式类型 |
| `strict: true` | TypeScript 严格模式 |
| 类型守卫函数 | `isXxx(obj: unknown): obj is XxxType` 用于边界类型检查 |
| 泛型约束 | 需要 `unknown` 的场景用泛型 `<T>` 替代 |

### T.10 互动插件拖拽编辑

编辑模式下的拖拽实现:

```typescript
/**
 * ============================================
 * 卡片拖拽编辑器 — 仅在 edit 模式下激活
 * ============================================
 *
 * 编辑模式:
 *   - mousedown → 开始拖拽
 *   - mousemove → 实时更新卡片位置 (修改 CSS --top/--left)
 *   - mouseup   → 保存新位置 → emit positionChange
 *
 * 展示模式:
 *   - 不绑定拖拽事件，卡片不可交互 (除点击)
 */

interface DragState {
  /** 是否拖拽中 */
  isDragging: boolean;
  /** 拖拽起始 X */
  startX: number;
  /** 拖拽起始 Y */
  startY: number;
  /** 拖拽目标元素 */
  target: HTMLDivElement | null;
  /** 初始 --top 值 */
  initialTop: number;
  /** 初始 --left 值 */
  initialLeft: number;
}

/**
 * 绑定拖拽事件 — 仅在编辑模式下调用
 *
 * @param element - 可拖拽的卡片元素
 * @param onPositionChange - 位置变化回调 (百分比 0-100)
 */
function bindDragInEditMode(
  element: HTMLDivElement,
  onPositionChange: (top: number, left: number) => void
): () => void {
  const state: DragState = {
    isDragging: false, startX: 0, startY: 0, target: null,
    initialTop: 0, initialLeft: 0,
  };

  /**
   * 从 CSS 变量读取当前位置百分比
   */
  const getPosition = (el: HTMLDivElement): { top: number; left: number } => {
    const style = el.style;
    const topStr = style.getPropertyValue('--top');
    const leftStr = style.getPropertyValue('--left');
    return {
      top: topStr ? parseFloat(topStr) : 0,
      left: leftStr ? parseFloat(leftStr) : 0,
    };
  };

  const onMouseDown = (e: MouseEvent): void => {
    state.isDragging = true;
    state.target = element;
    state.startX = e.clientX;
    state.startY = e.clientY;
    const pos = getPosition(element);
    state.initialTop = pos.top;
    state.initialLeft = pos.left;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent): void => {
    if (!state.isDragging || !state.target) return;
    const parent = state.target.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    // 计算移动百分比
    const deltaX = ((e.clientX - state.startX) / rect.width) * 100;
    const deltaY = ((e.clientY - state.startY) / rect.height) * 100;
    const newTop = Math.max(0, Math.min(100, state.initialTop + deltaY));
    const newLeft = Math.max(0, Math.min(100, state.initialLeft + deltaX));
    // 手动更新 DOM
    state.target.style.setProperty('--top', `${newTop}%`);
    state.target.style.setProperty('--left', `${newLeft}%`);
  };

  const onMouseUp = (): void => {
    if (state.isDragging && state.target) {
      const pos = getPosition(state.target);
      onPositionChange(pos.top, pos.left);
    }
    state.isDragging = false;
    state.target = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  element.addEventListener('mousedown', onMouseDown);

  // 返回取消绑定的函数
  return () => {
    element.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}
```
