/**
 * ============================================
 * 播放器事件枚举定义
 * ============================================
 */

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
  /** 播放器挂载完成 */
  MOUNTED = 'MOUNTED',
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

  // 监控相关事件
  /** 监控数据更新 */
  MONITOR_STATS = 'MONITOR_STATS',
  /** 码率信息更新 */
  MONITOR_BITRATE = 'MONITOR_BITRATE',
  /** 缓冲区信息更新 */
  MONITOR_BUFFER = 'MONITOR_BUFFER',
  /** 帧率信息更新 */
  MONITOR_FPS = 'MONITOR_FPS',
  /** 吞吐量信息更新 */
  MONITOR_THROUGHPUT = 'MONITOR_THROUGHPUT',
  /** 开始监控 */
  MONITOR_START = 'MONITOR_START',
  /** 停止监控 */
  MONITOR_STOP = 'MONITOR_STOP',
  /** 设置播放器实例到监控器（供流媒体插件使用） */
  MONITOR_SET_PLAYER = 'MONITOR_SET_PLAYER',

  // 提示工具相关事件
  /** 显示 tooltip 提示 */
  TOOLTIP_SHOW = 'TOOLTIP_SHOW',
  /** 隐藏 tooltip 提示 */
  TOOLTIP_HIDE = 'TOOLTIP_HIDE',
}

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
