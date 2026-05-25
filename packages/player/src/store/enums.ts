/**
 * ============================================
 * Store 枚举定义
 * ============================================
 * 所有枚举键和值统一使用小写字母 + 下划线连接
 *
 * 命名风格参考 B站 store.txt：
 * - bilibili_player_codec_prefer_type
 * - bpx_player_profile
 * - bilibili_player_gpu_renderer
 * - bilibili_player_playback_info_v1
 */

/**
 * 持久化存储键枚举
 * 定义 localStorage 中每一类数据的 key 名称
 *
 * 存储原则：
 * - 主配置用一个 JSON 对象（hili_player_profile），包含所有通用设置
 * - 需要高频独立读取的标量值用独立 key
 * - 弹幕/字幕等插件设置由插件自己管理持久化，不在此处定义
 */
export enum PersistentKeyEnum {
  /** 用户主配置 JSON —— 包含音量、静音、倍速、画面模式、GPU 信息等 */
  profile = 'hili_player_profile',

  /** 编解码器偏好类型 —— 独立 key，对照 bilibili_player_codec_prefer_type */
  codec_prefer_type = 'hili_player_codec_prefer_type',

  /** 编解码器重置版本号 —— 对照 bilibili_player_codec_prefer_reset */
  codec_prefer_reset = 'hili_player_codec_prefer_reset',

  /** GPU 渲染器信息 —— 对照 bilibili_player_gpu_renderer */
  gpu_renderer = 'hili_player_gpu_renderer',

  /** 播放信息（最高画质/音质等）—— 对照 bilibili_player_playback_info_v1 */
  playback_info = 'hili_player_playback_info',

  /** 播放器版本 —— 对照 store.txt version 字段 */
  player_version = 'hili_player_version',

  // ========== 进度条偏好 (PBP = Player Bar Progress) ==========
  /** 进度条高度，对照 pbp_height_v3 */
  pbp_height = 'hili_player_pbp_height',
  /** 进度条不透明度，对照 pbp_opacity_v3 */
  pbp_opacity = 'hili_player_pbp_opacity',
  /** 进度条固定，对照 pbp_pin_v3 */
  pbp_pin = 'hili_player_pbp_pin',
  /** 进度条主题，对照 pbp_theme_v4 */
  pbp_theme = 'hili_player_pbp_theme',
  /** 进度条版本，对照 pbp_version */
  pbp_version = 'hili_player_pbp_version',
  /** 进度条开关状态，对照 pbpstate */
  pbp_state = 'hili_player_pbp_state',
  /** 进度条清晰状态，对照 pbpstate_clear */
  pbp_state_clear = 'hili_player_pbp_state_clear',

  // ============================================
  // 以下由各插件独立管理持久化，不纳入核心 store
  // ============================================
  // 弹幕设置 → 由 DanmakuPlugin 管理，key: hili_player_danmaku
  // 字幕设置 → 由 SubtitlePlugin 管理，key: hili_player_subtitle
  // 交互设置 → 由 InteractionPlugin 管理，key: hili_player_interaction
}

/**
 * 状态键枚举
 * 用于 Store 内部 notify() 的监听器键名
 */
export enum StateKeyEnum {
  // ========== 播放控制状态 ==========
  is_playing = 'is_playing',
  is_paused = 'is_paused',
  is_loading = 'is_loading',
  is_ended = 'is_ended',
  is_waiting = 'is_waiting',
  is_can_play = 'is_can_play',

  // ========== 音量 ==========
  volume = 'volume',
  is_muted = 'is_muted',

  // ========== 播放进度 ==========
  current_time = 'current_time',
  duration = 'duration',
  buffered = 'buffered',

  // ========== 播放速度 ==========
  playback_rate = 'playback_rate',

  // ========== 画质/音质 ==========
  current_quality = 'current_quality',
  current_audio_quality = 'current_audio_quality',
  available_qualities = 'available_qualities',
  available_playback_rates = 'available_playback_rates',

  // ========== 显示模式 ==========
  screen_mode = 'screen_mode',
  is_pip = 'is_pip',
  is_wide_screen = 'is_wide_screen',

  // ========== 编解码器 ==========
  codec_prefer_type = 'codec_prefer_type',

  // ========== 系统信息 ==========
  gpu_renderer = 'gpu_renderer',
  max_video_qn = 'max_video_qn',
  max_audio_qn = 'max_audio_qn',

  // ========== 进度条偏好 (PBP) ==========
  pbp_height = 'pbp_height',
  pbp_opacity = 'pbp_opacity',
  pbp_pin = 'pbp_pin',
  pbp_theme = 'pbp_theme',
  pbp_state = 'pbp_state',
  pbp_state_clear = 'pbp_state_clear',

  // ========== 用户偏好 ==========
  auto_play = 'auto_play',
  auto_quality = 'auto_quality',
  skip_op_ed = 'skip_op_ed',

  // ============================================
  // 以下由各插件自己管理（供参考，不在此处定义）
  // ============================================
  // 弹幕相关 → DanmakuPlugin
  // 字幕相关 → SubtitlePlugin
  // 交互相关 → InteractionPlugin
}

/**
 * 弹幕密度枚举
 */
export enum DanmakuDensityEnum {
  low = 'low',
  normal = 'normal',
  high = 'high',
}

/**
 * 屏幕模式枚举
 */
export enum ScreenModeEnum {
  normal = 'normal',
  wide = 'wide',
  web_fullscreen = 'web_fullscreen',
  fullscreen = 'fullscreen',
}

/**
 * 编解码器偏好类型枚举
 */
export enum CodecPreferTypeEnum {
  auto = 'auto',
  av1 = 'av1',
  hevc = 'hevc',
  avc = 'avc',
}
