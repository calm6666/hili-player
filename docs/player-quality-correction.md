# 播放器清晰度与控件配置设计（权威合并版）

> ## 修订说明
>
> 本文由两份文档合并而来，是**唯一权威版本**：
> 1. `docs/player-controls-quality-design.md`（早期「控件与能力配置设计」分析，其中**清晰度相关结论已被推翻**）；
> 2. `docs/player-quality-correction.md`（修正版，**本文以此为主线**）。
>
> **被废弃的关键错误结论（一句话）**：早期文档认为「清晰度列表来自 `src.qualities`，菜单按 `src.qualities.length > 1` 在**配置解析期**推导」——**这是错的**。清晰度列表是**运行时由 provider 发现**的：MP4 来自配置的多文件、HLS 来自 m3u8/manifest、DASH 来自 mpd/manifest；菜单显隐由**运行时列表长度**推导。**请勿再按旧结论改代码。**
>
> 阅读指引：
> - **第一部分**（清晰度）：保留修正版的完整论证、代码证据、缺陷汇总与实施顺序，是清晰度设计的唯一依据。
> - **第二部分**（控件与能力）：吸收早期文档中**仍然有效**的控件推导模型、prev/next 按钮、`DisplayMode` 互斥枚举等设计（这部分未被否定）。

---

# 第一部分 · 清晰度设计（运行时发现模型）

> 本文修正的核心：早期设计把「清晰度」当成**静态的用户输入数据**，而实际上它有**三种来源**，其中两种是**运行时由 manifest 发现的**。

## 一、先承认错误：错在哪

### 1.1 我上一版的错误假设

```
❌ 错误假设：清晰度列表 = 用户配置数据
             → 所以「列表从 src.qualities 来，菜单按 length > 1 推导」

✅ 实际情况：清晰度列表有 3 种来源，用户只控制其中 1 种
```

### 1.2 三种来源的本质差异

| 源类型 | 清晰度从哪来 | 用户是否传 | 谁负责切档 | 何时可知 |
|---|---|---|---|---|
| **MP4 单文件** | 无（只有 1 档） | ❌ 不传 | — | 立即 |
| **MP4 多文件** | **用户提供的多个 URL** | ✅ **要传** | **框架**（换 `video.src`） | 立即 |
| **HLS (.m3u8)** | **manifest 的 `EXT-X-STREAM-INF`** | ❌ **不传** | **hls.js**（`hls.currentLevel`） | **`MANIFEST_PARSED` 后** |
| **DASH (.mpd)** | **manifest 的 `AdaptationSet/Representation`** | ❌ **不传** | **dash.js**（`setQualityFor`） | **`STREAM_INITIALIZED` 后** |

### 1.3 错误导致的连锁问题

我上一版的设计会产生四个具体错误：

| # | 我写的 | 错在哪 |
|---|---|---|
| 1 | `quality.showMenu` 按 `src.qualities.length > 1` 推导 | HLS/DASH 没有 `src.qualities` → **菜单永远不显示**（哪怕 manifest 有 8 档） |
| 2 | `quality.include?: number[]` 过滤"自动识别的列表" | 对 HLS/DASH **无从过滤**（列表在运行时才有），对 MP4 又和 manifest 无关 |
| 3 | `quality.default: 1080` 当作"精确档标识" | HLS manifest 里可能是 1080/720/480，也可能是 1080/540/360 —— **找不到精确 1080 时行为未定义** |
| 4 | 认为「清晰度菜单的显示与否」可在**配置解析期**决定 | HLS/DASH 的清晰度**在 `MANIFEST_PARSED` 之前根本未知** → 必须**运行时**推导 |

**根因**：把「清晰度」当成配置数据，而它本质是**运行时能力（runtime capability）**。

### 1.4 代码证据：项目里**已经存在**运行时清晰度模型（但没接上）

你的判断不是理论偏好 —— **项目现有代码已经按「运行时发现」实现了**，只是 `VideoPlayer` 没接上。

**证据 1｜插件已经在运行时发现清晰度** ✅

`packages/plugins/src/hls/HlsPlugin.ts:758-780`
```ts
getQualities(): QualityLevel[] {
  if (!this.hlsPlayer) return [];
  return this.hlsPlayer.levels.map((level, index) => ({   // ← 运行时从 hls.js 取
    id: String(index),
    label: level.height ? `${level.height}p` : `Level ${index}`,
    width: level.width, height: level.height, bitrate: level.bitrate,
  }));
}
setQuality(quality: string): void {
  const level = quality === 'auto' ? -1 : Number(quality);
  this.hlsPlayer.currentLevel = level;                    // ← 交给 hls.js 切档
}
```
`DashPlugin.ts:621-640` 同理（从 `Representation` 读 `bandwidth`，用 `setQualityFor` 切）；
`FlvPlugin.ts:629` 是存根（FLV 不支持多码率）。

**→ 三个插件**都已经实现了"运行时发现 + 库内切档"，**根本不需要用户传清晰度列表**。

**证据 2｜中间件已经把调用转发给插件** ✅

`packages/player/src/utils/media/streamMiddleware.ts:108-120`
```ts
getQualities(): QualityLevel[] {
  if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
    return this.activePlugin.getQualities();     // ← 已转发
  }
  return [];
}
setQuality(quality: string): void {
  if (this.mode === PlayerMode.STREAMING && this.activePlugin) {
    this.activePlugin.setQuality(quality);       // ← 已转发
  }
}
```

**证据 3｜Store 里已经有"运行时可用清晰度"状态** ✅

`packages/player/src/store/playerStore.ts:675-678`
```ts
setAvailableQualities(qualities: QualityOption[]): void {
  runtimeState = { ...runtimeState, availableQualities: qualities };
  notify(StateKeyEnum.available_qualities, qualities, []);
}
```
配 `runtimeState.availableQualities`（`state.ts:131` 初始 `[]`）+ `StateKeyEnum.available_qualities`（`enums.ts:94`）。

**→ 这正是我设计里 `player.qualities` 的等价物，而且已经在 runtime state 里、不在配置里** —— 与你的判断完全一致。

**证据 4｜`QualityOption.qn` 本来就是数字** ✅

`packages/player/src/store/types.ts:13-22`
```ts
export interface QualityOption {
  qn: number;          // ← 数字标识（不是枚举！）
  name: string;
  description: string;
  codec: string;
}
```

---

#### 但是发现两个真实缺陷（必须修）

**缺陷 A｜`setAvailableQualities` 从未被调用 —— 是死代码** 🔴

全仓库搜索：`setAvailableQualities` 只有**定义处**，**没有任何调用点**。
→ Store 的 `availableQualities` 永远是 `[]`，清晰度菜单**拿不到数据**。
→ **需要在 `MANIFEST_PARSED`（HLS）/ `STREAM_INITIALIZED`（DASH）后从中间件拉取并写入**。

**缺陷 B｜`VideoPlayer.setQuality()` 走的是换 `src` 的路径，没走中间件** 🔴

`packages/player/src/player/VideoPlayer.ts:1196-1236`
```ts
setQuality(quality: QualityLevel): void {
  ...
  if (this.videoEl) {
    this.videoEl.src = this.getCurrentSourceUrl();   // ❌ 换成重新设 src
    this.videoEl.currentTime = currentTime;          // ❌ 手动回填进度
    if (wasPlaying) void this.play();
  }
  ...
}
```
全文件搜索 `streamMiddleware`：**9 处，但没有一处在 `setQuality` 里**。

**后果**：在 HLS / DASH 模式下调用 `setQuality()`：
- 不会调 `hls.currentLevel` / `dash.setQualityFor`
- 而是**把 manifest URL 重新赋给 `videoEl.src`** → **整条流重新加载**（黑屏、重新起播、丢掉 hls.js 已缓冲数据）
- 同时 hls.js/dash.js 实例还挂在旧 media element 上 → 状态错乱

**→ 这两条缺陷正好印证你的批评**：清晰度**必须**走「插件运行时」路径，而不是「配置里的列表 + 玩家自己换 src」路径。

**证据 5｜正确模型**就是**项目自己的原始设计** —— `QualityLevel` 有**两个同名类型** 🔴

| 文件 | 定义 | 形态 | 用途 |
|---|---|---|---|
| `types/streamPlugin.ts:104` | `export interface QualityLevel` | **运行时档位**：`{ id, label, width, height, bitrate }` | ✅ **正是"运行时发现"模型** |
| `types/index.ts:365` | `export enum QualityLevel` | **静态枚举**：`AUTO/P4K/P1080/P720/P480/P360` | ❌ 老模型，**假设档位预先已知** |

而且 **`types/streamPlugin.ts` 的 `StreamPlugin` 契约里就有清晰度方法**（第 169、175 行）：
```ts
export interface StreamPlugin extends Plugin {
  ...
  getQualities(): QualityLevel[];      // ← 返回运行时发现的档位（interface 版）
  setQuality(quality: string): void;   // ← 字符串标识：索引 或 'auto'
}
```

**→ 结论：项目原本的设计（`types/streamPlugin.ts`）就是「运行时发现」的，与我上一版的错误设计相反，与你的判断一致。**
我上一版的 `src.qualities` 方案，等于**退回**到了那个更差的 `types/index.ts` 枚举模型。

**证据 6｜`StreamPlugin` 也有两个同名定义，公开的那个是残缺的** 🔴

| 文件 | 有无 `getQualities`/`setQuality` | 谁在用 |
|---|---|---|
| `types/streamPlugin.ts:118` | ✅ **有** | `pluginManager.ts`、`streamMiddleware.ts`、`VideoPlayer.ts`、三个插件**全部**用它 |
| `packages/plugins/src/stream/types.ts:86` | ❌ **没有** | 仅被 `packages/plugins/src/index.ts:32` **re-export** |

**后果**：外部使用者写
```ts
import type { StreamPlugin } from '@hili-player/plugins';
const p: StreamPlugin = new HlsPlugin(...);
p.getQualities();   // ❌ 类型报错：属性不存在
```
→ **包的公开类型契约比实际实现少两个方法**。这是必须修的**契约缺口**。

---

### 1.5 缺陷汇总（证据驱动）

| # | 缺陷 | 位置 | 严重性 | 说明 |
|---|---|---|---|---|
| 1 | `setAvailableQualities()` **从未被调用** | `playerStore.ts:675` | 🔴 P0 | Store 的 `availableQualities` 永远是 `[]` → 菜单无数据 |
| 2 | `setQuality()` 不调中间件，直接换 `videoEl.src` | `VideoPlayer.ts:1215-1222` | 🔴 P0 | HLS/DASH 下切档 = **重新加载整条流**，不走 `hls.currentLevel` |
| 3 | `setQuality(quality: QualityLevel)` 用的是**枚举版** | `VideoPlayer.ts:1196` | 🔴 P0 | 与中间件/插件产出的**interface 版**类型不同名同 → 无法直接传递 |
| 4 | `packages/plugins` 导出的 `StreamPlugin` 缺清晰度方法 | `stream/types.ts:86` | 🟠 P1 | 公开类型契约与实现不符 |
| 5 | `processSources()` 把备用源标成 `QualityLevel.P1080` | `VideoPlayer.ts:432` | 🟠 P1 | 备用源不是清晰度，语义错误 |
| 6 | **清晰度列表在 `RightControls` 里是硬编码空数组** | `RightControls.ts:56` | 🔴 P0 | `const qualities: QualityItem[] = [];` —— **永不填充**，菜单必然空 |
| 7 | 清晰度状态与清晰度列表**未接通** | 全链路 | 🔴 P0 | 插件 → 中间件（通）→ ？Store（断）→ UI（空数组） |

**链路缺口图示**（每一环都标注了实际代码）：

```
HlsPlugin.getQualities()          ✅ 已实现（HlsPlugin.ts:758）
        ↓
StreamMiddleware.getQualities()   ✅ 已转发（streamMiddleware.ts:108）
        ↓
VideoPlayer                       ❌ 从不调用中间件的 getQualities()
        ↓
store.setAvailableQualities()     ❌ 定义了但从不调用（playerStore.ts:675）
        ↓
RightControls: qualities = []     ❌ 硬编码空数组（RightControls.ts:56）
        ↓
QualityMenu                       ❌ 永远渲染空菜单
```

**→ 7 个缺陷里有 3 个（#1 #6 #7）都在"最后一公里"：插件侧一切就绪，UI 侧一根线都没接。**

---

## 二、由此推出的四条设计原则

### 原则 1｜`quality` 配置块**只描述行为偏好，绝不承载列表**

```ts
quality: {
  default?: number | 'auto',   // 倾向
  max?: number,                // 限制
  min?: number,
  labels?: ...,                // 文案
  autoFallback?: boolean,      // 行为
  // ❌ 绝对不能有 list / include / qualities
}
```

**理由**：列表的来源是**源自身的属性**（MP4 的多个文件 / manifest 的内容），不是用户的偏好。

### 原则 2｜清晰度列表是**运行时状态**，不是配置

```ts
// 运行时读取（不区分来源）—— 复用已有 StreamMiddleware.getQualities()
player.getQualities(): QualityLevel[];
// 运行时状态（可被 effect 订阅，驱动菜单更新）
// 复用已有 store.runtimeState.availableQualities
state.signal('availableQualities')    // QualityLevel[]
state.signal('qualityMode')           // 'none' | 'static' | 'adaptive'  🆕
```

### 原则 3｜菜单显示**由运行时列表推导**，时机是「列表就绪后」

```
初始 → availableQualities = []   → 菜单不显示
       ↓ 加载源
MP4 多变体 → 立即可知             → 若 length > 1 显示
HLS/DASH  → MANIFEST_PARSED 后    → 若 length > 1 显示
单档 MP4  → length === 1          → 不显示
```

**推论**：菜单是**异步出现**的，UI 要做好"从无到有"的过渡（不能假设初始就有）。

### 原则 4｜切档统一走**已有插件契约**，框架不关心底层是换 src 还是设 level

> 原本拟的 `QualityController` **不新建** —— 已有 `StreamPlugin.getQualities()/setQuality()` 就是它（见 §1.4 证据 5）。
> 只需给 `StreamPlugin` 补 `onQualitiesChange` / `supportsAutoQuality` / `applyQualityLimits`。
> MP4 多变体则新增一个实现同样形状的 `NativeQualityAdapter`。

| 源类型 | 提供方 | `setQuality` 底层动作 |
|---|---|---|
| HLS | `HlsPlugin`（**已有**） | `hls.currentLevel = Number(id)`；auto → `-1` |
| DASH | `DashPlugin`（**已有**） | `setQualityFor('video', idx)` |
| FLV | `FlvPlugin`（**已有**，存根） | 不支持多码率 |
| MP4 多变体 | `NativeQualityAdapter`（🆕） | 换 `video.src` + 保留 `currentTime` |

---

## 三、修正后的完整设计

### 3.1 `src`：描述「一路媒体」，清晰度变体仅对 MP4 有意义

> **由现有 `QualitySource`（`types/index.ts:488`）演进而来**，改动三处：
>
> | 现状 | 改为 | 理由 |
> |---|---|---|
> | 类型名 `QualitySource` | **`ProgressiveVariant`** | 现名让人以为"这是配清晰度的唯一方式"，**正是被批评的误导**；新名明确"仅渐进式" |
> | `quality: QualityLevel`（**必填枚举**） | **删除**（改用 `height?`） | 枚举无法表达任意档位（见 §3.8）；且与 `height` 字段重复 |
> | `name: string` | **`label?: string`** | 与 `SubtitleConfig.label` 统一（命名分析 #13 已定） |
> | `width?` | 删除 | 高度是唯一必要维度；宽度可由比例推导 |
>
> 备选名：`Mp4Quality` / `StaticQuality`。选 `ProgressiveVariant` 是因为它对齐业界术语（HLS 规范称 `EXT-X-STREAM-INF` 为 variant）。

```ts
/** 支持的流类型 */
export type StreamType = 'auto' | 'mp4' | 'hls' | 'dash' | 'flv' | 'webrtc';

/**
 * 渐进式（MP4）清晰度变体
 * ⚠️ **仅 MP4 需要手填**；HLS/DASH 由 manifest 在运行时提供，**不要传**
 */
export interface ProgressiveVariant {
  /** 文件地址 */
  url: string;
  /** 视频高度（px），既是标识也是排序/降级依据 */
  height?: number;
  /** 码率 bps（可选） */
  bitrate?: number;
  /** 展示文案（不传由 height 推导）；与 height 至少给一个 */
  label?: string;
}

/**
 * 媒体源
 */
export interface MediaSource {
  /** 播放地址（单文件或多变体时用 url + qualities 二选一） */
  url?: string;
  /**
   * 流类型
   * @default 'auto'（按 URL 后缀 / Content-Type 推断：.m3u8→hls, .mpd→dash, .flv→flv, 其他→mp4）
   */
  type?: StreamType;
  /**
   * 渐进式多清晰度变体
   * ⚠️ **仅 MP4 使用**。HLS/DASH 不要传（清晰度由 manifest 决定，传了也会被忽略并给出开发警告）
   */
  qualities?: ProgressiveVariant[];
  /** 起播时间（秒） */
  startTime?: number;
  /** 该源专属请求头 */
  headers?: Record<string, string>;
  /** 该源专属 drm 配置（预留） */
  drm?: Record<string, unknown>;
}

/** 源输入 */
export type SourceInput =
  | string                 // 单 URL
  | MediaSource            // 结构化
  | MediaSource[];         // ⚠️ 备用源（failover），**不是清晰度列表**
```

**关键区分**（必须在文档里讲清，这是最容易混的地方）：

| 写法 | 语义 | 用途 |
|---|---|---|
| `src: 'a.mp4'` | 单源 | 最常见 |
| `src: { url: 'a.m3u8' }` | HLS 单源（清晰度由 manifest 来） | 自适应流 |
| `src: { type: 'mp4', qualities: [v1, v2, v3] }` | **MP4 三档清晰度** | 渐进式多档 |
| `src: [s1, s2]` | **两个备用源**（s1 失败切 s2） | 容灾，**不是清晰度** |

### 3.2 `quality`：**只有行为偏好**

```ts
export interface QualityConfig {
  /**
   * 默认清晰度倾向
   * - 'auto'：自适应（HLS/DASH 启用 ABR；MP4 取最高档）
   * - 数字：**倾向**该高度 —— 存在精确档则用它；
   *        不存在则取「不超过该值的最高档」（可通过 strict 改为不降级）
   * @default 'auto'
   * @since 支持运行时修改：player.setQuality(...)
   */
  default?: number | 'auto';

  /**
   * 严格模式：目标高度不存在时**不降级**（保持 auto 或当前档）
   * @default false（就近降级）
   */
  strict?: boolean;

  /**
   * 清晰度上限（像素高度）
   * 映射：HLS → hls.autoLevelCapping；DASH → abr.maxBitrate；MP4 → 过滤列表
   * @default undefined
   */
  max?: number;

  /** 清晰度下限 @default undefined */
  min?: number;

  /**
   * 是否显示清晰度菜单
   * - 'auto'：**运行时**检查有效清晰度 > 1 时显示
   *   （MP4 多变体：立即；HLS/DASH：MANIFEST_PARSED 后）
   * @default 'auto'
   */
  showMenu?: 'auto' | boolean;

  /** 自定义菜单文案，如 { 1080: '1080P 超清' }（按高度索引） */
  labels?: Record<number, string>;

  /**
   * 卡顿时自动降级（仅对 MP4 静态档有意义；HLS/DASH 由 ABR 自行处理）
   * @default false
   */
  autoFallback?: boolean;

  /** 连续卡顿多少次触发降级 @default 3 */
  fallbackThreshold?: number;
}
```

**注意 `quality` 里没有的东西**：
- ❌ `list` / `qualities` — 列表来自源或 manifest
- ❌ `include` — 无法对 manifest 的列表做配置期过滤（要过滤请用 `max`/`min`）

### 3.3 运行时状态（**复用已有类型**，不新造）

> **重要修正**：我原先拟的 `QualityInfo` **不需要新建** —— 项目已有等价类型：
>
> | 我原先拟的 | 项目已有 | 位置 | 差异 |
> |---|---|---|---|
> | `QualityInfo` | **`QualityLevel`（interface）** | `types/streamPlugin.ts:104` | 已有 `id/label/width/height/bitrate`，**够用** |
> | `player.qualities` | **`availableQualities`** | `playerStore.ts:675` + `state.ts:131` | 已有，只是**没接上** |
> | `QualityController` | **`StreamPlugin.getQualities/setQuality`** | `types/streamPlugin.ts:169,175` | 已有，即"控制器"的雏形 |
>
> **设计原则改为：复用 + 补齐，不重命名、不新造。** 减少迁移成本，也避免第三套清晰度模型。

**建议的落地改动（最小化）**：

```ts
// ① types/streamPlugin.ts —— 给 QualityLevel 补一个可选标记，区分自动档
export interface QualityLevel {
  id: string;
  label: string;
  width: number;
  height: number;
  bitrate: number;
  /** 是否为自动档（ABR）。MP4 场景恒为 false */
  isAuto?: boolean;      // ← 新增（可选，向后兼容）
}

// ② 给契约补"列表就绪"的通知能力（当前只有拉取，没有推送）
export interface StreamPlugin extends Plugin {
  getQualities(): QualityLevel[];        // 已有
  setQuality(quality: string): void;     // 已有
  /** 新增：清晰度列表变化/就绪时通知（HLS: MANIFEST_PARSED；DASH: STREAM_INITIALIZED） */
  onQualitiesChange?(cb: (list: QualityLevel[]) => void): () => void;
  /** 新增：是否支持自动档（ABR） */
  supportsAutoQuality?(): boolean;
}

// ③ playerStore —— 已有 availableQualities，直接接上即可（无需改类型）
//    runtimeState.availableQualities: QualityOption[]
//    但注意：QualityOption 与 QualityLevel 字段名不同（qn/name vs id/label），需二选一或加转换
```

⚠️ **发现第三个类型不一致**：`store/types.ts` 的 `QualityOption`（`{qn, name, description, codec}`）与 `types/streamPlugin.ts` 的 `QualityLevel`（`{id, label, width, height, bitrate}`）**又是一套不同的清晰度模型**。

**→ 必须统一为一套**。建议以 **`QualityLevel`（interface 版）** 为准（字段更全、已被插件产出），`QualityOption` 废弃或改为别名：

```ts
/** @deprecated 用 QualityLevel 代替 */
export type QualityOption = QualityLevel;
```

（若 `qn: number` 是 bilibili 兼容需求，则在 `QualityLevel` 上补 `qn?: number` 字段，而不是维护两个类型。）

### 3.4 统一后的三处清晰度模型 → **收敛为一处**

| 位置 | 当前 | 修正后 |
|---|---|---|
| `types/index.ts:365` | `enum QualityLevel`（静态枚举） | ❌ **删除**（无法表达 manifest 任意档位） |
| `types/streamPlugin.ts:104` | `interface QualityLevel`（运行时档位） | ✅ **保留并作为唯一模型** |
| `store/types.ts:13` | `interface QualityOption`（`qn` 模型） | ⚠️ **别名到 `QualityLevel`** 或补 `qn?` 字段后废弃 |

**最终只有一处运行时清晰度模型**：`QualityLevel`（interface）。
**配置侧只有 `ProgressiveVariant`**（仅 MP4）。

### 3.5 控制器抽象：**不新建，复用已有契约**

之前的 `QualityController` 抽象**方向正确**，但它**就是** `StreamPlugin` 的清晰度部分 + 一个框架内置的 MP4 实现：

| 源类型 | 谁提供清晰度能力 | 实现方式 |
|---|---|---|
| HLS / DASH / FLV | **已有插件**（`StreamPlugin.getQualities/setQuality`） | ✅ **零新增**，只需补 `onQualitiesChange` |
| MP4 多变体 | **框架内置** `NativeQualityAdapter` | 🆕 新增一个小类，实现同样的 `getQualities/setQuality` 形状 |
| MP4 单档 | 无 | 返回 `[]` 或 length 1 → 菜单不显示 |

**→ 这样 `VideoPlayer` 只需面对一种接口形状，不必区分"是不是流媒体"。**

`VideoPlayer` 内部持有的**统一形状**（结构性接口，不新造类型）：

```ts
/** 清晰度能力提供者：StreamPlugin（HLS/DASH/FLV）与 NativeQualityAdapter（MP4）都满足 */
interface QualityProvider {
  getQualities(): QualityLevel[];      // ← 复用已有 interface 版 QualityLevel
  setQuality(qualityId: string): void; // 'auto' | '-1' | 档位 id
  supportsAutoQuality(): boolean;
  onQualitiesChange?(cb: (list: QualityLevel[]) => void): () => void;
  applyLimits?(limits: { max?: number; min?: number }): void;
}
```

`VideoPlayer` 侧接入（**不分支、不判断是不是流媒体**）：

```ts
getQualities(): QualityLevel[] { return this.qualityProvider?.getQualities() ?? []; }
setQuality(id: string): void    { this.qualityProvider?.setQuality(id); }

// 列表就绪时写入 Store（← 这一行就是修复 P0 缺陷 1 的关键）
this.qualityProvider?.onQualitiesChange?.((list) => {
  this.store.setAvailableQualities(list);
  this.state.set(PlayerStateKeyEnum.AVAILABLE_QUALITIES, list);
});
```

### 3.6 新增的运行时状态

> 复用已有的 `availableQualities`（`playerStore`），只补两个缺失的：

```ts
interface PlayerRuntimeState {
  /** ✅ 已有（当前未接通）：运行时清晰度列表 */
  availableQualities: QualityLevel[];
  /** 🆕 当前清晰度 id；'auto' 表示自适应 */
  currentQualityId: string;
  /** 🆕 清晰度能力类型（决定菜单是否可能显示） */
  qualityMode: 'none' | 'static' | 'adaptive';
}
```

| `qualityMode` | 何时 | 菜单 |
|---|---|---|
| `'none'` | 单档 MP4 / FLV | ❌ 不显示 |
| `'static'` | MP4 多变体（框架换 src） | ✅ 列表 > 1 时 |
| `'adaptive'` | HLS / DASH（库切档 + ABR） | ✅ 列表 > 1 时（**异步就绪**） |

### 3.7 各实现的关键映射

| 能力 | MP4（框架内置 `NativeQualityAdapter`） | HLS（已有 `HlsPlugin`） | DASH（已有 `DashPlugin`） |
|---|---|---|---|
| `getQualities()` | `src.qualities` → `QualityLevel[]` | ✅ 已有：`hls.levels.map(...)` | ✅ 已有：`getBitrateInfoListFor('video')` |
| 当前档 | 记录当前索引 | `hls.currentLevel === -1` → auto | `getQualityFor('video')` |
| `supportsAutoQuality()` | `false` | `true` | `true` |
| `setQuality(id)` | 换 `video.src`（保留 `currentTime`） | ✅ 已有：`currentLevel = Number(id)`；auto → `-1` | ✅ 已有：`setQualityFor('video', idx)` |
| `applyLimits` | 过滤列表 | `hls.autoLevelCapping` / `hls.minAutoBitrate` | `abr.maxBitrate` / `abr.minBitrate` |
| 列表就绪时机 | **立即** | `MANIFEST_PARSED` | `STREAM_INITIALIZED` |

**→ 关键结论：HLS / DASH 侧几乎**零新增代码**（`getQualities`/`setQuality` 都已实现），
真正要做的是**接通链路**（`VideoPlayer` → Store → UI）+ **补 `onQualitiesChange` 推送**。**

### 3.8 为什么运行时标识用 `height: number` / `id`，而不是枚举或字符串

这是早期文档里少数**未被否定**的论证，此处保留并补充。

| 场景 | 需要的能力 | `height: 1080` | `'1080p'` 字符串 |
|---|---|---|---|
| 菜单**排序**（高清在上） | 数值比较 | ✅ `b.height - a.height` | ❌ `'4k' > '1080p'`？字符串比较**错序** |
| 自动**降级**（卡了降一档） | 找下一档 | ✅ `qualities.filter(q => q.height < cur)` | ❌ 要先解析字符串 |
| `max`/`min` **限制** | 数值比较 | ✅ 直接比较 | ❌ 要先解析 |
| 显示文案 | 格式化 | ✅ `1080 → '1080P'` | ⚠️ 字符串本身就是文案，但没法生成 `'4K'` |
| 与 hls.js / Plyr 对接 | 生态一致 | ✅ `level.height` | ❌ 要映射 |

**最重要的一条理由**：**枚举/字符串根本无法表达 manifest 里的任意档位**。

HLS/DASH 的 manifest 可能给出**任意高度组合**，例如：

```
#EXT-X-STREAM-INF:RESOLUTION=1920x1080   → 1080 ✅ 枚举里勉强有
#EXT-X-STREAM-INF:RESOLUTION=1280x720    → 720  ✅
#EXT-X-STREAM-INF:RESOLUTION=960x540     → 540  ❌ QualityLevel 枚举里没有 '540'
#EXT-X-STREAM-INF:RESOLUTION=1920x800    → 800  ❌ 非标准高度，枚举完全没有
#EXT-X-STREAM-INF:RESOLUTION=3840x2160   → 2160 ✅ '4k'
```

**结论**：`QualityLevel` 枚举（`P4K/P1080/P720/P480/P360`）**不是"排序不好"的问题，而是"表达能力不足"的问题** —— 它只覆盖了少数几个标准档位，无法承载 manifest 的实际内容。
所以运行时标识必须是 **`height: number`**（或库给的 `id`），枚举**必须删除**。

**关键**：自动推导（排序、降级、限制）**大量依赖数值比较**，所以标识必须是数字。文案是**派生的**（`labels` 可覆盖）。

```ts
/** 生成清晰度显示文案（可由 quality.labels 覆盖） */
function formatQualityLabel(h: number, labels?: Record<number,string>): string {
  if (labels?.[h]) return labels[h];
  if (h >= 2160) return '4K';
  if (h >= 1440) return '2K';
  return `${h}P`;
}
```

---

## 四、关键：菜单显示的**时序**

这是修正后设计必须处理的新问题（早期文档完全没考虑）。

### 4.1 时序图

```
构造函数
  │  src 解析 → 未加载，qualities = []
  │  菜单：不显示（qualityMode 未知）
  ▼
挂载 → 加载源
  │
  ├─ MP4 单档 ──────────→ qualities = [单档], qualityMode='none'
  │                       菜单：不显示（length === 1）
  │
  ├─ MP4 多变体 ────────→ qualities = src.qualities, qualityMode='static'
  │                       菜单：显示（length > 1）
  │
  └─ HLS/DASH ──→ 等待 manifest 解析
                     │
                     ├─ manifest 解析失败 → qualities = [], 菜单不显示
                     │
                     └─ MANIFEST_PARSED → qualities = 解析出的档位
                                           qualityMode = 'adaptive'
                                           菜单：length > 1 时显示 ⚡异步出现
```

### 4.2 对 UI 的三条要求

| 要求 | 说明 |
|---|---|
| **① 菜单是异步出现的** | 不能假设初始就存在；HLS 可能有几百毫秒延迟 |
| **② 状态驱动而非一次性计算** | 用 `store` 的 `availableQualities` 变化 + `onEffect` 驱动菜单重渲染 |
| **③ 首次显示时不应"跳动"** | 建议：菜单项容器预留，或首次渲染时做淡入 |

**实现示意**（复用已有 store：`playerStore.subscribe(key, listener)`，见 `store/types.ts:251`）：

```ts
const QualityMenu = defineComponent((props, lifecycle) => {
  const store = useContext(StoreContext)!;
  const listEl = useTemplateRef<HTMLUListElement>(lifecycle, 'list');

  const render = (list: QualityLevel[] | undefined): void => {
    if (!listEl.value) return;
    listEl.value.innerHTML = '';
    listEl.value.append(...(list ?? []).map(renderQualityItem));
  };

  lifecycle.onMounted = (): void => {
    // 先取当前值（可能已就绪 —— MP4 是同步的），再订阅后续变化（HLS/DASH 是异步的）
    render(store.get(StateKeyEnum.available_qualities));
    unsubscribe = store.subscribe(StateKeyEnum.available_qualities, render);
  };
  lifecycle.onDestroyed = (): void => { unsubscribe?.(); };   // 见 LeftControls.ts:168 同款写法

  return h('ul', { ref: 'list' });
});
```

> ⚠️ **当前 `RightControls.ts:56` 是 `const qualities: QualityItem[] = [];`（硬编码空数组）** ——
> 必须改成从 `store` 读取 + 订阅，否则接好了链路 UI 仍是空的。

### 4.3 事件补充

```ts
enum PlayerEventEnum {
  /** 清晰度列表就绪/变化：{ qualities, mode } */
  QUALITY_LIST_CHANGE = 'qualityListChange',
  /** 当前清晰度变化：{ current, previous, isAuto } */
  QUALITY_CHANGE = 'qualityChange',   // 已存在，payload 需扩展
}

callbacks: {
  qualityListChange?: (qualities: QualityLevel[], mode: 'none'|'static'|'adaptive') => void;
  qualitychange?: (current: QualityLevel, previous: QualityLevel | null) => void;
}
```

---

## 五、`default` / `max` / `min` 在不同源类型下的精确语义

### 5.1 `quality.default`

| 源类型 | `default: 'auto'` | `default: 1080` |
|---|---|---|
| MP4 单档 | 同"唯一档" | 忽略（只有一档） |
| MP4 多变体 | 取**最高**档 | 精确 1080 → 用它；无 → 不超过 1080 的最高档 |
| HLS/DASH | **启用 ABR**（`currentLevel = -1`） | **锁定**到最接近且 ≤1080 的档（关闭 ABR） |

**注意 "精准匹配 vs 就近降级"**：

```
quality.strict = false（默认）：
  目标 1080，可用 [1080, 720, 480] → 1080 ✅
  目标 1080，可用 [1440, 720, 480] → 720（不超 1080 的最高档）

quality.strict = true：
  目标 1080，可用 [1440, 720, 480] → 保持 auto（不降级，也不升到 1440）
```

这与 YouTube 的行为一致（"1080p" 是**倾向**，不是硬性要求）。

### 5.2 `quality.max` / `min`

| 源类型 | 映射 |
|---|---|
| MP4 | 过滤 `qualities`（`min ≤ height ≤ max`） |
| HLS | `hls.autoLevelCapping = maxLevelIndex`（对应高度的档位索引）、`hls.minAutoBitrate` |
| DASH | `player.updateSettings({ streaming: { abr: { maxBitrate, minBitrate } } })` |
| 单档 | 忽略 |

**语义**：`max` 是「**ABR 不得选超过这个高度**」，不是「把高于它的档从列表删掉」——用户仍可能手动切上去（取决于实现，建议：手动切换时也受 max 限制，并给出提示）。

### 5.3 汇总映射表

| 配置 | MP4 无变体 | MP4 多变体 | HLS | DASH |
|---|---|---|---|---|
| `default: 'auto'` | 忽略 | 最高档 | **ABR** | **ABR** |
| `default: 1080` | 忽略 | 就近选档 | 锁档（就近） | 锁档（就近） |
| `max` | 忽略 | 过滤 | `autoLevelCapping` | `abr.maxBitrate` |
| `min` | 忽略 | 过滤 | `minAutoBitrate` | `abr.minBitrate` |
| `labels` | 单档文案 | 覆盖文案 | 覆盖文案 | 覆盖文案 |
| `autoFallback` | 忽略 | 卡顿降档 | 忽略（ABR 自理） | 忽略（ABR 自理） |
| 菜单显示 | 否 | 是（length>1） | 是（manifest 档数>1） | 是（同上） |

**这张表应该直接进用户文档** —— 因为"配了没效果"是最常见的困惑。

---

## 六、修正后对**其他 API / 类型**的连带影响

### 6.1 `setQuality` 方法签名必须改

```ts
// ❌ 旧：QualityLevel 是硬编码枚举（types/index.ts:365），无法表达 HLS 的任意档位
setQuality(quality: QualityLevel): void;

// ✅ 新：字符串档位 id（与已有 StreamPlugin.setQuality(quality: string) 对齐）
setQuality(qualityId: string): void;   // 'auto' | '-1' | QualityLevel.id
```

**理由**：
1. HLS manifest 里的档位可能是 1080/540/360（非常规组合），硬编码枚举根本表达不了
2. **已有契约就是 `string`**：`types/streamPlugin.ts:175` `setQuality(quality: string): void` —— 改成 `string` 即可**直接对接**，无需转换层

**若想支持"按高度倾向选择"**，再加一个便利方法（不替代上面这个）：
```ts
/** 按高度倾向切换（有精确档用它；无则取不超过该值的最高档） */
setQualityByHeight(height: number, strict?: boolean): void;
```

### 6.2 `qualitychange` 事件 payload 要扩展

```ts
// ❌ 旧：传枚举
qualitychange: (quality: QualityLevel) => void;

// ✅ 新：传运行时档位对象（与 getQualities() 的元素同型）
qualitychange: (current: QualityLevel, previous: QualityLevel | null) => void;
// current.id === 'auto'（或 isAuto）表示切到了自适应
```

### 6.3 新增运行时 API（`VideoPlayer` 上）

```ts
interface PlayerMethods {
  /** ✅ 已有中间件能力，需暴露到播放器：获取当前可用清晰度（不区分来源） */
  getQualities(): QualityLevel[];
  /** 🆕 清晰度能力类型（决定菜单是否可能显示） */
  getQualityMode(): 'none' | 'static' | 'adaptive';
  /** 🆕 当前清晰度 id */
  getCurrentQualityId(): string;
  /** 🆕 是否支持自动档（ABR） */
  supportsAutoQuality(): boolean;
  /** ♻️ 改成 string，直接转发给 StreamPlugin.setQuality */
  setQuality(qualityId: string): void;
}
```

### 6.4 插件契约新增（**改已有文件，不新建抽象**）

**同时修两个文件**（消除双定义，见 §1.4 证据 6）：

```ts
// ① types/streamPlugin.ts —— 已有 getQualities/setQuality，只补三项
export interface StreamPlugin extends Plugin {
  getQualities(): QualityLevel[];        // ✅ 已有
  setQuality(quality: string): void;     // ✅ 已有
  /** 🆕 列表就绪/变化时推送（HLS: MANIFEST_PARSED；DASH: STREAM_INITIALIZED） */
  onQualitiesChange?(cb: (list: QualityLevel[]) => void): () => void;
  /** 🆕 是否支持自动档（ABR）；默认 false */
  supportsAutoQuality?(): boolean;
  /** 🆕 应用 max/min 限制（映射到各库原生配置） */
  applyQualityLimits?(limits: { max?: number; min?: number }): void;
}

// ② packages/plugins/src/stream/types.ts —— 删除重复定义，改为 re-export
export type { StreamPlugin, StreamConfig, BufferInfo, StreamStats,
              MediaManifestSource, QualityLevel } from '../../../types/streamPlugin';
```

**框架侧**（`VideoPlayer`）在插件安装后订阅：
```ts
const plugin = /* StreamPlugin 实例 */;
this.qualityProvider = plugin;                       // 已有类型即可
plugin.onQualitiesChange?.((list) => {
  this.store.setAvailableQualities(list);            // ← 修复 P0 缺陷 1（当前从不调用）
  this.state.set(PlayerStateKeyEnum.AVAILABLE_QUALITIES, list);
});
```

### 6.5 `QualityLevel` 枚举的去留（修正早期结论）

| 早期文档我的建议 | 修正后 |
|---|---|
| 「删掉 `QualityLevel`，改用 `height: number`」 | **仍建议删枚举**，但理由**更强**：不只是排序问题，而是**枚举根本无法表达 manifest 里的任意档位**（1080/540/360、或者 1920x800 这类非标准高度） |

**注意区分两个同名类型**（见 §1.4 证据 5）：

| | 处置 |
|---|---|
| `types/index.ts:365` **enum** `QualityLevel` | ❌ **删除**（静态枚举模型，表达力不足） |
| `types/streamPlugin.ts:104` **interface** `QualityLevel` | ✅ **保留**，作为唯一运行时模型 |

**`ProgressiveVariant.height` 可选**（用户可能只有"高清/标清"两个文件，没有明确高度）：
`height` 与 `label` 至少要有一个，否则开发环境警告。

---

## 七、修订记录：早期文档中已作废 / 已修改的条目

早期文档 `docs/player-controls-quality-design.md` 中以下条目**不再沿用**（已被本文更正）：

| 章节 | 原内容 | 修订为 |
|---|---|---|
| 2.3 `QualityConfig` | 有 `include?: number[]` | **删除**（无法对 manifest 列表做配置期过滤） |
| 3.2 推导规则 | `showQualityMenu = src.qualities.length > 1` | 改为 **`provider.getQualities().length > 1`**（运行时） |
| 4.2 「列表只来自 src」 | 「列表只来自 `src`，菜单自动推导」 | 改为「**列表来自运行时**（MP4 变体 / HLS levels / DASH bitrateInfo）」 |
| 4.3 `height` 优越性论证 | 只讲了排序 | **补充**：枚举无法表达 manifest 任意档位（现为本文 §3.8） |
| 6.1 控件推导表 `quality` 行 | `resolvedQualities.length > 1` | 改为「**运行时** `qualityMode !== 'none'` 且列表 > 1（HLS/DASH 异步判定）」 |
| 9 最终类型 | `QualitySource` 必填 `url`，`height` 可选 | `QualitySource` → **`ProgressiveVariant`**（仅 MP4）；运行时模型**复用** `streamPlugin.QualityLevel`（不新造 `QualityInfo`） |
| 7.3 与主流对比表 | 「清晰度自动识别 … ✅ 从 src 推导」 | 改为「**运行时列表**（MP4 变体 / HLS levels / DASH bitrateInfo）」 |
| 更正提示块 | 「切档统一走 `QualityController` 抽象」 | **不新建** `QualityController`；复用已有 `StreamPlugin.getQualities/setQuality`（见本文 §3.5） |
| 9 最终类型注释 | 称「运行时统一模型是 `QualityInfo`」 | 运行时模型统一为 **`QualityLevel`（interface）**，不新造 `QualityInfo`（见本文 §3.3） |

> **附带说明**：早期文档（含其自身的更正提示块）中引用章节号存在错位，例如把「清晰度自动识别」标为第三章、把 prev/next 标为第二章，与正文实际章节不符。这些编号引用**一并作废**，请以本文（合并版）的章节号为准。

---

## 八、与主流播放器的对照（验证修正后的设计）

| 播放器 | 清晰度列表来源 | 是否要求用户传 | 我们的对照 |
|---|---|---|---|
| **hls.js** | `hls.levels`（manifest 解析） | ❌ 不传 | ✅ **已有**：`HlsPlugin.getQualities()` |
| **dash.js** | `getBitrateInfoListFor()` | ❌ 不传 | ✅ **已有**：`DashPlugin.getQualities()` |
| **Shaka** | `getVariantTracks()` | ❌ 不传 | ✅ 同构 |
| **video.js + @videojs/http-streaming** | `player.qualityLevels()`（运行时 `QualityLevelList`） | ❌ 不传 | ✅ **video.js 的 `qualityLevels()` 正是"运行时列表"抽象**，与本设计同构 |
| **Plyr** | ⚠️ `quality.options` 用户传 | ✅ **要传** | ⚠️ Plyr 只能配静态档（不适合 HLS/DASH）← **我上一版的错误就是退化成这个** |
| **DPlayer** | `video.quality` 用户传 + 插件补充 | ⚠️ 部分 | 同上 |
| **ArtPlayer** | `quality` 数组用户传 + `customType` 里手动对接 | ⚠️ 要传 | 同上 |

**重要发现**：**video.js 的 `player.qualityLevels()` 就是「运行时清晰度列表」**（一个 dynamically populated 的 list，HLS/DASH 插件往里塞档位）。

> **主流里做得对的（video.js / hls.js / dash.js / Shaka）都是"运行时列表"模型；做得不够好的（Plyr / ArtPlayer / DPlayer 的静态 quality 数组）只适合 MP4。**
> 本项目的**原有设计**（`types/streamPlugin.ts`）已经属于前者；
> **我上一版的 `src.qualities` 提案是把项目往后者拉，方向错了。**

---

## 九、修正后的「一句话结论」

| 问题 | 修正后的答案 |
|---|---|
| 清晰度列表从哪来？ | **三种来源**：MP4 多变体（`src.qualities`，**仅此一种要用户传**）、HLS manifest（`hls.levels`）、DASH manifest（`getBitrateInfoListFor`）。**后两者用户不传** |
| `quality` 配置该有什么？ | **只有行为偏好**：`default`（倾向）/ `max`/`min`（限制）/ `strict`/`labels`/`showMenu`/`autoFallback`。**绝不含列表** |
| 菜单何时显示？ | **运行时**：等列表就绪（MP4 立即 / HLS·DASH 在 manifest 解析后），列表 > 1 才显示。**是异步出现的** |
| 谁来切档？ | **已有插件**：HLS → `hls.currentLevel`；DASH → `setQualityFor`；MP4 多变体 → 框架换 `src` |
| `default: 1080` 什么语义？ | **倾向**：有精确档用它；无则取不超过 1080 的最高档；`strict: true` 时不降级 |
| 哪个 `QualityLevel` 该删？ | **`types/index.ts` 的 enum**（无法表达 manifest 任意档位）；**保留** `types/streamPlugin.ts` 的 interface |
| `max`/`min` 怎么生效？ | MP4 过滤列表；HLS `autoLevelCapping`/`minAutoBitrate`；DASH `abr.maxBitrate`/`minBitrate` |

**修正后的核心原则**：

> **配置只表达「倾向与限制」（intent）；能力与列表来自「运行时发现」（capability）。**
>
> 用户说"默认自动但别超 1080"（倾向）—— 这是配置；
> "manifest 里有 1080/720/480 三档"（能力）—— 这是运行时事实。
> **两者不能混在同一个配置块里。**

---

## 十、修复实施顺序（证据驱动，按依赖排序）

> 阶段 0、1 是**纯 bug 修复**，与配置重构无关，可以立刻做、独立验证。

| 阶段 | 任务 | 涉及文件 | 依赖 |
|---|---|---|---|
| **0** | **接通链路**：插件 `MANIFEST_PARSED` → 中间件 → `store.setAvailableQualities()` → `RightControls` 订阅 → 菜单 | `HlsPlugin.ts`、`DashPlugin.ts`、`streamMiddleware.ts`、`VideoPlayer.ts`、`playerStore.ts`、`RightControls.ts:56` | 无（依赖已有代码） |
| **0** | **修 `setQuality` 走错路径**：流媒体模式必须转发给插件，不能换 `videoEl.src` | `VideoPlayer.ts:1196-1236` | 无 |
| **0** | 给 `StreamPlugin` 补 `onQualitiesChange` / `supportsAutoQuality` / `applyQualityLimits` | `types/streamPlugin.ts` | 无 |
| **1** | 消除重复定义：删 `packages/plugins/src/stream/types.ts` 的 `StreamPlugin`，改 re-export | `stream/types.ts`、`index.ts` | 阶段 0 |
| **1** | 删 `types/index.ts` 的 `enum QualityLevel`；`QualityOption` 别名到 `QualityLevel` | `types/index.ts`、`store/types.ts` | 阶段 0 |
| **2** | `src` 结构：`QualitySource` → `ProgressiveVariant`（去枚举、`name`→`label`）、`type` 字段、弃用 `string[]` 备源语义 | `types/index.ts` | 阶段 1 |
| **2** | `quality` 配置块：去 `include`，加 `strict`/`labels`/`max`/`min` | `types/index.ts`、`defaultConfig.ts` | 阶段 1 |
| **2** | `NativeQualityAdapter`（MP4 多变体） | 新增 | 阶段 1 |
| **3** | 菜单改为状态驱动（异步就绪 + 淡入） | `QualityMenu.ts`、`RightControls.ts` | 阶段 0 |
| **3** | `qualitychange` payload 扩展 / 新增 `qualityListChange` 事件 | `core/events.ts`、`playerStore.ts` | 阶段 2 |

**建议先做的最小验证集（阶段 0 全部 + 阶段 1 第 1 条）** —— 做完就能看到：
用 HLS 源播放时，清晰度菜单**自动出现真实档位**，切档**瞬时生效不重新缓冲**。
这是"运行时发现"模型是否真正打通的最好证明。

**不在本表内**：`DisplayMode` 互斥枚举（prev/next、PiP/mini/全屏）—— 那部分设计**未被否定**，见本文**第十四、十五章**，可并行推进。

---

# 第二部分 · 控件与能力配置设计（仍然有效）

> 以下内容吸收自早期文档中**未被否定**的部分：控件推导模型、`quality` 对象 vs 数字、prev/next 按钮、`DisplayMode` 互斥枚举、推导规则表等。
> 其中任何涉及**清晰度来源**的表述，均已按第一部分（运行时发现模型）对齐。

## 十一、控件推导模型：显式声明 vs 能力推导

你直觉上问的其实是同一个设计问题：

> **「这个按钮要不要显示」到底是用户配的，还是框架自己判断的？**

### 11.1 两种极端都不对

| 方案 | 问题 |
|---|---|
| **全显式**（`controls: { prev: true, next: true, quality: true, ... }`） | 用户要写 20 个布尔，且**必须知道每个功能的存在**；单视频也开着 prev/next；只有 1 档清晰度也显示菜单 → 点了没反应 |
| **全自动**（框架全权决定） | 用户无法表达"我就要这个按钮"；也无法表达"有这个数据但我不想显示按钮" |

### 11.2 最佳方案：三层解析模型

```
┌───────────────────────────────────────────────────────────┐
│ 第 ① 层：能力推导（默认，零配置）                            │
│   有数据 → 显示；有浏览器能力 → 显示                         │
│   例：运行时清晰度列表 length > 1 → 显示清晰度菜单            │
│       episodes.length > 1 → 显示 prev/next                   │
│       document.pictureInPictureEnabled → 显示 PiP           │
└────────────────────────┬──────────────────────────────────┘
                         ▼
┌───────────────────────────────────────────────────────────┐
│ 第 ② 层：显式覆盖（可选）                                    │
│   controls: { quality: false }    → 强制关（哪怕有数据）     │
│   controls: { danmaku: true }     → 强制开（哪怕无数据）     │
│   controls: ['play','progress']   → 完全白名单（无视推导）   │
│   controls: true | false          → 全开 / 全关              │
└────────────────────────┬──────────────────────────────────┘
                         ▼
┌───────────────────────────────────────────────────────────┐
│ 第 ③ 层：运行时能力过滤（框架保证）                          │
│   浏览器不支持 PiP / Fullscreen → 最终仍不渲染该按钮         │
│   （避免用户配了 true 却点了报错）                           │
└───────────────────────────────────────────────────────────┘
```

**关键**：第 ③ 层是**不可被覆盖**的兜底。用户写 `controls: { pip: true }`，但浏览器不支持 PiP 时仍不显示（或显示为禁用态 + tooltip 说明原因）。

### 11.3 与主流的对照

| 播放器 | 推导 | 覆盖 | 评价 |
|---|---|---|---|
| **DPlayer** | ✅ 有 danmaku 配置才显示弹幕按钮；有 quality 数组才显示清晰度 | 弱（只有 `contextmenu` 数组） | **推导到位，覆盖不足** |
| **Plyr** | 弱 | ✅ `controls: []` 完全显式 | **覆盖到位，推导不足** |
| **video.js** | ✅ 组件按 tech 能力决定 | ✅ 组件树可删 | 成熟但配置繁琐 |
| **ArtPlayer** | ✅ 有 quality/subtitle 数据才启用对应功能 | ✅ `pip`/`fullscreen`/`setting` 可关 | **最接近本方案** |
| **xgplayer** | ✅ 插件装了才出现在控制栏 | ✅ `controls` + `ignores` | 插件驱动推导 |
| **音频/视频通用（B站）** | ✅ 单P不显示选集；多P显示 | 业务层控制 | 体验最佳 |

**结论：ArtPlayer + DPlayer 的组合思路最合适 —— 推导为主，覆盖为辅。**

---

## 十二、`quality.default`：对象 vs 数字

先把两个层次分开，这是回答的前提：

| 层次 | 是什么 | 必须是什么形态 |
|---|---|---|
| **清晰度条目**（`ProgressiveVariant`） | 一条具体的流：`{ 高度, 地址, 文案, 码率 }` | **必须是对象**（数字承载不了 url/bitrate） |
| **quality 配置块** | 用户对"清晰度行为"的偏好 | 配置块本身是对象；关键是**里面的字段**用什么 |

所以你问的其实是：**`quality.default` 该用数字还是对象？**

### 12.1 三种候选方案对比

```ts
// ── 方案 A：数字 ──
quality: { default: 1080 }
quality: { default: 0 }                    // 魔数：0 表示自动？

// ── 方案 B：对象 ──
quality: { default: { height: 1080 } }
quality: { default: { auto: true } }        // 自动也要包一层

// ── 方案 C：数字 | 'auto'（推荐）──
quality: { default: 1080 }
quality: { default: 'auto' }
```

| 维度 | A 数字 | B 对象 | C 数字 \| 'auto' |
|---|---|---|---|
| 表达"自动" | ❌ 需要魔数 `0` | ✅ `{auto:true}` | ✅ `'auto'` |
| 表达"指定 1080" | ✅ `1080` | ⚠️ `{height:1080}` | ✅ `1080` |
| 可排序/比较 | ✅ 直接数值比较 | ❌ 对象要自定义比较 | ✅ |
| 与列表项相等性判断 | ✅ `id === 1080` | ❌ 两个 `{height:1080}` 不相等 | ✅ |
| 配置简洁度 | ✅ 最短 | ❌ 多一层 | ✅ |
| 扩展"默认+兜底" | ❌ 要加字段 | ⚠️ `{height, fallback}` | ⚠️ 用独立字段 |
| 类型安全 | ⚠️ `0` 是魔数 | ✅ | ✅ 字面量联合 |

### 12.2 结论：**不要对象，用 `number | 'auto'`**

**理由**：

1. **对象没有带来任何额外信息**：`{ height: 1080 }` 相比 `1080` 一个字节的信息都没多。对象的价值在于"承载多字段"，而 `default` 只需要一个值。

2. **对象引入相等性陷阱**：清晰度菜单要高亮"当前选中项"，判断是 `item.height === current.height`。如果 `default` 是对象，就要做深比较或引用比较 —— 而引用比较在"用户重新 new 一个 `{height:1080}`"时会失效。

3. **对象会让"从列表选一项"变得别扭**：
   ```ts
   const source = { height: 1080, url: '...' };
   quality: { default: { height: 1080 } }   // 我为什么要重新构造一个对象？
   quality: { default: 1080 }               // 用 id 引用，干净
   ```

4. **字符串 `'auto'` 比魔数 `0` 好**（方案 A 的缺陷）：`default: 0` 需要文档说明"0=自动"，而 `'auto'` 自解释。且 `0` 恰好是"没有高度"的自然值，容易误用。

5. **"自动但限制上限"的需求用独立字段解决，不用对象**：
   ```ts
   quality: {
     default: 'auto',      // 自动
     max: 1080,            // 但最高只到 1080（避免自动选到 4K 卡顿）
     min: 480,
   }
   ```
   这比 `{ auto: true, max: 1080 }` 更扁平、更好读。参考：Shaka 的 `restrictions.maxHeight` 正是独立字段。

### 12.3 最终 quality 配置设计

配置定义以 **§3.2** 为准（`default` / `strict` / `max` / `min` / `showMenu` / `labels` / `autoFallback` / `fallbackThreshold`）。

**重点：`quality` 里没有 `list`！** —— 列表**不是**来自 `src.qualities`（这个说法已被第一部分更正）。
正确表述：**列表来自运行时清晰度能力提供方**（MP4 变体 / HLS `levels` / DASH `bitrateInfo`），详见 §3.5、§3.7。

> **关于"对象 vs 数字"的通用结论**：
> - 需要承载**多个字段**的东西 → 对象（如 `ProgressiveVariant`、`ThumbnailSheet`）
> - 只是**一个标识/数值** → 用原始类型（如 `default: 1080`、`volume: 0.8`、`startTime: 30`）
> - 需要"特殊值语义" → 用**字符串字面量**而不是魔数（`'auto'` 而不是 `0`）

---

## 十三、上一个/下一个按钮——显式传还是自动显示？

### 13.1 你的直觉是对的：应该自动

**理由**：

1. **prev/next 的"可显示性"完全由数据决定**：单视频没有"下一个"，硬显示只会让用户点了没反应（或报错）。
2. **用户不应该为了显示按钮而写配置**：写了 `episodes` 就已经表达了"这是个剧集"，按钮是**隐含结论**。
3. **主流一致**：JW Player 有 `playlist` 就自动出 prev/next；B站多P自动出选集；DPlayer 有列表才出。

### 13.2 但有一个"单视频也要 prev/next"的真实场景

业务上常见：视频源只有一个 `<video src>`，但"下一个视频"由后端接口决定，切换时整个页面跳转或换源。

这时用户**没有 episodes 数组**，但需要按钮。

### 13.3 最佳方案：**数据驱动 + 回调驱动，二选一都能触发**

```ts
interface PlayerConfig {
  /**
   * 剧集列表（存在且 > 1 项时，自动启用 prev/next 与选集列表）
   */
  episodes?: EpisodeItem[];

  callbacks?: {
    /**
     * 点击"上一个"。仅当未提供 episodes 时由业务处理
     * （提供 episodes 时框架自己切换，回调仅作通知）
     */
    prev?: () => void;
    /** 点击"下一个" */
    next?: () => void;
  };
}

interface EpisodeItem {
  /** 唯一标识（用于定位当前集） */
  id: string | number;
  /** 显示标题 */
  title?: string;
  /** 该集的源 */
  src?: SourceInput;
  /** 该集的封面 */
  poster?: string;
  /** 该集的时长（秒，可选，用于显示） */
  duration?: number;
}
```

### 13.4 推导规则（明确且可预测）

```
showPrev          =  hasPrevAvailable
showNext          =  hasNextAvailable
showEpisodeList   =  episodes.length > 1

其中：
  hasPrevAvailable = episodes ? currentIndex > 0
                             : typeof callbacks.prev === 'function'
  hasNextAvailable = episodes ? currentIndex < episodes.length - 1
                             : typeof callbacks.next === 'function'
```

**精妙之处**：
- 传了 `episodes` → 框架**自己管**（自动算边界，第一集不显示"上一个"）
- 只传回调 → 框架**委托业务**（业务决定边界；框架不知道是否还有下一集，所以只在"非末集"时隐藏需要业务用 `player.setHasNext(false)` 之类控制，或简化为一律显示）
- 都没传 → **不显示**

> **简化权衡**：只传回调时，框架无法知道边界 → 建议**一律显示**，由业务在回调里决定是否真的切换（或调用 `player.setNextAvailable(false)` 关闭）。这个细节要在文档写清楚。

### 13.5 与 `playMode` 的关系

```ts
playMode?: 'order' | 'repeatAll' | 'repeatOne' | 'shuffle';
```

| playMode | prev/next 行为 |
|---|---|
| `'order'` | 顺序：末集无 next，首集无 prev |
| `'repeatAll'` | 循环：末集 next 回到首集（**永远有 next**） |
| `'repeatOne'` | 单集循环：**不显示 prev/next**（没有切换语义） |
| `'shuffle'` | 随机：**永远有 next**，prev 按历史栈 |

所以推导要**叠加 playMode**：
```
hasNext = repeatOne ? false
        : repeatAll || shuffle ? episodes.length > 1
        : currentIndex < episodes.length - 1
```

这是"自动推导"必须考虑的隐藏复杂度 —— **也是自动推导的风险：规则不透明**。所以文档必须把规则表公开（见第十五章）。

---

## 十四、显示模式：画中画 / mini / 网页全屏 / 全屏

这是本次分析**最有价值的收敛点**（未被否定）。

### 14.1 先看清这 5 个功能的本质差异

| 功能 | 实现来源 | 浏览器能力判据 | 改变什么 | 互斥性 |
|---|---|---|---|---|
| **全屏** | 原生 Fullscreen API | ✅ `document.fullscreenEnabled` | 整个页面/元素进入全屏 | 与其他布局模式互斥 |
| **网页全屏** | 项目自制（容器 `position:fixed` 铺满视口） | ❌ 无判据 | **容器布局** | 互斥 |
| **宽屏** | 项目自制（容器加宽、高度不变） | ❌ 无判据 | **容器布局** | 互斥 |
| **Mini 小窗** | 项目自制（小尺寸悬浮/固定角落） | ❌ 无判据 | **容器布局** | 互斥 |
| **画中画 PiP** | 原生 PiP API | ✅ `document.pictureInPictureEnabled` | **视频弹出到系统浮窗**（容器布局不变） | 与全屏类互斥（浏览器自动处理） |

**两个关键洞察**：

**洞察 1**：前 4 个都是「**容器布局模式**」，本质是**同一个状态的不同取值** —— 同一时刻只能有一个。

**洞察 2**：PiP 与它们**不同层** —— 它不改变容器布局，而是把 video 元素"搬"到系统浮窗。所以它不该混进布局模式枚举（但播放器可以在进入 PiP 时自动退出 mini 等模式）。

### 14.2 现状问题：4 个独立布尔 = 16 种状态，大部分非法

当前运行时状态（`PlayerStateKeyEnum`）：

```ts
IS_FULLSCREEN: boolean
IS_WEB_FULLSCREEN: boolean
IS_WIDE_SCREEN: boolean
IS_PIP: boolean
```

理论组合 `2^4 = 16` 种，其中**至少 12 种非法**：

| 组合 | 合法性 |
|---|---|
| 全 false | ✅ normal |
| IS_FULLSCREEN | ✅ |
| IS_WEB_FULLSCREEN | ✅ |
| IS_WIDE_SCREEN | ✅ |
| IS_PIP | ✅ |
| 全屏 + 网页全屏 | ❌ 非法 |
| 全屏 + 宽屏 | ❌ 非法 |
| 网页全屏 + 宽屏 | ❌ 非法 |
| 全屏 + 网页全屏 + 宽屏 | ❌ 非法 |
| … | ❌ |

**问题**：
- 状态可以进入非法组合（当前靠各组件自觉互斥，容易漏）
- 判断"当前是什么模式"要写 `if (a) ... else if (b) ...` 链
- 每个模式一个 `toggleXxx()` 方法，切换时还要手动退出其他模式
- 对应 4 个事件 `FULLSCREEN_CHANGE` / `WEB_FULLSCREEN_CHANGE` / `WIDE_SCREEN_CHANGE` / `PIP_CHANGE`，用户要监听 4 个

### 14.3 最佳方案：收敛为**互斥枚举** + PiP 独立

```ts
/**
 * 容器布局模式（互斥，同一时刻只有一个）
 * - normal：正常（按 ratio 显示）
 * - fullscreen：原生全屏（Fullscreen API）
 * - webFullscreen：网页全屏（容器铺满视口）
 * - wideScreen：宽屏（容器加宽，高度不变）
 * - mini：迷你小窗
 */
export type DisplayMode =
  | 'normal'
  | 'fullscreen'
  | 'webFullscreen'
  | 'wideScreen'
  | 'mini';
```

**配置设计**：

```ts
interface DisplayConfig {
  /**
   * 启用的布局模式（决定按钮显示与 API 可用性）
   * - 'auto'（默认）：按能力推导
   *     全屏 → document.fullscreenEnabled
   *     网页全屏 → 默认启用
   *     宽屏 → 默认启用
   *     mini → 默认不启用（按需显式开启）
   * - 数组：白名单，如 ['fullscreen', 'wideScreen']
   * - 对象：精确覆盖，如 { mini: true, wideScreen: false }
   * @default 'auto'
   */
  modes?: 'auto' | DisplayMode[] | Partial<Record<DisplayMode, boolean>>;

  /**
   * 画中画（独立于布局模式的原生能力）
   * - 'auto'（默认）：document.pictureInPictureEnabled 时启用
   * - true / false：强制
   * @default 'auto'
   */
  pip?: 'auto' | boolean;

  /**
   * 进入全屏类模式时自动退出 mini
   * @default true
   */
  exitMiniOnFullscreen?: boolean;

  /**
   * 移动端进入全屏时锁定横屏
   * @default false
   */
  lockOrientation?: boolean;

  /**
   * 初始化时进入的模式
   * @default 'normal'
   */
  initial?: DisplayMode;

  /**
   * mini 模式的尺寸与位置
   */
  mini?: {
    /** 宽（px） @default 320 */
    width?: number;
    /** 停靠位置 @default 'bottom-right' */
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** 页面滚动多少像素后自动进入 mini @default undefined（不自动） */
    autoEnterOnScroll?: number;
    /** 是否可拖拽 @default true */
    draggable?: boolean;
  };
}
```

### 14.4 统一 API 与事件

**API**（替代 4 个 `toggleXxx`）：

```ts
interface PlayerMethods {
  /** 设置布局模式（自动退出旧模式） */
  setDisplayMode(mode: DisplayMode): Promise<void>;
  /** 切换某个模式（若已是该模式则回 normal） */
  toggleDisplayMode(mode: Exclude<DisplayMode, 'normal'>): Promise<void>;
  /** 当前模式 */
  getDisplayMode(): DisplayMode;

  /** 画中画（独立） */
  togglePip(): Promise<void>;
  /** 是否处于 PiP */
  isPip(): boolean;
}
```

**状态**（替代 4 个布尔）：

```ts
interface PlayerStateMap {
  /** 当前布局模式（单一真相） */
  'player.displayMode': DisplayMode;
  /** 是否处于 PiP */
  'player.isPip': boolean;
}
```

**事件**（替代 4 个 CHANGE 事件）：

```ts
enum PlayerEventEnum {
  /** 布局模式变化：{ mode, previousMode } */
  DISPLAY_MODE_CHANGE = 'displayModeChange',
  /** 画中画变化：{ isPip } */
  PIP_CHANGE = 'pipChange',
}

// callbacks
callbacks: {
  displayModeChange?: (mode: DisplayMode, previousMode: DisplayMode) => void;
  pipchange?: (isPip: boolean) => void;
}
```

### 14.5 按钮如何推导（这一步很关键）

**每个「可用模式」自动生成一个按钮**，无需逐个配置：

```
可用模式 = resolveDisplayModes(display.modes)        // 第 ①②③ 层解析
按钮列表 = 可用模式.filter(m => m !== 'normal')
           .sort(byPriority)                          // mini > wide > web > fullscreen
按钮行为 = mode === currentMode
             ? player.setDisplayMode('normal')        // 已在该模式 → 退出
             : player.setDisplayMode(mode)            // 否则进入
按钮图标 = 按 (mode, isCurrent) 查表
```

**收益**：`ui.controls` 里**不再需要** `pip` / `fullscreen` / `webFullscreen` / `wideScreen` / `mini` 这 5 个布尔！它们由 `display` 配置块统一掌管。

**两层正交**（重要）：

| 层 | 配置 | 作用 |
|---|---|---|
| **能力层** | `display.modes` / `display.pip` | 决定"这个模式能不能用"（影响 API 与按钮是否存在） |
| **UI 层** | `ui.controls` | 决定"按钮要不要显示"（可隐藏按钮但保留 API） |

```ts
// 例：允许代码调用全屏，但不显示全屏按钮
{
  display: { modes: ['fullscreen', 'wideScreen'] },
  ui: { controls: { fullscreen: false } },   // 按钮隐藏，player.setDisplayMode('fullscreen') 仍可用
}
```

### 14.6 互斥管理由框架负责

```ts
// 播放器内部
async setDisplayMode(mode: DisplayMode) {
  if (mode === this.currentMode) return;

  // 1. 退出旧模式（按需清理 DOM class / 退出原生全屏）
  await this.exitMode(this.currentMode);

  // 2. 进入新模式
  await this.enterMode(mode);

  // 3. 更新单一状态 + 触发单一事件
  this.state.set('player.displayMode', mode);
  this.events.emit(DISPLAY_MODE_CHANGE, { mode, previousMode });
  this.callbacks.displayModeChange?.(mode, previousMode);
}
```

**用户不再需要**：
- 手动确保互斥
- 监听 4 个事件再自己算"现在是什么模式"
- 写 `if (isFullscreen) exitWebFullscreen()` 这类胶水代码

---

## 十五、完整推导规则表（必须公开给用户）

自动推导的**唯一风险是不透明**，所以框架文档必须给出完整规则表：

### 15.1 控件显示推导

| 控件 | 推导条件（`controls: 'auto'` 时） | 可被覆盖 |
|---|---|---|
| `play` | 始终 | ✅ |
| `progress` | 始终 | ✅ |
| `time` | `duration > 0`（直播无时长则隐藏） | ✅ |
| `volume` | 始终 | ✅ |
| `quality` | **运行时**：`qualityMode !== 'none'` 且 `qualities.length > 1`（MP4 立即判定；**HLS/DASH 在 manifest 解析后异步判定**） | ✅ |
| `playbackRate` | `playbackRates.length > 1` | ✅ |
| `subtitle` | `subtitle.tracks.length > 0` | ✅ |
| `danmaku` | `danmaku.enabled === true` 且弹幕插件已注册 | ✅ |
| `prev` | 见 §13.4 的 `hasPrevAvailable` | ✅ |
| `next` | 见 §13.4 的 `hasNextAvailable` | ✅ |
| `episodes`（选集） | `episodes.length > 1` | ✅ |
| `setting` | 设置菜单中**至少有一项可用** | ✅ |
| `hotkeyPanel` | `interaction.keyboard !== false` | ✅ |
| `viewpoint` | `viewpoints?.length > 0` | ✅ |
| `fullscreen` | `display.modes` 含 `'fullscreen'`（含浏览器支持判断） | ✅ |
| `webFullscreen` | `display.modes` 含 `'webFullscreen'` | ✅ |
| `wideScreen` | `display.modes` 含 `'wideScreen'` | ✅ |
| `mini` | `display.modes` 含 `'mini'` | ✅ |
| `pip` | `display.pip` 解析为 true（含浏览器支持判断） | ✅ |

### 15.2 模式可用性推导（`display.modes: 'auto'` 时）

| 模式 | 推导条件 | 说明 |
|---|---|---|
| `fullscreen` | `document.fullscreenEnabled === true` | **原生能力**，不可覆盖为"支持" |
| `webFullscreen` | `true` | 无原生判据，纯 CSS 实现，默认可用 |
| `wideScreen` | `true` | 同上 |
| `mini` | `false` | 默认关闭（避免意外触发），需显式开启 |
| `pip` | `document.pictureInPictureEnabled === true` | **原生能力** |

### 15.3 强制覆盖的行为

| 写法 | 效果 |
|---|---|
| `controls: true` | 全部控件显示（**含无数据的**，如单视频也显示 prev/next） |
| `controls: false` | 全部隐藏（纯视频） |
| `controls: ['play','progress','fullscreen']` | **完全白名单**：只显示这些，且按此顺序（忽略推导） |
| `controls: { quality: false }` | 在推导结果上关掉 quality |
| `controls: { danmaku: true }` | 在推导结果上强制开 danmaku |
| `display: { modes: ['fullscreen'] }` | 只启用全屏（网页全屏/宽屏按钮消失） |
| `display: { pip: false }` | 禁用 PiP（即浏览器支持也不显示） |

---

## 十六、设计收益对比

### 16.1 配置量对比（典型剧集播放器）

```ts
// ── 旧设计（全显式，且缺失能力）──
{
  src: { qualities },   // ⚠️ 仅 MP4 有效；HLS/DASH 不该传
  controlBtns: { prev: true, next: true, quality: true, pip: true, wide: true, web: true },
  defaultQuality: 'auto',
  keyboard: true,
  // 全屏/mini 没地方配；prev/next 与数据无关，单视频也显示
}

// ── 新设计（推导为主，只配"意图"）──
{
  src: { qualities: [...] },             // 仅 MP4 多变体需要
  episodes: [...],                       // ← prev/next/选集 自动出现
  quality: { default: 'auto', max: 1080 },
  display: { pip: true },                // ← 只覆盖想改的
  // 全屏/网页全屏/宽屏按钮自动出现（按浏览器能力）
}
```

**配置从 6 行降到 4 行**，且新增能力（mini、选集）零配置。

### 16.2 状态模型对比

| | 旧 | 新 |
|---|---|---|
| 布局状态 | 3 个布尔（8 种组合，5 种非法） | 1 个枚举（5 个合法值） |
| PiP | 第 4 个布尔 | 独立布尔（合理的不同层） |
| 相关事件 | 4 个 | 2 个 |
| 切换 API | 4 个 `toggleXxx` | 1 个 `setDisplayMode` |
| 互斥保证 | 靠调用方自觉 | **框架内建** |

### 16.3 与主流对比（这几点的领先性）

| 能力 | Plyr | ArtPlayer | xgplayer | DPlayer | **本方案** |
|---|---|---|---|---|---|
| 控件自动推导 | ❌ | 部分 | 插件驱动 | 部分 | ✅ **完整规则表** |
| prev/next 数据驱动 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 清晰度自动识别 | ⚠️ 需配 options | ⚠️ 需配 quality 数组 | ❌ | ✅ | ✅ **运行时列表**（MP4 变体 / HLS levels / DASH bitrateInfo） |
| 显示模式互斥建模 | ❌ 4 布尔 | ❌ 独立布尔 | ❌ | ❌ | ✅ **单一枚举** |
| 能力 vs UI 两层分离 | ❌ | ❌ | ⚠️ 部分 | ❌ | ✅ |
| 运行时能力兜底 | ⚠️ | ✅ | ⚠️ | ❌ | ✅ |

---

## 十七、待确认的决策点

### 决策 1｜`controls` 默认值用 `'auto'` 还是 `true`？

| 选项 | 影响 |
|---|---|
| **`'auto'`（推荐）** | 零配置即得到合理 UI；但"为什么少了某个按钮"需要查规则表 |
| `true` | 所见即所得（所有按钮都在）；但单视频会出现点不动的 prev/next |

**建议 `'auto'`**，理由：符合"约定优于配置"，且规则表会公开。

### 决策 2｜mini 默认开还是关？

- **建议默认关**（`display.modes: 'auto'` 时不含 mini）：mini 是项目特有交互，且通常由"滚动页面"触发而非按钮
- 需要时 `display: { modes: { mini: true } }` 显式开启

### 决策 3｜只传 `callbacks.next` 无 `episodes` 时，边界如何处理？

| 选项 | 说明 |
|---|---|
| **A. 一律显示**（推荐） | 框架不知道边界，交给业务；业务可调 `player.setNextAvailable(false)` |
| B. 提供 `hasNext?: boolean` 配置 | 显式但多一个字段 |
| C. 不显示 | 太保守，违背了"有回调就显示"的初衷 |

**建议 A** + 提供 `player.setPrevAvailable()/setNextAvailable()` 运行时 API。

### 决策 4｜`setDisplayMode` 同步还是异步？

全屏/PiP 是**原生异步 API**（`requestFullscreen()` 返回 Promise，可能被用户手势策略拒绝）。

- **建议 `Promise<void>`**：让调用方 `await` 并 `catch` 失败（如"非用户手势触发被拒绝"）
- 事件与状态只在**成功后**更新（避免乐观更新导致状态与实际不一致）

---

## 十八、最终产出：完整类型定义

> 清晰度类型以第一部分为准（§3.1 / §3.2 / §3.3 / §6.1），此处汇总仅便于查阅；如有冲突，以第一部分为准。

```ts
// ============================================================
// 控件
// ============================================================

export type ControlName =
  | 'play' | 'progress' | 'time' | 'volume'
  | 'quality' | 'playbackRate' | 'subtitle' | 'danmaku'
  | 'prev' | 'next' | 'episodes'
  | 'setting' | 'hotkeyPanel' | 'viewpoint'
  | 'fullscreen' | 'webFullscreen' | 'wideScreen' | 'mini' | 'pip';

export type ControlsInput =
  | 'auto'                              // 按能力推导（默认）
  | boolean                             // true 全开 / false 全关
  | ControlName[]                       // 白名单 + 排序
  | Partial<Record<ControlName, boolean>>; // 在推导结果上覆盖

// ============================================================
// 清晰度（权威定义见 §3.1 / §3.2）
// ============================================================

/** 渐进式（MP4）清晰度变体 —— 仅 MP4 需要手填；HLS/DASH 由 manifest 运行时提供 */
export interface ProgressiveVariant {
  /** 源地址 */
  url: string;
  /** 视频高度（px），既是标识也是排序/降级依据 */
  height?: number;
  /** 码率 bps（可选，用于展示与自动选档） */
  bitrate?: number;
  /** 展示文案（不传则由 height 推导，如 1080 → '1080P'） */
  label?: string;
}
// ⚠️ 该类型原名为 QualitySource，已更名（见 §3.1）。
// 运行时统一模型是 QualityLevel（interface，types/streamPlugin.ts:104）；
// HLS/DASH 的清晰度列表来自运行时能力提供方（StreamPlugin / NativeQualityAdapter），用户不传。

export interface QualityConfig {
  default?: number | 'auto';
  strict?: boolean;
  max?: number;
  min?: number;
  labels?: Record<number, string>;
  showMenu?: 'auto' | boolean;
  autoFallback?: boolean;
  fallbackThreshold?: number;
  // ❌ include?: number[] —— 已作废（HLS/DASH 的列表在配置期不存在，无法过滤）
}

// ============================================================
// 剧集
// ============================================================

export interface EpisodeItem {
  id: string | number;
  title?: string;
  src?: SourceInput;
  poster?: string;
  duration?: number;
}

// ============================================================
// 显示模式
// ============================================================

export type DisplayMode =
  | 'normal' | 'fullscreen' | 'webFullscreen' | 'wideScreen' | 'mini';

export interface DisplayConfig {
  modes?: 'auto' | DisplayMode[] | Partial<Record<DisplayMode, boolean>>;
  pip?: 'auto' | boolean;
  exitMiniOnFullscreen?: boolean;
  lockOrientation?: boolean;
  initial?: DisplayMode;
  mini?: {
    width?: number;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    autoEnterOnScroll?: number;
    draggable?: boolean;
  };
}
```

---

## 十九、贯穿始终的设计原则

| 你的问题 | 答案 |
|---|---|
| **quality 改对象更好吗？** | ❌ **不要对象**。清晰度**条目**必须是对象（承载 url）；`quality.default` 用 **`number \| 'auto'`**（对象冗余 + 相等性陷阱 + 魔数问题）。"自动但限高"用独立字段 `max`/`min`，不用嵌套对象 |
| **prev/next 怎么表示？** | ✅ **数据驱动自动**：传 `episodes` 自动显示并自己切换；只有 `callbacks.prev/next` 时显示并委托业务；都没有则不显示 |
| **清晰度也能自动识别吗？** | ✅ **能，而且应该** —— 但要分清来源：**MP4 由用户传 `src.qualities`；HLS/DASH 由 manifest 运行时提供，用户不传**。菜单在**运行时列表** `length > 1` 时自动出现（HLS/DASH 是**异步**出现的）。详见第一部分 |
| **PiP/mini/网页全屏/全屏怎么配？** | ✅ **收敛为互斥枚举 `DisplayMode`**，一个 `display` 配置块 + 一个 `setDisplayMode()` API + 一个状态 + 一个事件。**不要 4 个布尔**（16 种组合、12 种非法） |

**贯穿始终的一条原则**：

> **能推导的不配；要配的只配"意图"（intent），不配"结果"（result）；
> 而"能力与列表"既不是意图也不是结果 —— 它是运行时发现的事实。**

用户说"默认自动但别超 1080"（**意图** → 配置）、
"我提供 3 个 MP4 文件"（**数据** → `src.qualities`，**仅 MP4**）、
"manifest 里有 1080/720/480"（**运行时事实** → `hls.levels` / `getBitrateInfoListFor`，**用户不写**）。
三者不能混在同一个配置块里。

---

*合并完成。第一部分（清晰度，运行时发现模型）为权威依据；第二部分（控件与能力）为未被否定的控件/交互设计。两者中任何涉及清晰度来源的表述均已统一：**列表是运行时由 provider 发现的，菜单按运行时列表长度推导**。*
