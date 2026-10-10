# 弹幕 Provider 设计文档

> 状态：已实现（本文档与代码同步维护）
> 范围：`types/danmaku.ts`、`packages/plugins/src/danmaku/`、`packages/plugins/src/utils/danmaku/`、`packages/player/src/player/VideoPlayer.ts`、demo
> 关联能力：与 `ProgressPreviewProvider`（预览图）、`EnergyProgressProvider`（高能进度条）同属 Provider API 化体系

## 一、背景与目标

弹幕数据历史上由播放器内部直接 fetch 拉取，存在三个问题：

1. **获取逻辑硬编码**：接口地址、响应解析、分片缓存全部耦合在插件内部，外部无法替换为自己的弹幕服务
2. **与分段调度协议冲突**：内部一次性全量拉取与调度器的 30 秒分段请求协议互相干扰
3. **样式来源混乱**：引擎 TS 文件内联 CSS（`style.opacity` 直写等），与 danmaku.scss 样式体系割裂

本次改造达成以下目标：

- **数据 API 化**：弹幕列表获取由外部注入 `DanmakuListProvider`，播放器只负责消费与渲染
- **发送确认 API 化**：弹幕上屏前可经外部 `DanmakuSendProvider` 确认（服务器校验/落库）
- **样式归一**：danmaku.scss 类 + CSS 变量体系为唯一样式来源，TS 内零内联 CSS；DOM 弹幕暂停/恢复沿用 `.danmaku-x-paused` 类机制
- **双引擎保持**：DOM 引擎（CSS 动画，中少量弹幕）+ Canvas 引擎（离屏批量绘制，海量弹幕）懒创建切换

## 二、类型定义（Provider 契约）

类型唯一来源为根 `types/danmaku.ts`，引擎/插件层 `types.ts` 均为重导出，`types/index.ts` 的 `DanmakuConfigSpace` 引用同一符号。

### 2.1 弹幕列表 Provider（拉取方向）

```ts
/**
 * 弹幕列表提供者
 *
 * 播放器按 30 秒时间窗分段调用（[startTime, endTime)，单位秒），
 * 返回该窗口内的弹幕列表。支持三种返回形态：
 * - 同步返回 DanmakuItem[]
 * - 异步返回 Promise<DanmakuItem[]>
 * - 返回 null（该窗口无弹幕，等价于空数组）
 */
export type DanmakuListProvider = (
  startTime: number,
  endTime: number,
) => DanmakuItem[] | Promise<DanmakuItem[]> | null;
```

### 2.2 弹幕发送确认 Provider（提交方向）

```ts
/**
 * 弹幕发送确认提供者
 *
 * 语义：调用方提交弹幕后，先经外部确认（服务器校验/落库），
 * 返回确认后的弹幕（通常回填服务端 id）才会上屏；抛错则不上屏并走失败回调。
 */
export type DanmakuSendProvider = (danmaku: DanmakuItem) => Promise<DanmakuItem>;
```

### 2.3 弹幕数据项

```ts
export interface DanmakuItem {
  id: string | number;  // 唯一ID
  text: string;         // 弹幕内容
  time: number;         // 出现时间（秒）
  type: DanmakuType;    // 弹幕类型（滚动/顶部/底部）
  fontSize?: number;    // 字体大小
  color?: string;       // 字体颜色
  userId?: string;      // 发送者ID
  userName?: string;    // 发送者名称
  isVip?: boolean;      // 是否会员
  weight?: number;      // 弹幕权重（优先级）
  speed?: DanmakuSpeed; // 速度档位
  uid?: string | number; // 发送者UID
}
```

### 2.4 配置空间（DanmakuConfigSpace）

```ts
export interface DanmakuConfigSpace {
  enabled?: boolean;                    // 是否启用弹幕能力
  provider?: DanmakuListProvider;       // 弹幕数据提供者（推荐）
  url?: string;                         // 数据源 URL（便捷通道，provider 优先）
  onSend?: DanmakuSendProvider;         // 发送确认提供者（缺省本地直接上屏）
  visible?: boolean;                    // 是否显示弹幕
  opacity?: number;                     // 透明度 (0-1)
  speed?: number;                       // 速度倍率
  fontSize?: number;                    // 字号（px）
  area?: number;                        // 显示区域占比 (0-1)
}
```

## 三、总体架构与数据流

```
┌──────────────────── 外部开发者 ────────────────────┐
│  const player = new VideoPlayer({                    │
│    danmaku: {                                       │
│      provider: (startTime, endTime) => fetch(...),  │
│      onSend: (danmaku) => api.send(danmaku),        │
│    },                                               │
│  });                                                │
└──────────────┬──────────────────────────────────────┘
               │ normalizeConfig 白名单透传
┌──────────────▼──────────────────────────────────────┐
│ VideoPlayer.props.danmaku                           │
│  ├─ 挂载期（MOUNTED 后）：DanmakuPlugin.wireDataSource│
│  │   ├─ provider 存在 → wrapProvider 包装             │
│  │   │   （同步/异步/null 统一收窄为 Promise<Item[]>） │
│  │   ├─ 仅 url 存在 → createUrlLoader 包装            │
│  │   │   （一次性全量拉取 + 时间窗过滤缓存）          │
│  │   └─ 均无 → 保持无数据源，可 loadDanmaku()/load()  │
│  └─ manager.setDataSource(loader)                    │
┌──────────────▼──────────────────────────────────────┐
│ DanmakuScheduler（分段调度）                           │
│  ├─ 播放时间驱动：当前窗口±preloadSegments 预取        │
│  ├─ 30 秒窗口 [t0, t0+30) 调用 loader                 │
│  ├─ 段缓存（命中直接返回）+ 乱序容忍（过期段丢弃）      │
│  └─ Worker 查询（query → keys → 主线程回填 Item）     │
│      超时兜底：1s 无回包 terminate + 降级同步查询      │
┌──────────────▼──────────────────────────────────────┐
│ 渲染引擎（DOMEngine / CanvasEngine 懒创建）            │
│  ├─ DOM：CSS 动画（.danmaku-x-roll + CSS 变量）        │
│  └─ Canvas：rAF 循环 + 文本精灵缓存 + 离屏双缓冲       │
└──────────────────────────────────────────────────────┘
```

### 3.1 数据流关键点

| 环节 | 行为 |
| --- | --- |
| 配置透传 | `normalizeConfig.ts` 白名单式拷贝 `provider`/`onSend`（函数引用直接透传，`url` 兼容旧 `source` 键并迁移告警） |
| 接线时机 | 插件订阅 `MOUNTED` 事件后 `wireDataSource()`，挂载即同步当前状态值再订阅状态键 |
| 返回形态收窄 | `wrapProvider` 用 `await` 统一同步/异步/null 三态为 `Promise<DanmakuItem[]>` |
| 分段协议 | 调度器按 `segmentDuration=30s` 分段，`preloadSegments=2` 预取相邻段，seek 时窗口重算并同步发射命中弹幕 |
| 段缓存 | 调度器内部 Map 缓存已加载段，重复窗口请求直接命中（cacheHits 统计） |
| Worker 超时 | 单次查询 1s 未回包 → terminate Worker + 清空 pending + 降级同步查询路径，保证主线程被节流时不卡死 |

## 四、发送链路（提交方向）

发送的唯一入口是 `DANMAKU_SEND` 事件（SendBar 提交与 `player.sendDanmaku()` 均只广播此事件，插件内部组装弹幕）：

```
SendBar / player.sendDanmaku(text, options)
  → events.emit(DANMAKU_SEND, { text, options })
  → DanmakuPlugin.handleSend()
      ├─ 读取状态键组装完整弹幕（DANMAKU_COLOR / DANMAKU_MODE 映射 type，
      │   组装 id / userId / weight 等）
      ├─ onSend 已配置 → await onSend(danmaku)
      │     ├─ 成功：返回确认弹幕（回填服务端 id）→ 上屏 + emit(DANMAKU_SENT)
      │     └─ 抛错：不上屏 + emit(DANMAKU_SEND_ERROR)
      └─ onSend 缺省 → 本地直接上屏 + emit(DANMAKU_SENT)
```

自发送的弹幕带 `danmaku-x-self` 白框高亮样式（danmaku.scss 提供），与普通弹幕走同一渲染管线。

## 五、状态键联动（设置面板 ↔ 引擎）

播放器状态（`PlayerStateKeyEnum.DANMAKU_*`）是设置面板与引擎间的唯一通道，插件订阅后即时换算并应用：

| 状态键 | 值域 | 转换 |
| --- | --- | --- |
| `DANMAKU_VISIBLE` | boolean | `setVisible` → 引擎层切换 `.danmaku-x-hide` 类 |
| `DANMAKU_OPACITY` | 0-1 | `setOpacity` → 弹幕元素 `--opacity` CSS 变量（已渲染元素同步刷新） |
| `DANMAKU_SPEED` | 倍率 | `setSpeedMultiplier`（引擎收敛 0.1-5） |
| `DANMAKU_DENSITY` | 0-1 | `setDensity` → 调度器密度限制 |
| `DANMAKU_AREA` | 0-100 | `setAreaRatio(v / 100)` |
| `DANMAKU_FONT_SIZE` | 0-100 | `setFontSizeScale(0.5 + v / 100)` |
| `DANMAKU_SCALE_WITH_SCREEN` | boolean | `setAutoScale` |
| `DANMAKU_COLOR` | `#RRGGBB` | 发送时读取（无即时效果，不订阅） |
| `DANMAKU_MODE` | 1/4/5 | 发送时映射为弹幕类型（无即时效果，不订阅） |

挂载期 `applyInitialSettings()` 先用当前状态值全量同步一次（覆盖播放器构造期写入的初始配置），再建立订阅，保证设置面板与引擎永不脱节。

## 六、渲染引擎与 CSS 体系

### 6.1 样式唯一来源

**danmaku.scss 的类 + CSS 变量体系是弹幕样式的唯一来源，引擎 TS 内零内联 CSS**（运行时注入，与播放器样式解耦）：

| 类 / 变量 | 职责 | 挂载位置 |
| --- | --- | --- |
| `.danmaku-layer` | DOM 引擎弹幕层（定位/尺寸/指针事件） | 引擎创建时挂 className |
| `.danmaku-canvas` | Canvas 引擎画布（硬件加速） | 同上 |
| `.danmaku-x-dm` | 单条弹幕基础样式（字体/阴影/描边全走变量） | 每条弹幕元素 |
| `.danmaku-x-show` | 显示态：`opacity: var(--opacity, 1)` | 上屏时挂 |
| `.danmaku-x-roll` | 滚动动画：`animation: roll linear var(--duration) forwards` | 滚动弹幕 |
| `.danmaku-x-paused` | **暂停机制（用户原版）**：`animation-play-state: paused !important` | 容器级（视频暂停时挂 `.danmaku-layer`） |
| `.danmaku-x-hide` | 整体显隐：`opacity: 0` | 引擎层（`setVisible(false)` 时挂） |
| `--opacity` / `--duration` / `--translateX` / `--top` 等 | 单条弹幕参数变量 | 弹幕元素 inline style（仅写变量，不写样式属性） |

### 6.2 暂停/恢复（DOM 弹幕沿用原版机制）

- **DOM 引擎**：视频 `pause`/`play` 事件 → 引擎 `pauseAnimations()`/`resumeAnimations()` → 弹幕层切换 `.danmaku-x-paused` 类，CSS 动画由浏览器暂停/恢复，JS 不参与逐帧控制
- **Canvas 引擎**：rAF 循环驱动，暂停仅置 `isPaused` 标志位停止推进弹幕位置，无需样式类
- 暂停时长经 `adjustDanmakuTime` 补偿到每条弹幕的 `createTime`，恢复后动画进度无缝衔接

### 6.3 双引擎懒创建

- 构造时只创建 DOM 引擎（DOM 模式下页面不出现 `<canvas>`）
- 首次切到 Canvas 模式（`setRenderMode`）才实例化 CanvasEngine，并同步当前显隐状态（避免懒创建时漏挂 `.danmaku-x-hide`）
- `RenderMode.AUTO` 下按渲染数量自动切换（阈值 `autoSwitchThreshold`）

## 七、对外 API 一览

### 7.1 VideoPlayer 公开方法

| 方法 | 说明 |
| --- | --- |
| `sendDanmaku(text, options?)` | 广播 `DANMAKU_SEND`，插件组装后经 onSend 确认上屏 |
| `toggleDanmaku()` / `setDanmakuVisible(visible)` | 切换/设置弹幕显隐（状态键驱动，广播 `DANMAKU_TOGGLE`） |
| `getDanmakuVisible()` / `isDanmakuVisible()` | 查询弹幕可见性 |
| `setDanmakuOpacity(opacity)` | 设置不透明度 (0-1) |
| `setDanmakuSpeed(speed)` | 设置速度倍率 |
| `setDanmakuSource(url)` | url 通道换源（provider 已配置时忽略） |
| `clearDanmaku()` | 广播 `DANMAKU_CLEAR` 清空渲染层 |

### 7.2 DanmakuPluginApi（`player.getPlugin('danmaku')`）

| 方法 | 说明 |
| --- | --- |
| `loadDanmaku(list)` | 一次性注入弹幕列表（不走 provider 分段协议） |
| `load(config)` | 换源（provider/url），清空调度缓存重取当前窗口 |
| `send(text, options?)` / `sendBatch(danmakus)` | 发送单条/批量弹幕 |
| `clear()` | 清空当前渲染的弹幕 |
| `setVisible` / `setOpacity` / `setSpeedMultiplier` / `setDensity` | 即时效果参数 |
| `setFontSize` / `setFontSizeScale` / `setArea` / `setAreaRatio` / `setAutoScale` | 字号/区域参数（档位与连续值双轨） |
| `setRenderMode(mode)` | 切换 DOM/Canvas/AUTO |
| `getStats()` | 性能统计（fps/渲染数/池化占用/内存估算） |

### 7.3 事件广播

| 事件 | 载荷 | 时机 |
| --- | --- | --- |
| `DANMAKU_SEND` | `{ text, options }` | 提交请求（SendBar / sendDanmaku） |
| `DANMAKU_SENT` | 确认后的弹幕 | 上屏成功 |
| `DANMAKU_SEND_ERROR` | 错误信息 | onSend 抛错 |
| `DANMAKU_TOGGLE` | `{ visible }` | 显隐切换 |
| `DANMAKU_CLEAR` | — | 清空请求 |
| `DANMAKU_OPACITY_CHANGE` / `DANMAKU_SPEED_CHANGE` | 数值 | 参数变化 |

## 八、外部开发者接入示例

### 8.1 自定义 provider（推荐，接口分页请求）

```ts
const player = new VideoPlayer({
  url: 'https://example.com/video.m3u8',
  danmaku: {
    // 播放器按 30 秒窗口调用；接口分页与缓存由外部掌控
    provider: async (startTime, endTime) => {
      const res = await fetch(
        `/api/danmaku?from=${startTime}&to=${endTime}`,
      );
      if (!res.ok) return null; // 该窗口无数据，播放器容错
      return (await res.json()) as DanmakuItem[];
    },
    // 发送确认：服务器校验/落库后回填 id 才上屏
    onSend: async (danmaku) => {
      const res = await fetch('/api/danmaku/send', {
        method: 'POST',
        body: JSON.stringify(danmaku),
      });
      if (!res.ok) throw new Error('send failed');
      return (await res.json()) as DanmakuItem;
    },
  },
});
```

### 8.2 本地静态数据（demo 用法）

```ts
const SAMPLE_DANMAKU: DanmakuItem[] = [
  { id: 1, text: '前方高能', time: 3, type: DanmakuType.SCROLL, color: '#ffffff' },
  // ...
];

const player = new VideoPlayer({
  danmaku: {
    // 同步过滤即可：分段协议由播放器驱动，本地数组零成本
    provider: (startTime, endTime) =>
      SAMPLE_DANMAKU.filter(
        (item) => item.time >= startTime && item.time < endTime,
      ),
  },
});
```

### 8.3 url 便捷通道

```ts
const player = new VideoPlayer({
  danmaku: {
    url: '/api/danmaku/all?cid=123', // 返回 DanmakuItem[] JSON
  },
});
// 播放器包装为「一次性全量拉取 + 时间窗过滤」loader，缓存避免重复请求
```

## 九、边界与容错

| 场景 | 行为 |
| --- | --- |
| provider 返回 null / 抛错 | 该窗口按空列表处理，不中断后续窗口请求 |
| 窗口请求乱序（慢请求晚到） | 过期段结果丢弃，不污染当前窗口 |
| Worker 无响应 | 1s 超时 terminate + 降级同步查询，`renderQueryPending` 防重入保证不卡死发射链 |
| 换源 `load()` | 清空调度缓存并重取当前窗口，渲染层清空 |
| seek | 窗口重算 + 同步发射命中弹幕（`handleSmallSeek` 短跳不清层） |
| 引擎切换 | 清空并按需重启渲染循环，播放状态保持 |
| 懒创建 Canvas 引擎 | 创建即同步当前显隐/透明度/速度等配置，无状态丢失 |
