# 媒体工具库

提供视频播放器监控、码率统计、详细信息面板等功能，支持 dash.js、hls.js、flv.js 和原生视频播放器。

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [API 参考](#api-参考)
- [播放器信息面板](#播放器信息面板)
- [类型定义](#类型定义)

## 特性

- 📊 **多播放器支持**：dash.js、hls.js、flv.js、原生视频播放器
- 📈 **实时监控**：码率、缓冲区、帧率等关键指标
- 📉 **SVG 曲线图**：平滑随时间变动的数据可视化
- 🎯 **详细信息面板**：右键显示播放器编码、清晰度等信息
- ⚡ **性能优化**：关闭面板后自动停止监控节省资源

## 快速开始

### 1. 创建监控器

```typescript
import { MediaPlayerMonitor, PlayerType } from '@/utils/media';

// 获取视频元素
const video = document.getElementById('video') as HTMLVideoElement;

// 创建监控器
const monitor = new MediaPlayerMonitor(video, {
  maxDataPoints: 60,      // 保留60个数据点
  updateInterval: 1000,   // 每秒更新一次
  enableBitrate: true,    // 启用码率监控
  enableBuffer: true,     // 启用缓冲区监控
  enableFPS: true,        // 启用帧率监控
}, {
  onStatsUpdate: (stats) => {
    console.log('码率:', stats.bitrate.total);
    console.log('缓冲区:', stats.buffer.video);
    console.log('帧率:', stats.fps.current);
  },
});

// 如果使用的是 dash.js/hls.js/flv.js，设置播放器实例
monitor.setPlayer(dashPlayer, PlayerType.DASH);

// 开始监控
monitor.start();

// 停止监控
monitor.stop();
```

### 2. 使用播放器信息面板

```typescript
import { createPlayerInfoPanel } from '@/utils/media';

// 创建信息面板（关联视频元素）
const panel = createPlayerInfoPanel(video, {
  title: '播放器详细信息',
  themeColor: '#00a1d6',
  chartWidth: 280,
  chartHeight: 80,
});

// 显示面板
panel.show();

// 隐藏面板
panel.hide();

// 切换显示/隐藏
panel.toggle();

// 销毁面板
panel.destroy();
```

### 3. VideoPlayer 组件集成

VideoPlayer 组件已内置右键菜单支持，点击"播放器详细信息"即可打开面板：

```tsx
import VideoPlayer from '@/components/VideoPlayer';

function App() {
  return (
    <VideoPlayer
      src="video.mp4"
      // 右键播放器即可查看详细信息
    />
  );
}
```

## API 参考

### MediaPlayerMonitor

媒体播放器监控器，支持多种播放器类型的实时监控。

#### 构造函数

```typescript
constructor(
  video: HTMLVideoElement,
  config?: MonitorConfig,
  callbacks?: MonitorCallbacks
)
```

**参数：**
- `video` - 视频元素
- `config` - 监控配置（可选）
- `callbacks` - 回调函数（可选）

#### 方法

##### setPlayer(player, type)

设置播放器实例（用于 dash.js/hls.js/flv.js）。

```typescript
setPlayer(
  player: DashPlayer | HlsPlayer | FlvPlayer,
  type: PlayerType
): void
```

**示例：**
```typescript
// dash.js
const dashPlayer = dashjs.MediaPlayer().create();
dashPlayer.initialize(video, url, true);
monitor.setPlayer(dashPlayer, PlayerType.DASH);

// hls.js
const hls = new Hls();
hls.loadSource(url);
hls.attachMedia(video);
monitor.setPlayer(hls, PlayerType.HLS);

// flv.js
const flvPlayer = flvjs.createPlayer({ type: 'flv', url });
flvPlayer.attachMediaElement(video);
flvPlayer.load();
monitor.setPlayer(flvPlayer, PlayerType.FLV);
```

##### start()

开始监控。

```typescript
start(): void
```

##### stop()

停止监控。

```typescript
stop(): void
```

##### getStats()

获取当前统计信息。

```typescript
getStats(): PlayerStats
```

**返回值：**
```typescript
{
  // 码率信息
  bitrate: {
    current: number;      // 当前总码率 (bps)
    video: number;        // 视频码率 (bps)
    audio: number;        // 音频码率 (bps)
    history: BitrateDataPoint[];  // 历史数据
  };
  
  // 缓冲区信息
  buffer: {
    video: number;        // 视频缓冲区时长 (秒)
    audio: number;        // 音频缓冲区时长 (秒)
    history: BufferDataPoint[];   // 历史数据
  };
  
  // 帧率信息
  fps: {
    current: number;      // 当前帧率
    dropped: number;      // 丢帧数
    history: FrameRateDataPoint[]; // 历史数据
  };
}
```

##### getPlayerDetails()

获取播放器详细信息。

```typescript
getPlayerDetails(): PlayerDetails
```

**返回值：**
```typescript
{
  playerType: PlayerType;      // 播放器类型
  protocol: StreamingProtocol; // 流媒体协议
  videoCodec: string;          // 视频编码
  audioCodec: string;          // 音频编码
  resolution: string;          // 分辨率 (如 "1920x1080")
  frameRate: number;           // 帧率
  currentQuality: string;      // 当前清晰度 (如 "1080P")
  availableQualities: string[]; // 可用清晰度列表
}
```

##### clearData()

清除历史数据。

```typescript
clearData(): void
```

##### destroy()

销毁监控器，释放资源。

```typescript
destroy(): void
```

### PlayerInfoPanel

播放器详细信息面板，显示视频编码、清晰度、帧率、码率等详细信息。

#### 方法

##### show()

显示面板并开始监控。

```typescript
show(): void
```

##### hide()

隐藏面板并停止监控。

```typescript
hide(): void
```

##### toggle()

切换显示/隐藏状态。

```typescript
toggle(): void
```

##### getIsVisible()

获取当前显示状态。

```typescript
getIsVisible(): boolean
```

##### destroy()

销毁面板，释放资源。

```typescript
destroy(): void
```

### createPlayerInfoPanel

创建播放器信息面板的工厂函数。

```typescript
function createPlayerInfoPanel(
  video: HTMLVideoElement,
  config?: PanelConfig
): PlayerInfoPanel
```

**参数：**
- `video` - 视频元素
- `config` - 面板配置（可选）

**示例：**
```typescript
import { createPlayerInfoPanel } from '@/utils/media';

const panel = createPlayerInfoPanel(video, {
  title: '播放器详细信息',
  themeColor: '#00a1d6',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  textColor: '#ffffff',
  chartWidth: 280,
  chartHeight: 80,
});

// 右键菜单中调用
video.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  panel.show();
});
```

## 播放器信息面板

### 面板内容

信息面板显示以下内容：

#### 基本信息
- **播放器类型**：DASH / HLS / FLV / Native
- **流媒体协议**：DASH / HLS / FLV / MP4 / WebM
- **视频编码**：如 H.264、H.265、VP9
- **音频编码**：如 AAC、MP3、Opus
- **分辨率**：如 1920x1080
- **帧率**：如 60fps
- **当前清晰度**：如 1080P、4K

#### 码率信息
- **总码率**：当前总码率（bps）
- **视频码率**：视频流码率（bps）
- **音频码率**：音频流码率（bps）
- **码率曲线图**：实时码率变化趋势

#### 缓冲区信息
- **视频缓冲区**：视频缓冲时长（秒）
- **音频缓冲区**：音频缓冲时长（秒）
- **缓冲区曲线图**：缓冲区变化趋势

#### 帧率信息
- **当前帧率**：实时帧率
- **丢帧数**：累计丢帧数量
- **帧率曲线图**：帧率变化趋势

### 性能优化

- **自动停止监控**：关闭面板后自动停止数据收集，节省性能
- **数据点限制**：可配置最大保留数据点数，防止内存无限增长
- **节流更新**：可配置更新间隔，平衡实时性和性能

## 类型定义

### MonitorConfig

监控器配置接口。

```typescript
interface MonitorConfig {
  /** 最大保留数据点数 */
  maxDataPoints?: number;
  /** 数据更新间隔（毫秒） */
  updateInterval?: number;
  /** 是否启用码率监控 */
  enableBitrate?: boolean;
  /** 是否启用缓冲区监控 */
  enableBuffer?: boolean;
  /** 是否启用帧率监控 */
  enableFPS?: boolean;
}
```

### MonitorCallbacks

监控器回调函数接口。

```typescript
interface MonitorCallbacks {
  /** 统计数据更新回调 */
  onStatsUpdate?: (stats: PlayerStats) => void;
  /** 播放器详情更新回调 */
  onDetailsUpdate?: (details: PlayerDetails) => void;
  /** 码率数据更新回调 */
  onBitrateUpdate?: (data: BitrateDataPoint) => void;
  /** 缓冲区数据更新回调 */
  onBufferUpdate?: (data: BufferDataPoint) => void;
  /** 帧率数据更新回调 */
  onFPSUpdate?: (data: FrameRateDataPoint) => void;
}
```

### PanelConfig

信息面板配置接口。

```typescript
interface PanelConfig {
  /** 面板标题 */
  title?: string;
  /** 主题色 */
  themeColor?: string;
  /** 背景色 */
  backgroundColor?: string;
  /** 文字颜色 */
  textColor?: string;
  /** 边框颜色 */
  borderColor?: string;
  /** 图表宽度 */
  chartWidth?: number;
  /** 图表高度 */
  chartHeight?: number;
}
```

### PlayerType

播放器类型枚举。

```typescript
enum PlayerType {
  DASH = 'dash',       // dash.js
  HLS = 'hls',         // hls.js
  FLV = 'flv',         // flv.js
  NATIVE = 'native',   // 原生视频
  UNKNOWN = 'unknown', // 未知
}
```

### StreamingProtocol

流媒体协议类型枚举。

```typescript
enum StreamingProtocol {
  DASH = 'DASH',
  HLS = 'HLS',
  FLV = 'FLV',
  MP4 = 'MP4',
  WEBM = 'WebM',
  UNKNOWN = 'Unknown',
}
```

### 数据点类型

```typescript
interface BitrateDataPoint {
  timestamp: number;    // 时间戳
  totalBitrate: number; // 总码率 (bps)
  videoBitrate: number; // 视频码率 (bps)
  audioBitrate: number; // 音频码率 (bps)
}

interface BufferDataPoint {
  timestamp: number;    // 时间戳
  videoBuffer: number;  // 视频缓冲区时长 (秒)
  audioBuffer: number;  // 音频缓冲区时长 (秒)
}

interface FrameRateDataPoint {
  timestamp: number;    // 时间戳
  fps: number;          // 帧率
  droppedFrames: number; // 丢帧数
}
```

## 注意事项

1. **播放器实例设置**：使用 dash.js/hls.js/flv.js 时，需要通过 `setPlayer()` 方法设置播放器实例
2. **监控性能**：长时间监控会积累数据，建议设置合理的 `maxDataPoints`
3. **面板生命周期**：关闭面板时会自动停止监控，重新打开时会重新开始
4. **浏览器兼容性**：部分高级功能（如帧率监控）需要浏览器支持相关 API
