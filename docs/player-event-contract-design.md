# 播放器事件契约设计（对外兼容 / 内部统一）

> 状态：**设计稿 — 待实现**
> 决策来源：用户明确的三条约束 + 两次追加决策（见 §2、§10）
> 相关文档：`docs/player-api-design.md` §四（事件体系，本文档细化并修正其过时部分）、`docs/component-communication-analysis.md`、`docs/plugin-context.md` §4.3
> 术语：**门面** = 对外事件 API；**契约** = 内部事件契约；**桥接** = 契约 → 门面的单向转发。

---

## 1. 背景

事件目前有两套并存的表示：

| 层 | 定义位置 | 键形态 | 回调形态 | 投递者 |
|---|---|---|---|---|
| **门面（对外）** | `types/index.ts` 的 `PlayerEvents` | 小写（`timeupdate` / `volumechange`） | **多参数** | `EventEmitter`（`this.emitter`） |
| **契约（内部）** | `core/events.ts` 的 `PlayerEventEnum` + `PlayerEventMap` | camelCase（`timeUpdate` / `volumeChange`） | **单 payload** | `TypedEventBus`（`this.events`） |

两者由 `VideoPlayer.bridgeEvents()` 以**手写映射**单向连接（契约 → 门面），把 payload 窄化/展开成门面的多参数形态。

`docs/player-api-design.md` §4.1 曾主张「统一为一条通道」（门面也改成枚举键 + 单 payload）。**本设计不采用该主张**：对外门面保持小写多参数不变，只把内部契约收敛为唯一来源，并让契约层的事件通过统一路由在 `player.on` 上同样可达。

---

## 2. 硬约束（用户决策）

| # | 约束 | 含义 |
|---|---|---|
| **C1** | **既有对外事件 API 不变** | 现有 28 个小写键的**键名、参数个数与顺序、语义一律不变**（不删除、不改名、不改签名）；**允许新增**键 |
| **C2** | **内部契约唯一** | `core/events.ts` 的 `PlayerEventEnum` + `PlayerEventMap` 是唯一事件契约；枚举值即键，payload 为单对象/undefined |
| **C3** | **功能不变** | 除修复 §4 中的「坏承诺」「死监听」外，不改变任何现有行为 |
| **C4** | **37 个内部事件双通道可达** | 既可用 `player.events.on('<枚举值>', payload => …)`，也可用 `player.on('<枚举值>', payload => …)`（camelCase 直连契约层）；同时补进 `PlayerEvents` 类型声明 |

> **C1 与 C4 的关系**：C1 冻结**既有小写键**（保证老调用方零破坏）；C4 允许**新增 camelCase 键**（把内部事件补齐到同一入口）。两者共同构成「对外不破坏、对内全覆盖」。
>
> **过程记录**：C4 最初定为「门面零新增，只走 `player.events`」，随后用户改为「违反 C4 的改动不回退」——即接受新增门面键与双通道路由。本文档按后者定稿。

---

## 3. 目标架构

```
                        ┌──────────────────────────────────────────────┐
   外部业务代码 ────────►│ 门面 / 统一入口（player.on / once / off）      │
                        │                                              │
                        │  ① 小写键（既有，冻结）  → EventEmitter       │
                        │     多参数回调，经桥接自契约层适配             │
                        │  ② camelCase 键（新增）  → TypedEventBus      │
                        │     单 payload，直连契约层                    │
                        └───────▲──────────────────────▲───────────────┘
                                │ 桥接（契约→门面）      │ 直连（同键名）
                        ┌───────┴──────────────────────┴───────────────┐
   插件 / 内部组件 ────►│ 契约层（唯一）                                │
                        │  PlayerEventEnum + PlayerEventMap            │
                        │  player.events.on / emit                     │
                        └──────────────────────────────────────────────┘
```

### 3.1 通道路由规则（`VideoPlayer.resolveEventChannel`）

给定事件名 `name`：

1. `name` **是已桥接的契约键**（如 `progress` / `error` / `play`）→ **门面**。
   走门面是为了避免同一事件被两条通道重复投递，并保留桥接时已按对外签名适配的 payload（例如 `progress` 的 `TimeRanges`）。
2. 否则 `name` **是契约键**（如 `qualityListChange` / `seekStart` / `abort`）→ **契约层直连**（单 payload）。
3. 否则 → **门面**（既有小写键，如 `timeupdate`；或门面专属键，如 `click`）。

`on` / `once` / `off` 三者必须用同一规则，否则取消订阅会失配。

### 3.2 门面专属事件（不在契约枚举内）

`click`、`dblclick`、`sendDanmaku` 属于**纯 DOM 交互透传**，不参与跨组件广播语义（与 `component-communication-analysis.md` §2.4「DOM 交互类保留回调」一致），因此**只在门面上存在**，不进契约枚举：

- `click` / `dblclick`：由视频区（`PlayerDocker` 的 perch）交互上抛，`VideoPlayer.render()` 接到后转发到 `emitter`。
- `sendDanmaku`：发送栏提交时由 `VideoPlayer` 直接转发到 `emitter`。

### 3.3 `callbacks`（配置式回调）的覆盖范围

`EventListeners = { [K in keyof PlayerEvents]?: PlayerEvents[K] }` 是对门面的映射类型，因此 **§6 P5 新增的 37 个契约键会自动出现在 `callbacks` 的可选键里**。

现状：`callbacks` 走的是 **29 处手写直调**（`this.callbacks.timeupdate?.(…)` 等），只覆盖既有小写键中的一部分。若不处理，`callbacks: { qualityListChange: fn }` 会**通过类型检查但永不触发**——这正是本设计要消灭的「坏承诺」。

**处置（随 P5 一起做，零行为变更）**：构造函数里在 `bridgeEvents()` 之后追加一次注册，只把「路由到契约层」的 `callbacks` 项挂到总线上：

```ts
/** 把 callbacks 中以契约键给出的项注册到总线（小写门面键仍走既有直调，避免双发） */
private registerBusCallbacks(): void {
  for (const [key, fn] of Object.entries(this.callbacks)) {
    if (typeof fn !== 'function') continue;
    if (this.resolveEventChannel(key) === 'bus') {
      this.bridgeUnsubscribes.push(this.events.on(key as never, fn as never));
    }
  }
}
```

判定条件是 `resolveEventChannel(key) === 'bus'`，因此：

- **既有小写键**（`timeupdate` 等）→ 判为 `emitter`，**跳过**，继续由既有 29 处直调负责，**不会双发**；
- **已桥接的契约键**（`play` / `progress` 等）→ 判为 `emitter`，**跳过**，继续由既有直调负责，**不会双发**；
- **未桥接的契约键**（`qualityListChange` / `seekStart` / `abort` 等）→ 判为 `bus`，注册到总线，**首次真正生效**。

取消函数并入 `bridgeUnsubscribes`，随 `destroy()` 统一清理。

---

## 4. 现状审计（对 `HEAD` 实测）

统计口径：`git show HEAD:<file>` 读取，脚本扫描全部已跟踪 `.ts`。

| 指标 | 数量 |
|---|---|
| 契约键（`PlayerEventMap` 成员） | 69 |
| `PlayerEventEnum` 成员 | 68 |
| 实际会被 emit 的契约键 | 63 |
| 已桥接到门面的契约键 | 24 |
| 门面 `PlayerEvents` 键（HEAD） | 28 |
| `emitter.emit('<键>')` 实际使用的键 | 25 |

> **统计口径**：按**事件键的字符串值**统计，而非按「引用了 `PlayerEventEnum.X`」统计。
> 后者会漏判（见 §4.4 的两条审计陷阱），初稿即因此出现过误判。

### 4.1 MISMATCH-A：契约已 emit、门面拿不到（39 个）

`abort` `canPlayThrough` `danmakuClear` `danmakuLoaded` `danmakuOpacityChange` `danmakuSend` `danmakuSent` `danmakuSpeedChange` `danmakuToggle` `emptied` `episodeChange` `errorRecovery` `interactionCoin` `interactionCollect` `interactionFollow` `interactionLike` `mounted` `mutedChange` `nextRequest` `playlistChange` `prevRequest` `qualityChangeFailed` `qualityChangeRendered` `qualityChangeRequested` `qualityListChange` `qualityModeChange` `restoreProgress` `seekEnd` `seekStart` `stalled` `subtitleLangChange` `subtitleListChange` `subtitleSwitch` `subtitleToggle` `suspend` `webFullscreenChange` `wideScreenChange`

**处置（按 C4）**：全部经 §3.1 规则 2 在 `player.on` 上直达契约层，并补进 `PlayerEvents` 类型声明。
其中 `abort/emptied/stalled/suspend` **无需新增桥接**——它们本就在契约层 emit，路由即生效（原先「门面声明了却收不到」的根因就是缺乏这条路由）。

### 4.2 MISMATCH-B：门面声明了、但外部收不到（6 个）

| 键 | 契约层是否 emit | 处置 |
|---|---|---|
| `abort` / `emptied` / `stalled` / `suspend` | ✅ 已 emit | 由 §3.1 路由自动生效，**不需要桥接** |
| `click` | ❌ 全仓从不 emit | **补齐实现**：视频区 click 时转发（§3.2） |
| `dblclick` | ❌ 全仓从不 emit | **补齐实现**：视频区 dblclick 时转发（§3.2） |

### 4.3 MISMATCH-C：门面收到了、但未声明（3 个）

`destroy` `resize` `sendDanmaku` —— 三者都已由 `emitter.emit()` 投递（`destroy`/`resize` 另经桥接自契约层）。**处置：补齐为纯类型声明**（零运行时改动）。

### 4.4 MISMATCH-D：契约声明了、但全仓从不 emit（6 个）

| 枚举成员 | 值 | 现有监听者 | 应由谁发出 |
|---|---|---|---|
| `INTERACTION_LINK_CLICK` | `interactionLinkClick` | `plugins/src/interaction/index.ts:207` | 外链卡片点击时 |
| `INTERACTION_VOTE_SELECT` | `interactionVoteSelect` | `interaction/index.ts:213` | 投票选项被选中时 |
| `INTERACTION_SCORE_SELECT` | `interactionScoreSelect` | `interaction/index.ts:219` | 评分被选择时 |
| `INTERACTION_CARD_CLOSE` | `interactionCardClose` | `interaction/index.ts:225` | 互动卡片关闭时 |
| `INTERACTION_POSITION_CHANGE` | `interactionPositionChange` | `interaction/index.ts` | 拖拽落点变化时 |
| `STREAM_ERROR` | `streamError` | 无 | HLS/DASH/FLV 插件错误分支 |

> **审计陷阱（初稿两次误判的记录）**
> 1. **正则漏 `?.` 可选链**：初稿用 `events\.emit\(` 统计，漏掉了 `PlayerDocker.ts` 的 `props.events?.emit(PlayerEventEnum.DANMAKU_SENT, …)`，导致 `danmakuSent` 被误列为「从未 emit」。该事件确有一次 emit，但发生在**用户提交弹幕时**（紧邻 `DANMAKU_SEND`），语义是「请求」而非「成功」——故它不从 D 类走，改为按处置第 3 条**对齐语义**。
> 2. **同名枚举 / 值来自另一个枚举**：插件里 `StreamPluginEventEnum` 有**两份定义** —— `packages/plugins/src/stream/enums.ts`（值全大写，如 `QUALITY_CHANGE = 'QUALITY_CHANGE'`）与 `types/streamPlugin.ts`（值如 `QUALITY_CHANGE = 'streamQualityChange'`、`ERROR = 'STREAM_ERROR'`）。三个流媒体插件**实际 import 的是后者**。初稿按「引用了 `PlayerEventEnum.X`」统计，因此把 `streamQualityChange` 误判为「从未 emit」——**实际上它一直在发，`VideoPlayer.ts:443` 的监听器从未失效**。真正的缺陷是同族的 `streamError`：`StreamPluginEventEnum.ERROR = 'STREAM_ERROR'`（大写）≠ 契约键 `streamError`。

**根因**：**插件侧从不向播放器总线 `emit`**（`packages/plugins` 下 `player.events.emit(...)` 命中 **0 处**；HEAD 上只有 `PlayerDocker.ts` 与 `VideoPlayer.ts` 在 emit）。插件只订阅、不发布，因此这批「应插件发出」的事件永远不来。

**处置（按 C3「补齐实现」）**：
1. 为插件开放发布能力（插件已持有 `player.events` 引用，只是从未调用 `emit`）；这同时是 `DEVELOPMENT_DESIGN.md` 附录 S「场景 3：插件间通信 → EventBus」的要求。
2. 上表 6 个事件的发射点逐个落地。
3. **`danmakuSent` 语义对齐**：删除 `PlayerDocker.ts` 在**用户提交时**误发的那次 `DANMAKU_SENT`（属请求语义），改由 `DanmakuPlugin` 在**服务器确认成功**时发出；否则「提交」会被当成「发送成功」。

### 4.5 死监听（有监听者、永远等不到）

| 事件 | 监听位置 | 影响 |
|---|---|---|
| `interactionLinkClick` / `interactionVoteSelect` / `interactionScoreSelect` / `interactionCardClose` / `interactionPositionChange` | `packages/plugins/src/interaction/index.ts` | 互动子插件与父插件之间的通知链路整条失效；本次已补齐发射点 |

> `streamError` 在 HEAD 上**既无 emit 也无监听者**，属「缺席」而非「死监听」，已在 §4.4 处置。

### 4.6 R3 违规：非契约键被发到播放器总线（待决策）

三个流媒体插件在 `install` 里执行 `this.eventBus = player.events`，因此它们的 `StreamPluginEventEnum` 上报**全部落在播放器总线上**。而 `types/streamPlugin.ts` 里该枚举的值多为**大写前缀形式**，不在契约键集合内：

`STREAM_LOAD_COMPLETE` `STREAM_METADATA_LOADED` `STREAM_PLAY_START` `STREAM_PLAY_PAUSE` `STREAM_BUFFER_START` `STREAM_BUFFER_END` `STREAM_STATS_UPDATE` `STREAM_NETWORK_ERROR` `STREAM_DECODE_ERROR` `STREAM_ERROR`（HLS/DASH/FLV 合计数十处 emit）

按 **R3**（实现里不得 emit 契约未声明的事件），这些属违规：它们没有契约监听者，却污染总线名字空间。

**处置：已选「乙」并已实现**（用户决策）：

- 三个插件各自持有**私有总线**：新增 `packages/plugins/src/stream/streamEventBus.ts`，`createStreamPluginEventBus()` 复用 `@/core/eventBus` 的既有工厂；类型 `StreamPluginEventMap` **刻意不收录 `QUALITY_CHANGE`**，误用会编译期报错（该键值恰等于契约键，必须走播放器总线）。
- **50 处** `StreamPluginEventEnum` 上报迁到私有总线（HLS 20 / DASH 17 / FLV 13）；播放器总线只剩契约事件 `streamError` 与 `streamQualityChange`，**payload 逐字不变**。
- 三个插件新增只读访问器 `getStreamEventBus()`，包入口导出总线工厂与类型。
- **仓内对这批大写键的订阅者实测为 0**，因此不存在需要改接的消费方。
- 验收：`packages/plugins` 与根级 `tsc` 均 0 error、`pnpm build` 退出码 0；另有临时 vitest + jsdom 运行期验证（私有总线收到、在播放器总线上用老键订阅**收到 0 次**；FLV 的 `streamQualityChange` payload 与改造前逐字一致）。
- 「甲」「丙」作为备选记录在案。

**遗留（如实登记）**：
1. `StreamPlugin` 接口未加可选的 `getStreamEventBus?()`，持有泛型 `StreamPlugin` 的消费方需具体类或类型断言（一行改动，待定）。
2. 私有总线在 `uninstall()` 后**常驻且不清理订阅者**（`TypedEventBus` 无 `clear()`）：卸载后私有事件不再被丢弃而是继续投递，属**语义变宽**，消费方需自行退订。
3. 包入口的 `StreamPluginEventEnum` 导出来源由 `./stream/enums` 改为 `@/types/streamPlugin`（前者与运行时键对不上、根本无法用于订阅）。仓内 0 处引用，属修正；`stream/enums.ts` 中那份同名枚举成为死代码。

---

## 5. 规则（实现必须遵守）

| # | 规则 |
|---|---|
| **R1** | 枚举成员 ⊆ `PlayerEventMap`；枚举值即事件键。 |
| **R2** | 枚举里**不得**出现「声明了但永不 emit」的事件（4.4 清零后生效）。 |
| **R3** | 实现里**不得** emit 枚举未声明的事件（契约层）。门面专属键（§3.2）不在此限。 |
| **R4** | 门面里每个键都**必须**真的会被投递（靠路由或桥接），否则属于坏承诺。 |
| **R5** | 门面的键集合**只增不减**：既有 28 个小写键的名称与签名冻结；新增键一律走 §3.1 规则 2（camelCase 直连契约层）。 |
| **R6** | 插件与内部组件一律使用 `PlayerEventEnum` 常量，禁止写字符串字面量。 |

---

## 6. 逐条处置与影响面

| # | 处置 | 影响文件 | 验收 |
|---|---|---|---|
| **P1** | ~~补 4 条桥接~~ **已由 §3.1 路由取代**，无需桥接 | — | `player.on('abort'…'suspend')` 能收到 |
| **P2** | `click` / `dblclick` 真正发出（门面专属，见 §3.2） | `PlayerDocker.ts`、`VideoPlayer.ts` | 点击/双击视频区时门面回调触发 |
| **P3** | 7 个空承诺事件的发射点补齐（4.4 表） | `plugins/src/interaction/*`、`hls/HlsPlugin.ts`、`dash/DashPlugin.ts`、`flv/FlvPlugin.ts`、`danmaku/DanmakuPlugin.ts` | 对应监听者（含 `VideoPlayer.ts:443`）被触发 |
| **P4** | `destroy` / `resize` / `sendDanmaku` 类型声明 | `types/index.ts` | `tsc` 0 error；运行时零变化 |
| **P5** | 37 个契约事件补进 `PlayerEvents` 类型声明 | `types/index.ts` | `tsc` 0 error；`player.on('<枚举值>')` 的类型可用 |
| **P6** | 审计结论与本文档同步、修正 `player-api-design.md` §四 | `docs/*` | 文档不再自相矛盾 |
| **P7** | R3 收敛：流媒体插件改用私有总线（§4.6 乙方案） | `plugins/src/stream/streamEventBus.ts`[新]、`hls`/`dash`/`flv` 三插件、`plugins/src/index.ts` | 播放器总线上不再出现 `STREAM_*` 大写键；契约事件行为不变 |

`P2` 的实现位置：视频区交互集中在 `PlayerDocker` 的 perch 元素上（`click` → 延迟 400ms 区分单双击后切换播放；`dblclick` → 切换全屏）。门面需拿到原始 `MouseEvent`，因此由 `PlayerDocker` 通过 `lifecycle.emit` 上抛，`VideoPlayer.render()` 里接到后转发到 `emitter`。

---

## 7. 明确不改的东西

- 既有 28 个小写键的**键名与参数签名**（C1）；`player.on / once / off` 的方法签名。
- 既有 24 条桥接的 payload 适配逻辑（如 `timeUpdate{time}` → `timeupdate(time, duration)`）。
- `README.md`、`demo/`、`demo-prod/` 中的事件用法（均基于小写多参数，不受影响）。
- `callbacks`（配置式回调）的形态 —— 其键为 `PlayerEvents` 的键，随既有小写键一并冻结。
- 播放器的任何播放/画质/弹幕**行为**（C3）。

---

## 8. 实施顺序

| 步 | 内容 | 依赖 |
|---|---|---|
| 1 | P5 + P4（类型声明：37 个契约键 + 3 个门面键） | 无 |
| 2 | §3.1 通道路由（`resolveEventChannel`） | 无 |
| 3 | P2（click/dblclick 上抛与转发） | 无 |
| 4 | P3（6 个空承诺 + 死监听修复） | 需先能插件 → 总线 emit |
| 5 | P6（文档同步） | 1–4 |

**统一验收**：根级与 `packages/plugins` 的 `tsc --noEmit` 均为 0 error；`pnpm build` 退出码 0；逐条按 §6 表格做真实挂载验证（不能只查元素存在）。

---

## 9. 已决策事项

| 事项 | 决策 |
|---|---|
| 对外事件门面 | 保持小写多参数不变；**允许新增** camelCase 键（见 §2 过程记录） |
| 37 个内部事件 | 走 §3.1 路由，双通道可达（`player.events` 与 `player.on`） |
| 6 个空承诺事件 | **补齐实现**，不从枚举删除 |
| §4.6 非契约键 | 选**乙**：流媒体插件改用私有总线，只把契约事件转发到播放器总线（**已实现**） |
| `click` / `dblclick` | 补齐实现，登记为**门面专属**（不进契约枚举，见 §3.2） |
| `destroy` / `resize` / `sendDanmaku` | 补齐为纯类型声明（P4） |
| `mountPlayer` / `createPlayer` | **导出**（`packages/player/src/index.ts`） |
| hls.js 引入方式 | **fork 入库**：fork 源码置于仓库根 `hls-fork/`，其 `dist/` 由 fork 源码构建后一并提交；不采用依赖关联（用户决策） |

---

## 10. 其它事项与实施记录

### 10.1 hls.js：fork 入库 + 新增缓冲速度 API（已定案）

**决策**：不采用依赖关联，**把 fork 直接放进仓库**（用户决策）。

**实施**：
- fork 源码树置于仓库根 `hls-fork/`（含 `src`、`LICENSE`、构建配置与锁文件）。
- `hls-fork/dist/hls.mjs` 与 `hls-fork/dist/hls.d.ts` **由 fork 源码构建产出并一并提交**（`npm run build`），因此不再存在「dist 落后于 src」的问题 —— 这正是最初尝试入库时构建失败的根因（fork 自带 `dist` 是 05-23 的旧产物，比其 `src` 还旧，缺 `initSegmentRange` / `byteRange`）。
- 原 `packages/plugins/src/hls/vendor/hls.{mjs,d.ts}` 删除，5 处 Vite/Vitest 别名与 `tsconfig.json` 的 paths/include 一律重指到 `hls-fork/dist/`。
- 产物放行需要**两道**白名单：`hls-fork/.gitignore` 的 `!/dist/hls.mjs`、`!/dist/hls.d.ts` **加上**根 `.gitignore` 的 `!hls-fork/dist/`。原因：根 `.gitignore` 的 `dist/` 是**非锚定**规则，会连嵌套的 `dist/` 一起忽略（已踩坑）。

**为什么必须用 fork**：fork 的改动是**对象注入播放** —— 新增 `loadManifest(variants, audioGroups)`，把预解析好的清单对象直接注入 hls.js，**零网络请求、零 m3u8 文本**；改造前只支持 m3u8 文件地址，现在两种都支持。配套新增 `ManifestVariant` / `ManifestAudioGroup` / `ManifestPlaylistDetails` / `ManifestSegment` / `ManifestEncryption` 类型，以及 `ManifestPlaylistDetails.initSegmentRange`（单文件 SegmentBase）、`ManifestSegment.byteRange`（`#EXT-X-BYTERANGE`）。

上游 `video-dev/hls.js` **没有**这些 API（实测：其 `src` 中 `loadManifest` / `ManifestVariant` / `ManifestSegment` 等命中 **0 处**，中文注释 **0 行**；fork 为 131 行），所以「关联上游仓库」在编译层面不可行。

**fork 新增的缓冲速度 API**（本次追加）：

| 项 | 内容 |
|---|---|
| 公开方法 | `getDownloadSpeed(): number` —— 返回**字节/秒**；无有效采样返回 0 |
| 采样点 | `FRAG_LOADED`（取 `data.part?.stats ?? data.frag.stats`，兼顾 LL-HLS 的 part）与 `LEVEL_LOADED`（`data.stats`） |
| 公式 | `stats.loaded / (传输耗时 / 1000)`，**扣除 TTFB**（`loading.first - loading.start`），与 hls.js 内部 `bwEstimator` 口径一致 |
| 平滑 | 5 秒滑动窗口**等权算术平均**；窗口外样本即时丢弃 |
| 不采样条件 | 无 stats / `loaded <= 0` / `loading.end <= loading.start` / 速率非有限或 ≤0 —— 均**保留上一次有效值**，不写入 0 |
| 清理 | `destroy()` 中清空采样 |
| 与 `bandwidthEstimate` 的区别 | 单位是**字节/秒**（不是比特/秒）、扣除 TTFB、只做窗口平均不做 EWMA —— 面向「正在缓冲 xx MB/S」展示，而非 ABR 决策 |

### 10.2 其它未决项

| 事项 | 现状 | 说明 |
|---|---|---|
| `StreamPlugin` 接口未加 `getStreamEventBus?()` | §4.6 遗留 1 | 持泛型 `StreamPlugin` 的消费方需具体类或断言；补一个可选成员即可（需把总线类型下沉到 `types/streamPlugin.ts` 以避免循环依赖） |
| `interactionLinkClick` 的监听器体为空 | `plugins/src/interaction/index.ts:212-214` | 导致 `InteractionPluginConfig.onLinkClick` 仍是**死承诺**，需补上调用 |
| 私有总线在 `uninstall()` 后不清理订阅者 | §4.6 遗留 2 | `TypedEventBus` 无 `clear()`；消费方需自行退订，否则卸载后私有事件仍会投递 |
| FLV 多码率仍是存根 | `applyLimits` 缺失 | 需单独排期 |