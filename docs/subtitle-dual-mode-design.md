# 字幕双模式设计文档

> 状态：设计阶段（仅设计，不实现）
> 范围：`packages/plugins/src/subtitle/`、`types/subtitle.ts`、demo
> 关联能力：现有 SubtitlePlugin（文件字幕源 + RAF 渲染管线 + AI 服务端骨架）

## 一、背景与目标

字幕生产目前有三条路径：

1. **文件字幕源**（已实现）：SRT/VTT/ASS 文件 → `parseSubtitle` → RAF + 二分查找渲染
2. **AI 字幕·服务端返回**（骨架已通）：`AiSubtitleBackendConfig` + `AiSubtitleFetcher` 拉取后端接口 → `SubtitleItem[]` → 复用现有渲染管线；后端接口后续对接
3. **AI 字幕·本地实时识别**（全新）：播放器音频流 → 浏览器本地轻量级 AI 语音模型 → 实时产出多语言字幕，**音频不出浏览器**

本文档补齐并统一后两条路径的设计，达成以下目标：

- **模式 A（本地 AI 实时识别）**：纯本地、多语言、实时（延迟 < 1s 量级）、隐私安全（音频不上传）
- **模式 B（服务端返回）**：在现有 `AiSubtitleFetcher` 骨架上正式化接口契约，支持多语言轨与增量拉取
- **双模式共存**：统一的 Provider 抽象，渲染层零改动（都归一到 `SubtitleItem[]` → 现有 RAF 管线），可组合（本地识别 + 服务端翻译）

## 二、现状盘点

### 2.1 已有能力（保持不动）

| 能力 | 位置 | 说明 |
| --- | --- | --- |
| 字幕渲染管线 | `SubtitlePlugin.ts` | RAF 循环 + `binarySearchSubtitle` 二分查找，`subtitleEl` 直接操作 |
| 文件解析 | `@/utils/subtitle` | SRT/ASS/SSA/VTT → `ParsedSubtitle` |
| 类型定义 | `types/subtitle.ts` | `SubtitleItem { id, startTime, endTime, text, style? }`、`ParsedSubtitle`、`SubtitleSource` |
| 服务端模式骨架 | `aiSubtitleConfig.ts` / `AiSubtitleFetcher.ts` | endpoint 模板 + 自定义 `parseResponse` + 类型谓词校验，fetch → `toSubtitleItems` |
| 事件广播 | `SubtitlePlugin.refreshAiSubtitle()` | `SUBTITLE_LIST_CHANGE`（loading/ready/error）+ `SUBTITLE_LANG_CHANGE('ai')` |
| 样式/可见性 API | `SubtitlePluginAPI` | `setStyle`/`setVisible`/`setFontSize`/`setPosition` 等全套 |

### 2.2 差距

| 差距 | 影响模式 |
| --- | --- |
| 无音频流采集能力（Web Audio / captureStream 均未接入） | A |
| 无本地推理引擎抽象（Worker + WASM 加载与生命周期管理） | A |
| 无实时（推送型）字幕数据源——现有 `load()`/`refreshAiSubtitle()` 均为一次性拉取 | A |
| 服务端契约缺多语言轨、增量拉取、双语拼装规范 | B |
| 插件 API 未区分字幕来源（`getStatus()` 无 source 维度） | A/B |

## 三、总体架构

### 3.1 核心原则

1. **渲染层零改动**：两种模式的产物统一为 `SubtitleItem[]`，进入现有 `ParsedSubtitle` → RAF + 二分查找管线。本地 AI 采用**增量 append**（见 4.6），`items` 保持近似升序，二分查找天然兼容。
2. **Provider 模式贯穿**：与本次 `previewProvider`/`energyProvider` 改造同风格——数据获取由外部注入，插件只负责消费。
3. **模式可组合**：本地识别产出原文轨，服务端可同步产出翻译轨（双语字幕），两条轨独立开关。

### 3.2 架构图

```
┌────────────────────────── 播放器内核 ──────────────────────────┐
│  <video> ──MOUNTED──> VideoPlayer.events（事件总线）              │
└──────┬──────────────────────────┬──────────────────────────────┘
       │ 模式 A（推送型）           │ 模式 B（拉取型）
┌──────▼──────────────┐   ┌───────▼───────────────┐
│ LocalAiSubtitleProvider│   │ RemoteSubtitleProvider │
│ ┌──────────────────┐ │   │ ┌────────────────────┐ │
│ │ 音频采集          │ │   │ │ AiSubtitleFetcher    │ │
│ │ WebAudio→Worklet  │ │   │ │ (endpoint/parse/多轨)│ │
│ │ →16kHz PCM→Worker │ │   │ └────────────────────┘ │
│ │ AsrEngine(WASM)   │ │   │  fetch() → Promise     │
│ │ VAD分段→实时识别   │ │   │  返回 AiSubtitleEntry[] │
│ └───────┬──────────┘ │   └───────┬────────────────┘ │
└─────────┼────────────┘           ┼───────────────────┘
          │ onCue(推送)             │ await fetch(拉取)
┌─────────▼────────────────────────▼───────────────────┐
│              SubtitlePlugin（统一管道）                 │
│   cue → SubtitleItem → append/replace 到 items        │
│   → 现有 RAF 循环 + binarySearchSubtitle 渲染          │
│   → SUBTITLE_* 事件向上广播（loading/ready/partial…）   │
└──────────────────────────────────────────────────────┘
```

### 3.3 Provider 抽象（类型草案）

```ts
/** 字幕条目增量事件（模式 A 推送 / 模式 B 拉取后归一） */
export interface SubtitleCueEvent {
  /** 本条 cue 的轨道 id（本地识别原文轨 = 'asr-original'，服务端翻译轨等自定义） */
  trackId: string;
  /** 该轨道语言代码 */
  lang: string;
  /** 稳定完成的条目（final） */
  finalCues: SubtitleItem[];
  /**
   * 进行中的部分识别结果（可选，仅模式 A 有）：
   * 文本仍在变动，渲染层以「临时灰显」展示，被后续 finalCues 覆盖
   */
  partialCue?: SubtitleItem | null;
}

/** 推送型字幕提供者（模式 A：本地 AI 实时识别） */
export interface LocalAiSubtitleProvider {
  readonly type: 'local-ai';
  /** 启动识别（幂等）；返回停止函数由插件在卸载/关闭时调用 */
  start(context: SubtitleEngineContext): void;
  stop(): void;
  /** cue 推送回调，由插件注入 */
  onCue?: (event: SubtitleCueEvent) => void;
}

/** 拉取型字幕提供者（模式 B：服务端返回，可整段或增量） */
export interface RemoteSubtitleProvider {
  readonly type: 'remote';
  /**
   * 拉取字幕段
   * @param range 可选：增量模式下的时间区间（秒）；整段模式忽略
   * @returns 该区间的 AiSubtitleEntry[]（可为空数组）
   */
  fetch(range?: { from: number; to: number }): Promise<AiSubtitleEntry[]>;
  /** 是否支持增量拉取（决定插件是否分段请求） */
  readonly incremental?: boolean;
}

/** 本地识别引擎运行上下文（由插件注入，引擎不直接触碰播放器） */
export interface SubtitleEngineContext {
  /** 音频 PCM 输入：16kHz 单声道 Float32 分块推送（由采集层喂入） */
  readonly audioStream: SubtitleAudioStream;
  /** 播放器事件（seek/pause/play/ratechange，用于引擎状态联动） */
  readonly events: PlayerEventBus;
  /** 读取当前媒体时间（秒）——VAD 分段时间戳对齐用 */
  getMediaTime(): number;
}
```

## 四、模式 A：本地 AI 实时识别（详细设计）

### 4.1 技术选型

浏览器端流式 ASR 引擎对比（均为纯 WASM/Worker 方案，音频不出浏览器）：

| 引擎 | 流式能力 | 模型体积（量化） | 多语言 | 许可 | 备注 |
| --- | --- | --- | --- | --- | --- |
| **sherpa-onnx (wasm)** | 原生流式（zipformer transducer） | 单语 ~40-80MB | 按语言模型切换 | Apache-2.0 | 首选：延迟低（数百 ms）、CPU 占用低 |
| whisper.cpp / transformers.js (onnx) | 非流式，需 VAD 切段轮转 | tiny ~40MB / base ~80MB | 单模型多语言 | MIT | 通用性强，分段延迟 1-3s |
| vosk-browser | 流式 | 小模型 ~50MB | 按语言 | Apache-2.0 | 生态较老，精度一般 |
| Web Speech API | 伪流式 | 0（浏览器/云服务） | 取决于浏览器 | — | **排除**：Chrome 依赖在线服务，非纯本地、不可控 |

**结论**：抽象 `AsrEngine` 接口（见 4.4），首期实现 sherpa-onnx 流式引擎为默认，whisper 分段引擎作为通用备选；引擎选择由配置决定，接口对上完全一致。

### 4.2 音频采集管线

```
<video>
  │  MediaElementAudioSourceNode（Web Audio API）
  ▼
AudioContext（播放器已有/新建，懒创建）
  │  AudioWorkletNode（采集 + 重采样）
  ▼
16kHz mono Float32 PCM 分块（~0.5s/块，带媒体时间戳）
  │  postMessage（transferable ArrayBuffer，零拷贝）
  ▼
Web Worker（ASR Worker）
  │  VAD 分段 → AsrEngine 识别 → partial/final 文本
  ▼
LocalAiSubtitleProvider.onCue → SubtitlePlugin
```

要点：

1. **采集方式**：优先 `AudioContext.createMediaElementSource(video)`。注意两点并在文档层面固化：
   - **CORS 约束**：跨域视频源未设置 `crossOrigin="anonymous"` 时，MediaElementSource 输出静音数据。接入方需保证视频源支持 CORS，否则模式 A 自动降级（见 6.2）。
   - **输出接管**：`createMediaElementSource` 会把音频输出切到 Web Audio 图（不再直连扬声器）。因此 AudioWorklet 处理后必须接 `AudioContext.destination` 回放，避免「开启本地识别后没声音」。
2. **重采样**：视频音频采样率通常为 44.1/48kHz，ASR 模型需要 16kHz。在 AudioWorklet 内做线性插值降采样（或使用 `OfflineAudioContext` 不可行——实时流必须用 Worklet 内联重采样）。
3. **时间戳对齐**：每个 PCM 块记录 `块首媒体时间 = video.currentTime - 块内样本偏移/sampleRate`。VAD 分段边界即用该时间戳，保证字幕时间轴与播放时间轴一致。
4. **倍速**：MediaElementSource 捕获的是渲染后音频，`playbackRate ≠ 1` 时送入 ASR 的音频变速变调，识别精度下降。设计取舍：不做音高校正（`preservesPitch` 交由播放器既有逻辑），在 `playbackRate > 1.5` 时引擎内部加倍 VAD 静音阈值缓解；文档注明这是已知精度折衷。
5. **暂停**：暂停后 Worklet 无输入帧产生，识别自然停摆；恢复播放自动续接，无需特殊处理。

### 4.3 VAD 分段与识别节奏

```
PCM 流 ──> VAD（能量+过零率，轻量无模型；静音 ≥ 400ms 视为段尾）
              │ 段首：记录 startTime = 该块媒体时间戳
              │ 段尾：把累积音频提交 AsrEngine，记录 endTime
              ▼
        AsrEngine.acceptAudio / finalizeSegment
              │ 流式引擎：段内持续吐 partial（onCue({ partialCue })）
              │ 段尾吐 final（onCue({ finalCues: [item] })）
              ▼
        SubtitlePlugin 增量 append + 广播 SUBTITLE_PARTIAL / SUBTITLE_CUE
```

- **段长上限**：单段最长 15s，超限强制切段提交（避免长句尾延迟过大）。
- **字幕 id**：沿用 `SubtitleItem.id`，本地轨使用负数段 id（`-1, -2, ...`）避免与文件/服务端轨道（正数自增）冲突——**此约定需写入类型注释**。
- **置信度过滤**：final 置信度低于阈值（默认 0.35，可配）的条目丢弃或标记（不渲染但保留在 items 中，供 `getFullTranscript()` 使用）。

### 4.4 AsrEngine 接口（Worker 内运行）

```ts
/** ASR 推理引擎接口（实现运行于 Web Worker，接口跨线程传递） */
export interface AsrEngine {
  /** 引擎名（'sherpa-streaming' | 'whisper-chunk' | 自定义） */
  readonly name: string;
  /**
   * 初始化：加载模型文件
   * @param assets 模型资源定位（url 或已缓存 blob），按语言一组
   */
  init(options: AsrEngineInitOptions): Promise<void>;
  /** 喂入音频块（16kHz mono Float32）；流式引擎可即时返回 partial */
  acceptAudio(chunk: Float32Array, mediaTime: number): AsrPartialResult | null;
  /** 结束当前语音段，产出 final 文本 */
  finalizeSegment(): AsrFinalResult | null;
  /** 状态查询（loading/ready/error，向上广播用） */
  getStatus(): { state: 'loading' | 'ready' | 'error'; message?: string };
  /** 释放模型资源 */
  dispose(): void;
}
```

### 4.5 模型资源管理

- **懒加载**：用户首次开启本地识别才触发下载；下载进度通过 `SUBTITLE_AI_STATUS` 事件广播（见 5.1），UI 层可显示进度条。
- **缓存**：模型分片下载至 IndexedDB（同源静态资源），二次开启零下载。
- **多语言**：模型按语言分片（`/models/{lang}/{engine}/`），运行中切换语言 = 停当前引擎实例 → 换模型重启（切换期间丢弃在途 partial）。
- **体积预算**：默认策略单语言模型 ≤ 80MB；超出时事件广播 warning 并要求用户确认（demo 阶段仅控制台提示）。

### 4.6 与渲染管线对接（增量 append 的正确性）

现有 `binarySearchSubtitle` 要求 `items` 按 `startTime` 升序。本地识别按播放顺序产出，天然近似升序，但存在两个边界：

1. **partial 替换 final**：partial（id 临时）被 final 替换时用 `splice` 原位替换，时间有序性不变。
2. **seek 后乱序**：用户回退后重新识别的段落 `startTime` 早于已 append 的尾部若干条。处理：append 前用二分查找定位插入点（`O(log n)`），插入而非 push；同时 seek 时**丢弃所有在途音频与 pending 段**（见 4.7），已 final 的历史条目保留（其时间轴仍然有效，回退重看时直接复用历史条目，不重复识别——**历史命中策略**：VAD 分段提交前先查询历史 items 是否已有覆盖该时段的高置信条目，命中则跳过识别）。

### 4.7 播放器联动（事件驱动）

| 事件 | 引擎行为 |
| --- | --- |
| `SEEK_END` | 清空 Worklet 缓冲、丢弃 pending VAD 段、引擎 `reset()`；按 4.6 历史命中策略决定是否重新识别 |
| `PAUSE` | Worklet 自然停摆（无新音频帧）；引擎保持加载态 |
| `PLAY` | 继续采集；VAD 从新语音活动开始新段 |
| `RATE_CHANGE` | 调整 VAD 阈值（见 4.2 要点 4） |
| `UNMOUNT`/`uninstall` | `provider.stop()` → 断开 MediaElementSource 链、terminate Worker、`engine.dispose()` |

## 五、模式 B：服务端返回（正式化契约）

### 5.1 接口契约

在现有 `AiSubtitleBackendConfig` 基础上扩展为多轨 + 增进协议：

```ts
/** 服务端字幕轨道描述（一次列表请求返回） */
export interface RemoteSubtitleTrack {
  /** 轨道 id（服务器定义，稳定） */
  trackId: string;
  /** 语言代码（BCP-47，如 zh / en-US） */
  lang: string;
  /** 显示名（如「中文（AI 生成）」） */
  label: string;
  /** 轨道类型：原文识别轨 / 翻译轨 */
  kind: 'original' | 'translation';
  /** 翻译轨指向的原文轨 id（kind=translation 时必有） */
  originalTrackId?: string;
}
```

**请求协议**（默认约定，可经 `parseResponse` 兼容任意后端）：

| 请求 | 约定 |
| --- | --- |
| `GET {endpoint}/tracks?videoId=…` | → `{ tracks: RemoteSubtitleTrack[] }` |
| `GET {endpoint}/cues?videoId=…&trackId=…&from=…&to=…` | → `{ cues: AiSubtitleEntry[] }`；`from/to` 缺省为整段 |
| `GET {endpoint}/status?videoId=…`（可选） | → `{ state: 'processing' \| 'ready', progress?: number }`（后端异步生成时的进度查询） |

- **增量拉取**：`incremental: true` 的 Provider 在播放头推进中按窗口（默认 60s，提前 15s 预取）分段请求，区间按序追加（同样走 4.6 的有序插入，容忍服务端乱序返回）。
- **双语拼装**：原文轨 + 翻译轨两条 `SubtitleItem[]` 由渲染层叠加展示（现有 `subtitleEl` innerHTML 支持 `\n` 多行；翻译行用次级样式——新增 `SUBTITLE_TRANSLATION_CLASS`，样式与原文区分）。拼装在插件内完成，渲染层只拿到合成后的 `text`。
- **请求竞态**：区间请求带序号计数器（与本次 `previewRequestId`/`energyRequestId` 同模式），过期响应丢弃。

### 5.2 与现有骨架的关系

- `AiSubtitleFetcher` 升级为 `RemoteSubtitleProvider` 的默认实现：保留 `endpoint 模板 + fillAiTemplate + parseResponse` 兼容路径（旧配置 `aiBackend` 继续可用，映射为单轨 `original`）。
- `refreshAiSubtitle()` 语义收窄为「整段拉取一次」，新增 `refreshRange(from, to)` 支持增量。

## 六、插件 API 扩展

### 6.1 SubtitlePluginConfig 新增字段

```ts
export interface SubtitlePluginConfig {
  // ……现有字段保持不变……
  /** 模式 A：本地 AI 实时识别配置（传入即启用该模式的可用性，运行期经 enableLocalAi/stopLocalAi 控制） */
  localAi?: LocalAiSubtitleConfig;
  /** 模式 B：服务端字幕 Provider（与 aiBackend 二选一，Provider 优先） */
  remoteProvider?: RemoteSubtitleProvider;
}

/** 模式 A 配置 */
export interface LocalAiSubtitleConfig {
  /** 引擎实现（按语言挂引擎；缺省语言用 defaultEngine） */
  engines: Partial<Record<string, AsrEngine>>;
  defaultLang: string;
  /** 模型资源 base 路径（懒加载下载 + IndexedDB 缓存） */
  modelBasePath: string;
  /** 置信度阈值（低于丢弃，默认 0.35） */
  confidenceThreshold?: number;
  /** 单段最长秒数（默认 15） */
  maxSegmentSeconds?: number;
}
```

### 6.2 SubtitlePluginAPI 新增方法

```ts
export interface SubtitlePluginAPI extends Plugin {
  // ……现有方法保持不变……
  /** 启动本地实时识别（幂等；模型懒加载，进度经 SUBTITLE_AI_STATUS 广播） */
  startLocalAi(lang?: string): Promise<void>;
  /** 停止本地识别并释放引擎资源（保留已识别字幕条目） */
  stopLocalAi(): void;
  /** 切换识别语言（换模型重启引擎） */
  switchLocalAiLanguage(lang: string): Promise<void>;
  /** 列出可用字幕轨道（文件源 + 服务端轨 + 本地轨的并集） */
  listTracks(): SubtitleTrackInfo[];
  /** 激活某轨道（多轨并存时主字幕轨切换） */
  activateTrack(trackId: string): Promise<void>;
  /** 获取本地识别完整转写（含低置信过滤条目，供外挂功能使用） */
  getFullTranscript(): SubtitleItem[];
}
```

### 6.3 新增事件

| 事件枚举 | 载荷 | 说明 |
| --- | --- | --- |
| `SUBTITLE_AI_STATUS` | `{ phase: 'downloading' \| 'loading' \| 'ready' \| 'error', progress?: number, message?: string }` | 模型下载/引擎初始化/就绪/失败（UI 进度条） |
| `SUBTITLE_PARTIAL` | `SubtitleItem \| null` | 本地识别部分结果（灰显中的临时文本） |
| `SUBTITLE_CUE` | `SubtitleItem` | 本地识别 final 结果（新字幕落定） |
| `SUBTITLE_TRACKS_CHANGE` | `{ tracks: SubtitleTrackInfo[] }` | 可用轨道集合变化（服务端轨列表返回/本地轨就绪） |

### 6.4 状态联动

`getStatus()` 扩展返回 `source: 'file' | 'remote' | 'local-ai' | null` 维度；`SubtitleMenu`（设置面板字幕菜单）按 `listTracks()` 渲染轨道列表，本地轨显示「实时识别」徽标 + 状态点（下载中/就绪/失败）。

### 6.5 降级链

```
用户开启 AI 字幕
  ├─ localAi 可用（WASM 支持且有引擎配置）→ 模式 A
  ├─ localAi 不可用（无 WASM / 模型下载失败 / CORS 静音数据）→ 自动降级模式 B（有 remoteProvider/aiBackend 时）
  └─ 模式 B 也未配置 → 维持文件源/无字幕，控制台 warning（运行时字符串英文）
```

降级原因经 `SUBTITLE_AI_STATUS { phase: 'error', message }` 广播，避免静默失败。

## 七、类型定义汇总（types/subtitle.ts 扩展草案）

新增导出（纯类型，零运行时依赖，遵守「公共类型不导入业务逻辑」约束）：

- `SubtitleCueEvent`、`LocalAiSubtitleProvider`、`RemoteSubtitleProvider`、`SubtitleEngineContext`
- `AsrEngine`、`AsrEngineInitOptions`、`AsrPartialResult`、`AsrFinalResult`
- `RemoteSubtitleTrack`、`SubtitleTrackInfo`
- `LocalAiSubtitleConfig`

实现落点与约束：

1. `AsrEngine` 等引擎类型放 `types/subtitle.ts`，但 **sherpa/whisper 具体引擎实现** 放 `packages/plugins/src/subtitle/asr/`（插件包内，不进 types）。
2. 若未来把 Provider 挂到 `PlayerConfig.subtitle`（而非插件 config），必须同步 `normalizeConfig.ts` 白名单拷贝（本项目已有教训：白名单漏写 = 字段静默丢弃）。当前设计**仅走插件配置**，不触碰 PlayerConfig。
3. 禁止 `as` 断言：跨线程 Worker 消息用类型谓词窄化（模式参考 `aiSubtitleConfig.ts` 的 `isRawEntry`）。

## 八、Demo 接入示例（未来实施时）

```ts
// 模式 A：本地实时识别（demo 用 mock 引擎或接真实 sherpa-onnx wasm）
SubtitlePlugin({
  localAi: {
    engines: { zh: sherpaEngine, en: whisperEngine },
    defaultLang: 'zh',
    modelBasePath: '/models/asr/',
  },
})

// 模式 B：服务端返回（demo 用 mock-server 9101 提供 /tracks /cues）
SubtitlePlugin({
  remoteProvider: {
    type: 'remote',
    incremental: true,
    fetch: async (range) => {
      const q = range ? `?from=${range.from}&to=${range.to}` : '';
      const res = await fetch(`http://localhost:9101/api/subtitle/cues${q}`);
      return defaultAiSubtitleParser(await res.json());
    },
  },
})
```

## 九、边界情况清单

| 场景 | 行为 |
| --- | --- |
| 视频无音轨 | VAD 永不触发；UI 显示「未检测到语音」 |
| 倍速播放 | 精度折衷已知（4.2 要点 5），>1.5x 提高 VAD 阈值缓解 |
| seek 频繁 | 丢弃在途缓冲；历史命中避免重复识别（4.6） |
| 模型下载中断 | IndexedDB 分片断点续传；重试 3 次后广播 error 并降级模式 B |
| 双播放器实例 | 引擎 Worker 每实例独立；模型缓存全局共享 |
| SSR | Provider 全部懒启动（`isBrowser()` 守卫，与流插件 SSR 守卫同模式），服务端零副作用 |
| 浏览器不支持 WASM SIMD | sherpa 引擎不可用 → 降级 whisper 非 SIMD 构建 → 再降级模式 B |

## 十、实施阶段拆分（后续排期参考）

| 阶段 | 内容 | 交付物 |
| --- | --- | --- |
| P1 | `AsrEngine` 接口 + mock 引擎 + 采集链（Worklet/重采样/时间戳） + `SUBTITLE_PARTIAL/CUE` 事件 + 增量 append | 模式 A 可用（mock 识别） |
| P2 | sherpa-onnx wasm 引擎接入 + IndexedDB 模型缓存 + 下载进度事件 | 模式 A 真实可用 |
| P3 | `RemoteSubtitleProvider` 多轨/增量协议 + `listTracks/activateTrack` + 双语拼装 | 模式 B 正式化 |
| P4 | 降级链 + SubtitleMenu 轨道 UI + demo 双模式示例 | 全量交付 |
