# PlayerConfig 重设计 · 详细设计文档

> 目标：把当前的扁平 `PlayerConfig` 重构为一套**分组命名空间 + 深度合并 + 输入/解析类型分离**的配置系统。
> 状态：**仅设计，未改动代码**。
> 前置：本文所有"现状问题"均有代码位置佐证，可逐条核对。

---

## 目录

1. [主流播放器配置设计调研](#一主流播放器配置设计调研)
2. [设计模式提炼](#二设计模式提炼)
3. [现状问题分析（逐条带证据）](#三现状问题分析逐条带证据)
4. [新设计总览](#四新设计总览)
5. [完整类型定义](#五完整类型定义)
6. [默认值设计](#六默认值设计)
7. [合并与校验语义](#七合并与校验语义)
8. [三种配置形态（输入 / 解析后 / 运行时状态）](#八三种配置形态输入--解析后--运行时状态)
9. [向后兼容迁移表](#九向后兼容迁移表)
10. [校验与错误提示](#十校验与错误提示)
11. [实现清单（待执行）](#十一实现清单待执行)
12. [设计决策记录（ADR）](#十二设计决策记录adr)

---

## 一、主流播放器配置设计调研

### 1.1 两类流派

| 流派 | 代表 | 特征 | 适合场景 |
|---|---|---|---|
| **A. 嵌套命名空间** | Shaka Player、hls.js、dash.js、video.js | 按**引擎子系统**分组，深层嵌套，必须递归合并 | 底层引擎选项多、需要精细控制 |
| **B. 扁平 + 少量分组** | Plyr、ArtPlayer、xgplayer、DPlayer、JW Player | 顶层直接是功能开关，少数功能（弹幕/字幕/预览）自成命名空间 | 面向业务方的 UI 播放器 |

### 1.2 各播放器配置形态对比

#### Shaka Player（流派 A 的极致）

```js
player.configure({
  manifest: { retryParameters: { maxAttempts: 2 } },
  streaming: { bufferingGoal: 30, rebufferingGoal: 2, lowLatencyMode: false },
  drm: { servers: { 'com.widevine.alpha': '...' }, advanced: { ... } },
  abr: { enabled: true, defaultBandwidthEstimate: 1e6 },
  mediaSource: { codecSwitchingStrategy: 'smooth' },
  restrictions: { maxHeight: 1080 },
});
player.configure({}, true);   // 第二参数 true = 重置为默认
```

- **关键设计**：`configure()` 做**递归合并**（不是整体替换）；单独提供 `reset` 语义
- 配置类型独立于运行实例（`shaka.extern.PlayerConfiguration`）
- 有 `getConfiguration()` 拿到**解析后**的完整配置
- 参考：[Shaka Configuration Tutorial](https://shaka-project.github.io/shaka-player/docs/api/tutorial-config.html)

#### hls.js

```js
const hls = new Hls({
  abr: { maxAutoLevel: 2 },
  loader: CustomLoader,
  xhrSetup: (xhr) => { xhr.withCredentials = true; },
  maxBufferLength: 30,
  enableWorker: true,
});
hls.config.maxBufferLength = 10;      // 实例上可改
```

- 静态 `Hls.DefaultConfig` 暴露全部默认值
- **扁平键 + 少量嵌套组**（`abr`、`timelineConfig`、`fLoader`）
- 构造时做**默认值合并**（`mergeConfig` 工具）
- 参考：[hls.js API.md](https://github.com/video-dev/hls.js/blob/8d75e45992a7139e7cf9b11a056c8474e9ef4546/docs/API.md)

#### dash.js

```js
player.updateSettings({
  streaming: { abr: { ... }, buffer: { ... } },
  debug: { logLevel: 3 },
});
player.getSettings();
```

- 与 Shaka 类似：`updateSettings` 局部覆盖 + `getSettings` 取全量

#### video.js（组件树式嵌套）

```js
videojs('el', {
  html5: { nativeTextTracks: false, vhs: { overrideNative: true } },
  controlBar: { volumePanel: { inline: false }, pictureInPictureToggle: false },
  playbackRates: [0.5, 1, 1.5, 2],
  techOrder: ['html5'],
  tracks: [...],
});
```

- **嵌套键 = 组件名**，每个子组件一套 options（`controlBar.volumePanel.x`）
- `html5.vhs` 用于透传底层引擎配置
- 参考：[Video.js Options Reference](https://legacy.videojs.org/guides/options/)

#### Plyr（流派 B 的典型）

```js
new Plyr(el, {
  controls: ['play', 'progress', 'volume', 'settings', 'fullscreen'],
  settings: ['captions', 'quality', 'speed'],
  speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
  quality: { default: 576, options: [4320, 1440, 1080, 720, 576, 480, 360, 240] },
  i18n: { speed: 'Speed', quality: 'Quality' },
  storage: { enabled: true, key: 'plyr' },
  keyboard: { focused: true, global: false },
  tooltips: { controls: true, seek: true },
  previewThumbnails: { enabled: false, src: '' },
  ratio: '16:9',
  clickToPlay: true,
  hideControls: true,
  resetOnEnd: false,
  listeners: { ... },
});
```

- **扁平功能键 + 少量命名空间**（`speed`/`quality`/`i18n`/`storage`/`keyboard`/`tooltips`/`previewThumbnails`）
- `controls` / `settings` 用**数组声明顺序与内容**（而非一堆布尔）
- 参考：[Plyr Configuration System](https://deepwiki.com/sampotts/plyr/2.3-events-and-listeners)

#### ArtPlayer

```js
new Artplayer({
  container, url, poster,
  volume: 0.8, autoplay: false, theme: '#23ade5',
  lang: 'zh-cn', hotkey: true, pip: true, fullscreen: true,
  controls: [{ name, position, html, index, tooltip, click }],
  settings: [...],
  quality: [{ html, url, default }],
  subtitle: { url, type, style, encoding },
  danmaku: { id, api, speed, opacity, fontSize, ... },
  moreVideoAttr: { crossOrigin: 'anonymous', playsInline: true },  // ★ 透传 <video> 属性
  type: 'm3u8',
  customType: { m3u8: (video, url, art) => { ... } },
  layers: [...], whitelist: ['*'],
});
```

- **最值得借鉴的一点**：`moreVideoAttr` 透传到 `<video>` 原生属性
- `customType` 把「格式 → 加载器」的映射交给用户
- `controls` / `settings` / `quality` 都是**数组描述**，不是布尔开关

#### xgplayer（西瓜播放器）

```js
new Player({
  id, url, width, height, volume: 0.6, autoplay: true, loop: false, poster,
  controls: true, ignores: ['replay'],          // ★ 反向开关（黑名单）
  closeVideoClick: false, closeVideoDblclick: false,
  keyboard: { seekStep: 5, volumeStep: 0.1 },   // ★ 对象化快捷键配置
  lang: 'zh', danmaku: true, progressPreview: { ... },
  playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2],
  preload: 'auto', playsinline: true, whitelist: ['*'],
});
```

- `ignores` 黑名单（与 `controls` 白名单互补）
- `keyboard` 从布尔升级为对象（可配步长）
- 插件配置走独立的插件构造参数，不塞进主配置

#### DPlayer

```js
new DPlayer({
  container, video: { url, pic, thumbnails, quality, defaultQuality, type, customType },
  danmaku: { id, api, token, maximum, user, bottom, unlimited, speedRate, opacity, fontSize },
  subtitle: { url, type, fontSize, bottom, color },
  theme: '#b7daff', hotkey: true, screenshot: false, preload: 'auto',
  volume: 0.7, playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 2],
  loop: false, airplay: true, lang: 'zh-cn', contextmenu: [], mutex: true,
  pluginOptions: { hls: {...}, flv: {...} },   // ★ 插件选项独立命名空间
});
```

- **`video` 子对象**把「源 + 封面 + 缩略图 + 清晰度」聚合在一起
- `pluginOptions.hls` 承载引擎覆盖

#### JW Player / 云厂商（阿里云 Aliplayer、腾讯云 TCPlayer）

```js
// TCPlayer
new TCPlayer(id, {
  fileID, appID, autoplay, mute, volume, poster, controls, preload,
  width, height, x5_player, x5_type,
  plugins: { hls: { ... }, flv: { ... } },     // ★ 插件配置
  listener: (event) => {},                      // ★ 单回调分发
});
```

- `listener` 单回调 + `event.type` 分发（vs 多个具名回调）
- `plugins: { hls, flv }` 承载引擎配置

### 1.3 对比总表

| 维度 | Shaka | hls.js | video.js | Plyr | ArtPlayer | xgplayer | DPlayer |
|---|---|---|---|---|---|---|---|
| 顶级分组 | 强 | 中 | 强（按组件） | 弱 | 弱 | 弱 | 弱 |
| 递归合并 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 默认值可导出 | `getConfiguration` | `Hls.DefaultConfig` | `videojs.options` | `plyr.defaults` | `artplayer.defaults` | `Player.defaultConfig` | `DPlayer.defaults` |
| 数组语义 | 替换 | 替换 | 替换 | 替换 | 替换 | 替换 | 替换 |
| 未知键校验 | 强（类型 + 运行时） | 弱 | 中 | 中 | 弱 | 弱 | 弱 |
| `<video>` 透传 | — | — | `html5` | — | `moreVideoAttr` | 原生属性直写 | — |
| 引擎选项位置 | `manifest/streaming/...` | 平铺 | `html5.vhs` | — | `customType` | 独立插件 | `pluginOptions.hls` |
| 持久化配置 | — | — | — | `storage` | — | — | — |
| 快捷键配置 | — | — | — | `keyboard: {}` | `hotkey` | `keyboard: {seekStep}` | `hotkey` |
| 控件声明 | — | — | `controlBar` 树 | `controls: []` | `controls: []` | `controls` + `ignores` | `contextmenu` |

---

## 二、设计模式提炼

从上面 9 个播放器可提炼出 **8 条共识**：

1. **递归合并是硬要求**：嵌套配置必须逐层与默认值合并。`{...defaults, ...user}` 的浅合并是**反模式**（Shaka 专门提供 `configure()` 而非直接赋值就是这个原因）。
2. **数组整体替换**：所有播放器都选择「数组不合并、整体替换」，避免"用户给了 3 项，默认 10 项里剩下 7 项混进来"的困惑。
3. **默认值必须可导出**：让用户能读、能扩展、能调试（`Hls.DefaultConfig` / `plyr.defaults` / `artplayer.defaults`）。
4. **顶层保持精简**：最常用的 3~5 个键（`container`/`src`/`poster`）放顶层，其余分组。
5. **`<video>` 原生属性要有透传通道**：`moreVideoAttr`（ArtPlayer）/ `html5`（video.js）。否则每加一个原生属性都要改框架。
6. **引擎/插件选项独立命名空间**：`pluginOptions.hls`（DPlayer）/ `plugins.hls`（TCPlayer）/ `html5.vhs`（video.js）。主配置不应混入 hls.js 的 200 个选项。
7. **能力开关优于布尔堆砌**：`controls: ['play','progress',...]`（Plyr/ArtPlayer）比 `controlBar: {play: true, progress: true, ...}` 更可读、更易排序、天然支持自定义控件。
8. **持久化必须显式配置**：Plyr 的 `storage: { enabled, key }`。**隐式读写 localStorage 是重大设计缺陷**。

---

## 三、现状问题分析（逐条带证据）

### P0：功能性缺陷

#### 问题 1｜浅合并导致嵌套默认值丢失 🔴

**位置**：`packages/player/src/player/VideoPlayer.ts:234`

```ts
this.props = { ...defaultConfig, ...config };
```

**后果**：用户写

```ts
new VideoPlayer({ src, danmaku: { enabled: true } });
```

`danmaku` 被**整体替换**，`source` / `opacity` / `speed` / `visible` **全部变成 `undefined`**。之后 `DanmakuPlugin` 读到 `undefined` → 弹幕透明度/速度异常。

同样影响：`controlBtns`、`ssr`、`subtitles`（数组，行为另见问题 6）。

**这是当前配置设计最严重的问题**，也是本次重设计的第一动因。

#### 问题 2｜控件配置存在两套互不兼容的类型 🔴

| 类型 | 定义位置 | 键 |
|---|---|---|
| `ControlBtnConfig` | `types/index.ts:437` | `prev, next, setting, pip, wide, web`（6） |
| `ControlConfig` | 运行时实际使用 | `prev, next, viewpoint, quality, eplist, setting, pip, wide, web`（9） |

**证据**：`VideoPlayer.ts:472-474`

```ts
typeof this.props.controlBtns === "object"
  ? this.props.controlBtns          // ← 静态类型是 ControlBtnConfig（6 键）
  : defaultControlConfig,           // ← 实际期望 ControlConfig（9 键）
```

用户传 `controlBtns: { prev: false }` → 类型通过 → 运行时 `viewpoint/quality/eplist` 为 `undefined` → 控件渲染异常。

#### 问题 3｜代码使用了类型中不存在的键（当前 tsc 报错）🔴

**位置**：`VideoPlayer.ts:472-473`

```
packages/player/src/player/VideoPlayer.ts(472,31): error TS2339:
  Property 'controls' does not exist on type 'PlayerConfig'.
```

`controls` 与 `controlBtns` **两个名字指同一件事**，类型里只有后者。这是"配置键命名不统一"的直接后果。

#### 问题 4｜`PlayerDockerProps` 与组件实现严重不符（当前 5 个 tsc 报错）🔴

**类型**：`PlayerDocker.ts:135`

```ts
export interface PlayerDockerProps {
  events?: PlayerEventBus;      // ← 只有这一个
}
```

**实现实际读取**（类型里都不存在）：

```
PlayerDocker.ts(198,19): Property 'volume' does not exist on type 'PlayerDockerProps'
PlayerDocker.ts(200,20): Property 'muted' does not exist on type 'PlayerDockerProps'
PlayerDocker.ts(254,15): Property 'src' does not exist on type 'PlayerDockerProps'
PlayerDocker.ts(261,15): Property 'autoplay' does not exist on type 'PlayerDockerProps'
PlayerDocker.ts(868,29): Property 'playerName' does not exist on type 'PlayerDockerProps'
```

**根因**：`PlayerConfig`（扁平大对象）被当作 props 直接转发给 `PlayerDocker`，但没有一个"播放器传给 Docker 的 props 子集"类型。配置与组件 props 的边界没有定义。

### P1：设计缺陷

#### 问题 5｜运行时 DOM 句柄泄漏进输入配置类型 🟠

**位置**：`types/index.ts:449-470` `ProgressSegment`

```ts
export interface ProgressSegment {
  startTime: number;
  endTime: number;
  element?: HTMLDivElement;            // ← 运行时产物
  bufferElement?: HTMLDivElement;      // ← 运行时产物
  currentElement?: HTMLDivElement;     // ← 运行时产物
  shadowElement?: HTMLDivElement;      // ← 运行时产物
  shadowBufferElement?: HTMLDivElement;// ← 运行时产物
  shadowCurrentElement?: HTMLDivElement;// ← 运行时产物
  shadowTextElement?: HTMLDivElement;  // ← 运行时产物
  pointText: string;
}
```

用户为了传 3 个分段数据，被迫面对 **7 个 DOM 字段**。这些字段是组件渲染时写入的，属于**运行时状态**，不该出现在配置类型里。

**正确做法**：配置只留 `{ startTime, endTime, pointText }`；DOM 句柄由组件内部维护（或用 `WeakMap` / 内部类型 `ProgressSegmentRuntime`）。

#### 问题 6｜`subtitles` 语义在类型与默认值之间矛盾 🟠

- 类型：`subtitles?: SubtitleConfig[]`（轨道**列表**）
- 默认值：`subtitles: []`
- 但用户可能想配「默认语言 / 字号 / 位置」——这些**没有地方放**

`SubtitleConfig` 一个类型同时承担"单条轨道"和"整体配置"两个角色，职责不清。

#### 问题 7｜`src` 三态联合难以扩展 🟠

```ts
src: string | string[] | QualitySource[];
```

- `string[]`（备用源） vs `QualitySource[]`（多清晰度）**语义完全不同但都是数组** → 运行时靠 `typeof item === "object"` 猜（`VideoPlayer.ts:438-442`）
- 想加 `{ url, type: 'hls', drm: {...} }` 就很难

**（补充）第四个问题：`QualitySource[]` 让人以为 HLS/DASH 也该传清晰度列表** 🔴

这是**语义误导**，比上面三条更严重：

```ts
// ❌ 用户很自然会这么写（因为类型允许）
new VideoPlayer({
  src: [
    { quality: '1080p', url: 'https://cdn/1080.m3u8' },
    { quality: '720p',  url: 'https://cdn/720.m3u8' },
  ],
});
```

但 `1080.m3u8` 本身就是**另一个 master playlist**（内含全部档位），
多写几个只会产生**多份 manifest、多套 ABR 状态、多次网络请求** —— 完全是错的用法。

**修正**：
- `QualitySource[]` → **`ProgressiveVariant[]`**，且只挂在 `src.qualities` 下并**明确标注"仅 MP4"**
- `SourceInput` 的 `string[]` 分支改为**语义明确的备用源**（或并入 `backups`），不再与"清晰度"混用同一个数组类型
- `QualityLevel | string` 标识 → **`height?: number`**（枚举无法表达 manifest 的任意档位）
- 新增运行时统一模型 **`QualityInfo`** + `QualityController` 抽象
  （`@see docs/player-quality-correction.md`）

#### 问题 8｜隐式持久化，无开关 🟠

**位置**：`VideoPlayer.ts:261-270`

```ts
const persistentState = this.store.getPersistentState();
if (this.props.volume === defaultConfig.volume) {
  this.props.volume = persistentState.volume;      // ← 偷偷覆盖用户配置
}
```

**问题**：
- 无 `storage.enabled` 开关，用户无法关闭
- 判定条件是"**等于默认值**"→ 用户显式传 `volume: 1`（正好等于默认）会被 localStorage 覆盖，**违反最小惊讶原则**
- 无 `persistKey` 配置（硬编码 `"hili_player_state"`）

#### 问题 9｜默认值两份、且不一致 🟠

| 文件 | `progressSegments[0].pointText` |
|---|---|
| `packages/player/src/config/defaultConfig.ts:40` | `""` |
| `packages/player/src/player/VideoPlayer.ts:112` | `"待填写"` |

`config/defaultConfig.ts` 看起来是"官方默认值文件"，但 `VideoPlayer.ts` 又内置了一份并**优先使用**。两份默认值必然漂移。

#### 问题 10｜配置枚举与类型双份维护 🟠

`PlayerConfigEnum`（`packages/player/src/core/events.ts:339`）列出了类型里**不存在**的键：

```
PRELOAD, CONTROLS, QUALITIES, THEME_COLOR, FULLSCREEN
```

而类型里有、枚举里**没有**的键：`playerName`、`callbacks`、`progressSegments`、`subtitles`（枚举是 `SUBTITLES` 但值是大写字符串）等。

**结论**：枚举是冗余的第二数据源，应删除，改用 `keyof PlayerConfig` + 字面量类型。

#### 问题 11｜缺失主流播放器普遍提供的配置项 🟠

| 缺失项 | 主流做法 | 影响 |
|---|---|---|
| `preload` | `'none' \| 'metadata' \| 'auto'` | 无法控制预加载带宽 |
| `playsinline` | 布尔 | 移动端内联播放（当前硬编码在 PlayerDocker） |
| `crossOrigin` / `withCredentials` | — | 跨域资源 / 带凭证请求 |
| `headers` / `referrerPolicy` | 对象 | 防盗链、鉴权 |
| `startTime` | 秒 | 起播时间（续播场景） |
| `timeout` / `retry` | 对象 | 加载超时与重试策略 |
| `videoAttrs`（透传） | `moreVideoAttr` | 每加原生属性都要改框架 |
| `storage` | `{ enabled, key }` | 见问题 8 |
| `lang` / `i18n` | 字符串 / 对象 | 多语言 |
| `playbackRates` | 数组 | 倍速菜单选项（当前只有单个 `playbackRate`） |

#### 问题 12｜`keyboard?: boolean` 粒度太粗 🟠

xgplayer 已是 `keyboard: { seekStep: 5, volumeStep: 0.1 }`。当前连"方向键步长"都无法配置（硬编码在 `hotkeys.ts`）。

### P2：可维护性

#### 问题 13｜顶层 20+ 扁平字段，无分组

当前 `PlayerConfig` 顶层字段（`types/index.ts:390-432`）：

```
container, src, autoplay, muted, volume, playbackRate, loop, controlBtns,
poster, defaultQuality, playMode, keyboard, progressSegments, playerName,
subtitles, danmaku, ssr, plugins, debug, callbacks
```

按关注点混在一起：**挂载**(container) / **媒体**(src, poster) / **播放**(autoplay, muted, volume...) / **UI**(controlBtns, playerName) / **交互**(keyboard) / **功能**(danmaku, subtitles, progressSegments) / **工程**(ssr, plugins, debug, callbacks)。

#### 问题 14｜`callbacks` 三个命名空间混在一起

`EventListeners` 里同时有：
- **框架生命周期**：`ready`、`mounted`、`destroy`
- **媒体元素事件**：`play`、`pause`、`timeupdate`、`seeking`…（21 个）
- **播放器语义**：`qualitychange`、`statechange`、`fullscreenchange`
- **DOM 事件**：`click`、`dblclick`、`contextmenu`

扁平放置导致"这个回调是 DOM 的还是媒体的"要靠猜。

#### 问题 15｜`plugins?: Plugin[]` 无法传插件配置

`Plugin[]` 是**实例数组**，插件自己的选项只能塞在插件构造参数里，无法通过播放器配置统一管理。主流做法是 `pluginOptions: { hls: {...} }`。

---

## 四、新设计总览

### 4.1 设计目标

| # | 目标 | 对应解决问题 |
|---|---|---|
| G1 | 嵌套配置**深度合并**，部分传参不丢默认值 | 问题 1 |
| G2 | 控件配置**单一数据源** | 问题 2、3、10 |
| G3 | 明确划分**配置 / 组件 props / 运行时状态**三层 | 问题 4、5 |
| G4 | 配置只含**输入数据**，不含 DOM 句柄 | 问题 5、6 |
| G5 | 按**关注点分组**的命名空间 | 问题 13、14 |
| G6 | **输入类型**与**解析后类型**分离 | 问题 7、8 |
| G7 | 补齐主流配置项 + `<video>` 透传 | 问题 11、12、15 |
| G8 | 未知键**开发环境校验** | 新增 |
| G9 | 默认值**单一文件 + 可导出** | 问题 9 |

### 4.2 顶层结构（11 个命名空间）

```ts
interface PlayerConfig {
  // ─── 顶层精简：只有最常用的 3 个 ───
  container?: HTMLElement | string;
  src?: SourceInput;                       // 可省略（后续 load() 动态设置）
  poster?: string;

  // ─── 命名空间 ───
  playback?: PlaybackConfig;               // 播放行为
  loading?: LoadingConfig;                 // 网络与加载
  ui?: UiConfig;                           // 外观与控件
  interaction?: InteractionConfig;         // 交互与快捷键
  danmaku?: DanmakuConfig;                 // 弹幕
  subtitle?: SubtitleConfigSpace;          // 字幕
  quality?: QualityConfig;                 // 画质
  progress?: ProgressConfig;               // 进度条（分段 + 预览图）
  plugins?: PluginsConfig;                 // 插件与引擎选项
  storage?: StorageConfig;                 // 持久化
  ssr?: SsrConfig;                         // SSR
  advanced?: AdvancedConfig;               // 高级（日志 / 透传 / 引擎）
  callbacks?: PlayerCallbacks;             // 事件回调
}
```

**设计理由**：
- `container` / `src` / `poster` 放顶层 —— 与**所有**主流播放器一致（Plyr 除外都用 `container`+`url/src`）
- 其余全部命名空间化 —— 解决顶层 20 字段的认知负担
- 命名空间名用**功能名**（`playback`/`ui`/`interaction`）而非模块名（`controls`/`hotkeys`），对外部用户更直观

### 4.3 与主流方案的关系

| 借鉴点 | 来源 | 落到本设计 |
|---|---|---|
| 递归合并 | Shaka `configure()` | `mergePlayerConfig()` |
| 默认值可导出 | `hls.DefaultConfig` | `defaultPlayerConfig` |
| `<video>` 透传 | ArtPlayer `moreVideoAttr` | `advanced.videoAttrs` |
| 引擎选项独立 | DPlayer `pluginOptions.hls` | `plugins.engines.hls` |
| 控件数组声明 | Plyr/ArtPlayer `controls: []` | `ui.controls` 支持 `boolean \| string[] \| Record<string,boolean>` |
| 持久化显式 | Plyr `storage` | `storage: { enabled, key, persist }` |
| 快捷键对象化 | xgplayer `keyboard: {seekStep}` | `interaction.keyboard` |
| 分辨率/预览缩略图 | Plyr `previewThumbnails` | `progress.preview` |

---

## 五、完整类型定义

```ts
// ============================================================
// 文件：types/config.ts（新增，从 types/index.ts 拆出）
// ============================================================

import type { Plugin } from '@/hili-player/core/plugin';
import type { PlayerCallbacks } from './index';

/** 深层可选（用于用户输入类型） */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? U[]                                  // 数组整体替换，不做深可选
    : T[K] extends object | undefined
      ? DeepPartial<NonNullable<T[K]>>
      : T[K];
};

// ============================================================
// 1. 视频源
// ============================================================

/**
 * 渐进式（MP4）清晰度变体
 * ⚠️ **仅 MP4 使用**。HLS / DASH 的清晰度由 manifest 在运行时提供，**不要传**（传了会被忽略并给出开发警告）。
 * @see docs/player-quality-correction.md
 */
export interface ProgressiveVariant {
  /** 源地址 */
  url: string;
  /**
   * 视频高度（px）；既是标识也是排序/降级依据
   * 无 height 时按数组顺序即档位顺序（建议从高到低）
   */
  height?: number;
  /** 显示名称（height 与 label 至少要有一个，否则开发警告） */
  label?: string;
  /** 码率 bps（可选） */
  bitrate?: number;
  /** 该变体专属的请求头 */
  headers?: Record<string, string>;
}

/** 源输入：单个 URL / 备用源列表 / 结构化对象 */
export type SourceInput =
  | string
  /** ⚠️ 备用源（failover）列表，**不是清晰度列表** */
  | string[]
  | {
      /** 主源地址（与 qualities 二选一） */
      url?: string;
      /** 流类型 @default 'auto'（按后缀 / Content-Type 推断） */
      type?: StreamType;
      /**
       * 渐进式多清晰度变体
       * ⚠️ **仅 MP4 使用**；HLS / DASH 不要传（清晰度由 manifest 决定）
       */
      qualities?: ProgressiveVariant[];
      /** 备用源列表（主源失败时按序切换） */
      backups?: string[];
      /** 起播时间（秒） */
      startTime?: number;
      /** 该源专属请求头 */
      headers?: Record<string, string>;
    };

/** 支持的流类型 */
export type StreamType = 'auto' | 'mp4' | 'hls' | 'dash' | 'flv' | 'webrtc';

// ============================================================
// 2. playback —— 播放行为
// ============================================================

export interface PlaybackConfig {
  /**
   * 自动播放
   * - true：尝试带声自动播放（浏览器策略可能拦截）
   * - 'muted'：静音自动播放（策略友好，推荐）
   * - false：不自动播放
   * @default false
   */
  autoplay?: boolean | 'muted';
  /** 初始静音 @default false */
  muted?: boolean;
  /** 初始音量 0~1 @default 1 */
  volume?: number;
  /** 初始倍速 @default 1 */
  playbackRate?: PlaybackRate;
  /** 倍速菜单可选值 @default [0.5, 0.75, 1, 1.25, 1.5, 2] */
  playbackRates?: PlaybackRate[];
  /** 循环播放 @default false */
  loop?: boolean;
  /** 播放结束后的行为 @default 'pause' */
  onEnded?: 'pause' | 'next' | 'replay' | 'none';
  /**
   * 预加载策略
   * @default 'metadata'
   */
  preload?: 'none' | 'metadata' | 'auto';
  /**
   * 移动端内联播放（不自动进入全屏）
   * @default true
   */
  playsinline?: boolean;
  /** 播放模式（列表连播策略） @default PlayMode.ORDER */
  playMode?: PlayMode;
  /** 起播时间（秒），续播场景 @default 0 */
  startTime?: number;
}

// ============================================================
// 3. loading —— 网络与加载
// ============================================================

export interface LoadingConfig {
  /** 单次加载超时（毫秒），0 表示不限制 @default 30000 */
  timeout?: number;
  /** 失败重试策略 */
  retry?: {
    /** 重试次数 @default 2 */
    count?: number;
    /** 重试间隔（毫秒） @default 1000 */
    delay?: number;
    /** 重试是否切换备用源 @default true */
    useBackup?: boolean;
  };
  /** 跨域属性 @default null */
  crossOrigin?: 'anonymous' | 'use-credentials' | null;
  /** 请求是否携带凭证 @default false */
  withCredentials?: boolean;
  /** 全局请求头（会被 QualitySource.headers 覆盖） */
  headers?: Record<string, string>;
  /** Referrer 策略 */
  referrerPolicy?: '' | 'no-referrer' | 'origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin';
}

// ============================================================
// 4. ui —— 外观与控件
// ============================================================

/**
 * 控件开关，三种写法：
 *   ui: { controls: true }                        → 全开（用默认集）
 *   ui: { controls: false }                       → 全关（纯视频）
 *   ui: { controls: ['play','progress','fullscreen'] }  → 只开这些，且按此顺序
 *   ui: { controls: { quality: false } }          → 默认集基础上关掉某几个
 */
export type ControlsInput = boolean | ControlName[] | Partial<Record<ControlName, boolean>>;

/** 可配置的控件名（与组件一一对应） */
export type ControlName =
  | 'play'          // 播放/暂停
  | 'progress'      // 进度条
  | 'time'          // 时间显示
  | 'volume'        // 音量
  | 'quality'       // 清晰度
  | 'playbackRate'  // 倍速
  | 'subtitle'      // 字幕
  | 'danmaku'       // 弹幕开关
  | 'setting'       // 设置
  | 'viewpoint'     // 视角
  | 'eplist'        // 剧集列表
  | 'prev'          // 上一个
  | 'next'          // 下一个
  | 'pip'           // 画中画
  | 'wide'          // 宽屏
  | 'webFullscreen' // 网页全屏
  | 'fullscreen'    // 全屏
  | 'hotkeyPanel';  // 快捷键面板

export interface UiConfig {
  /** 控件配置 @default true */
  controls?: ControlsInput;
  /** 顶部标题栏控件（同 controls 语义） @default ['top'] */
  topControls?: ControlsInput;
  /** 主题色（CSS 颜色） @default '#00b4d8' */
  theme?: string;
  /**
   * 界面语言
   * @default 'zh-CN'
   */
  lang?: 'zh-CN' | 'en-US' | (string & {});
  /** 自定义文案（覆盖内置 i18n） */
  i18n?: Record<string, string>;
  /** 播放器宽高比 @default '16 / 9' */
  ratio?: string;
  /** 播放器名称（用于 aria-label / 日志） @default '嗨哩播放器' */
  playerName?: string;
  /** 按钮 tooltip @default true */
  tooltips?: boolean;
  /** 自定义右键菜单 @default true */
  contextmenu?: boolean;
  /** 控制栏自动隐藏延迟（毫秒），0 表示不自动隐藏 @default 3000 */
  autoHideDelay?: number;
  /** 鼠标静止后隐藏光标 @default true */
  hideCursor?: boolean;
  /** 追加的容器 class */
  className?: string;
  /** 追加的容器内联样式 */
  style?: Record<string, string>;
}

// ============================================================
// 5. interaction —— 交互与快捷键
// ============================================================

/** 快捷键映射：键名（KeyboardEvent.key）→ 动作名 */
export type HotkeyMap = Record<string, HotkeyAction>;

export type HotkeyAction =
  | 'togglePlay' | 'seekForward' | 'seekBackward' | 'seekToPercent'
  | 'volumeUp' | 'volumeDown' | 'toggleMute'
  | 'toggleFullscreen' | 'toggleWebFullscreen' | 'togglePip'
  | 'toggleDanmaku' | 'toggleSubtitle'
  | 'rateUp' | 'rateDown' | 'rateReset'
  | 'prev' | 'next'
  | 'toggleHotkeyPanel' | 'none';

export interface InteractionConfig {
  /**
   * 快捷键
   * - true：启用内置按键表
   * - false：全部禁用
   * - HotkeyMap：基于内置表覆盖部分按键
   */
  keyboard?: boolean | HotkeyMap;
  /** 单击画面播放/暂停 @default true */
  clickToPlay?: boolean;
  /** 双击画面全屏 @default true */
  dblclickFullscreen?: boolean;
  /** 方向键快进/快退步长（秒） @default 5 */
  seekStep?: number;
  /** 方向键音量步长 0~1 @default 0.1 */
  volumeStep?: number;
  /** 滚轮调节音量 @default true */
  wheelVolume?: boolean;
  /** 长按加速倍率，null 表示禁用 @default 2 */
  longPressRate?: number | null;
}

// ============================================================
// 6. danmaku —— 弹幕
// ============================================================

export interface DanmakuConfig {
  /** 是否启用弹幕能力（关闭则不加载弹幕插件） @default false */
  enabled?: boolean;
  /** 弹幕数据源（URL 或 XML 字符串） */
  source?: string | string[];
  /** 发送弹幕的接口地址（不传则禁用发送） */
  api?: string;
  /** 鉴权 token */
  token?: string;
  /** 初始透明度 0~1 @default 0.8 */
  opacity?: number;
  /** 初始速度倍率 @default 1 */
  speed?: number;
  /** 初始是否可见 @default true */
  visible?: boolean;
  /** 字号（px） @default 25 */
  fontSize?: number;
  /** 字体族 */
  fontFamily?: string;
  /** 渲染引擎 @default 'dom' */
  engine?: 'dom' | 'canvas';
  /** 显示区域占比 0~1 @default 0.5 */
  area?: number;
  /** 同屏最大条数 @default 100 */
  limit?: number;
  /** 发送面板 */
  send?: {
    /** 是否显示发送栏 @default true */
    enabled?: boolean;
    /** 输入框占位文案 @default '发个弹幕见证当下' */
    placeholder?: string;
    /** 最大长度 @default 100 */
    maxLength?: number;
    /** 默认颜色 @default '#ffffff' */
    defaultColor?: string;
    /** 默认位置模式 @default 'scroll' */
    defaultMode?: 'scroll' | 'top' | 'bottom';
  };
}

// ============================================================
// 7. subtitle —— 字幕
// ============================================================

/** 单条字幕轨道 */
export interface SubtitleTrack {
  /** 唯一标识 */
  id?: string;
  /** 语言代码，如 'zh-CN' */
  lang?: string;
  /** 显示名称，如 '简体中文' */
  label?: string;
  /** 字幕文件地址（.vtt / .srt / .ass） */
  url?: string;
  /** 内嵌字幕文本（与 url 二选一） */
  content?: string;
  /** 格式（不传按 url 后缀推断） */
  type?: 'vtt' | 'srt' | 'ass';
  /** 是否为默认轨道 */
  default?: boolean;
}

export interface SubtitleConfigSpace {
  /** 轨道列表 @default [] */
  tracks?: SubtitleTrack[];
  /** 默认启用的轨道 lang/id @default undefined（不自动开启） */
  defaultTrack?: string;
  /** 初始是否显示 @default false */
  visible?: boolean;
  /** 字号（px） @default 24 */
  fontSize?: number;
  /** 距底部距离（px） @default 60 */
  bottom?: number;
  /** 文字颜色 @default '#ffffff' */
  color?: string;
  /** 描边颜色 @default '#000000' */
  strokeColor?: string;
  /** 描边宽度（px） @default 1 */
  strokeWidth?: number;
  /** 背景色（rgba） @default 'rgba(0,0,0,0.35)' */
  background?: string;
}

// ============================================================
// 8. quality —— 画质
// ============================================================

export interface QualityConfig {
  /**
   * 默认画质**倾向**
   * - `'auto'`：自适应（HLS/DASH 启用 ABR；MP4 取最高档）
   * - 数字：倾向该高度 —— 有精确档用它；无则取不超过该值的最高档
   * @default 'auto'
   */
  default?: number | 'auto';
  /**
   * 严格模式：目标高度不存在时不降级 @default false（就近降级）
   */
  strict?: boolean;
  /** 清晰度上限（像素高度） @default undefined */
  max?: number;
  /** 清晰度下限（像素高度） @default undefined */
  min?: number;
  // ❌ 不要 list！
  // 清晰度列表有 3 种来源，其中 HLS/DASH 由 manifest 在运行时提供，用户不传：
  //   · MP4 多档 → 用户在 src.qualities 显式提供
  //   · HLS/DASH → hls.levels / getBitrateInfoListFor()（运行时发现）
  // 配置块只放「行为偏好」，列表通过 player.getQualities() 运行时读取。
  // @see docs/player-quality-correction.md
  /** 是否显示清晰度菜单 @default 'auto'（运行时列表 > 1 档时显示） */
  showMenu?: 'auto' | boolean;
  /** 网络差时自动降级（**仅 MP4 静态档有意义**；HLS/DASH 由 ABR 自理） @default false */
  autoFallback?: boolean;
  /** 自动降级判定：连续卡顿次数阈值 @default 3 */
  fallbackThreshold?: number;
  /** 自定义菜单文案，按像素高度索引，如 { 1080: '1080P 超清' } */
  labels?: Record<number, string>;
}

// ============================================================
// 9. progress —— 进度条
// ============================================================

/** 分段数据（纯输入，不含任何 DOM 字段） */
export interface ProgressSegmentData {
  /** 起始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 分段文本描述 */
  text: string;
}

/** 预览缩略图雪碧图 */
export interface ThumbnailSheet {
  /** 雪碧图地址 */
  url: string;
  /** 每张缩略图的间隔（秒） */
  interval: number;
  /** 单张宽（px） */
  width: number;
  /** 单张高（px） */
  height: number;
  /** 每行列数 */
  cols?: number;
  /** 总张数 */
  count?: number;
}

export interface ProgressConfig {
  /** 分段数据 @default [] */
  segments?: ProgressSegmentData[];
  /** 进度条悬停预览 */
  preview?: {
    /** @default true */
    enabled?: boolean;
    /**
     * 预览类型
     * - 'sprite'：雪碧图（推荐，零额外请求）
     * - 'video'：短视频片段
     * - 'image'：单张静态图
     * @default 'sprite'
     */
    type?: 'sprite' | 'video' | 'image';
    /** 雪碧图配置 */
    thumbnails?: ThumbnailSheet[];
    /** 是否显示时间气泡 @default true */
    showTime?: boolean;
  };
  /** 是否显示缓冲进度条 @default true */
  showBuffer?: boolean;
  /** 是否可拖拽 @default true */
  draggable?: boolean;
}

// ============================================================
// 10. plugins —— 插件与引擎选项
// ============================================================

export interface PluginsConfig {
  /** 插件实例列表 @default [] */
  list?: Plugin[];
  /**
   * 引擎级配置（透传给对应插件/库）
   * 例：engines: { hls: { maxBufferLength: 30 }, dash: { streaming: {...} } }
   */
  engines?: {
    hls?: Record<string, unknown>;
    dash?: Record<string, unknown>;
    flv?: Record<string, unknown>;
  };
  /**
   * 按插件名索引的插件选项
   * 例：options: { danmaku: { opacity: 0.5 } }
   */
  options?: Record<string, Record<string, unknown>>;
}

// ============================================================
// 11. storage —— 持久化
// ============================================================

/** 可持久化的偏好项 */
export type PersistKey =
  | 'volume' | 'muted' | 'playbackRate' | 'quality'
  | 'danmaku' | 'subtitle' | 'webFullscreen';

export interface StorageConfig {
  /** @default true */
  enabled?: boolean;
  /** localStorage key @default 'hili-player' */
  key?: string;
  /** 需要持久化的项 @default ['volume','muted','playbackRate'] */
  persist?: PersistKey[];
  /** 存储后端，默认 localStorage；SSR 环境自动降级为内存 */
  adapter?: 'localStorage' | 'sessionStorage' | 'memory';
}

// ============================================================
// 12. ssr
// ============================================================

export interface SsrConfig {
  /** @default false */
  enabled?: boolean;
  /** 骨架屏 HTML（SSR 首屏占位） */
  placeholder?: string;
  /** 延迟水合（首屏可见后再绑定事件） @default false */
  deferHydration?: boolean;
}

// ============================================================
// 13. advanced —— 高级
// ============================================================

export interface AdvancedConfig {
  /** 调试模式（等价 logLevel: 'debug'） @default false */
  debug?: boolean;
  /** 日志级别 @default 'silent' */
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  /**
   * 透传到 <video> 元素的原生属性
   * 例：{ crossOrigin: 'anonymous', disablePictureInPicture: true }
   * 框架未显式支持的属性都可以走这里
   */
  videoAttrs?: Record<string, string | number | boolean>;
  /** 容器 z-index */
  zIndex?: number;
  /** 是否启用长按加速 @default false */
  disableContextMenuOnVideo?: boolean;
}

// ============================================================
// 14. 顶层
// ============================================================

/** 用户输入配置（全部可选，深度部分匹配） */
export interface PlayerConfig {
  /** 挂载容器（元素或选择器） */
  container?: HTMLElement | string;
  /** 视频源（可省略，之后用 player.load() 动态设置） */
  src?: SourceInput;
  /** 封面图 */
  poster?: string;

  playback?: PlaybackConfig;
  loading?: LoadingConfig;
  ui?: UiConfig;
  interaction?: InteractionConfig;
  danmaku?: DanmakuConfig;
  subtitle?: SubtitleConfigSpace;
  quality?: QualityConfig;
  progress?: ProgressConfig;
  plugins?: PluginsConfig;
  storage?: StorageConfig;
  ssr?: SsrConfig;
  advanced?: AdvancedConfig;
  callbacks?: PlayerCallbacks;
}

/** 解析后配置：合并默认值，所有命名空间与字段都必填 */
export type ResolvedPlayerConfig = {
  container?: HTMLElement | string;
  src: SourceInput;
  poster: string;
  playback: Required<PlaybackConfig>;
  loading: Required<Omit<LoadingConfig, 'retry'>> & { retry: Required<NonNullable<LoadingConfig['retry']>> };
  ui: Required<Omit<UiConfig, 'i18n' | 'className' | 'style'>> & Pick<UiConfig, 'i18n' | 'className' | 'style'>;
  interaction: Required<InteractionConfig>;
  danmaku: Required<DanmakuConfig>;
  subtitle: Required<SubtitleConfigSpace>;
  quality: Required<QualityConfig>;
  progress: Required<ProgressConfig>;
  plugins: Required<PluginsConfig>;
  storage: Required<StorageConfig>;
  ssr: Required<SsrConfig>;
  advanced: Required<AdvancedConfig>;
  callbacks: PlayerCallbacks;
};
```

---

## 六、默认值设计

**单一来源**：`packages/player/src/config/defaultPlayerConfig.ts`（删除 `VideoPlayer.ts` 内的第二份）

```ts
export const defaultPlayerConfig: ResolvedPlayerConfig = {
  src: '',
  poster: '',

  playback: {
    autoplay: false,
    muted: false,
    volume: 1,
    playbackRate: 1,
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
    loop: false,
    onEnded: 'pause',
    preload: 'metadata',
    playsinline: true,
    playMode: PlayMode.ORDER,
    startTime: 0,
  },

  loading: {
    timeout: 30_000,
    retry: { count: 2, delay: 1_000, useBackup: true },
    crossOrigin: null,
    withCredentials: false,
    headers: {},
    referrerPolicy: '',
  },

  ui: {
    controls: true,
    topControls: true,
    theme: '#00b4d8',
    lang: 'zh-CN',
    ratio: '16 / 9',
    playerName: '嗨哩播放器',
    tooltips: true,
    contextmenu: true,
    autoHideDelay: 3_000,
    hideCursor: true,
  },

  interaction: {
    keyboard: true,
    clickToPlay: true,
    dblclickFullscreen: true,
    seekStep: 5,
    volumeStep: 0.1,
    wheelVolume: true,
    longPressRate: 2,
  },

  danmaku: {
    enabled: false,
    source: '',
    opacity: 0.8,
    speed: 1,
    visible: true,
    fontSize: 25,
    engine: 'dom',
    area: 0.5,
    limit: 100,
    send: {
      enabled: true,
      placeholder: '发个弹幕见证当下',
      maxLength: 100,
      defaultColor: '#ffffff',
      defaultMode: 'scroll',
    },
  },

  subtitle: {
    tracks: [],
    visible: false,
    fontSize: 24,
    bottom: 60,
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
    background: 'rgba(0,0,0,0.35)',
  },

  quality: {
    default: 'auto',
    // ❌ 无 list —— 清晰度列表来自运行时（MP4 变体 / HLS manifest / DASH manifest）
    showMenu: 'auto',
    autoFallback: false,
    fallbackThreshold: 3,
  },

  progress: {
    segments: [],
    preview: { enabled: true, type: 'sprite', thumbnails: [], showTime: true },
    showBuffer: true,
    draggable: true,
  },

  plugins: { list: [], engines: {}, options: {} },

  storage: {
    enabled: true,
    key: 'hili-player',
    persist: ['volume', 'muted', 'playbackRate'],
    adapter: 'localStorage',
  },

  ssr: { enabled: false, deferHydration: false },

  advanced: {
    debug: false,
    logLevel: 'silent',
    videoAttrs: {},
    disableContextMenuOnVideo: false,
  },

  callbacks: {},
};
```

**变更点说明**：

| 项 | 旧默认值 | 新默认值 | 理由 |
|---|---|---|---|
| `progressSegments` | `[{ startTime:0, endTime:90, pointText:'待填写' }]` | `[]` | 默认塞一个假分段是**错误默认值**，会污染 UI |
| `preload` | 无 | `'metadata'` | 主流默认（避免首屏拉全量） |
| `playsinline` | 硬编码 `true` | `true`（可配） | 变为显式配置 |
| `storage` | 隐式开启 | `enabled: true` + 可配 key/persist | 显式化 |
| `autoplay` | `false` | `false`（支持 `'muted'`） | 新增策略友好值 |

---

## 七、合并与校验语义

### 7.1 `mergePlayerConfig` 算法

```ts
/**
 * 深度合并用户配置与默认配置
 *
 * 规则：
 *  1. 普通对象 → 递归合并
 *  2. 数组 → 整体替换（不逐项合并）
 *  3. undefined → 采用默认值（无法用 undefined 表达"清空"）
 *  4. null → 显式清空（仅对可空字段生效）
 *  5. 其他原始类型 → 覆盖
 */
export function mergePlayerConfig(
  defaults: ResolvedPlayerConfig,
  user: DeepPartial<PlayerConfig> | undefined,
): ResolvedPlayerConfig;
```

**伪代码**：

```
function merge(defaultVal, userVal, keyPath):
    if userVal === undefined: return defaultVal
    if userVal === null:      return null（或 defaultVal，取决于字段可空性）
    if isArray(userVal):      return userVal.slice()          # 数组替换
    if isPlainObject(userVal):
        if !isPlainObject(defaultVal): return userVal
        result = { ...defaultVal }
        for k in userVal:
            result[k] = merge(defaultVal[k], userVal[k], keyPath + '.' + k)
        return result
    return userVal
```

**关键测试用例**：

```ts
// ① 部分嵌套不丢默认值（当前会丢）
merge({ danmaku: { enabled: false, opacity: 0.8, speed: 1 } },
      { danmaku: { enabled: true } })
// → { danmaku: { enabled: true, opacity: 0.8, speed: 1 } }   ✅

// ② 数组整体替换
merge({ playbackRates: [0.5, 1, 2] }, { playbackRates: [1, 3] })
// → [1, 3]                                                   ✅

// ③ 深层合并
merge({ progress: { preview: { enabled: true, showTime: true } } },
      { progress: { preview: { showTime: false } } })
// → { progress: { preview: { enabled: true, showTime: false } } }  ✅

// ④ 显式清空
merge({ poster: 'a.jpg' }, { poster: null })
// → null（并在 SSR 中不输出 poster 属性）
```

### 7.2 数组语义决策

**选择「整体替换」**，理由：
- 与 hls.js / Shaka / Plyr / video.js 全部一致
- 合并数组会导致"默认 6 项 + 用户 2 项 = 8 项"，用户无法表达"我只要这 2 项"
- 例外：`playbackRates` 若用户传空数组 `[]` → 表示"不要倍速菜单"，语义清晰

### 7.3 未知键校验（dev 专用）

```ts
/** 递归校验用户配置键，dev 下对未知键发出框架警告 */
export function validatePlayerConfig(user: unknown, schema: object, path = ''): void;
```

- 仅 `isDev()` 时执行
- 用 `warn(WarnSource.STATE, ...)` 输出：`未知配置键 "player.playback.autoPlay"（是否想写 "autoplay"？）`
- 支持**近似键名建议**（编辑距离 ≤ 2 时给出候选）
- 生产环境零开销

---

## 八、三种配置形态（输入 / 解析后 / 运行时状态）

这是本次重设计的**核心分层**，用于解决问题 4、5、8：

```
┌─────────────────────────────────────────────────────────┐
│ ① PlayerConfig（用户输入）                                │
│   - 全部可选（除 container/src 视场景）                    │
│   - DeepPartial：嵌套命名空间可部分传                      │
│   - 只含「数据」，绝不含 DOM 句柄或运行时产物               │
│   例：new VideoPlayer({ src, danmaku: { enabled: true } }) │
└───────────────────────┬─────────────────────────────────┘
                        │ mergePlayerConfig() + validatePlayerConfig()
                        ▼
┌─────────────────────────────────────────────────────────┐
│ ② ResolvedPlayerConfig（解析后）                          │
│   - 所有命名空间与字段必填（除少数可空项）                  │
│   - 只读（内部 props 用 Readonly<ResolvedPlayerConfig>）   │
│   - 外部可通过 player.getConfig() 读取（返回深拷贝）        │
└───────────────────────┬─────────────────────────────────┘
                        │ 派生
                        ▼
┌─────────────────────────────────────────────────────────┐
│ ③ 运行时状态（不进配置类型）                                │
│   - PlayerStateMap（TypedStateManager）：currentTime、     │
│     duration、volume、muted、buffered、isFullscreen…       │
│   - PlayerStore（PlayerStore）：isPlaying、isWaiting…      │
│   - 组件内部：ProgressSegmentRuntime（含 DOM 句柄）、       │
│     videoEl、containerEl…                                 │
│   通过 player.getState() / 事件总线 / Context 访问          │
└─────────────────────────────────────────────────────────┘
```

### 8.1 组件 props 的边界（解决问题 4）

**新增** `PlayerDockerProps`，明确"配置 → 组件"的映射：

```ts
/** PlayerConfig → PlayerDocker 的 props 投影 */
export interface PlayerDockerProps {
  /** 结构化配置（PlayerDocker 需要的子集） */
  config: {
    src: SourceInput;
    poster: string;
    autoplay: boolean | 'muted';
    muted: boolean;
    volume: number;
    playsinline: boolean;
    playerName: string;
    ratio: string;
  };
  /** 控件配置（单一来源） */
  controls: ControlsInput;
  /** 事件总线 */
  events: PlayerEventBus;
  /** 状态管理器 */
  state: TypedStateManager<PlayerStateMap>;
}
```

**收益**：
- 消除 5 个现存 tsc 错误
- `VideoPlayer.render()` 不再把整个 `PlayerConfig` 塞进 `h(PlayerDocker, {...})`
- `PlayerDocker` 可独立测试（传最小 props 即可）

### 8.2 运行时字段的归属（解决问题 5）

```ts
/** 组件内部维护的分段运行时对象（不进公开类型） */
interface ProgressSegmentRuntime extends ProgressSegmentData {
  element?: HTMLDivElement;
  bufferElement?: HTMLDivElement;
  currentElement?: HTMLDivElement;
  shadowElement?: HTMLDivElement;
  shadowBufferElement?: HTMLDivElement;
  shadowCurrentElement?: HTMLDivElement;
  shadowTextElement?: HTMLDivElement;
}
```

- 定义在 `ProgressBar.ts` 内部（不导出）
- 由 `progress.segments`（纯数据）在组件 setup 时初始化

---

## 九、向后兼容迁移表

### 9.1 键映射

| 旧键（flat） | 新键 | 备注 |
|---|---|---|
| `container` | `container` | 不变 |
| `src` | `src` | 类型收窄为 `SourceInput`（旧的三态联合仍兼容） |
| `poster` | `poster` | 不变 |
| `autoplay` | `playback.autoplay` | 类型扩展支持 `'muted'` |
| `muted` | `playback.muted` | — |
| `volume` | `playback.volume` | — |
| `playbackRate` | `playback.playbackRate` | — |
| `loop` | `playback.loop` | — |
| `playMode` | `playback.playMode` | — |
| `defaultQuality` | `quality.default` | — |
| `controlBtns` | `ui.controls` | **类型统一**（消除 6 键 vs 9 键冲突） |
| `controls`（代码在用、类型缺失） | `ui.controls` | 与上一条合并为同一键 |
| `playerName` | `ui.playerName` | — |
| `keyboard` | `interaction.keyboard` | 类型扩展支持对象 |
| `subtitles` | `subtitle.tracks` | 语义拆分 |
| `danmaku` | `danmaku` | 保持命名空间，补齐字段 |
| `progressSegments` | `progress.segments` | **去掉 DOM 字段**（`pointText` → `text`） |
| `plugins` | `plugins.list` | — |
| `debug` | `advanced.debug` | — |
| `ssr` | `ssr` | 保持 |
| `callbacks` | `callbacks` | 保持（类型补全并分组注释） |
| —（隐式 localStorage） | `storage` | **显式化** |

### 9.2 兼容策略（两阶段）

**阶段一（本次）· 双轨兼容**

```ts
new VideoPlayer({ src, volume: 0.5, controlBtns: { pip: false } });   // 旧写法仍可用
new VideoPlayer({ src, playback: { volume: 0.5 }, ui: { controls: { pip: false } } }); // 新写法
```

实现方式：`normalizeLegacyConfig(userConfig)` 在合并前把扁平旧键**就地归一化**到新结构，并在 dev 下输出一条 deprecation 警告（每个键只提示一次）。

```ts
const LEGACY_KEY_MAP = {
  autoplay: 'playback.autoplay',
  muted: 'playback.muted',
  // ...
} as const;
```

**阶段二（下个大版本）· 移除旧键**
- 删掉 `normalizeLegacyConfig` 与 `LEGACY_KEY_MAP`
- 删除 `PlayerConfigEnum`（冗余枚举）
- 删除 `config/defaultConfig.ts` 旧文件

### 9.3 破坏性变更清单（需要在 CHANGELOG 中标注）

| 变更 | 影响 | 迁移方式 |
|---|---|---|
| `progressSegments[].pointText` → `progress.segments[].text` | 用到分段文本的代码 | 重命名 |
| `ControlBtnConfig` 类型删除，统一为 `ControlsInput` | 显式引用该类型的代码 | 改用 `ControlsInput` |
| `PlayerConfigEnum` 删除 | 用该枚举取配置键的代码 | 改字面量或 `keyof PlayerConfig` |
| `subtitles: SubtitleConfig[]` → `subtitle.tracks` | 传字幕数组的代码 | 包一层 `{ tracks: [...] }` |
| 隐式持久化 → `storage.enabled` 默认仍为 `true` | 行为不变，但可关闭 | 传 `storage: { enabled: false }` |
| `src` 由必填改为可选 | 无（放宽） | — |

### 9.4 旧默认值的兼容处理

| 旧默认值 | 新默认值 | 是否破坏 |
|---|---|---|
| `progressSegments: [{0, 90, '待填写'}]` | `progress.segments: []` | ⚠️ **行为变化**（不再有假分段）—— 属修正错误默认值，需在 CHANGELOG 说明 |
| `keyboard: true` | `interaction.keyboard: true` | 不变 |
| `playerName: '嗨哩播放器'` | 同 | 不变 |
| `controlBtns: {prev:false,...}` | `ui.controls: true`（默认全开） | ⚠️ **行为变化**（默认控件从"只开一部分"变为按控件白名单全开）—— 需确认默认控件集 |

---

## 十、校验与错误提示

### 10.1 校验时机

| 时机 | 校验内容 | 行为 |
|---|---|---|
| 构造时（dev） | 未知键 / 类型明显不符 | `warn` 一次 |
| 构造时（prod） | 不做（零开销） | — |
| `src` 缺失 | 是否允许空 | 不报错（允许后续 `load()`） |
| 引擎配置 | `plugins.engines.hls` 在无 HLS 插件时 | `warn` 提示 |

### 10.2 提示样例

```
[HiliFramework/state] 未知配置键 "playback.autoPlay"，是否想写 "autoplay"？
[HiliFramework/state] 配置项 "ui.controls" 的值 "play" 不是合法控件名（合法值：play/progress/time/...）
[HiliFramework/state] 检测到已废弃的扁平配置键 "controlBtns"，请迁移到 "ui.controls"（下个大版本将移除）
[HiliFramework/state] 提供了 plugins.engines.hls 但未注册 HLS 插件（plugins.list 中无 createHlsPlugin）
```

### 10.3 类型层面的防错

```ts
// ✅ 类型安全：未知键直接编译报错
new VideoPlayer({ src, ui: { controls: { pip: false, typo: true } } });
//                                                    ~~~~ 对象字面量多余属性检查 → 报错

// ✅ 控件名收窄
type ControlName = 'play' | 'progress' | ... ;   // 传 'player' 会报错

// ✅ 事件名收窄（已有）
callbacks: { seeked: (t: number) => {} }         // 参数类型自动推断
```

---

## 十一、实现清单（待执行）

> 本文档**不执行**，以下为实现时的改动清单，供后续按序执行。

### 11.1 新增文件

| 文件 | 内容 |
|---|---|
| `types/config.ts` | 全部配置类型（从 `types/index.ts` 拆出，约 400 行） |
| `packages/player/src/config/defaultPlayerConfig.ts` | 唯一默认值来源 |
| `packages/player/src/config/mergeConfig.ts` | `mergePlayerConfig` / `isPlainObject` / `mergeDeep` |
| `packages/player/src/config/normalizeLegacyConfig.ts` | 旧扁平键 → 新结构 |
| `packages/player/src/config/validateConfig.ts` | dev 未知键校验 + 近似键建议 |
| `packages/player/src/config/controls.ts` | `ControlName` 白名单 → 组件映射（控件注册表） |

### 11.2 修改文件

| 文件 | 改动 |
|---|---|
| `types/index.ts` | 删除旧 `PlayerConfig` / `ControlBtnConfig` / `ProgressSegment`（移入 config.ts）；`ProgressSegment` 拆为 `ProgressSegmentData`（公开）+ `ProgressSegmentRuntime`（组件内） |
| `packages/player/src/player/VideoPlayer.ts` | 构造器改用 `mergePlayerConfig` + `normalizeLegacyConfig` + `validatePlayerConfig`；删除内置 `defaultConfig`；`props` 类型改 `Readonly<ResolvedPlayerConfig>`；修复 `controls` / `controlBtns` 混用；`render()` 按新 props 边界传参；新增 `getConfig()` |
| `packages/player/src/components/PlayerDocker.ts` | `PlayerDockerProps` 按新设计重写；`progressSegments` 相关读取改为 `config.progress.segments` + 内部 runtime 对象 |
| `packages/player/src/components/ProgressBar.ts` | 使用 `ProgressSegmentData` 输入 + 内部 `ProgressSegmentRuntime` |
| `packages/player/src/store/playerStore.ts` | 持久化读写改用 `storage.persist` 白名单 + `storage.key` |
| `packages/player/src/core/events.ts` | 删除 `PlayerConfigEnum`（冗余） |
| `packages/player/src/config/defaultConfig.ts` | 删除（合并进 `defaultPlayerConfig.ts`） |
| `packages/player/src/player/index.ts` | `createPlayer` / `createSSRPlayer` 签名对齐新类型 |
| `packages/player/src/index.ts` | 导出 `defaultPlayerConfig`、`mergePlayerConfig`、新类型 |
| `packages/plugins/src/*` | 各插件从 `plugins.options.<name>` / `plugins.engines.<engine>` 读取自身配置（可选） |

### 11.3 测试清单

| 测试 | 内容 |
|---|---|
| `mergeConfig.test.ts` | ①部分嵌套不丢默认 ②数组替换 ③深层合并 ④null 清空 ⑤undefined 用默认 |
| `normalizeLegacyConfig.test.ts` | 旧键 → 新键全覆盖映射 |
| `validateConfig.test.ts` | 未知键警告 + 近似键建议；prod 不执行 |
| `PlayerConfig.test.ts` | 集成：旧写法可用、新写法生效、`getConfig()` 返回深拷贝 |
| 回归 | `tests/player/VideoPlayer.test.ts` 的 `should merge default config` 在修复后应改为断言新结构 |

### 11.4 顺带修复的现存缺陷

| 现存问题 | 修复方式 |
|---|---|
| `should merge default config` 测试失败（`props.controls` undefined） | 统一为 `ui.controls` |
| 5 个 `PlayerDockerProps` tsc 报错 | 新 `PlayerDockerProps` |
| `videoRef` 误传进 `createTypedStateManager` | 移除 |
| `ProgressBar` / `Controls` 未使用变量（tsc TS6133） | 随重构清理 |

---

## 十二、设计决策记录（ADR）

### ADR-1｜为什么用命名空间而非纯扁平？

- **决策**：顶层 3 个常用键 + 11 个命名空间
- **理由**：当前 20 个扁平键已达认知上限，补齐主流配置项后会到 35+。命名空间让相关配置聚合（`danmaku.send.placeholder`），且未知键校验可按命名空间递归
- **代价**：键路径变长（`ui.controls.pip` vs `controlBtns.pip`）
- **权衡**：给扁平旧键保留一版兼容期

### ADR-2｜为什么数组整体替换而不合并？

- **决策**：替换
- **理由**：与 hls.js / Shaka / Plyr / video.js 一致；合并会让用户无法表达"只要这些"
- **代价**：用户想"在默认倍速表上加一项"必须写全量

### ADR-3｜为什么 `src` 从必填改为可选？

- **决策**：可选
- **理由**：支持"先建播放器，后 `load(url)`"的渐进式用法（主流播放器均支持）；且旧默认值 `src: ''` 已经事实上允许空
- **代价**：构造后未 `load()` 时播放器处于空态，需要 UI 兜底

### ADR-4｜为什么保留旧扁平键一版？

- **决策**：`normalizeLegacyConfig` 双轨 + dev 弃用警告，下个大版本移除
- **理由**：`PlayerConfig` 已被 demo、demo-prod、测试广泛使用；一次性破坏会造成大面积改动，不利于定位回归
- **代价**：多一层归一化逻辑（约 60 行）

### ADR-5｜为什么控件用 `boolean | string[] | Record`？

- **决策**：三态联合
- **理由**：
  - `true/false` —— 覆盖"全开/全关"这个 90% 场景
  - `string[]` —— 需要排序或自定义组合时（Plyr/ArtPlayer 的做法）
  - `Record<string, boolean>` —— 只想关掉某几个（最贴近旧 `controlBtns`，迁移成本最低）
- **代价**：解析逻辑要处理三种形态（约 20 行）

### ADR-6｜为什么把 `<video>` 属性透传单列？

- **决策**：`advanced.videoAttrs`
- **理由**：`<video>` 有 40+ 属性，框架不可能全部显式支持；透传通道让用户不必等框架发版
- **参考**：ArtPlayer `moreVideoAttr`、video.js `html5`
- **代价**：透传属性无法参与类型检查（用 `Record<string, string|number|boolean>` 兜底）

### ADR-7｜为什么持久化从隐式改为显式？

- **决策**：`storage: { enabled, key, persist, adapter }`，默认 `enabled: true` 保持行为兼容
- **理由**：当前"仅当用户值恰好等于默认值时才读 localStorage"的判定**违反最小惊讶原则**（显式传 `volume: 1` 会被覆盖）
- **新语义**：**配置优先级最高** —— 用户显式传的值**永不**被存储覆盖；只有用户**未传**的项才从存储恢复
- **代价**：需要区分"用户未传"与"用户传了等于默认的值"，靠 `merge` 时记录 `presentKeys: Set<string>` 实现

### ADR-8｜为什么不引入 JSON Schema / zod 校验？

- **决策**：手写轻量校验（约 80 行）
- **理由**：框架核心追求零运行时依赖（目前仅 `@preact/signals-core`）；校验只在 dev 执行，且只需"未知键 + 枚举值"两类检查
- **代价**：类型定义与校验逻辑是两份（用 `as const` 白名单数组共享枚举值来降低漂移风险）

---

## 附录 A：新旧配置写法对照示例

### 示例 1：最小配置

```ts
// 旧
new VideoPlayer({ src: 'video.mp4' });

// 新（完全等价）
new VideoPlayer({ src: 'video.mp4' });
```

### 示例 2：弹幕 + 控件（暴露浅合并 bug）

```ts
// 旧 —— 会丢失 danmaku.opacity/speed/visible 默认值 ❌
new VideoPlayer({
  src,
  danmaku: { enabled: true },
  controlBtns: { pip: false },     // 还会丢失 viewpoint/quality/eplist
});

// 新 —— 深度合并，不丢默认值 ✅
new VideoPlayer({
  src,
  danmaku: { enabled: true },              // opacity/speed/visible 保留默认
  ui: { controls: { pip: false } },        // 其余控件保留默认
});
```

### 示例 3：完整业务配置

```ts
new VideoPlayer({
  container: '#player',
  src: {
    url: 'https://cdn/main.m3u8',
    type: 'hls',
    backups: ['https://cdn/backup.mp4'],
    // ✅ HLS：不传 qualities！清晰度由 manifest 在 MANIFEST_PARSED 后提供
  },
  poster: 'https://cdn/poster.jpg',

  playback: { autoplay: 'muted', volume: 0.8, playbackRates: [1, 1.5, 2], preload: 'none' },
  loading: { timeout: 20000, retry: { count: 3 }, headers: { Referer: 'https://example.com' } },

  ui: {
    controls: ['play', 'progress', 'time', 'volume', 'quality', 'danmaku', 'setting', 'fullscreen'],
    theme: '#fb7299',
    lang: 'zh-CN',
    tooltips: true,
  },
  interaction: { keyboard: { ArrowRight: 'seekForward', ArrowLeft: 'seekBackward' }, seekStep: 10, wheelVolume: true },

  danmaku: { enabled: true, source: 'https://api/danmaku.xml', opacity: 0.9, engine: 'canvas',
             send: { enabled: true, placeholder: '发个弹幕见证当下' } },
  subtitle: { tracks: [{ lang: 'zh-CN', label: '简体中文', url: '/sub.vtt', default: true }], fontSize: 26 },

  progress: {
    segments: [{ startTime: 0, endTime: 90, text: '开场' }, { startTime: 90, endTime: 300, text: '正片' }],
    preview: { enabled: true, type: 'sprite', thumbnails: [{ url: '/thumb.jpg', interval: 5, width: 160, height: 90, cols: 10 }] },
  },

  plugins: {
    list: [createHlsPlugin(), createDanmakuPlugin()],
    engines: { hls: { maxBufferLength: 30, enableWorker: true } },
  },
  storage: { enabled: true, key: 'my-player', persist: ['volume', 'muted', 'quality'] },
  advanced: { logLevel: 'warn', videoAttrs: { crossOrigin: 'anonymous', disablePictureInPicture: true } },

  callbacks: {
    loadedmetadata: (d) => console.log('时长', d),
    seeked: (t) => console.log('跳转到', t),
    error: (e) => console.error(e),
  },
});
```

---

## 附录 B：字段总览（新结构）

| 命名空间 | 字段数 | 覆盖能力 |
|---|---|---|
| （顶层） | 3 | container / src / poster |
| `playback` | 12 | 自动播放、音量、倍速、循环、preload、playsinline、起播时间… |
| `loading` | 6 | 超时、重试、跨域、凭证、请求头、referrer |
| `ui` | 14 | 控件、主题、语言、i18n、宽高比、tooltip、右键菜单、自动隐藏… |
| `interaction` | 7 | 快捷键（可映射）、点击、双击、步长、滚轮、长按 |
| `danmaku` | 13 | 数据源、渲染引擎、字号、区域、密度、发送面板… |
| `subtitle` | 11 | 轨道列表、默认轨、字号、位置、颜色、描边、背景 |
| `quality` | 5 | 默认、列表、菜单、自动降级 |
| `progress` | 6 | 分段、预览（雪碧图/视频/图）、缓冲、拖拽 |
| `plugins` | 3 | 实例列表、引擎选项、插件选项 |
| `storage` | 4 | 开关、key、持久项白名单、适配器 |
| `ssr` | 3 | 开关、骨架、延迟水合 |
| `advanced` | 4 | 日志、videoAttrs 透传、zIndex… |
| `callbacks` | 40+ | 生命周期 + 21 个媒体事件 + 播放器语义 + DOM 事件 |
| **合计** | **≈ 110** | 对比旧版 20 个扁平字段 |

---

*文档结束。确认设计后再进入实现阶段。*
