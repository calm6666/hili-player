/**
 * ============================================
 * 播放器事件和方法枚举定义
 * ============================================
 * 用于事件总线通信和暴露外部方法，防止名称拼写错误
 * 参考 dash.js 和 hls.js 的枚举命名风格：大写驼峰 + 下划线分隔
 */

import type { TypedEventBus } from './eventBus';

/**
 * 播放器事件数据类型映射
 * 将 PlayerEventEnum 的每个事件名映射到其 payload 类型
 * 用于 TypedEventBus 的类型安全
 *
 * 使用 type 交叉而非 interface + 索引签名：
 * interface { [key: string]: unknown; play: undefined; }
 * → TypeScript 将 'play' 的类型也视为 unknown（索引签名覆盖）
 *
 * type 交叉 { play: undefined; } & Record<string, unknown>
 * → TypeScript 保留具体属性的类型，索引签名仅用于动态访问
 */
export type PlayerEventMap = {
  // 播放状态相关事件
  stateChange: string;
  play: undefined;
  pause: undefined;
  ended: undefined;
  timeUpdate: { time: number };
  progress: undefined;
  waiting: undefined;
  canPlay: undefined;
  canPlayThrough: undefined;
  loading: undefined;
  loaded: undefined;

  // 视频属性相关事件
  volumeChange: { volume: number; muted: boolean };
  mutedChange: boolean;
  rateChange: number;
  qualityChange: { quality: string; name?: string; isBackup?: boolean } | string;
  resize: { width: number; height: number };
  durationChange: undefined;

  // 全屏/画中画相关事件
  fullscreenChange: { isFullscreen: boolean };
  pipChange: { isPip: boolean };
  webFullscreenChange: { isWebFullscreen: boolean };
  wideScreenChange: { isWideScreen: boolean };

  // 错误相关事件
  error: { error: unknown; code?: number; message?: string };
  errorRecovery: undefined;

  // 控制栏相关事件
  controlsShow: undefined;
  controlsHide: undefined;
  seekStart: { time: number; previousTime: number };
  seekEnd: { time: number; previousTime: number };

  // 生命周期事件
  ready: undefined;
  mounted: { container?: HTMLElement; video?: HTMLVideoElement; sendingArea?: HTMLElement };
  /** 插件约定的挂载事件名（兼容旧插件） */
  'player:mounted': { container?: HTMLElement; video?: HTMLVideoElement; sendingArea?: HTMLElement };
  destroy: undefined;

  // 弹幕相关事件
  danmakuToggle: undefined;
  danmakuDensityChange: number;
  danmakuOpacityChange: number;
  danmakuSpeedChange: number;
  danmakuSend: { text: string; options?: Record<string, unknown> };
  danmakuSent: Record<string, unknown>;
  danmakuClear: undefined;
  danmakuSettingChange: Record<string, unknown>;

  // 字幕相关事件
  subtitleToggle: undefined;
  subtitleLangChange: string;
  subtitleSwitch: { lang: string };

  // 监控相关事件
  monitorStats: Record<string, unknown>;
  monitorBitrate: Record<string, unknown>;
  monitorBuffer: Record<string, unknown>;
  monitorFps: Record<string, unknown>;
  monitorThroughput: Record<string, unknown>;
  monitorStart: undefined;
  monitorStop: undefined;
  monitorSetPlayer: unknown;

  // 互动相关事件
  interactionLike: undefined;
  interactionCoin: undefined;
  interactionCollect: undefined;
  interactionFollow: undefined;
  interactionLinkClick: undefined;
  interactionVoteSelect: { voteIndex: number; optionIndex: number };
  interactionScoreSelect: { scoreIndex: number; value: number };
  interactionCardClose: { type: string; index: number };
  interactionPositionChange: { type: string; index: number; top: number; left: number };

  // 流媒体相关事件
  streamLoadComplete: Record<string, unknown>;
  streamError: { message?: string; error?: unknown; [key: string]: unknown };
  streamStatsUpdate: Record<string, unknown>;
  streamMetadataLoaded: Record<string, unknown>;
  streamPlayStart: undefined;
  streamPlayPause: undefined;
  streamBufferStart: undefined;
  streamBufferEnd: undefined;
  streamNetworkError: Record<string, unknown>;
  streamDecodeError: Record<string, unknown>;
  streamQualityChange: { width: number; height: number; bitrate?: number; isAuto?: boolean };

  // 提示工具相关事件
  tooltipShow: { text: string; x: number; y: number };
  tooltipHide: undefined;
} & Record<string, unknown>;

/** 播放器类型安全事件总线类型 */
export type PlayerEventBus = TypedEventBus<PlayerEventMap>;

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
  /** 发送弹幕 */
  DANMAKU_SEND = 'danmakuSend',
  /** 弹幕发送成功 */
  DANMAKU_SENT = 'danmakuSent',
  /** 清空弹幕 */
  DANMAKU_CLEAR = 'danmakuClear',
  /** 弹幕设置变更 */
  DANMAKU_SETTING_CHANGE = 'danmakuSettingChange',

  // 字幕相关事件
  /** 字幕显示状态改变 */
  SUBTITLE_TOGGLE = 'subtitleToggle',
  /** 字幕语言改变 */
  SUBTITLE_LANG_CHANGE = 'subtitleLangChange',
  /** 字幕切换 */
  SUBTITLE_SWITCH = 'subtitleSwitch',

  // 监控相关事件
  /** 监控数据更新 */
  MONITOR_STATS = 'monitorStats',
  /** 码率信息更新 */
  MONITOR_BITRATE = 'monitorBitrate',
  /** 缓冲区信息更新 */
  MONITOR_BUFFER = 'monitorBuffer',
  /** 帧率信息更新 */
  MONITOR_FPS = 'monitorFps',
  /** 吞吐量信息更新 */
  MONITOR_THROUGHPUT = 'monitorThroughput',
  /** 开始监控 */
  MONITOR_START = 'monitorStart',
  /** 停止监控 */
  MONITOR_STOP = 'monitorStop',
  /** 设置播放器实例到监控器 */
  MONITOR_SET_PLAYER = 'monitorSetPlayer',

  // 互动相关事件
  /** 互动点赞 */
  INTERACTION_LIKE = 'interactionLike',
  /** 互动投币 */
  INTERACTION_COIN = 'interactionCoin',
  /** 互动收藏 */
  INTERACTION_COLLECT = 'interactionCollect',
  /** 互动关注 */
  INTERACTION_FOLLOW = 'interactionFollow',
  /** 外链点击 */
  INTERACTION_LINK_CLICK = 'interactionLinkClick',
  /** 投票选择 */
  INTERACTION_VOTE_SELECT = 'interactionVoteSelect',
  /** 评分选择 */
  INTERACTION_SCORE_SELECT = 'interactionScoreSelect',
  /** 卡片关闭 */
  INTERACTION_CARD_CLOSE = 'interactionCardClose',
  /** 位置变化 */
  INTERACTION_POSITION_CHANGE = 'interactionPositionChange',

  // 流媒体相关事件
  /** 流媒体加载完成 */
  STREAM_LOAD_COMPLETE = 'streamLoadComplete',
  /** 流媒体错误 */
  STREAM_ERROR = 'streamError',
  /** 流媒体统计更新 */
  STREAM_STATS_UPDATE = 'streamStatsUpdate',
  /** 流媒体元数据加载 */
  STREAM_METADATA_LOADED = 'streamMetadataLoaded',
  /** 流媒体播放开始 */
  STREAM_PLAY_START = 'streamPlayStart',
  /** 流媒体播放暂停 */
  STREAM_PLAY_PAUSE = 'streamPlayPause',
  /** 流媒体缓冲开始 */
  STREAM_BUFFER_START = 'streamBufferStart',
  /** 流媒体缓冲结束 */
  STREAM_BUFFER_END = 'streamBufferEnd',
  /** 流媒体网络错误 */
  STREAM_NETWORK_ERROR = 'streamNetworkError',
  /** 流媒体解码错误 */
  STREAM_DECODE_ERROR = 'streamDecodeError',
  /** 流媒体清晰度变化（自动或手动切换），payload: { width, height, bitrate, isAuto } */
  STREAM_QUALITY_CHANGE = 'streamQualityChange',

  // 提示工具相关事件
  /** 显示 tooltip 提示 */
  TOOLTIP_SHOW = 'tooltipShow',
  /** 隐藏 tooltip 提示 */
  TOOLTIP_HIDE = 'tooltipHide',
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
