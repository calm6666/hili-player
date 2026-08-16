# 插件上下文（PluginContext）使用文档

## 一、概述

`PluginContext` 是插件安装时获得的上下文对象，包含播放器实例和各种系统引用。插件通过上下文访问播放器能力，而非直接依赖播放器内部实现。

**当前状态**：`PluginContext` 已定义和创建，但插件尚未通过它获取上下文。所有插件在 `install(player)` 中直接通过 `player.events`、`player.state` 等方式访问。**建议后续版本将 `PluginContext` 作为 `install()` 的参数直接传递**，使插件不再依赖 `VideoPlayer` 的具体属性。

---

## 二、PluginContext 接口

定义于 `packages/player/src/core/plugin.ts`：

```typescript
export interface PluginContext {
  /** 播放器实例 — 可访问播放器所有公共 API */
  player: VideoPlayer;
  /** 状态管理器 — 读取/写入/订阅播放器状态 */
  state: StateManager;
  /** 事件总线 — 监听和触发播放器事件 */
  events: PlayerEventBus;
  /** 钩子系统 — 注册和执行钩子，介入播放器行为 */
  hooks: HookSystem;
  /** 日志输出函数 — 自动带 [Plugin:插件名] 前缀 */
  log: (msg: string) => void;
}
```

---

## 三、上下文创建流程

```
VideoPlayer 创建
  └─ PluginManager 构造
       ├─ this.state = createStateManager()       ← 插件专用状态管理器
       ├─ this.events = createTypedEventBus()      ← 插件专用事件总线
       └─ this.hooks = createHookSystem()          ← 插件专用钩子系统

PluginManager.install(plugin) 调用时：
  ├─ 组装 PluginContext { player, state, events, hooks, log }
  ├─ 保存到 this.context
  └─ 调用 plugin.install(this.player)              ← 当前只传 player
```

**注意**：`PluginManager` 的 `state`、`events`、`hooks` 是**插件专用**的，与 `VideoPlayer` 的 `this.state`、`this.events` 是**不同的实例**。

| 实例 | 归属 | 用途 |
|------|------|------|
| `VideoPlayer.state` | 播放器核心 | 播放器内部状态（音量、播放状态、时间等） |
| `PluginManager.state` | 插件系统 | 插件间共享状态、插件自定义状态 |
| `VideoPlayer.events` | 播放器核心 | 播放器生命周期事件（MOUNTED、PLAY、PAUSE 等） |
| `PluginManager.events` | 插件系统 | 插件间通信事件 |

---

## 四、各属性详细用法

### 4.1 player — 播放器实例

```typescript
install(player: VideoPlayer): void {
  // 访问播放器公共 API
  player.play();
  player.pause();
  player.seek(30);
  player.setVolume(0.5);
  player.toggleMute();
  player.toggleFullscreen();
  player.togglePip();

  // 访问播放器核心状态管理器（播放器内部状态）
  const currentTime = player.state.get('player.currentTime');
  const isMuted = player.state.get('player.muted');

  // 访问播放器核心事件总线
  player.events.on('player:mounted', (data) => {
    this.videoElement = data.video;
  });

  // 访问流媒体中间件
  player.streamMiddleware?.load(source);
}
```

### 4.2 state — 状态管理器

插件专用的状态管理器，用于存储插件自定义状态和跨插件共享状态。

```typescript
install(player: VideoPlayer): void {
  const ctx = player.pluginManager.context!;

  // 写入状态
  ctx.state.set('dash.bitrate', 5000);
  ctx.state.set('dash.bufferAhead', 12.5);

  // 读取状态
  const bitrate = ctx.state.get<number>('dash.bitrate');

  // 订阅状态变化
  const unsub = ctx.state.subscribe('dash.bitrate', (newVal, oldVal) => {
    ctx.log(`码率变化: ${oldVal} → ${newVal}`);
  });

  // 获取完整状态快照
  const snapshot = ctx.state.getState();
}

uninstall(): void {
  // 取消订阅
  this.unsubscribers.forEach(fn => fn());
}
```

**与播放器核心状态的区别**：

| 操作 | 播放器核心状态 | 插件状态 |
|------|-------------|---------|
| 读取 | `player.state.get('player.volume')` | `ctx.state.get('dash.bitrate')` |
| 写入 | `player.state.set('player.volume', 0.5)` | `ctx.state.set('dash.bitrate', 5000)` |
| 订阅 | `player.state.subscribe('player.volume', cb)` | `ctx.state.subscribe('dash.bitrate', cb)` |
| 路径前缀 | `player.*` | 插件自定义（建议用 `插件名.*`） |

### 4.3 events — 事件总线

插件专用的事件总线，用于插件间通信。**注意**：播放器核心事件（如 `player:mounted`、`player:play`）需要通过 `player.events` 监听，而非 `ctx.events`。

```typescript
install(player: VideoPlayer): void {
  const ctx = player.pluginManager.context!;

  // 监听播放器核心事件（通过 player.events）
  player.events.on('player:mounted', (data) => {
    ctx.log('播放器已挂载');
    this.videoElement = data.video;
  });

  player.events.on('player:play', () => {
    ctx.log('开始播放');
  });

  // 插件间通信（通过 ctx.events）
  ctx.events.on('dash:statsUpdate', (stats) => {
    ctx.log(`缓冲: ${stats.bufferLength}s`);
  });

  // 发出插件事件
  ctx.events.emit('dash:statsUpdate', { bufferLength: 12.5 });

  // 一次性监听
  const unsub = ctx.events.once('dash:ready', () => {
    ctx.log('DASH 就绪');
  });

  // 取消监听
  unsub();
}
```

**播放器核心事件列表**（通过 `player.events` 监听）：

| 事件名 | 枚举值 | Payload | 说明 |
|--------|--------|---------|------|
| `READY` | `PlayerEventEnum.READY` | 无 | 播放器就绪 |
| `MOUNTED` | `PlayerEventEnum.MOUNTED` | `{ container, video, sendingArea }` | 播放器挂载完成 |
| `PLAY` | `PlayerEventEnum.PLAY` | 无 | 开始播放 |
| `PAUSE` | `PlayerEventEnum.PAUSE` | 无 | 暂停播放 |
| `ENDED` | `PlayerEventEnum.ENDED` | 无 | 播放结束 |
| `TIME_UPDATE` | `PlayerEventEnum.TIME_UPDATE` | `{ time }` | 时间更新 |
| `FULLSCREEN_CHANGE` | `PlayerEventEnum.FULLSCREEN_CHANGE` | `{ isFullscreen }` | 全屏变化 |
| `PIP_CHANGE` | `PlayerEventEnum.PIP_CHANGE` | `{ isPip }` | 画中画变化 |
| `VOLUME_CHANGE` | `PlayerEventEnum.VOLUME_CHANGE` | `{ volume, muted }` | 音量变化 |
| `MUTED_CHANGE` | `PlayerEventEnum.MUTED_CHANGE` | `muted` | 静音变化 |
| `RATE_CHANGE` | `PlayerEventEnum.RATE_CHANGE` | `rate` | 倍速变化 |
| `QUALITY_CHANGE` | `PlayerEventEnum.QUALITY_CHANGE` | `{ quality, name, isBackup }` | 画质变化 |
| `SEEK_START` | `PlayerEventEnum.SEEK_START` | `{ time, previousTime }` | 开始跳转 |
| `SEEK_END` | `PlayerEventEnum.SEEK_END` | `{ time, previousTime }` | 跳转完成 |
| `ERROR` | `PlayerEventEnum.ERROR` | `{ error, code, message }` | 错误 |
| `CAN_PLAY` | `PlayerEventEnum.CAN_PLAY` | 无 | 可以播放 |
| `WAITING` | `PlayerEventEnum.WAITING` | 无 | 缓冲等待 |
| `RESIZE` | `PlayerEventEnum.RESIZE` | `{ width, height }` | 尺寸变化 |
| `DANMAKU_TOGGLE` | `PlayerEventEnum.DANMAKU_TOGGLE` | 无 | 弹幕开关 |
| `DANMAKU_SEND` | `PlayerEventEnum.DANMAKU_SEND` | `{ text, options }` | 发送弹幕 |

### 4.4 hooks — 钩子系统

钩子系统允许插件介入播放器的关键行为，修改参数或添加副作用。

```typescript
install(player: VideoPlayer): void {
  const ctx = player.pluginManager.context!;

  // 注册播放前钩子：可以修改播放参数或阻止播放
  const unregisterBeforePlay = ctx.hooks.register<{ url: string }, { url: string }>(
    PlayerHooks.BEFORE_PLAY,
    (ctx) => {
      ctx.log(`即将播放: ${ctx.url}`);
      // 可以修改上下文
      return { url: ctx.url + '?token=xxx' };
    }
  );

  // 注册 seek 前钩子：可以限制 seek 范围
  const unregisterBeforeSeek = ctx.hooks.register<{ time: number }, { time: number }>(
    PlayerHooks.BEFORE_SEEK,
    (seekCtx) => {
      // 限制 seek 不超过 3600 秒
      if (seekCtx.time > 3600) {
        return { time: 3600 };
      }
      return seekCtx;
    }
  );

  // 取消注册
  unregisterBeforePlay();
  unregisterBeforeSeek();
}
```

**预定义钩子常量**：

| 钩子名 | 常量 | 上下文类型 | 说明 |
|--------|------|-----------|------|
| `player:beforePlay` | `PlayerHooks.BEFORE_PLAY` | `{ url }` | 播放前，可修改 URL |
| `player:afterPlay` | `PlayerHooks.AFTER_PLAY` | — | 播放后 |
| `player:beforeSeek` | `PlayerHooks.BEFORE_SEEK` | `{ time }` | 跳转前，可修改目标时间 |
| `player:afterSeek` | `PlayerHooks.AFTER_SEEK` | `{ time }` | 跳转后 |

### 4.5 log — 日志函数

自动带 `[Plugin:插件名]` 前缀的日志函数，输出到 `PluginManager` 的 logger。

```typescript
install(player: VideoPlayer): void {
  const ctx = player.pluginManager.context!;

  ctx.log('插件已安装');                    // [Plugin:dash] 插件已安装
  ctx.log('缓冲长度: 12.5s');              // [Plugin:dash] 缓冲长度: 12.5s
  ctx.log('码率切换: 5000 → 8000');        // [Plugin:dash] 码率切换: 5000 → 8000
}
```

---

## 五、现有插件使用方式

### 5.1 当前方式（直接通过 player 访问）

```typescript
// DashPlugin.ts
install(player: VideoPlayer): void {
  this.player = player;
  this.eventBus = player.events;                    // 直接取 player.events
  player.events.on('player:mounted', (data) => {    // 直接用 player.events
    this.videoElement = data.video;
  });
}

// DanmakuPlugin.ts
install(player: VideoPlayer): void {
  const events: PlayerEventBus = player.events;     // 直接取 player.events
  events.on(PlayerEventEnum.MOUNTED, (data) => {    // 监听核心事件
    this.video = data.video;
  });
  events.on(PlayerEventEnum.PLAY, () => {           // 监听播放事件
    this.manager?.play();
  });
}
```

### 5.2 推荐方式（通过 PluginContext 访问）

```typescript
// 未来版本：install 接收 PluginContext
install(ctx: PluginContext): void {
  // 播放器核心事件通过 player.events
  ctx.player.events.on('player:mounted', (data) => {
    this.videoElement = data.video;
    ctx.log('已获取视频元素');
  });

  // 插件间通信通过 ctx.events
  ctx.events.on('dash:statsUpdate', (stats) => {
    ctx.log(`缓冲: ${stats.bufferLength}s`);
  });

  // 状态管理通过 ctx.state
  ctx.state.set('dash.initialized', true);

  // 钩子通过 ctx.hooks
  ctx.hooks.register(PlayerHooks.BEFORE_PLAY, (playCtx) => {
    ctx.log(`即将播放: ${playCtx.url}`);
    return playCtx;
  });
}
```

---

## 六、创建自定义插件

### 6.1 最小化插件

```typescript
import type { Plugin } from '@hili-player/player';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',

  install(player) {
    player.events.on('player:mounted', () => {
      console.log('播放器已挂载');
    });
  },

  uninstall(player) {
    // 清理资源
  },
};

// 使用
const player = new VideoPlayer({ plugins: [myPlugin] });
```

### 6.2 工厂函数模式（推荐）

```typescript
import type { Plugin, PluginOptions } from '@hili-player/player';

interface MyPluginConfig {
  /** 自定义选项 */
  maxRetries?: number;
  options?: PluginOptions;
}

function createMyPlugin(config?: MyPluginConfig): Plugin {
  const maxRetries = config?.maxRetries ?? 3;
  let retryCount = 0;
  let player: VideoPlayer | null = null;

  return {
    name: 'my-plugin',
    version: '1.0.0',
    description: '自定义插件示例',
    options: config?.options,

    install(p) {
      player = p;
      const ctx = p.pluginManager.context;

      // 监听核心事件
      p.events.on('player:mounted', (data) => {
        ctx?.log('播放器已挂载');
      });

      // 监听错误并重试
      p.events.on('player:error', (data) => {
        if (retryCount < maxRetries) {
          retryCount++;
          ctx?.log(`错误重试 (${retryCount}/${maxRetries})`);
          p.reload();
        }
      });
    },

    uninstall() {
      player = null;
      retryCount = 0;
    },
  };
}

// 使用
const player = new VideoPlayer({
  plugins: [createMyPlugin({ maxRetries: 5 })],
});
```

### 6.3 流媒体插件（StreamPlugin）

流媒体插件需要额外实现 `StreamPlugin` 接口，会被 `PluginManager` 自动检测并注册到流媒体中间件。

```typescript
import type { Plugin } from '@hili-player/player';
import type { StreamPlugin, StreamConfig, StreamStats, BufferInfo, QualityLevel } from '@/types/streamPlugin';

class MyStreamPlugin implements StreamPlugin {
  readonly name = 'my-stream';
  readonly type = StreamPluginTypeEnum.CUSTOM;  // 需要新增枚举值
  readonly version = '1.0.0';

  private player: VideoPlayer | null = null;

  install(player: VideoPlayer): void {
    this.player = player;
    player.events.on('player:mounted', (data) => {
      // 获取 video 元素
    });
  }

  uninstall(): void {
    this.destroy();
    this.player = null;
  }

  // StreamPlugin 接口方法
  load(source: string | StreamConfig, videoElement: HTMLVideoElement): void {
    // 加载流媒体源
  }

  destroy(): void {
    // 销毁流媒体实例
  }

  getStats(): StreamStats {
    return { /* 缓冲、码率、帧率等统计信息 */ };
  }

  getBufferInfo(): BufferInfo {
    return { /* 缓冲信息 */ };
  }

  getQualityLevels(): QualityLevel[] {
    return [ /* 可用画质列表 */ ];
  }

  setQualityLevel(index: number): void {
    // 切换画质
  }
}
```

---

## 七、插件生命周期

```
创建播放器
  └─ new VideoPlayer({ plugins: [...] })
       └─ PluginManager.install(plugin)         ← 安装每个插件
            ├─ 创建 PluginContext
            ├─ plugin.install(player)            ← 插件初始化
            ├─ StreamPlugin 自动注册到中间件
            └─ 调试模式继承

播放器运行中
  ├─ plugin.enable()                            ← 可选：启用插件
  ├─ plugin.disable()                           ← 可选：禁用插件
  └─ 插件通过 events/state/hooks 与播放器交互

销毁播放器
  └─ PluginManager.destroy()
       └─ 逐个调用 plugin.uninstall(player)     ← 插件清理资源
```

---

## 八、注意事项

1. **两个 PluginContext 定义**：`types/plugin.ts` 中 `events` 类型为通用 `EventBus`，`packages/player/src/core/plugin.ts` 中为 `PlayerEventBus`。建议统一为 `PlayerEventBus`。

2. **PluginContext 未直接传递给 install()**：当前 `plugin.install(player)` 只接收 `VideoPlayer`，插件需要通过 `player.pluginManager.context` 间接访问。建议后续版本改为 `plugin.install(player, context)`。

3. **插件状态管理器与播放器状态管理器是独立的**：`PluginManager.state` ≠ `VideoPlayer.state`。插件如需读取播放器核心状态（音量、播放状态等），应通过 `player.state` 访问。

4. **插件事件总线与播放器事件总线是独立的**：`PluginManager.events` ≠ `VideoPlayer.events`。插件如需监听播放器核心事件，应通过 `player.events` 订阅。

5. **所有事件订阅必须在 uninstall 中清理**：使用 `events.on()` 返回的取消函数，在 `uninstall()` 中逐一调用，避免内存泄漏。
