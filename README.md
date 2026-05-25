# Hili Player - 极简 TypeScript 视频播放器

基于纯 h 函数架构的轻量级视频播放器，零运行时开销，性能等价于手写原生 JavaScript。

## 特性

- **纯 TypeScript** - 完整类型支持，极致开发体验
- **零运行时开销** - 直接操作真实 DOM，无虚拟 DOM Diff
- **轻量级** - 核心代码量控制在 500 行以内
- **功能完备** - 支持多画质、全屏、画中画、键盘快捷键等
- **模块化设计** - 组件、指令、工具函数分离，按需使用

## 快速开始

### 安装

```bash
pnpm install
```

### 开发

```bash
pnpm run dev
```

### 构建

```bash
pnpm run build
```

### 代码检查

```bash
pnpm run lint
pnpm run typecheck
```

## 使用示例

### 基础用法

```typescript
import { mountPlayer } from 'hili-player';

const player = mountPlayer('#player-container', {
  src: 'https://example.com/video.mp4',
  autoplay: false,
  muted: false,
  volume: 0.8,
});
```

### 多清晰度

```typescript
import { mountPlayer, QualityLevel } from 'hili-player';

const player = mountPlayer('#player-container', {
  src: [
    { quality: QualityLevel.P1080, url: 'https://example.com/video-1080p.mp4', name: '1080P' },
    { quality: QualityLevel.P720, url: 'https://example.com/video-720p.mp4', name: '720P' },
    { quality: QualityLevel.P480, url: 'https://example.com/video-480p.mp4', name: '480P' },
  ],
  defaultQuality: QualityLevel.P1080,
});
```

### 事件监听

```typescript
player.on('play', () => {
  console.log('开始播放');
});

player.on('timeupdate', (currentTime, duration) => {
  console.log('播放进度:', currentTime / duration);
});

player.on('statechange', (state) => {
  console.log('状态变化:', state);
});
```

### API 控制

```typescript
// 播放控制
player.play();
player.pause();
player.toggle();

// 跳转
player.seek(120); // 跳转到 2 分钟

// 音量
player.setVolume(0.5);
player.toggleMute();

// 全屏/画中画
player.toggleFullscreen();
player.togglePip();

// 画质
player.setQuality(QualityLevel.P720);

// 获取状态
const state = player.getState();
console.log(state.currentTime, state.duration);
```

### 播放器状态管理

播放器内置了状态管理器，可以通过 `player.state` 访问：

```typescript
// 获取状态
const currentTime = player.state.get<number>('player.currentTime');
const duration = player.state.get<number>('player.duration');
const volume = player.state.get<number>('player.volume');
const isFullscreen = player.state.get<boolean>('player.isFullscreen');

// 订阅状态变化
const unsubscribe = player.state.subscribe('player.currentTime', (newVal, oldVal) => {
  console.log(`时间变化: ${oldVal} -> ${newVal}`);
});

// 取消订阅
unsubscribe();
```

**可用的状态路径：**

| 路径 | 类型 | 说明 |
|------|------|------|
| `player.state` | PlayerState | 播放状态 |
| `player.currentTime` | number | 当前时间（秒） |
| `player.duration` | number | 总时长（秒） |
| `player.volume` | number | 音量 (0-1) |
| `player.muted` | boolean | 是否静音 |
| `player.playbackRate` | number | 播放速度 |
| `player.buffered` | number | 缓冲百分比 |
| `player.isFullscreen` | boolean | 是否全屏 |
| `player.isPip` | boolean | 是否画中画 |
| `player.isSeeking` | boolean | 是否正在拖拽进度 |
| `player.quality` | QualityLevel | 当前画质 |
| `player.playMode` | PlayMode | 播放模式 |
| `error.code` | number | 错误代码 |
| `error.message` | string | 错误信息 |

### 播放器事件总线

播放器内置了事件总线，可以通过 `player.events` 访问：

```typescript
// 监听事件
const unsubscribe = player.events.on<{ currentTime: number; duration: number }>(
  'player:timeupdate',
  (data) => {
    console.log('播放进度:', data.currentTime / data.duration);
  }
);

// 触发自定义事件
player.events.emit('my:custom:event', { message: 'hello' });

// 取消监听
unsubscribe();
```

**预定义的事件：**

| 事件名 | 数据类型 | 触发时机 |
|--------|----------|----------|
| `player:ready` | undefined | 播放器准备就绪 |
| `player:play` | undefined | 开始播放 |
| `player:beforeplay` | undefined | 播放前 |
| `player:playerror` | `{ error: unknown }` | 播放失败 |
| `player:pause` | undefined | 暂停 |
| `player:ended` | undefined | 播放结束 |
| `player:waiting` | undefined | 缓冲中 |
| `player:timeupdate` | `{ currentTime: number; duration: number }` | 时间更新 |
| `player:progress` | `{ buffered: TimeRanges }` | 缓冲进度变化 |
| `player:seek` | `{ time: number; previousTime: number }` | 跳转 |
| `player:volumechange` | `{ volume: number; muted: boolean }` | 音量变化 |
| `player:ratechange` | `{ playbackRate: number }` | 播放速度变化 |
| `player:fullscreenchange` | `{ isFullscreen: boolean }` | 全屏状态变化 |
| `player:pipchange` | `{ isPip: boolean }` | 画中画状态变化 |
| `player:error` | `{ code: number; message: string }` | 播放错误 |
| `player:click` | `{ event: MouseEvent }` | 点击播放器 |
| `player:dblclick` | `{ event: MouseEvent }` | 双击播放器 |
| `player:statechange` | PlayerState | 播放状态变化 |

### 服务端渲染(SSR)支持

播放器支持服务端渲染，在服务端会渲染占位符而不是视频元素。

```typescript
import { createSSRPlayer, mountPlayer } from 'hili-player';

// 服务端渲染
const player = createSSRPlayer({
  src: 'https://example.com/video.mp4',
  poster: 'https://example.com/poster.jpg',
  ssr: { enabled: true },
});

// 获取虚拟节点
const vnode = player.render();

// 使用你的 SSR 框架渲染为 HTML
// const html = renderToString(vnode);
```

**SSR 配置选项：**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | false | 是否启用 SSR 模式 |
| `placeholder` | string | `<div class="hili-player-placeholder">视频加载中...</div>` | 服务端渲染的占位符 HTML |
| `deferHydration` | boolean | false | 是否延迟客户端激活（hydration） |

**SSR 工具函数：**

```typescript
import { isBrowser, isServer, safeBrowserOperation } from 'hili-player';

// 检查当前环境
if (isBrowser()) {
  // 浏览器环境
  document.getElementById('app');
}

if (isServer()) {
  // 服务端环境
  // 执行服务端特有的逻辑
}

// 安全执行浏览器操作
const element = safeBrowserOperation(() => document.getElementById('app'));
```

**SSR 最佳实践：**

1. **服务端渲染占位符**
   ```typescript
   // 服务端
   const player = createSSRPlayer({
     src: videoUrl,
     poster: posterUrl,
     ssr: { enabled: true },
   });
   const html = renderToString(player.render());
   ```

2. **客户端激活（Hydration）**
   ```typescript
   // 客户端
   const player = mountPlayer('#player', {
     src: videoUrl,
     poster: posterUrl,
     ssr: { enabled: false }, // 或省略
   });
   ```

3. **条件渲染**
   ```typescript
   import { isServer } from 'hili-player';
   
   const config = {
     src: videoUrl,
     ssr: { enabled: isServer() },
   };
   ```

## 键盘快捷键

| 按键 | 功能 |
|------|------|
| `Space` / `K` | 播放/暂停 |
| `←` | 快退 5 秒 |
| `→` | 快进 5 秒 |
| `↑` | 音量增加 |
| `↓` | 音量减少 |
| `F` | 切换全屏 |
| `M` | 切换静音 |
| 双击视频 | 切换全屏 |

## 项目结构

```
src/
├── types/          # 类型定义
├── core/           # 核心模块 (h函数、挂载、销毁)
├── components/     # UI 组件
├── directives/     # 指令系统
├── player/         # 播放器核心类
├── utils/          # 工具函数
├── styles/         # 样式文件
└── index.ts        # 统一导出
```

## 组件使用指南

### PlayButton - 播放按钮

```typescript
import { PlayButton, PlayerState } from 'hili-player';

const button = PlayButton({
  isPlaying: false,
  state: PlayerState.PAUSED,
  onClick: () => console.log('点击播放按钮'),
  onMouseEnter: () => console.log('鼠标进入'),
  onMouseLeave: () => console.log('鼠标离开'),
  onFocus: () => console.log('获得焦点'),
  onBlur: () => console.log('失去焦点'),
});
```

**Props:**
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| isPlaying | boolean | 是 | 是否正在播放 |
| state | PlayerState | 是 | 当前播放状态 |
| onClick | () => void | 是 | 点击回调 |
| onMouseEnter | () => void | 否 | 鼠标进入回调 |
| onMouseLeave | () => void | 否 | 鼠标离开回调 |
| onFocus | () => void | 否 | 获得焦点回调 |
| onBlur | () => void | 否 | 失去焦点回调 |

### TimeDisplay - 时间显示

```typescript
import { TimeDisplay } from 'hili-player';

const timeDisplay = TimeDisplay({
  currentTime: 120,  // 当前时间（秒）
  duration: 300,     // 总时长（秒）
  onClick: () => console.log('点击时间显示'),
  onMouseEnter: () => console.log('鼠标进入'),
  onMouseLeave: () => console.log('鼠标离开'),
});
```

**Props:**
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| currentTime | number | 是 | 当前时间（秒） |
| duration | number | 是 | 总时长（秒） |
| onClick | () => void | 否 | 点击回调 |
| onMouseEnter | () => void | 否 | 鼠标进入回调 |
| onMouseLeave | () => void | 否 | 鼠标离开回调 |

### ProgressBar - 进度条

```typescript
import { ProgressBar } from 'hili-player';

const progressBar = ProgressBar({
  currentTime: 60,
  duration: 300,
  buffered: videoElement.buffered,  // TimeRanges 对象
  onChange: (time) => console.log('跳转到:', time),
  onDragStart: () => console.log('开始拖拽'),
  onDragEnd: () => console.log('结束拖拽'),
});
```

**Props:**
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| currentTime | number | 是 | 当前时间（秒） |
| duration | number | 是 | 总时长（秒） |
| buffered | TimeRanges \| null | 是 | 缓冲范围 |
| onChange | (time: number) => void | 是 | 进度变化回调 |
| onDragStart | () => void | 否 | 开始拖拽回调 |
| onDragEnd | () => void | 否 | 结束拖拽回调 |

### VolumeControl - 音量控制

```typescript
import { VolumeControl } from 'hili-player';

const volumeControl = VolumeControl({
  volume: 0.8,
  muted: false,
  onChange: (vol, mute) => console.log('音量:', vol, '静音:', mute),
  onMuteToggle: () => console.log('切换静音'),
  onShow: () => console.log('音量条显示'),
  onHide: () => console.log('音量条隐藏'),
});
```

**Props:**
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| volume | number | 是 | 当前音量 (0-1) |
| muted | boolean | 是 | 是否静音 |
| onChange | (volume: number, muted: boolean) => void | 是 | 音量变化回调 |
| onMuteToggle | () => void | 否 | 静音切换回调 |
| onShow | () => void | 否 | 音量条显示回调 |
| onHide | () => void | 否 | 音量条隐藏回调 |

### QualitySelector - 画质选择

```typescript
import { QualitySelector, QualityLevel } from 'hili-player';

const qualitySelector = QualitySelector({
  current: QualityLevel.P1080,
  qualities: [QualityLevel.P1080, QualityLevel.P720, QualityLevel.P480],
  onChange: (quality) => console.log('切换到画质:', quality),
  onOpen: () => console.log('下拉菜单打开'),
  onClose: () => console.log('下拉菜单关闭'),
});
```

**Props:**
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| current | QualityLevel | 是 | 当前画质 |
| qualities | QualityLevel[] | 是 | 可用画质列表 |
| onChange | (quality: QualityLevel) => void | 是 | 画质切换回调 |
| onOpen | () => void | 否 | 下拉菜单打开回调 |
| onClose | () => void | 否 | 下拉菜单关闭回调 |

### LoadingOverlay - 加载遮罩

```typescript
import { LoadingOverlay } from 'hili-player';

const loading = LoadingOverlay({
  visible: true,
  text: '加载中...',
  onShow: () => console.log('加载显示'),
  onHide: () => console.log('加载隐藏'),
});
```

**Props:**
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| visible | boolean | 是 | 是否显示 |
| text | string | 否 | 加载提示文字 |
| onShow | () => void | 否 | 显示回调 |
| onHide | () => void | 否 | 隐藏回调 |

### ErrorOverlay - 错误遮罩

```typescript
import { ErrorOverlay } from 'hili-player';

const error = ErrorOverlay({
  code: 2,
  message: '网络错误',
  onRetry: () => console.log('重试'),
  onShow: () => console.log('错误显示'),
  onClose: () => console.log('错误关闭'),
});
```

**Props:**
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | number | 是 | 错误代码 |
| message | string | 是 | 错误信息 |
| onRetry | () => void | 否 | 重试回调 |
| onShow | () => void | 否 | 显示回调 |
| onClose | () => void | 否 | 关闭回调 |

### ControlBar - 控制条

```typescript
import { ControlBar, QualityLevel, PlayMode } from 'hili-player';

const controlBar = ControlBar({
  visible: true,
  isPlaying: true,
  currentTime: 60,
  duration: 300,
  buffered: videoElement.buffered,
  volume: 0.8,
  muted: false,
  playbackRate: 1,
  quality: QualityLevel.P1080,
  qualities: [QualityLevel.P1080, QualityLevel.P720],
  playMode: PlayMode.ORDER,
  isFullscreen: false,
  onPlayPause: () => console.log('播放/暂停'),
  onSeek: (time) => console.log('跳转:', time),
  onVolumeChange: (vol, mute) => console.log('音量:', vol, mute),
  onRateChange: (rate) => console.log('速度:', rate),
  onQualityChange: (q) => console.log('画质:', q),
  onPlayModeChange: (mode) => console.log('播放模式:', mode),
  onFullscreenToggle: () => console.log('全屏切换'),
  onPipToggle: () => console.log('画中画切换'),
  onMouseEnter: () => console.log('鼠标进入控制条'),
  onMouseLeave: () => console.log('鼠标离开控制条'),
  onSettingsClick: () => console.log('设置按钮点击'),
  onSubtitleClick: () => console.log('字幕按钮点击'),
  onDanmakuClick: () => console.log('弹幕按钮点击'),
});
```

## 组件编写方法

### 1. 基本组件结构

```typescript
import { h, defineComponent } from '@/core';
import type { VNode, YourComponentProps } from '@/types';

/**
 * 组件名称和说明
 */
export const YourComponent = defineComponent<YourComponentProps>((props) => {
  // 组件内部状态（使用闭包变量）
  let localState = 0;

  // 事件处理函数
  const handleClick = () => {
    props.onClick?.();
  };

  // 返回 VNode
  return h('div', {
    class: 'your-component',
    onClick: handleClick,
  },
    // 子元素
    h('span', {}, props.title)
  );
});
```

### 2. 使用 ref 操作 DOM

```typescript
export const ComponentWithRef = defineComponent<Props>((props) => {
  let elementRef: HTMLElement | null = null;

  const saveRef = (el: HTMLElement) => {
    elementRef = el;
    // 可以在这里进行 DOM 操作
    if (elementRef) {
      elementRef.style.color = 'red';
    }
  };

  return h('div', {
    ref: saveRef,
    class: 'my-component',
  }, '内容');
});
```

### 3. 条件渲染

```typescript
import { h, defineComponent, when } from '@/core';

export const ConditionalComponent = defineComponent<Props>((props) => {
  return h('div', {},
    // 使用 when 指令进行条件渲染
    when(props.visible,
      h('span', {}, '显示的内容')
    ),
    // 或者使用三元表达式
    props.isActive
      ? h('div', {}, '激活状态')
      : h('div', {}, '非激活状态')
  );
});
```

### 4. 列表渲染

```typescript
import { h, defineComponent, each } from '@/core';

export const ListComponent = defineComponent<Props>((props) => {
  return h('ul', {},
    // 使用 each 指令渲染列表
    each(props.items, (item, index) =>
      h('li', {
        key: index,
        class: item.active ? 'active' : '',
        onClick: () => props.onSelect?.(item),
      }, item.name)
    )
  );
});
```

### 5. 生命周期钩子

```typescript
import { h, defineComponent } from '@/core';
import type { ComponentLifecycle } from '@/types';

export const LifecycleComponent = defineComponent<Props>((props, lifecycle: ComponentLifecycle) => {
  // 挂载前
  lifecycle.onBeforeMount = () => {
    console.log('组件即将挂载');
  };

  // 挂载后
  lifecycle.onMounted = () => {
    console.log('组件已挂载');
    // 可以进行 DOM 操作或发起请求
  };

  // 销毁前
  lifecycle.onBeforeDestroy = () => {
    console.log('组件即将销毁');
    // 清理定时器、事件监听等
  };

  // 销毁后
  lifecycle.onDestroyed = () => {
    console.log('组件已销毁');
  };

  return h('div', {}, '组件内容');
});

### 6. 内部回调机制（组件间通信）

框架支持组件内部触发回调函数通知外部，这是通过 `lifecycle.emit` 和 `lifecycle.on` 实现的：

```typescript
import { h, defineComponent } from '@/core';
import type { ComponentLifecycle } from '@/types';

// 定义组件 Props，包含回调函数
interface MyComponentProps {
  title: string;
  onDataChange?: (data: { value: number; timestamp: number }) => void;
  onCustomEvent?: (message: string) => void;
}

export const MyComponent = defineComponent<MyComponentProps>((props, lifecycle: ComponentLifecycle) => {
  let count = 0;

  // 方式1: 在组件内部注册回调处理（可选）
  lifecycle.on?.('dataChange', (data) => {
    console.log('内部处理数据变化:', data);
  });

  const handleClick = () => {
    count++;
    const data = { value: count, timestamp: Date.now() };

    // 方式2: 触发回调，会自动调用 props 中传入的 onDataChange
    lifecycle.emit?.('dataChange', data);
  };

  const handleDoubleClick = () => {
    // 触发自定义事件
    lifecycle.emit?.('customEvent', `双击了 ${count} 次`);
  };

  return h('div', {
    class: 'my-component',
    onClick: handleClick,
    onDblclick: handleDoubleClick,
  },
    h('h3', {}, props.title),
    h('p', {}, `点击次数: ${count}`)
  );
});

// 使用组件时传入回调函数
const vnode = h(MyComponent, {
  title: '回调示例组件',
  onDataChange: (data) => {
    console.log('外部收到数据变化:', data);
  },
  onCustomEvent: (message) => {
    console.log('外部收到自定义事件:', message);
  },
});
```

**回调机制说明：**

1. **注册回调** (`lifecycle.on`)
   - 在组件内部注册回调处理函数
   - 用于组件内部逻辑处理

2. **触发回调** (`lifecycle.emit`)
   - 触发指定名称的事件
   - 自动查找并调用 `props` 中对应的 `onXxx` 回调
   - 同时也会调用通过 `lifecycle.on` 注册的回调

3. **命名约定**
   - 事件名: `dataChange`
   - Props 回调名: `onDataChange` (自动转换)

**实际应用示例 - 自定义按钮组件：**

```typescript
interface CustomButtonProps {
  label: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export const CustomButton = defineComponent<CustomButtonProps>((props, lifecycle) => {
  const handleClick = (e: MouseEvent) => {
    if (!props.disabled) {
      lifecycle.emit?.('click', e);
    }
  };

  const handleMouseEnter = () => {
    lifecycle.emit?.('hover', true);
  };

  const handleMouseLeave = () => {
    lifecycle.emit?.('hover', false);
  };

  const handleFocus = () => {
    lifecycle.emit?.('focusChange', true);
  };

  const handleBlur = () => {
    lifecycle.emit?.('focusChange', false);
  };

  return h('button', {
    class: `custom-btn ${props.disabled ? 'disabled' : ''}`,
    disabled: props.disabled,
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
  }, props.label);
});

// 使用
h(CustomButton, {
  label: '提交',
  onClick: (e) => console.log('按钮点击:', e),
  onHover: (isHovering) => console.log('悬停状态:', isHovering),
  onFocusChange: (isFocused) => console.log('焦点状态:', isFocused),
});
```

## 指令系统

### when - 条件渲染指令

```typescript
import { h, defineComponent, when } from '@/core';

export const ConditionalExample = defineComponent<Props>((props) => {
  return h('div', {},
    when(props.isLoading,
      h('div', { class: 'loading' }, '加载中...')
    ),
    when(!props.isLoading && props.data,
      h('div', { class: 'content' }, props.data)
    )
  );
});
```

### each - 列表渲染指令

```typescript
import { h, defineComponent, each } from '@/core';

interface Item {
  id: number;
  name: string;
}

export const ListExample = defineComponent<{ items: Item[] }>((props) => {
  return h('ul', { class: 'list' },
    each(props.items, (item, index) =>
      h('li', {
        key: item.id,
        class: 'list-item',
        'data-index': index,
      }, item.name)
    )
  );
});
```

### show - 显示/隐藏指令

```typescript
import { h, defineComponent, show } from '@/core';

export const ShowExample = defineComponent<Props>((props) => {
  return h('div', {},
    show(props.visible,
      h('div', { class: 'modal' }, '弹窗内容')
    )
  );
});
```

注意：`show` 与 `when` 的区别：
- `when`: 条件为 false 时不渲染元素
- `show`: 始终渲染，通过 CSS `display` 控制显示/隐藏

## 插件系统

Hili Player 提供完整的插件系统，支持状态管理、事件总线和钩子系统。

### 基础用法

```typescript
import { VideoPlayer, PluginManager } from 'hili-player';
import { StatsPlugin } from 'hili-player/plugins';

// 创建播放器
const player = new VideoPlayer({ src: 'video.mp4' });

// 创建插件管理器
const pluginManager = new PluginManager(player);

// 安装插件
pluginManager.install(new StatsPlugin());

// 获取插件实例
const stats = pluginManager.get<StatsPlugin>('stats');
console.log('播放次数:', stats?.getPlayCount());
```

### 状态管理

```typescript
// 获取状态管理器
const { state } = pluginManager;

// 设置状态
state.set('user.volume', 0.8);
state.set('user.muted', false);

// 获取状态
const volume = state.get<number>('user.volume');

// 订阅状态变化
const unsubscribe = state.subscribe('user.volume', (newVal, oldVal) => {
  console.log(`音量变化: ${oldVal} -> ${newVal}`);
});

// 取消订阅
unsubscribe();
```

### 事件总线

```typescript
// 获取事件总线
const { events } = pluginManager;

// 监听事件
const unsubscribe = events.on<{ time: number }>('custom:seek', (data) => {
  console.log('跳转时间:', data.time);
});

// 触发事件
events.emit('custom:seek', { time: 120 });

// 取消监听
unsubscribe();
```

### 钩子系统

```typescript
import { PlayerHooks } from 'hili-player';

// 获取钩子系统
const { hooks } = pluginManager;

// 注册钩子
hooks.register(PlayerHooks.BEFORE_PLAY, (context) => {
  console.log('准备播放');
  return context;
});

hooks.register(PlayerHooks.AFTER_SEEK, (context) => {
  console.log('跳转完成');
  return context;
});
```

### 预定义钩子

| 钩子名称 | 触发时机 |
|---------|---------|
| `PlayerHooks.BEFORE_PLAY` | 播放前 |
| `PlayerHooks.AFTER_PLAY` | 播放后 |
| `PlayerHooks.BEFORE_SEEK` | 跳转前 |
| `PlayerHooks.AFTER_SEEK` | 跳转后 |

### 编写自定义插件

```typescript
import type { Plugin } from 'hili-player';
import type { VideoPlayer } from 'hili-player';

export class MyPlugin implements Plugin {
  readonly name = 'myPlugin';
  readonly version = '1.0.0';
  
  private context: PluginContext | null = null;
  private unsubscribers: Array<() => void> = [];

  install(player: VideoPlayer, config?: Record<string, unknown>): void {
    // 获取插件上下文
    const pluginManager = (player as unknown as { 
      pluginManager?: { getContext: (name: string) => PluginContext } 
    }).pluginManager;
    
    if (!pluginManager) return;
    this.context = pluginManager.getContext(this.name);

    // 初始化状态
    this.context.state.set('myPlugin', {
      enabled: true,
      count: 0,
    });

    // 监听播放器事件
    const unsub = this.context.events.on('player:play', () => {
      this.context?.state.set('myPlugin.count', 
        (this.context.state.get<number>('myPlugin.count') ?? 0) + 1
      );
    });
    this.unsubscribers.push(unsub);

    // 注册钩子
    this.context.hooks.register(PlayerHooks.BEFORE_PLAY, (ctx) => {
      this.context?.log('即将播放');
      return ctx;
    });

    this.context.log('插件已安装');
  }

  uninstall(_player: VideoPlayer): void {
    // 清理监听器
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.context?.log('插件已卸载');
    this.context = null;
  }

  enable(): void {
    this.context?.state.set('myPlugin.enabled', true);
    this.context?.log('插件已启用');
  }

  disable(): void {
    this.context?.state.set('myPlugin.enabled', false);
    this.context?.log('插件已禁用');
  }
}
```

### 插件上下文

每个插件都可以通过上下文访问以下功能：

```typescript
interface PluginContext {
  player: VideoPlayer;      // 播放器实例
  state: StateManager;      // 状态管理器
  events: EventBus;         // 事件总线
  hooks: HookSystem;        // 钩子系统
  log: (msg: string) => void; // 日志工具
}
```

## 工具函数使用指南

### 浏览器能力检测器

用于检测浏览器对流媒体协议的支持情况，智能选择最佳播放方案。

```typescript
import { BrowserCapabilityDetector } from 'hili-player';

// 获取完整检测报告
const capability = BrowserCapabilityDetector.getFullCapabilityResult();
console.log('浏览器:', capability.browserName, capability.browserVersion);
console.log('操作系统:', capability.osName, capability.osVersion);
console.log('MSE支持:', capability.mseSupported);
console.log('DASH支持:', capability.dashSupported);
console.log('hls.js支持:', capability.hlsjsSupported);

// 打印详细报告到控制台
BrowserCapabilityDetector.printCapabilityReport();

// 根据检测结果选择播放协议
if (capability.isIOS) {
  // iOS 使用原生 HLS
  player.loadSource('https://example.com/video.m3u8');
} else if (capability.dashSupported) {
  // 桌面浏览器使用 DASH
  player.loadSource('https://example.com/video.mpd');
} else {
  // 降级到普通 MP4
  player.loadSource('https://example.com/video.mp4');
}

// 异步检测视频解码能力
(async () => {
  const h264 = await BrowserCapabilityDetector.checkDecodingCapability(
    'video/mp4; codecs="avc1.42E01E"'
  );
  console.log('H.264支持:', h264.supported, '流畅:', h264.smooth, '硬件加速:', h264.powerEfficient);

  const hevc = await BrowserCapabilityDetector.checkDecodingCapability(
    'video/mp4; codecs="hvc1.1.6.L93.90"'
  );
  console.log('HEVC支持:', hevc.supported);
})();
```

**检测能力一览：**

| 检测项 | 说明 |
|--------|------|
| `isSafari()` | 三层检测识别 Safari（Client Hints → 特性检测 → UA 嗅探） |
| `isIOS()` | 检测 iOS/iPadOS（包括伪装成 macOS 的 iPadOS 13+） |
| `isMSESupported()` | Media Source Extensions 支持检测 |
| `isDASHSupported()` | DASH 协议支持检测 |
| `isFlvjsSupported()` | flv.js 支持检测 |
| `getHardwareInfo()` | GPU 信息（WebGPU/WebGL/渲染器/供应商） |
| `checkDecodingCapability()` | 异步检测特定编码的解码能力 |

### RAF 定时器

使用 `requestAnimationFrame` 实现的高性能定时器，与浏览器渲染同步，避免丢帧。

```typescript
import { rafInterval, clearRafInterval, rafTimeout, cancelRaf } from 'hili-player';

// RAF 版 setInterval - 适用于动画
const timerId = rafInterval(() => {
  console.log('每 1000ms 执行一次');
}, 1000);

// 取消定时器
clearRafInterval(timerId);

// RAF 版 setTimeout
const raf = rafTimeout(() => {
  console.log('1000ms 后执行');
}, 1000);

// 取消
cancelRaf(raf);

// RAF 版 setInterval（间隔执行）
const intervalRaf = rafTimeout(() => {
  console.log('每 500ms 执行');
}, 500, true);
```

**适用场景：**
- 动画效果（进度条拖动、音量调节动画）
- 高频 UI 更新（弹幕移动、实时监控）
- 需要与浏览器渲染同步的操作

### DOM 操作工具

提供常用的 DOM 操作方法，遵循性能优先原则。

```typescript
import { 
  setStyles, toggleClasses, setAttr, setAttrs,
  batchUpdate, createBatchedUpdater, 
  getRect, isInViewport, removeElement, clearChildren 
} from 'hili-player';

// 批量设置样式（减少重排）
setStyles(element, { 
  width: '100px', 
  height: '50px', 
  opacity: '0.5' 
});

// 批量切换类名
toggleClasses(element, {
  'active': isActive,
  'hidden': !isVisible,
  'loading': isLoading
});

// 安全设置属性（null/undefined 自动移除属性）
setAttr(element, 'data-id', 123);
setAttr(element, 'disabled', null); // 移除 disabled

// 批量设置属性
setAttrs(element, {
  'data-id': 123,
  'aria-label': '播放按钮',
  'disabled': isDisabled || null
});

// RAF 批量更新 DOM
const cancel = batchUpdate(() => {
  element.style.width = `${newWidth}px`;
  element.style.height = `${newHeight}px`;
});

// 创建带防抖的批量更新器
const { update, cancel } = createBatchedUpdater();
update(() => setStyles(el, { left: '10px' }));
update(() => setStyles(el, { left: '20px' }));
update(() => setStyles(el, { left: '30px' })); // 只有这个执行

// 检查元素是否在视口内
if (isInViewport(element, 100)) { // 100px 阈值
  console.log('元素在视口内');
}

// 清空子节点（比 innerHTML = '' 更高效）
clearChildren(container);

// 安全移除元素
removeElement(element);
```

### 弹幕系统

高性能弹幕渲染系统，支持双引擎（DOM + Canvas）和分段渲染。

```typescript
import { DanmakuSystem, DanmakuType, RenderMode, DanmakuSpeed } from 'hili-player';

// 创建弹幕系统
const danmaku = new DanmakuSystem(container, {
  renderMode: RenderMode.AUTO,      // 自动选择渲染模式
  fontSize: 24,
  opacity: 0.8,
  speed: DanmakuSpeed.NORMAL,
  maxDanmakuCount: 1000,
});

// 添加单条弹幕
danmaku.add({
  id: '1',
  text: 'Hello World',
  time: 10,                         // 出现时间（秒）
  type: DanmakuType.SCROLL,         // 滚动弹幕
  color: '#ffffff',
  fontSize: 24,
});

// 批量添加弹幕
danmaku.addBatch([
  { id: '2', text: '弹幕1', time: 15, type: DanmakuType.SCROLL },
  { id: '3', text: '弹幕2', time: 20, type: DanmakuType.TOP },
  { id: '4', text: '弹幕3', time: 25, type: DanmakuType.BOTTOM },
]);

// 播放控制
danmaku.play();
danmaku.pause();
danmaku.seek(30);                   // 跳转到 30 秒

// 设置显示区域（0-1，1 为全屏）
danmaku.setArea(0.75);             // 显示在顶部 75% 区域

// 设置透明度
danmaku.setOpacity(0.6);

// 设置速度
danmaku.setSpeed(DanmakuSpeed.FAST);

// 显示/隐藏
danmaku.show();
danmaku.hide();

// 清空弹幕
danmaku.clear();

// 销毁
danmaku.destroy();
```

**弹幕类型：**

| 类型 | 说明 |
|------|------|
| `DanmakuType.SCROLL` | 滚动弹幕（从右到左） |
| `DanmakuType.TOP` | 顶部固定弹幕 |
| `DanmakuType.BOTTOM` | 底部固定弹幕 |
| `DanmakuType.COLOR` | 彩色弹幕 |

**渲染模式：**

| 模式 | 说明 |
|------|------|
| `RenderMode.DOM` | DOM 渲染（适合少量弹幕） |
| `RenderMode.CANVAS` | Canvas 渲染（适合大量弹幕） |
| `RenderMode.AUTO` | 自动选择（根据弹幕数量） |

### 字幕处理

支持 SRT、ASS/SSA、WebVTT 格式的字幕解析。

```typescript
import { 
  detectSubtitleFormat, parseSubtitle, 
  SubtitleFormat, type SubtitleItem 
} from 'hili-player';

// 自动检测字幕格式
const format = detectSubtitleFormat(subtitleContent);
console.log('字幕格式:', format); // 'srt' | 'ass' | 'vtt'

// 解析字幕
const subtitle: ParsedSubtitle = parseSubtitle(subtitleContent);
console.log('字幕项:', subtitle.items);
console.log('样式:', subtitle.styles);

// 查找当前时间对应的字幕
function findCurrentSubtitle(
  items: SubtitleItem[], 
  currentTime: number
): SubtitleItem | null {
  return items.find(
    item => currentTime >= item.start && currentTime <= item.end
  ) || null;
}

// 在播放器中使用
player.on('timeupdate', (currentTime) => {
  const current = findCurrentSubtitle(subtitle.items, currentTime);
  subtitleElement.textContent = current?.text || '';
});
```

### 媒体监控

实时监控播放器性能指标，支持生成图表和详细信息面板。

```typescript
import { 
  MediaPlayerMonitor, PlayerType,
  generateBitrateChart, generateBufferChart,
  createPlayerInfoPanel 
} from 'hili-player';

// 创建监控器
const monitor = new MediaPlayerMonitor(videoElement, {
  playerType: PlayerType.DASH,      // 或 HLS、FLV、NATIVE
  updateInterval: 1000,             // 更新间隔（ms）
  onStatsUpdate: (stats) => {
    console.log('码率:', stats.bitrate);
    console.log('缓冲区:', stats.bufferLength);
    console.log('帧率:', stats.frameRate);
  },
});

// 开始监控
monitor.start();

// 获取当前统计
const stats = monitor.getStats();

// 生成码率图表
const bitrateChart = generateBitrateChart(stats.bitrateHistory, {
  width: 600,
  height: 200,
  title: '码率变化',
});
container.appendChild(bitrateChart);

// 生成缓冲区图表
const bufferChart = generateBufferChart(stats.bufferHistory, {
  width: 600,
  height: 200,
});
container.appendChild(bufferChart);

// 创建信息面板
const panel = createPlayerInfoPanel(videoElement, {
  playerType: PlayerType.DASH,
  position: 'top-right',
  updateInterval: 500,
});

// 停止监控
monitor.stop();
```

**监控指标：**

| 指标 | 说明 |
|------|------|
| `bitrate` | 当前码率（bps） |
| `bufferLength` | 缓冲区长度（秒） |
| `frameRate` | 当前帧率（fps） |
| `droppedFrames` | 丢帧数 |
| `latency` | 播放延迟（ms） |
| `videoTrack` | 视频轨道信息 |
| `audioTrack` | 音频轨道信息 |

### SSR 兼容性工具

提供浏览器/服务端环境检测和安全操作封装。

```typescript
import { 
  isBrowser, isServer, 
  safeBrowserOperation, safeCreateElement,
  createSSRConfig 
} from 'hili-player';

// 环境检测
if (isBrowser()) {
  console.log('浏览器环境');
}

if (isServer()) {
  console.log('服务端环境');
}

// 安全执行浏览器操作
const element = safeBrowserOperation(() => {
  return document.getElementById('app');
});
// 服务端返回 undefined，浏览器返回元素

// 安全创建元素
const div = safeCreateElement('div');
// 服务端返回 null，浏览器返回 HTMLElement

// SSR 配置
const ssrConfig = createSSRConfig({
  enabled: true,
  placeholder: '<div class="loading">加载中...</div>',
});
```

## 架构说明

本项目基于设计文档中的**纯 h 函数架构**：

1. **虚拟节点 (VNode)** - 仅在挂载前用于描述 DOM 结构
2. **直接操作 DOM** - 挂载后通过 ref 直接操作真实 DOM
3. **零 Diff 开销** - 不进行虚拟 DOM 对比，性能最优
4. **生命周期** - 提供 onBeforeMount、onMounted、onBeforeDestroy、onDestroyed
5. **插件系统** - 完整的状态管理、事件总线、钩子系统支持扩展

## 许可证

MIT
