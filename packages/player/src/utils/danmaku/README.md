# 高性能弹幕系统 API 文档

一个支持 DOM 和 Canvas 双渲染引擎的高性能弹幕系统，支持滚动弹幕、顶部固定弹幕、底部固定弹幕，具备轨道管理、全屏切换、分段加载等特性。

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [API 参考](#api-参考)
- [轨道管理](#轨道管理)
- [配置选项](#配置选项)
- [高级用法](#高级用法)
- [性能优化](#性能优化)
- [示例代码](#示例代码)

## 特性

- 🚀 **双渲染引擎**：DOM 引擎（适合中少量弹幕）+ Canvas 引擎（适合大量弹幕）
- 📊 **智能切换**：根据弹幕数量自动选择最优渲染引擎
- 🛤️ **轨道管理**：支持滚动弹幕轨道、顶部/底部固定弹幕轨道
- 🖥️ **全屏支持**：全屏和非全屏独立轨道，弹幕不重复，自动缩放
- ⏱️ **分段加载**：按时间段分段加载，提升性能
- 🎯 **对象池**：DOM 元素和渲染项对象池，减少 GC
- 🎨 **多种弹幕类型**：滚动弹幕、顶部固定弹幕、底部固定弹幕
- ⚡ **硬件加速**：CSS3 Transform 硬件加速
- 🛡️ **底部安全区域**：预留字幕区域，弹幕过多时才使用
- 📐 **自动缩放**：全屏/非全屏切换时字体和弹幕区域自动同步
- ⏸️ **视频同步**：视频暂停时弹幕自动暂停，播放时恢复
- 🖱️ **鼠标悬停**：鼠标悬停弹幕时暂停该弹幕并返回位置信息
- 🎚️ **速度档位**：5档速度控制（极慢/较慢/适中/较快/极快）
- 📏 **区域控制**：4档区域设置（25%/50%/75%/100%）
- ✏️ **字号调节**：支持动态调整弹幕字号
- 🔍 **弹幕过滤**：支持过滤滚动/固定/彩色弹幕
- 📐 **弹幕自动缩放**：支持开启/关闭弹幕随屏幕大小自动缩放
- 👤 **用户标识**：支持 uid 字段，本人弹幕显示白色边框
- 🎨 **弹幕发送**：支持颜色、字号（小/标准）、位置（滚动/顶部/底部）选择

## 快速开始

### 1. 安装

```bash
# 系统已集成，直接导入使用
```

### 2. 基础用法

```typescript
import { DanmakuEngine, DanmakuType, type DanmakuItem } from '@/utils/danmaku';

// 创建弹幕引擎
const container = document.getElementById('danmaku-container')!;
const engine = new DanmakuEngine(container);

// 启动引擎
engine.start();

// 添加单条弹幕
const danmaku: DanmakuItem = {
  id: 1,
  text: 'Hello World!',
  time: 0,           // 出现时间（秒）
  type: DanmakuType.SCROLL,  // 滚动弹幕
  fontSize: 18,
  color: '#FFFFFF',
  userId: 'user_001',
  userName: '用户001',
  isVip: false,
  weight: 0,
  speed: DanmakuSpeed.NORMAL,
  uid: 1,  // 本人弹幕，会显示白色边框
};

engine.addDanmaku(danmaku, performance.now());

// 批量添加弹幕
const danmakuList: DanmakuItem[] = [
  { id: 2, text: '顶部弹幕', time: 1, type: DanmakuType.TOP, fontSize: 20, color: '#FF0000', userId: 'u1', userName: '用户1', isVip: true, weight: 5, speed: DanmakuSpeed.FAST, uid: 'user_123' },
  { id: 3, text: '底部弹幕', time: 2, type: DanmakuType.BOTTOM, fontSize: 18, color: '#00FF00', userId: 'u2', userName: '用户2', isVip: false, weight: 0, speed: DanmakuSpeed.NORMAL, uid: 'user_456' },
];

engine.addDanmakuBatch(danmakuList, performance.now());
```

### 3. 视频播放器集成

```typescript
import { DanmakuEngine, type DanmakuItem } from '@/utils/danmaku';

class VideoPlayerWithDanmaku {
  private video: HTMLVideoElement;
  private danmakuEngine: DanmakuEngine;
  private danmakuData: DanmakuItem[] = [];

  constructor(videoElement: HTMLVideoElement, danmakuContainer: HTMLElement) {
    this.video = videoElement;
    this.danmakuEngine = new DanmakuEngine(danmakuContainer, {
      renderMode: 'auto',  // 自动选择渲染引擎
      trackHeight: 24,
      trackGap: 4,
    });

    // 监听视频播放
    this.video.addEventListener('play', () => {
      this.danmakuEngine.start();
    });

    this.video.addEventListener('pause', () => {
      this.danmakuEngine.stop();
    });

    this.video.addEventListener('timeupdate', () => {
      this.syncDanmaku();
    });
  }

  // 加载弹幕数据
  loadDanmaku(data: DanmakuItem[]) {
    this.danmakuData = data.sort((a, b) => a.time - b.time);
  }

  // 同步弹幕到当前播放时间
  private syncDanmaku() {
    const currentTime = this.video.currentTime;
    const windowStart = currentTime;
    const windowEnd = currentTime + 2; // 提前2秒加载

    // 获取当前时间窗口的弹幕
    const visibleDanmaku = this.danmakuData.filter(
      d => d.time >= windowStart && d.time <= windowEnd
    );

    visibleDanmaku.forEach(d => {
      this.danmakuEngine.addDanmaku(d, performance.now());
    });
  }
}
```

## API 参考

### DanmakuEngine

主引擎类，管理弹幕的渲染和显示。

#### 构造函数

```typescript
constructor(
  container: HTMLElement,
  config?: Partial<DanmakuEngineConfig>
)
```

**参数：**
- `container` - 弹幕容器元素
- `config` - 引擎配置（可选）

#### 方法

##### start()

启动弹幕渲染引擎。

```typescript
start(): void
```

##### stop()

停止弹幕渲染引擎。

```typescript
stop(): void
```

##### addDanmaku(item, currentTime)

添加单条弹幕。

```typescript
addDanmaku(
  item: DanmakuItem,
  currentTime: number
): boolean
```

**参数：**
- `item` - 弹幕数据
- `currentTime` - 当前时间戳（毫秒）

**返回值：**
- `boolean` - 是否成功添加

##### addDanmakuBatch(items, currentTime)

批量添加弹幕。

```typescript
addDanmakuBatch(
  items: DanmakuItem[],
  currentTime: number
): void
```

##### sendDanmaku(text, options)

发送弹幕（用于用户实时发送）。

```typescript
sendDanmaku(
  text: string,
  options?: Partial<DanmakuItem>
): void
```

**参数：**
- `text` - 弹幕文本内容
- `options` - 弹幕选项（可选）
  - `type` - 弹幕类型：`DanmakuType.SCROLL` | `DanmakuType.TOP` | `DanmakuType.BOTTOM`
  - `color` - 弹幕颜色，如 `#ffffff`、`#ff0000`
  - `fontSize` - 字体大小（像素）
  - `uid` - 发送者UID（uid为1时显示白色边框标识本人弹幕）
  - `speed` - 弹幕速度档位

**示例：**
```typescript
// 发送滚动弹幕
danmakuManager.sendDanmaku('Hello World!');

// 发送顶部固定弹幕
danmakuManager.sendDanmaku('顶部弹幕', {
  type: DanmakuType.TOP,
  color: '#ff0000',
});

// 发送带颜色的滚动弹幕
danmakuManager.sendDanmaku('彩色弹幕', {
  type: DanmakuType.SCROLL,
  color: '#00ff00',
  fontSize: 20,
});

// 发送本人弹幕（显示白色边框）
danmakuManager.sendDanmaku('我的弹幕', {
  uid: 1,  // uid为1时显示白色边框
  color: '#ffffff',
});
```

##### clear()

清空所有弹幕。

```typescript
clear(): void
```

##### resize()

调整尺寸，重新计算轨道。全屏/非全屏切换时自动调用，同步更新字体缩放。

```typescript
resize(): void
```

##### switchScreenMode(mode)

切换屏幕模式（全屏/非全屏）。

```typescript
switchScreenMode(mode: ScreenMode): void
```

**参数：**
- `mode` - `ScreenMode.NORMAL` 或 `ScreenMode.FULLSCREEN`

##### setBottomSafeArea(height)

设置底部安全区域高度（字幕区域），弹幕默认不会覆盖此区域，只有当轨道不足时才会扩展。

```typescript
setBottomSafeArea(height: number): void
```

**参数：**
- `height` - 安全区域高度（像素），默认 80px

**示例：**
```typescript
// 设置 100px 字幕区域
danmakuManager.setBottomSafeArea(100);

// 恢复默认
danmakuManager.setBottomSafeArea(80);
```

##### getTrackInfo()

获取当前轨道信息，包括轨道数量、屏幕模式、容器尺寸等。

```typescript
getTrackInfo(): {
  count: number;           // 轨道数量
  height: number;          // 轨道高度
  screenMode: ScreenMode;  // 当前屏幕模式
  containerWidth: number;  // 容器宽度
  containerHeight: number; // 容器高度
}
```

##### setOnDanmakuHover(callback)

设置弹幕悬停回调。当鼠标悬停在弹幕上时，该弹幕会暂停并触发回调，离开时恢复播放。

```typescript
setOnDanmakuHover(
  callback: (
    danmaku: DanmakuRenderItem | null,
    position: { x: number; y: number } | null
  ) => void
): void
```

**参数：**
- `callback` - 回调函数
  - `danmaku` - 悬停的弹幕项（离开时为空）
  - `position` - 弹幕底部中间左边位置 `{ x, y }`（离开时为空）

**示例：**
```typescript
// 设置悬停回调
danmakuManager.setOnDanmakuHover((danmaku, position) => {
  if (danmaku && position) {
    console.log('悬停弹幕:', danmaku.text);
    console.log('用户:', danmaku.userName);
    console.log('位置:', position); // { x: 100, y: 200 }
    
    // 可以显示悬浮框
    showTooltip(danmaku, position);
  } else {
    console.log('离开弹幕');
    hideTooltip();
  }
});
```

##### setSpeed(speed)

设置弹幕速度档位。

```typescript
setSpeed(speed: DanmakuSpeed): void
```

**参数：**
- `speed` - 速度档位：`DanmakuSpeed.VERY_SLOW` | `DanmakuSpeed.SLOW` | `DanmakuSpeed.NORMAL` | `DanmakuSpeed.FAST` | `DanmakuSpeed.VERY_FAST`

**说明：**
- 修改后新渲染的弹幕会使用新速度
- 已存在的弹幕保持原速度

**示例：**
```typescript
// 设置极慢速度
engine.setSpeed(DanmakuSpeed.VERY_SLOW);

// 设置较快速度
engine.setSpeed(DanmakuSpeed.FAST);
```

##### getSpeed()

获取当前弹幕速度档位。

```typescript
getSpeed(): DanmakuSpeed
```

##### setArea(area)

设置弹幕区域档位。

```typescript
setArea(area: DanmakuArea): void
```

**参数：**
- `area` - 区域档位：`DanmakuArea.QUARTER` | `DanmakuArea.HALF` | `DanmakuArea.THREE_QUARTERS` | `DanmakuArea.FULL`

**说明：**
- 修改后新渲染的弹幕会使用新区域
- 已存在的弹幕保持原位置

**示例：**
```typescript
// 设置半屏区域
engine.setArea(DanmakuArea.HALF);

// 设置全屏
engine.setArea(DanmakuArea.FULL);
```

##### getArea()

获取当前弹幕区域档位。

```typescript
getArea(): DanmakuArea
```

##### setFontSize(fontSize)

设置弹幕字号。

```typescript
setFontSize(fontSize: number): void
```

**参数：**
- `fontSize` - 字号大小（像素），范围 12-32

**说明：**
- 修改后新渲染的弹幕会使用新字号
- 已存在的弹幕保持原字号

**示例：**
```typescript
// 设置大字弹幕
engine.setFontSize(24);

// 恢复默认
engine.setFontSize(18);
```

##### getFontSize()

获取当前弹幕字号。

```typescript
getFontSize(): number
```

##### setAutoScale(autoScale)

设置是否自动随屏幕大小缩放弹幕。

```typescript
setAutoScale(autoScale: boolean): void
```

**参数：**
- `autoScale` - 是否自动缩放，默认 true

**说明：**
- 开启后，弹幕会随窗口大小自动缩放（基于1280px宽度计算，最大1.5倍）
- 关闭后，弹幕保持固定大小，不随窗口变化
- 修改后立即生效

**示例：**
```typescript
// 开启自动缩放
engine.setAutoScale(true);

// 关闭自动缩放（固定大小）
engine.setAutoScale(false);
```

##### getAutoScale()

获取当前是否自动缩放弹幕。

```typescript
getAutoScale(): boolean
```

##### setFilter(filter)

设置弹幕过滤器。

```typescript
setFilter(filter: DanmakuFilter): void
```

**参数：**
- `filter` - 过滤器配置：`{ scroll?: boolean, fixed?: boolean, colorful?: boolean }`

**说明：**
- 修改后立即生效
- 新添加的弹幕会根据过滤器判断是否显示
- 可以多选或不选，默认不过滤

**示例：**
```typescript
// 过滤滚动弹幕
engine.setFilter({ scroll: true });

// 过滤固定和彩色弹幕
engine.setFilter({ fixed: true, colorful: true });

// 不过滤（重置）
engine.setFilter({});
```

##### getFilter()

获取当前弹幕过滤器配置。

```typescript
getFilter(): DanmakuFilter
```

##### resetFilter()

重置弹幕过滤器（清除所有过滤）。

```typescript
resetFilter(): void
```

##### updateConfig(config)

更新配置。

```typescript
updateConfig(config: Partial<DanmakuEngineConfig>): void
```

##### getStats()

获取渲染统计信息。

```typescript
getStats(): {
  renderCount: number;
  poolStats: {
    elementPool: { available: number; inUse: number; total: number };
    itemPool: { available: number; inUse: number; total: number };
  };
}
```

##### destroy()

销毁引擎，释放资源。

```typescript
destroy(): void
```

### 类型定义

#### DanmakuItem

弹幕数据项。

```typescript
interface DanmakuItem {
  /** 弹幕ID */
  id: number | string;
  /** 弹幕文本 */
  text: string;
  /** 出现时间（秒） */
  time: number;
  /** 弹幕类型 */
  type: DanmakuType;
  /** 字体大小 */
  fontSize?: number;
  /** 颜色 */
  color?: string;
  /** 用户ID */
  userId?: string;
  /** 用户名 */
  userName?: string;
  /** 是否VIP */
  isVip?: boolean;
  /** 权重（用于排序） */
  weight?: number;
  /** 弹幕速度档位 */
  speed?: DanmakuSpeed;
  /** 发送者UID（用于标识本人弹幕，uid为1时显示白色边框） */
  uid?: string | number;
}
```

#### DanmakuType

弹幕类型枚举。

```typescript
enum DanmakuType {
  SCROLL = 1,   // 滚动弹幕（从右向左）
  TOP = 2,      // 顶部固定弹幕
  BOTTOM = 3,   // 底部固定弹幕
  ADVANCED = 4, // 高级弹幕（预留）
}
```

#### DanmakuSpeed

弹幕速度档位枚举。

```typescript
enum DanmakuSpeed {
  VERY_SLOW = 1,  // 极慢 - 0.5倍速
  SLOW = 2,       // 较慢 - 0.75倍速
  NORMAL = 3,     // 适中 - 1.0倍速（默认）
  FAST = 4,       // 较快 - 1.5倍速
  VERY_FAST = 5,  // 极快 - 2.0倍速
}
```

#### DanmakuFontSize

弹幕字号档位枚举（用于发送弹幕时选择字号）。

```typescript
enum DanmakuFontSize {
  SMALL = 0.8,   // 小字号 - 0.8倍基础字号
  NORMAL = 1.0,  // 标准字号（默认）
}
```

**使用示例：**
```typescript
// 发送小字号弹幕
danmakuManager.sendDanmaku('小字弹幕', {
  fontSize: 18 * DanmakuFontSize.SMALL,  // 14.4px
});

// 发送标准字号弹幕
danmakuManager.sendDanmaku('标准弹幕', {
  fontSize: 18 * DanmakuFontSize.NORMAL,  // 18px
});
```

#### DanmakuArea

弹幕区域档位枚举。

```typescript
enum DanmakuArea {
  QUARTER = 0.25,        // 25% - 仅顶部区域
  HALF = 0.5,            // 50% - 上半区域
  THREE_QUARTERS = 0.75, // 75% - 大部分区域
  FULL = 1,              // 100% - 全屏（默认）
}
```

#### DanmakuFilter

弹幕过滤器配置接口。

```typescript
interface DanmakuFilter {
  scroll?: boolean;   // 过滤滚动弹幕
  fixed?: boolean;    // 过滤固定弹幕（顶部+底部）
  colorful?: boolean; // 过滤彩色弹幕（非白色）
}
```

#### ScreenMode

屏幕模式枚举。

```typescript
enum ScreenMode {
  NORMAL = 'normal',
  FULLSCREEN = 'fullscreen',
}
```

#### RenderMode

渲染模式枚举。

```typescript
enum RenderMode {
  AUTO = 'auto',     // 自动选择
  DOM = 'dom',       // DOM 渲染
  CANVAS = 'canvas', // Canvas 渲染
}
```

## 轨道管理

### 轨道分配策略

#### 滚动弹幕轨道

- 弹幕从右侧进入，向左滚动
- 自动分配可用轨道
- 轨道碰撞检测，防止重叠
- 支持速度差异检测

#### 固定弹幕轨道

**顶部固定弹幕：**
- 从上方轨道开始分配
- 使用屏幕顶部 1/3 区域
- 居中显示
- 淡入淡出动画

**底部固定弹幕：**
- 从下方轨道开始分配
- 使用屏幕底部 1/3 区域
- 居中显示
- 淡入淡出动画

### 轨道配置

```typescript
const engine = new DanmakuEngine(container, {
  // 轨道高度（像素）
  trackHeight: 24,
  
  // 轨道间距（像素）
  trackGap: 4,
  
  // 顶部边距（像素）
  topMargin: 10,
  
  // 底部边距（像素）
  bottomMargin: 10,
  
  // 底部安全区域（像素）- 字幕区域，默认 80px
  bottomSafeArea: 80,
  
  // 碰撞检测安全距离（像素）
  safeDistance: 20,
});
```

### 底部安全区域

系统默认预留底部 80px 作为字幕安全区域，弹幕不会覆盖此区域。当弹幕过多、轨道不足时，系统会自动扩展轨道到底部安全区域。

```typescript
// 设置更大的字幕区域（如 120px）
danmakuManager.setBottomSafeArea(120);

// 获取当前轨道信息
const info = danmakuManager.getTrackInfo();
console.log(`当前有 ${info.count} 条轨道`);
console.log(`容器尺寸: ${info.containerWidth}x${info.containerHeight}`);
console.log(`屏幕模式: ${info.screenMode}`);
```

### 获取轨道信息

```typescript
// 通过引擎获取轨道管理器
const trackManager = engine['trackManager'];

// 获取当前轨道数量
const trackCount = trackManager.getTrackCount();

// 获取轨道统计
const stats = trackManager.getStats();
```

## 配置选项

### DanmakuEngineConfig

```typescript
interface DanmakuEngineConfig {
  // ========== 渲染配置 ==========
  
  /** 渲染模式 */
  renderMode: RenderMode;
  
  /** 字体 */
  fontFamily: string;
  
  /** 基础字体大小 */
  baseFontSize: number;
  
  /** 字体大小缩放 */
  fontSizeScale: number;
  
  /** 透明度 */
  opacity: number;
  
  // ========== 轨道配置 ==========
  
  /** 轨道高度 */
  trackHeight: number;
  
  /** 轨道间距 */
  trackGap: number;
  
  /** 顶部边距 */
  topMargin: number;
  
  /** 底部边距 */
  bottomMargin: number;
  
  /** 碰撞检测安全距离 */
  safeDistance: number;
  
  // ========== 性能配置 ==========
  
  /** 最大同时渲染弹幕数 */
  maxRenderCount: number;
  
  /** 是否使用CSS动画 */
  useCSSAnimation: boolean;
  
  /** 是否使用Transform */
  useTransform: boolean;
  
  /** 是否开启硬件加速 */
  hardwareAcceleration: boolean;
  
  /** Canvas切换阈值（超过此数量切换到Canvas渲染） */
  canvasThreshold: number;
  
  /** 对象池初始大小 */
  poolSize: number;
  
  /** 分段时长（秒） */
  segmentDuration: number;
}
```

### 默认配置

```typescript
const defaultConfig: DanmakuEngineConfig = {
  // 渲染
  renderMode: RenderMode.AUTO,
  fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
  baseFontSize: 18,
  fontSizeScale: 1,
  opacity: 1,
  
  // 轨道
  trackHeight: 24,
  trackGap: 4,
  topMargin: 10,
  bottomMargin: 10,
  bottomSafeArea: 80,  // 底部安全区域（字幕区域）
  safeDistance: 20,
  
  // 性能
  maxRenderCount: 500,
  useCSSAnimation: true,
  useTransform: true,
  hardwareAcceleration: true,
  canvasThreshold: 200,
  poolSize: 100,
  segmentDuration: 30,
};
```

## 高级用法

### 1. 分段加载

适用于长视频，按时间段分段加载弹幕。

```typescript
import { DanmakuScheduler } from '@/utils/danmaku';

const scheduler = new DanmakuScheduler({
  segmentDuration: 30,  // 每30秒一个分段
});

// 添加弹幕数据
scheduler.addDanmaku(danmakuList);

// 获取当前时间段的弹幕
const currentTime = video.currentTime;
const segmentDanmaku = scheduler.getSegmentDanmaku(currentTime);

// 监听时间段变化
scheduler.onSegmentChange((segmentIndex, danmakuList) => {
  console.log(`切换到第 ${segmentIndex} 段，包含 ${danmakuList.length} 条弹幕`);
});
```

### 2. 自定义渲染

```typescript
// 自定义弹幕样式
engine.updateConfig({
  fontFamily: 'Arial, sans-serif',
  baseFontSize: 20,
  opacity: 0.9,
});

// 自定义弹幕处理
engine.addDanmaku({
  id: 'custom-1',
  text: '自定义弹幕',
  time: 0,
  type: DanmakuType.SCROLL,
  fontSize: 24,        // 大字
  color: '#FFD700',    // 金色
  isVip: true,
  weight: 10,          // 高权重
}, performance.now());
```

### 3. 事件监听

```typescript
// 监听弹幕点击
container.addEventListener('danmaku-click', (e: CustomEvent) => {
  const danmaku = e.detail;
  console.log('点击了弹幕:', danmaku.text);
});

// 监听弹幕渲染
engine.onRender = (danmaku) => {
  console.log('渲染弹幕:', danmaku.id);
};
```

### 4. 弹幕速度、区域和过滤控制

```typescript
// 设置弹幕速度（5档）
engine.setSpeed(DanmakuSpeed.FAST);  // 较快

// 设置弹幕区域（4档）
engine.setArea(DanmakuArea.HALF);  // 半屏

// 设置弹幕字号
engine.setFontSize(20);

// 设置弹幕过滤器
engine.setFilter({
  scroll: true,    // 过滤滚动弹幕
  colorful: true,  // 过滤彩色弹幕
});

// 重置过滤器
engine.resetFilter();
```

### 5. 全屏切换与自动缩放

全屏切换时，系统会自动：
- 切换屏幕模式（NORMAL / FULLSCREEN）
- 重新计算轨道数量
- 调整字体缩放比例（基于 1280px 宽度，最大 1.5 倍）
- 同步更新 Canvas/DOM 尺寸

```typescript
// 监听全屏变化
document.addEventListener('fullscreenchange', () => {
  const isFullscreen = !!document.fullscreenElement;
  
  engine.switchScreenMode(
    isFullscreen ? ScreenMode.FULLSCREEN : ScreenMode.NORMAL
  );
  
  // 重新调整尺寸（会自动更新字体缩放）
  engine.resize();
});

// 手动切换全屏
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    videoContainer.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// 获取当前轨道信息
const trackInfo = engine.getTrackInfo();
console.log(`轨道数量: ${trackInfo.count}`);
console.log(`容器尺寸: ${trackInfo.containerWidth}x${trackInfo.containerHeight}`);
```

## 性能优化

### 1. 自动渲染引擎切换

```typescript
const engine = new DanmakuEngine(container, {
  renderMode: RenderMode.AUTO,  // 自动选择
  canvasThreshold: 200,         // 超过200条切换到Canvas
});
```

### 2. DPR 限制

Canvas 引擎会自动限制 DPR（Device Pixel Ratio）最大为 2，避免在高分辨率屏幕上渲染过大的画布：
- 例如 1920x1080 屏幕，DPR=3 时，画布为 3840x2160 而非 5760x3240
- 减少约 55% 的渲染面积，显著提升性能

### 3. Resize 防抖

容器尺寸变化时使用 300ms 防抖，避免频繁调用 resize：
- 已存在的弹幕会继续按原位置移动，不会重新计算
- 新的弹幕会使用新的尺寸和字体缩放

### 4. 渲染优化

- **Canvas**: 每帧只遍历可见弹幕，使用局部变量缓存配置
- **DOM**: CSS3 Transform 硬件加速，will-change 优化

### 5. 分段加载优化

```typescript
// 只加载当前时间段的弹幕
const scheduler = new DanmakuScheduler({
  segmentDuration: 30,
});

// 预加载下一段
scheduler.preloadNextSegment(currentTime);
```

### 5. 性能监控

```typescript
// 获取统计信息
setInterval(() => {
  const stats = engine.getStats();
  console.log('渲染中:', stats.renderCount);
  console.log('对象池:', stats.poolStats);
}, 5000);
```

## 示例代码

### 完整视频播放器示例

```typescript
import { 
  DanmakuEngine, 
  DanmakuType, 
  RenderMode,
  ScreenMode,
  type DanmakuItem 
} from '@/utils/danmaku';
import { generateMassiveDanmakuData } from '@/utils/danmakuGenerator';

class AdvancedVideoPlayer {
  private video: HTMLVideoElement;
  private container: HTMLElement;
  private danmakuContainer: HTMLElement;
  private engine: DanmakuEngine;
  private danmakuData: DanmakuItem[] = [];
  private isPlaying = false;

  constructor(
    videoElement: HTMLVideoElement,
    containerElement: HTMLElement
  ) {
    this.video = videoElement;
    this.container = containerElement;
    
    // 创建弹幕容器
    this.danmakuContainer = document.createElement('div');
    this.danmakuContainer.className = 'danmaku-overlay';
    this.danmakuContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;
    this.container.appendChild(this.danmakuContainer);

    // 初始化弹幕引擎
    this.engine = new DanmakuEngine(this.danmakuContainer, {
      renderMode: RenderMode.AUTO,
      trackHeight: 24,
      trackGap: 4,
      maxRenderCount: 500,
      canvasThreshold: 200,
      opacity: 0.9,
    });

    this.bindEvents();
  }

  private bindEvents() {
    // 播放控制
    this.video.addEventListener('play', () => {
      this.isPlaying = true;
      this.engine.start();
    });

    this.video.addEventListener('pause', () => {
      this.isPlaying = false;
      this.engine.stop();
    });

    // 时间同步
    this.video.addEventListener('timeupdate', () => {
      if (this.isPlaying) {
        this.syncDanmaku();
      }
    });

    // 全屏切换
    document.addEventListener('fullscreenchange', () => {
      const mode = document.fullscreenElement 
        ? ScreenMode.FULLSCREEN 
        : ScreenMode.NORMAL;
      this.engine.switchScreenMode(mode);
      this.engine.resize();
    });

    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  // 加载弹幕数据
  loadDanmaku(data: DanmakuItem[]) {
    this.danmakuData = data.sort((a, b) => a.time - b.time);
  }

  // 生成测试弹幕
  generateTestDanmaku(count: number = 100000) {
    this.danmakuData = generateMassiveDanmakuData(600, count);
  }

  // 同步弹幕
  private syncDanmaku() {
    const currentTime = this.video.currentTime;
    const windowSize = 2; // 提前2秒

    const visibleDanmaku = this.danmakuData.filter(
      d => d.time >= currentTime && d.time <= currentTime + windowSize
    );

    visibleDanmaku.forEach(d => {
      this.engine.addDanmaku(d, performance.now());
    });
  }

  // 发送弹幕
  sendDanmaku(text: string, type: DanmakuType = DanmakuType.SCROLL) {
    const danmaku: DanmakuItem = {
      id: Date.now(),
      text,
      time: this.video.currentTime,
      type,
      fontSize: 18,
      color: '#FFFFFF',
      userId: 'current_user',
      userName: '当前用户',
      isVip: false,
      weight: 0,
    };

    this.engine.addDanmaku(danmaku, performance.now());
    this.danmakuData.push(danmaku);
  }

  // 清空弹幕
  clearDanmaku() {
    this.engine.clear();
  }

  // 销毁
  destroy() {
    this.engine.destroy();
    this.danmakuContainer.remove();
  }
}

// 使用
const video = document.getElementById('video') as HTMLVideoElement;
const container = document.getElementById('video-container')!;
const player = new AdvancedVideoPlayer(video, container);

// 加载测试弹幕
player.generateTestDanmaku(100000);

// 发送弹幕
player.sendDanmaku('Hello World!', DanmakuType.SCROLL);
player.sendDanmaku('顶部固定弹幕', DanmakuType.TOP);
player.sendDanmaku('底部固定弹幕', DanmakuType.BOTTOM);
```

### React/Vue 集成示例

```typescript
// React Hook
import { useEffect, useRef } from 'react';
import { DanmakuEngine, type DanmakuItem } from '@/utils/danmaku';

export function useDanmaku(containerRef: React.RefObject<HTMLElement>) {
  const engineRef = useRef<DanmakuEngine | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    engineRef.current = new DanmakuEngine(containerRef.current);
    engineRef.current.start();

    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  const addDanmaku = (item: DanmakuItem) => {
    engineRef.current?.addDanmaku(item, performance.now());
  };

  const clearDanmaku = () => {
    engineRef.current?.clear();
  };

  return { addDanmaku, clearDanmaku };
}

// Vue Composable
import { ref, onMounted, onUnmounted } from 'vue';
import { DanmakuEngine, type DanmakuItem } from '@/utils/danmaku';

export function useDanmaku() {
  const containerRef = ref<HTMLElement | null>(null);
  const engineRef = ref<DanmakuEngine | null>(null);

  onMounted(() => {
    if (!containerRef.value) return;
    
    engineRef.value = new DanmakuEngine(containerRef.value);
    engineRef.value.start();
  });

  onUnmounted(() => {
    engineRef.value?.destroy();
  });

  const addDanmaku = (item: DanmakuItem) => {
    engineRef.value?.addDanmaku(item, performance.now());
  };

  return { containerRef, addDanmaku };
}
```

## VideoPlayer 组件集成

VideoPlayer 组件已内置弹幕控制面板，支持以下功能：

### 弹幕设置面板

播放器控制栏提供独立的弹幕设置按钮，点击后显示设置面板：

- **弹幕速度**：5档选择（极慢/较慢/适中/较快/极快）
- **弹幕区域**：4档选择（1/4/1/2/3/4/全屏）
- **弹幕字号**：12-32px 滑动调节
- **弹幕透明度**：0-100% 滑动调节
- **弹幕过滤**：多选过滤（滚动/固定/彩色）

### 使用示例

```tsx
import VideoPlayer from '@/components/VideoPlayer';
import danmakuData from '@/assets/danmaku/danmaku_100k.json';

function App() {
  return (
    <VideoPlayer
      src="video.mp4"
      poster="poster.jpg"
      initialDanmaku={danmakuData}
      danmakuEnabled={true}
      subtitleUrl="subtitle.ass"
      subtitleEnabled={true}
    />
  );
}
```

### 弹幕数据结构

```typescript
interface DanmakuItem {
  id: number | string;
  text: string;
  time: number;        // 出现时间（秒）
  type: DanmakuType;   // 1=滚动, 2=顶部, 3=底部
  speed?: DanmakuSpeed; // 速度档位（1-5）
  fontSize?: number;
  color?: string;
  userId?: string;
  userName?: string;
  isVip?: boolean;
  weight?: number;
}
```

## 弹幕防挡功能

弹幕系统支持防挡功能，可以动态避开视频中的特定区域（如人物），让弹幕显示在不被遮挡的位置。

### 工作原理

防挡功能使用 CSS mask-image 技术，通过多层遮罩组合实现：
- **第1层**：左边/上边渐变填充（黑色显示弹幕）
- **第2层**：右边/下边渐变填充（黑色显示弹幕）
- **第3层**：镂空 PNG 遮罩图片

**显示规则：**
- **黑色区域**：弹幕可以显示
- **透明区域**：弹幕不显示（避开视频内容）
- **留白区域**（视频黑边）：通过渐变自动填充，显示弹幕

### 技术实现

DOM 引擎使用多层 CSS mask 组合（参考 Bilibili 实现）：
```css
mask-image: 
  linear-gradient(to right, black, black X%, transparent X%),
  linear-gradient(to right, transparent, transparent Y%, black Y%),
  url(mask.png);
mask-composite: source-over;
```

系统会自动计算容器与视频的比例差异，在留白区域（上下或左右黑边）填充渐变，确保弹幕可以正常显示。

### 遮罩获取方式

系统通过 `maskLoader` 函数动态获取遮罩图片，该函数由用户自定义实现：

```typescript
type MaskLoader = (currentTime: number) => Promise<MaskLoaderResult | null>;

interface MaskLoaderResult {
  /** 遮罩图片URL（镂空PNG） */
  maskImage: string;
  /** 遮罩图片的原始宽度（用于比例计算） */
  originalWidth?: number;
  /** 遮罩图片的原始高度（用于比例计算） */
  originalHeight?: number;
}
```

**重要说明：**
- 请求时间参数是当前播放时间，但应该返回 **下一秒** 的遮罩（预加载）
- 返回 `null` 表示该时间点没有遮罩，不设置遮罩
- 遮罩图片比例应与视频比例一致

### 使用示例

#### 1. 基础用法

```typescript
import { DanmakuManager } from '@/utils/danmaku';

// 创建遮罩加载器
const maskLoader: MaskLoader = async (currentTime: number) => {
  // 请求下一秒的图片（预加载）
  const targetTime = currentTime + 1;

  const response = await fetch(`/api/mask?time=${targetTime}`);
  const result = await response.json();

  if (result.success && result.data?.maskUrl) {
    return {
      maskImage: result.data.maskUrl,
      originalWidth: result.data.originalWidth,
      originalHeight: result.data.originalHeight,
    };
  }

  // 返回 null 表示不设置遮罩
  return null;
};

// 配置弹幕管理器
const danmakuManager = new DanmakuManager({
  container: danmakuContainer,
  video: videoElement,
  danmakuMaskConfig: {
    enabled: true,
    maskLoader,
    updateInterval: 1000,  // 每秒更新一次
  },
});
```

#### 2. 动态启用/禁用

```typescript
// 启用防挡
danmakuManager.setMaskConfig({
  enabled: true,
  maskLoader,
  updateInterval: 1000,
});

// 禁用防挡
danmakuManager.disableMask();
```

#### 3. 使用静态遮罩图片

```typescript
// 启用防挡并指定静态遮罩图片
danmakuManager.enableMask('/path/to/mask.png');
```

#### 4. VideoPlayer 组件中使用

```tsx
import VideoPlayer from '@/components/VideoPlayer';

// 创建遮罩加载器
const createMaskLoader = (videoId: string): MaskLoader => {
  return async (currentTime: number) => {
    const targetTime = currentTime + 1;

    try {
      const response = await fetch(
        `/api/mask?time=${targetTime}&videoId=${videoId}`
      );
      const result = await response.json();

      if (result.success && result.data?.maskUrl) {
        return {
          maskImage: result.data.maskUrl,
          originalWidth: result.data.originalWidth,
          originalHeight: result.data.originalHeight,
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  };
};

function App() {
  return (
    <VideoPlayer
      src="video.mp4"
      danmakuMaskEnabled={true}
      danmakuMaskLoader={createMaskLoader('video_001')}
    />
  );
}
```

### 后端 API 规范

遮罩 API 应返回以下格式：

```typescript
{
  success: boolean;
  data: {
    maskUrl: string;        // 遮罩图片URL
    originalWidth?: number;  // 原始宽度
    originalHeight?: number; // 原始高度
    requestedTime: number;   // 请求时间
    targetTime: number;      // 目标时间（预加载）
  };
}
```

### 遮罩图片规范

- **格式**：PNG（支持透明度）
- **内容**：黑色区域表示可显示弹幕，透明区域表示避开
- **比例**：建议与视频分辨率比例一致（如 16:9）
- **尺寸**：建议与视频分辨率一致或等比例缩放

### 性能优化

- **渐变缓存**：容器尺寸和视频比例不变时，缓存渐变计算结果
- **容器变化监听**：容器尺寸变化时自动重新计算渐变
- **遮罩更新间隔可配置**（默认 1000ms）
- **支持遮罩图片缓存**
- **视频暂停时自动停止更新遮罩**
- **关闭弹幕面板时自动停止更新**

### Mock 测试

开发环境可以使用 Mock 服务测试防挡功能：

```typescript
// 使用客户端模拟遮罩
import { createClientMockMaskLoader } from '@/utils/danmaku/mockMaskService';

const mockLoader = createClientMockMaskLoader();

danmakuManager.setMaskConfig({
  enabled: true,
  maskLoader: mockLoader,
  updateInterval: 1000,
});
```

Mock 服务会在客户端动态生成模拟遮罩，无需后端支持。

## 注意事项

1. **容器尺寸**：确保容器有明确的宽高，否则轨道计算可能出错
2. **内存管理**：长时间使用后调用 `destroy()` 释放资源
3. **性能监控**：关注 `getStats()` 返回的渲染数量，避免过多同时渲染
4. **全屏切换**：切换全屏后需要调用 `resize()` 重新计算
5. **时间同步**：视频播放时间与弹幕时间需要精确同步
6. **动态设置**：速度、区域、字号修改后，**已存在的弹幕保持原样**，新渲染的弹幕遵循新设置
7. **过滤器**：过滤器修改后立即生效，影响新添加的弹幕

## 许可证

MIT License
