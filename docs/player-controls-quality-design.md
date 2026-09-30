# 控件与能力配置设计 · 深度分析与最佳方案

> 回答四个问题：
> 1. `quality` 改成对象是否比数字更好？
> 2. 上一个/下一个按钮如何表示？能否自动显示？
> 3. 清晰度能否也自动识别？
> 4. 画中画 / mini / 网页全屏 / 全屏 应该如何设置？
>
> 结论先行：**能自动推导的一律自动推导，显式配置只作为"覆盖层"**；显示模式应收敛为**互斥枚举**而非 5 个布尔。

---

> ## ⚠️ 第三章「清晰度」部分已被更正，请勿照此实现
>
> **更正文档：[`player-quality-correction.md`](./player-quality-correction.md)**
>
> **本文的错误**：把清晰度列表当成「用户提供的静态数据」（`src.qualities`）。
> **实际情况**：清晰度有**三种来源**，其中 **HLS / DASH 的清晰度由 manifest 在运行时提供，用户不传**：
>
> | 源类型 | 清晰度来源 | 用户是否传 | 谁切档 | 何时可知 |
> |---|---|---|---|---|
> | MP4 单档 | 无 | ❌ | — | 立即 |
> | MP4 多档 | **用户传 `src.qualities`** | ✅ | 框架（换 src） | 立即 |
> | **HLS** | **manifest（`EXT-X-STREAM-INF`）** | ❌ **不传** | hls.js | **`MANIFEST_PARSED` 后** |
> | **DASH** | **manifest（`Representation`）** | ❌ **不传** | dash.js | **`STREAM_INITIALIZED` 后** |
>
> **由此产生的修正**（详见更正文档）：
> 1. `quality` 配置块**只描述行为偏好**，绝不承载列表；`include` 字段**作废**（无法对 manifest 列表做配置期过滤）
> 2. 清晰度列表是**运行时状态**（`player.qualities`）+ 运行时 API（`player.getQualities()`）
> 3. 菜单显示**由运行时列表推导**，HLS/DASH 场景下是**异步出现**的
> 4. 切档统一走 **`QualityController`** 抽象（MP4 换 src / HLS `currentLevel` / DASH `setQualityFor`）
> 5. `quality.default: 1080` 是**倾向**（就近降级），不是精确匹配
>
> **本文仍然有效的部分**：控件推导模型（第一章）、prev/next（第二章）、`DisplayMode` 互斥枚举（第四章）、对象 vs 数字的通用结论。
> **受影响的章节**：§2.3 `QualityConfig`、§3 清晰度自动识别、§6.1 控件推导表、§9 最终类型定义。

---

## 一、核心命题：显式声明 vs 能力推导

你直觉上问的其实是同一个设计问题：

> **「这个按钮要不要显示」到底是用户配的，还是框架自己判断的？**

### 1.1 两种极端都不对

| 方案 | 问题 |
|---|---|
| **全显式**（`controls: { prev: true, next: true, quality: true, ... }`） | 用户要写 20 个布尔，且**必须知道每个功能的存在**；单视频也开着 prev/next；只有 1 档清晰度也显示菜单 → 点了没反应 |
| **全自动**（框架全权决定） | 用户无法表达"我就要这个按钮"；也无法表达"有这个数据但我不想显示按钮" |

### 1.2 最佳方案：三层解析模型

```
┌───────────────────────────────────────────────────────────┐
│ 第 ① 层：能力推导（默认，零配置）                            │
│   有数据 → 显示；有浏览器能力 → 显示                         │
│   例：qualities.length > 1 → 显示清晰度菜单                  │
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

### 1.3 与主流的对照

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

## 二、问题 1：`quality` 改成对象是否比数字更好？

先把两个层次分开，这是回答的前提：

| 层次 | 是什么 | 必须是什么形态 |
|---|---|---|
| **清晰度条目**（`ProgressiveVariant` / `QualityInfo`） | 一条具体的流：`{ 高度, 地址, 文案, 码率 }` | **必须是对象**（数字承载不了 url/bitrate） |
| **quality 配置块** | 用户对"清晰度行为"的偏好 | 配置块本身是对象；关键是**里面的字段**用什么 |

所以你问的其实是：**`quality.default` 该用数字还是对象？**

### 2.1 三种候选方案对比

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

### 2.2 结论：**不要对象，用 `number | 'auto'`**

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

### 2.3 最终 quality 配置设计

```ts
interface QualityConfig {
  /**
   * 默认清晰度
   * - 'auto'：根据带宽自动选择
   * - 数字：指定高度（如 1080），即 list 中条目的 height
   * @default 'auto'
   */
  default?: number | 'auto';

  /**
   * 自动模式的清晰度上限（像素高度）
   * 用于"自动但不超 1080"这类需求
   * @default undefined（不限制）
   */
  max?: number;

  /** 自动模式的清晰度下限 @default undefined */
  min?: number;

  /**
   * @deprecated ❌ **已作废**（见 `player-quality-correction.md`）
   * 原因：HLS/DASH 的清晰度列表在 `MANIFEST_PARSED` 之前**根本不存在**，
   *       无法在配置解析期做过滤。要限制请用 `max` / `min`。
   */
  // include?: number[];

  /** 自定义菜单文案，如 { 1080: '1080P 超清', 720: '720P 高清' } */
  labels?: Record<number, string>;

  /**
   * 是否显示清晰度菜单
   * @default 'auto' → 自动识别的清晰度 > 1 档时显示
   */
  showMenu?: 'auto' | boolean;

  /**
   * 卡顿时自动降级
   * @default false
   */
  autoFallback?: boolean;

  /** 连续卡顿多少次触发降级 @default 3 */
  fallbackThreshold?: number;
}
```

**重点：`quality` 里没有 `list`！** —— 但列表**不是**来自 `src.qualities`（这个说法已更正）。
正确表述：**列表来自运行时清晰度控制器**（MP4 变体 / HLS `levels` / DASH `bitrateInfo`），详见 [`player-quality-correction.md`](./player-quality-correction.md)。

> **关于"对象 vs 数字"的通用结论**：
> - 需要承载**多个字段**的东西 → 对象（如 `ProgressiveVariant`、`ThumbnailSheet`）
> - 只是**一个标识/数值** → 用原始类型（如 `default: 1080`、`volume: 0.8`、`startTime: 30`）
> - 需要"特殊值语义" → 用**字符串字面量**而不是魔数（`'auto'` 而不是 `0`）

---

## 三、问题 2：上一个/下一个按钮——显式传还是自动显示？

### 3.1 你的直觉是对的：应该自动

**理由**：

1. **prev/next 的"可显示性"完全由数据决定**：单视频没有"下一个"，硬显示只会让用户点了没反应（或报错）。
2. **用户不应该为了显示按钮而写配置**：写了 `episodes` 就已经表达了"这是个剧集"，按钮是**隐含结论**。
3. **主流一致**：JW Player 有 `playlist` 就自动出 prev/next；B站多P自动出选集；DPlayer 有列表才出。

### 3.2 但有一个"单视频也要 prev/next"的真实场景

业务上常见：视频源只有一个 `<video src>`，但"下一个视频"由后端接口决定，切换时整个页面跳转或换源。

这时用户**没有 episodes 数组**，但需要按钮。

### 3.3 最佳方案：**数据驱动 + 回调驱动，二选一都能触发**

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

### 3.4 推导规则（明确且可预测）

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

### 3.5 与 `playMode` 的关系

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

这是"自动推导"必须考虑的隐藏复杂度 —— **也是自动推导的风险：规则不透明**。所以文档必须把规则表公开（见第六章）。

---

## 四、问题 3：清晰度能否也自动识别？——**能，而且必须**

### 4.1 现状的问题：清晰度列表有两个来源

当前设计里，清晰度信息的可能来源：

| 位置 | 类型 | 用途 |
|---|---|---|
| `src: QualitySource[]` | 数组 | ⚠️ **仅 MP4 有效**（HLS/DASH 由 manifest 决定，不传） |
| 插件运行时（`hls.levels` / `getBitrateInfoListFor`） | 运行时发现 | ✅ **HLS/DASH 的真实来源** |
| `PlayerConfig.defaultQuality` | `QualityLevel` | 默认档 |
| `PlayerConfigEnum.QUALITIES` | 枚举键（**类型里不存在**） | 未实现 |

**问题**：如果再加一个 `quality.list`，就有**三处**可能定义清晰度，必然冲突。

### 4.2 ~~最佳方案：列表只来自 `src`~~ → **更正**

> ⚠️ **本节的推导规则是错的**，因为它假设「列表在配置解析期已知」。
> HLS/DASH 的列表在 `MANIFEST_PARSED` / `STREAM_INITIALIZED` 之前**根本不存在**。
> **正确方案见 [`player-quality-correction.md`](./player-quality-correction.md) §3–§4。**

**修正后的示意**：

```ts
// ① MP4 单档 → 不显示菜单
new VideoPlayer({ src: 'video.mp4' });

// ② MP4 多档 → 用户显式提供变体（唯一需要手填清晰度的场景）
new VideoPlayer({
  src: {
    type: 'mp4',
    qualities: [
      { height: 1080, url: 'https://cdn/1080.mp4' },
      { height: 720,  url: 'https://cdn/720.mp4' },
      { height: 480,  url: 'https://cdn/480.mp4' },
    ],
  },
  quality: { default: 'auto', max: 1080 },   // 只配"行为"，不配"数据"
});

// ③ HLS / DASH → ❌ 不传清晰度！manifest 里有
new VideoPlayer({
  src: { url: 'https://cdn/master.m3u8' },   // 类型自动推断为 hls
  quality: { default: 'auto', max: 1080 },   // 只配"行为"
});
// → 菜单在 MANIFEST_PARSED 后异步出现（列表来自 hls.levels）
```

**修正后的推导规则**（**运行时**，不是配置解析期）：
```
// 控制器就绪后（MP4 立即 / HLS·DASH 在 manifest 解析后）
qualityMode    = controller.kind              // 'none' | 'static' | 'adaptive'
qualities      = controller.list()            // 运行时列表，来源无关
currentQuality = controller.current()         // null = auto
supportsAuto   = controller.supportsAuto()    // MP4 → false

showQualityMenu = quality.showMenu === 'auto'
                    ? qualities.length > 1
                    : quality.showMenu
// max/min 不"过滤列表"，而是通过 controller.applyLimits() 映射到各库原生限制
```

### 4.3 为什么 `height: number` 优于 `'1080p'` 字符串

这是前面命名分析里提过的，这里补充"自动推导"视角的必要性：

| 场景 | 需要的能力 | `height: 1080` | `'1080p'` 字符串 |
|---|---|---|---|
| 菜单**排序**（高清在上） | 数值比较 | ✅ `b.height - a.height` | ❌ `'4k' > '1080p'`？字符串比较**错序** |
| 自动**降级**（卡了降一档） | 找下一档 | ✅ `qualities.filter(q => q.height < cur)` | ❌ 要先解析字符串 |
| `max`/`min` **限制** | 数值比较 | ✅ 直接比较 | ❌ 要先解析 |
| 显示文案 | 格式化 | ✅ `1080 → '1080P'` | ⚠️ 字符串本身就是文案，但没法生成 `'4K'` |
| 与 hls.js / Plyr 对接 | 生态一致 | ✅ `level.height` | ❌ 要映射 |

**（修正补充）最重要的一条理由**：**枚举/字符串根本无法表达 manifest 里的任意档位**。

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

## 五、问题 4：画中画 / mini / 网页全屏 / 全屏 应该怎样设置？

这是本次分析**最有价值的收敛点**。

### 5.1 先看清这 5 个功能的本质差异

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

### 5.2 现状问题：4 个独立布尔 = 32 种状态，大部分非法

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

### 5.3 最佳方案：收敛为**互斥枚举** + PiP 独立

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

### 5.4 统一 API 与事件

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

### 5.5 按钮如何推导（这一步很关键）

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

### 5.6 互斥管理由框架负责

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

## 六、完整推导规则表（必须公开给用户）

自动推导的**唯一风险是不透明**，所以框架文档必须给出完整规则表：

### 6.1 控件显示推导

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
| `prev` | 见 3.4 的 `hasPrevAvailable` | ✅ |
| `next` | 见 3.4 的 `hasNextAvailable` | ✅ |
| `episodes`（选集） | `episodes.length > 1` | ✅ |
| `setting` | 设置菜单中**至少有一项可用** | ✅ |
| `hotkeyPanel` | `interaction.keyboard !== false` | ✅ |
| `viewpoint` | `viewpoints?.length > 0` | ✅ |
| `fullscreen` | `display.modes` 含 `'fullscreen'`（含浏览器支持判断） | ✅ |
| `webFullscreen` | `display.modes` 含 `'webFullscreen'` | ✅ |
| `wideScreen` | `display.modes` 含 `'wideScreen'` | ✅ |
| `mini` | `display.modes` 含 `'mini'` | ✅ |
| `pip` | `display.pip` 解析为 true（含浏览器支持判断） | ✅ |

### 6.2 模式可用性推导（`display.modes: 'auto'` 时）

| 模式 | 推导条件 | 说明 |
|---|---|---|
| `fullscreen` | `document.fullscreenEnabled === true` | **原生能力**，不可覆盖为"支持" |
| `webFullscreen` | `true` | 无原生判据，纯 CSS 实现，默认可用 |
| `wideScreen` | `true` | 同上 |
| `mini` | `false` | 默认关闭（避免意外触发），需显式开启 |
| `pip` | `document.pictureInPictureEnabled === true` | **原生能力** |

### 6.3 强制覆盖的行为

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

## 七、这三个设计的收益对比

### 7.1 配置量对比（典型剧集播放器）

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
  src: { qualities: [...] },
  episodes: [...],                       // ← prev/next/选集 自动出现
  quality: { default: 'auto', max: 1080 },
  display: { pip: true },                // ← 只覆盖想改的
  // 全屏/网页全屏/宽屏按钮自动出现（按浏览器能力）
}
```

**配置从 6 行降到 4 行**，且新增能力（mini、选集）零配置。

### 7.2 状态模型对比

| | 旧 | 新 |
|---|---|---|
| 布局状态 | 3 个布尔（8 种组合，5 种非法） | 1 个枚举（5 个合法值） |
| PiP | 第 4 个布尔 | 独立布尔（合理的不同层） |
| 相关事件 | 4 个 | 2 个 |
| 切换 API | 4 个 `toggleXxx` | 1 个 `setDisplayMode` |
| 互斥保证 | 靠调用方自觉 | **框架内建** |

### 7.3 与主流对比（这几点的领先性）

| 能力 | Plyr | ArtPlayer | xgplayer | DPlayer | **本方案** |
|---|---|---|---|---|---|
| 控件自动推导 | ❌ | 部分 | 插件驱动 | 部分 | ✅ **完整规则表** |
| prev/next 数据驱动 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 清晰度自动识别 | ⚠️ 需配 options | ⚠️ 需配 quality 数组 | ❌ | ✅ | ✅ **从 src 推导** |
| 显示模式互斥建模 | ❌ 4 布尔 | ❌ 独立布尔 | ❌ | ❌ | ✅ **单一枚举** |
| 能力 vs UI 两层分离 | ❌ | ❌ | ⚠️ 部分 | ❌ | ✅ |
| 运行时能力兜底 | ⚠️ | ✅ | ⚠️ | ❌ | ✅ |

---

## 八、需要你确认的 4 个决策点

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

## 九、最终产出：这三块的完整类型

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
// 清晰度
// ============================================================

export interface QualitySource {
  /** 视频高度（像素），既是标识也是排序依据，0/省略表示未知 */
  height?: number;
  /** 源地址 */
  url: string;
  /** 展示文案（不传则由 height 推导，如 1080 → '1080P'） */
  label?: string;
  /** 码率 bps（可选，用于展示与自动选档） */
  bitrate?: number;
  /** 该源专属请求头 */
  headers?: Record<string, string>;
}
// ⚠️ 已重命名为 ProgressiveVariant，且**仅用于 MP4**（src.qualities）。
// 运行时统一模型是 QualityInfo；HLS/DASH 的列表来自 QualityController。
// @see docs/player-quality-correction.md

export interface QualityConfig {
  default?: number | 'auto';
  max?: number;
  min?: number;
  /**
   * @deprecated ❌ 已作废 —— HLS/DASH 的列表在配置期不存在，无法过滤
   * @see docs/player-quality-correction.md
   */
  // include?: number[];
  labels?: Record<number, string>;
  showMenu?: 'auto' | boolean;
  autoFallback?: boolean;
  fallbackThreshold?: number;
  /** 严格模式：目标高度不存在时不降级 @default false */
  strict?: boolean;
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

## 十、一句话总结

| 你的问题 | 答案 |
|---|---|
| **quality 改对象更好吗？** | ❌ **不要对象**。清晰度**条目**必须是对象（承载 url）；`quality.default` 用 **`number \| 'auto'`**（对象冗余 + 相等性陷阱 + 魔数问题）。"自动但限高"用独立字段 `max`/`min`，不用嵌套对象 |
| **prev/next 怎么表示？** | ✅ **数据驱动自动**：传 `episodes` 自动显示并自己切换；只有 `callbacks.prev/next` 时显示并委托业务；都没有则不显示 |
| **清晰度也能自动识别吗？** | ✅ **能，而且应该** —— 但要分清来源：**MP4 由用户传 `src.qualities`；HLS/DASH 由 manifest 运行时提供，用户不传**。菜单在**运行时列表** `length > 1` 时自动出现（HLS/DASH 是**异步**出现的）。详见 [`player-quality-correction.md`](./player-quality-correction.md) |
| **PiP/mini/网页全屏/全屏怎么配？** | ✅ **收敛为互斥枚举 `DisplayMode`**，一个 `display` 配置块 + 一个 `setDisplayMode()` API + 一个状态 + 一个事件。**不要 4 个布尔**（16 种组合、12 种非法） |

**贯穿始终的一条原则**（**修正后**）：

> **能推导的不配；要配的只配"意图"（intent），不配"结果"（result）；
> 而"能力与列表"既不是意图也不是结果 —— 它是运行时发现的事实。**

用户说"默认自动但别超 1080"（**意图** → 配置）、
"我提供 3 个 MP4 文件"（**数据** → `src.qualities`，**仅 MP4**）、
"manifest 里有 1080/720/480"（**运行时事实** → `hls.levels` / `getBitrateInfoListFor`，**用户不写**）。
三者不能混在同一个配置块里。

---

*分析结束。清晰度部分已按「运行时发现」模型修正，见 [`player-quality-correction.md`](./player-quality-correction.md)。确认后进入实现。*
