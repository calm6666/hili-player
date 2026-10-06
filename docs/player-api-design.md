# 播放器 API 重设计

> 状态：**设计已定稿，正在实施**
> 依据：对 `packages/player/src`、`core/`、`packages/plugins/src` 的代码勘察结果（下文所有「现状问题」均有文件与行号佐证）
> 相关文档：`docs/player-config-design.md`（11 命名空间方案）、`docs/player-quality-correction.md`（清晰度运行时模型）

---

## 一、现状问题清单（为什么必须重设计）

| # | 问题 | 证据 | 影响 |
|---|---|---|---|
| 1 | **配置是挂载期快照，无法动态更新** | `VideoPlayer.ts:226` 构造时 `this.props = mergePlayerConfig(...)`，此后无任何更新入口；`render()` 把 `src/autoplay/volume/muted` 一次性传给 `PlayerDocker` | 需求「所有配置可动态更新」无法实现 |
| 2 | **两份同名 `PlayerEventEnum`** | 根 `core/events.ts:147`（生效，值 `play`）与 `packages/player/src/core/events.ts:11`（死代码，值 `PLAY`） | 极易误用；类型漂移 |
| 3 | **三套事件通道、键名不一致** | `player.on('timeupdate')`（EventEmitter）、`player.events.on('timeUpdate')`（TypedEventBus）、`callbacks.timeupdate`；`qualitychange` vs `qualityChange` | 外部监听同一事件有三种写法，容易漏听 |
| 4 | **运行时状态双份维护** | `PlayerDocker` 的 `playerInfo`(L234)/`videoInfo`(L261) 与 `stateMgr`(L225) 各存一份 volume/currentTime/duration，靠手写同步 | 状态漂移；`dataScreen/isMinPlayer/qualityIndex` 只存在局部变量，**外部无法观测** |
| 5 | **弹幕开关链路断死** | 热键只 `lifecycle.emit("danmakuToggle")`，而 `render()` 未注册 `onDanmakuToggle`；`DanmakuPlugin` 监听 `PlayerEventEnum.DANMAKU_TOGGLE` 但**全仓库无处 emit** | 弹幕开关完全无效；`DanmakuConfig` 除 merge 外从未被读取 |
| 6 | **枚举与实现脱节** | `PlayerMethodEnum`（根 `core/events.ts:343`）声明了 `getVolume/getDuration/getBuffered/enterFullscreen` 等，`VideoPlayer` 上**不存在**；`LOADING/LOADED/DESTROY/WEB_FULLSCREEN_CHANGE` 等事件**从未 emit** | 文档/类型骗人 |
| 7 | **destroy 不彻底** | 不摘 `bindVideoEvents` 注册的 video 监听、不 `streamMiddleware.destroy()`、不 emit `DESTROY` | 复用 DOM 换视频会泄漏 |
| 8 | **档位 id 空间未统一** | HLS=levels 索引、DASH=representation index、MP4=sources 索引；`'auto'` 仅 HLS 支持 | 跨源切档语义不一致 |
| 9 | **DASH 无法在运行时切回自动档** | `DashPlugin.ts:644` `setQuality` 对 `'auto'` 直接 NaN 跳过；ABR 只在 load 时通过 `updateSettings` 设置 | 「自动清晰度」在 DASH 下不可用 |
| 10 | **`RowDm` 与 `DanmakuPlugin` 争抢同一弹幕容器** | `RowDm` 自建 `.player-row-dm-wrap` 并自行渲染；`DanmakuPlugin.ts:134` 又 querySelector 抓同一容器建 `DanmakuManager` | 两套渲染并存 |
| 11 | **多个组件导出但从未挂载** | `Toast`/`Loading`/`State`/`Top`/`Tooltips`/`VolumeHint`/`Selection`/`VideoInfo`/`Switch`/`Ending`/`Mini` 全仓库无 `h(...)` 渲染 | 「切换中/成功」UI 反馈缺载体 |
| 12 | **`smartMerge` 语义不清** | 既有实现里用作增量 diff，但本项目的版本此前是浅合并 | 已在本轮修正为真深合并 |

---

## 二、设计原则

1. **单一来源**：运行时状态只由 `TypedStateManager` 持有；事件契约只有一份；配置只有一份（可变的 `props`）。
2. **可观测**：任何会影响 UI 的内部状态，都必须进 `TypedStateManager`，外部才能订阅。
3. **可命令**：任何配置项都要有对应的 `setXxx` 运行期入口，且「设置即生效」。
4. **事件即契约**：`PlayerEventEnum` + `PlayerEventMap` 是唯一事件契约，枚举里声明的事件**必须真的会被 emit**；不再声明没有实现的事件。
5. **框架约束优先**：本项目无虚拟 DOM diff、无自动重渲染。因此配置/状态变化一律通过 **`state.subscribe` / `useState` 回调里命令式更新 DOM**，不依赖重渲染。
6. **向后兼容迁移**：配置改为命名空间后，**同时接受旧的扁平写法**，在开发环境给出迁移警告（避免一次性打断所有调用方）。

---

## 三、配置体系

### 3.1 命名空间结构（11 组）

顶层只保留资源类三项，其余按功能分组：

```ts
interface PlayerConfig {
  // ── 资源 ──
  container?: HTMLElement | string;
  src?: PlayerSource;            // 单源：string | ProgressiveVariant[] | MediaManifest 对象
  poster?: string;

  // ── 分组 ──
  playback?: {                   // 播放行为（键名沿用 HTMLMediaElement 惯例）
    autoplay?: boolean;
    muted?: boolean;
    volume?: number;
    playbackRate?: number;
    loop?: boolean;
    playMode?: PlayMode;         // ORDER | REPEAT_ALL | SHUFFLE
    preload?: 'none' | 'metadata' | 'auto';
    playsinline?: boolean;
    startTime?: number;
  };
  playlist?: MediaItem[];        // 🆕 播放列表（复用 DOM 换视频用）
  playlistIndex?: number;        // 🆕 初始播放第几个

  ui?: {
    title?: string;              // 原 playerName
    controls?: ControlsConfig;
  };
  interaction?: {
    keyboard?: boolean | { seekStep?: number; volumeStep?: number; holdRate?: number };
  };
  quality?: {
    default?: string | 'auto';   // 档位 id 或 auto
    mode?: 'auto' | 'manual';
    max?: number; min?: number;  // 高度上限/下限
    labels?: Record<string, string>;
  };
  progress?: {
    segments?: ProgressSegment[];
  };
  danmaku?: {
    enabled?: boolean;
    url?: string;                // 原 source
    visible?: boolean;
    opacity?: number;
    speed?: number;
    fontSize?: number;
    area?: number;
  };
  subtitle?: {
    enabled?: boolean;
    list?: SubtitleConfig[];
  };
  plugins?: { list?: Plugin[]; options?: Record<string, unknown> };
  storage?: { enabled?: boolean; prefix?: string };
  ssr?: { enabled?: boolean; placeholder?: string; deferHydration?: boolean };
  advanced?: { logLevel?: LogLevel; debug?: boolean };
  callbacks?: EventListeners;    // 保留：配置式事件回调
}
```

### 3.2 动态更新入口

```ts
/** 深合并进当前配置并立即应用差异（不重建播放器、不重建 DOM） */
setConfig(partial: DeepPartial<PlayerConfig>): void;

/** 读取当前生效配置（只读） */
getConfig(): Readonly<PlayerConfig>;
```

`setConfig` 的**应用矩阵**（这是「配置动态更新」的核心，逐项都要真的生效）：

| 配置项 | 应用方式 |
|---|---|
| `playback.volume/muted/playbackRate/loop` | 直接写 `video` 元素 + 同步 state |
| `playback.playMode` | 写 state；影响 `ended` 时的行为 |
| `src` / `playlist` | 触发 `load()` 换源（复用 DOM） |
| `poster` | 写 `.player-video-poster` 的 background |
| `ui.title` | 写容器 `aria-label` 与 Top 组件文本 |
| `ui.controls.*` | 写可变 config 对象 + 通知 `ConfigStore` 订阅者，控件按需显示/隐藏 |
| `interaction.keyboard` | 启用/禁用 keydown/keyup 监听；步长写入快捷键 ctx |
| `quality.*` | 重新计算生效档位并 `setQuality` |
| `progress.segments` | 重建进度条分段 DOM |
| `danmaku.*` | 写 state（visible/opacity/speed）+ 通知弹幕层；`url` 变化则重新拉取 |
| `subtitle.*` | 写 state + 通知字幕层 |
| `plugins` | 增量 `use` / `uninstallPlugin` |
| `advanced.logLevel` | 调整 logger 级别 |

**实现要点**：`PlayerDocker` 里现在的 `configCtx`（`ConfigContext`）是**只读快照**，需替换为可变的 **`ConfigStore`**（提供 `get(key)` / `subscribe(key, cb)`），子组件用 `useState(configStore, key, cb)` 订阅，从而支持控件开关的运行时切换。

### 3.3 兼容旧扁平写法

`normalizeConfig()` 同时识别旧键并转换到命名空间，开发环境 `warn` 提示迁移。映射表见 §九。

---

## 四、事件体系

> ⚠️ **本节「统一为一条通道」的主张已被 `docs/player-event-contract-design.md` 取代。**
> 现行决策：**对外门面保持小写多参数不变**（`PlayerEvents` 冻结，不新增/不删除/不改签名），
> 内部契约统一为 `core/events.ts` 的 `PlayerEventEnum` + `PlayerEventMap`；
> 两层之间由 `VideoPlayer.bridgeEvents()` 单向桥接，内部事件经 `player.events` 暴露。
> 因此下面 §4.1 的门面签名**不再实施**，§4.2 的事件全表也以那份文档 §4 的实测审计为准。

### 4.1 统一为一条通道

- **删除** `packages/player/src/core/events.ts`（死代码）。
- 唯一契约：根 `core/events.ts` 的 `PlayerEventEnum` + `PlayerEventMap`。
- 唯一门面：

```ts
on<K extends PlayerEventEnum>(type: K, handler: (payload: PlayerEventMap[K]) => void): () => void;
once<K extends PlayerEventEnum>(type: K, handler: (payload: PlayerEventMap[K]) => void): () => void;
off<K extends PlayerEventEnum>(type: K, handler: (payload: PlayerEventMap[K]) => void): void;
```

- `callbacks` 保留（配置式写法对业务方友好），但**键名与事件枚举严格一致**，构造时统一注册到 bus。
- `player.events` 仍可访问（供插件用），但外部优先用 `player.on`。

### 4.2 事件全表（枚举声明 = 一定会 emit）

**播放生命周期**：`ready` `mounted` `loadStart` `loadedMetadata` `loadedData` `canPlay` `canPlayThrough` `play` `pause` `playing` `ended` `waiting` `error` `errorRecovery` `destroy`

**时间/缓冲**：`timeUpdate` `progress` `durationChange` `seekStart` `seeked` `rateChange`

**音量/画面**：`volumeChange` `fullscreenChange` `webFullscreenChange` `wideScreenChange` `pipChange` `resize`

**清晰度（本次新增「切换中/成功」）**：
```ts
| 'qualityListChange'      // { qualities: QualityLevel[]; mode: QualityMode }
| 'qualityChangeRequested' // 🆕 切换中：{ from: string; to: string; quality?: QualityLevel }
| 'qualityChangeRendered'  // 🆕 切换成功：{ from: string; to: string; quality: QualityLevel; elapsed: number }
| 'qualityChangeFailed'    // 🆕 切换失败：{ from: string; to: string; reason: string }
| 'qualityChange'          // 兼容保留（等价于 rendered）
```

**弹幕**：`danmakuToggle`（`{ visible: boolean }`）`danmakuOpacityChange` `danmakuSpeedChange` `danmakuSend` `danmakuLoaded`

**字幕**：`subtitleToggle` `subtitleChange`

**交互/其它**：`contextMenu` `hotkeyPanelOpen` `hotkeyPanelClose` `like` `coin` `favorite` `tripleLike` `follow` `prev` `next` `episodeChange`

> **原则**：枚举里不允许出现「声明了但永不 emit」的事件；实现里不允许 emit 「枚举未声明」的事件。

---

## 五、状态体系（单一来源）

### 5.1 以 `TypedStateManager` 为唯一运行时状态源

删除 `PlayerDocker` 的 `playerInfo` / `videoInfo` 局部对象，把其字段全部并入 `PlayerStateMap`：

```ts
// 新增 / 补全的状态键
'player.displayMode':      'normal' | 'web' | 'wide' | 'mini'  // 原 dataScreen
'player.isWideScreen':     boolean      // 已有
'player.isMinPlayer':      boolean      // 🆕 原仅局部
'player.qualityCurrent':   string       // 档位 id 或 'auto'
'player.qualityMode':      'none' | 'static' | 'adaptive'
'player.qualitySwitchState': 'idle' | 'switching' | 'switched' | 'failed'  // 🆕
'player.playlistIndex':    number       // 🆕
'player.playlistLength':   number       // 🆕
'player.danmakuVisible':   boolean      // 已有
'player.danmakuOpacity':   number       // 已有
'player.danmakuSpeed':     number       // 已有
'player.subtitleVisible':  boolean      // 已有
```

### 5.2 状态 → UI 的唯一通路

统一为：**设置方 `state.set(key, v)` → 订阅方 `useState(state, key, cb)` 在回调里改 DOM**。
移除「一个状态被两条链路分别驱动 UI」的情况（现状：音量既有 `state` 订阅、又有 `PlayerDocker.handleVolumeChange` 直接调 `controlsApi`）。

> 例外的**命令式桥接**保留：如 `progressBarApi.updateProgress()` 这类「高频、需要直接操作子组件内部 DOM」的，仍走 API 回传，但触发源统一为 state 订阅，不再由 PlayerDocker 的事件处理函数直接调。

---

## 六、清晰度体系

### 6.1 三种来源 → 三个 Provider，统一接口

| 媒体类型 | 清晰度来源 | Provider | 档位 id 语义 |
|---|---|---|---|
| 普通 MP4 | **配置文件** `src: ProgressiveVariant[]` | `NativeQualityProvider`（框架内置） | variant 数组索引 |
| HLS | **`.m3u8` URL** 或 **JSON 清单对象** | `HlsPlugin` | levels 索引 |
| DASH | **`.mpd` URL** 或 **JSON 清单对象** | `DashPlugin` | video representation 索引 |
| FLV | 不支持多码率 | `FlvPlugin` | — |

统一接口（已有，略作补全）：

```ts
interface QualityProvider {
  getQualities(): QualityLevel[];                         // 含 auto 档（isAuto: true）时放在首位
  getCurrentQuality(): string;                            // 'auto' 或档位 id
  setQuality(id: string): void;                           // 'auto' → 交给库的 ABR
  supportsAutoQuality(): boolean;
  onQualitiesChange?(cb: (list: QualityLevel[]) => void): () => void;
  applyLimits?(limits: { max?: number; min?: number }): void;
}
```

### 6.2 从 `.m3u8` / `.mpd` 取清晰度（新增 `ManifestParser`）

现状：`manifestToHls` / `manifestToDash` **只做「JSON 对象 → 库内部对象」**，**没有反向文本解析**；`.m3u8`/`.mpd` URL 直接交给 hls.js / dash.js，拿不到可读的档位列表。

新增 `packages/plugins/src/vendor/manifest-parser.ts`：

```ts
/** 解析 m3u8 主播放列表 → 档位信息（#EXT-X-STREAM-INF 的 BANDWIDTH/RESOLUTION/CODECS） */
export function parseHlsManifest(text: string, baseUrl: string): HlsManifestData;

/** 解析 MPD → 档位信息（AdaptationSet/Representation 的 bandwidth/width/height/codecs） */
export function parseDashManifest(text: string, baseUrl: string): MediaManifest;

/** 按 URL 扩展名拉取并解析（.m3u8 / .mpd） */
export function fetchAndParseManifest(url: string): Promise<HlsManifestData | MediaManifest>;
```

用途：DASH/HLS 在**不依赖库**的情况下也能给出档位列表，且是「从 m3u8/mpd 获取清晰度」这条需求的直接实现。解析失败时降级为「由库在 `MANIFEST_PARSED`/`streamInitialized` 后回调提供列表」。

### 6.3 自动档与手动档

- **自动档**：`QualityLevel{ id: 'auto', isAuto: true, label: '自动' }` 固定排在列表首位。
- HLS：`currentLevel = -1` 开 ABR，读 `hls.currentLevel` 判断当前是否 auto，`LEVEL_SWITCHED` 里回传实际档位。
- DASH：**补齐运行时切回 auto**（`updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } })`）；`getCurrentQuality()` 依据 `abr.autoSwitchBitrate` + `getQualityFor('video')` 判定。
- MP4：无 ABR，`supportsAutoQuality() => false`，但**列表仍可含 auto 项表示「默认档」**，避免 UI 不一致。

### 6.4 切换的「中 / 成功 / 失败」——UI 反馈（本次新增）

`VideoPlayer.setQuality(id)` 改为带生命周期：

```
setQuality(id)
  ├─ 若 id === 当前 → 直接返回
  ├─ state.set('player.qualitySwitchState', 'switching')
  ├─ emit QUALITY_CHANGE_REQUESTED { from, to }
  │    → UI：Loading 显示「正在切换至 1080P…」
  │          菜单项加 loading 态；result 文案变「切换中」
  ├─ provider.setQuality(id)
  └─ 等待成功信号（HLS: LEVEL_SWITCHED；DASH: qualityChangeRendered；MP4: loadedmetadata）
       ├─ 成功 → state.set('...','switched') + emit QUALITY_CHANGE_RENDERED { elapsed }
       │          → UI：Toast「已切换至 1080P」+ 菜单选中态 + result 文案更新 + 隐藏 Loading
       ├─ 失败 → emit QUALITY_CHANGE_FAILED + Toast 错误提示
       └─ 超时（默认 10s，可配）→ 视为失败
```

对应的 UI 载体（**需先挂载**）：
- `Toast`（已实现 `showAutoToast`）→ 切换成功/失败提示
- `Loading`（已实现 `show/hide/setText`）→ 切换中提示
- `QualityMenu` → 菜单项 loading 态（`player-state-loading`）+ result 文案

---

## 七、媒体加载与播放列表（复用 DOM 切换视频）

### 7.1 播放列表模型

```ts
interface MediaItem {
  id?: string;
  src: PlayerSource;            // string | ProgressiveVariant[] | MediaManifest
  title?: string;
  poster?: string;
  startTime?: number;
  danmakuUrl?: string;
  subtitleList?: SubtitleConfig[];
}
```

### 7.2 换源 API（复用同一 video 元素与整棵 DOM）

```ts
load(source: PlayerSource, options?: { startTime?: number; autoplay?: boolean }): Promise<void>;
switchTo(index: number): Promise<void>;   // 播放列表内跳转
next(): Promise<void>;
prev(): Promise<void>;
getPlaylist(): ReadonlyArray<MediaItem>;
getCurrentIndex(): number;
```

**换源流程（复用 DOM 的关键）**：

1. `loadToken++`（竞态守卫，过期回调直接丢弃）
2. `pause()`；清空错误态；进度归零
3. **弹幕**：清空弹幕层 DOM、重置 `lastTimePoint`、按新 `danmakuUrl` 重新拉取
4. **流媒体**：若当前是 STREAMING 模式 → 让插件 `load(新配置)`（插件内部复用同一 `<video>` 与库实例，不重建）；否则设 `videoEl.src`
5. 等待 `loadedmetadata`（**修复现状 bug**：原 `setQuality` 未等 `loadedmetadata` 就设 `currentTime`，会被截断）→ 再设 `currentTime = startTime ?? 0`
6. 按需 `play()`
7. emit `loadStart` / `loadedMetadata` / `episodeChange`

**保留**：整棵 DOM、`<video>` 元素、UI 组件实例与 API、插件实例、事件订阅、当前配置。
**重置**：进度、错误态、弹幕内容、`currentSourceIndex`、清晰度选中态（若新源档位列表不同则重建列表）。

### 7.3 destroy 补全（复用 DOM 的前提）

补：移除 `bindVideoEvents` 注册的全部 video 监听、`streamMiddleware.destroy()`、`pluginMonitor`/观察器断开、emit `DESTROY`。

---

## 八、动态设置 API 全表

统一命名：动作 `setXxx` / 查询 `getXxx` / 布尔查询 `isXxx` / 播放列表 `next|prev|switchTo`。

| 分类 | API | 生效方式 |
|---|---|---|
| 播放 | `play()` `pause()` `toggle()` `seek(t)` `seekBy(delta)` `reload()` | 直接作用 video + 同步 state |
| 音量 | `setVolume(v)` `getVolume()` `setMuted(b)` `isMuted()` `toggleMute()` | video + state + UI 订阅 |
| 倍速 | `setPlaybackRate(r)` `getPlaybackRate()` `setPlayMode(m)` `setLoop(b)` | 同上 |
| 画面 | `toggleFullscreen()` `exitFullscreen()` `toggleWebFullscreen()` `isWebFullscreen()` `toggleWideScreen()` `togglePip()` `setDisplayMode(m)` | 容器类名/属性 + state |
| 清晰度 | `getQualities()` `getCurrentQuality()` `setQuality(id)` `setQualityMode('auto'\|'manual')` `applyQualityLimits({max,min})` | provider + state + 切换 UI |
| 媒体 | `load(src, opts)` `next()` `prev()` `switchTo(i)` `getPlaylist()` `getCurrentIndex()` `setPoster(url)` | §七 换源流程 |
| 弹幕 | `setDanmakuVisible(b)` `toggleDanmaku()` `isDanmakuVisible()` `setDanmakuOpacity(v)` `setDanmakuSpeed(v)` `setDanmakuSource(url)` `sendDanmaku(text, opts)` `clearDanmaku()` | state + 弹幕层 API |
| 字幕 | `setSubtitleVisible(b)` `setSubtitleLang(lang)` `setSubtitleList(list)` | state + 字幕层 API |
| 配置 | `setConfig(partial)` `getConfig()` | §三 应用矩阵 |
| 插件 | `use(p)` `uninstallPlugin(name)` `getPlugin(name)` `getPluginAPI(name)` | 已有 |
| 查询 | `getState()` `getDuration()` `getCurrentTime()` `getBuffered()` `isPaused()` `isPlaying()` `isFullscreen()` | 读 state |
| 事件 | `on(type, cb)` `once(type, cb)` `off(type, cb)` | §四 |
| 生命周期 | `mount(container)` `hydrate(container)` `destroy()` | 已有 + 补全 |

> **补全说明**：`getDuration/getCurrentTime/getBuffered/isPaused` 等是 `PlayerMethodEnum` 里已声明但**实现缺失**的，本次补齐，使枚举与实现一致。

---

## 九、迁移对照表（旧 → 新）

| 旧（扁平） | 新（命名空间） | 备注 |
|---|---|---|
| `playerName` | `ui.title` | |
| `controlBtns` | `ui.controls` | 本轮已由 `controlBtns` 改为 `controls`，再并入 `ui` |
| `keyboard` | `interaction.keyboard` | 支持对象形式配置步长 |
| `defaultQuality` | `quality.default` | 类型为档位 id 字符串 |
| `progressSegments` | `progress.segments` | |
| `danmaku.source` | `danmaku.url` | 本轮已改为 `url` |
| `danmaku.{enabled,visible,opacity,speed}` | 同名 | 仅位置变化 |
| `subtitles` | `subtitle.list` | |
| `subtitle.default` | `subtitle.isDefault` | 本轮已改 |
| `plugins` | `plugins.list` | |
| `debug` | `advanced.debug` | 另加 `advanced.logLevel` |
| `ssr` | 同名 | |
| `autoplay/muted/volume/playbackRate/loop/playMode/preload/playsinline` | `playback.*` | 键名不变，仅位置变化 |
| `container/src/poster` | 同名 | 保持顶层 |

**兼容策略**：`normalizeConfig()` 同时接受新旧两种写法，旧写法在开发环境打印迁移警告。**不硬性破坏**。

---

## 十、实施顺序

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **A** | 事件体系统一（删死枚举、统一门面、补全事件、新增清晰度切换事件） | 无 |
| **B** | 状态单一来源（扩展 `PlayerStateMap`、移除 `playerInfo`/`videoInfo`、统一状态→UI 通路） | 无 |
| **C** | 配置命名空间 + `setConfig` + `ConfigStore` + 兼容层 | A、B |
| **D** | 清晰度：`ManifestParser`（m3u8/mpd）、三源 Provider、auto/手动、切换生命周期 | A、B |
| **E** | 切换中/成功 UI：挂载 `Toast`/`Loading`、接线到 D 的事件 | D |
| **F** | 媒体换源与播放列表（`load/next/prev/switchTo`）+ `destroy` 补全 | B、C |
| **G** | 动态设置 API 全表补齐（弹幕/字幕/画面/查询） | B、C |
| **H** | 多分段进度条 | B |
| **I** | `QualityOption` 清理、文档合并 | D |
| **J** | **控件交互接线**（见下节） | B、C |

### 阶段 J：控件交互接线（补录）

> **背景**：阶段 A–I 完成后做真实挂载验证时发现——控件条的交互**从未实现过**。
> `git show HEAD:packages/player/src/components/PlayerDocker.ts` 显示，改动前
> `h(Controls, {...})` 只传了 `duration` / `volume` / `backrate` 三个**数据**属性，
> **一个事件处理器都没有**。而 `ControlsEvents` 声明了 23 个事件，
> 因此播放/暂停、进度拖拽、音量、静音、倍速、全屏、画中画、上下分 P、
> 选集、设置、tooltip 全部断在中间层——这正是「播放器什么都不可以用」的根因。

**契约核对表**（`ControlsEvents` → `PlayerDocker` 应有的动作）：

| Controls 事件 | 载荷 | PlayerDocker 应执行 |
|---|---|---|
| `controlsMounted` | `ControlsAPI` | 填充 `controlsApi`（时间/音量/缓冲等显示更新的入口） |
| `playPause` | — | `togglePlayPause()` |
| `seek` | `number` | 设置 `currentTime` + 同步 `CURRENT_TIME` 状态 |
| `seekStart` | — | 置 `IS_SEEKING = true` |
| `seekEnd` | — | 置 `IS_SEEKING = false` |
| `volumeChange` | `number` | `setVolume(v)` |
| `muteToggle` | — | `toggleMute()` |
| `backrateChange` | `number` | 写 `video.playbackRate` + `PLAYBACK_RATE` 状态 |
| `fullscreenToggle` | — | `toggleFullscreen()` |
| `pipToggle` | — | `togglePip()` |
| `webFullscreenToggle` | — | `toggleWebFullscreen()` |
| `prev` / `next` | — | 向上 emit，由 `VideoPlayer.prev()/next()` 处理 |
| `eplistChange` | `string` | 向上 emit，由 `VideoPlayer.switchTo()` 处理 |
| `settingChange` | `{key, value}` | 应用到对应画面/播放设置 |
| `moreSettingClick` | — | 打开更多设置面板 |
| `showTooltip` / `hideTooltip` | `Tooltip` | 转发给 tooltip 层 |
| `menuAnimation` | `{type, action}` | 菜单展开/收起动画 |
| `stateChange` | `unknown` | 同步播放状态 |

**验收标准**：真实挂载后逐个派发事件，`stateMgr` 中对应状态必须发生变化（不能只检查元素存在）。

