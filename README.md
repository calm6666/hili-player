# hili-player

> 极简 TypeScript 视频播放器 —— 基于自研「零 diff」框架构建，视觉与交互对齐哔哩哔哩播放器。

`hili-player` 是一个从零实现的 Web 视频播放器。它不依赖任何 UI 框架，运行时**不做虚拟 DOM diff**：
挂载完成后由业务代码直接操作真实 DOM。播放器本体、弹幕、字幕、HLS / DASH / FLV 流媒体与互动插件
拆分在两个包中，可以整体引入，也可以按需使用。

- 纯 TypeScript，`strict` 全开，零 `any` 债
- 核心与包代码约 **4.9 万行 TypeScript** + 约 **0.9 万行 SCSS**
- `packages/player` 导出 ESM + UMD 双格式，附带完整 `.d.ts`

---

## 特性

| 能力 | 说明 |
| --- | --- |
| **零 diff 运行时** | 挂载期由 `h()` 生成 VNode，一次性 `materialize` 成真实 DOM；运行期不 diff、不重渲染、不做响应式依赖收集，性能与手写原生 JS 等价 |
| **编译期优化** | `vite-plugin-lumina-compile` 用 babel + MagicString 把 `h()` 改写为 `_createEl` / `_createStaticEl` / `_createSvgEl` / `_createFragment` / `_createComp`，生产构建额外做静态提升（`_cloneHoisted`）；dev 模式零开销 |
| **三套流媒体** | HLS（内置 fork 版 hls.js，支持 URL 与清单对象注入）、DASH（dashjs）、FLV（flv.js） |
| **完整画质链路** | 原生多文件 / HLS / DASH 三源统一档位模型；`auto` / `manual` 双模式、ABR、切换生命周期（requested → rendered / failed，10s 超时兜底） |
| **弹幕双引擎** | DOM 与 Canvas 可切换，含轨道管理、对象池、增量调度与预取 |
| **字幕** | SRT / ASS / WebVTT 解析与渲染 |
| **互动插件** | 引导 / 投票 / 评分 / 外链四个子插件，二分查找 + 增量 diff，编辑态拖拽 |
| **SSR + Hydration** | 服务端可输出占位符或完整结构，客户端可激活 |
| **播放列表** | 换源复用同一个 `video` 元素与整棵 DOM |
| **37 个 UI 组件** | 控制栏、进度条、音量、画质菜单、弹幕设置、快捷键面板、迷你播放器等，图标走 Lottie 动画系统 |
| **持久化** | 音量 / 静音 / 倍速 / 画质偏好 / 进度条偏好（localStorage） |

---

## 环境要求

| 依赖 | 版本 |
| --- | --- |
| Node.js | 20+（开发环境实测 22.20） |
| pnpm | 9（`packageManager: pnpm@9.0.0`） |
| TypeScript | 6 |

仓库使用 pnpm workspace，请勿用 npm / yarn 安装。

---

## 目录结构

```
hili-player/
├── core/                       # 自研「零 diff」框架
│   ├── h.ts                    #   h() / defineComponent / Fragment / when / each
│   ├── mount.ts                #   mount / materialize / applyAttrs / destroy / hydrate
│   ├── internal.ts             #   编译期改写目标（_createEl 等）
│   ├── ssr.ts                  #   renderToString
│   ├── state.ts  eventBus.ts  signals.ts  hooks.ts  context.ts  ref.ts
│   └── warning.ts  normalize.ts
├── types/                      # 全局类型契约
│   ├── index.ts                #   PlayerConfig / PlayerEvents / PlayMode / MediaItem …
│   ├── streamPlugin.ts         #   流媒体插件契约（QualityLevel / MediaManifestSource）
│   └── plugin.ts  danmaku.ts  subtitle.ts  callbacks.ts
├── utils/  directives/  events/  error/     # 工具、指令、事件、错误处理
├── packages/
│   ├── player/                 # @lumina/nova —— 播放器本体
│   │   └── src/
│   │       ├── player/VideoPlayer.ts   # 核心类
│   │       ├── components/             # 37 个 UI 组件
│   │       ├── store/                  # PlayerStore / runtimeState / ConfigStore
│   │       ├── config/                 # defaultConfig / mergeConfig / normalizeConfig
│   │       ├── core/                   # plugin / pluginManager / hotkeys
│   │       ├── utils/                  # media 监控、浏览器能力检测、tooltip
│   │       ├── types/                  # 播放器侧类型
│   │       └── styles/                 # 25 个 SCSS
│   └── plugins/                # @lumina/plugins —— 官方插件集合
│       └── src/
│           ├── danmaku/        #   DanmakuPlugin + DOM / Canvas 引擎
│           ├── subtitle/       #   SubtitlePlugin + SRT / ASS / VTT 解析
│           ├── hls/  dash/  flv/       # 三个流媒体插件（含 vendor 适配层）
│           ├── interaction/    #   Guide / Vote / Score / Link 子插件
│           ├── vendor/         #   清单解析（HLS / DASH）
│           └── stream/         #   流媒体插件共享类型与枚举
├── plugins/vite-plugin-lumina-compile/   # 编译期 h() 改写插件
├── demo/  demo-prod/           # SSR + Hydration 演示（含 Express 服务端）
└── docs/                       # 设计与分析文档
```

### 代码规模

| 模块 | 文件 | 行数 |
| --- | --- | --- |
| `core/`（框架） | 15 | 4,152 |
| `packages/player/src` | 70 | 20,520 |
| `packages/plugins/src` | 54 | 17,467 |
| `plugins/vite-plugin-lumina-compile` | 4 | 939 |
| `types` / `utils` / `media` / `error` / `events` / `directives` | 26 | 5,949 |
| `packages/player/src/styles`（SCSS） | 25 | 9,113 |

---

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器（Vite，默认 http://localhost:5173）
pnpm dev

# 类型检查 / 代码检查 / 测试
pnpm typecheck
pnpm lint
pnpm test

# 构建两个包（player → plugins）
pnpm build
pnpm build:player
pnpm build:plugins
```

`demo/` 是 SSR + 水合的完整演示，含独立 Vite 配置与 Express 服务端（`demo/server.mjs`）。

---

## 使用

### 基础用法

```ts
import { VideoPlayer } from '@lumina/nova';
import '@lumina/nova/style.css';

const player = new VideoPlayer({
  src: 'https://example.com/video.mp4',
  poster: 'https://example.com/poster.jpg',
  playback: {
    autoplay: false,
    muted: false,
    volume: 0.8,
    loop: false,
    playMode: PlayMode.ORDER,
  },
});

// 挂载到容器（注意：mount 接收 HTMLElement，不是选择器字符串）
player.mount(document.getElementById('player-container')!);
```

### 配置（命名空间形态）

顶层只保留**资源类三项**（`container` / `src` / `poster`），其余按功能分组，便于深度合并与运行时动态更新：

```ts
const player = new VideoPlayer({
  src, poster,

  playback:    { autoplay: true, muted: true, volume: 0.8, playbackRate: 1, loop: false, playMode: PlayMode.REPEAT_ALL },
  playlist:    [{ src: 'a.mp4', title: '第一话' }, { src: 'b.mp4', title: '第二话' }],
  playlistIndex: 0,

  ui:          { controls: { quality: true, episodes: true, pip: true, wideScreen: true } },
  interaction: { keyboard: true },
  quality:     { mode: 'auto' },
  progress:    { segments: [{ startTime: 0, endTime: 90, label: 'OP' }] },
  danmaku:     { enabled: true, url: '/danmaku/1.xml', opacity: 0.8, fontSize: 24, area: 0.75 },
  subtitle:    { enabled: true, list: [{ lang: 'zh-CN', label: '中文', url: '/sub/1.vtt', isDefault: true }] },
  plugins:     { /* ... */ },
  storage:     { /* ... */ },
  ssr:         { enabled: false },
  advanced:    { debug: false },
  callbacks:   { ready: () => console.log('ready') },
});
```

> 历史版本的扁平配置（`autoplay` / `volume` / `controls` / `controlBtns` …写在顶层）仍可通过内置兼容层
> `normalizeConfig()` 使用，开发环境会打印一次性迁移提示。新代码请一律使用命名空间形态。

### 多清晰度（仅原生 MP4 需要手填）

```ts
const player = new VideoPlayer({
  src: [
    { url: 'video-1080p.mp4', height: 1080, label: '1080P' },
    { url: 'video-720p.mp4',  height: 720,  label: '720P'  },
    { url: 'video-480p.mp4',  height: 480,  label: '480P'  },
  ],
});
```

> HLS / DASH 的档位由清单在运行时发现，**不要手填**，改用下面的插件传清单对象。

### 插件

```ts
import { VideoPlayer } from '@lumina/nova';
import {
  DanmakuPlugin, SubtitlePlugin, HlsPlugin, DashPlugin, FlvPlugin, InteractionPlugin,
} from '@lumina/plugins';

const player = new VideoPlayer({ src: 'video.m3u8' });

player.use(DanmakuPlugin({ options: { debug: false } }));
player.use(SubtitlePlugin({
  sources: [{ src: '/sub/1.vtt', lang: 'zh-CN', label: '中文', default: true }],
  defaultLang: 'zh-CN',
  position: 'bottom',
}));
player.use(HlsPlugin({ autoplay: true, startLevel: -1 }));
player.use(InteractionPlugin({ isEdit: false }));

player.mount(el);
```

弹幕的字号 / 透明度 / 速度 / 区域 / 渲染模式有两种调整途径：构造时走播放器配置的 `danmaku`
命名空间，或运行时调用播放器与插件的 API（`player.setDanmakuOpacity()`、`DanmakuPluginAPI.setRenderMode()` 等）。
`DanmakuPlugin()` 自身的配置只有 `{ options, callbacks }`。

清单对象注入（跳过 URL 探测，直接把解析好的清单喂给播放器）：

```ts
import { HlsPlugin, DashPlugin } from '@lumina/plugins';

// 清单对象作为 src 传入（MediaManifestSource），插件按类型谓词自动识别
const player = new VideoPlayer({ src: parsedManifest });

player.use(HlsPlugin());   // 或 DashPlugin()
player.mount(el);
```

### 事件

`on()` / `once()` 返回**取消订阅函数**：

```ts
const off = player.on('timeupdate', (currentTime, duration) => {
  console.log(`${currentTime} / ${duration}`);
});

player.once('ready', () => console.log('ready'));

off();                          // 取消订阅
player.off('timeupdate', handler); // 或按引用取消
```

`PlayerEvents` 覆盖：`ready` `play` `pause` `ended` `timeupdate` `volumechange` `ratechange`
`qualitychange` `fullscreenchange` `pipchange` `waiting` `canplay` `progress` `error` `statechange`
`click` `dblclick`，以及 `abort` `durationchange` `emptied` `loadeddata` `loadedmetadata` `loadstart`
`playing` `seeked` `seeking` `stalled` `suspend` 等 HTML5 媒体元素标准事件。

### 动态 API

```ts
// 播放控制
await player.play();
player.pause();
player.toggle();
player.seek(120);
player.seekBy(-5);
player.reload();

// 音量 / 倍速 / 播放模式
player.setVolume(0.5);   player.getVolume();
player.toggleMute();     player.setMuted(true);   player.isMuted();
player.setPlaybackRate(1.5);  player.getPlaybackRate();
player.setLoop(true);
player.setPlayMode(PlayMode.REPEAT_ALL);   // ORDER | REPEAT_ALL | SHUFFLE

// 显示模式
await player.toggleFullscreen();   player.isFullscreen();
await player.enterFullscreen();
await player.exitFullscreen();
await player.togglePip();          player.enterPip();   player.exitPip();
player.toggleWebFullscreen();      player.isWebFullscreen();
player.toggleWideScreen();
player.setDisplayMode('wide');     // 'normal' | 'web' | 'wide' | 'mini'
player.resize();

// 画质
player.setQuality('1080P');      player.getCurrentQuality();
player.getQualities();           player.setQualityMode('auto' | 'manual');
player.getQualityMode();
player.applyQualityLimits({ max: 1080, min: 360 });

// 播放列表（构造时传入 playlist，运行时复用同一 video 元素与整棵 DOM 导航）
await player.switchTo(1);
await player.next();
await player.prev();
player.getPlaylist();   player.getCurrentIndex();

// 换源
await player.load('another.mp4', { startTime: 30, autoplay: true });

// 弹幕
player.setDanmakuVisible(false);   player.toggleDanmaku();   player.isDanmakuVisible();
player.setDanmakuOpacity(0.5);     player.setDanmakuSpeed(1.5);
player.setDanmakuSource('/dm/1.xml');   player.clearDanmaku();
player.sendDanmaku('前方高能');

// 字幕
player.setSubtitleVisible(true);   player.toggleSubtitle();
player.setSubtitleLang('zh-CN');   player.setSubtitleList(tracks);

// 配置
player.getConfig();                       // Readonly<PlayerConfig>
player.setConfig({ playback: { volume: 0.3 } });   // 深层局部更新
player.setPoster('/new.jpg');

// 状态查询
const s = player.getState();   // PlayerStateData 快照
player.getCurrentTime();  player.getDuration();  player.getBuffered();
player.isPaused();        player.isPlaying();    player.isFullscreen();   player.isMuted();

// 生命周期
player.mount(el);         // 挂载
player.render();          // 取 VNode（SSR / 内嵌到自己的 VNode 树）
player.hydrate(el);       // 客户端激活
player.use(plugin);       // 安装插件（可链式）
player.uninstallPlugin('danmaku');
player.destroy();         // 卸载并清理全部监听、插件与订阅
```

### 服务端渲染

服务端 `new VideoPlayer(config)` 是安全的：构造函数内部对 `window` / `localStorage` 都有守卫，
不会触碰 DOM。渲染时取其 VNode，或使用 `isServer()` / `createSSRConfig()`：

```ts
import { isServer, createSSRConfig, VideoPlayer } from '@lumina/nova';

const config = {
  src: videoUrl,
  poster: posterUrl,
  ssr: createSSRConfig({ enabled: isServer(), placeholder: '<div class="nova-player-placeholder">视频加载中…</div>' }),
};

const player = new VideoPlayer(config);
const vnode = player.render();     // 交给你的 SSR 框架输出 HTML

// 客户端
player.mount(document.getElementById('player')!);   // 或 player.hydrate(el) 复用服务端结构
```

### 自己写组件（框架用法）

组件是返回 VNode 的普通函数，用 `defineComponent` 包装以获得类型推导与生命周期：

```ts
import { h, defineComponent, when, each, useTemplateRef } from '@/core';
import type { ComponentLifecycle } from '@/types';

export const MyPanel = defineComponent<{ title: string; items: string[] }>(
  (props, lifecycle: ComponentLifecycle) => {
    // useTemplateRef(lifecycle, key) 返回 Signal，模板里用字符串 ref 绑定
    const box = useTemplateRef<HTMLDivElement>(lifecycle, 'box');

    lifecycle.onMounted = () => {
      // 挂载后直接操作真实 DOM —— 框架此后不再介入
      box.value?.classList.add('ready');
    };
    lifecycle.onBeforeDestroy = () => {
      // 清理定时器 / 监听器
    };

    return h('div', { class: 'my-panel', ref: 'box' },
      h('h3', {}, props.title),
      when(props.items.length > 0,
        h('ul', {}, each(props.items, (item) => h('li', {}, item)))
      )
    );
  }
);
```

**运行时更新的正确姿势**：框架没有响应式，组件 `props` 是挂载时的快照，**不会**随父组件变化而更新。
需要变化的量必须走状态订阅 + 命令式改 DOM：

```ts
import { createTypedStateManager } from '@/core';

const state = createTypedStateManager();
const off = state.subscribe('player.volume', (next) => {
  slider.style.setProperty('--vol', String(next));   // 手动改原生 DOM
});
```

---

## 架构说明

### 1. 零 diff

```
挂载期：h() → VNode（普通对象） → materialize() 递归 createElement → 真实 DOM
                            ↑
                 编译期 luminaCompile 把 h() 改写为 _createEl / _createStaticEl / …

运行期：state.set() → effect / 订阅回调 → 业务代码直接改真实 DOM
        （框架不重渲染、不做 key diff、不做依赖收集）
```

### 2. 三层协作

| 层 | 职责 |
| --- | --- |
| `core/` | 框架：VNode、挂载、SSR、状态、事件总线、信号、Context、生命周期 |
| `packages/player` | 播放器：`VideoPlayer` 核心类 + 37 个组件 + store / config |
| `packages/plugins` | 插件：弹幕、字幕、三种流媒体、互动 |

### 3. 状态与事件（改动前请先读）

- **三套状态并存**：`TypedStateManager`（内存路径式）、`PlayerStore`（localStorage 持久化）、
  `ConfigStore`（可订阅配置中心，支持 `getPath` / `subscribePath`）。另有 `PluginManager` 私有的
  `state` / `events` / `hooks`。
- **两条事件通道**：内部 `events`（TypedEventBus，camelCase 键）与对外 `emitter`（EventEmitter，全小写键）。
  两者由 `VideoPlayer.bridgeEvents()` 的 24 条映射桥接，`player.on()` 监听的是 emitter 侧。
- 因此：**新增一个事件或配置项时，必须同步检查桥接表、mock 与订阅点**，否则会出现"事件收不到"这类静默故障。

### 4. 构建产物

| 包 | 产物 |
| --- | --- |
| `@lumina/nova` | `dist/index.es.js`（约 1.3 MB）、`dist/index.umd.js`（约 675 KB）、`dist/style.css`（约 393 KB）、`dist/index.d.ts`、lottie 独立 chunk（动态 import 自动分包） |
| `@lumina/plugins` | `dist/{index,danmaku,subtitle,dash,hls,flv}.js` + `interaction/`，`preserveModules` 保留模块结构，`dashjs` / `flv.js` / `@lumina/nova` 为 external |

---

## 许可证

MIT
