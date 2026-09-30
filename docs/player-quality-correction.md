# 更正：清晰度设计的根本性错误与修正方案

> 本文更正 `player-controls-quality-design.md` 第三章中关于「清晰度列表来自 `src.qualities`」的设计。
> **错误性质**：把「清晰度」当成**静态的用户输入数据**，而实际上它有**三种来源**，其中两种是**运行时由 manifest 发现的**。

---

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
> | `quality: QualityLevel`（**必填枚举**） | **删除**（改用 `height?`） | 枚举无法表达任意档位（见 §4.3 of 主文档）；且与 `height` 字段重复 |
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

---

## 四、关键：菜单显示的**时序**

这是修正后设计必须处理的新问题（上一版完全没考虑）。

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

### 6.5 `QualityLevel` 枚举的去留（修正上一版结论）

| 上一版我的建议 | 修正后 |
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

## 七、上一版文档需要修订的条目

`docs/player-controls-quality-design.md` 中：

| 章节 | 原内容 | 修订为 |
|---|---|---|
| 2.3 `QualityConfig` | 有 `include?: number[]` | **删除**（无法对 manifest 列表做配置期过滤） |
| 3.2 推导规则 | `showQualityMenu = src.qualities.length > 1` | 改为 **`provider.getQualities().length > 1`**（运行时） |
| 4.2 「列表只来自 src」 | 「列表只来自 `src`，菜单自动推导」 | 改为「**列表来自运行时**（MP4 变体 / HLS levels / DASH bitrateInfo）」 |
| 4.3 `height` 优越性论证 | 只讲了排序 | **补充**：枚举无法表达 manifest 任意档位 |
| 6.1 控件推导表 `quality` 行 | `resolvedQualities.length > 1` | 改为「**运行时** `qualityMode !== 'none'` 且列表 > 1（HLS/DASH 异步判定）」 |
| 9 最终类型 | `QualitySource` 必填 `url`，`height` 可选 | `QualitySource` → **`ProgressiveVariant`**（仅 MP4）；运行时模型**复用** `streamPlugin.QualityLevel`（不新造 `QualityInfo`） |

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

**不在本表内**：`DisplayMode` 互斥枚举（prev/next、PiP/mini/全屏）—— 那部分设计**未被否定**，见主设计文档第五、六章，可并行推进。

---

*更正完成。核心结论：你指出的问题成立，且**项目原有设计（`types/streamPlugin.ts`）本就是对的** —— 我上一版提案反而退化了。建议按第十章阶段 0/1 先修 bug（含 2 个 P0 链路缺陷），再谈配置重构。*
