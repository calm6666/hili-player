/**
 * ============================================
 * 播放器事件和方法枚举定义
 * ============================================
 * 用于事件总线通信和暴露外部方法，防止名称拼写错误
 * 参考 dash.js 和 hls.js 的枚举命名风格：大写驼峰 + 下划线分隔
 */

/**
 * 播放器事件枚举
 * 用于事件总线通信，防止事件名称拼写错误
 */
export enum PlayerEventEnum {
  // 播放状态相关事件
  /** 播放状态改变 */
  STATE_CHANGE = 'stateChange',
  /** 开始播放 */
  PLAY = 'play',
  /** 暂停播放 */
  PAUSE = 'pause',
  /** 播放结束 */
  ENDED = 'ended',
  /** 播放时间更新 */
  TIME_UPDATE = 'timeUpdate',
  /** 播放进度 */
  PROGRESS = 'progress',
  /** 等待缓冲 */
  WAITING = 'waiting',
  /** 缓冲完成可以继续播放 */
  CAN_PLAY = 'canPlay',
  /** 可播放至结尾 */
  CAN_PLAY_THROUGH = 'canPlayThrough',
  /** 加载中 */
  LOADING = 'loading',
  /** 加载完成 */
  LOADED = 'loaded',

  // 视频属性相关事件
  /** 音量改变 */
  VOLUME_CHANGE = 'volumeChange',
  /** 静音状态改变 */
  MUTED_CHANGE = 'mutedChange',
  /** 播放速度改变 */
  RATE_CHANGE = 'rateChange',
  /** 画质改变 */
  QUALITY_CHANGE = 'qualityChange',
  /** 视频尺寸改变 */
  RESIZE = 'resize',
  /** 时长改变 */
  DURATION_CHANGE = 'durationChange',

  // 全屏/画中画相关事件
  /** 全屏状态改变 */
  FULLSCREEN_CHANGE = 'fullscreenChange',
  /** 画中画状态改变 */
  PIP_CHANGE = 'pipChange',
  /** 网页全屏状态改变 */
  WEB_FULLSCREEN_CHANGE = 'webFullscreenChange',
  /** 宽屏模式改变 */
  WIDE_SCREEN_CHANGE = 'wideScreenChange',

  // 错误相关事件
  /** 播放错误 */
  ERROR = 'error',
  /** 错误恢复 */
  ERROR_RECOVERY = 'errorRecovery',

  // 控制栏相关事件
  /** 控制栏显示 */
  CONTROLS_SHOW = 'controlsShow',
  /** 控制栏隐藏 */
  CONTROLS_HIDE = 'controlsHide',
  /** 进度条拖动开始 */
  SEEK_START = 'seekStart',
  /** 进度条拖动结束 */
  SEEK_END = 'seekEnd',

  // 生命周期事件
  /** 播放器初始化完成 */
  READY = 'ready',
  /** 播放器挂载完成 */
  MOUNTED = 'mounted',
  /** 播放器销毁 */
  DESTROY = 'destroy',

  // 弹幕相关事件
  /** 弹幕显示状态改变 */
  DANMAKU_TOGGLE = 'danmakuToggle',
  /** 弹幕密度改变 */
  DANMAKU_DENSITY_CHANGE = 'danmakuDensityChange',
  /** 弹幕透明度改变 */
  DANMAKU_OPACITY_CHANGE = 'danmakuOpacityChange',
  /** 弹幕速度改变 */
  DANMAKU_SPEED_CHANGE = 'danmakuSpeedChange',

  // 字幕相关事件
  /** 字幕显示状态改变 */
  SUBTITLE_TOGGLE = 'subtitleToggle',
  /** 字幕语言改变 */
  SUBTITLE_LANG_CHANGE = 'subtitleLangChange',
}

/**
 * 播放器方法枚举
 * 用于暴露给外部调用的方法名称，防止方法名拼写错误
 */
export enum PlayerMethodEnum {
  // 播放控制方法
  /** 播放视频 */
  PLAY = 'play',
  /** 暂停视频 */
  PAUSE = 'pause',
  /** 跳转指定时间 */
  SEEK = 'seek',
  /** 重新加载 */
  RELOAD = 'reload',

  // 音量控制方法
  /** 设置音量 */
  SET_VOLUME = 'setVolume',
  /** 获取音量 */
  GET_VOLUME = 'getVolume',
  /** 设置静音 */
  SET_MUTED = 'setMuted',
  /** 切换静音 */
  TOGGLE_MUTED = 'toggleMuted',

  // 播放速度方法
  /** 设置播放速度 */
  SET_PLAYBACK_RATE = 'setPlaybackRate',
  /** 获取播放速度 */
  GET_PLAYBACK_RATE = 'getPlaybackRate',

  // 画质方法
  /** 设置画质 */
  SET_QUALITY = 'setQuality',
  /** 获取当前画质 */
  GET_QUALITY = 'getQuality',
  /** 获取可用画质列表 */
  GET_QUALITIES = 'getQualities',

  // 全屏/画中画方法
  /** 进入全屏 */
  ENTER_FULLSCREEN = 'enterFullscreen',
  /** 退出全屏 */
  EXIT_FULLSCREEN = 'exitFullscreen',
  /** 切换全屏 */
  TOGGLE_FULLSCREEN = 'toggleFullscreen',
  /** 进入画中画 */
  ENTER_PIP = 'enterPip',
  /** 退出画中画 */
  EXIT_PIP = 'exitPip',
  /** 切换画中画 */
  TOGGLE_PIP = 'togglePip',
  /** 进入网页全屏 */
  ENTER_WEB_FULLSCREEN = 'enterWebFullscreen',
  /** 退出网页全屏 */
  EXIT_WEB_FULLSCREEN = 'exitWebFullscreen',
  /** 切换网页全屏 */
  TOGGLE_WEB_FULLSCREEN = 'toggleWebFullscreen',
  /** 切换宽屏 */
  TOGGLE_WIDE_SCREEN = 'toggleWideScreen',

  // 状态获取方法
  /** 获取播放器状态 */
  GET_STATE = 'getState',
  /** 获取当前时间 */
  GET_CURRENT_TIME = 'getCurrentTime',
  /** 获取总时长 */
  GET_DURATION = 'getDuration',
  /** 获取缓冲进度 */
  GET_BUFFERED = 'getBuffered',

  // 弹幕方法
  /** 发送弹幕 */
  SEND_DANMAKU = 'sendDanmaku',
  /** 显示/隐藏弹幕 */
  TOGGLE_DANMAKU = 'toggleDanmaku',
  /** 设置弹幕不透明度 */
  SET_DANMAKU_OPACITY = 'setDanmakuOpacity',
  /** 清除弹幕 */
  CLEAR_DANMAKU = 'clearDanmaku',

  // 字幕方法
  /** 切换字幕显示 */
  TOGGLE_SUBTITLE = 'toggleSubtitle',
  /** 设置字幕语言 */
  SET_SUBTITLE_LANG = 'setSubtitleLang',

  // 播放器控制方法
  /** 销毁播放器 */
  DESTROY = 'destroy',
  /** 调整大小 */
  RESIZE = 'resize',
}

/**
 * 组件内部事件枚举
 * 用于组件间通信的事件名称
 */
export enum ComponentEventEnum {
  // Controls组件事件
  /** 播放按钮点击 */
  PLAY_CLICK = 'playClick',
  /** 暂停按钮点击 */
  PAUSE_CLICK = 'pauseClick',
  /** 进度条改变 */
  PROGRESS_CHANGE = 'progressChange',
  /** 音量改变 */
  VOLUME_CHANGE = 'volumeChange',
  /** 全屏按钮点击 */
  FULLSCREEN_CLICK = 'fullscreenClick',
  /** 画中画按钮点击 */
  PIP_CLICK = 'pipClick',
  /** 设置按钮点击 */
  SETTINGS_CLICK = 'settingsClick',
  /** 画质按钮点击 */
  QUALITY_CLICK = 'qualityClick',
  /** 上一集按钮点击 */
  PREV_CLICK = 'prevClick',
  /** 下一集按钮点击 */
  NEXT_CLICK = 'nextClick',

  // Top组件事件
  /** 返回按钮点击 */
  BACK_CLICK = 'backClick',
  /** 更多按钮点击 */
  MORE_CLICK = 'moreClick',
  /** 标题点击 */
  TITLE_CLICK = 'titleClick',

  // Loading组件事件
  /** 重试按钮点击 */
  RETRY_CLICK = 'retryClick',

  // State组件事件
  /** 状态改变 */
  STATE_CHANGE = 'stateChange',

  // Toast组件事件
  /** Toast关闭 */
  TOAST_CLOSE = 'toastClose',
  /** Toast跳转 */
  TOAST_JUMP = 'toastJump',
}

/**
 * 插件事件枚举
 * 用于插件系统的事件通信
 */
export enum PluginEventEnum {
  // 插件生命周期事件
  /** 插件安装前 */
  BEFORE_INSTALL = 'beforeInstall',
  /** 插件安装后 */
  AFTER_INSTALL = 'afterInstall',
  /** 插件卸载前 */
  BEFORE_UNINSTALL = 'beforeUninstall',
  /** 插件卸载后 */
  AFTER_UNINSTALL = 'afterUninstall',
  /** 插件启用 */
  ENABLE = 'enable',
  /** 插件禁用 */
  DISABLE = 'disable',

  // 插件错误事件
  /** 插件错误 */
  ERROR = 'error',
  /** 插件警告 */
  WARNING = 'warning',
}

/**
 * 播放器配置枚举
 * 用于配置项的键名定义，防止拼写错误
 */
export enum PlayerConfigEnum {
  // 基础配置
  SRC = 'src',
  CONTAINER = 'container',
  AUTOPLAY = 'autoplay',
  MUTED = 'muted',
  VOLUME = 'volume',
  PLAYBACK_RATE = 'playbackRate',
  CONTROLS = 'controls',
  LOOP = 'loop',
  PRELOAD = 'preload',
  POSTER = 'poster',

  // 画质配置
  DEFAULT_QUALITY = 'defaultQuality',
  QUALITIES = 'qualities',

  // 播放模式配置
  PLAY_MODE = 'playMode',

  // 功能开关配置
  KEYBOARD = 'keyboard',
  PIP = 'pip',
  FULLSCREEN = 'fullscreen',

  // 主题配置
  THEME_COLOR = 'themeColor',

  // 弹幕配置
  DANMAKU_ENABLED = 'danmakuEnabled',
  DANMAKU_SOURCE = 'danmakuSource',
  DANMAKU_OPACITY = 'danmakuOpacity',
  DANMAKU_SPEED = 'danmakuSpeed',
  DANMAKU_VISIBLE = 'danmakuVisible',

  // 字幕配置
  SUBTITLES = 'subtitles',

  // SSR配置
  SSR_ENABLED = 'ssrEnabled',
  SSR_DEFER_HYDRATION = 'ssrDeferHydration',

  // 插件配置
  PLUGINS = 'plugins',
}

/**
 * 播放器状态键枚举
 * 用于状态管理器的路径定义
 */
export enum PlayerStateKeyEnum {
  // 播放状态
  STATE = 'playerState',
  CURRENT_TIME = 'playerCurrentTime',
  DURATION = 'playerDuration',
  BUFFERED = 'playerBuffered',

  // 音量状态
  VOLUME = 'playerVolume',
  MUTED = 'playerMuted',

  // 播放属性
  PLAYBACK_RATE = 'playerPlaybackRate',
  QUALITY = 'playerQuality',

  // 显示状态
  IS_FULLSCREEN = 'playerIsFullscreen',
  IS_PIP = 'playerIsPip',
  IS_WEB_FULLSCREEN = 'playerIsWebFullscreen',
  IS_WIDE_SCREEN = 'playerIsWideScreen',

  // 视频属性
  VIDEO_WIDTH = 'playerVideoWidth',
  VIDEO_HEIGHT = 'playerVideoHeight',
  ASPECT_RATIO = 'playerAspectRatio',

  // 错误状态
  ERROR_CODE = 'playerErrorCode',
  ERROR_MESSAGE = 'playerErrorMessage',

  // 加载状态
  IS_LOADING = 'playerIsLoading',
  LOAD_PROGRESS = 'playerLoadProgress',

  // 控制栏状态
  CONTROLS_VISIBLE = 'playerControlsVisible',
  CONTROLS_HOVER = 'playerControlsHover',

  // 弹幕状态
  DANMAKU_VISIBLE = 'playerDanmakuVisible',
  DANMAKU_OPACITY = 'playerDanmakuOpacity',
  DANMAKU_SPEED = 'playerDanmakuSpeed',
  DANMAKU_DENSITY = 'playerDanmakuDensity',

  // 字幕状态
  SUBTITLE_VISIBLE = 'playerSubtitleVisible',
  SUBTITLE_LANG = 'playerSubtitleLang',
}
