# 流媒体插件重构设计文档

## 一、背景

当前三个流媒体插件（FLV/HLS/DASH）存在以下问题：

1. **依赖方式不合理**：`flv.js`、`hls.js`、`dashjs` 全部声明为 `peerDependencies`，用户必须自行安装
2. **无法使用对象注入**：`media-manifest` 项目的 `MediaManifest` API 和 fork 版 hls.js 的 `loadManifest()` 未集成
3. **插件接口不统一**：存在两套 `StreamPlugin` 接口定义，`StreamPluginConstructor` 与实际实现不符
4. **配置类型重复**：`src/types.ts` 和各插件内部各定义了一套配置类型

## 二、设计目标

1. **flv.js 打包进 FLV 插件** — 用户无需单独安装 flv.js
2. **fork 版 hls.js 打包进 HLS 插件** — 包含 `loadManifest()` 能力，用户无需单独安装
3. **dash.js 打包进 DASH 插件** — 用户无需单独安装 dashjs
4. **HLS/DASH 插件支持对象注入** — 集成 `media-manifest` 的 `MediaManifest` 类型和转换器
5. **HLS/DASH 插件支持传入外部实例** — 用户可传入已有的 hls.js/dash.js 实例
6. **统一插件接口** — 消除两套 StreamPlugin 定义

## 三、依赖策略变更

### 3.1 当前（peerDependencies）

```
packages/plugins/package.json:
  peerDependencies:
    hls.js: ^1.6.16
    dashjs: ^5.1.1
    flv.js: ^1.6.2
```

### 3.2 变更后

| 库 | 策略 | 原因 |
|---|---|---|
| `flv.js` | **打包进 FLV 插件** | 用户无需关心 flv.js 版本 |
| `hls.js`（fork 版） | **打包进 HLS 插件** | fork 版含 `loadManifest()`，必须打包 |
| `dashjs` | **打包进 DASH 插件** | 用户无需关心 dashjs 版本 |

三个库从 `peerDependencies` 移到各插件的 `dependencies`，由 Vite 构建时内联打包。

## 四、monorepo 集成方案

### 4.1 目录结构调整

```
hili-player/
├── media-manifest/              # 现有项目，保留
│   ├── src/                     # 类型定义 + 转换器
│   └── hls.js/                  # fork 版 hls.js 源码
│
├── packages/
│   ├── player/                  # 播放器核心（不变）
│   └── plugins/
│       ├── src/
│       │   ├── flv/
│       │   │   ├── FlvPlugin.ts
│       │   │   └── index.ts
│       │   ├── hls/
│       │   │   ├── HlsPlugin.ts
│       │   │   └── index.ts
│       │   ├── dash/
│       │   │   ├── DashPlugin.ts
│       │   │   └── index.ts
│       │   └── stream/
│       │       ├── types.ts     # 统一 StreamPlugin 接口
│       │       └── enums.ts
│       └── package.json
│
├── utils/                       # 全局工具（不变）
├── error/                       # 全局错误处理（不变）
├── core/                        # 核心运行时（不变）
└── types/                       # 全局类型（不变）
```

### 4.2 fork 版 hls.js 的引用方式

在 monorepo 的 `tsconfig.json` 中添加路径映射：

```json
{
  "paths": {
    "@hili-player/hls.js": ["media-manifest/hls.js/src/hls.ts"],
    "@hili-player/media-manifest": ["media-manifest/src/index.ts"]
  }
}
```

HLS 插件直接 import fork 版 hls.js：

```typescript
import Hls from '@hili-player/hls.js';
```

Vite 构建时，`@hili-player/hls.js` 会被解析并**内联打包**进 HLS 插件产物。

### 4.3 media-manifest 类型/转换器的引用方式

HLS 和 DASH 插件需要 `MediaManifest` 类型和 `manifestToHls()`/`manifestToDash()` 转换器：

```typescript
import type { MediaManifest } from '@hili-player/media-manifest';
import { manifestToHls } from '@hili-player/media-manifest';
```

这些是纯类型 + 纯函数，打包后体积可忽略。

## 五、插件接口设计

### 5.1 统一 StreamPlugin 接口

删除 `src/types.ts` 中的旧 `StreamPlugin`，统一使用 `src/stream/types.ts` 中的版本，并修正 `StreamPluginConstructor`：

```typescript
// src/stream/types.ts

/**
 * 流媒体插件统一接口
 */
export interface StreamPlugin extends Plugin {
  /** 插件类型 */
  readonly type: StreamPluginTypeEnum;
  /** 视频元素 */
  videoElement: HTMLVideoElement | null;
  /** 事件总线 */
  eventBus: EventBus | null;

  /** 检查浏览器是否支持 */
  isSupported(): boolean;
  /** 加载流 */
  load(config: StreamConfig): void;
  /** 播放 */
  play(): void;
  /** 暂停 */
  pause(): void;
  /** 跳转 */
  seek(time: number): void;
  /** 销毁 */
  destroy(): void;
  /** 获取缓冲信息 */
  getBufferInfo(): BufferInfo;
  /** 获取流统计 */
  getStats(): Partial<StreamStats>;
}
```

### 5.2 StreamConfig 扩展

```typescript
// src/stream/types.ts

/**
 * 基础流加载配置
 */
export interface StreamConfig {
  /** 流媒体 URL */
  url: string;
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 起始时间（秒） */
  startTime?: number;
}

/**
 * HLS 流加载配置（扩展）
 */
export interface HlsStreamConfig extends StreamConfig {
  /** 注入预解析的清单对象，跳过网络请求 */
  manifest?: MediaManifest;
}

/**
 * DASH 流加载配置（扩展）
 */
export interface DashStreamConfig extends StreamConfig {
  /** 注入预解析的清单对象，跳过网络请求 */
  manifest?: MediaManifest;
}

/**
 * FLV 流加载配置
 */
export interface FlvStreamConfig extends StreamConfig {}
```

### 5.3 插件构造函数设计

#### FlvPlugin

```typescript
export interface FlvPluginConfig {
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 是否直播 */
  isLive?: boolean;
  /** 是否启用隐藏缓冲区 */
  enableStashBuffer?: boolean;
  /** 隐藏缓冲区初始大小 (KB) */
  stashInitialSize?: number;
  /** 懒加载最大时长 (秒) */
  lazyLoadMaxDuration?: number;
}

export class FlvPlugin implements StreamPlugin {
  constructor(config?: FlvPluginConfig);
}
```

#### HlsPlugin

```typescript
export interface HlsPluginConfig {
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 初始画质级别 (-1 自动) */
  startLevel?: number;
  /** ABR 快速直播权重 */
  abrEwmaFastLive?: number;
  /** ABR 慢速直播权重 */
  abrEwmaSlowLive?: number;
  /** 最大缓冲长度 (秒) */
  maxBufferLength?: number;
  /** 最大最大缓冲长度 (秒) */
  maxMaxBufferLength?: number;
  /** 直播同步时长计数 */
  liveSyncDurationCount?: number;
  /** 片段加载超时 (毫秒) */
  fragLoadingTimeOut?: number;
  /** 外部传入的 hls.js 实例（不传则内部创建） */
  hlsInstance?: Hls;
}

export class HlsPlugin implements StreamPlugin {
  constructor(config?: HlsPluginConfig);

  /**
   * 加载流
   * - 传入 manifest 时使用对象注入模式（零网络请求）
   * - 传入 url 时使用标准 URL 加载模式
   */
  load(config: HlsStreamConfig): void;

  /** 获取内部 hls.js 实例 */
  getHlsInstance(): Hls | null;
}
```

#### DashPlugin

```typescript
export interface DashPluginConfig {
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 是否自动切换码率 */
  autoSwitchBitrate?: boolean;
  /** 是否启用快速切换 */
  fastSwitchEnabled?: boolean;
  /** 外部传入的 dash.js MediaPlayer 实例（不传则内部创建） */
  dashInstance?: dashjs.MediaPlayer;
}

export class DashPlugin implements StreamPlugin {
  constructor(config?: DashPluginConfig);

  /**
   * 加载流
   * - 传入 manifest 时使用对象注入模式（零网络请求）
   * - 传入 url 时使用标准 URL 加载模式
   */
  load(config: DashStreamConfig): void;

  /** 获取内部 dash.js 实例 */
  getDashInstance(): dashjs.MediaPlayer | null;
}
```

## 六、对象注入模式实现

### 6.1 HLS 对象注入流程

```
用户传入 MediaManifest
  → manifestToHls(manifest) 转换为 ManifestVariant[] + ManifestAudioGroup[]
  → hls.loadManifest(variants, audioGroups) 注入 fork 版 hls.js
  → 零网络请求，直接播放
```

```typescript
// HlsPlugin.load() 内部逻辑
load(config: HlsStreamConfig): void {
  if (config.manifest) {
    // 对象注入模式
    const { variants, audioGroups } = manifestToHls(config.manifest);
    this.hlsPlayer.loadManifest(variants, audioGroups, config.url);
  } else {
    // 标准 URL 模式
    this.hlsPlayer.loadSource(config.url);
  }
}
```

### 6.2 DASH 对象注入流程

```
用户传入 MediaManifest
  → manifestToDash(manifest) 转换为 DashManifestObject
  → player.attachSource(dashManifest) 注入 dash.js
  → 零网络请求，直接播放
```

```typescript
// DashPlugin.load() 内部逻辑
load(config: DashStreamConfig): void {
  if (config.manifest) {
    // 对象注入模式
    const dashManifest = manifestToDash(config.manifest);
    this.dashPlayer.attachSource(dashManifest);
  } else {
    // 标准 URL 模式
    this.dashPlayer.attachSource(config.url);
  }
}
```

### 6.3 FLV 无对象注入

FLV 协议基于 HTTP-FLV 流，不涉及清单文件，因此不支持对象注入模式，仅支持 URL 加载。

## 七、构建配置变更

### 7.1 Vite 配置

```typescript
// packages/plugins/vite.config.ts

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        danmaku: resolve(__dirname, 'src/danmaku/index.ts'),
        subtitle: resolve(__dirname, 'src/subtitle/index.ts'),
        dash: resolve(__dirname, 'src/dash/index.ts'),
        hls: resolve(__dirname, 'src/hls/index.ts'),
        flv: resolve(__dirname, 'src/flv/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@hili-player/player',  // 播放器核心始终外部化
      ],
      // 注意：不再外部化 flv.js / hls.js / dashjs
      // 它们会被内联打包进各自的插件产物
    },
  },
  resolve: {
    alias: {
      '@hili-player/hls.js': resolve(__dirname, '../../media-manifest/hls.js/src/hls.ts'),
      '@hili-player/media-manifest': resolve(__dirname, '../../media-manifest/src/index.ts'),
    },
  },
});
```

### 7.2 package.json 变更

```json
{
  "peerDependencies": {
    "@hili-player/player": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.2.0",
    "vite-plugin-dts": "^3.8.0"
  }
}
```

移除 `hls.js`、`dashjs`、`flv.js` 的 `peerDependencies`，因为它们已打包进插件。

### 7.3 产物体积预估

| 插件 | 打包内容 | 预估体积 (min) |
|------|---------|---------------|
| FLV 插件 | flv.js | ~150KB |
| HLS 插件 | fork 版 hls.js + media-manifest 转换器 | ~300KB |
| DASH 插件 | dashjs + media-manifest 转换器 | ~400KB |
| 弹幕插件 | 无外部依赖 | ~30KB |
| 字幕插件 | 无外部依赖 | ~20KB |

用户按需引入，不使用的插件不会增加包体积。

## 八、使用示例

### 8.1 基础使用（URL 模式）

```typescript
import { VideoPlayer } from '@hili-player/player';
import { HlsPlugin } from '@hili-player/plugins/hls';

const player = new VideoPlayer({
  src: 'https://example.com/stream.m3u8',
  container: document.getElementById('player'),
  debug: true,
  plugins: [new HlsPlugin()],
});
```

### 8.2 对象注入模式

```typescript
import { VideoPlayer } from '@hili-player/player';
import { HlsPlugin } from '@hili-player/plugins/hls';
import type { MediaManifest } from '@hili-player/plugins/hls';

const manifest: MediaManifest = {
  duration: 3600,
  video: [
    {
      id: '1080p',
      bandwidth: 5000000,
      mimeType: 'video/mp4',
      codecs: 'avc1.640028',
      width: 1920,
      height: 1080,
      segmentInfo: { mode: 'template', media: 'video/$Number$.m4s', initialization: 'video/init.m4s' },
    },
  ],
  audio: [
    {
      id: 'audio-0',
      bandwidth: 128000,
      mimeType: 'audio/mp4',
      codecs: 'mp4a.40.2',
      lang: 'zh',
      segmentInfo: { mode: 'template', media: 'audio/$Number$.m4s', initialization: 'audio/init.m4s' },
    },
  ],
};

const hlsPlugin = new HlsPlugin();
const player = new VideoPlayer({
  container: document.getElementById('player'),
  plugins: [hlsPlugin],
});

// 对象注入加载
hlsPlugin.load({ manifest, url: 'https://example.com/' });
```

### 8.3 传入外部实例

```typescript
import Hls from '@hili-player/plugins/hls'; // 内含打包的 fork 版 hls.js
import { HlsPlugin } from '@hili-player/plugins/hls';

// 用户自己创建 hls.js 实例
const hls = new Hls({ maxBufferLength: 60 });

const hlsPlugin = new HlsPlugin({ hlsInstance: hls });
const player = new VideoPlayer({
  src: 'https://example.com/stream.m3u8',
  container: document.getElementById('player'),
  plugins: [hlsPlugin],
});
```

### 8.4 弹幕插件独立导入

```typescript
import { VideoPlayer } from '@hili-player/player';
import { DanmakuPlugin } from '@hili-player/plugins/danmaku';

const player = new VideoPlayer({
  src: 'https://example.com/video.mp4',
  container: document.getElementById('player'),
  plugins: [
    new DanmakuPlugin({
      source: 'https://example.com/danmaku.json',
      opacity: 0.8,
      speed: 1,
    }),
  ],
});
```

### 8.5 字幕插件独立导入

```typescript
import { VideoPlayer } from '@hili-player/player';
import { SubtitlePlugin } from '@hili-player/plugins/subtitle';

const player = new VideoPlayer({
  src: 'https://example.com/video.mp4',
  container: document.getElementById('player'),
  plugins: [
    new SubtitlePlugin({
      source: 'https://example.com/subtitle.vtt',
      lang: 'zh-CN',
    }),
  ],
});
```

### 8.6 互动插件独立导入

```typescript
import { VideoPlayer } from '@hili-player/player';
import { InteractionPlugin } from '@hili-player/plugins/interaction';

const player = new VideoPlayer({
  src: 'https://example.com/video.mp4',
  container: document.getElementById('player'),
  plugins: [
    new InteractionPlugin({
      onLike: () => console.log('liked'),
      onVoteSelect: (voteIndex, optionIndex) => console.log(voteIndex, optionIndex),
    }),
  ],
});
```

### 8.7 组合使用

```typescript
import { VideoPlayer } from '@hili-player/player';
import { HlsPlugin } from '@hili-player/plugins/hls';
import { DanmakuPlugin } from '@hili-player/plugins/danmaku';
import { SubtitlePlugin } from '@hili-player/plugins/subtitle';
import { InteractionPlugin } from '@hili-player/plugins/interaction';

const player = new VideoPlayer({
  src: 'https://example.com/stream.m3u8',
  container: document.getElementById('player'),
  debug: true,
  plugins: [
    new HlsPlugin(),
    new DanmakuPlugin({ source: 'https://example.com/danmaku.json' }),
    new SubtitlePlugin({ source: 'https://example.com/subtitle.vtt' }),
    new InteractionPlugin(),
  ],
});
```

## 九、插件导入路径汇总

| 插件 | 导入路径 | 说明 |
|------|---------|------|
| FLV 流媒体 | `@hili-player/plugins/flv` | 内含 flv.js |
| HLS 流媒体 | `@hili-player/plugins/hls` | 内含 fork 版 hls.js + MediaManifest 类型 |
| DASH 流媒体 | `@hili-player/plugins/dash` | 内含 dashjs + MediaManifest 类型 |
| 弹幕 | `@hili-player/plugins/danmaku` | 无外部依赖 |
| 字幕 | `@hili-player/plugins/subtitle` | 无外部依赖 |
| 互动 | `@hili-player/plugins/interaction` | 无外部依赖 |
| 全部插件 | `@hili-player/plugins` | 统一入口，按需 tree-shake |

## 十、迁移步骤

### 阶段一：接口统一
1. 删除 `src/types.ts` 中废弃的 `StreamPlugin`、`DashPluginConfig`、`HlsPluginConfig`、`FlvPluginConfig`
2. 修正 `StreamPluginConstructor` 类型
3. 统一配置类型到各插件文件内部

### 阶段二：依赖打包
1. 将 `flv.js`、`hls.js`（fork 版）、`dashjs` 从 `peerDependencies` 移除
2. 配置 Vite alias 指向 fork 版 hls.js 和 media-manifest
3. 移除 `rollupOptions.external` 中的流媒体库
4. 将动态 `import()` 改为静态 `import`（因为已打包）

### 阶段三：对象注入集成
1. 在 `HlsPlugin` 中集成 `manifestToHls()` 和 `loadManifest()`
2. 在 `DashPlugin` 中集成 `manifestToDash()` 和 `attachSource()`
3. 扩展 `StreamConfig` 支持 `manifest` 参数
4. 导出 `MediaManifest` 等类型供用户使用

### 阶段四：外部实例支持
1. `HlsPlugin` 构造函数新增 `hlsInstance` 参数
2. `DashPlugin` 构造函数新增 `dashInstance` 参数
3. 传入外部实例时跳过内部创建，直接使用

### 阶段五：测试验证
1. URL 模式回归测试
2. 对象注入模式功能测试
3. 外部实例传入测试
4. 产物体积验证
5. Tree-shaking 验证
