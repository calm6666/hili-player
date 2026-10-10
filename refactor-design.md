# 播放器重构详细设计文档

## 修改计划总览

### 涉及文件
1. `packages/player/src/player/VideoPlayer.ts` (769行)
2. `packages/player/src/components/PlayerDocker.ts` (356行)
3. `packages/player/src/components/Controls.ts` (853行)
4. `packages/player/src/components/Top.ts` (95行)
5. `packages/player/src/components/Loading.ts` (49行)
6. `packages/player/src/components/State.ts` (53行)
7. `packages/player/src/components/Toast.ts` (74行)

---

## 新增枚举定义文件

### 文件: `packages/player/src/core/events.ts`

#### 播放器事件枚举
```typescript
/**
 * 播放器事件枚举
 * 用于事件总线通信，防止事件名称拼写错误
 */
export enum PlayerEventEnum {
  // 播放状态相关事件
  /** 播放状态改变 */
  STATE_CHANGE = 'STATE_CHANGE',
  /** 开始播放 */
  PLAY = 'PLAY',
  /** 暂停播放 */
  PAUSE = 'PAUSE',
  /** 播放结束 */
  ENDED = 'ENDED',
  /** 播放时间更新 */
  TIME_UPDATE = 'TIME_UPDATE',
  /** 播放进度 */
  PROGRESS = 'PROGRESS',
  /** 等待缓冲 */
  WAITING = 'WAITING',
  /** 缓冲完成可以继续播放 */
  CAN_PLAY = 'CAN_PLAY',
  /** 可播放至结尾 */
  CAN_PLAY_THROUGH = 'CAN_PLAY_THROUGH',
  /** 加载中 */
  LOADING = 'LOADING',
  /** 加载完成 */
  LOADED = 'LOADED',

  // 视频属性相关事件
  /** 音量改变 */
  VOLUME_CHANGE = 'VOLUME_CHANGE',
  /** 静音状态改变 */
  MUTED_CHANGE = 'MUTED_CHANGE',
  /** 播放速度改变 */
  RATE_CHANGE = 'RATE_CHANGE',
  /** 画质改变 */
  QUALITY_CHANGE = 'QUALITY_CHANGE',
  /** 视频尺寸改变 */
  RESIZE = 'RESIZE',
  /** 时长改变 */
  DURATION_CHANGE = 'DURATION_CHANGE',

  // 全屏/画中画相关事件
  /** 全屏状态改变 */
  FULLSCREEN_CHANGE = 'FULLSCREEN_CHANGE',
  /** 画中画状态改变 */
  PIP_CHANGE = 'PIP_CHANGE',
  /** 网页全屏状态改变 */
  WEB_FULLSCREEN_CHANGE = 'WEB_FULLSCREEN_CHANGE',
  /** 宽屏模式改变 */
  WIDE_SCREEN_CHANGE = 'WIDE_SCREEN_CHANGE',

  // 错误相关事件
  /** 播放错误 */
  ERROR = 'ERROR',
  /** 错误恢复 */
  ERROR_RECOVERY = 'ERROR_RECOVERY',

  // 控制栏相关事件
  /** 控制栏显示 */
  CONTROLS_SHOW = 'CONTROLS_SHOW',
  /** 控制栏隐藏 */
  CONTROLS_HIDE = 'CONTROLS_HIDE',
  /** 进度条拖动开始 */
  SEEK_START = 'SEEK_START',
  /** 进度条拖动结束 */
  SEEK_END = 'SEEK_END',

  // 生命周期事件
  /** 播放器初始化完成 */
  READY = 'READY',
  /** 播放器销毁 */
  DESTROY = 'DESTROY',

  // 弹幕相关事件
  /** 弹幕显示状态改变 */
  DANMAKU_TOGGLE = 'DANMAKU_TOGGLE',
  /** 弹幕密度改变 */
  DANMAKU_DENSITY_CHANGE = 'DANMAKU_DENSITY_CHANGE',
  /** 弹幕透明度改变 */
  DANMAKU_OPACITY_CHANGE = 'DANMAKU_OPACITY_CHANGE',
  /** 弹幕速度改变 */
  DANMAKU_SPEED_CHANGE = 'DANMAKU_SPEED_CHANGE',

  // 字幕相关事件
  /** 字幕显示状态改变 */
  SUBTITLE_TOGGLE = 'SUBTITLE_TOGGLE',
  /** 字幕语言改变 */
  SUBTITLE_LANG_CHANGE = 'SUBTITLE_LANG_CHANGE',
}
```

#### 播放器方法枚举
```typescript
/**
 * 播放器方法枚举
 * 用于暴露给外部调用的方法名称，防止方法名拼写错误
 */
export enum PlayerMethodEnum {
  // 播放控制方法
  /** 播放视频 */
  PLAY = 'PLAY',
  /** 暂停视频 */
  PAUSE = 'PAUSE',
  /** 跳转指定时间 */
  SEEK = 'SEEK',
  /** 重新加载 */
  RELOAD = 'RELOAD',

  // 音量控制方法
  /** 设置音量 */
  SET_VOLUME = 'SET_VOLUME',
  /** 获取音量 */
  GET_VOLUME = 'GET_VOLUME',
  /** 设置静音 */
  SET_MUTED = 'SET_MUTED',
  /** 切换静音 */
  TOGGLE_MUTED = 'TOGGLE_MUTED',

  // 播放速度方法
  /** 设置播放速度 */
  SET_PLAYBACK_RATE = 'SET_PLAYBACK_RATE',
  /** 获取播放速度 */
  GET_PLAYBACK_RATE = 'GET_PLAYBACK_RATE',

  // 画质方法
  /** 设置画质 */
  SET_QUALITY = 'SET_QUALITY',
  /** 获取当前画质 */
  GET_QUALITY = 'GET_QUALITY',
  /** 获取可用画质列表 */
  GET_QUALITIES = 'GET_QUALITIES',

  // 全屏/画中画方法
  /** 进入全屏 */
  ENTER_FULLSCREEN = 'ENTER_FULLSCREEN',
  /** 退出全屏 */
  EXIT_FULLSCREEN = 'EXIT_FULLSCREEN',
  /** 切换全屏 */
  TOGGLE_FULLSCREEN = 'TOGGLE_FULLSCREEN',
  /** 进入画中画 */
  ENTER_PIP = 'ENTER_PIP',
  /** 退出画中画 */
  EXIT_PIP = 'EXIT_PIP',
  /** 切换画中画 */
  TOGGLE_PIP = 'TOGGLE_PIP',
  /** 进入网页全屏 */
  ENTER_WEB_FULLSCREEN = 'ENTER_WEB_FULLSCREEN',
  /** 退出网页全屏 */
  EXIT_WEB_FULLSCREEN = 'EXIT_WEB_FULLSCREEN',
  /** 切换网页全屏 */
  TOGGLE_WEB_FULLSCREEN = 'TOGGLE_WEB_FULLSCREEN',
  /** 切换宽屏 */
  TOGGLE_WIDE_SCREEN = 'TOGGLE_WIDE_SCREEN',

  // 状态获取方法
  /** 获取播放器状态 */
  GET_STATE = 'GET_STATE',
  /** 获取当前时间 */
  GET_CURRENT_TIME = 'GET_CURRENT_TIME',
  /** 获取总时长 */
  GET_DURATION = 'GET_DURATION',
  /** 获取缓冲进度 */
  GET_BUFFERED = 'GET_BUFFERED',

  // 弹幕方法
  /** 发送弹幕 */
  SEND_DANMAKU = 'SEND_DANMAKU',
  /** 显示/隐藏弹幕 */
  TOGGLE_DANMAKU = 'TOGGLE_DANMAKU',
  /** 设置弹幕不透明度 */
  SET_DANMAKU_OPACITY = 'SET_DANMAKU_OPACITY',
  /** 清除弹幕 */
  CLEAR_DANMAKU = 'CLEAR_DANMAKU',

  // 字幕方法
  /** 切换字幕显示 */
  TOGGLE_SUBTITLE = 'TOGGLE_SUBTITLE',
  /** 设置字幕语言 */
  SET_SUBTITLE_LANG = 'SET_SUBTITLE_LANG',

  // 播放器控制方法
  /** 销毁播放器 */
  DESTROY = 'DESTROY',
  /** 调整大小 */
  RESIZE = 'RESIZE',
}
```

#### 组件事件枚举
```typescript
/**
 * 组件内部事件枚举
 * 用于组件间通信的事件名称
 */
export enum ComponentEventEnum {
  // Controls组件事件
  /** 播放按钮点击 */
  PLAY_CLICK = 'PLAY_CLICK',
  /** 暂停按钮点击 */
  PAUSE_CLICK = 'PAUSE_CLICK',
  /** 进度条改变 */
  PROGRESS_CHANGE = 'PROGRESS_CHANGE',
  /** 音量改变 */
  VOLUME_CHANGE = 'VOLUME_CHANGE',
  /** 全屏按钮点击 */
  FULLSCREEN_CLICK = 'FULLSCREEN_CLICK',
  /** 画中画按钮点击 */
  PIP_CLICK = 'PIP_CLICK',
  /** 设置按钮点击 */
  SETTINGS_CLICK = 'SETTINGS_CLICK',
  /** 画质按钮点击 */
  QUALITY_CLICK = 'QUALITY_CLICK',
  /** 上一集按钮点击 */
  PREV_CLICK = 'PREV_CLICK',
  /** 下一集按钮点击 */
  NEXT_CLICK = 'NEXT_CLICK',

  // Top组件事件
  /** 返回按钮点击 */
  BACK_CLICK = 'BACK_CLICK',
  /** 更多按钮点击 */
  MORE_CLICK = 'MORE_CLICK',
  /** 标题点击 */
  TITLE_CLICK = 'TITLE_CLICK',

  // Loading组件事件
  /** 重试按钮点击 */
  RETRY_CLICK = 'RETRY_CLICK',

  // State组件事件
  /** 状态改变 */
  STATE_CHANGE = 'STATE_CHANGE',

  // Toast组件事件
  /** Toast关闭 */
  TOAST_CLOSE = 'TOAST_CLOSE',
  /** Toast跳转 */
  TOAST_JUMP = 'TOAST_JUMP',
}
```

#### 插件事件枚举
```typescript
/**
 * 插件事件枚举
 * 用于插件系统的事件通信
 */
export enum PluginEventEnum {
  // 插件生命周期事件
  /** 插件安装前 */
  BEFORE_INSTALL = 'BEFORE_INSTALL',
  /** 插件安装后 */
  AFTER_INSTALL = 'AFTER_INSTALL',
  /** 插件卸载前 */
  BEFORE_UNINSTALL = 'BEFORE_UNINSTALL',
  /** 插件卸载后 */
  AFTER_UNINSTALL = 'AFTER_UNINSTALL',
  /** 插件启用 */
  ENABLE = 'ENABLE',
  /** 插件禁用 */
  DISABLE = 'DISABLE',

  // 插件错误事件
  /** 插件错误 */
  ERROR = 'ERROR',
  /** 插件警告 */
  WARNING = 'WARNING',
}
```

#### 播放器配置枚举
```typescript
/**
 * 播放器配置枚举
 * 用于配置项的键名定义，防止拼写错误
 */
export enum PlayerConfigEnum {
  // 基础配置
  SRC = 'SRC',
  CONTAINER = 'CONTAINER',
  AUTOPLAY = 'AUTOPLAY',
  MUTED = 'MUTED',
  VOLUME = 'VOLUME',
  PLAYBACK_RATE = 'PLAYBACK_RATE',
  CONTROLS = 'CONTROLS',
  LOOP = 'LOOP',
  PRELOAD = 'PRELOAD',
  POSTER = 'POSTER',

  // 画质配置
  DEFAULT_QUALITY = 'DEFAULT_QUALITY',
  QUALITIES = 'QUALITIES',

  // 播放模式配置
  PLAY_MODE = 'PLAY_MODE',

  // 功能开关配置
  KEYBOARD = 'KEYBOARD',
  PIP = 'PIP',
  FULLSCREEN = 'FULLSCREEN',

  // 主题配置
  THEME_COLOR = 'THEME_COLOR',

  // 弹幕配置
  DANMAKU_ENABLED = 'DANMAKU_ENABLED',
  DANMAKU_SOURCE = 'DANMAKU_SOURCE',
  DANMAKU_OPACITY = 'DANMAKU_OPACITY',
  DANMAKU_SPEED = 'DANMAKU_SPEED',
  DANMAKU_VISIBLE = 'DANMAKU_VISIBLE',

  // 字幕配置
  SUBTITLES = 'SUBTITLES',

  // SSR配置
  SSR_ENABLED = 'SSR_ENABLED',
  SSR_DEFER_HYDRATION = 'SSR_DEFER_HYDRATION',

  // 插件配置
  PLUGINS = 'PLUGINS',
}
```

#### 播放器状态键枚举
```typescript
/**
 * 播放器状态键枚举
 * 用于状态管理器的路径定义
 */
export enum PlayerStateKeyEnum {
  // 播放状态
  STATE = 'STATE',
  CURRENT_TIME = 'CURRENT_TIME',
  DURATION = 'DURATION',
  BUFFERED = 'BUFFERED',

  // 音量状态
  VOLUME = 'VOLUME',
  MUTED = 'MUTED',

  // 播放属性
  PLAYBACK_RATE = 'PLAYBACK_RATE',
  QUALITY = 'QUALITY',

  // 显示状态
  IS_FULLSCREEN = 'IS_FULLSCREEN',
  IS_PIP = 'IS_PIP',
  IS_WEB_FULLSCREEN = 'IS_WEB_FULLSCREEN',
  IS_WIDE_SCREEN = 'IS_WIDE_SCREEN',

  // 视频属性
  VIDEO_WIDTH = 'VIDEO_WIDTH',
  VIDEO_HEIGHT = 'VIDEO_HEIGHT',
  ASPECT_RATIO = 'ASPECT_RATIO',

  // 错误状态
  ERROR_CODE = 'ERROR_CODE',
  ERROR_MESSAGE = 'ERROR_MESSAGE',

  // 加载状态
  IS_LOADING = 'IS_LOADING',
  LOAD_PROGRESS = 'LOAD_PROGRESS',

  // 控制栏状态
  CONTROLS_VISIBLE = 'CONTROLS_VISIBLE',
  CONTROLS_HOVER = 'CONTROLS_HOVER',

  // 弹幕状态
  DANMAKU_VISIBLE = 'DANMAKU_VISIBLE',
  DANMAKU_OPACITY = 'DANMAKU_OPACITY',
  DANMAKU_SPEED = 'DANMAKU_SPEED',
  DANMAKU_DENSITY = 'DANMAKU_DENSITY',

  // 字幕状态
  SUBTITLE_VISIBLE = 'SUBTITLE_VISIBLE',
  SUBTITLE_LANG = 'SUBTITLE_LANG',
}
```

---

## Store 枚举定义

### 文件: `packages/player/src/store/enums.ts`

在现有的 store 目录中添加枚举定义，用于状态键名和 localStorage 键名。

#### 持久化状态键枚举
```typescript
/**
 * 持久化状态键枚举
 * 定义需要保存到 localStorage 的状态键名
 */
export enum PersistentKeyEnum {
  // 播放器设置
  /** 音量 */
  VOLUME = 'nova_player_volume',
  /** 是否静音 */
  MUTED = 'nova_player_muted',
  /** 播放速度 */
  PLAYBACK_RATE = 'nova_player_playback_rate',
  /** 默认画质 */
  DEFAULT_QUALITY = 'nova_player_default_quality',
  /** 播放模式 */
  PLAY_MODE = 'nova_player_play_mode',

  // 弹幕设置
  /** 弹幕显示状态 */
  DANMAKU_VISIBLE = 'nova_player_danmaku_visible',
  /** 弹幕不透明度 */
  DANMAKU_OPACITY = 'nova_player_danmaku_opacity',
  /** 弹幕速度 */
  DANMAKU_SPEED = 'nova_player_danmaku_speed',
  /** 弹幕密度 */
  DANMAKU_DENSITY = 'nova_player_danmaku_density',
  /** 弹幕屏蔽设置 */
  DANMAKU_BLOCK = 'nova_player_danmaku_block',

  // 字幕设置
  /** 字幕显示状态 */
  SUBTITLE_VISIBLE = 'nova_player_subtitle_visible',
  /** 字幕语言 */
  SUBTITLE_LANG = 'nova_player_subtitle_lang',
  /** 字幕大小 */
  SUBTITLE_SIZE = 'nova_player_subtitle_size',
  /** 字幕颜色 */
  SUBTITLE_COLOR = 'nova_player_subtitle_color',

  // 播放器偏好
  /** 自动播放 */
  AUTO_PLAY = 'nova_player_auto_play',
  /** 自动全屏 */
  AUTO_FULLSCREEN = 'nova_player_auto_fullscreen',
  /** 跳过片头片尾 */
  SKIP_OP_ED = 'nova_player_skip_op_ed',
  /** 连续播放 */
  CONTINUOUS_PLAY = 'nova_player_continuous_play',

  // 视频播放历史
  /** 播放进度 */
  PLAY_PROGRESS = 'nova_player_play_progress',
  /** 观看历史 */
  WATCH_HISTORY = 'nova_player_watch_history',

  // 编解码器偏好
  /** 编解码器偏好版本 */
  CODEC_PREFER_VERSION = 'nova_player_codec_prefer_version',
  /** 编解码器偏好类型 */
  CODEC_PREFER_TYPE = 'nova_player_codec_prefer_type',

  // ABR 用户偏好
  /** 智能码率用户偏好 */
  SMART_ABR_PREFERENCE = 'nova_player_smart_abr_preference',

  // GPU 渲染器信息
  /** GPU 渲染器 */
  GPU_RENDERER = 'nova_player_gpu_renderer',

  // Dash 配置
  /** Dash Fawkes 配置 */
  DASH_FAWKES_CONFIG = 'nova_player_dash_fawkes_config',
}
```

#### 状态键枚举
```typescript
/**
 * 状态键枚举
 * 用于 Store 中的状态路径
 */
export enum StateKeyEnum {
  // 持久化状态键
  VOLUME = 'VOLUME',
  IS_MUTED = 'IS_MUTED',
  PLAYBACK_RATE = 'PLAYBACK_RATE',
  CODEC_PREFER_TYPE = 'CODEC_PREFER_TYPE',
  USER_PREFERENCES = 'USER_PREFERENCES',

  // 运行时状态键
  IS_PLAYING = 'IS_PLAYING',
  IS_PAUSED = 'IS_PAUSED',
  IS_LOADING = 'IS_LOADING',
  IS_ENDED = 'IS_ENDED',
  IS_WAITING = 'IS_WAITING',
  DURATION = 'DURATION',
  BUFFERED = 'BUFFERED',
  CURRENT_QUALITY = 'CURRENT_QUALITY',
  CURRENT_AUDIO_QUALITY = 'CURRENT_AUDIO_QUALITY',
  AVAILABLE_QUALITIES = 'AVAILABLE_QUALITIES',
  AVAILABLE_PLAYBACK_RATES = 'AVAILABLE_PLAYBACK_RATES',
  SCREEN_MODE = 'SCREEN_MODE',
  IS_PIP = 'IS_PIP',
}
```

---

## 修改原则

### 1. 保留所有注释
- **所有原有的详细注释都保留**，包括 JSDoc 注释和行内注释
- 只修改代码逻辑，不修改注释内容
- 分隔线注释（如 `// ============================================`）保留，但可以简化格式

### 2. 使用枚举替代字符串
- 事件名称使用 `PlayerEventEnum` 或 `ComponentEventEnum` 枚举
- 保持原有的事件触发逻辑不变

### 3. 删除重复代码
- 删除重复的私有属性（如同时有 `_state` 和 `state`）
- 删除未使用的方法
- 保留所有有用的方法和属性

---

## 一、VideoPlayer.ts 修改计划

### 1.1 添加枚举导入

#### 在第1行之前添加枚举导入
```typescript
// 新增导入：
import { PlayerEventEnum, PlayerMethodEnum } from '@/core/events';
```

### 1.2 修改内容

#### 第1-6行 - 简化文件头注释格式（保留内容）
```typescript
// 修改前：
/**
 * ============================================
 * 视频播放器核心类
 * ============================================
 * 实现播放器的所有核心功能和状态管理
 */
```
**改为：**
```typescript
/**
 * 视频播放器核心类
 * 实现播放器的所有核心功能和状态管理
 */
```

#### 第83-87行 - 使用枚举替代字符串事件名
```typescript
// 修改前：
      this.emitter.emit('statechange', state);
      this.events.emit('player:statechange', state);
```
**改为：**
```typescript
      // 使用枚举替代字符串，防止拼写错误
      this.emitter.emit(PlayerEventEnum.STATE_CHANGE, state);
      this.events.emit(PlayerEventEnum.STATE_CHANGE, state);
```

#### 第187-195行 - 删除重复的状态管理器创建
```typescript
// 删除：
    /**
     * 创建状态管理器
     * 使用 createStateManager 工厂函数创建
     */
    this.state = createStateManager({
      'player.state': PlayerStateEnum.IDLE,
      'player.currentTime': 0,
      'player.duration': 0,
      'player.volume': this.props.volume,
      'player.muted': this.props.muted,
      'player.playbackRate': this.props.playbackRate,
      'player.quality': this.props.defaultQuality,
      'player.buffered': null as TimeRanges | null,
      'player.isFullscreen': false,
      'player.isPip': false,
    });
```
**改为：** 删除整个代码块，状态直接从 video 元素读取

#### 第197-201行 - 简化构造函数注释（保留内容）
```typescript
// 修改前：
  /**
   * 构造函数
   * 初始化播放器配置和核心组件
   *
   * @param config - 播放器配置对象
   */
```
**改为：**
```typescript
  /**
   * 构造函数
   * 初始化播放器配置和核心组件
   */
```

#### 第250-254行 - 简化registerPlugins注释（保留内容）
```typescript
// 修改前：
  /**
   * 注册插件
   * 将插件注册到插件管理器中
   *
   * @param plugins - 插件数组
   */
```
**改为：**
```typescript
  /**
   * 注册插件
   * 将插件注册到插件管理器中
   */
```

#### 第265-269行 - 简化processSources注释（保留内容）
```typescript
// 修改前：
  /**
   * 处理视频源
   * 解析配置中的视频源，支持多种格式
   */
```
**改为：**
```typescript
  /**
   * 处理视频源
   * 解析配置中的视频源，支持多种格式
   */
```

#### 第282-288行 - 简化render注释（保留内容）
```typescript
// 修改前：
  /**
   * 渲染播放器
   * 创建虚拟 DOM 并挂载到容器
   *
   * @param container - 容器元素
   * @returns 播放器根元素
   */
```
**改为：**
```typescript
  /**
   * 渲染播放器
   * 创建虚拟 DOM 并挂载到容器
   */
```

#### 第351-355行 - 简化getCurrentSourceUrl注释（保留内容）
```typescript
// 修改前：
  /**
   * 获取当前视频源 URL
   *
   * @returns 当前视频源的 URL
   */
```
**改为：**
```typescript
  /**
   * 获取当前视频源 URL
   */
```

#### 第357-361行 - 简化getAvailableQualities注释（保留内容）
```typescript
// 修改前：
  /**
   * 获取可用画质列表
   *
   * @returns 可用画质数组
   */
```
**改为：**
```typescript
  /**
   * 获取可用画质列表
   */
```

#### 第373-377行 - 简化mount注释（保留内容）
```typescript
// 修改前：
  /**
   * 挂载播放器
   * 将播放器挂载到指定的 DOM 元素
   *
   * @param container - 容器元素
   */
```
**改为：**
```typescript
  /**
   * 挂载播放器
   * 将播放器挂载到指定的 DOM 元素
   */
```

#### 第404-417行 - 删除setVolumeState方法
```typescript
// 删除整个方法：
  /**
   * 设置音量状态
   *
   * @param volume - 音量值
   * @param muted - 是否静音
   */
  private setVolumeState(volume: number, muted: boolean): void {
    this.volume = clamp(volume, 0, 1);
    this.muted = muted;

    if (this.videoEl) {
      this.videoEl.volume = this.volume;
      this.videoEl.muted = this.muted;
    }
  }
```

#### 第419-422行 - 删除分隔线注释
```typescript
// 删除：
  // ============================================
  // 公共 API 方法
  // ============================================
```

#### 第424-438行 - 简化use注释（保留内容）
```typescript
// 修改前：
  /**
   * 使用插件（支持链式调用）
   *
   * @param plugin - 插件实例
   * @returns 当前播放器实例，支持链式调用
   *
   * @example
   * // 单个插件
   * player.use(DanmakuPlugin({ renderMode: RenderMode.DOM }))
   *
   * // 多个插件链式调用
   * player
   *   .use(DanmakuPlugin())
   *   .use(SubtitlePlugin())
   *   .use(StatsPlugin())
   */
```
**改为：**
```typescript
  /**
   * 使用插件（支持链式调用）
   */
```

#### 第450-454行 - 简化getPlugin注释（保留内容）
```typescript
// 修改前：
  /**
   * 获取插件实例
   *
   * @param name - 插件名称
   * @returns 插件实例，如果不存在则返回 undefined
   */
```
**改为：**
```typescript
  /**
   * 获取插件实例
   */
```

#### 第456-460行 - 简化uninstallPlugin注释（保留内容）
```typescript
// 修改前：
  /**
   * 卸载插件
   *
   * @param name - 插件名称
   */
```
**改为：**
```typescript
  /**
   * 卸载插件
   */
```

#### 第462-466行 - 简化play注释（保留内容）
```typescript
// 修改前：
  /**
   * 播放视频
   *
   * @returns Promise，播放成功时 resolve，失败时 reject
   */
```
**改为：**
```typescript
  /**
   * 播放视频
   */
```

#### 第478-482行 - 简化pause注释（保留内容）
```typescript
// 修改前：
  /**
   * 暂停播放
   */
```
**改为：**
```typescript
  /** 暂停播放 */
```

#### 第484-488行 - 简化toggle注释（保留内容）
```typescript
// 修改前：
  /**
   * 切换播放/暂停状态
   */
```
**改为：**
```typescript
  /** 切换播放/暂停状态 */
```

#### 第490-496行 - 简化seek注释（保留内容）
```typescript
// 修改前：
  /**
   * 跳转到指定时间
   *
   * @param time - 目标时间（秒）
   */
```
**改为：**
```typescript
  /**
   * 跳转到指定时间
   */
```

#### 第507-513行 - 简化setVolume注释（保留内容）
```typescript
// 修改前：
  /**
   * 设置音量
   *
   * @param volume - 音量值（0-1）
   */
```
**改为：**
```typescript
  /**
   * 设置音量
   */
```

#### 第515-519行 - 简化toggleMute注释（保留内容）
```typescript
// 修改前：
  /**
   * 切换静音状态
   */
```
**改为：**
```typescript
  /** 切换静音状态 */
```

#### 第521-527行 - 简化setPlaybackRate注释（保留内容）
```typescript
// 修改前：
  /**
   * 设置播放速度
   *
   * @param rate - 播放速度
   */
```
**改为：**
```typescript
  /** 设置播放速度 */
```

#### 第529-533行 - 简化toggleFullscreen注释（保留内容）
```typescript
// 修改前：
  /**
   * 切换全屏
   */
```
**改为：**
```typescript
  /** 切换全屏 */
```

#### 第535-539行 - 简化togglePip注释（保留内容）
```typescript
// 修改前：
  /**
   * 切换画中画
   */
```
**改为：**
```typescript
  /** 切换画中画 */
```

#### 第541-547行 - 简化setQuality注释（保留内容）
```typescript
// 修改前：
  /**
   * 切换画质
   *
   * @param quality - 目标画质
   */
```
**改为：**
```typescript
  /** 切换画质 */
```

#### 第549-591行 - 简化setQuality实现（保留注释，简化代码）
```typescript
// 修改前：
  setQuality(quality: QualityLevel): void {
    if (quality === this.quality) return;

    const wasPlaying = this._state === PlayerStateEnum.PLAYING;
    const currentTime = this.currentTime;

    this.quality = quality;

    /**
     * 找到对应画质的视频源
     */
    if (quality === QualityLevel.AUTO) {
      this.currentSourceIndex = 0;
    } else {
      const index = this.sources.findIndex(s => s.quality === quality);
      if (index !== -1) {
        this.currentSourceIndex = index;
      }
    }

    /**
     * 切换视频源
     */
    if (this.videoEl) {
      this.videoEl.src = this.getCurrentSourceUrl();
      this.videoEl.currentTime = currentTime;

      if (wasPlaying) {
        void this.play();
      }
    }

    this.emitter.emit('qualitychange', quality);
  }
```
**改为：**
```typescript
  setQuality(quality: QualityLevel): void {
    // 如果画质没有变化，直接返回
    if (quality === this.props.defaultQuality) return;
    
    // 保存当前画质设置
    this.props.defaultQuality = quality;
    
    // 找到对应画质的视频源
    if (quality === QualityLevel.AUTO) {
      this.currentSourceIndex = 0;
    } else {
      const index = this.sources.findIndex(s => s.quality === quality);
      if (index !== -1) {
        this.currentSourceIndex = index;
      }
    }

    // 切换视频源
    if (this.videoEl) {
      const currentTime = this.videoEl.currentTime;
      const wasPlaying = !this.videoEl.paused;
      this.videoEl.src = this.getCurrentSourceUrl();
      this.videoEl.currentTime = currentTime;
      if (wasPlaying) {
        void this.play();
      }
    }

    // 使用枚举替代字符串，防止拼写错误
    this.emitter.emit(PlayerEventEnum.QUALITY_CHANGE, quality);
  }
```

#### 第593-597行 - 简化reload注释（保留内容）
```typescript
// 修改前：
  /**
   * 重新加载视频
   */
```
**改为：**
```typescript
  /** 重新加载视频 */
```

#### 第599-603行 - 简化reload实现（保留注释）
```typescript
// 修改前：
  reload(): void {
    if (!this.videoEl) return;
    this.errorCode = 0;
    this.errorMessage = '';
    this.videoEl.load();
    this.setState(PlayerStateEnum.IDLE);
  }
```
**改为：**
```typescript
  reload(): void {
    if (!this.videoEl) return;
    this.videoEl.load();
  }
```

#### 第605-609行 - 简化destroy注释（保留内容）
```typescript
// 修改前：
  /**
   * 销毁播放器
   */
```
**改为：**
```typescript
  /** 销毁播放器 */
```

#### 第611-653行 - 简化destroy实现（保留关键注释）
```typescript
// 修改前：
  destroy(): void {
    /**
     * 暂停播放
     */
    this.pause();

    /**
     * 清理定时器
     */
    if (this.controlsHideTimer) {
      clearTimeout(this.controlsHideTimer);
    }

    /**
     * 销毁插件管理器
     */
    this.pluginManager?.destroy();
    this.pluginManager = null;

    /**
     * 移除事件监听
     */
    this.emitter.removeAllListeners();

    /**
     * 销毁虚拟节点
     */
    if (this.vnode) {
      destroy(this.vnode);
    }

    /**
     * 从 WeakMap 中移除
     * 虽然 WeakMap 会自动清理，但显式移除更明确
     */
    if (this.containerEl) {
      playerInstanceMap.delete(this.containerEl);
    }

    /**
     * 清理引用
     */
    this.videoEl = null;
    this.containerEl = null;
    this.vnode = null;
  }
```
**改为：**
```typescript
  destroy(): void {
    // 暂停播放
    this.pause();
    // 销毁插件管理器
    this.pluginManager?.destroy();
    this.pluginManager = null;
    // 移除事件监听
    this.emitter.removeAllListeners();
    // 销毁虚拟节点
    if (this.vnode) {
      destroy(this.vnode);
    }
    // 从 WeakMap 中移除
    if (this.containerEl) {
      playerInstanceMap.delete(this.containerEl);
    }
    // 清理引用
    this.videoEl = null;
    this.containerEl = null;
    this.vnode = null;
  }
```

#### 第655-661行 - 保留getState详细注释
```typescript
// 修改前：
  /**
   * 获取当前状态
   *
   * @returns 播放器状态数据
   */
```
**改为：**
```typescript
  /**
   * 获取当前播放器状态
   *
   * @returns 包含播放器当前状态数据的对象
   *   - state: 播放状态('playing' | 'paused' | 'ended' | 'loading' | 'error')
   *   - currentTime: 当前播放时间(秒)
   *   - duration: 视频总时长(秒)
   *   - volume: 当前音量(0-1)
   *   - muted: 是否静音
   *   - playbackRate: 播放速度
   *   - quality: 当前画质
   *   - isFullscreen: 是否全屏
   *   - isPip: 是否画中画
   *   - buffered: 缓冲区域
   *   - aspectRatio: 视频宽高比
   */
```

#### 第663-685行 - 保留getState实现详细注释
```typescript
// 修改前：
  getState(): PlayerStateData {
    return {
      state: this._state,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      muted: this.muted,
      playbackRate: this.playbackRate,
      quality: this.quality,
      isFullscreen: this.isFullscreen,
      isPip: this.isPip,
      buffered: this.buffered,
      aspectRatio: this.videoEl
        ? this.videoEl.videoWidth / this.videoEl.videoHeight
        : 16 / 9,
    };
  }
```
**改为：**
```typescript
  getState(): PlayerStateData {
    // 从video元素直接读取状态，避免重复存储
    return {
      // 播放状态：根据video.paused判断
      state: this.videoEl?.paused ? 'paused' : 'playing',
      // 当前播放时间
      currentTime: this.videoEl?.currentTime ?? 0,
      // 视频总时长
      duration: this.videoEl?.duration ?? 0,
      // 当前音量
      volume: this.videoEl?.volume ?? 1,
      // 是否静音
      muted: this.videoEl?.muted ?? false,
      // 播放速度
      playbackRate: this.videoEl?.playbackRate ?? 1,
      // 当前画质
      quality: this.props.defaultQuality,
      // 是否全屏
      isFullscreen: !!document.fullscreenElement,
      // 是否画中画
      isPip: document.pictureInPictureElement === this.videoEl,
      // 缓冲区域
      buffered: this.videoEl?.buffered ?? null,
      // 视频宽高比
      aspectRatio: this.videoEl
        ? this.videoEl.videoWidth / this.videoEl.videoHeight
        : 16 / 9,
    };
  }
```

#### 第687-693行 - 简化on注释（保留内容）
```typescript
// 修改前：
  /**
   * 注册事件监听
   *
   * @param event - 事件名
   * @param callback - 回调函数
   */
```
**改为：**
```typescript
  /** 注册事件监听 */
```

#### 第695-701行 - 简化off注释（保留内容）
```typescript
// 修改前：
  /**
   * 移除事件监听
   *
   * @param event - 事件名
   * @param callback - 回调函数
   */
```
**改为：**
```typescript
  /** 移除事件监听 */
```

#### 第703-706行 - 删除分隔线注释
```typescript
// 删除：
  // ============================================
  // 生命周期钩子
  // ============================================
```

#### 第708-712行 - 简化onBeforeMount注释（保留内容）
```typescript
// 修改前：
  /**
   * 挂载前钩子
   */
```
**改为：**
```typescript
  /** 挂载前钩子 */
```

#### 第714-718行 - 简化onMounted注释（保留内容）
```typescript
// 修改前：
  /**
   * 挂载完成钩子
   */
```
**改为：**
```typescript
  /** 挂载完成钩子 */
```

#### 第720-724行 - 简化onBeforeDestroy注释（保留内容）
```typescript
// 修改前：
  /**
   * 销毁前钩子
   */
```
**改为：**
```typescript
  /** 销毁前钩子 */
```

#### 第726-730行 - 简化onDestroyed注释（保留内容）
```typescript
// 修改前：
  /**
   * 销毁完成钩子
   */
```
**改为：**
```typescript
  /** 销毁完成钩子 */
```

---

## 二、PlayerDocker.ts 修改计划

### 2.1 添加枚举导入

#### 在第1行之前添加枚举导入
```typescript
// 新增导入：
import { PlayerEventEnum, ComponentEventEnum } from '@/core/events';
```

### 2.2 修改内容

#### 第1-9行 - 简化文件头注释格式（保留内容）
```typescript
// 修改前：
/**
 * ============================================
 * 播放器主容器组件 (PlayerDocker)
 * ============================================
 * 使用 h 函数实现，保持与既有实现完全相同的 DOM 结构和类名
 * 参考 player/src/player.ts 实现
 */
```
**改为：**
```typescript
/**
 * 播放器主容器组件
 * 参考 player/src/player.ts 实现
 */
```

#### 第11-13行 - 删除分隔线注释
```typescript
// 删除：
// ============================================
// 组件属性接口
// ============================================
```

#### 第15-35行 - 简化Props接口（保留字段注释）
```typescript
// 修改前：
export interface PlayerDockerProps {
  /** 视频源 URL */
  src?: string;
  /** 播放器名称 */
  playerName?: string;
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 默认音量 */
  volume?: number;
  /** 是否静音 */
  muted?: boolean;
  /** 播放器挂载完成回调 */
  onMounted?: (elements: {
    container: HTMLElement;
    videoArea: HTMLElement;
```
**改为：**
```typescript
export interface PlayerDockerProps {
  src?: string;
  playerName?: string;
  autoplay?: boolean;
  volume?: number;
  muted?: boolean;
  onMounted?: (elements: {
    container: HTMLElement;
    videoArea: HTMLElement;
```

#### 第37-39行 - 删除分隔线注释
```typescript
// 删除：
// ============================================
// 组件
// ============================================
```

#### 第41-46行 - 简化组件注释（保留内容）
```typescript
// 修改前：
/**
 * PlayerDocker 组件
 * 播放器主容器，包含视频区域、控制栏、弹幕层等
 */
```
**改为：**
```typescript
/**
 * 播放器主容器组件
 */
```

#### 第49-51行 - 删除分隔线注释
```typescript
// 删除：
// ============================================
// DOM 引用
// ============================================
```

#### 第53-89行 - 简化DOM引用注释
```typescript
// 修改前：
  // 播放器根元素
  const playerDockerRef = { current: null as HTMLDivElement | null };
  // 播放器容器
  const playerContainerRef = { current: null as HTMLDivElement | null };
  // 视频区域
  const playerVideoAreaRef = { current: null as HTMLDivElement | null };
  // 视频占位区
  const playerVideoPerchRef = { current: null as HTMLDivElement | null };
  // 视频包装器
  const playerVideoWrapRef = { current: null as HTMLDivElement | null };
  // 视频海报
  const playerVideoPosterRef = { current: null as HTMLDivElement | null };
  // 发送弹幕区域
  const playerSendingAreaRef = { current: null as HTMLDivElement | null };
```
**改为：**
```typescript
  const playerDockerRef = { current: null as HTMLDivElement | null };
  const playerContainerRef = { current: null as HTMLDivElement | null };
  const playerVideoAreaRef = { current: null as HTMLDivElement | null };
  const playerVideoPerchRef = { current: null as HTMLDivElement | null };
  const playerVideoWrapRef = { current: null as HTMLDivElement | null };
  const playerVideoPosterRef = { current: null as HTMLDivElement | null };
  const playerSendingAreaRef = { current: null as HTMLDivElement | null };
```

#### 第91-93行 - 删除分隔线注释
```typescript
// 删除：
// ============================================
// 状态数据
// ============================================
```

#### 第95-112行 - 简化状态数据注释
```typescript
// 修改前：
  // SSR 配置
  const ssrConfig = props.ssr ?? { enabled: false, deferHydration: false };
  // 视频信息
  const videoInfo = {
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: props.volume ?? 1,
    muted: props.muted ?? false,
    playbackRate: 1,
    isPlaying: false,
    isFullscreen: false,
    isWebFullscreen: false,
    isWideScreen: false,
    isPip: false,
  };
  // 播放器信息
  const playerInfo = {
    ...videoInfo,
    backrate: 1,
  };
```
**改为：**
```typescript
  const ssrConfig = props.ssr ?? { enabled: false, deferHydration: false };
  const videoInfo = {
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: props.volume ?? 1,
    muted: props.muted ?? false,
    playbackRate: 1,
    isPlaying: false,
    isFullscreen: false,
    isWebFullscreen: false,
    isWideScreen: false,
    isPip: false,
  };
  const playerInfo = {
    ...videoInfo,
    backrate: 1,
  };
```

#### 第114-116行 - 删除分隔线注释
```typescript
// 删除：
// ============================================
// 初始化函数
// ============================================
```

#### 第118-121行 - 简化initVideo注释（保留内容）
```typescript
// 修改前：
  /**
   * 初始化视频元素
   * 创建 video 元素并设置属性
   */
```
**改为：**
```typescript
  /**
   * 初始化视频元素
   */
```

#### 第147-149行 - 删除分隔线注释
```typescript
// 删除：
// ============================================
// 事件处理器
// ============================================
```

#### 第151-211行 - 简化事件处理器注释
```typescript
// 修改前：
  /**
   * 处理播放事件
   */
  const handlePlay = (): void => {
    videoInfo.isPlaying = true;
    lifecycle.emit('video:play');
  };

  /**
   * 处理暂停事件
   */
  const handlePause = (): void => {
    videoInfo.isPlaying = false;
    lifecycle.emit('video:pause');
  };

  /**
   * 处理时间更新
   */
  const handleTimeUpdate = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    videoInfo.currentTime = video.currentTime;
    lifecycle.emit('video:timeupdate', { currentTime: video.currentTime });
  };

  /**
   * 处理加载元数据
   */
  const handleLoadedMetadata = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    videoInfo.duration = video.duration;
    lifecycle.emit('video:loadedmetadata', { duration: video.duration });
  };

  /**
   * 处理进度
   */
  const handleProgress = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    if (video.buffered.length > 0) {
      videoInfo.buffered = video.buffered.end(video.buffered.length - 1);
    }
    lifecycle.emit('video:progress', { buffered: videoInfo.buffered });
  };

  /**
   * 处理音量改变
   */
  const handleVolumeChange = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    videoInfo.volume = video.volume;
    videoInfo.muted = video.muted;
    lifecycle.emit('video:volumechange', { volume: video.volume, muted: video.muted });
  };

  /**
   * 处理播放速度改变
   */
  const handleRateChange = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    videoInfo.playbackRate = video.playbackRate;
    lifecycle.emit('video:ratechange', { playbackRate: video.playbackRate });
  };

  /**
   * 处理全屏改变
   */
  const handleFullscreenChange = (): void => {
    videoInfo.isFullscreen = !!document.fullscreenElement;
    lifecycle.emit('video:fullscreenchange', { isFullscreen: videoInfo.isFullscreen });
  };

  /**
   * 处理画中画改变
   */
  const handlePipChange = (): void => {
    videoInfo.isPip = document.pictureInPictureElement !== null;
    lifecycle.emit('video:pipchange', { isPip: videoInfo.isPip });
  };
```
**改为：**
```typescript
  const handlePlay = (): void => {
    videoInfo.isPlaying = true;
    lifecycle.emit('video:play');
  };

  const handlePause = (): void => {
    videoInfo.isPlaying = false;
    lifecycle.emit('video:pause');
  };

  const handleTimeUpdate = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    videoInfo.currentTime = video.currentTime;
    lifecycle.emit('video:timeupdate', { currentTime: video.currentTime });
  };

  const handleLoadedMetadata = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    videoInfo.duration = video.duration;
    lifecycle.emit('video:loadedmetadata', { duration: video.duration });
  };

  const handleProgress = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    if (video.buffered.length > 0) {
      videoInfo.buffered = video.buffered.end(video.buffered.length - 1);
    }
    lifecycle.emit('video:progress', { buffered: videoInfo.buffered });
  };

  const handleVolumeChange = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    videoInfo.volume = video.volume;
    videoInfo.muted = video.muted;
    lifecycle.emit('video:volumechange', { volume: video.volume, muted: video.muted });
  };

  const handleRateChange = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    videoInfo.playbackRate = video.playbackRate;
    lifecycle.emit('video:ratechange', { playbackRate: video.playbackRate });
  };

  const handleFullscreenChange = (): void => {
    videoInfo.isFullscreen = !!document.fullscreenElement;
    lifecycle.emit('video:fullscreenchange', { isFullscreen: videoInfo.isFullscreen });
  };

  const handlePipChange = (): void => {
    videoInfo.isPip = document.pictureInPictureElement !== null;
    lifecycle.emit('video:pipchange', { isPip: videoInfo.isPip });
  };
```

#### 第220-222行 - 删除分隔线注释
```typescript
// 删除：
// ============================================
// 生命周期
// ============================================
```

#### 第224-227行 - 简化onMounted注释（保留内容）
```typescript
// 修改前：
  /**
   * 组件挂载完成
   * 初始化视频元素和事件监听
   */
```
**改为：**
```typescript
  /**
   * 组件挂载完成
   */
```

#### 第246-249行 - 简化onBeforeDestroy注释（保留内容）
```typescript
// 修改前：
  /**
   * 组件销毁前
   * 清理事件监听
   */
```
**改为：**
```typescript
  /**
   * 组件销毁前
   */
```

#### 第265-268行 - 删除分隔线注释
```typescript
// 删除：
// ============================================
// 渲染
// ============================================
```

#### 第270-273行 - 简化渲染注释（保留内容）
```typescript
// 修改前：
  /**
   * 渲染播放器容器
   * 保持与既有实现完全相同的 DOM 结构
   */
```
**改为：**
```typescript
  /**
   * 渲染播放器容器
   */
```

---

## 三、Controls.ts 修改计划

### 3.1 添加枚举导入

#### 在第1行之前添加枚举导入
```typescript
// 新增导入：
import { PlayerEventEnum, ComponentEventEnum } from '@/core/events';
```

### 3.2 修改内容

#### 第1-9行 - 简化文件头注释格式（保留内容）
```typescript
// 修改前：
/**
 * ============================================
 * 控制条组件 (Controls)
 * ============================================
 * 使用 h 函数框架实现的播放器控制条组件
 * 保持与老播放器完全相同的 DOM 结构和类名
 * 所有 DOM 引用通过 ref 回调获取，不使用 querySelector
 */
```
**改为：**
```typescript
/**
 * 控制条组件
 * 保持与既有实现完全相同的 DOM 结构和类名
 */
```

#### 第11-13行 - 删除空行
删除第11-13行的空行

#### 第15-21行 - 简化类型定义注释
```typescript
// 修改前：
/**
 * 菜单类型
 */
type MenuType = 'viewpoint' | 'quality' | 'eplist' | 'playbackrate' | 'volume' | 'setting';

/**
 * 菜单元素配置
 */
interface MenuElement {
  element: HTMLDivElement | null;
  extraElements?: HTMLDivElement[];
}

/**
 * 菜单配置映射
 */
interface MenuConfig {
  viewpoint?: MenuElement;
  quality?: MenuElement;
  eplist?: MenuElement;
```
**改为：**
```typescript
type MenuType = 'viewpoint' | 'quality' | 'eplist' | 'playbackrate' | 'volume' | 'setting';

interface MenuElement {
  element: HTMLDivElement | null;
  extraElements?: HTMLDivElement[];
}

interface MenuConfig {
  viewpoint?: MenuElement;
  quality?: MenuElement;
  eplist?: MenuElement;
```

---

## 四、Top.ts 修改计划

### 4.1 添加枚举导入

#### 在第1行之前添加枚举导入
```typescript
// 新增导入：
import { PlayerEventEnum, ComponentEventEnum } from '@/core/events';
```

### 4.2 修改内容

#### 第1-6行 - 简化文件头注释格式（保留内容）
```typescript
// 修改前：
/**
 * ============================================
 * 顶部栏组件
 * ============================================
 * 使用 h 函数实现的顶部栏组件
 */
```
**改为：**
```typescript
/**
 * 顶部栏组件
 */
```

---

## 五、Loading.ts 修改计划

### 5.1 添加枚举导入

#### 在第1行之前添加枚举导入
```typescript
// 新增导入：
import { PlayerEventEnum, ComponentEventEnum } from '@/core/events';
```

### 5.2 修改内容

#### 第1-6行 - 简化文件头注释格式（保留内容）
```typescript
// 修改前：
/**
 * ============================================
 * 加载组件
 * ============================================
 * 使用 h 函数实现的加载组件
 */
```
**改为：**
```typescript
/**
 * 加载组件
 */
```

---

## 六、State.ts 修改计划

### 6.1 添加枚举导入

#### 在第1行之前添加枚举导入
```typescript
// 新增导入：
import { PlayerEventEnum, ComponentEventEnum } from '@/core/events';
```

### 6.2 修改内容

#### 第1-6行 - 简化文件头注释格式（保留内容）
```typescript
// 修改前：
/**
 * ============================================
 * 播放器状态组件
 * ============================================
 * 使用 h 函数实现的状态显示组件
 */
```
**改为：**
```typescript
/**
 * 播放器状态组件
 */
```

---

## 七、Toast.ts 修改计划

### 7.1 添加枚举导入

#### 在第1行之前添加枚举导入
```typescript
// 新增导入：
import { PlayerEventEnum, ComponentEventEnum } from '@/core/events';
```

### 7.2 修改内容

#### 第1-6行 - 简化文件头注释格式（保留内容）
```typescript
// 修改前：
/**
 * ============================================
 * Toast 提示组件
 * ============================================
 * 使用 h 函数实现的 Toast 提示组件
 */
```
**改为：**
```typescript
/**
 * Toast 提示组件
 */
```

---

## 九、插件系统设计

### 9.1 插件类型枚举

#### 文件: `packages/player/src/plugins/enums.ts`

```typescript
/**
 * 插件类型枚举
 * 定义支持的流媒体插件类型
 */
export enum StreamPluginTypeEnum {
  /** FLV 格式插件 */
  FLV = 'FLV',
  /** HLS 格式插件 */
  HLS = 'HLS',
  /** DASH 格式插件 */
  DASH = 'DASH',
  /** 原生视频插件 */
  NATIVE = 'NATIVE',
  /** 未知类型 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 流媒体格式枚举
 */
export enum StreamFormatEnum {
  /** FLV 格式 */
  FLV = 'FLV',
  /** HLS 格式 */
  HLS = 'HLS',
  /** DASH 格式 */
  DASH = 'DASH',
  /** MP4 格式 */
  MP4 = 'MP4',
  /** WebM 格式 */
  WEBM = 'WEBM',
  /** OGG 格式 */
  OGG = 'OGG',
  /** M3U8 格式 */
  M3U8 = 'M3U8',
  /** MPD 格式 */
  MPD = 'MPD',
  /** 未知格式 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 流媒体协议枚举
 */
export enum StreamingProtocolEnum {
  /** DASH 协议 */
  DASH = 'DASH',
  /** HLS 协议 */
  HLS = 'HLS',
  /** FLV 协议 */
  FLV = 'FLV',
  /** MP4 原生 */
  MP4 = 'MP4',
  /** WebM 原生 */
  WEBM = 'WebM',
  /** 未知协议 */
  UNKNOWN = 'Unknown',
}

/**
 * 插件事件枚举
 * 流媒体插件相关事件
 */
export enum StreamPluginEventEnum {
  // 加载事件
  /** 开始加载 */
  LOAD_START = 'LOAD_START',
  /** 加载完成 */
  LOAD_COMPLETE = 'LOAD_COMPLETE',
  /** 加载错误 */
  LOAD_ERROR = 'LOAD_ERROR',

  // 缓冲事件
  /** 缓冲开始 */
  BUFFER_START = 'BUFFER_START',
  /** 缓冲结束 */
  BUFFER_END = 'BUFFER_END',
  /** 缓冲进度更新 */
  BUFFER_PROGRESS = 'BUFFER_PROGRESS',

  // 播放事件
  /** 播放开始 */
  PLAY_START = 'PLAY_START',
  /** 播放暂停 */
  PLAY_PAUSE = 'PLAY_PAUSE',
  /** 播放结束 */
  PLAY_END = 'PLAY_END',
  /** 播放错误 */
  PLAY_ERROR = 'PLAY_ERROR',

  // 质量事件
  /** 清晰度切换 */
  QUALITY_SWITCH = 'QUALITY_SWITCH',
  /** 清晰度切换完成 */
  QUALITY_SWITCH_COMPLETE = 'QUALITY_SWITCH_COMPLETE',
  /** 自适应码率切换 */
  ABR_SWITCH = 'ABR_SWITCH',

  // 统计事件
  /** 统计数据更新 */
  STATS_UPDATE = 'STATS_UPDATE',
}

/**
 * 缓冲状态枚举
 */
export enum BufferStatusEnum {
  /** 空闲 */
  IDLE = 'IDLE',
  /** 缓冲中 */
  BUFFERING = 'BUFFERING',
  /** 已缓冲足够数据 */
  ENOUGH = 'ENOUGH',
  /** 缓冲错误 */
  ERROR = 'ERROR',
}

/**
 * 播放器状态枚举
 */
export enum PlayerStateEnum {
  /** 空闲 */
  IDLE = 'IDLE',
  /** 加载中 */
  LOADING = 'LOADING',
  /** 播放中 */
  PLAYING = 'PLAYING',
  /** 暂停 */
  PAUSED = 'PAUSED',
  /** 缓冲中 */
  BUFFERING = 'BUFFERING',
  /** 已结束 */
  ENDED = 'ENDED',
  /** 错误 */
  ERROR = 'ERROR',
}
```

### 9.2 流媒体插件接口

#### 文件: `packages/player/src/plugins/types.ts`

```typescript
import type { Plugin } from '@/core/plugin';
import type { VideoPlayer } from '@/player';

/**
 * 缓冲信息接口
 * 提供详细的缓冲状态信息
 */
export interface BufferInfo {
  /** 缓冲状态 */
  status: BufferStatusEnum;
  /** 当前缓冲起始时间 */
  bufferStart: number;
  /** 当前缓冲结束时间 */
  bufferEnd: number;
  /** 缓冲长度（秒） */
  bufferLength: number;
  /** 缓冲百分比（0-100） */
  bufferPercent: number;
  /** 已下载字节数 */
  downloadedBytes: number;
  /** 总字节数（如果已知） */
  totalBytes: number | null;
  /** 当前下载速度（bytes/s） */
  downloadSpeed: number;
  /** 预估剩余缓冲时间（秒） */
  estimatedTime: number;
}

/**
 * 流媒体统计信息接口
 */
export interface StreamStats {
  /** 当前播放时间 */
  currentTime: number;
  /** 总时长 */
  duration: number;
  /** 当前清晰度 */
  currentQuality: string;
  /** 当前码率（bps） */
  currentBitrate: number;
  /** 平均下载速度（bytes/s） */
  avgDownloadSpeed: number;
  /** 丢帧率（0-1） */
  dropFrameRatio: number;
  /** 解码帧率 */
  decodeFPS: number;
  /** 渲染帧率 */
  renderFPS: number;
  /** 首帧时间（ms） */
  firstFrameTime: number;
  /** 卡顿次数 */
  stallCount: number;
  /** 总卡顿时长（ms） */
  totalStallTime: number;
}

/**
 * 清晰度信息接口
 */
export interface QualityLevel {
  /** 清晰度 ID */
  id: string;
  /** 清晰度名称 */
  name: string;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 码率（bps） */
  bitrate: number;
  /** 编码格式 */
  codec: string;
  /** 帧率 */
  frameRate: number;
}

/**
 * 流媒体配置接口
 */
export interface StreamConfig {
  /** 视频源 URL */
  url: string;
  /** 视频格式 */
  format: StreamFormatEnum;
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 起始播放时间 */
  startTime?: number;
  /** 是否启用自适应码率 */
  enableABR?: boolean;
  /** 默认清晰度 */
  defaultQuality?: string;
  /** 最大清晰度 */
  maxQuality?: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
}

/**
 * 流媒体插件接口
 * 所有流媒体插件（flv.js、hls.js、dash.js）必须实现此接口
 */
export interface StreamPlugin extends Plugin {
  /** 插件类型 */
  readonly type: StreamPluginTypeEnum;

  /**
   * 检查浏览器是否支持此格式
   * @returns 是否支持
   */
  isSupported(): boolean;

  /**
   * 获取支持性详情
   * @returns 支持性详情
   */
  getSupportDetail(): { supported: boolean; detail: string };

  /**
   * 加载视频源
   * @param config - 流媒体配置
   */
  load(config: StreamConfig): void;

  /**
   * 卸载当前视频源
   */
  unload(): void;

  /**
   * 播放
   */
  play(): void;

  /**
   * 暂停
   */
  pause(): void;

  /**
   * 跳转到指定时间
   * @param time - 时间（秒）
   */
  seek(time: number): void;

  /**
   * 获取缓冲信息
   * @returns 缓冲信息
   */
  getBufferInfo(): BufferInfo;

  /**
   * 获取统计信息
   * @returns 统计信息
   */
  getStats(): StreamStats;

  /**
   * 获取可用清晰度列表
   * @returns 清晰度列表
   */
  getQualities(): QualityLevel[];

  /**
   * 切换清晰度
   * @param qualityId - 清晰度 ID
   */
  switchQuality(qualityId: string): void;

  /**
   * 设置音量
   * @param volume - 音量（0-1）
   */
  setVolume(volume: number): void;

  /**
   * 设置静音
   * @param muted - 是否静音
   */
  setMuted(muted: boolean): void;

  /**
   * 设置播放速度
   * @param rate - 播放速度
   */
  setPlaybackRate(rate: number): void;

  /**
   * 销毁插件
   */
  destroy(): void;
}

/**
 * 流媒体插件构造函数
 */
export type StreamPluginConstructor = new (
  videoElement: HTMLVideoElement,
  eventBus: EventBus
) => StreamPlugin;
```

### 9.3 FLV 插件设计

#### 文件: `packages/player/src/plugins/flv/FlvPlugin.ts`

```typescript
import type { StreamPlugin, StreamConfig, BufferInfo, StreamStats, QualityLevel } from '../types';
import { StreamPluginTypeEnum, StreamFormatEnum, BufferStatusEnum } from '../enums';
import { BrowserCapabilityDetector } from '@/utils/browserCapabilityDetector';
import type { EventBus } from '@/core/plugin';
import type { VideoPlayer } from '@/player';

/**
 * FLV 播放器实例接口（flv.js）
 */
interface FlvJsPlayer {
  attachMediaElement(video: HTMLVideoElement): void;
  load(): void;
  play(): void;
  pause(): void;
  unload(): void;
  destroy(): void;
  seek(seconds: number): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  /** 当前缓冲范围 */
  buffered: TimeRanges | null;
  /** 当前播放时间 */
  currentTime: number;
  /** 媒体信息 */
  mediaInfo?: {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    videoCodec?: string;
    audioCodec?: string;
  };
  /** 统计信息 */
  statisticsInfo?: {
    speed?: number;
    loaderType?: string;
    currentSegmentIndex?: number;
    totalSegmentCount?: number;
  };
  /** 是否暂停 */
  paused: boolean;
  /** 是否结束 */
  ended: boolean;
}

/**
 * FLV.js 配置接口
 */
interface FlvJsConfig {
  /** 是否启用缓存 */
  enableStashBuffer?: boolean;
  /** 缓存大小上限（KB） */
  stashInitialSize?: number;
  /** 是否自动清理缓存 */
  isLive?: boolean;
  /** 是否启用懒加载 */
  lazyLoad?: boolean;
  /** 懒加载恢复时长（秒） */
  lazyLoadMaxDuration?: number;
  /** 是否启用自动播放 */
  autoplay?: boolean;
  /** 是否循环播放 */
  loop?: boolean;
  /** 是否使用 MSE 硬解码 */
  enableWorker?: boolean;
  /** 是否开启无 referrer */
  enableCharsetRequest?: boolean;
}

/**
 * FLV 插件
 * 基于 flv.js 的 FLV 格式播放器插件
 */
export class FlvPlugin implements StreamPlugin {
  readonly name = 'flv';
  readonly version = '1.0.0';
  readonly description = 'FLV format streaming player based on flv.js';
  readonly type = StreamPluginTypeEnum.FLV;

  /** flv.js 播放器实例 */
  private flvPlayer: FlvJsPlayer | null = null;
  /** 视频元素 */
  private videoElement: HTMLVideoElement | null = null;
  /** 事件总线 */
  private eventBus: EventBus | null = null;
  /** 当前配置 */
  private config: StreamConfig | null = null;
  /** 是否已加载 */
  private isLoaded = false;
  /** 缓冲状态 */
  private bufferStatus = BufferStatusEnum.IDLE;
  /** 统计信息 */
  private stats: Partial<StreamStats> = {};
  /** 卡顿计数 */
  private stallCount = 0;
  /** 上次卡顿时间 */
  private lastStallTime = 0;

  /**
   * 检查浏览器是否支持 FLV 播放
   * 使用 BrowserCapabilityDetector 检测 MSE 支持
   */
  isSupported(): boolean {
    return BrowserCapabilityDetector.isFlvjsSupported();
  }

  /**
   * 获取 FLV 支持性详情
   */
  getSupportDetail(): { supported: boolean; detail: string } {
    const supported = this.isSupported();
    const browserInfo = BrowserCapabilityDetector.getBrowserInfo();
    const osInfo = BrowserCapabilityDetector.getOSInfo();

    if (!supported) {
      if (BrowserCapabilityDetector.isIOS()) {
        return {
          supported: false,
          detail: `iOS 系统 (${osInfo.name} ${osInfo.version}) 不支持 MSE，无法播放 FLV 格式`,
        };
      }
      return {
        supported: false,
        detail: `当前浏览器 ${browserInfo.name} ${browserInfo.version} 不支持 MSE，无法播放 FLV 格式`,
      };
    }

    return {
      supported: true,
      detail: `浏览器 ${browserInfo.name} ${browserInfo.version} 支持 MSE，可以播放 FLV 格式`,
    };
  }

  /**
   * 安装插件
   */
  install(player: VideoPlayer): void {
    // 插件安装时初始化
    console.log('[FlvPlugin] 插件已安装');
  }

  /**
   * 卸载插件
   */
  uninstall(player: VideoPlayer): void {
    this.destroy();
    console.log('[FlvPlugin] 插件已卸载');
  }

  /**
   * 加载视频源
   */
  load(config: StreamConfig): void {
    if (!this.isSupported()) {
      const detail = this.getSupportDetail();
      console.error('[FlvPlugin]', detail.detail);
      this.eventBus?.emit('stream:error', { message: detail.detail });
      return;
    }

    this.config = config;

    // 动态导入 flv.js
    import('flv.js').then((flvjs) => {
      if (!flvjs.isSupported()) {
        const msg = 'flv.js 检测到浏览器不支持';
        console.error('[FlvPlugin]', msg);
        this.eventBus?.emit('stream:error', { message: msg });
        return;
      }

      if (!this.videoElement) {
        const msg = '视频元素未设置';
        console.error('[FlvPlugin]', msg);
        this.eventBus?.emit('stream:error', { message: msg });
        return;
      }

      // 创建 flv.js 播放器
      this.flvPlayer = flvjs.createPlayer(
        {
          type: 'flv',
          url: config.url,
          isLive: config.format === StreamFormatEnum.FLV,
        },
        {
          enableStashBuffer: true,
          stashInitialSize: 128,
          lazyLoad: true,
          lazyLoadMaxDuration: 3 * 60,
          enableWorker: true,
          ...config,
        }
      );

      // 绑定事件
      this.bindEvents();

      // 附加到视频元素
      this.flvPlayer.attachMediaElement(this.videoElement);
      this.flvPlayer.load();

      this.isLoaded = true;
      this.eventBus?.emit('stream:loadcomplete', { url: config.url });

      // 自动播放
      if (config.autoplay) {
        this.play();
      }

      // 设置起始时间
      if (config.startTime && config.startTime > 0) {
        this.seek(config.startTime);
      }
    });
  }

  /**
   * 绑定 flv.js 事件
   */
  private bindEvents(): void {
    if (!this.flvPlayer) return;

    // 错误事件
    this.flvPlayer.on('error', (errorType: string, errorDetail: string) => {
      console.error('[FlvPlugin] Error:', errorType, errorDetail);
      this.eventBus?.emit('stream:error', { type: errorType, detail: errorDetail });
    });

    // 加载完成
    this.flvPlayer.on('loadedmetadata', () => {
      this.eventBus?.emit('stream:metadata', this.flvPlayer?.mediaInfo);
    });

    // 缓冲开始
    this.flvPlayer.on('waiting', () => {
      this.bufferStatus = BufferStatusEnum.BUFFERING;
      this.lastStallTime = Date.now();
      this.eventBus?.emit('stream:bufferstart', {});
    });

    // 缓冲结束/可以播放
    this.flvPlayer.on('canplay', () => {
      if (this.bufferStatus === BufferStatusEnum.BUFFERING) {
        const stallDuration = Date.now() - this.lastStallTime;
        this.stallCount++;
        this.stats.totalStallTime = (this.stats.totalStallTime || 0) + stallDuration;
      }
      this.bufferStatus = BufferStatusEnum.ENOUGH;
      this.eventBus?.emit('stream:bufferend', {});
    });

    // 进度更新
    this.flvPlayer.on('progress', () => {
      const bufferInfo = this.getBufferInfo();
      this.eventBus?.emit('stream:bufferprogress', bufferInfo);
    });

    // 播放统计
    this.flvPlayer.on('statistics_info', (stats: Record<string, unknown>) => {
      this.stats = { ...this.stats, ...stats };
      this.eventBus?.emit('stream:statsupdate', this.getStats());
    });
  }

  /**
   * 卸载视频源
   */
  unload(): void {
    if (this.flvPlayer) {
      this.flvPlayer.pause();
      this.flvPlayer.unload();
      this.flvPlayer.detachMediaElement?.();
      this.flvPlayer.destroy();
      this.flvPlayer = null;
    }
    this.isLoaded = false;
    this.bufferStatus = BufferStatusEnum.IDLE;
  }

  /**
   * 播放
   */
  play(): void {
    if (this.flvPlayer) {
      this.flvPlayer.play();
      this.eventBus?.emit('stream:playstart', {});
    }
  }

  /**
   * 暂停
   */
  pause(): void {
    if (this.flvPlayer) {
      this.flvPlayer.pause();
      this.eventBus?.emit('stream:playpause', {});
    }
  }

  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    if (this.flvPlayer) {
      this.flvPlayer.seek(time);
    }
  }

  /**
   * 获取缓冲信息
   */
  getBufferInfo(): BufferInfo {
    if (!this.flvPlayer || !this.videoElement) {
      return {
        status: BufferStatusEnum.IDLE,
        bufferStart: 0,
        bufferEnd: 0,
        bufferLength: 0,
        bufferPercent: 0,
        downloadedBytes: 0,
        totalBytes: null,
        downloadSpeed: 0,
        estimatedTime: 0,
      };
    }

    const video = this.videoElement;
    const buffered = video.buffered;
    const duration = video.duration || 0;
    const currentTime = video.currentTime || 0;

    let bufferStart = 0;
    let bufferEnd = 0;

    // 找到包含当前时间的缓冲区间
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && buffered.end(i) >= currentTime) {
        bufferStart = buffered.start(i);
        bufferEnd = buffered.end(i);
        break;
      }
    }

    const bufferLength = bufferEnd - currentTime;
    const bufferPercent = duration > 0 ? (bufferEnd / duration) * 100 : 0;

    // 获取下载速度
    const stats = this.flvPlayer.statisticsInfo;
    const downloadSpeed = stats?.speed || 0;

    // 预估剩余缓冲时间
    const estimatedTime = downloadSpeed > 0 && bufferLength > 0
      ? (duration - bufferEnd) / (downloadSpeed / bufferLength)
      : 0;

    return {
      status: this.bufferStatus,
      bufferStart,
      bufferEnd,
      bufferLength,
      bufferPercent,
      downloadedBytes: 0, // flv.js 不直接提供
      totalBytes: null,
      downloadSpeed,
      estimatedTime,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): StreamStats {
    const video = this.videoElement;
    const mediaInfo = this.flvPlayer?.mediaInfo;
    const flvStats = this.flvPlayer?.statisticsInfo;

    return {
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      currentQuality: `${mediaInfo?.width || 0}x${mediaInfo?.height || 0}`,
      currentBitrate: 0, // flv.js 不提供实时码率
      avgDownloadSpeed: flvStats?.speed || 0,
      dropFrameRatio: 0, // flv.js 不提供
      decodeFPS: mediaInfo?.fps || 0,
      renderFPS: 0, // 需要通过其他方式计算
      firstFrameTime: 0, // 需要自行统计
      stallCount: this.stallCount,
      totalStallTime: this.stats.totalStallTime || 0,
    };
  }

  /**
   * 获取可用清晰度列表
   * FLV 通常只有一个清晰度
   */
  getQualities(): QualityLevel[] {
    const mediaInfo = this.flvPlayer?.mediaInfo;
    if (!mediaInfo) return [];

    return [
      {
        id: 'default',
        name: '默认',
        width: mediaInfo.width || 0,
        height: mediaInfo.height || 0,
        bitrate: 0,
        codec: mediaInfo.videoCodec || 'unknown',
        frameRate: mediaInfo.fps || 0,
      },
    ];
  }

  /**
   * 切换清晰度
   * FLV 不支持动态切换清晰度，需要重新加载
   */
  switchQuality(_qualityId: string): void {
    console.warn('[FlvPlugin] FLV 格式不支持动态切换清晰度');
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = volume;
    }
  }

  /**
   * 设置静音
   */
  setMuted(muted: boolean): void {
    if (this.videoElement) {
      this.videoElement.muted = muted;
    }
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate: number): void {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate;
    }
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    this.unload();
    this.videoElement = null;
    this.eventBus = null;
  }
}

/**
 * 创建 FLV 插件工厂函数
 */
export function createFlvPlugin(
  videoElement: HTMLVideoElement,
  eventBus: EventBus
): FlvPlugin {
  const plugin = new FlvPlugin();
  (plugin as unknown as { videoElement: HTMLVideoElement }).videoElement = videoElement;
  (plugin as unknown as { eventBus: EventBus }).eventBus = eventBus;
  return plugin;
}
```

### 9.4 HLS 插件设计

#### 文件: `packages/player/src/plugins/hls/HlsPlugin.ts`

```typescript
import type { StreamPlugin, StreamConfig, BufferInfo, StreamStats, QualityLevel } from '../types';
import { StreamPluginTypeEnum, StreamFormatEnum, BufferStatusEnum } from '../enums';
import { BrowserCapabilityDetector } from '@/utils/browserCapabilityDetector';
import type { EventBus } from '@/core/plugin';
import type { VideoPlayer } from '@/player';

/**
 * HLS.js 配置接口
 */
interface HlsJsConfig {
  /** 最大缓冲长度（秒） */
  maxBufferLength?: number;
  /** 最大缓冲大小（MB） */
  maxMaxBufferLength?: number;
  /** 直播最大延迟（秒） */
  liveSyncDurationCount?: number;
  /** 直播追赶速度 */
  liveMaxLatencyDurationCount?: number;
  /** 是否启用 Worker */
  enableWorker?: boolean;
  /** 是否启用软件 AES 解密 */
  enableSoftwareAES?: boolean;
  /** 片段加载超时（ms） */
  fragLoadingTimeOut?: number;
  /** 片段加载最大重试次数 */
  fragLoadingMaxRetry?: number;
  /** 级别切换最大重试次数 */
  levelLoadingMaxRetry?: number;
}

/**
 * HLS.js Level 接口
 */
interface HlsLevel {
  id: number;
  bitrate: number;
  width: number;
  height: number;
  name?: string;
  codecSet?: string;
  attrs?: {
    FRAME_RATE?: string;
  };
}

/**
 * HLS 插件
 * 基于 hls.js 的 HLS 格式播放器插件
 */
export class HlsPlugin implements StreamPlugin {
  readonly name = 'hls';
  readonly version = '1.0.0';
  readonly description = 'HLS format streaming player based on hls.js';
  readonly type = StreamPluginTypeEnum.HLS;

  /** hls.js 实例 */
  private hls: unknown | null = null;
  /** 视频元素 */
  private videoElement: HTMLVideoElement | null = null;
  /** 事件总线 */
  private eventBus: EventBus | null = null;
  /** 当前配置 */
  private config: StreamConfig | null = null;
  /** 可用清晰度列表 */
  private qualityLevels: QualityLevel[] = [];
  /** 当前清晰度 ID */
  private currentQualityId = '';
  /** 缓冲状态 */
  private bufferStatus = BufferStatusEnum.IDLE;
  /** 卡顿计数 */
  private stallCount = 0;
  /** 上次卡顿时间 */
  private lastStallTime = 0;
  /** 总卡顿时长 */
  private totalStallTime = 0;
  /** 首帧时间 */
  private firstFrameTime = 0;
  /** 加载开始时间 */
  private loadStartTime = 0;

  /**
   * 检查浏览器是否支持 HLS.js
   */
  isSupported(): boolean {
    const support = BrowserCapabilityDetector.checkHlsjsSupport();
    return support.supported;
  }

  /**
   * 获取 HLS.js 支持性详情
   */
  getSupportDetail(): { supported: boolean; detail: string } {
    return BrowserCapabilityDetector.checkHlsjsSupport();
  }

  /**
   * 安装插件
   */
  install(player: VideoPlayer): void {
    console.log('[HlsPlugin] 插件已安装');
  }

  /**
   * 卸载插件
   */
  uninstall(player: VideoPlayer): void {
    this.destroy();
    console.log('[HlsPlugin] 插件已卸载');
  }

  /**
   * 加载视频源
   */
  load(config: StreamConfig): void {
    if (!this.isSupported()) {
      const detail = this.getSupportDetail();
      console.error('[HlsPlugin]', detail.detail);
      this.eventBus?.emit('stream:error', { message: detail.detail });
      return;
    }

    this.config = config;
    this.loadStartTime = Date.now();

    // 动态导入 hls.js
    import('hls.js').then((HlsModule) => {
      const Hls = HlsModule.default;

      if (!Hls.isSupported()) {
        const msg = 'hls.js 检测到浏览器不支持';
        console.error('[HlsPlugin]', msg);
        this.eventBus?.emit('stream:error', { message: msg });
        return;
      }

      if (!this.videoElement) {
        const msg = '视频元素未设置';
        console.error('[HlsPlugin]', msg);
        this.eventBus?.emit('stream:error', { message: msg });
        return;
      }

      // 创建 hls.js 实例
      this.hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        liveSyncDurationCount: 3,
        enableWorker: true,
        enableSoftwareAES: true,
        ...config,
      });

      // 绑定事件
      this.bindEvents();

      // 加载源
      (this.hls as { loadSource: (url: string) => void }).loadSource(config.url);
      (this.hls as { attachMedia: (video: HTMLVideoElement) => void }).attachMedia(this.videoElement);

      this.eventBus?.emit('stream:loadstart', { url: config.url });

      // 自动播放
      if (config.autoplay) {
        this.play();
      }
    });
  }

  /**
   * 绑定 hls.js 事件
   */
  private bindEvents(): void {
    if (!this.hls) return;

    const hls = this.hls as {
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      off: (event: string, callback: (...args: unknown[]) => void) => void;
      levels: HlsLevel[];
      currentLevel: number;
      nextLevel: number;
    };

    // 媒体附加完成
    hls.on('MEDIA_ATTACHED', () => {
      console.log('[HlsPlugin] Media attached');
    });

    // 清单加载完成
    hls.on('MANIFEST_PARSED', (_event: unknown, data: { levels: HlsLevel[] }) => {
      this.qualityLevels = data.levels.map((level) => ({
        id: String(level.id),
        name: level.name || `${level.height}p`,
        width: level.width,
        height: level.height,
        bitrate: level.bitrate,
        codec: level.codecSet || 'unknown',
        frameRate: level.attrs?.FRAME_RATE ? parseFloat(level.attrs.FRAME_RATE) : 0,
      }));

      this.eventBus?.emit('stream:loadcomplete', {
        url: this.config?.url,
        qualities: this.qualityLevels,
      });

      // 设置默认清晰度
      if (this.config?.defaultQuality) {
        this.switchQuality(this.config.defaultQuality);
      }
    });

    // 级别切换
    hls.on('LEVEL_SWITCHED', (_event: unknown, data: { level: number }) => {
      const level = hls.levels[data.level];
      if (level) {
        this.currentQualityId = String(level.id);
        this.eventBus?.emit('stream:qualityswitchcomplete', {
          qualityId: this.currentQualityId,
          quality: this.qualityLevels.find((q) => q.id === this.currentQualityId),
        });
      }
    });

    // 缓冲事件
    hls.on('BUFFER_APPENDING', () => {
      if (this.bufferStatus !== BufferStatusEnum.BUFFERING) {
        this.bufferStatus = BufferStatusEnum.BUFFERING;
        this.lastStallTime = Date.now();
        this.eventBus?.emit('stream:bufferstart', {});
      }
    });

    hls.on('BUFFER_APPENDED', () => {
      this.bufferStatus = BufferStatusEnum.ENOUGH;
      if (this.lastStallTime > 0) {
        const stallDuration = Date.now() - this.lastStallTime;
        this.stallCount++;
        this.totalStallTime += stallDuration;
        this.lastStallTime = 0;
      }
      this.eventBus?.emit('stream:bufferend', {});
    });

    // 错误处理
    hls.on('ERROR', (_event: unknown, data: { type: string; details: string; fatal: boolean }) => {
      console.error('[HlsPlugin] Error:', data);

      if (data.fatal) {
        switch (data.type) {
          case 'networkError':
            // 网络错误，尝试恢复
            console.log('[HlsPlugin] Fatal network error, trying to recover');
            (this.hls as { startLoad: () => void }).startLoad();
            break;
          case 'mediaError':
            // 媒体错误，尝试恢复
            console.log('[HlsPlugin] Fatal media error, trying to recover');
            (this.hls as { recoverMediaError: () => void }).recoverMediaError();
            break;
          default:
            // 无法恢复的错误
            this.eventBus?.emit('stream:error', {
              type: data.type,
              detail: data.details,
              fatal: true,
            });
            break;
        }
      }
    });

    // 片段加载进度
    hls.on('FRAG_LOAD_PROGRESS', (_event: unknown, data: { stats: { loaded: number; total: number } }) => {
      this.eventBus?.emit('stream:bufferprogress', {
        loaded: data.stats.loaded,
        total: data.stats.total,
      });
    });

    // 首个片段加载完成（首帧）
    hls.on('FRAG_LOADED', () => {
      if (this.firstFrameTime === 0) {
        this.firstFrameTime = Date.now() - this.loadStartTime;
      }
    });
  }

  /**
   * 卸载视频源
   */
  unload(): void {
    if (this.hls) {
      (this.hls as { destroy: () => void }).destroy();
      this.hls = null;
    }
    this.qualityLevels = [];
    this.currentQualityId = '';
    this.bufferStatus = BufferStatusEnum.IDLE;
  }

  /**
   * 播放
   */
  play(): void {
    this.videoElement?.play();
    this.eventBus?.emit('stream:playstart', {});
  }

  /**
   * 暂停
   */
  pause(): void {
    this.videoElement?.pause();
    this.eventBus?.emit('stream:playpause', {});
  }

  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  /**
   * 获取缓冲信息
   */
  getBufferInfo(): BufferInfo {
    if (!this.videoElement) {
      return {
        status: BufferStatusEnum.IDLE,
        bufferStart: 0,
        bufferEnd: 0,
        bufferLength: 0,
        bufferPercent: 0,
        downloadedBytes: 0,
        totalBytes: null,
        downloadSpeed: 0,
        estimatedTime: 0,
      };
    }

    const video = this.videoElement;
    const buffered = video.buffered;
    const duration = video.duration || 0;
    const currentTime = video.currentTime || 0;

    let bufferStart = 0;
    let bufferEnd = 0;

    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && buffered.end(i) >= currentTime) {
        bufferStart = buffered.start(i);
        bufferEnd = buffered.end(i);
        break;
      }
    }

    const bufferLength = bufferEnd - currentTime;
    const bufferPercent = duration > 0 ? (bufferEnd / duration) * 100 : 0;

    return {
      status: this.bufferStatus,
      bufferStart,
      bufferEnd,
      bufferLength,
      bufferPercent,
      downloadedBytes: 0,
      totalBytes: null,
      downloadSpeed: 0,
      estimatedTime: 0,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): StreamStats {
    const video = this.videoElement;
    const currentLevel = this.qualityLevels.find((q) => q.id === this.currentQualityId);

    return {
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      currentQuality: currentLevel?.name || 'unknown',
      currentBitrate: currentLevel?.bitrate || 0,
      avgDownloadSpeed: 0,
      dropFrameRatio: 0,
      decodeFPS: 0,
      renderFPS: 0,
      firstFrameTime: this.firstFrameTime,
      stallCount: this.stallCount,
      totalStallTime: this.totalStallTime,
    };
  }

  /**
   * 获取可用清晰度列表
   */
  getQualities(): QualityLevel[] {
    return this.qualityLevels;
  }

  /**
   * 切换清晰度
   */
  switchQuality(qualityId: string): void {
    if (!this.hls) return;

    const levelIndex = this.qualityLevels.findIndex((q) => q.id === qualityId);
    if (levelIndex >= 0) {
      (this.hls as { nextLevel: number }).nextLevel = levelIndex;
      this.eventBus?.emit('stream:qualityswitch', { qualityId });
    }
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = volume;
    }
  }

  /**
   * 设置静音
   */
  setMuted(muted: boolean): void {
    if (this.videoElement) {
      this.videoElement.muted = muted;
    }
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate: number): void {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate;
    }
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    this.unload();
    this.videoElement = null;
    this.eventBus = null;
  }
}

/**
 * 创建 HLS 插件工厂函数
 */
export function createHlsPlugin(
  videoElement: HTMLVideoElement,
  eventBus: EventBus
): HlsPlugin {
  const plugin = new HlsPlugin();
  (plugin as unknown as { videoElement: HTMLVideoElement }).videoElement = videoElement;
  (plugin as unknown as { eventBus: EventBus }).eventBus = eventBus;
  return plugin;
}
```

### 9.5 DASH 插件设计

#### 文件: `packages/player/src/plugins/dash/DashPlugin.ts`

```typescript
import type { StreamPlugin, StreamConfig, BufferInfo, StreamStats, QualityLevel } from '../types';
import { StreamPluginTypeEnum, StreamFormatEnum, BufferStatusEnum } from '../enums';
import { BrowserCapabilityDetector } from '@/utils/browserCapabilityDetector';
import type { EventBus } from '@/core/plugin';
import type { VideoPlayer } from '@/player';

/**
 * Dash.js MediaPlayer 接口
 */
interface DashMediaPlayer {
  initialize(video: HTMLVideoElement, source: string, autoplay: boolean): void;
  reset(): void;
  destroy(): void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  isPaused(): boolean;
  isReady(): boolean;
  getDuration(): number;
  getCurrentTime(): number;
  getVideoElement(): HTMLVideoElement | null;

  // 质量相关
  getBitrateInfoListFor(type: 'video' | 'audio'): DashBitrateInfo[];
  setQualityFor(type: 'video' | 'audio', index: number, force?: boolean): void;
  getQualityFor(type: 'video' | 'audio'): number;
  setAutoSwitchQualityFor(type: 'video' | 'audio', value: boolean): void;
  getAutoSwitchQualityFor(type: 'video' | 'audio'): boolean;

  // 缓冲相关
  getBufferLength(type: 'video' | 'audio' | 'text'): number;

  // 事件
  on(event: string, callback: (...args: unknown[]) => void, scope?: unknown): void;
  off(event: string, callback: (...args: unknown[]) => void, scope?: unknown): void;

  // 设置
  updateSettings(settings: Record<string, unknown>): void;
  getSettings(): Record<string, unknown>;
}

/**
 * Dash.js BitrateInfo 接口
 */
interface DashBitrateInfo {
  id: string;
  bitrate: number;
  width: number;
  height: number;
  codec?: string;
}

/**
 * DASH 插件
 * 基于 dash.js 的 DASH 格式播放器插件
 */
export class DashPlugin implements StreamPlugin {
  readonly name = 'dash';
  readonly version = '1.0.0';
  readonly description = 'DASH format streaming player based on dash.js';
  readonly type = StreamPluginTypeEnum.DASH;

  /** dash.js 播放器实例 */
  private player: DashMediaPlayer | null = null;
  /** 视频元素 */
  private videoElement: HTMLVideoElement | null = null;
  /** 事件总线 */
  private eventBus: EventBus | null = null;
  /** 当前配置 */
  private config: StreamConfig | null = null;
  /** 可用清晰度列表 */
  private qualityLevels: QualityLevel[] = [];
  /** 当前清晰度 ID */
  private currentQualityId = '';
  /** 缓冲状态 */
  private bufferStatus = BufferStatusEnum.IDLE;
  /** 卡顿计数 */
  private stallCount = 0;
  /** 上次卡顿时间 */
  private lastStallTime = 0;
  /** 总卡顿时长 */
  private totalStallTime = 0;
  /** 首帧时间 */
  private firstFrameTime = 0;
  /** 加载开始时间 */
  private loadStartTime = 0;
  /** 是否启用 ABR */
  private enableABR = true;

  /**
   * 检查浏览器是否支持 DASH
   */
  isSupported(): boolean {
    return BrowserCapabilityDetector.isDASHSupported();
  }

  /**
   * 获取 DASH 支持性详情
   */
  getSupportDetail(): { supported: boolean; detail: string } {
    const supported = this.isSupported();
    const browserInfo = BrowserCapabilityDetector.getBrowserInfo();
    const osInfo = BrowserCapabilityDetector.getOSInfo();

    if (!supported) {
      if (BrowserCapabilityDetector.isIOS()) {
        return {
          supported: false,
          detail: `iOS 系统 (${osInfo.name} ${osInfo.version}) 不支持 MSE，无法播放 DASH 格式`,
        };
      }
      return {
        supported: false,
        detail: `当前浏览器 ${browserInfo.name} ${browserInfo.version} 不支持 MSE，无法播放 DASH 格式`,
      };
    }

    return {
      supported: true,
      detail: `浏览器 ${browserInfo.name} ${browserInfo.version} 支持 MSE，可以播放 DASH 格式`,
    };
  }

  /**
   * 安装插件
   */
  install(player: VideoPlayer): void {
    console.log('[DashPlugin] 插件已安装');
  }

  /**
   * 卸载插件
   */
  uninstall(player: VideoPlayer): void {
    this.destroy();
    console.log('[DashPlugin] 插件已卸载');
  }

  /**
   * 加载视频源
   */
  load(config: StreamConfig): void {
    if (!this.isSupported()) {
      const detail = this.getSupportDetail();
      console.error('[DashPlugin]', detail.detail);
      this.eventBus?.emit('stream:error', { message: detail.detail });
      return;
    }

    this.config = config;
    this.loadStartTime = Date.now();
    this.enableABR = config.enableABR !== false;

    // 动态导入 dash.js
    import('dashjs').then((dashjs) => {
      if (!this.videoElement) {
        const msg = '视频元素未设置';
        console.error('[DashPlugin]', msg);
        this.eventBus?.emit('stream:error', { message: msg });
        return;
      }

      // 创建 dash.js 播放器
      this.player = dashjs.MediaPlayer().create() as DashMediaPlayer;

      // 配置设置
      this.player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: this.enableABR,
              audio: this.enableABR,
            },
          },
          buffer: {
            fastSwitchEnabled: true,
          },
        },
      });

      // 绑定事件
      this.bindEvents();

      // 初始化播放器
      this.player.initialize(this.videoElement, config.url, config.autoplay || false);

      this.eventBus?.emit('stream:loadstart', { url: config.url });

      // 设置起始时间
      if (config.startTime && config.startTime > 0) {
        this.seek(config.startTime);
      }
    });
  }

  /**
   * 绑定 dash.js 事件
   */
  private bindEvents(): void {
    if (!this.player) return;

    // 流初始化完成
    this.player.on('streamInitialized', () => {
      console.log('[DashPlugin] Stream initialized');

      // 获取可用清晰度
      const bitrateList = this.player?.getBitrateInfoListFor('video') || [];
      this.qualityLevels = bitrateList.map((info) => ({
        id: String(info.id),
        name: `${info.height}p`,
        width: info.width,
        height: info.height,
        bitrate: info.bitrate,
        codec: info.codec || 'unknown',
        frameRate: 0, // dash.js 不直接提供帧率
      }));

      this.eventBus?.emit('stream:loadcomplete', {
        url: this.config?.url,
        qualities: this.qualityLevels,
      });

      // 设置默认清晰度
      if (this.config?.defaultQuality && !this.enableABR) {
        this.switchQuality(this.config.defaultQuality);
      }
    });

    // 缓冲级别改变
    this.player.on('bufferLevelUpdated', () => {
      const bufferInfo = this.getBufferInfo();
      this.eventBus?.emit('stream:bufferprogress', bufferInfo);
    });

    // 缓冲状态
    this.player.on('bufferStalled', () => {
      this.bufferStatus = BufferStatusEnum.BUFFERING;
      this.lastStallTime = Date.now();
      this.eventBus?.emit('stream:bufferstart', {});
    });

    this.player.on('bufferLoaded', () => {
      if (this.bufferStatus === BufferStatusEnum.BUFFERING) {
        const stallDuration = Date.now() - this.lastStallTime;
        this.stallCount++;
        this.totalStallTime += stallDuration;
      }
      this.bufferStatus = BufferStatusEnum.ENOUGH;
      this.eventBus?.emit('stream:bufferend', {});
    });

    // 质量切换
    this.player.on('qualityChangeRequested', (_event: unknown, data: { newQuality: number }) => {
      const level = this.qualityLevels[data.newQuality];
      if (level) {
        this.eventBus?.emit('stream:qualityswitch', { qualityId: level.id });
      }
    });

    this.player.on('qualityChangeRendered', (_event: unknown, data: { newQuality: number }) => {
      const level = this.qualityLevels[data.newQuality];
      if (level) {
        this.currentQualityId = level.id;
        this.eventBus?.emit('stream:qualityswitchcomplete', {
          qualityId: level.id,
          quality: level,
        });
      }
    });

    // ABR 切换
    this.player.on('adaptationSetSelected', () => {
      this.eventBus?.emit('stream:abrswitch', {});
    });

    // 错误处理
    this.player.on('error', (_event: unknown, data: { error: string; event: string }) => {
      console.error('[DashPlugin] Error:', data);
      this.eventBus?.emit('stream:error', {
        type: data.error,
        detail: data.event,
        fatal: true,
      });
    });

    // 播放开始
    this.player.on('playbackStarted', () => {
      if (this.firstFrameTime === 0) {
        this.firstFrameTime = Date.now() - this.loadStartTime;
      }
      this.eventBus?.emit('stream:playstart', {});
    });

    // 播放暂停
    this.player.on('playbackPaused', () => {
      this.eventBus?.emit('stream:playpause', {});
    });

    // 播放结束
    this.player.on('playbackEnded', () => {
      this.eventBus?.emit('stream:playend', {});
    });
  }

  /**
   * 卸载视频源
   */
  unload(): void {
    if (this.player) {
      this.player.reset();
      this.player.destroy();
      this.player = null;
    }
    this.qualityLevels = [];
    this.currentQualityId = '';
    this.bufferStatus = BufferStatusEnum.IDLE;
  }

  /**
   * 播放
   */
  play(): void {
    this.player?.play();
  }

  /**
   * 暂停
   */
  pause(): void {
    this.player?.pause();
  }

  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    this.player?.seek(time);
  }

  /**
   * 获取缓冲信息
   */
  getBufferInfo(): BufferInfo {
    if (!this.player || !this.videoElement) {
      return {
        status: BufferStatusEnum.IDLE,
        bufferStart: 0,
        bufferEnd: 0,
        bufferLength: 0,
        bufferPercent: 0,
        downloadedBytes: 0,
        totalBytes: null,
        downloadSpeed: 0,
        estimatedTime: 0,
      };
    }

    const video = this.videoElement;
    const buffered = video.buffered;
    const duration = video.duration || 0;
    const currentTime = video.currentTime || 0;

    let bufferStart = 0;
    let bufferEnd = 0;

    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && buffered.end(i) >= currentTime) {
        bufferStart = buffered.start(i);
        bufferEnd = buffered.end(i);
        break;
      }
    }

    const bufferLength = bufferEnd - currentTime;
    const bufferPercent = duration > 0 ? (bufferEnd / duration) * 100 : 0;

    // dash.js 提供的缓冲长度
    const dashBufferLength = this.player.getBufferLength('video');

    return {
      status: this.bufferStatus,
      bufferStart,
      bufferEnd,
      bufferLength: dashBufferLength || bufferLength,
      bufferPercent,
      downloadedBytes: 0,
      totalBytes: null,
      downloadSpeed: 0,
      estimatedTime: 0,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): StreamStats {
    const video = this.videoElement;
    const currentLevel = this.qualityLevels.find((q) => q.id === this.currentQualityId);

    return {
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      currentQuality: currentLevel?.name || 'unknown',
      currentBitrate: currentLevel?.bitrate || 0,
      avgDownloadSpeed: 0,
      dropFrameRatio: 0,
      decodeFPS: 0,
      renderFPS: 0,
      firstFrameTime: this.firstFrameTime,
      stallCount: this.stallCount,
      totalStallTime: this.totalStallTime,
    };
  }

  /**
   * 获取可用清晰度列表
   */
  getQualities(): QualityLevel[] {
    return this.qualityLevels;
  }

  /**
   * 切换清晰度
   */
  switchQuality(qualityId: string): void {
    if (!this.player) return;

    const levelIndex = this.qualityLevels.findIndex((q) => q.id === qualityId);
    if (levelIndex >= 0) {
      // 禁用自动切换
      this.player.setAutoSwitchQualityFor('video', false);
      this.enableABR = false;

      // 设置清晰度
      this.player.setQualityFor('video', levelIndex, true);
      this.eventBus?.emit('stream:qualityswitch', { qualityId });
    }
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = volume;
    }
  }

  /**
   * 设置静音
   */
  setMuted(muted: boolean): void {
    if (this.videoElement) {
      this.videoElement.muted = muted;
    }
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate: number): void {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate;
    }
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    this.unload();
    this.videoElement = null;
    this.eventBus = null;
  }
}

/**
 * 创建 DASH 插件工厂函数
 */
export function createDashPlugin(
  videoElement: HTMLVideoElement,
  eventBus: EventBus
): DashPlugin {
  const plugin = new DashPlugin();
  (plugin as unknown as { videoElement: HTMLVideoElement }).videoElement = videoElement;
  (plugin as unknown as { eventBus: EventBus }).eventBus = eventBus;
  return plugin;
}
```

### 9.6 流媒体插件管理器

#### 文件: `packages/player/src/plugins/StreamPluginManager.ts`

```typescript
import type { StreamPlugin, StreamConfig } from './types';
import { StreamPluginTypeEnum, StreamFormatEnum } from './enums';
import { BrowserCapabilityDetector } from '@/utils/browserCapabilityDetector';
import type { EventBus } from '@/core/plugin';

/**
 * 流媒体插件管理器
 * 管理所有流媒体插件的注册、选择和切换
 */
export class StreamPluginManager {
  /** 已注册的插件映射表 */
  private plugins = new Map<StreamPluginTypeEnum, new () => StreamPlugin>();
  /** 当前使用的插件实例 */
  private currentPlugin: StreamPlugin | null = null;
  /** 视频元素 */
  private videoElement: HTMLVideoElement | null = null;
  /** 事件总线 */
  private eventBus: EventBus | null = null;

  /**
   * 设置视频元素
   */
  setVideoElement(video: HTMLVideoElement): void {
    this.videoElement = video;
  }

  /**
   * 设置事件总线
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * 注册插件
   */
  register(type: StreamPluginTypeEnum, pluginClass: new () => StreamPlugin): void {
    this.plugins.set(type, pluginClass);
  }

  /**
   * 根据格式自动选择最佳插件
   */
  autoSelectPlugin(format: StreamFormatEnum): StreamPluginTypeEnum | null {
    // 根据格式选择插件
    switch (format) {
      case StreamFormatEnum.FLV:
        if (BrowserCapabilityDetector.isFlvjsSupported()) {
          return StreamPluginTypeEnum.FLV;
        }
        break;
      case StreamFormatEnum.HLS:
        if (BrowserCapabilityDetector.checkHlsjsSupport().supported) {
          return StreamPluginTypeEnum.HLS;
        }
        // 检查原生 HLS 支持（Safari）
        if (this.videoElement && this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          return StreamPluginTypeEnum.NATIVE;
        }
        break;
      case StreamFormatEnum.DASH:
        if (BrowserCapabilityDetector.isDASHSupported()) {
          return StreamPluginTypeEnum.DASH;
        }
        break;
      case StreamFormatEnum.MP4:
      case StreamFormatEnum.WEBM:
      case StreamFormatEnum.OGG:
        return StreamPluginTypeEnum.NATIVE;
    }
    return null;
  }

  /**
   * 加载视频源
   */
  load(config: StreamConfig): void {
    // 卸载当前插件
    if (this.currentPlugin) {
      this.currentPlugin.unload();
      this.currentPlugin = null;
    }

    // 自动选择插件类型
    const pluginType = this.autoSelectPlugin(config.format);
    if (!pluginType) {
      const msg = `不支持的视频格式: ${config.format}`;
      console.error('[StreamPluginManager]', msg);
      this.eventBus?.emit('stream:error', { message: msg });
      return;
    }

    // 创建插件实例
    const PluginClass = this.plugins.get(pluginType);
    if (!PluginClass) {
      const msg = `未找到 ${pluginType} 插件`;
      console.error('[StreamPluginManager]', msg);
      this.eventBus?.emit('stream:error', { message: msg });
      return;
    }

    this.currentPlugin = new PluginClass();

    // 设置视频元素和事件总线
    if (this.videoElement) {
      (this.currentPlugin as unknown as { videoElement: HTMLVideoElement }).videoElement =
        this.videoElement;
    }
    if (this.eventBus) {
      (this.currentPlugin as unknown as { eventBus: EventBus }).eventBus = this.eventBus;
    }

    // 加载视频
    this.currentPlugin.load(config);
  }

  /**
   * 获取当前插件
   */
  getCurrentPlugin(): StreamPlugin | null {
    return this.currentPlugin;
  }

  /**
   * 获取缓冲信息
   */
  getBufferInfo() {
    return this.currentPlugin?.getBufferInfo();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.currentPlugin?.getStats();
  }

  /**
   * 获取可用清晰度列表
   */
  getQualities() {
    return this.currentPlugin?.getQualities() || [];
  }

  /**
   * 切换清晰度
   */
  switchQuality(qualityId: string): void {
    this.currentPlugin?.switchQuality(qualityId);
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.currentPlugin) {
      this.currentPlugin.destroy();
      this.currentPlugin = null;
    }
    this.plugins.clear();
  }
}

/**
 * 创建流媒体插件管理器
 */
export function createStreamPluginManager(): StreamPluginManager {
  return new StreamPluginManager();
}
```

### 9.7 插件导出

#### 文件: `packages/player/src/plugins/index.ts`

```typescript
/**
 * 流媒体插件模块导出
 */

// 枚举
export {
  StreamPluginTypeEnum,
  StreamFormatEnum,
  StreamPluginEventEnum,
  BufferStatusEnum,
} from './enums';

// 类型
export type {
  StreamPlugin,
  StreamConfig,
  BufferInfo,
  StreamStats,
  QualityLevel,
} from './types';

// 插件
export { FlvPlugin, createFlvPlugin } from './flv/FlvPlugin';
export { HlsPlugin, createHlsPlugin } from './hls/HlsPlugin';
export { DashPlugin, createDashPlugin } from './dash/DashPlugin';

// 管理器
export {
  StreamPluginManager,
  createStreamPluginManager,
} from './StreamPluginManager';
```

---

## 十、弹幕插件系统设计

### 10.1 弹幕类型枚举

#### 文件: `packages/player/src/plugins/danmaku/enums.ts`

```typescript
/**
 * 弹幕类型枚举
 */
export enum DanmakuTypeEnum {
  /** 滚动弹幕（从右到左） */
  SCROLL = 1,
  /** 顶部固定弹幕 */
  TOP = 2,
  /** 底部固定弹幕 */
  BOTTOM = 3,
  /** 高级弹幕（可定位） */
  ADVANCED = 4,
}

/**
 * 弹幕位置枚举（字符串类型，用于渲染）
 */
export enum DanmakuPositionEnum {
  /** 滚动 */
  SCROLL = 'SCROLL',
  /** 顶部 */
  TOP = 'TOP',
  /** 底部 */
  BOTTOM = 'BOTTOM',
}

/**
 * 弹幕渲染模式枚举
 */
export enum DanmakuRenderModeEnum {
  /** DOM 渲染（兼容性最好） */
  DOM = 'DOM',
  /** Canvas 渲染（性能最好） */
  CANVAS = 'CANVAS',
  /** 自动模式 - 根据弹幕数量自动切换 */
  AUTO = 'AUTO',
}

/**
 * 弹幕速度档位枚举 - 5档
 */
export enum DanmakuSpeedEnum {
  /** 极慢 - 0.5倍速 */
  VERY_SLOW = 1,
  /** 较慢 - 0.75倍速 */
  SLOW = 2,
  /** 适中 - 1.0倍速（默认） */
  NORMAL = 3,
  /** 较快 - 1.5倍速 */
  FAST = 4,
  /** 极快 - 2.0倍速 */
  VERY_FAST = 5,
}

/**
 * 弹幕字号档位枚举
 */
export enum DanmakuFontSizeEnum {
  /** 小字号 */
  SMALL = 0.8,
  /** 标准字号（默认） */
  NORMAL = 1.0,
}

/**
 * 弹幕区域档位枚举 - 4档
 */
export enum DanmakuAreaEnum {
  /** 25% - 仅顶部区域 */
  QUARTER = 0.25,
  /** 50% - 上半区域 */
  HALF = 0.5,
  /** 75% - 大部分区域 */
  THREE_QUARTERS = 0.75,
  /** 100% - 全屏 */
  FULL = 1,
}

/**
 * 屏幕模式枚举
 */
export enum ScreenModeEnum {
  /** 正常模式 */
  NORMAL = 'NORMAL',
  /** 全屏模式 */
  FULLSCREEN = 'FULLSCREEN',
  /** 网页全屏 */
  WEB_FULLSCREEN = 'WEB_FULLSCREEN',
}

/**
 * 弹幕事件枚举
 */
export enum DanmakuEventEnum {
  /** 弹幕添加 */
  ADD = 'ADD',
  /** 弹幕发送 */
  SEND = 'SEND',
  /** 弹幕显示 */
  SHOW = 'SHOW',
  /** 弹幕隐藏 */
  HIDE = 'HIDE',
  /** 弹幕点击 */
  CLICK = 'CLICK',
  /** 弹幕举报 */
  REPORT = 'REPORT',
  /** 弹幕屏蔽 */
  BLOCK = 'BLOCK',
  /** 弹幕密度改变 */
  DENSITY_CHANGE = 'DENSITY_CHANGE',
  /** 弹幕速度改变 */
  SPEED_CHANGE = 'SPEED_CHANGE',
  /** 弹幕透明度改变 */
  OPACITY_CHANGE = 'OPACITY_CHANGE',
  /** 弹幕字体大小改变 */
  FONTSIZE_CHANGE = 'FONTSIZE_CHANGE',
  /** 性能警告 */
  PERFORMANCE_WARNING = 'PERFORMANCE_WARNING',
}

/**
 * 弹幕密度枚举
 */
export enum DanmakuDensityEnum {
  /** 无限（不限制） */
  UNLIMITED = 'UNLIMITED',
  /** 密集 */
  HIGH = 'HIGH',
  /** 适中 */
  NORMAL = 'NORMAL',
  /** 稀疏 */
  LOW = 'LOW',
  /** 无（不显示） */
  NONE = 'NONE',
}

/**
 * 弹幕发送模式枚举
 */
export enum DanmakuSendModeEnum {
  /** 实时发送 */
  REALTIME = 'REALTIME',
  /** 延迟发送（审核） */
  DELAYED = 'DELAYED',
  /** 本地预览 */
  PREVIEW = 'PREVIEW',
}
```

### 10.2 弹幕数据接口

#### 文件: `packages/player/src/plugins/danmaku/types.ts`

```typescript
import type { DanmakuTypeEnum, DanmakuRenderModeEnum, DanmakuDensityEnum } from './enums';

/**
 * 弹幕数据接口
 */
export interface DanmakuItem {
  /** 弹幕唯一 ID */
  id: string;
  /** 弹幕文本内容 */
  text: string;
  /** 弹幕出现时间（秒） */
  time: number;
  /** 弹幕类型 */
  type: DanmakuTypeEnum;
  /** 弹幕颜色（十六进制） */
  color: string;
  /** 弹幕字体大小（1=小, 2=中, 3=大） */
  fontSize: number;
  /** 发送者 ID */
  senderId?: string;
  /** 发送者名称 */
  senderName?: string;
  /** 发送者头像 */
  senderAvatar?: string;
  /** 是否会员弹幕 */
  isVip?: boolean;
  /** 是否自己发送的 */
  isSelf?: boolean;
  /** 点赞数 */
  likes?: number;
  /** 创建时间 */
  createdAt?: number;
  /** 权重（用于密度控制） */
  weight?: number;
  /** 高级弹幕位置（百分比 0-100） */
  position?: {
    x: number;
    y: number;
  };
}

/**
 * 弹幕配置接口
 */
export interface DanmakuConfig {
  /** 是否启用弹幕 */
  enabled: boolean;
  /** 渲染模式 */
  renderMode: DanmakuRenderModeEnum;
  /** 弹幕密度 */
  density: DanmakuDensityEnum;
  /** 弹幕速度（像素/秒） */
  speed: number;
  /** 弹幕透明度（0-1） */
  opacity: number;
  /** 弹幕字体大小缩放（0.5-2） */
  fontSizeScale: number;
  /** 弹幕显示区域（0-1，1为全屏） */
  displayArea: number;
  /** 是否启用弹幕防遮挡 */
  preventOcclusion: boolean;
  /** 是否启用弹幕合并 */
  mergeSimilar: boolean;
  /** 是否显示弹幕边框 */
  showBorder: boolean;
  /** 弹幕最大数量 */
  maxDanmakuCount: number;
  /** 弹幕层叠数（同屏最大行数） */
  maxOverlap: number;
  /** 弹幕发送冷却时间（秒） */
  sendCooldown: number;
  /** 弹幕历史记录数量 */
  historyLimit: number;
}

/**
 * 弹幕发送数据接口
 */
export interface DanmakuSendData {
  /** 弹幕文本 */
  text: string;
  /** 弹幕类型 */
  type: DanmakuTypeEnum;
  /** 弹幕颜色 */
  color: string;
  /** 弹幕字体大小 */
  fontSize: number;
  /** 弹幕出现时间（秒，可选，默认当前时间） */
  time?: number;
  /** 高级弹幕位置（可选） */
  position?: {
    x: number;
    y: number;
  };
}

/**
 * 弹幕过滤规则接口
 */
export interface DanmakuFilterRule {
  /** 规则 ID */
  id: string;
  /** 规则类型 */
  type: 'keyword' | 'regexp' | 'user' | 'color';
  /** 规则值 */
  value: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否正则 */
  isRegExp?: boolean;
}

/**
 * 弹幕统计信息接口
 */
export interface DanmakuStats {
  /** 当前屏幕弹幕数 */
  currentCount: number;
  /** 已加载弹幕总数 */
  totalLoaded: number;
  /** 已过滤弹幕数 */
  filteredCount: number;
  /** 已发送弹幕数 */
  sentCount: number;
  /** 当前渲染帧率 */
  renderFPS: number;
  /** 渲染耗时（ms） */
  renderTime: number;
}

/**
 * 弹幕源接口
 */
export interface DanmakuSource {
  /** 源 ID */
  id: string;
  /** 源名称 */
  name: string;
  /** 源类型 */
  type: 'api' | 'websocket' | 'static';
  /** 源地址 */
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 是否启用 */
  enabled: boolean;
}
```

### 10.3 弹幕插件接口

#### 文件: `packages/player/src/plugins/danmaku/DanmakuPlugin.ts`

```typescript
import type { Plugin } from '@/core/plugin';
import type { VideoPlayer } from '@/player';
import type {
  DanmakuItem,
  DanmakuConfig,
  DanmakuSendData,
  DanmakuFilterRule,
  DanmakuStats,
  DanmakuSource,
} from './types';
import type { DanmakuTypeEnum, DanmakuRenderModeEnum, DanmakuDensityEnum } from './enums';
import type { EventBus } from '@/core/plugin';

/**
 * 弹幕渲染器接口
 */
interface DanmakuRenderer {
  /** 初始化渲染器 */
  init(container: HTMLElement): void;
  /** 渲染一帧 */
  render(danmakuList: DanmakuItem[], currentTime: number): void;
  /** 调整大小 */
  resize(width: number, height: number): void;
  /** 清空弹幕 */
  clear(): void;
  /** 销毁渲染器 */
  destroy(): void;
}

/**
 * 弹幕轨道管理器接口
 */
interface DanmakuTrackManager {
  /** 获取可用轨道 */
  getAvailableTrack(type: DanmakuTypeEnum, width: number): number;
  /** 释放轨道 */
  releaseTrack(trackIndex: number): void;
  /** 重置所有轨道 */
  reset(): void;
}

/**
 * 弹幕插件
 * 提供完整的弹幕显示、发送、管理功能
 */
export class DanmakuPlugin implements Plugin {
  readonly name = 'danmaku';
  readonly version = '1.0.0';
  readonly description = 'Danmaku (bullet comment) plugin for video player';

  /** 弹幕容器元素 */
  private container: HTMLElement | null = null;
  /** 视频元素 */
  private videoElement: HTMLVideoElement | null = null;
  /** 事件总线 */
  private eventBus: EventBus | null = null;
  /** 渲染器 */
  private renderer: DanmakuRenderer | null = null;
  /** 轨道管理器 */
  private trackManager: DanmakuTrackManager | null = null;
  /** 弹幕数据列表 */
  private danmakuList: DanmakuItem[] = [];
  /** 当前显示的弹幕 */
  private activeDanmaku = new Map<string, DanmakuItem>();
  /** 配置 */
  private config: DanmakuConfig = {
    enabled: true,
    renderMode: 'canvas' as DanmakuRenderModeEnum,
    density: 'normal' as DanmakuDensityEnum,
    speed: 150,
    opacity: 1,
    fontSizeScale: 1,
    displayArea: 1,
    preventOcclusion: true,
    mergeSimilar: false,
    showBorder: false,
    maxDanmakuCount: 1000,
    maxOverlap: 5,
    sendCooldown: 5,
    historyLimit: 100,
  };
  /** 过滤规则 */
  private filterRules: DanmakuFilterRule[] = [];
  /** 是否暂停 */
  private isPaused = false;
  /** 上次发送时间 */
  private lastSendTime = 0;
  /** 动画帧 ID */
  private animationId: number | null = null;
  /** 统计信息 */
  private stats: DanmakuStats = {
    currentCount: 0,
    totalLoaded: 0,
    filteredCount: 0,
    sentCount: 0,
    renderFPS: 0,
    renderTime: 0,
  };
  /** 弹幕源 */
  private sources: DanmakuSource[] = [];

  /**
   * 安装插件
   */
  install(player: VideoPlayer): void {
    console.log('[DanmakuPlugin] 插件已安装');
    this.initRenderer();
    this.startRenderLoop();
  }

  /**
   * 卸载插件
   */
  uninstall(player: VideoPlayer): void {
    this.destroy();
    console.log('[DanmakuPlugin] 插件已卸载');
  }

  /**
   * 初始化渲染器
   */
  private initRenderer(): void {
    switch (this.config.renderMode) {
      case 'canvas':
        this.renderer = new CanvasDanmakuRenderer(this.config);
        break;
      case 'dom':
        this.renderer = new DomDanmakuRenderer(this.config);
        break;
      case 'webgl':
        this.renderer = new WebGLDanmakuRenderer(this.config);
        break;
    }

    if (this.container && this.renderer) {
      this.renderer.init(this.container);
    }
  }

  /**
   * 开始渲染循环
   */
  private startRenderLoop(): void {
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsTime = lastTime;

    const loop = (currentTime: number) => {
      if (this.isPaused || !this.config.enabled) {
        this.animationId = requestAnimationFrame(loop);
        return;
      }

      const videoTime = this.videoElement?.currentTime || 0;
      const renderStart = performance.now();

      // 获取当前时间应该显示的弹幕
      const visibleDanmaku = this.getVisibleDanmaku(videoTime);

      // 渲染弹幕
      if (this.renderer) {
        this.renderer.render(visibleDanmaku, videoTime);
      }

      // 更新统计
      const renderEnd = performance.now();
      this.stats.renderTime = renderEnd - renderStart;
      this.stats.currentCount = visibleDanmaku.length;

      // 计算 FPS
      frameCount++;
      if (currentTime - lastFpsTime >= 1000) {
        this.stats.renderFPS = frameCount;
        frameCount = 0;
        lastFpsTime = currentTime;
      }

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * 获取当前可见的弹幕
   */
  private getVisibleDanmaku(currentTime: number): DanmakuItem[] {
    // 根据密度和过滤规则筛选弹幕
    const candidates = this.danmakuList.filter((item) => {
      // 时间范围检查
      if (item.time > currentTime || item.time < currentTime - 10) {
        return false;
      }

      // 过滤规则检查
      return this.checkFilter(item);
    });

    // 根据密度限制数量
    const maxCount = this.getMaxCountByDensity();
    return candidates.slice(0, maxCount);
  }

  /**
   * 检查弹幕是否通过过滤
   */
  private checkFilter(danmaku: DanmakuItem): boolean {
    for (const rule of this.filterRules) {
      if (!rule.enabled) continue;

      switch (rule.type) {
        case 'keyword':
          if (danmaku.text.includes(rule.value)) return false;
          break;
        case 'regexp':
          try {
            const regex = new RegExp(rule.value);
            if (regex.test(danmaku.text)) return false;
          } catch {
            // 忽略无效正则
          }
          break;
        case 'user':
          if (danmaku.senderId === rule.value) return false;
          break;
        case 'color':
          if (danmaku.color === rule.value) return false;
          break;
      }
    }
    return true;
  }

  /**
   * 根据密度获取最大弹幕数
   */
  private getMaxCountByDensity(): number {
    const baseCount = this.container
      ? Math.floor(this.container.clientHeight / 30) * this.config.maxOverlap
      : 100;

    switch (this.config.density) {
      case 'unlimited':
        return Infinity;
      case 'high':
        return baseCount;
      case 'normal':
        return Math.floor(baseCount * 0.6);
      case 'low':
        return Math.floor(baseCount * 0.3);
      case 'none':
        return 0;
      default:
        return baseCount;
    }
  }

  /**
   * 加载弹幕数据
   */
  loadDanmaku(danmakuList: DanmakuItem[]): void {
    this.danmakuList = danmakuList.sort((a, b) => a.time - b.time);
    this.stats.totalLoaded = danmakuList.length;
    this.eventBus?.emit('danmaku:loaded', { count: danmakuList.length });
  }

  /**
   * 添加单条弹幕
   */
  addDanmaku(danmaku: DanmakuItem): void {
    this.danmakuList.push(danmaku);
    this.danmakuList.sort((a, b) => a.time - b.time);
    this.stats.totalLoaded++;
    this.eventBus?.emit('danmaku:add', danmaku);
  }

  /**
   * 发送弹幕
   */
  sendDanmaku(data: DanmakuSendData): boolean {
    // 检查冷却时间
    const now = Date.now();
    if (now - this.lastSendTime < this.config.sendCooldown * 1000) {
      console.warn('[DanmakuPlugin] 发送过于频繁，请稍后再试');
      return false;
    }

    // 检查内容长度
    if (data.text.length > 100) {
      console.warn('[DanmakuPlugin] 弹幕内容过长');
      return false;
    }

    const danmaku: DanmakuItem = {
      id: `self_${now}`,
      text: data.text,
      time: data.time ?? (this.videoElement?.currentTime || 0),
      type: data.type,
      color: data.color,
      fontSize: data.fontSize,
      isSelf: true,
      createdAt: now,
    };

    // 添加到列表
    this.addDanmaku(danmaku);

    // 立即显示
    if (this.renderer) {
      this.renderer.render([...this.getVisibleDanmaku(this.videoElement?.currentTime || 0), danmaku], this.videoElement?.currentTime || 0);
    }

    this.lastSendTime = now;
    this.stats.sentCount++;
    this.eventBus?.emit('danmaku:send', danmaku);

    return true;
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<DanmakuConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    // 如果渲染模式改变，重新初始化
    if (config.renderMode && config.renderMode !== oldConfig.renderMode) {
      this.renderer?.destroy();
      this.initRenderer();
    }

    // 通知配置改变
    this.eventBus?.emit('danmaku:configchange', this.config);
  }

  /**
   * 获取配置
   */
  getConfig(): DanmakuConfig {
    return { ...this.config };
  }

  /**
   * 显示/隐藏弹幕
   */
  toggle(enabled?: boolean): boolean {
    this.config.enabled = enabled !== undefined ? enabled : !this.config.enabled;
    this.eventBus?.emit(this.config.enabled ? 'danmaku:show' : 'danmaku:hide', {});
    return this.config.enabled;
  }

  /**
   * 设置弹幕密度
   */
  setDensity(density: DanmakuDensityEnum): void {
    this.config.density = density;
    this.eventBus?.emit('danmaku:densitychange', { density });
  }

  /**
   * 设置弹幕速度
   */
  setSpeed(speed: number): void {
    this.config.speed = speed;
    this.eventBus?.emit('danmaku:speedchange', { speed });
  }

  /**
   * 设置弹幕透明度
   */
  setOpacity(opacity: number): void {
    this.config.opacity = Math.max(0, Math.min(1, opacity));
    this.eventBus?.emit('danmaku:opacitychange', { opacity: this.config.opacity });
  }

  /**
   * 设置弹幕字体大小
   */
  setFontSizeScale(scale: number): void {
    this.config.fontSizeScale = Math.max(0.5, Math.min(2, scale));
    this.eventBus?.emit('danmaku:fontsizechange', { scale: this.config.fontSizeScale });
  }

  /**
   * 添加过滤规则
   */
  addFilterRule(rule: DanmakuFilterRule): void {
    this.filterRules.push(rule);
    this.stats.filteredCount = this.calculateFilteredCount();
  }

  /**
   * 移除过滤规则
   */
  removeFilterRule(ruleId: string): void {
    this.filterRules = this.filterRules.filter((r) => r.id !== ruleId);
    this.stats.filteredCount = this.calculateFilteredCount();
  }

  /**
   * 计算被过滤的弹幕数
   */
  private calculateFilteredCount(): number {
    return this.danmakuList.filter((item) => !this.checkFilter(item)).length;
  }

  /**
   * 清空弹幕
   */
  clear(): void {
    this.danmakuList = [];
    this.activeDanmaku.clear();
    this.renderer?.clear();
    this.stats.totalLoaded = 0;
    this.stats.filteredCount = 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): DanmakuStats {
    return { ...this.stats };
  }

  /**
   * 暂停弹幕
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * 恢复弹幕
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * 调整大小
   */
  resize(width: number, height: number): void {
    this.renderer?.resize(width, height);
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.renderer?.destroy();
    this.renderer = null;
    this.clear();
  }
}

/**
 * Canvas 弹幕渲染器
 */
class CanvasDanmakuRenderer implements DanmakuRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private config: DanmakuConfig;

  constructor(config: DanmakuConfig) {
    this.config = config;
  }

  init(container: HTMLElement): void {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resize(container.clientWidth, container.clientHeight);
  }

  render(danmakuList: DanmakuItem[], currentTime: number): void {
    if (!this.ctx || !this.canvas) return;

    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 设置全局透明度
    this.ctx.globalAlpha = this.config.opacity;

    // 渲染每条弹幕
    danmakuList.forEach((danmaku) => {
      this.renderDanmaku(danmaku, currentTime);
    });
  }

  private renderDanmaku(danmaku: DanmakuItem, currentTime: number): void {
    if (!this.ctx || !this.canvas) return;

    const elapsed = currentTime - danmaku.time;
    const fontSize = (danmaku.fontSize === 1 ? 18 : danmaku.fontSize === 2 ? 25 : 36) * this.config.fontSizeScale;

    this.ctx.font = `${fontSize}px Microsoft YaHei, sans-serif`;
    this.ctx.fillStyle = danmaku.color;
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;

    // 计算位置
    let x: number;
    let y: number;

    if (danmaku.type === 'scroll') {
      // 滚动弹幕
      const progress = elapsed * this.config.speed;
      x = this.canvas.width - progress;
      y = danmaku.position?.y ?? Math.random() * this.canvas.height * this.config.displayArea;
    } else if (danmaku.type === 'top') {
      // 顶部固定
      x = (this.canvas.width - this.ctx.measureText(danmaku.text).width) / 2;
      y = danmaku.position?.y ?? 50;
    } else if (danmaku.type === 'bottom') {
      // 底部固定
      x = (this.canvas.width - this.ctx.measureText(danmaku.text).width) / 2;
      y = danmaku.position?.y ?? this.canvas.height - 50;
    } else {
      // 高级弹幕
      x = ((danmaku.position?.x ?? 50) / 100) * this.canvas.width;
      y = ((danmaku.position?.y ?? 50) / 100) * this.canvas.height;
    }

    // 绘制文字描边
    if (this.config.showBorder) {
      this.ctx.strokeText(danmaku.text, x, y);
    }

    // 绘制文字
    this.ctx.fillText(danmaku.text, x, y);
  }

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  clear(): void {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  destroy(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }
}

/**
 * DOM 弹幕渲染器
 */
class DomDanmakuRenderer implements DanmakuRenderer {
  private container: HTMLElement | null = null;
  private config: DanmakuConfig;
  private danmakuElements = new Map<string, HTMLElement>();

  constructor(config: DanmakuConfig) {
    this.config = config;
  }

  init(container: HTMLElement): void {
    this.container = container;
  }

  render(danmakuList: DanmakuItem[], currentTime: number): void {
    if (!this.container) return;

    // 移除不在列表中的元素
    this.danmakuElements.forEach((el, id) => {
      if (!danmakuList.find((d) => d.id === id)) {
        el.remove();
        this.danmakuElements.delete(id);
      }
    });

    // 添加新弹幕
    danmakuList.forEach((danmaku) => {
      if (!this.danmakuElements.has(danmaku.id)) {
        this.createDanmakuElement(danmaku);
      }
    });
  }

  private createDanmakuElement(danmaku: DanmakuItem): void {
    if (!this.container) return;

    const el = document.createElement('div');
    el.textContent = danmaku.text;
    el.style.position = 'absolute';
    el.style.color = danmaku.color;
    el.style.fontSize = `${(danmaku.fontSize === 1 ? 18 : danmaku.fontSize === 2 ? 25 : 36) * this.config.fontSizeScale}px`;
    el.style.whiteSpace = 'nowrap';
    el.style.pointerEvents = 'none';
    el.style.opacity = String(this.config.opacity);
    el.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';

    if (danmaku.type === 'scroll') {
      el.style.animation = `danmaku-scroll ${10 / this.config.speed}s linear`;
    }

    this.container.appendChild(el);
    this.danmakuElements.set(danmaku.id, el);
  }

  resize(): void {
    // DOM 渲染器自动适应容器大小
  }

  clear(): void {
    this.danmakuElements.forEach((el) => el.remove());
    this.danmakuElements.clear();
  }

  destroy(): void {
    this.clear();
    this.container = null;
  }
}

/**
 * WebGL 弹幕渲染器（占位，需要额外实现）
 */
class WebGLDanmakuRenderer implements DanmakuRenderer {
  init(): void {
    console.warn('[WebGLDanmakuRenderer] WebGL renderer not implemented yet');
  }

  render(): void {}

  resize(): void {}

  clear(): void {}

  destroy(): void {}
}

/**
 * 创建弹幕插件
 */
export function createDanmakuPlugin(): DanmakuPlugin {
  return new DanmakuPlugin();
}
```

---

## 十一、字幕插件系统设计

### 11.1 字幕类型枚举

#### 文件: `packages/player/src/plugins/subtitle/enums.ts`

```typescript
/**
 * 字幕格式枚举
 */
export enum SubtitleFormatEnum {
  /** SRT 格式 */
  SRT = 'SRT',
  /** VTT 格式 */
  VTT = 'VTT',
  /** ASS/SSA 格式 */
  ASS = 'ASS',
  /** SSA 格式 */
  SSA = 'SSA',
  /** TTML 格式 */
  TTML = 'TTML',
  /** JSON 格式 */
  JSON = 'JSON',
  /** 未知格式 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 字幕事件枚举
 */
export enum SubtitleEventEnum {
  /** 字幕加载完成 */
  LOADED = 'LOADED',
  /** 字幕加载错误 */
  ERROR = 'ERROR',
  /** 字幕显示 */
  SHOW = 'SHOW',
  /** 字幕隐藏 */
  HIDE = 'HIDE',
  /** 字幕切换 */
  SWITCH = 'SWITCH',
  /** 字幕样式改变 */
  STYLE_CHANGE = 'STYLE_CHANGE',
  /** 字幕偏移改变 */
  OFFSET_CHANGE = 'OFFSET_CHANGE',
  /** 字幕字体大小改变 */
  FONTSIZE_CHANGE = 'FONTSIZE_CHANGE',
}

/**
 * 字幕位置枚举
 */
export enum SubtitlePositionEnum {
  /** 底部居中 */
  BOTTOM_CENTER = 'BOTTOM_CENTER',
  /** 底部左对齐 */
  BOTTOM_LEFT = 'BOTTOM_LEFT',
  /** 底部右对齐 */
  BOTTOM_RIGHT = 'BOTTOM_RIGHT',
  /** 顶部居中 */
  TOP_CENTER = 'TOP_CENTER',
  /** 顶部左对齐 */
  TOP_LEFT = 'TOP_LEFT',
  /** 顶部右对齐 */
  TOP_RIGHT = 'TOP_RIGHT',
  /** 中间居中 */
  CENTER = 'CENTER',
}

/**
 * 字幕编码枚举
 */
export enum SubtitleEncodingEnum {
  /** UTF-8 */
  UTF8 = 'UTF8',
  /** GBK */
  GBK = 'GBK',
  /** GB2312 */
  GB2312 = 'GB2312',
  /** BIG5 */
  BIG5 = 'BIG5',
  /** Shift-JIS */
  SHIFT_JIS = 'SHIFT_JIS',
  /** EUC-KR */
  EUC_KR = 'EUC_KR',
  /** ISO-8859-1 */
  ISO88591 = 'ISO88591',
}
```

### 11.2 字幕数据接口

#### 文件: `packages/player/src/plugins/subtitle/types.ts`

```typescript
import type { SubtitleFormatEnum, SubtitlePositionEnum, SubtitleEncodingEnum } from './enums';

/**
 * 单条字幕数据接口
 */
export interface SubtitleItem {
  /** 字幕 ID */
  id: string;
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 字幕文本内容 */
  text: string;
  /** 字幕样式（ASS/SSA 格式） */
  style?: SubtitleStyle;
  /** 字幕位置 */
  position?: SubtitlePositionEnum;
}

/**
 * 字幕样式接口
 */
export interface SubtitleStyle {
  /** 字体名称 */
  fontFamily?: string;
  /** 字体大小（px） */
  fontSize?: number;
  /** 字体颜色 */
  color?: string;
  /** 背景颜色 */
  backgroundColor?: string;
  /** 字体粗细 */
  fontWeight?: 'normal' | 'bold';
  /** 字体样式 */
  fontStyle?: 'normal' | 'italic';
  /** 文字描边颜色 */
  textStrokeColor?: string;
  /** 文字描边宽度（px） */
  textStrokeWidth?: number;
  /** 文字阴影 */
  textShadow?: string;
  /** 文字对齐方式 */
  textAlign?: 'left' | 'center' | 'right';
  /** 行高 */
  lineHeight?: number;
  /** 字间距 */
  letterSpacing?: number;
}

/**
 * 字幕轨道接口
 */
export interface SubtitleTrack {
  /** 轨道 ID */
  id: string;
  /** 轨道名称 */
  name: string;
  /** 语言代码 */
  language: string;
  /** 轨道类型 */
  kind: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata';
  /** 是否默认 */
  isDefault: boolean;
  /** 字幕源地址 */
  src?: string;
  /** 字幕格式 */
  format?: SubtitleFormatEnum;
  /** 字幕编码 */
  encoding?: SubtitleEncodingEnum;
  /** 字幕数据（已加载） */
  data?: SubtitleItem[];
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 字幕配置接口
 */
export interface SubtitleConfig {
  /** 是否启用字幕 */
  enabled: boolean;
  /** 默认语言 */
  defaultLanguage: string;
  /** 字体大小（px） */
  fontSize: number;
  /** 字体颜色 */
  color: string;
  /** 背景颜色 */
  backgroundColor: string;
  /** 背景透明度（0-1） */
  backgroundOpacity: number;
  /** 字幕位置 */
  position: SubtitlePositionEnum;
  /** 字幕偏移（秒，正数延迟，负数提前） */
  offset: number;
  /** 是否启用描边 */
  enableStroke: boolean;
  /** 描边颜色 */
  strokeColor: string;
  /** 描边宽度（px） */
  strokeWidth: number;
  /** 是否启用阴影 */
  enableShadow: boolean;
  /** 阴影颜色 */
  shadowColor: string;
  /** 阴影模糊半径 */
  shadowBlur: number;
  /** 行数限制 */
  maxLines: number;
  /** 底部边距（px） */
  bottomMargin: number;
}

/**
 * 字幕解析结果接口
 */
export interface SubtitleParseResult {
  /** 解析是否成功 */
  success: boolean;
  /** 字幕数据 */
  data?: SubtitleItem[];
  /** 错误信息 */
  error?: string;
  /** 字幕格式 */
  format?: SubtitleFormatEnum;
  /** 原始内容 */
  rawContent?: string;
}

/**
 * 字幕搜索选项接口
 */
export interface SubtitleSearchOptions {
  /** 视频标题 */
  title?: string;
  /** 视频哈希 */
  hash?: string;
  /** 文件大小 */
  fileSize?: number;
  /** 语言代码 */
  language?: string;
  /** 字幕格式 */
  format?: SubtitleFormatEnum;
}

/**
 * 字幕搜索结果接口
 */
export interface SubtitleSearchResult {
  /** 字幕 ID */
  id: string;
  /** 字幕名称 */
  name: string;
  /** 语言代码 */
  language: string;
  /** 字幕格式 */
  format: SubtitleFormatEnum;
  /** 下载地址 */
  downloadUrl: string;
  /** 评分 */
  rating: number;
  /** 下载次数 */
  downloadCount: number;
  /** 上传者 */
  uploader: string;
  /** 上传时间 */
  uploadTime: string;
}
```

### 11.3 字幕解析器

#### 文件: `packages/player/src/plugins/subtitle/parsers.ts`

```typescript
import type { SubtitleItem, SubtitleParseResult, SubtitleFormatEnum } from './types';

/**
 * 字幕解析器接口
 */
export interface SubtitleParser {
  /** 解析字幕内容 */
  parse(content: string): SubtitleParseResult;
  /** 支持的格式 */
  format: SubtitleFormatEnum;
}

/**
 * SRT 字幕解析器
 */
export class SrtParser implements SubtitleParser {
  format = 'srt' as SubtitleFormatEnum;

  parse(content: string): SubtitleParseResult {
    const items: SubtitleItem[] = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      const id = lines[0].trim();
      const timeLine = lines[1].trim();
      const text = lines.slice(2).join('\n');

      const timeMatch = timeLine.match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
      );

      if (!timeMatch) continue;

      const startTime =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;

      const endTime =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;

      items.push({
        id,
        startTime,
        endTime,
        text: this.cleanText(text),
      });
    }

    return {
      success: true,
      data: items,
      format: this.format,
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '') // 移除 HTML 标签
      .replace(/\{[^}]+\}/g, '') // 移除 ASS 样式标签
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }
}

/**
 * VTT 字幕解析器
 */
export class VttParser implements SubtitleParser {
  format = 'vtt' as SubtitleFormatEnum;

  parse(content: string): SubtitleParseResult {
    const items: SubtitleItem[] = [];
    const lines = content.trim().split('\n');

    // 跳过 WEBVTT 头
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('WEBVTT')) {
        startIndex = i + 1;
        break;
      }
    }

    let currentItem: Partial<SubtitleItem> = {};
    let textLines: string[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '') {
        if (currentItem.startTime !== undefined && textLines.length > 0) {
          items.push({
            id: currentItem.id || String(items.length + 1),
            startTime: currentItem.startTime,
            endTime: currentItem.endTime || currentItem.startTime,
            text: this.cleanText(textLines.join('\n')),
          });
        }
        currentItem = {};
        textLines = [];
        continue;
      }

      const timeMatch = line.match(
        /(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/
      );

      if (timeMatch) {
        const startHours = timeMatch[1] ? parseInt(timeMatch[1]) : 0;
        const startMinutes = parseInt(timeMatch[2]);
        const startSeconds = parseInt(timeMatch[3]);
        const startMs = parseInt(timeMatch[4]);

        const endHours = timeMatch[5] ? parseInt(timeMatch[5]) : 0;
        const endMinutes = parseInt(timeMatch[6]);
        const endSeconds = parseInt(timeMatch[7]);
        const endMs = parseInt(timeMatch[8]);

        currentItem.startTime =
          startHours * 3600 + startMinutes * 60 + startSeconds + startMs / 1000;
        currentItem.endTime =
          endHours * 3600 + endMinutes * 60 + endSeconds + endMs / 1000;
      } else if (currentItem.startTime !== undefined) {
        textLines.push(line);
      } else {
        currentItem.id = line;
      }
    }

    // 处理最后一个字幕
    if (currentItem.startTime !== undefined && textLines.length > 0) {
      items.push({
        id: currentItem.id || String(items.length + 1),
        startTime: currentItem.startTime,
        endTime: currentItem.endTime || currentItem.startTime,
        text: this.cleanText(textLines.join('\n')),
      });
    }

    return {
      success: true,
      data: items,
      format: this.format,
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }
}

/**
 * ASS/SSA 字幕解析器
 */
export class AssParser implements SubtitleParser {
  format = 'ass' as SubtitleFormatEnum;

  parse(content: string): SubtitleParseResult {
    const items: SubtitleItem[] = [];
    const lines = content.split('\n');

    let inEventsSection = false;
    let formatLine: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === '[Events]') {
        inEventsSection = true;
        continue;
      }

      if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        inEventsSection = false;
        continue;
      }

      if (inEventsSection) {
        if (trimmedLine.startsWith('Format:')) {
          formatLine = trimmedLine
            .replace('Format:', '')
            .split(',')
            .map((s) => s.trim());
        } else if (trimmedLine.startsWith('Dialogue:')) {
          const dialogueData = trimmedLine.replace('Dialogue:', '').split(',');

          const startTimeIdx = formatLine.indexOf('Start');
          const endTimeIdx = formatLine.indexOf('End');
          const textIdx = formatLine.indexOf('Text');

          if (startTimeIdx >= 0 && endTimeIdx >= 0 && textIdx >= 0) {
            const startTime = this.parseAssTime(dialogueData[startTimeIdx]);
            const endTime = this.parseAssTime(dialogueData[endTimeIdx]);
            const text = dialogueData
              .slice(textIdx)
              .join(',')
              .replace(/\{[^}]+\}/g, '') // 移除 ASS 样式标签
              .replace(/\\N/g, '\n') // 转换换行
              .replace(/\\n/g, '\n');

            items.push({
              id: String(items.length + 1),
              startTime,
              endTime,
              text: text.trim(),
            });
          }
        }
      }
    }

    return {
      success: true,
      data: items,
      format: this.format,
    };
  }

  private parseAssTime(timeStr: string): number {
    const match = timeStr.trim().match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
    if (!match) return 0;

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const centiseconds = parseInt(match[4]);

    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }
}

/**
 * 字幕解析器工厂
 */
export class SubtitleParserFactory {
  private static parsers = new Map<SubtitleFormatEnum, SubtitleParser>([
    ['srt' as SubtitleFormatEnum, new SrtParser()],
    ['vtt' as SubtitleFormatEnum, new VttParser()],
    ['ass' as SubtitleFormatEnum, new AssParser()],
  ]);

  /**
   * 获取解析器
   */
  static getParser(format: SubtitleFormatEnum): SubtitleParser | null {
    return this.parsers.get(format) || null;
  }

  /**
   * 根据文件扩展名检测格式
   */
  static detectFormat(filename: string): SubtitleFormatEnum | null {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'srt':
        return 'srt' as SubtitleFormatEnum;
      case 'vtt':
        return 'vtt' as SubtitleFormatEnum;
      case 'ass':
      case 'ssa':
        return 'ass' as SubtitleFormatEnum;
      case 'ttml':
      case 'xml':
        return 'ttml' as SubtitleFormatEnum;
      case 'json':
        return 'json' as SubtitleFormatEnum;
      default:
        return null;
    }
  }

  /**
   * 解析字幕内容（自动检测格式）
   */
  static parse(content: string, format?: SubtitleFormatEnum): SubtitleParseResult {
    if (format) {
      const parser = this.getParser(format);
      if (parser) {
        return parser.parse(content);
      }
      return {
        success: false,
        error: `不支持的格式: ${format}`,
      };
    }

    // 尝试自动检测格式
    if (content.trim().startsWith('WEBVTT')) {
      return this.getParser('vtt' as SubtitleFormatEnum)!.parse(content);
    } else if (content.includes('[Script Info]')) {
      return this.getParser('ass' as SubtitleFormatEnum)!.parse(content);
    } else if (/^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}/m.test(content)) {
      return this.getParser('srt' as SubtitleFormatEnum)!.parse(content);
    }

    return {
      success: false,
      error: '无法自动检测字幕格式',
    };
  }
}
```

### 11.4 字幕插件

#### 文件: `packages/player/src/plugins/subtitle/SubtitlePlugin.ts`

```typescript
import type { Plugin } from '@/core/plugin';
import type { VideoPlayer } from '@/player';
import type {
  SubtitleItem,
  SubtitleTrack,
  SubtitleConfig,
  SubtitleParseResult,
  SubtitleStyle,
} from './types';
import type { SubtitleFormatEnum, SubtitlePositionEnum, SubtitleEncodingEnum } from './enums';
import type { EventBus } from '@/core/plugin';
import { SubtitleParserFactory } from './parsers';

/**
 * 字幕插件
 * 提供字幕加载、显示、管理功能
 */
export class SubtitlePlugin implements Plugin {
  readonly name = 'subtitle';
  readonly version = '1.0.0';
  readonly description = 'Subtitle plugin for video player';

  /** 字幕容器元素 */
  private container: HTMLElement | null = null;
  /** 视频元素 */
  private videoElement: HTMLVideoElement | null = null;
  /** 事件总线 */
  private eventBus: EventBus | null = null;
  /** 字幕轨道列表 */
  private tracks: SubtitleTrack[] = [];
  /** 当前激活的轨道 */
  private activeTrack: SubtitleTrack | null = null;
  /** 当前显示的字幕元素 */
  private subtitleElement: HTMLElement | null = null;
  /** 配置 */
  private config: SubtitleConfig = {
    enabled: true,
    defaultLanguage: 'zh-CN',
    fontSize: 24,
    color: '#ffffff',
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    position: 'bottom-center' as SubtitlePositionEnum,
    offset: 0,
    enableStroke: true,
    strokeColor: '#000000',
    strokeWidth: 2,
    enableShadow: true,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 4,
    maxLines: 2,
    bottomMargin: 60,
  };
  /** 当前显示的字幕 */
  private currentSubtitle: SubtitleItem | null = null;
  /** 字幕检查定时器 */
  private checkInterval: number | null = null;

  /**
   * 安装插件
   */
  install(player: VideoPlayer): void {
    console.log('[SubtitlePlugin] 插件已安装');
    this.createSubtitleElement();
    this.startSubtitleCheck();
  }

  /**
   * 卸载插件
   */
  uninstall(player: VideoPlayer): void {
    this.destroy();
    console.log('[SubtitlePlugin] 插件已卸载');
  }

  /**
   * 创建字幕元素
   */
  private createSubtitleElement(): void {
    if (!this.container) return;

    this.subtitleElement = document.createElement('div');
    this.subtitleElement.className = 'player-subtitle';
    this.subtitleElement.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      pointer-events: none;
      z-index: 100;
      max-width: 90%;
      word-wrap: break-word;
      white-space: pre-wrap;
    `;

    this.updateSubtitleStyle();
    this.updateSubtitlePosition();

    this.container.appendChild(this.subtitleElement);
  }

  /**
   * 更新字幕样式
   */
  private updateSubtitleStyle(): void {
    if (!this.subtitleElement) return;

    const style = this.subtitleElement.style;
    style.fontSize = `${this.config.fontSize}px`;
    style.color = this.config.color;
    style.fontFamily = 'Microsoft YaHei, PingFang SC, sans-serif';
    style.lineHeight = '1.5';

    // 描边
    if (this.config.enableStroke) {
      style.webkitTextStroke = `${this.config.strokeWidth}px ${this.config.strokeColor}`;
    } else {
      style.webkitTextStroke = 'none';
    }

    // 阴影
    if (this.config.enableShadow) {
      style.textShadow = `0 2px ${this.config.shadowBlur}px ${this.config.shadowColor}`;
    } else {
      style.textShadow = 'none';
    }

    // 背景
    if (this.config.backgroundOpacity > 0) {
      const rgb = this.hexToRgb(this.config.backgroundColor);
      style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.config.backgroundOpacity})`;
      style.padding = '4px 8px';
      style.borderRadius = '4px';
    } else {
      style.backgroundColor = 'transparent';
      style.padding = '0';
    }
  }

  /**
   * 更新字幕位置
   */
  private updateSubtitlePosition(): void {
    if (!this.subtitleElement || !this.container) return;

    const style = this.subtitleElement.style;
    const containerHeight = this.container.clientHeight;

    switch (this.config.position) {
      case 'bottom-center':
        style.bottom = `${this.config.bottomMargin}px`;
        style.top = 'auto';
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      case 'bottom-left':
        style.bottom = `${this.config.bottomMargin}px`;
        style.top = 'auto';
        style.left = '20px';
        style.transform = 'none';
        break;
      case 'bottom-right':
        style.bottom = `${this.config.bottomMargin}px`;
        style.top = 'auto';
        style.left = 'auto';
        style.right = '20px';
        style.transform = 'none';
        break;
      case 'top-center':
        style.top = '20px';
        style.bottom = 'auto';
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      case 'top-left':
        style.top = '20px';
        style.bottom = 'auto';
        style.left = '20px';
        style.transform = 'none';
        break;
      case 'top-right':
        style.top = '20px';
        style.bottom = 'auto';
        style.left = 'auto';
        style.right = '20px';
        style.transform = 'none';
        break;
      case 'center':
        style.top = '50%';
        style.bottom = 'auto';
        style.left = '50%';
        style.transform = 'translate(-50%, -50%)';
        break;
    }
  }

  /**
   * 开始字幕检查循环
   */
  private startSubtitleCheck(): void {
    this.checkInterval = window.setInterval(() => {
      this.updateCurrentSubtitle();
    }, 100); // 每 100ms 检查一次
  }

  /**
   * 更新当前显示的字幕
   */
  private updateCurrentSubtitle(): void {
    if (!this.config.enabled || !this.activeTrack?.data || !this.videoElement) {
      this.hideSubtitle();
      return;
    }

    const currentTime = this.videoElement.currentTime + this.config.offset;

    // 查找当前时间应该显示的字幕
    const subtitle = this.activeTrack.data.find(
      (item) => currentTime >= item.startTime && currentTime <= item.endTime
    );

    if (subtitle && subtitle.id !== this.currentSubtitle?.id) {
      this.showSubtitle(subtitle);
    } else if (!subtitle && this.currentSubtitle) {
      this.hideSubtitle();
    }
  }

  /**
   * 显示字幕
   */
  private showSubtitle(subtitle: SubtitleItem): void {
    if (!this.subtitleElement) return;

    this.currentSubtitle = subtitle;
    this.subtitleElement.textContent = subtitle.text;
    this.subtitleElement.style.opacity = '1';

    this.eventBus?.emit('subtitle:show', subtitle);
  }

  /**
   * 隐藏字幕
   */
  private hideSubtitle(): void {
    if (!this.subtitleElement || !this.currentSubtitle) return;

    this.currentSubtitle = null;
    this.subtitleElement.style.opacity = '0';

    this.eventBus?.emit('subtitle:hide', {});
  }

  /**
   * 添加字幕轨道
   */
  addTrack(track: SubtitleTrack): void {
    this.tracks.push(track);

    // 如果是默认轨道，自动加载
    if (track.isDefault && track.enabled) {
      this.switchTrack(track.id);
    }
  }

  /**
   * 移除字幕轨道
   */
  removeTrack(trackId: string): void {
    this.tracks = this.tracks.filter((t) => t.id !== trackId);

    if (this.activeTrack?.id === trackId) {
      this.activeTrack = null;
      this.hideSubtitle();
    }
  }

  /**
   * 切换字幕轨道
   */
  async switchTrack(trackId: string): Promise<boolean> {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) {
      console.error(`[SubtitlePlugin] 未找到轨道: ${trackId}`);
      return false;
    }

    // 如果已有数据，直接切换
    if (track.data) {
      this.activeTrack = track;
      this.eventBus?.emit('subtitle:switch', { track });
      return true;
    }

    // 需要从 URL 加载
    if (track.src) {
      try {
        const response = await fetch(track.src);
        const content = await response.text();

        const result = SubtitleParserFactory.parse(content, track.format || undefined);

        if (result.success && result.data) {
          track.data = result.data;
          this.activeTrack = track;
          this.eventBus?.emit('subtitle:loaded', { track, count: result.data.length });
          this.eventBus?.emit('subtitle:switch', { track });
          return true;
        } else {
          this.eventBus?.emit('subtitle:error', {
            track,
            error: result.error || '解析失败',
          });
          return false;
        }
      } catch (error) {
        this.eventBus?.emit('subtitle:error', {
          track,
          error: error instanceof Error ? error.message : '加载失败',
        });
        return false;
      }
    }

    return false;
  }

  /**
   * 加载字幕文件
   */
  async loadSubtitle(
    src: string,
    format?: SubtitleFormatEnum,
    encoding?: SubtitleEncodingEnum
  ): Promise<SubtitleParseResult> {
    try {
      const response = await fetch(src);
      let content = await response.text();

      // 如果需要转码
      if (encoding && encoding !== 'utf-8') {
        content = await this.decodeText(content, encoding);
      }

      const result = SubtitleParserFactory.parse(content, format);

      if (result.success) {
        this.eventBus?.emit('subtitle:loaded', {
          count: result.data?.length,
          format: result.format,
        });
      } else {
        this.eventBus?.emit('subtitle:error', { error: result.error });
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '加载失败';
      this.eventBus?.emit('subtitle:error', { error: errorMsg });
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * 文本解码
   */
  private async decodeText(content: string, encoding: SubtitleEncodingEnum): Promise<string> {
    // 使用 TextDecoder 解码
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      const decoder = new TextDecoder(encoding);
      return decoder.decode(bytes);
    } catch {
      return content;
    }
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<SubtitleConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    // 更新样式
    if (
      config.fontSize !== undefined ||
      config.color !== undefined ||
      config.enableStroke !== undefined ||
      config.strokeColor !== undefined ||
      config.strokeWidth !== undefined ||
      config.enableShadow !== undefined ||
      config.shadowColor !== undefined ||
      config.shadowBlur !== undefined ||
      config.backgroundColor !== undefined ||
      config.backgroundOpacity !== undefined
    ) {
      this.updateSubtitleStyle();
    }

    // 更新位置
    if (config.position !== undefined || config.bottomMargin !== undefined) {
      this.updateSubtitlePosition();
    }

    this.eventBus?.emit('subtitle:stylechange', {
      oldConfig,
      newConfig: this.config,
    });
  }

  /**
   * 获取配置
   */
  getConfig(): SubtitleConfig {
    return { ...this.config };
  }

  /**
   * 显示/隐藏字幕
   */
  toggle(enabled?: boolean): boolean {
    this.config.enabled = enabled !== undefined ? enabled : !this.config.enabled;

    if (!this.config.enabled) {
      this.hideSubtitle();
    }

    this.eventBus?.emit(this.config.enabled ? 'subtitle:show' : 'subtitle:hide', {});
    return this.config.enabled;
  }

  /**
   * 设置字幕偏移
   */
  setOffset(offset: number): void {
    this.config.offset = offset;
    this.eventBus?.emit('subtitle:offsetchange', { offset });
  }

  /**
   * 设置字体大小
   */
  setFontSize(fontSize: number): void {
    this.config.fontSize = fontSize;
    this.updateSubtitleStyle();
    this.eventBus?.emit('subtitle:fontsizechange', { fontSize });
  }

  /**
   * 获取所有轨道
   */
  getTracks(): SubtitleTrack[] {
    return [...this.tracks];
  }

  /**
   * 获取当前轨道
   */
  getActiveTrack(): SubtitleTrack | null {
    return this.activeTrack;
  }

  /**
   * 调整大小
   */
  resize(): void {
    this.updateSubtitlePosition();
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.subtitleElement?.remove();
    this.subtitleElement = null;
    this.activeTrack = null;
    this.tracks = [];
    this.currentSubtitle = null;
  }

  /**
   * 辅助方法：十六进制颜色转 RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }
}

/**
 * 创建字幕插件
 */
export function createSubtitlePlugin(): SubtitlePlugin {
  return new SubtitlePlugin();
}
```

---

## 十二、FLV 插件设计

### 12.1 文件位置
`packages/plugins/src/flv/index.ts`

### 12.2 设计要点
- 基于 flv.js 的 FLV 流媒体播放插件
- 独立插件，单独打包
- 支持直播和点播模式
- 提供缓冲状态查询接口

### 12.3 关键接口
```typescript
interface FlvPluginConfig {
  autoplay?: boolean;
  isLive?: boolean;
  enableStashBuffer?: boolean;
  stashInitialSize?: number;
  lazyLoadMaxDuration?: number;
}

interface FlvPlugin extends Plugin {
  // 缓冲查询
  getBuffered(): TimeRanges | null;
  getBufferLength(): number;
  // 媒体信息
  getMediaInfo(): FlvMediaInfo | null;
  // 销毁
  destroy(): void;
}
```

---

## 十三、HLS 插件设计

### 13.1 文件位置
`packages/plugins/src/hls/index.ts`

### 13.2 设计要点
- 基于 hls.js 的 HLS 流媒体播放插件
- 独立插件，单独打包
- 支持自适应码率切换
- 提供缓冲状态查询接口

### 13.3 关键接口
```typescript
interface HlsPluginConfig {
  autoplay?: boolean;
  initialQuality?: number;
  debug?: boolean;
  maxBufferLength?: number;
  enableWorker?: boolean;
}

interface HlsPlugin extends Plugin {
  // 画质相关
  getQualities(): HlsLevel[];
  setQuality(level: number): void;
  getCurrentQuality(): number;
  // 缓冲查询
  getBuffered(): TimeRanges | null;
  // 销毁
  destroy(): void;
}
```

---

## 十四、DASH 插件设计

### 14.1 文件位置
`packages/plugins/src/dash/index.ts`

### 14.2 设计要点
- 基于 dash.js 的 MPEG-DASH 流媒体播放插件
- 独立插件，单独打包
- 支持低延迟模式
- 提供缓冲状态查询接口

### 14.3 关键接口
```typescript
interface DashPluginConfig {
  autoplay?: boolean;
  initialQuality?: number;
  bufferTime?: number;
  maxBufferTime?: number;
  lowLatencyMode?: boolean;
}

interface DashPlugin extends Plugin {
  // 画质相关
  getQualities(type: 'video' | 'audio'): DashBitrateInfo[];
  setQuality(type: 'video' | 'audio', quality: number): void;
  getCurrentQuality(type: 'video' | 'audio'): number;
  // 缓冲查询
  getBufferLength(type: 'video' | 'audio'): number;
  // 销毁
  destroy(): void;
}
```

---

## 十五、交互插件系统设计

基于既有实现 `d:\hilihili\front\hili-player\player\src\component\rowcmd` 组件的交互功能设计。

### 12.1 交互类型枚举

#### 文件: `packages/player/src/plugins/interaction/enums.ts`

```typescript
/**
 * 交互卡片类型枚举
 */
export enum InteractionCardTypeEnum {
  /** 点赞关注三连 */
  GUIDE_THREE = 'GUIDE_THREE',
  /** 外链视频 */
  LINK = 'LINK',
  /** 投票 */
  VOTE = 'VOTE',
  /** 评分 */
  SCORE = 'SCORE',
}

/**
 * 交互方向枚举
 */
export enum InteractionDirectionEnum {
  /** 垂直方向 */
  VERTICAL = 'VERTICAL',
  /** 水平方向 */
  HORIZONTAL = 'HORIZONTAL',
}

/**
 * 交互位置枚举
 */
export enum InteractionPositionEnum {
  /** 顶部 */
  TOP = 'TOP',
  /** 底部 */
  BOTTOM = 'BOTTOM',
  /** 左侧 */
  LEFT = 'LEFT',
  /** 右侧 */
  RIGHT = 'RIGHT',
}

/**
 * 交互事件枚举
 */
export enum InteractionEventEnum {
  /** 交互卡片添加 */
  CARD_ADD = 'CARD_ADD',
  /** 交互卡片移除 */
  CARD_REMOVE = 'CARD_REMOVE',
  /** 交互卡片更新 */
  CARD_UPDATE = 'CARD_UPDATE',
  /** 交互卡片位置改变 */
  POSITION_CHANGE = 'POSITION_CHANGE',
  /** 交互卡片显示 */
  CARD_SHOW = 'CARD_SHOW',
  /** 交互卡片隐藏 */
  CARD_HIDE = 'CARD_HIDE',
  /** 交互卡片关闭 */
  CARD_CLOSE = 'CARD_CLOSE',
  /** 投票选项添加 */
  VOTE_OPTION_ADD = 'VOTE_OPTION_ADD',
  /** 投票选项移除 */
  VOTE_OPTION_REMOVE = 'VOTE_OPTION_REMOVE',
  /** 投票选项更新 */
  VOTE_OPTION_UPDATE = 'VOTE_OPTION_UPDATE',
  /** 点赞 */
  LIKE = 'LIKE',
  /** 投币 */
  COIN = 'COIN',
  /** 收藏 */
  COLLECT = 'COLLECT',
  /** 关注 */
  FOLLOW = 'FOLLOW',
  /** 取消关注 */
  UNFOLLOW = 'UNFOLLOW',
  /** 投票 */
  VOTE = 'VOTE',
  /** 评分 */
  SCORE = 'SCORE',
  /** 稍后再看 */
  WATCH_LATER = 'WATCH_LATER',
  /** 链接点击 */
  LINK_CLICK = 'LINK_CLICK',
}

/**
 * 三连类型枚举
 */
export enum GuideThreeTypeEnum {
  /** 显示点赞关注和三连 */
  ALL = 1,
  /** 只显示关注 */
  FOLLOW_ONLY = 2,
  /** 只显示三连 */
  GUIDE_ONLY = 3,
}

/**
 * 评分类型枚举
 */
export enum ScoreTypeEnum {
  /** 星星 */
  STAR = 1,
  /** 爱心 */
  LOVE = 2,
  /** 柠檬 */
  LEMON = 3,
}

/**
 * 交互状态枚举
 */
export enum InteractionStatusEnum {
  /** 隐藏 */
  HIDDEN = 'HIDDEN',
  /** 显示中 */
  VISIBLE = 'VISIBLE',
  /** 关闭动画中 */
  CLOSING = 'CLOSING',
  /** 已关闭 */
  CLOSED = 'CLOSED',
}
```

### 12.2 交互数据接口

#### 文件: `packages/player/src/plugins/interaction/types.ts`

```typescript
import type { InteractionCardTypeEnum, GuideThreeTypeEnum, ScoreTypeEnum, InteractionStatusEnum } from './enums';

/**
 * 基础交互卡片接口
 */
export interface BaseInteractionCard {
  /** 卡片唯一 ID */
  id: string;
  /** 视频 ID */
  vid?: number;
  /** 用户 ID */
  uid?: number;
  /** 水平位置（百分比 0-100） */
  left: number;
  /** 垂直位置（百分比 0-100） */
  top: number;
  /** 开始显示时间（秒） */
  timeStart: number;
  /** 结束显示时间（秒） */
  timeEnd: number;
  /** 卡片状态 */
  status?: InteractionStatusEnum;
  /** 关闭时间 */
  closeTime?: number;
  /** 是否已关闭 */
  isClose?: boolean;
}

/**
 * 点赞关注三连交互卡片
 */
export interface GuideThreeCard extends BaseInteractionCard {
  /** 卡片类型 */
  type: InteractionCardTypeEnum.GUIDE_THREE;
  /** 三连类型 */
  guideType: GuideThreeTypeEnum;
  /** 是否已点赞 */
  isLiked?: boolean;
  /** 是否已投币 */
  isCoined?: boolean;
  /** 是否已收藏 */
  isCollected?: boolean;
  /** 是否已关注 */
  isFollowed?: boolean;
}

/**
 * 外链视频交互卡片
 */
export interface LinkCard extends BaseInteractionCard {
  /** 卡片类型 */
  type: InteractionCardTypeEnum.LINK;
  /** 链接地址 */
  linkUrl: string;
  /** 链接内容/标题 */
  linkContent: string;
  /** 图标 URL */
  iconUrl?: string;
}

/**
 * 投票选项接口
 */
export interface VoteOption {
  /** 选项 ID */
  id: string;
  /** 投票 ID */
  voteId?: number;
  /** 选项文本 */
  optionText: string;
  /** 投票数量 */
  voteCount: number;
  /** 是否已投票 */
  isVoted?: boolean;
}

/**
 * 投票交互卡片
 */
export interface VoteCard extends BaseInteractionCard {
  /** 卡片类型 */
  type: InteractionCardTypeEnum.VOTE;
  /** 问题文本 */
  question: string;
  /** 投票选项列表 */
  voteOptions: VoteOption[];
  /** 总投票数 */
  totalVotes?: number;
  /** 是否允许多选 */
  allowMultiple?: boolean;
}

/**
 * 评分交互卡片
 */
export interface ScoreCard extends BaseInteractionCard {
  /** 卡片类型 */
  type: InteractionCardTypeEnum.SCORE;
  /** 评分类型 */
  scoreType: ScoreTypeEnum;
  /** 标题 */
  title: string;
  /** 当前评分值（1-5） */
  currentScore?: number;
  /** 平均评分 */
  averageScore?: number;
  /** 参与人数 */
  participantCount?: number;
  /** 是否已评分 */
  isScored?: boolean;
}

/**
 * 交互卡片联合类型
 */
export type InteractionCard = GuideThreeCard | LinkCard | VoteCard | ScoreCard;

/**
 * 交互配置接口
 */
export interface InteractionConfig {
  /** 是否启用交互功能 */
  enabled: boolean;
  /** 默认卡片持续时间（秒） */
  defaultDuration: number;
  /** 关闭动画持续时间（毫秒） */
  closeAnimationDuration: number;
  /** 最小左边距（百分比） */
  minLeft: number;
  /** 最大左边距（百分比） */
  maxLeft: number;
  /** 最小上边距（百分比） */
  minTop: number;
  /** 最大上边距（百分比） */
  maxTop: number;
  /** 是否启用编辑模式 */
  isEditMode: boolean;
  /** 是否显示对齐辅助线 */
  showGuideLines: boolean;
}

/**
 * 位置改变事件数据
 */
export interface PositionChangeEvent {
  /** 卡片类型 */
  cardType: InteractionCardTypeEnum;
  /** 卡片索引 */
  index: number;
  /** 新的左边距 */
  left: number;
  /** 新的上边距 */
  top: number;
}

/**
 * 交互操作选项接口
 */
export interface InteractionOptions<T> {
  /** 获取数据 */
  get(index?: number): T[] | T;
  /** 添加数据 */
  add(value: T, index?: number): void;
  /** 移除数据 */
  remove(index?: number, subIndex?: number): void;
  /** 更新数据 */
  update(index: number, value: T, subIndex?: number): void;
}

/**
 * 交互卡片容器接口
 */
export interface InteractionCardContainer {
  /** 点赞关注卡片列表 */
  guideThreeList: GuideThreeCard[];
  /** 外链卡片列表 */
  linkList: LinkCard[];
  /** 投票卡片列表 */
  voteList: VoteCard[];
  /** 评分卡片列表 */
  scoreList: ScoreCard[];
}

/**
 * 投票结果接口
 */
export interface VoteResult {
  /** 投票卡片 ID */
  cardId: string;
  /** 选中的选项 ID 列表 */
  selectedOptionIds: string[];
  /** 投票时间 */
  voteTime: number;
}

/**
 * 评分结果接口
 */
export interface ScoreResult {
  /** 评分卡片 ID */
  cardId: string;
  /** 评分值 */
  score: number;
  /** 评分时间 */
  scoreTime: number;
}
```

### 12.3 交互插件

#### 文件: `packages/player/src/plugins/interaction/InteractionPlugin.ts`

```typescript
import type { Plugin } from '@/core/plugin';
import type { VideoPlayer } from '@/player';
import type {
  InteractionCard,
  GuideThreeCard,
  LinkCard,
  VoteCard,
  ScoreCard,
  VoteOption,
  InteractionConfig,
  PositionChangeEvent,
  InteractionCardContainer,
  VoteResult,
  ScoreResult,
} from './types';
import type {
  InteractionCardTypeEnum,
  GuideThreeTypeEnum,
  ScoreTypeEnum,
  InteractionStatusEnum,
} from './enums';
import type { EventBus } from '@/core/plugin';

/**
 * 交互插件
 * 提供视频播放过程中的互动功能（点赞关注、外链、投票、评分）
 */
export class InteractionPlugin implements Plugin {
  readonly name = 'interaction';
  readonly version = '1.0.0';
  readonly description = 'Interaction cards plugin for video player';

  /** 交互容器元素 */
  private container: HTMLElement | null = null;
  /** 视频元素 */
  private videoElement: HTMLVideoElement | null = null;
  /** 事件总线 */
  private eventBus: EventBus | null = null;
  /** 配置 */
  private config: InteractionConfig = {
    enabled: true,
    defaultDuration: 5,
    closeAnimationDuration: 600,
    minLeft: 3,
    maxLeft: 97,
    minTop: 5,
    maxTop: 85,
    isEditMode: false,
    showGuideLines: false,
  };
  /** 交互卡片数据 */
  private cards: InteractionCardContainer = {
    guideThreeList: [],
    linkList: [],
    voteList: [],
    scoreList: [],
  };
  /** 当前视频时间 */
  private currentTime: number = 0;
  /** 对齐辅助线元素 */
  private verticalLineElement: HTMLElement | null = null;
  private horizontalLineElement: HTMLElement | null = null;
  /** 拖拽状态 */
  private isDragging: boolean = false;
  /** 当前拖拽的卡片 */
  private draggingCard: InteractionCard | null = null;

  /**
   * 安装插件
   */
  install(player: VideoPlayer): void {
    console.log('[InteractionPlugin] 插件已安装');
    this.createContainer();
    if (this.config.showGuideLines) {
      this.createGuideLines();
    }
  }

  /**
   * 卸载插件
   */
  uninstall(player: VideoPlayer): void {
    this.destroy();
    console.log('[InteractionPlugin] 插件已卸载');
  }

  /**
   * 创建交互容器
   */
  private createContainer(): void {
    if (!this.container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'player-interaction-wrap';
    wrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      user-select: none;
      z-index: 11;
      overflow: hidden;
    `;

    const inside = document.createElement('div');
    inside.className = 'player-interaction-inside';
    inside.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      box-sizing: border-box;
      padding: 9.5952024%;
      z-index: 10;
    `;

    wrapper.appendChild(inside);
    this.container.appendChild(wrapper);
  }

  /**
   * 创建对齐辅助线
   */
  private createGuideLines(): void {
    const inside = this.container?.querySelector('.player-interaction-inside');
    if (!inside) return;

    // 垂直辅助线
    this.verticalLineElement = document.createElement('div');
    this.verticalLineElement.className = 'interaction-guide-line-vertical';
    this.verticalLineElement.style.cssText = `
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 1px;
      height: 100%;
      background: #858688;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 100;
    `;

    // 水平辅助线
    this.horizontalLineElement = document.createElement('div');
    this.horizontalLineElement.className = 'interaction-guide-line-horizontal';
    this.horizontalLineElement.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      height: 1px;
      background: #858688;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 100;
    `;

    inside.insertBefore(this.verticalLineElement, inside.firstChild);
    inside.insertBefore(this.horizontalLineElement, inside.firstChild);
  }

  /**
   * 添加点赞关注三连卡片
   */
  addGuideThreeCard(card: Omit<GuideThreeCard, 'type'>): GuideThreeCard {
    const fullCard: GuideThreeCard = {
      ...card,
      type: 'guideThree' as InteractionCardTypeEnum.GUIDE_THREE,
      status: 'hidden' as InteractionStatusEnum.HIDDEN,
      isClose: false,
    };

    this.cards.guideThreeList.push(fullCard);
    this.renderGuideThreeCard(fullCard, this.cards.guideThreeList.length - 1);

    this.eventBus?.emit('interaction:cardadd', { card: fullCard });
    return fullCard;
  }

  /**
   * 添加外链卡片
   */
  addLinkCard(card: Omit<LinkCard, 'type'>): LinkCard {
    const fullCard: LinkCard = {
      ...card,
      type: 'link' as InteractionCardTypeEnum.LINK,
      status: 'hidden' as InteractionStatusEnum.HIDDEN,
      isClose: false,
    };

    this.cards.linkList.push(fullCard);
    this.renderLinkCard(fullCard, this.cards.linkList.length - 1);

    this.eventBus?.emit('interaction:cardadd', { card: fullCard });
    return fullCard;
  }

  /**
   * 添加投票卡片
   */
  addVoteCard(card: Omit<VoteCard, 'type'>): VoteCard {
    const fullCard: VoteCard = {
      ...card,
      type: 'vote' as InteractionCardTypeEnum.VOTE,
      status: 'hidden' as InteractionStatusEnum.HIDDEN,
      isClose: false,
    };

    this.cards.voteList.push(fullCard);
    this.renderVoteCard(fullCard, this.cards.voteList.length - 1);

    this.eventBus?.emit('interaction:cardadd', { card: fullCard });
    return fullCard;
  }

  /**
   * 添加评分卡片
   */
  addScoreCard(card: Omit<ScoreCard, 'type'>): ScoreCard {
    const fullCard: ScoreCard = {
      ...card,
      type: 'score' as InteractionCardTypeEnum.SCORE,
      status: 'hidden' as InteractionStatusEnum.HIDDEN,
      isClose: false,
    };

    this.cards.scoreList.push(fullCard);
    this.renderScoreCard(fullCard, this.cards.scoreList.length - 1);

    this.eventBus?.emit('interaction:cardadd', { card: fullCard });
    return fullCard;
  }

  /**
   * 渲染点赞关注三连卡片
   */
  private renderGuideThreeCard(card: GuideThreeCard, index: number): void {
    const inside = this.container?.querySelector('.player-interaction-inside');
    if (!inside) return;

    const cardElement = document.createElement('div');
    cardElement.className = `interaction-card guide-three-card guide-type-${card.guideType}`;
    cardElement.dataset.index = String(index);
    cardElement.dataset.type = 'guideThree';
    cardElement.style.cssText = `
      position: absolute;
      top: ${card.top}%;
      left: ${card.left}%;
      transform: translate(-50%, -50%);
      background: rgba(24, 25, 28, 0.8);
      border-radius: 6px;
      padding: 8px 12px;
      pointer-events: auto;
      display: none;
    `;

    // 根据类型渲染不同内容
    let content = '';
    if (card.guideType === 1 || card.guideType === 3) {
      // 显示三连按钮
      content += `
        <div class="guide-three-actions">
          <button class="action-btn like-btn ${card.isLiked ? 'active' : ''}" data-action="like">
            <span class="icon">👍</span>
            <span>点赞</span>
          </button>
          <button class="action-btn coin-btn ${card.isCoined ? 'active' : ''}" data-action="coin">
            <span class="icon">🪙</span>
            <span>投币</span>
          </button>
          <button class="action-btn collect-btn ${card.isCollected ? 'active' : ''}" data-action="collect">
            <span class="icon">⭐</span>
            <span>收藏</span>
          </button>
        </div>
      `;
    }

    if (card.guideType === 1 || card.guideType === 2) {
      // 显示关注按钮
      content += `
        <div class="follow-action">
          <button class="follow-btn ${card.isFollowed ? 'followed' : ''}" data-action="follow">
            ${card.isFollowed ? '已关注' : '+ 关注'}
          </button>
        </div>
      `;
    }

    cardElement.innerHTML = content;
    inside.appendChild(cardElement);

    // 绑定事件
    this.bindGuideThreeEvents(cardElement, card, index);

    // 编辑模式下启用拖拽
    if (this.config.isEditMode) {
      this.enableDrag(cardElement, card, 'guideThree');
    }
  }

  /**
   * 渲染外链卡片
   */
  private renderLinkCard(card: LinkCard, index: number): void {
    const inside = this.container?.querySelector('.player-interaction-inside');
    if (!inside) return;

    const cardElement = document.createElement('div');
    cardElement.className = 'interaction-card link-card';
    cardElement.dataset.index = String(index);
    cardElement.dataset.type = 'link';
    cardElement.style.cssText = `
      position: absolute;
      top: ${card.top}%;
      left: ${card.left}%;
      transform: translate(-50%, -50%);
      background: rgba(24, 25, 28, 0.9);
      border-radius: 8px;
      padding: 12px;
      pointer-events: auto;
      display: none;
      min-width: 200px;
    `;

    cardElement.innerHTML = `
      <button class="close-btn" data-action="close">×</button>
      <div class="link-content">
        <div class="link-icon"></div>
        <div class="link-text">${card.linkContent}</div>
      </div>
      <div class="link-actions">
        <button class="watch-later-btn" data-action="watchLater">
          <span>⏰</span>
          <span>稍后再看</span>
        </button>
      </div>
    `;

    inside.appendChild(cardElement);

    // 绑定事件
    this.bindLinkEvents(cardElement, card, index);

    // 编辑模式下启用拖拽
    if (this.config.isEditMode) {
      this.enableDrag(cardElement, card, 'link');
    }
  }

  /**
   * 渲染投票卡片
   */
  private renderVoteCard(card: VoteCard, index: number): void {
    const inside = this.container?.querySelector('.player-interaction-inside');
    if (!inside) return;

    const cardElement = document.createElement('div');
    cardElement.className = 'interaction-card vote-card';
    cardElement.dataset.index = String(index);
    cardElement.dataset.type = 'vote';
    cardElement.style.cssText = `
      position: absolute;
      top: ${card.top}%;
      left: ${card.left}%;
      transform: translate(-50%, -50%);
      background: rgba(24, 25, 28, 0.9);
      border-radius: 8px;
      padding: 12px;
      pointer-events: auto;
      display: none;
      min-width: 250px;
    `;

    let optionsHtml = '';
    card.voteOptions.forEach((option, optIndex) => {
      const percentage = card.totalVotes ? (option.voteCount / card.totalVotes) * 100 : 0;
      optionsHtml += `
        <div class="vote-option" data-option-index="${optIndex}">
          <div class="vote-option-bg" style="width: ${percentage}%"></div>
          <div class="vote-option-text">
            <span class="option-index">${String.fromCharCode(65 + optIndex)}.</span>
            <span class="option-text">${option.optionText}</span>
          </div>
        </div>
      `;
    });

    cardElement.innerHTML = `
      <button class="close-btn" data-action="close">×</button>
      <div class="vote-question">${card.question}</div>
      <div class="vote-options">${optionsHtml}</div>
    `;

    inside.appendChild(cardElement);

    // 绑定事件
    this.bindVoteEvents(cardElement, card, index);

    // 编辑模式下启用拖拽
    if (this.config.isEditMode) {
      this.enableDrag(cardElement, card, 'vote');
    }
  }

  /**
   * 渲染评分卡片
   */
  private renderScoreCard(card: ScoreCard, index: number): void {
    const inside = this.container?.querySelector('.player-interaction-inside');
    if (!inside) return;

    const cardElement = document.createElement('div');
    cardElement.className = 'interaction-card score-card';
    cardElement.dataset.index = String(index);
    cardElement.dataset.type = 'score';
    cardElement.style.cssText = `
      position: absolute;
      top: ${card.top}%;
      left: ${card.left}%;
      transform: translate(-50%, -50%);
      background: rgba(24, 25, 28, 0.9);
      border-radius: 8px;
      padding: 12px;
      pointer-events: auto;
      display: none;
      min-width: 200px;
    `;

    const iconMap: Record<number, string> = {
      1: '⭐',
      2: '❤️',
      3: '🍋',
    };
    const icon = iconMap[card.scoreType] || '⭐';

    let scoreItemsHtml = '';
    for (let i = 1; i <= 5; i++) {
      scoreItemsHtml += `
        <div class="score-item" data-score="${i}">
          ${icon}
          <span class="score-value">${i}</span>
        </div>
      `;
    }

    cardElement.innerHTML = `
      <button class="close-btn" data-action="close">×</button>
      <div class="score-title">${card.title}</div>
      <div class="score-area">${scoreItemsHtml}</div>
      <div class="score-result">
        平均 <span class="average-score">${card.averageScore?.toFixed(1) || '0.0'}</span>
      </div>
      <div class="score-count">${card.participantCount || 0}人参与</div>
    `;

    inside.appendChild(cardElement);

    // 绑定事件
    this.bindScoreEvents(cardElement, card, index);

    // 编辑模式下启用拖拽
    if (this.config.isEditMode) {
      this.enableDrag(cardElement, card, 'score');
    }
  }

  /**
   * 绑定点赞关注卡片事件
   */
  private bindGuideThreeEvents(element: HTMLElement, card: GuideThreeCard, index: number): void {
    element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('[data-action]');
      if (!actionBtn) return;

      const action = actionBtn.getAttribute('data-action');
      switch (action) {
        case 'like':
          card.isLiked = !card.isLiked;
          actionBtn.classList.toggle('active', card.isLiked);
          this.eventBus?.emit('interaction:like', { card, isLiked: card.isLiked });
          break;
        case 'coin':
          card.isCoined = !card.isCoined;
          actionBtn.classList.toggle('active', card.isCoined);
          this.eventBus?.emit('interaction:coin', { card, isCoined: card.isCoined });
          break;
        case 'collect':
          card.isCollected = !card.isCollected;
          actionBtn.classList.toggle('active', card.isCollected);
          this.eventBus?.emit('interaction:collect', { card, isCollected: card.isCollected });
          break;
        case 'follow':
          card.isFollowed = !card.isFollowed;
          actionBtn.classList.toggle('followed', card.isFollowed);
          actionBtn.textContent = card.isFollowed ? '已关注' : '+ 关注';
          this.eventBus?.emit(card.isFollowed ? 'interaction:follow' : 'interaction:unfollow', { card });
          break;
      }
    });
  }

  /**
   * 绑定外链卡片事件
   */
  private bindLinkEvents(element: HTMLElement, card: LinkCard, index: number): void {
    element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      switch (action) {
        case 'close':
          this.closeCard('link', index);
          break;
        case 'watchLater':
          this.eventBus?.emit('interaction:watchlater', { card });
          break;
        default:
          // 点击卡片打开链接
          if (card.linkUrl) {
            this.eventBus?.emit('interaction:linkclick', { card, url: card.linkUrl });
          }
          break;
      }
    });
  }

  /**
   * 绑定投票卡片事件
   */
  private bindVoteEvents(element: HTMLElement, card: VoteCard, index: number): void {
    element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      if (action === 'close') {
        this.closeCard('vote', index);
        return;
      }

      const optionEl = target.closest('.vote-option');
      if (optionEl) {
        const optionIndex = parseInt(optionEl.getAttribute('data-option-index') || '0');
        this.handleVote(card, index, optionIndex);
      }
    });
  }

  /**
   * 处理投票
   */
  private handleVote(card: VoteCard, cardIndex: number, optionIndex: number): void {
    const option = card.voteOptions[optionIndex];
    if (!option) return;

    if (!card.allowMultiple && option.isVoted) {
      // 单选且已投票，取消投票
      option.isVoted = false;
      option.voteCount--;
      card.totalVotes = (card.totalVotes || 0) - 1;
    } else if (!card.allowMultiple) {
      // 单选，取消其他选项
      card.voteOptions.forEach((opt) => {
        if (opt.isVoted) {
          opt.isVoted = false;
          opt.voteCount--;
        }
      });
      option.isVoted = true;
      option.voteCount++;
      card.totalVotes = (card.totalVotes || 0) + 1;
    } else {
      // 多选
      option.isVoted = !option.isVoted;
      option.voteCount += option.isVoted ? 1 : -1;
      card.totalVotes = (card.totalVotes || 0) + (option.isVoted ? 1 : -1);
    }

    // 更新 UI
    this.updateVoteUI(card, cardIndex);

    // 发送事件
    const result: VoteResult = {
      cardId: card.id,
      selectedOptionIds: card.voteOptions.filter((opt) => opt.isVoted).map((opt) => opt.id),
      voteTime: Date.now(),
    };
    this.eventBus?.emit('interaction:vote', result);
  }

  /**
   * 更新投票 UI
   */
  private updateVoteUI(card: VoteCard, index: number): void {
    const element = this.getCardElement('vote', index);
    if (!element) return;

    card.voteOptions.forEach((option, optIndex) => {
      const optionEl = element.querySelector(`[data-option-index="${optIndex}"]`);
      if (optionEl) {
        const percentage = card.totalVotes ? (option.voteCount / card.totalVotes) * 100 : 0;
        const bgEl = optionEl.querySelector('.vote-option-bg') as HTMLElement;
        if (bgEl) {
          bgEl.style.width = `${percentage}%`;
        }
        optionEl.classList.toggle('voted', option.isVoted);
      }
    });
  }

  /**
   * 绑定评分卡片事件
   */
  private bindScoreEvents(element: HTMLElement, card: ScoreCard, index: number): void {
    element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      if (action === 'close') {
        this.closeCard('score', index);
        return;
      }

      const scoreItem = target.closest('.score-item');
      if (scoreItem) {
        const score = parseInt(scoreItem.getAttribute('data-score') || '0');
        this.handleScore(card, index, score);
      }
    });
  }

  /**
   * 处理评分
   */
  private handleScore(card: ScoreCard, cardIndex: number, score: number): void {
    if (card.isScored) return; // 已评分，不能重复评分

    card.currentScore = score;
    card.isScored = true;

    // 更新平均分和参与人数
    const oldTotal = (card.averageScore || 0) * (card.participantCount || 0);
    card.participantCount = (card.participantCount || 0) + 1;
    card.averageScore = (oldTotal + score) / card.participantCount;

    // 更新 UI
    this.updateScoreUI(card, cardIndex);

    // 发送事件
    const result: ScoreResult = {
      cardId: card.id,
      score,
      scoreTime: Date.now(),
    };
    this.eventBus?.emit('interaction:score', result);
  }

  /**
   * 更新评分 UI
   */
  private updateScoreUI(card: ScoreCard, index: number): void {
    const element = this.getCardElement('score', index);
    if (!element) return;

    // 更新选中状态
    const scoreItems = element.querySelectorAll('.score-item');
    scoreItems.forEach((item, idx) => {
      item.classList.toggle('selected', idx < (card.currentScore || 0));
    });

    // 更新平均分和人数
    const avgEl = element.querySelector('.average-score');
    if (avgEl) {
      avgEl.textContent = card.averageScore?.toFixed(1) || '0.0';
    }

    const countEl = element.querySelector('.score-count');
    if (countEl) {
      countEl.textContent = `${card.participantCount || 0}人参与`;
    }
  }

  /**
   * 获取卡片元素
   */
  private getCardElement(type: InteractionCardTypeEnum, index: number): HTMLElement | null {
    return this.container?.querySelector(`.interaction-card[data-type="${type}"][data-index="${index}"]`) as HTMLElement | null;
  }

  /**
   * 关闭卡片
   */
  closeCard(type: InteractionCardTypeEnum, index: number): void {
    const list = this.getCardList(type);
    const card = list[index];
    if (!card) return;

    card.isClose = true;
    card.closeTime = this.currentTime;
    card.status = 'closing' as InteractionStatusEnum.CLOSING;

    const element = this.getCardElement(type, index);
    if (element) {
      element.style.opacity = '0';
      element.style.transform = 'translate(-50%, -50%) scale(0.8)';
      element.style.transition = `opacity ${this.config.closeAnimationDuration}ms, transform ${this.config.closeAnimationDuration}ms`;

      setTimeout(() => {
        element.style.display = 'none';
        card.status = 'closed' as InteractionStatusEnum.CLOSED;
      }, this.config.closeAnimationDuration);
    }

    this.eventBus?.emit('interaction:cardclose', { card, type, index });
  }

  /**
   * 获取卡片列表
   */
  private getCardList(type: InteractionCardTypeEnum): InteractionCard[] {
    switch (type) {
      case 'guideThree':
        return this.cards.guideThreeList;
      case 'link':
        return this.cards.linkList;
      case 'vote':
        return this.cards.voteList;
      case 'score':
        return this.cards.scoreList;
      default:
        return [];
    }
  }

  /**
   * 启用拖拽功能
   */
  private enableDrag(element: HTMLElement, card: InteractionCard, type: InteractionCardTypeEnum): void {
    element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.draggingCard = card;

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = card.left;
      const startTop = card.top;

      const parentRect = element.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const onMouseMove = (e: MouseEvent) => {
        if (!this.isDragging) return;

        const deltaX = ((e.clientX - startX) / parentRect.width) * 100;
        const deltaY = ((e.clientY - startY) / parentRect.height) * 100;

        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;

        // 限制边界
        newLeft = Math.max(this.config.minLeft, Math.min(this.config.maxLeft, newLeft));
        newTop = Math.max(this.config.minTop, Math.min(this.config.maxTop, newTop));

        // 更新卡片位置
        card.left = newLeft;
        card.top = newTop;
        element.style.left = `${newLeft}%`;
        element.style.top = `${newTop}%`;

        // 显示对齐辅助线
        this.showGuideLines(newTop, newLeft);
      };

      const onMouseUp = () => {
        this.isDragging = false;
        this.draggingCard = null;
        this.hideGuideLines();

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // 触发位置改变事件
        const eventData: PositionChangeEvent = {
          cardType: type,
          index: this.getCardList(type).indexOf(card),
          left: card.left,
          top: card.top,
        };
        this.eventBus?.emit('interaction:positionchange', eventData);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * 显示对齐辅助线
   */
  private showGuideLines(top: number, left: number): void {
    if (!this.config.showGuideLines) return;

    // 检查是否靠近边界
    if (Math.abs(top - this.config.minTop) < 2) {
      this.horizontalLineElement?.style.setProperty('top', `${this.config.minTop}%`);
      this.horizontalLineElement?.style.setProperty('opacity', '1');
    } else if (Math.abs(top - this.config.maxTop) < 2) {
      this.horizontalLineElement?.style.setProperty('top', `${this.config.maxTop}%`);
      this.horizontalLineElement?.style.setProperty('opacity', '1');
    } else {
      this.horizontalLineElement?.style.setProperty('opacity', '0');
    }

    if (Math.abs(left - this.config.minLeft) < 2) {
      this.verticalLineElement?.style.setProperty('left', `${this.config.minLeft}%`);
      this.verticalLineElement?.style.setProperty('opacity', '1');
    } else if (Math.abs(left - this.config.maxLeft) < 2) {
      this.verticalLineElement?.style.setProperty('left', `${this.config.maxLeft}%`);
      this.verticalLineElement?.style.setProperty('opacity', '1');
    } else {
      this.verticalLineElement?.style.setProperty('opacity', '0');
    }
  }

  /**
   * 隐藏对齐辅助线
   */
  private hideGuideLines(): void {
    this.verticalLineElement?.style.setProperty('opacity', '0');
    this.horizontalLineElement?.style.setProperty('opacity', '0');
  }

  /**
   * 更新当前时间，控制卡片显示/隐藏
   */
  updateCurrentTime(currentTime: number): void {
    this.currentTime = currentTime;

    // 更新所有卡片的显示状态
    this.updateCardsVisibility(this.cards.guideThreeList, 'guideThree');
    this.updateCardsVisibility(this.cards.linkList, 'link');
    this.updateCardsVisibility(this.cards.voteList, 'vote');
    this.updateCardsVisibility(this.cards.scoreList, 'score');
  }

  /**
   * 更新卡片可见性
   */
  private updateCardsVisibility(list: InteractionCard[], type: InteractionCardTypeEnum): void {
    list.forEach((card, index) => {
      // 如果用户已关闭，不显示
      if (card.isClose && card.closeTime && this.currentTime > card.closeTime) {
        return;
      }

      const element = this.getCardElement(type, index);
      if (!element) return;

      const isInTimeRange = this.currentTime >= card.timeStart && this.currentTime <= card.timeEnd;
      const isClosing = card.status === 'closing';

      if (isInTimeRange && !card.isClose) {
        // 应该显示
        if (element.style.display === 'none') {
          element.style.display = 'block';
          element.style.opacity = '1';
          element.style.transform = 'translate(-50%, -50%) scale(1)';
          card.status = 'visible' as InteractionStatusEnum.VISIBLE;
          this.eventBus?.emit('interaction:cardshow', { card, type, index });
        }
      } else if (!isInTimeRange && !isClosing) {
        // 应该隐藏
        if (element.style.display !== 'none') {
          element.style.display = 'none';
          card.status = 'hidden' as InteractionStatusEnum.HIDDEN;
          this.eventBus?.emit('interaction:cardhide', { card, type, index });
        }
      }
    });
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<InteractionConfig>): void {
    this.config = { ...this.config, ...config };

    // 如果切换到编辑模式，重新绑定拖拽事件
    if (config.isEditMode !== undefined) {
      this.rebindDragEvents();
    }

    // 如果切换辅助线显示
    if (config.showGuideLines !== undefined) {
      if (config.showGuideLines && !this.verticalLineElement) {
        this.createGuideLines();
      } else if (!config.showGuideLines) {
        this.verticalLineElement?.remove();
        this.horizontalLineElement?.remove();
        this.verticalLineElement = null;
        this.horizontalLineElement = null;
      }
    }
  }

  /**
   * 重新绑定拖拽事件
   */
  private rebindDragEvents(): void {
    // 移除旧的事件绑定并重新绑定
    // 实际实现中可能需要更复杂的逻辑
  }

  /**
   * 获取所有卡片
   */
  getAllCards(): InteractionCardContainer {
    return {
      guideThreeList: [...this.cards.guideThreeList],
      linkList: [...this.cards.linkList],
      voteList: [...this.cards.voteList],
      scoreList: [...this.cards.scoreList],
    };
  }

  /**
   * 移除卡片
   */
  removeCard(type: InteractionCardTypeEnum, index: number): void {
    const list = this.getCardList(type);
    const card = list[index];
    if (!card) return;

    const element = this.getCardElement(type, index);
    element?.remove();

    list.splice(index, 1);

    // 更新剩余卡片的索引
    this.updateCardIndices(type);

    this.eventBus?.emit('interaction:cardremove', { card, type, index });
  }

  /**
   * 更新卡片索引
   */
  private updateCardIndices(type: InteractionCardTypeEnum): void {
    const elements = this.container?.querySelectorAll(`.interaction-card[data-type="${type}"]`);
    elements?.forEach((el, idx) => {
      el.setAttribute('data-index', String(idx));
    });
  }

  /**
   * 清空所有卡片
   */
  clearAllCards(): void {
    this.cards.guideThreeList = [];
    this.cards.linkList = [];
    this.cards.voteList = [];
    this.cards.scoreList = [];

    const inside = this.container?.querySelector('.player-interaction-inside');
    if (inside) {
      inside.innerHTML = '';
      if (this.config.showGuideLines) {
        this.createGuideLines();
      }
    }
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    this.clearAllCards();
    this.container = null;
    this.verticalLineElement = null;
    this.horizontalLineElement = null;
  }
}

/**
 * 创建交互插件
 */
export function createInteractionPlugin(): InteractionPlugin {
  return new InteractionPlugin();
}
```

### 12.4 交互插件导出

#### 文件: `packages/player/src/plugins/interaction/index.ts`

```typescript
/**
 * 交互插件模块导出
 */

// 枚举
export {
  InteractionCardTypeEnum,
  InteractionEventEnum,
  GuideThreeTypeEnum,
  ScoreTypeEnum,
  InteractionStatusEnum,
} from './enums';

// 类型
export type {
  BaseInteractionCard,
  GuideThreeCard,
  LinkCard,
  VoteCard,
  ScoreCard,
  VoteOption,
  InteractionConfig,
  PositionChangeEvent,
  InteractionCardContainer,
  VoteResult,
  ScoreResult,
  InteractionCard,
} from './types';

// 插件
export { InteractionPlugin, createInteractionPlugin } from './InteractionPlugin';
```

---

## 八、VideoPlayer.ts 详细修改设计

### 8.1 修改原则

1. **保留 createStateManager** - 用于运行时状态管理（内存状态）
2. **集成 playerStore** - 用于持久化状态管理（localStorage）
3. **删除重复的状态私有属性** - 状态通过 stateManager 管理，不在类中重复定义
4. **使用枚举替代字符串** - 事件名、方法名、状态键都使用枚举
5. **保留所有详细注释** - 不删除任何注释

### 8.2 导入部分修改

#### 第 1-25 行 - 导入语句

```typescript
/**
 * ============================================
 * 视频播放器核心类
 * ============================================
 * 实现播放器的所有核心功能和状态管理
 */

import type {
  PlayerConfig,
  PlayerState,
  PlayerStateData,
  PlayerMethods,
  PlayerEvents,
  QualitySource,
  ComponentInstance,
  VNode,
} from '@/types';
import '../styles/index.scss'

import { PlayerState as PlayerStateEnum, QualityLevel, PlayMode } from '@/types';
import { h, mount, destroy, createStateManager, createEventBus } from '@/core';
import type { StateManager, EventBus, Plugin } from '@/core';
import { PlayerEventEnum, PlayerMethodEnum, PlayerStateKeyEnum } from '@/core/events';
import { PluginManager } from '@/core/pluginManager';
import { createPlayerStore } from '@/store';
import type { PlayerStore } from '@/store';
import { EventEmitter, fullscreen, pip, clamp, formatTime, isServer, type SSRConfig, createSSRConfig } from '@/utils';
import { PlayerDocker, type PlayerDockerProps } from '@/components/PlayerDocker';
```

**修改说明：**
- 新增导入 `PlayerEventEnum, PlayerMethodEnum, PlayerStateKeyEnum` 从 `@/core/events`
- 新增导入 `createPlayerStore` 和 `PlayerStore` 从 `@/store`

### 8.3 类属性修改

#### 第 100-230 行 - 属性定义

**删除以下重复的状态私有属性（第 127-221 行）：**
```typescript
// 删除这些重复定义的状态属性：
private _state: PlayerState = PlayerStateEnum.IDLE;
private currentTime = 0;
private duration = 0;
private volume = 1;
private muted = false;
private playbackRate = 1;
private quality: QualityLevel = QualityLevel.AUTO;
private isFullscreen = false;
private isPip = false;
private showControls = true;
private controlsHideTimer: number | null = null;
private buffered: TimeRanges | null = null;
private errorCode = 0;
private errorMessage = '';
private sources: QualitySource[] = [];
private currentSourceIndex = 0;
private isSeeking = false;
```

**保留以下属性：**
```typescript
export class VideoPlayer implements ComponentInstance<PlayerConfig>, PlayerMethods {
  /**
   * 播放器配置
   */
  props: Required<PlayerConfig>;

  /**
   * 播放器根元素
   */
  el?: HTMLElement;

  /**
   * 视频元素
   */
  private videoEl: HTMLVideoElement | null = null;

  /**
   * 播放器容器元素
   */
  private containerEl: HTMLElement | null = null;

  /**
   * 事件发射器（内部使用）
   */
  private emitter = new EventEmitter<PlayerEvents>();

  /**
   * 状态管理器
   * 提供运行时状态存储（内存状态，不持久化）
   */
  state: StateManager;

  /**
   * 持久化状态存储
   * 提供持久化状态管理（localStorage）
   */
  store: PlayerStore;

  /**
   * 事件总线
   * 提供跨组件/插件的事件通信
   */
  events: EventBus;

  /**
   * 虚拟节点引用
   */
  private vnode: VNode | null = null;

  /**
   * SSR 配置
   */
  private ssrConfig: SSRConfig;

  /**
   * 插件管理器
   */
  private pluginManager: PluginManager | null = null;

  /**
   * 视频源列表
   */
  private sources: QualitySource[] = [];

  /**
   * 当前播放的视频源索引
   */
  private currentSourceIndex = 0;
```

### 8.4 构造函数修改

#### 第 230-330 行 - 构造函数

```typescript
  /**
   * 构造函数
   *
   * @param config - 播放器配置
   */
  constructor(config: PlayerConfig) {
    /**
     * 合并默认配置和用户配置
     */
    this.props = { ...defaultConfig, ...config };

    /**
     * 初始化 SSR 配置
     */
    this.ssrConfig = createSSRConfig(this.props.ssr);

    /**
     * 处理视频源
     */
    this.processSources();

    /**
     * 初始化持久化状态存储
     * 从 localStorage 读取用户偏好设置
     */
    this.store = createPlayerStore({
      persist: true,
      persistKey: 'nova_player_state',
    });

    /**
     * 从持久化存储恢复音量设置
     * 如果配置中未指定，使用存储的值
     */
    const persistentState = this.store.getPersistentState();
    if (this.props.volume === defaultConfig.volume) {
      this.props.volume = persistentState.volume;
    }
    if (this.props.muted === defaultConfig.muted) {
      this.props.muted = persistentState.isMuted;
    }
    if (this.props.playbackRate === defaultConfig.playbackRate) {
      this.props.playbackRate = persistentState.playbackRate;
    }

    /**
     * 初始化运行时状态管理器
     * 管理播放过程中的运行时状态（不持久化）
     */
    this.state = createStateManager({
      player: {
        state: PlayerStateEnum.IDLE,
        currentTime: 0,
        duration: 0,
        volume: this.props.volume,
        muted: this.props.muted,
        playbackRate: this.props.playbackRate,
        buffered: 0,
        isFullscreen: false,
        isPip: false,
        isSeeking: false,
        quality: this.props.defaultQuality,
        playMode: this.props.playMode,
      },
      video: {
        width: 0,
        height: 0,
        videoWidth: 0,
        videoHeight: 0,
      },
      error: {
        code: 0,
        message: '',
      },
    });

    /**
     * 初始化事件总线
     */
    this.events = createEventBus();

    /**
     * 初始化插件管理器
     */
    this.pluginManager = new PluginManager(this);

    /**
     * 自动注册配置的插件
     */
    this.registerPlugins();
  }
```

### 8.5 方法修改 - 使用枚举替代字符串

#### setState 方法（第 420-435 行）

**修改前：**
```typescript
  private setState(state: PlayerState): void {
    if (this._state !== state) {
      this._state = state;
      this.state.set('player.state', state);
      this.emitter.emit('statechange', state);
      this.events.emit('player:statechange', state);
    }
  }
```

**修改后：**
```typescript
  /**
   * 设置播放器状态
   *
   * @param state - 新状态
   */
  private setState(state: PlayerState): void {
    const prevState = this.state.get(PlayerStateKeyEnum.STATE);
    if (prevState !== state) {
      this.state.set(PlayerStateKeyEnum.STATE, state);
      this.emitter.emit('statechange', state);
      // 使用枚举替代字符串
      this.events.emit(PlayerEventEnum.STATE_CHANGE, state);
    }
  }
```

**修改说明：**
- `this._state` 改为 `this.state.get(PlayerStateKeyEnum.STATE)`
- `this.state.set('player.state', state)` 改为 `this.state.set(PlayerStateKeyEnum.STATE, state)`
- `'player:statechange'` 改为 `PlayerEventEnum.STATE_CHANGE`

#### play 方法（第 500-520 行）

**修改前：**
```typescript
  async play(): Promise<void> {
    if (!this.videoEl) return;
    try {
      this.events.emit('player:beforeplay', undefined);
      await this.videoEl.play();
      this.events.emit('player:play', undefined);
    } catch (error) {
      console.error('播放失败:', error);
      this.events.emit('player:playerror', { error });
    }
  }
```

**修改后：**
```typescript
  /**
   * 播放视频
   */
  async play(): Promise<void> {
    if (!this.videoEl) return;
    try {
      // 使用枚举替代字符串
      this.events.emit(PlayerEventEnum.PLAY, undefined);
      await this.videoEl.play();
    } catch (error) {
      console.error('播放失败:', error);
      this.events.emit(PlayerEventEnum.ERROR, { error });
    }
  }
```

**修改说明：**
- `'player:beforeplay'` 改为 `PlayerEventEnum.PLAY`
- `'player:play'` 删除重复触发
- `'player:playerror'` 改为 `PlayerEventEnum.ERROR`

#### pause 方法（第 522-530 行）

**修改前：**
```typescript
  pause(): void {
    if (!this.videoEl) return;
    this.videoEl.pause();
  }
```

**修改后：**
```typescript
  /**
   * 暂停视频
   */
  pause(): void {
    if (!this.videoEl) return;
    this.videoEl.pause();
    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.PAUSE, undefined);
  }
```

**修改说明：**
- 添加 `this.events.emit(PlayerEventEnum.PAUSE, undefined)` 触发暂停事件

#### seek 方法（第 540-560 行）

**修改前：**
```typescript
  seek(time: number): void {
    console.log(`[VideoPlayer] seek(${time}) 被调用, videoEl=${!!this.videoEl}, duration=${this.duration}, isFinite=${isFinite(this.duration)}`);
    if (!this.videoEl || !isFinite(this.duration)) {
      console.log(`[VideoPlayer] seek 返回: videoEl=${!!this.videoEl}, isFinite=${isFinite(this.duration)}`);
      return;
    }
    const clampedTime = clamp(time, 0, this.duration);
    console.log(`[VideoPlayer] 设置 currentTime = ${clampedTime}`);
    this.events.emit('player:seek', { time: clampedTime, previousTime: this.currentTime });
    this.videoEl.currentTime = clampedTime;
  }
```

**修改后：**
```typescript
  /**
   * 跳转到指定时间
   *
   * @param time - 目标时间（秒）
   */
  seek(time: number): void {
    if (!this.videoEl) return;
    const duration = this.state.get(PlayerStateKeyEnum.DURATION) as number;
    if (!isFinite(duration)) return;
    
    const clampedTime = clamp(time, 0, duration);
    const prevTime = this.state.get(PlayerStateKeyEnum.CURRENT_TIME) as number;
    
    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.TIME_UPDATE, { 
      time: clampedTime, 
      previousTime: prevTime 
    });
    this.videoEl.currentTime = clampedTime;
  }
```

**修改说明：**
- `this.duration` 改为 `this.state.get(PlayerStateKeyEnum.DURATION)`
- `this.currentTime` 改为 `this.state.get(PlayerStateKeyEnum.CURRENT_TIME)`
- `'player:seek'` 改为 `PlayerEventEnum.TIME_UPDATE`

#### setVolume 方法（第 570-580 行）

**修改前：**
```typescript
  setVolume(volume: number): void {
    this.setVolumeState(volume, volume === 0);
  }
```

**修改后：**
```typescript
  /**
   * 设置音量
   *
   * @param volume - 音量值 (0-1)
   */
  setVolume(volume: number): void {
    const clampedVolume = clamp(volume, 0, 1);
    const isMuted = clampedVolume === 0;
    
    // 更新运行时状态
    this.state.set(PlayerStateKeyEnum.VOLUME, clampedVolume);
    this.state.set(PlayerStateKeyEnum.MUTED, isMuted);
    
    // 更新持久化状态
    this.store.setVolume(clampedVolume);
    this.store.setMuted(isMuted);
    
    if (this.videoEl) {
      this.videoEl.volume = clampedVolume;
      this.videoEl.muted = isMuted;
    }
    
    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.VOLUME_CHANGE, { volume: clampedVolume, muted: isMuted });
  }
```

**修改说明：**
- 删除 `setVolumeState` 方法调用，改为直接操作 state 和 store
- 使用 `PlayerStateKeyEnum.VOLUME` 和 `PlayerStateKeyEnum.MUTED` 更新状态
- 使用 `PlayerEventEnum.VOLUME_CHANGE` 触发事件

#### setPlaybackRate 方法（第 590-605 行）

**修改前：**
```typescript
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.videoEl) {
      this.videoEl.playbackRate = rate;
    }
  }
```

**修改后：**
```typescript
  /**
   * 设置播放速度
   *
   * @param rate - 播放速度
   */
  setPlaybackRate(rate: number): void {
    // 更新运行时状态
    this.state.set(PlayerStateKeyEnum.PLAYBACK_RATE, rate);
    
    // 更新持久化状态
    this.store.setPlaybackRate(rate);
    
    if (this.videoEl) {
      this.videoEl.playbackRate = rate;
    }
    
    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.RATE_CHANGE, rate);
  }
```

**修改说明：**
- `this.playbackRate = rate` 改为 `this.state.set(PlayerStateKeyEnum.PLAYBACK_RATE, rate)`
- 添加 `this.store.setPlaybackRate(rate)` 持久化
- 添加 `this.events.emit(PlayerEventEnum.RATE_CHANGE, rate)` 事件

#### setQuality 方法（第 620-660 行）

**修改前：**
```typescript
  setQuality(quality: QualityLevel): void {
    if (quality === this.quality) return;

    const wasPlaying = this._state === PlayerStateEnum.PLAYING;
    const currentTime = this.currentTime;

    this.quality = quality;

    if (quality === QualityLevel.AUTO) {
      this.currentSourceIndex = 0;
    } else {
      const index = this.sources.findIndex(s => s.quality === quality);
      if (index !== -1) {
        this.currentSourceIndex = index;
      }
    }

    if (this.videoEl) {
      this.videoEl.src = this.getCurrentSourceUrl();
      this.videoEl.currentTime = currentTime;

      if (wasPlaying) {
        void this.play();
      }
    }

    this.emitter.emit('qualitychange', quality);
  }
```

**修改后：**
```typescript
  /**
   * 切换画质
   *
   * @param quality - 目标画质
   */
  setQuality(quality: QualityLevel): void {
    const currentQuality = this.state.get(PlayerStateKeyEnum.QUALITY) as QualityLevel;
    if (quality === currentQuality) return;

    const wasPlaying = this.state.get(PlayerStateKeyEnum.STATE) === PlayerStateEnum.PLAYING;
    const currentTime = this.state.get(PlayerStateKeyEnum.CURRENT_TIME) as number;

    // 更新运行时状态
    this.state.set(PlayerStateKeyEnum.QUALITY, quality);

    if (quality === QualityLevel.AUTO) {
      this.currentSourceIndex = 0;
    } else {
      const index = this.sources.findIndex(s => s.quality === quality);
      if (index !== -1) {
        this.currentSourceIndex = index;
      }
    }

    if (this.videoEl) {
      this.videoEl.src = this.getCurrentSourceUrl();
      this.videoEl.currentTime = currentTime;

      if (wasPlaying) {
        void this.play();
      }
    }

    // 使用枚举替代字符串
    this.events.emit(PlayerEventEnum.QUALITY_CHANGE, quality);
  }
```

**修改说明：**
- `this.quality` 改为 `this.state.get(PlayerStateKeyEnum.QUALITY)`
- `this._state` 改为 `this.state.get(PlayerStateKeyEnum.STATE)`
- `this.currentTime` 改为 `this.state.get(PlayerStateKeyEnum.CURRENT_TIME)`
- `this.quality = quality` 改为 `this.state.set(PlayerStateKeyEnum.QUALITY, quality)`
- `'qualitychange'` 改为 `PlayerEventEnum.QUALITY_CHANGE`

#### getState 方法（第 700-730 行）

**修改前：**
```typescript
  getState(): PlayerStateData {
    return {
      state: this._state,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      muted: this.muted,
      playbackRate: this.playbackRate,
      quality: this.quality,
      isFullscreen: this.isFullscreen,
      isPip: this.isPip,
      buffered: this.buffered,
      aspectRatio: this.videoEl
        ? this.videoEl.videoWidth / this.videoEl.videoHeight
        : 16 / 9,
    };
  }
```

**修改后：**
```typescript
  /**
   * 获取当前状态
   *
   * @returns 播放器状态数据
   */
  getState(): PlayerStateData {
    const playerState = this.state.get('player') as Record<string, unknown>;
    const videoState = this.state.get('video') as Record<string, unknown>;
    
    return {
      state: playerState.state as PlayerState,
      currentTime: playerState.currentTime as number,
      duration: playerState.duration as number,
      volume: playerState.volume as number,
      muted: playerState.muted as boolean,
      playbackRate: playerState.playbackRate as number,
      quality: playerState.quality as QualityLevel,
      isFullscreen: playerState.isFullscreen as boolean,
      isPip: playerState.isPip as boolean,
      buffered: playerState.buffered as TimeRanges | null,
      aspectRatio: videoState.videoWidth && videoState.videoHeight
        ? (videoState.videoWidth as number) / (videoState.videoHeight as number)
        : 16 / 9,
    };
  }
```

**修改说明：**
- 所有直接属性访问改为从 `this.state.get('player')` 获取
- 保持 aspectRatio 计算逻辑不变

### 8.6 render 方法修改

#### 第 340-390 行

**修改前：**
```typescript
  render(): VNode {
    // 使用 PlayerDocker 组件渲染播放器 UI
    return h(PlayerDocker, {
      src: this.getCurrentSourceUrl(),
      playerName: '嗨哩播放器',
      autoplay: this.props.autoplay,
      volume: this.volume,
      muted: this.muted,
      onMounted: (elements: NonNullable<PlayerDockerProps['onMounted']> extends (e: infer E) => void ? E : never) => {
        // 保存 video 元素引用
        this.videoEl = elements.video;
        this.containerEl = elements.container;
        this.el = elements.container;

        // 注册到 WeakMap
        if (this.containerEl) {
          playerInstanceMap.set(this.containerEl, this);
        }

        // 触发 ready 事件
        this.emitter.emit('ready');
        this.events.emit('player:ready', undefined);
        this.emitter.emit('statechange', this._state);

        // 触发插件挂载事件
        this.events.emit('player:mounted', {
          container: this.containerEl,
          video: this.videoEl,
        });

        // 自动播放
        if (this.props.autoplay) {
          void this.play();
        }
      },
    });
  }
```

**修改后：**
```typescript
  render(): VNode {
    // 使用 PlayerDocker 组件渲染播放器 UI
    return h(PlayerDocker, {
      src: this.getCurrentSourceUrl(),
      playerName: this.props.playerName || '嗨哩播放器',
      autoplay: this.props.autoplay,
      volume: this.props.volume,
      muted: this.props.muted,
      onMounted: (elements: NonNullable<PlayerDockerProps['onMounted']> extends (e: infer E) => void ? E : never) => {
        // 保存 video 元素引用
        this.videoEl = elements.video;
        this.containerEl = elements.container;
        this.el = elements.container;

        // 注册到 WeakMap
        if (this.containerEl) {
          playerInstanceMap.set(this.containerEl, this);
        }

        // 触发 ready 事件 - 使用枚举替代字符串
        this.emitter.emit('ready');
        this.events.emit(PlayerEventEnum.READY, undefined);
        this.emitter.emit('statechange', this.state.get(PlayerStateKeyEnum.STATE));

        // 触发插件挂载事件 - 使用枚举替代字符串
        this.events.emit(PlayerEventEnum.MOUNTED, {
          container: this.containerEl,
          video: this.videoEl,
        });

        // 自动播放
        if (this.props.autoplay) {
          void this.play();
        }
      },
    });
  }
```

**修改说明：**
- `playerName` 改为从 `this.props.playerName` 获取，支持外部传入，默认值为 '嗨哩播放器'
- `volume` 和 `muted` 改为从 `this.props` 获取
- `this._state` 改为 `this.state.get(PlayerStateKeyEnum.STATE)`
- `'player:ready'` 改为 `PlayerEventEnum.READY`
- `'player:mounted'` 改为 `PlayerEventEnum.MOUNTED`

---

## 九、实施顺序

1. **创建 events.ts** - 创建事件枚举文件，定义 PlayerEventEnum、PlayerMethodEnum、ComponentEventEnum、PluginEventEnum、PlayerConfigEnum、PlayerStateKeyEnum
2. **创建 store/enums.ts** - 在现有 store 目录中添加枚举定义，定义 PersistentKeyEnum、StateKeyEnum
3. **更新 store/index.ts** - 导出新增的枚举
4. **VideoPlayer.ts** - 按上述设计修改，导入枚举，简化核心类，删除重复状态，使用枚举替代字符串事件名，接入 playerStore 和 createStateManager，保留所有详细注释
5. **PlayerDocker.ts** - 导入枚举，添加缺失的子组件，保留所有详细注释
6. **Controls.ts** - 导入枚举，保留所有详细注释，使用枚举替代字符串事件名
7. **Top.ts** - 导入枚举，保留所有详细注释，使用枚举替代字符串事件名
8. **Loading.ts** - 导入枚举，保留所有详细注释，使用枚举替代字符串事件名
9. **State.ts** - 导入枚举，保留所有详细注释，使用枚举替代字符串事件名
10. **Toast.ts** - 导入枚举，保留所有详细注释，使用枚举替代字符串事件名
11. **测试验证**
