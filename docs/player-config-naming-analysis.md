# PlayerConfig 命名审计与改进方案

> 范围：**只审计「命名与属性名」**，不改结构分组、不改代码。
> 结论先行：当前确实是**流派 B（扁平 + 少量分组）**，但命名存在 **17 处问题**，其中 **3 处是语义冲突（会造成真实误用）**。
> 核心建议：确立一条命名总原则 —— **媒体能力项一律沿用 HTMLMediaElement 原生属性名**。

---

## 目录

1. [结论：当前属于流派 B](#一结论当前属于流派-b)
2. [命名审计的四个维度](#二命名审计的四个维度)
3. [命名总原则（本次最重要的建议）](#三命名总原则本次最重要的建议)
4. [严重问题：语义冲突与一物多名（3 类 8 处）](#四严重问题语义冲突与一物多名3-类-8-处)
5. [命名规范问题（缩写 / 单复数 / 保留字）](#五命名规范问题缩写--单复数--保留字)
6. [枚举设计问题](#六枚举设计问题)
7. [其他语义模糊项](#七其他语义模糊项)
8. [与主流播放器的命名对齐对照表](#八与主流播放器的命名对齐对照表)
9. [功能缺口 → 命名建议](#九功能缺口--命名建议)
10. [完整更名总表](#十完整更名总表)
11. [项目级命名规范约定（建议写入 CONTRIBUTING）](#十一项目级命名规范约定建议写入-contributing)
12. [执行建议（分三批）](#十二执行建议分三批)

---

## 一、结论：当前属于流派 B

### 1.1 判定依据

当前 `PlayerConfig`（`types/index.ts:390-432`）的 20 个顶层键：

```
container, src, autoplay, muted, volume, playbackRate, loop, controlBtns,
poster, defaultQuality, playMode, keyboard, progressSegments, playerName,
subtitles, danmaku, ssr, plugins, debug, callbacks
```

对照流派特征：

| 流派特征 | 当前项目 | 判定 |
|---|---|---|
| 顶层直接是功能开关 | ✅ 20 个键全在顶层 | **B** |
| 少数功能自成命名空间 | ✅ 仅 `danmaku` / `ssr` 是对象 | **B** |
| 深层层级 | ✅ 最深 2 层 | **B** |
| 按引擎子系统分组 | ❌ 无 `abr`/`streaming`/`manifest` | 非 A |

**所以：是流派 B，且偏向 B 的「浅分组」端**（只有 2 个命名空间，比 Plyr 的 7 个、DPlayer 的 6 个还浅）。

### 1.2 流派 B 本身没有错，但有个前提

流派 B 的三条隐含要求，当前项目**三条都没满足**：

| 流派 B 前提 | 当前状态 |
|---|---|
| ① 顶层键必须**互不重叠、语义正交** | ❌ 存在 `loop` vs `PlayMode.LOOP`、`controlBtns` vs `controls` 冲突 |
| ② 命名必须**高度统一**（因为全靠名字区分） | ❌ `src`/`url`/`source` 三套、`name`/`label` 两套、单复数混用 |
| ③ 常用项要**沿用用户已知的名字**（HTML/业界惯例） | ❌ `controlBtns` 自造、`eplist` 内部缩写、`pointText` 模糊 |

> **关键判断**：流派 A 靠"层级"隔离歧义，流派 B **只能靠"命名"隔离歧义**。所以对本项目而言，**命名质量直接决定配置可用性** —— 这正是本次审计的价值所在。

---

## 二、命名审计的四个维度

| 维度 | 检查什么 | 例子 |
|---|---|---|
| **D1 一致性** | 同一概念是否只有一个名字；同类字段风格是否统一 | `src` / `url` / `source` 混用 |
| **D2 唯一性** | 不同概念是否用了相同/相近的名字 | `loop` vs `PlayMode.LOOP` |
| **D3 规范性** | 缩写、单复数、保留字、大小写 | `Btn`、`eplist`、`default`、`subtitles` vs `danmaku` |
| **D4 可发现性** | 用户能否**猜到**这个名字；是否沿用业界/HTML 惯例 | `controlBtns` vs `controls` |

---

## 三、命名总原则（本次最重要的建议）

### 原则 1｜媒体能力项一律沿用 HTMLMediaElement 原生属性名 ⭐

**理由**：
1. 用户从 `<video autoplay muted loop poster preload>` 已经熟悉这些名字，**零学习成本**
2. 与「`advanced.videoAttrs` 透传」形成天然一致：同一个名字，既能配顶层选项，也能原生透传
3. 主流播放器全部这么做：video.js 的 `html5` / Aliplayer / Plyr 的媒体项都直接映射 HTML 属性

**适用清单**（当前已有 + 建议补齐）：

| 建议键名 | 来源（HTML 属性） | 当前状态 |
|---|---|---|
| `controls` | `<video controls>` | ⚠️ 现为 `controlBtns`（**应改回 `controls`**） |
| `autoplay` | `<video autoplay>` | ✅ 已对齐 |
| `muted` | `<video muted>` | ✅ 已对齐 |
| `volume` | `HTMLMediaElement.volume` | ✅ 已对齐 |
| `playbackRate` | `HTMLMediaElement.playbackRate` | ✅ 已对齐（不要改成 `speed`） |
| `loop` | `<video loop>` | ✅ 已对齐 |
| `preload` | `<video preload>` | ❌ 缺失，应补 |
| `poster` | `<video poster>` | ✅ 已对齐 |
| `playsinline` | `<video playsinline>` | ❌ 缺失，应补 |
| `crossOrigin` | `<video crossorigin>` | ❌ 缺失，应补 |
| `src` | `<video src>` / `HTMLMediaElement.src` | ✅ 已对齐 |

**这条原则一次性解决了 4 个命名纠结**（`controls` vs `controlBtns`、`playbackRate` vs `speed`、`preload`、`playsinline`）。

### 原则 2｜非媒体概念才自造名字，且自造名字要"自解释"

- 媒体能力 → 抄 HTML（原则 1）
- UI / 交互 / 业务 → 自造，但必须**全拼、无缩写、可朗读**
- 反例：`controlBtns`（缩写 Btn）、`eplist`（缩写 + 私有词）、`pointText`（歧义）

### 原则 3｜配置项用单数，集合字段用复数

| 类型 | 规则 | 例 |
|---|---|---|
| **配置块**（某功能的配置对象） | **单数** | `danmaku`、`subtitle`、`quality`、`progress`、`storage` |
| **集合**（一组同类元素） | **复数** | `tracks`、`segments`、`qualities`、`thumbnails`、`backups` |

当前违反：`subtitles`(复数) 与 `danmaku`(单数) 并列 —— **同一层两个功能块，一个复数一个单数**。

---

## 四、严重问题：语义冲突与一物多名（3 类 8 处）

> 这三类会造成**真实误用**，优先级最高。

### 🔴 类型 1：同名不同义（最危险）

#### 问题 1｜`loop` 与 `PlayMode.LOOP` 同名不同义

```ts
// 顶层
loop?: boolean;              // ← 单个视频循环播放

// 枚举（types/index.ts:351）
export enum PlayMode {
  ORDER = "order",
  LOOP = "loop",             // ← 播放列表循环  ⚠️ 同名！
  SINGLE_LOOP = "singleLoop",
  RANDOM = "random",
}
```

**混淆点**：
- `loop: true` 是"当前视频播完重头再来"
- `PlayMode.LOOP` 是"当前视频播完播列表下一个，列表播完回到第一个"
- **两者语义正交，但名字完全相同**

**更糟的是**：`PlayMode.SINGLE_LOOP`（单曲循环）语义上**等于** `loop: true` —— 一个功能有两种配置方式，用户不知道用哪个。

**建议**：

```ts
// 方案 A（推荐，语义最清晰）：枚举值改为 repeat 系列
export enum PlayMode {
  ORDER = 'order',
  REPEAT_ALL = 'repeatAll',      // 原 LOOP，播放列表循环
  REPEAT_ONE = 'repeatOne',      // 原 SINGLE_LOOP，与顶层 loop 语义重复 → 建议废弃
  SHUFFLE = 'shuffle',           // 原 RANDOM
}
```

或更彻底：**删掉 `PlayMode` 枚举，改用字面量类型**（对齐主流 JW Player 的 `repeat: 'none'|'one'|'all'`）：

```ts
playMode?: 'order' | 'repeatAll' | 'repeatOne' | 'shuffle';
```

**顺带**：应明确文档「`loop` 优先于 `playMode`」，或直接用 `playMode: 'repeatOne'` 取代顶层 `loop`（但 HTML 对齐原则建议保留 `loop`）。

#### 问题 2｜`controlBtns` 与代码中的 `controls` 是同一个东西

**证据**：
- 类型定义：`controlBtns?: ControlBtnConfig`（`types/index.ts:406`）
- 代码使用：`this.props.controls`（`VideoPlayer.ts:472-473`）→ **现有 tsc 报错**：
  ```
  error TS2339: Property 'controls' does not exist on type 'PlayerConfig'
  ```

**分析**：
- `controls` 是 **HTML 原生属性名**（`<video controls>`），也は主流播放器统一用法（Plyr / ArtPlayer / xgplayer / TCPlayer / Aliplayer 全部叫 `controls`）
- `controlBtns` 是自造名，且 `Btn` 是缩写

**建议**：统一为 `controls`（符合原则 1）。这同时消除一个现存编译错误。

#### 问题 3｜`ControlBtnConfig` 与 `ControlConfig` 两个类型一个职责

| 类型 | 定义 | 键 |
|---|---|---|
| `ControlBtnConfig` | `types/index.ts:437` | `prev, next, setting, pip, wide, web`（6） |
| `ControlConfig` | 运行时实际使用 | `prev, next, viewpoint, quality, eplist, setting, pip, wide, web`（9） |

**建议**：合并为一个 `ControlsConfig`，且**键名也要审**：

| 当前键 | 问题 | 建议键名 |
|---|---|---|
| `prev` / `next` | 缩写（previous / next） | `prev`/`next` 业界通用，**保留** |
| `eplist` | 私有缩写（episode list） | **`episodes`** 或 `playlist` |
| `viewpoint` | OK（视角） | 保留 |
| `quality` | OK | 保留 |
| `setting` | 单数（实际是"设置菜单"） | 保留（Plyr 也叫 `settings`，可考虑复数） |
| `wide` | 含义不明（宽屏模式） | **`wideScreen`**（与 `isWideScreen` 状态对齐） |
| `web` | 含义不明（网页全屏） | **`webFullscreen`**（与 `webFullscreenChange` 事件对齐） |
| `pip` | 业界通用缩写 | 保留 |
| `fullscreen` | 缺失（未在控件集合里） | 补 |

> **注**：`wide` / `web` 是内部简写，而项目的状态与事件用的是 `isWideScreen` / `webFullscreenChange`。**配置名必须与状态/事件名对齐**，否则用户要在两套词汇间翻译。

### 🟠 类型 2：一物多名（同一概念多个名字）

#### 问题 4｜资源地址：`src` / `url` / `source` 三套命名

| 位置 | 用的名字 |
|---|---|
| `PlayerConfig.src` | `src` |
| `QualitySource.url` | `url` |
| `SubtitleConfig.src` | `src` |
| `DanmakuConfig.source` | `source` |

**同一概念（资源地址），三个名字**。

**建议**：
- 顶层媒体源：`src`（HTML 对齐，原则 1）
- **子项一律用 `url`**（因为子项是"某条资源的地址"，不是 HTML 属性）
- `DanmakuConfig.source` → **`url`**（或 `src`，但既然子项统一 `url`，就用 `url`）

#### 问题 5｜显示名：`name` / `label`

| 位置 | 用的名字 |
|---|---|
| `QualitySource.name`（`types/index.ts:494`） | `name` |
| `SubtitleConfig.label`（`types/index.ts:509`） | `label` |

**建议**：统一为 **`label`**（`name` 在配置里容易被误解为"标识符/id"；`label` 明确表示"给人看的文本"，也是 `SubtitleTrack` 的 HTML 标准用法）。

#### 问题 6｜单复数不一致：`subtitles` vs `danmaku`

```ts
subtitles?: SubtitleConfig[];   // ← 复数
danmaku?: DanmakuConfig;        // ← 单数
```

**建议**（依原则 3）：两个都改为**单数配置块**
```ts
subtitle?: SubtitleConfigSpace;   // 里面有 tracks: SubtitleTrack[]（复数表示集合）
danmaku?: DanmakuConfig;
```

### 🟠 类型 3：语义重叠的布尔

#### 问题 7｜`DanmakuConfig.enabled` vs `DanmakuConfig.visible`

```ts
enabled: boolean;   // 是否启用弹幕
visible?: boolean;  // 是否显示弹幕
```

两个布尔语义高度重叠，用户会问"我关掉 `visible` 但留着 `enabled` 是什么状态？"

**建议**：明确职责并在**命名上体现差异**：

| 新名 | 语义 |
|---|---|
| `enabled` | 是否**加载**弹幕能力（false 则不加载插件、不请求弹幕数据） |
| `visible` | 是否**显示**（能力已加载，只是隐藏，可随时切回） |

命名上可考虑 `enabled` → **`load`**（或保持 `enabled` + JSDoc 说明），至少要在文档中明确 `enabled: false` 蕴含 `visible: false`。

#### 问题 8｜`SSRConfig.enabled` vs 顶层 `ssr` 存在性

```ts
ssr?: SSRConfig;              // 传了 ssr 对象但 enabled: false 意味着什么？
ssr: { enabled: boolean }     // 又一个 enabled
```

**建议**：`ssr` 有值即启用，删掉冗余 `enabled`（或保留但明确"传对象即启用，`enabled` 仅用于显式关闭"）。

---

## 五、命名规范问题（缩写 / 单复数 / 保留字）

### 问题 9｜`Btn` 缩写不规范

`controlBtns`、`ControlBtnConfig` 用了 `Btn`。业界（甚至 HTML）都写 `button`。**建议全拼 `Button`，且整条链改名**（见问题 2、3）。

### 问题 10｜`eplist` 是私有缩写

`ControlConfig.eplist` 表示"剧集列表"（episode list）。
- 对外部用户完全不可猜
- 主流叫 `playlist`（JW/video.js）或 `episodes`（B站语义）
**建议**：`episodes`。

### 问题 11｜`pointText` 语义模糊

`ProgressSegment.pointText`（`types/index.ts:469`）—— "点文本"是什么？
实际含义是"该分段的文字描述"（B站叫"分段点文案"，YouTube 叫 chapter title）。
**建议**：**`text`**（简洁）或 **`label`**（与原则 5 对齐）。推荐 `label` 以统一"给人看的文本"。

### 问题 12｜`default` 作属性名（JS 保留字）

```ts
SubtitleConfig.default?: boolean;   // types/index.ts:514
```

`default` 是 JS 保留字，作为属性名虽然合法，但：
```ts
const { default: isDefault } = subtitleConfig;   // 必须重命名，可读性差
```
**建议**：**`isDefault`**（布尔前缀，可读）或 `defaultTrack`（在空间层）。

### 问题 13｜`playerName` 语义模糊 + 应走 i18n

```ts
playerName?: string;   // 默认 '嗨哩播放器'
```
- "player name" 是"播放器产品名"还是"用户昵称"？含糊
- 它是 **UI 文案**，理应可翻译（多语言场景必须能改）
**建议**：改为 **`ui.title`**，并纳入 i18n（`ui.i18n.title`）。

### 问题 14｜`PlaybackRate` 枚举成员名不可扩展

```ts
export enum PlaybackRate {
  DOUBLE_SPEED = 2,
  ONE_POINT_FIVE_SPEED = 1.5,
  ONE_POINT_TWO_FIVE_SPEED = 1.25,   // ← 极其啰嗦
  NORMAL_SPEED = 1,
  ZERO_POINT_SEVEN_FIVE_SPEED = 0.75,
  HALF_SPEED = 0.5,
}
```

**致命问题**：想支持 1.75 倍速，成员名叫什么？`ONE_POINT_SEVEN_FIVE_SPEED`？**不可扩展**。

**主流做法**：倍速**就是数字**，不枚举。
- Plyr：`speed: { options: [0.5, 0.75, 1, 1.25, 1.5, 2] }`
- DPlayer：`playbackSpeed: [0.5, 0.75, 1, ...]`
- ArtPlayer / xgplayer：数字数组

**建议**：**删除 `PlaybackRate` 枚举**，改用数字 + 字面量联合：
```ts
type PlaybackRate = number;                            // 或
type CommonPlaybackRate = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;  // 仅作提示
```
配置项保持 `playbackRate?: number`，菜单项 `playbackRates?: number[]`。

### 问题 15｜`QualityLevel` 成员名含义不明、且无法排序/显示

```ts
export enum QualityLevel {
  AUTO = "auto",
  P4K = "4k",        // ← 前缀 P 是什么？Pixel? Progressive? 4K 通常写 UHD/2160p
  P1080 = "1080p",
  P720 = "720p",
  P480 = "480p",
  P360 = "360p",
}
```

两个问题：
1. **成员名 `P4K`/`P1080` 前缀 `P` 无语义**，且 `P4K` 不符合 4K 的通行写法
2. **值是不可排序、不可显示的字符串**：清晰度菜单需要按高低排序、需要显示"1080P 高清"。当前拿 `'1080p'` 字符串**没法排序**（`'1080p' > '720p'` 字符串比较恰好对，但 `'4k'` 会排到 `'1080p'` 前面 —— **错序**）

**主流做法**：用**数字高度**作为清晰度标识
- hls.js：`level.height`（数字）
- Plyr：`quality: { options: [4320, 1440, 1080, 720, 576, 480, 360, 240] }`（数字数组，**可直接排序**）
- video.js + 各 HLS 插件：也是 `height`

**建议**：
```ts
/** 清晰度：用视频高度（像素）标识；0 = 自动 */
type QualityHeight = 0 | 240 | 360 | 480 | 720 | 1080 | 1440 | 2160;

interface QualitySource {
  /** 高度（px），0 表示自动；用于排序与显示 */
  height: QualityHeight | number;
  /** 展示文案，如 '1080P 高清' */
  label?: string;
  url: string;
  ...
}
```
收益：**排序天然正确**、**显示可从 height 推导**（`1080 → '1080P'`）、与 hls.js/Plyr 生态一致。

### 问题 16｜`PlayMode` 值命名见问题 1

---

## 六、枚举设计问题（汇总）

| 枚举 | 位置 | 问题 | 建议 |
|---|---|---|---|
| `PlaybackRate` | `types/index.ts:333` | 成员名不可扩展、语义冗余 | **删除**，用 `number` |
| `QualityLevel` | `types/index.ts:365` | `P` 前缀无语义；字符串值无法排序；`4k` 排序错位 | 改用 **`height: number`** |
| `PlayMode` | `types/index.ts:351` | `LOOP` 与顶层 `loop` 冲突；`SINGLE_LOOP` 与 `loop` 重复 | 值改 `repeatAll`/`repeatOne`/`shuffle`，或改字面量类型 |
| `PlayerConfigEnum` | `packages/player/src/core/events.ts:339` | **与 `PlayerConfig` 双份维护且已漂移**（枚举有 `PRELOAD`/`CONTROLS`/`QUALITIES`/`THEME_COLOR`/`FULLSCREEN` 类型里没有；类型里 `playerName`/`callbacks`/`progressSegments` 枚举里没有） | **删除**，用 `keyof PlayerConfig` |

---

## 七、其他语义模糊项

### 问题 17｜`debug?: boolean` 不如 `logLevel`

```ts
debug?: boolean;   // 开=输出所有日志，关=静默
```
只有两档。主流（dash.js / hls.js / video.js / Shaka）都是多档 `logLevel`。

**建议**：`logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug'`（保留 `debug: true` 作为 `logLevel: 'debug'` 的糖）

### 问题 18｜`keyboard?: boolean` 粒度太粗

主流已对象化：
- xgplayer：`keyboard: { seekStep: 5, volumeStep: 0.1 }`
- Plyr：`keyboard: { focused: true, global: false }`

**建议**：`keyboard?: boolean | { seekStep?: number; volumeStep?: number; map?: HotkeyMap }`

### 问题 19｜`callbacks` 三类事件命名风格混用

当前 `EventListeners`（= `PlayerEvents` 的映射）`types/index.ts:542-601` 里同时有：

| 类别 | 例子 | 风格 |
|---|---|---|
| **媒体元素事件** | `timeupdate`、`loadedmetadata`、`seeked`、`volumechange` | 全小写（**对齐 DOM，正确**） |
| **播放器语义事件** | `qualitychange`、`statechange`、`fullscreenchange`、`pipchange` | 也用全小写（**与 DOM 风格混同**） |
| **生命周期** | `ready`、`mounted`、`destroy` | 单词，无后缀 |
| **DOM 交互** | `click`、`dblclick` | 全小写（对齐 DOM，正确） |

**问题**：`qualitychange` / `statechange` **不是 DOM 事件**，却和 `timeupdate` 用了同样的全小写风格。用户无法从名字判断"这是原生事件还是框架合成的"。

**建议**（不破坏兼容的前提下）：
- **媒体事件**：保持全小写（必须，对齐 DOM）✅
- **播放器语义事件**：统一 `*Change` 驼峰后缀（`qualityChange`、`stateChange`、`fullscreenChange`、`pipChange`）
  - 代价：破坏性变更（`qualitychange` → `qualityChange`）
- **折中方案（推荐）**：命名不动，但在**类型定义中用 JSDoc 分组**（`// ===== 媒体元素事件 =====`），并在文档里列三张表。这样零破坏，且用户查文档时一目了然。

### 问题 20｜`plugins?: Plugin[]` 一字段担两职

```ts
plugins?: Plugin[];   // 到底是"插件实例列表"还是"插件配置"？
```
主流用 `plugins` 表示**配置对象**（TCPlayer `plugins: { hls: {...} }`），用 `pluginOptions`（DPlayer）表示选项。

**建议**：
```ts
plugins?: {
  list?: Plugin[];                                  // 实例列表
  options?: Record<string, Record<string, unknown>>;// 按插件名索引的选项
  engines?: { hls?: {...}; dash?: {...}; flv?: {...} };  // 引擎级选项
};
```

---

## 八、与主流播放器的命名对齐对照表

| 概念 | 本项目当前 | Plyr | ArtPlayer | xgplayer | DPlayer | video.js | 建议 | 是否改名 |
|---|---|---|---|---|---|---|---|---|
| 容器 | `container` | (元素参) | `container` | `id` | `container` | (元素参) | `container` | ✅ 保持 |
| 媒体源 | `src` | `source` | `url` | `url` | `video.url` | `sources` | `src` | ✅ 保持 |
| 封面 | `poster` | `poster` | `poster` | `poster` | `video.pic` | `poster` | `poster` | ✅ 保持 |
| 自动播放 | `autoplay` | `autoplay` | `autoplay` | `autoplay` | `autoplay` | `autoplay` | `autoplay` | ✅ 保持 |
| 静音 | `muted` | `muted` | `muted` | — | — | `muted` | `muted` | ✅ 保持 |
| 音量 | `volume` | `volume` | `volume` | `volume` | `volume` | `volume` | `volume` | ✅ 保持 |
| 倍速 | `playbackRate` | `speed.selected` | — | — | `playbackSpeed` | `playbackRates` | `playbackRate` | ✅ 保持（HTML 名） |
| 倍速菜单 | ❌ 缺 | `speed.options` | — | `playbackRate` | `playbackSpeed` | `playbackRates` | `playbackRates` | ➕ 新增 |
| 循环 | `loop` | `loop.active` | `loop` | `loop` | `loop` | `loop` | `loop` | ✅ 保持 |
| 控件 | `controlBtns` ⚠️ | `controls` | `controls` | `controls` | — | `controls` | **`controls`** | 🔴 **必改** |
| 预加载 | ❌ 缺 | — | `preload` | `preload` | `preload` | `preload` | `preload` | ➕ 新增 |
| 内联播放 | ❌ 缺 | — | `playsInline` | `playsinline` | — | — | `playsinline` | ➕ 新增 |
| 清晰度 | `defaultQuality` | `quality.default` | `quality` | — | `video.defaultQuality` | — | `quality.default` | 🟠 建议改 |
| 播放模式 | `playMode` | — | — | — | — | — | `playMode` | ⚠️ 值要改 |
| 快捷键 | `keyboard` | `keyboard` | `hotkey` | `keyboard` | `hotkey` | — | `keyboard` | ✅ 保持 |
| 弹幕 | `danmaku` | — | `danmaku` | `danmaku` | `danmaku` | — | `danmaku` | ✅ 保持 |
| 字幕 | `subtitles`(数组) | — | `subtitle` | — | `subtitle` | `tracks` | **`subtitle`** | 🟠 单数化 |
| 进度分段 | `progressSegments` | — | — | — | — | — | `progress.segments` | 🟠 命名空间化 |
| 缩略图预览 | ❌ 缺 | `previewThumbnails` | — | `progressPreview` | `video.thumbnails` | — | `progress.preview.thumbnails` | ➕ 新增 |
| 主题色 | ❌ 缺 | — | `theme` | — | `theme` | — | `ui.theme` | ➕ 新增 |
| 语言 | ❌ 缺 | `i18n` | `lang` | `lang` | `lang` | `language` | `ui.lang` + `ui.i18n` | ➕ 新增 |
| 存储 | ❌ 隐式 | `storage` | — | — | — | — | `storage` | ➕ 新增 |
| 日志 | `debug` | — | — | — | — | — | `advanced.logLevel` | 🟠 建议改 |
| 事件 | `callbacks` | `listeners` | — | — | — | — | `callbacks` 或 `listeners` | ⚪ 可选 |
| 属性透传 | ❌ 缺 | `html5`(video.js) | `moreVideoAttr` | — | — | `html5` | `advanced.videoAttrs` | ➕ 新增 |
| 插件选项 | ❌ 缺 | — | — | — | `pluginOptions` | — | `plugins.options` / `plugins.engines` | ➕ 新增 |
| 宽高比 | ❌ 缺 | `ratio` | — | — | — | `aspectRatio` | `ui.ratio` | ➕ 新增 |
| 右键菜单 | ❌ 缺 | — | — | — | `contextmenu` | — | `ui.contextmenu` | ➕ 新增 |
| 点击播放 | ❌ 缺 | `clickToPlay` | — | `closeVideoClick`(反向) | — | — | `interaction.clickToPlay` | ➕ 新增 |

**统计**：命名需改 **5 处**（`controlBtns`/`defaultQuality`/`subtitles`/`progressSegments`/`playMode 值`），需新增 **13 处**，其余 **保持**。

> 值得一提的是 xgplayer 的 `closeVideoClick` —— **反向命名**（"关闭视频点击"而不是"启用点击播放"）。这是主流里的**反面教材**：否定式命名会让调用方写 `closeVideoClick: false` 来表达"启用"，双重否定。**建议本项目一律用正向命名**。

---

## 九、功能缺口 → 命名建议

除前文已列的，还建议评估以下主流特性的命名（按优先级）：

| 优先级 | 功能 | 建议命名 | 参考 |
|---|---|---|---|
| P0 | 预加载策略 | `playback.preload` | HTML 属性 |
| P0 | 移动端内联 | `playback.playsinline` | HTML 属性 |
| P0 | 持久化开关 | `storage.enabled` / `storage.key` / `storage.persist` | Plyr |
| P0 | 属性透传 | `advanced.videoAttrs` | ArtPlayer `moreVideoAttr` |
| P0 | 引擎选项 | `plugins.engines.hls` / `.dash` / `.flv` | DPlayer `pluginOptions.hls` |
| P1 | 主题色 | `ui.theme` | ArtPlayer/DPlayer |
| P1 | 多语言 | `ui.lang` + `ui.i18n` | Plyr `i18n` |
| P1 | 宽高比 | `ui.ratio` | Plyr `ratio` |
| P1 | 起播时间 | `playback.startTime` | 业界通用 |
| P1 | 进度条预览缩略图 | `progress.preview.thumbnails` | Plyr `previewThumbnails` |
| P1 | 自动隐藏控制栏延迟 | `ui.autoHideDelay` | 业界通用 |
| P1 | 加载超时/重试 | `loading.timeout` / `loading.retry` | hls.js 风格 |
| P2 | 跨域 / 凭证 / 请求头 | `loading.crossOrigin` / `.withCredentials` / `.headers` | hls.js `xhrSetup` 思路 |
| P2 | 长按加速 | `interaction.longPressRate` | B站/YouTube |
| P2 | 播放结束行为 | `playback.onEnded` | JW `repeat` |
| P3 | 互斥播放 | `interaction.mutex` | DPlayer `mutex` |
| P3 | 截图 | `ui.screenshot` | DPlayer `screenshot` |
| P3 | 画中画/全屏能力开关 | `ui.controls.pip` / `.fullscreen` | 已在控件集合里 |

---

## 十、完整更名总表

> 「破坏性」= 是否需要用户改代码。

### A. 必改（语义冲突或规范错误）

| # | 现名 | 新名 | 理由 | 破坏性 |
|---|---|---|---|---|
| 1 | `controlBtns` | **`controls`** | 对齐 HTML 属性与全部主流播放器；`Btn` 缩写不规范；代码里已在用 `controls` | 🔴 是 |
| 2 | `ControlBtnConfig` | **`ControlsConfig`** | 同上，且与运行时 `ControlConfig` 合并 | 🔴 是 |
| 3 | `PlayMode.LOOP` | **`PlayMode.REPEAT_ALL`** | 与顶层 `loop` 同名不同义 | 🔴 是 |
| 4 | `PlayMode.SINGLE_LOOP` | **删除**（用 `loop: true`） | 与顶层 `loop` 功能重复 | 🔴 是 |
| 5 | `PlayMode.RANDOM` | **`SHUFFLE`** | 更符合播放列表语义（Spotify/iTunes 均用 shuffle） | 🔴 是 |
| 6 | 控件键 `eplist` | **`episodes`** | 私有缩写 | 🔴 是 |
| 7 | 控件键 `wide` | **`wideScreen`** | 与状态 `isWideScreen` 对齐 | 🔴 是 |
| 8 | 控件键 `web` | **`webFullscreen`** | 与事件 `webFullscreenChange` 对齐 | 🔴 是 |
| 9 | `PlaybackRate`（枚举） | **删除 → `number`** | 成员名不可扩展 | 🔴 是 |
| 10 | `QualityLevel.P4K/P1080/...` | **`height: number`** | 无法排序；`P` 前缀无语义；**且枚举根本无法表达 manifest 的任意档位（如 540 / 1920x800）** | 🔴 是 |
| 11 | `SubtitlesConfig.src` | **`url`** | 与其他资源字段统一 | 🟠 是（局部） |
| 12 | `DanmakuConfig.source` | **`url`** | 同上 | 🟠 是（局部） |
| 13 | `QualitySource.name` | **`label`** | 与 `SubtitleConfig.label` 统一 | 🟠 是（局部） |
| 14 | `ProgressSegment.pointText` | **`label`** | 语义模糊 | 🟠 是（局部） |
| 15 | `SubtitleConfig.default` | **`isDefault`** | `default` 是保留字，解构不便 | 🟠 是（局部） |

### B. 建议改（提升一致性）

| # | 现名 | 新名 | 理由 | 破坏性 |
|---|---|---|---|---|
| 16 | `subtitles` | **`subtitle`** | 与 `danmaku` 单复数统一 | 🟠 是 |
| 17 | `defaultQuality` | **`quality.default`** | 去冗余前缀 | 🟠 是 |
| 18 | `progressSegments` | **`progress.segments`** | 命名空间化 | 🟠 是 |
| 19 | `playerName` | **`ui.title`** | 语义明确 + 可 i18n | 🟠 是 |
| 20 | `debug` | **`advanced.logLevel`** | 多档日志 | 🟠 是 |
| 21 | `keyboard`(布尔) | **`interaction.keyboard`（可对象）** | 支持步长配置 | 🟠 是 |
| 22 | `plugins: Plugin[]` | **`plugins.list` + `.options` + `.engines`** | 一字段两职责 | 🟠 是 |
| 23 | `ProgressSegment.element` 等 7 个 DOM 字段 | **从公开类型移除** | 实现泄漏 | 🟠 是 |
| 24 | `PlayerConfigEnum` | **删除** | 与类型双份维护且已漂移 | 🟠 是 |
| 25 | `cc` | `SSRConfig.enabled` | 传对象即启用，冗余 | ⚪ 低 |

### C. 保持不动（已经很好）

| 现名 | 说明 |
|---|---|
| `container` | 与主流一致 |
| `src` | HTML 属性名 |
| `poster` | HTML 属性名 |
| `autoplay` / `muted` / `volume` / `loop` / `playbackRate` | 全部 HTML 属性名 ✅ |
| `danmaku` | 与 ArtPlayer/DPlayer/xgplayer 一致 |
| `ssr` | 业界通用缩写 |
| `playMode` | 键名 OK（仅枚举值要改） |
| `QualitySource.url` / `.width` / `.height` / `.bitrate` | 业界通用 |
| `SubtitleConfig.lang` / `.label` / `.track` | `lang`/`label` 是 WebVTT `<track>` 标准属性 ✅ |
| `EventListeners` 里的 21 个媒体事件名 | 必须保持（对齐 DOM） |

---

## 十一、项目级命名规范约定（建议写入 CONTRIBUTING）

```markdown
## 配置项命名规范

### 1. 媒体能力项 → 沿用 HTMLMediaElement 属性名
   controls / autoplay / muted / volume / playbackRate / loop / preload /
   poster / playsinline / crossOrigin / src
   ✅ 理由：用户零学习成本，且与 advanced.videoAttrs 透传保持一致

### 2. 配置块用单数，集合用复数
   配置块：danmaku / subtitle / quality / progress / storage / interaction
   集合：  tracks / segments / qualities / thumbnails / backups / playbackRates

### 3. 禁止非通用缩写
   ❌ Btn / eplist / cfg / evt / src(作为子项字段) / idx
   ✅ Button / episodes / config / event / url / index
   例外（业界通用，允许）：src / id / url / html / css / api / lang / pip / ssr

### 4. 避免 JS 保留字作属性名
   ❌ default / class / for / in / new
   ✅ isDefault / className / htmlFor / ...

### 5. 一律正向命名，禁止否定式
   ❌ closeVideoClick / disableControls / noAutoplay
   ✅ clickToPlay / controls: false / autoplay: false

### 6. 布尔项用裸形容词（不加 is/has 前缀）
   ✅ enabled / visible / muted / loop / draggable
   ❌ isEnabled / hasVisible
   例外：当裸词有歧义时（如 default）用 isDefault

### 7. 时间/尺寸单位要能从名字读出
   秒：startTime / endTime / duration
   毫秒：*Delay / *Timeout / autoHideDelay
   像素：*Width / *Height / fontSize
   ⚠️ 同一字段不要混用单位（建议毫秒统一加 Ms 后缀或全部用毫秒）

### 8. 字段名必须与状态/事件名对齐
   配置 ui.controls.webFullscreen
     ↔ 状态 player.isWebFullscreen
     ↔ 事件 PlayerEventEnum.WEB_FULLSCREEN_CHANGE
   ❌ 不要出现配置叫 web、状态叫 isWebFullscreen 的两套词汇

### 9. 子项资源地址统一用 url
   顶层媒体源用 src（HTML 属性）
   子项（清晰度/字幕/弹幕/缩略图）一律用 url

### 10. 事件回调命名
   媒体元素事件：全小写，严格对齐 DOM（timeupdate / loadedmetadata / seeked）
   播放器语义事件：建议 *Change 驼峰（qualityChange / stateChange）
   生命周期：ready / mounted / destroy
```

---

## 十二、执行建议（分三批）

### 第 1 批：消除语义冲突（必做，约 6 处）

覆盖问题 1-3、6-8 的键名冲突：
- `controlBtns` → `controls`（顺带修掉现存 tsc 报错）
- `ControlBtnConfig` + `ControlConfig` → `ControlsConfig`
- 控件键 `eplist`/`wide`/`web` → `episodes`/`wideScreen`/`webFullscreen`
- `PlayMode` 值 `LOOP`/`SINGLE_LOOP`/`RANDOM` → `REPEAT_ALL`（删 SINGLE_LOOP）/`SHUFFLE`

**验收**：类型检查通过、`loop` 与 `playMode` 语义不再混淆。

### 第 2 批：统一命名资产（建议，约 12 处）

- 资源地址统一 `url`（字幕/弹幕）
- 显示名统一 `label`（清晰度/分段）
- `default` → `isDefault`
- 单复数统一（`subtitles` → `subtitle`）
- 删 `PlaybackRate` 枚举 → 数字
- `QualityLevel` → `height: number`
- 删 `PlayerConfigEnum`
- `debug` → `logLevel`
- `playerName` → `ui.title`

### 第 3 批：补齐缺失命名 + 落地规范

- 新增 P0 配置（`preload`/`playsinline`/`storage`/`videoAttrs`/`plugins.engines`）
- 把第十一章的规范写入 `CONTRIBUTING.md`
- 加 ESLint 自定义规则或 CI 检查（配置键命名规范可做一个简单的 key 白名单测试）

### 兼容策略

第 1、2 批都是破坏性更名 → 必须**双轨兼容一期**：
- 新增 `normalizeLegacyConfig(userConfig)`：把旧键就地归一化到新键
- dev 下对每个旧键输出一次 deprecation 警告
- 下个大版本移除

---

## 附录：一页速查

```
🔴 必改（语义冲突）
   controlBtns → controls            （HTML 属性名 + 代码已在用 controls）
   PlayMode.LOOP → REPEAT_ALL        （与顶层 loop 同名不同义）
   PlayMode.SINGLE_LOOP → 删除        （与顶层 loop 功能重复）
   控件 eplist → episodes
   控件 wide → wideScreen / web → webFullscreen（与状态/事件名对齐）
   PlaybackRate 枚举 → number        （成员名不可扩展）
   QualityLevel → height: number     （可排序，对齐 hls.js/Plyr）

🟠 建议改（一致性）
   src/url/source 三套 → 顶层 src + 子项 url
   name/label 两套 → 统一 label
   pointText → label
   default → isDefault（保留字）
   subtitles → subtitle（单复数统一）
   playerName → ui.title（可 i18n）
   debug → logLevel
   keyboard 布尔 → 可对象
   plugins: Plugin[] → plugins.{list,options,engines}

✅ 保持（已符合约定）
   container / src / poster / autoplay / muted / volume / playbackRate /
   loop / danmaku / ssr / lang / label / url / width / height / bitrate /
   21 个媒体事件名

⭐ 总原则
   媒体能力项一律沿用 HTMLMediaElement 原生属性名
```

*分析结束。确认后进入实现。*
