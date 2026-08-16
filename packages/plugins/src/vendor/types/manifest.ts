/**
 * 统一媒体清单对象类型定义
 *
 * 所有字段使用小驼峰命名（符合 TypeScript 规范）。
 * 这是播放器的唯一入口类型，DASH 和 HLS 共用同一格式。
 * 内部根据播放器类型进行一次性转换，直接生成目标格式。
 *
 * 设计原则：
 * 1. 支持完整的 DASH (MPD) 和 HLS (M3U8) 协议特性
 * 2. 多 CDN 故障切换与 Content Steering
 * 3. URL 解析链：Representation baseUrl → Segment url
 * 4. 字段标注 [必传] 或 [选传]，选传字段标注默认值
 */

// ============================================================================
// 内容转向配置
// ============================================================================

/**
 * 内容转向配置 — 动态 CDN 选择
 *
 * 允许服务器根据客户端网络条件动态调整 CDN 优先级。
 * DASH: 映射为 <ContentSteering> 元素（dash.js v4.7+ 支持）
 * HLS: 映射为 #EXT-X-CONTENT-STEERING 标签（hls.js 完整支持）
 */
export interface ContentSteeringConfig {
  /** 转向服务器 URL [必传]
   * 服务器返回 JSON 格式的 CDN 优先级列表
   * DASH: 映射为 ContentSteering@defaultRedirectUrl
   * HLS: 映射为 #EXT-X-CONTENT-STEERING:SERVER-URI
   */
  serverUrl: string;

  /** 默认 CDN 的 id [选传]
   * 在转向服务器响应前使用的默认 CDN
   * DASH: 映射为 ContentSteering@defaultServiceLocation
   * HLS: 映射为 #EXT-X-CONTENT-STEERING:PATHWAY-ID
   */
  defaultCdnId?: string;

  /** 默认重定向 URL [选传]
   * DASH: 映射为 ContentSteering@defaultRedirectUrl
   */
  defaultRedirectUrl?: string;

  /** 代理服务器 URL [选传]
   * DASH: 映射为 ContentSteering@proxyServerUrl
   * 用于跨域请求转向服务器
   */
  proxyServerUrl?: string;
}

// ============================================================================
// DRM / 内容保护相关类型
// ============================================================================

/**
 * 内容保护描述 — DRM 加密信息
 *
 * DASH: 映射为 <ContentProtection> 元素
 * HLS: 映射为 #EXT-X-KEY 标签
 * 可定义在顶层（全局 DRM）或 Period 内（按 Period 的 DRM）
 */
export interface ContentProtection {
  /** 保护方案标识 URI [必传]
   * 常用值：
   * - "urn:mpeg:dash:mp4protection:2011" — Common Encryption (cenc) 通用加密
   * - "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed" — Widevine
   * - "urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95" — PlayReady
   * - "urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2" — FairPlay
   * - "urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" — ClearKey
   */
  schemeIdUri: string;

  /** 方案值 [选传]
   * 如 "cenc"、"cbcs" 等加密模式
   */
  value?: string;

  /** PSSH (Protection System Specific Header) 数据 [选传]
   * base64 编码的 PSSH box
   * DASH: 映射为 <cenc:pssh> 子元素
   * HLS: 从中提取 keyId 用于 EME 初始化
   */
  pssh?: string;

  /** 默认密钥 ID [选传]
   * UUID 格式，如 "12345678-1234-1234-1234-123456789012"
   * DASH: 映射为 @cenc:defaultKId
   * HLS: 映射为 #EXT-X-KEY:KEYID (0x 前缀十六进制)
   */
  keyId?: string;

  /** 许可证获取 URL [选传]
   * DASH: 映射为 <ms:laurl> 子元素（Widevine/PlayReady）
   * HLS: 通过 drmSystems 配置传入
   */
  laUrl?: string;

  /** PlayReady Object [选传]
   * base64 编码的 PlayReady 权限对象
   * DASH: 映射为 <mspr:pro> 子元素
   */
  pro?: string;
}

/**
 * License Server 配置
 *
 * 播放器通过 License Server 获取解密密钥
 * 支持两种模式：
 * 1. 密钥内嵌（JSON/MPD/M3U8 中包含密钥 URL）：永久密钥，无需过期
 * 2. 密钥外置（JSON 中只含 license URL）：播放时请求 License Server，支持过期
 */
export interface LicenseServer {
  /** License Server URL [必传]
   * ClearKey: http://localhost:8765/api/clearkey/{contentId}
   * AES-128: http://localhost:8765/api/key/{contentId}
   * Widevine: http://localhost:8765/api/license/widevine
   * FairPlay: http://localhost:8765/api/license/fairplay
   */
  url: string;

  /** 内容 ID [选传]
   * 用于从 License Server 获取对应的密钥
   * 如果不传，播放器需要自行从 ContentProtection 或 EXT-X-KEY 中提取
   */
  contentId?: string;

  /** 密钥类型 [选传，默认 "clearkey"]
   * "clearkey" - W3C ClearKey（DASH + HLS 通用）
   * "aes128" - AES-128（HLS 专用）
   * "widevine" - Google Widevine
   * "fairplay" - Apple FairPlay
   * "playready" - Microsoft PlayReady
   */
  keyType?: 'clearkey' | 'aes128' | 'widevine' | 'fairplay' | 'playready';
}

/**
 * AES-128 分片加密配置
 *
 * HLS: 映射为 #EXT-X-KEY:METHOD=AES-128,URI="...",IV="..."
 * DASH: 无直接映射（DASH 使用 ContentProtection + CENC）
 *
 * 不传时表示不加密，传了才用于解密播放。
 * 所有 Representation 共享同一密钥时，在顶层设置；
 * 不同 Representation 使用不同密钥时，在各自 Representation 中设置。
 */
export interface Aes128Encryption {
  /** 密钥获取 URL [必传]
   * 播放器通过此 URL 获取 16 字节 AES-128 密钥
   * HLS: 映射为 #EXT-X-KEY:URI
   */
  keyUrl: string;

  /** 初始化向量（16 字节，hex 编码） [选传]
   * 不传时使用分片序号作为 IV（HLS 默认行为）
   * HLS: 映射为 #EXT-X-KEY:IV=0x...
   */
  iv?: string;

  /** 密钥格式标识 [选传]
   * HLS: 映射为 #EXT-X-KEY:KEYFORMAT
   * 默认 "identity"（AES-128 标准格式）
   * DRM 场景下为 "com.apple.streamingkeydelivery" 等
   */
  keyFormat?: string;

  /** 密钥格式版本 [选传]
   * HLS: 映射为 #EXT-X-KEY:KEYFORMATVERSIONS
   */
  keyFormatVersions?: string;

  /** 密钥过期时间（秒） [选传]
   * 0 或不传 = 永久密钥（MPD/M3U8 内嵌模式）
   * >0 = 临时密钥，播放器需从 License Server 获取
   */
  expiresIn?: number;
}

// ============================================================================
// 音频声道配置
// ============================================================================

/**
 * 音频声道配置
 *
 * DASH: 映射为 <AudioChannelConfiguration> 元素
 * HLS: 映射为 #EXT-X-MEDIA:CHANNELS 属性
 */
export interface AudioChannelConfig {
  /** 声道数 [必传]
   * 1 = 单声道, 2 = 立体声, 6 = 5.1 环绕声, 8 = 7.1 环绕声
   * HLS: 直接作为 CHANNELS 值
   */
  value: number;

  /** 声道配置方案 URI [选传，默认 "urn:mpeg:dash:23003:3:audio_channel_configuration:2011"]
   * DASH: 映射为 AudioChannelConfiguration@schemeIdUri
   * 常用值：
   * - "urn:mpeg:dash:23003:3:audio_channel_configuration:2011" — MPEG 通道配置（最常用）
   * - "urn:dolby:dash:audio_channel_configuration:2011" — Dolby 通道配置
   * - "urn:mpeg:mpegB:cicp:ChannelConfiguration" — CICP 通道配置
   */
  schemeIdUri?: string;
}

// ============================================================================
// 分片相关类型
// ============================================================================

/**
 * 分片时间线条目 — 对应 DASH SegmentTimeline 的 S 元素
 *
 * 用于精确描述每个分片的起始时间和时长，避免浮点精度损失。
 * DASH: 映射为 <S t="" d="" r="" /> 元素
 * HLS: 不使用（HLS 使用 #EXTINF 浮点时长）
 */
export interface SegmentTimelineEntry {
  /** 起始时间（timescale 单位） [选传]
   * 仅第一个 S 元素或时间不连续时需要
   * DASH: 映射为 S@t
   */
  t?: number;

  /** 持续时长（timescale 单位） [必传]
   * DASH: 映射为 S@d
   */
  d: number;

  /** 重复次数（不含自身） [选传]
   * 如 r=63 表示共 64 个相同时长的分片
   * r=-1 表示重复到最后一个分片（仅用于直播）
   * DASH: 映射为 S@r
   */
  r?: number;
}

/**
 * 分片定义 — 描述一个媒体分片
 *
 * 对应 DASH 的 SegmentURL，或 HLS 的 #EXTINF 标签。
 * 仅在多分片模式（mode: 'multi'）下使用。
 */
export interface Segment {
  /** 分片时长（秒） [必传]
   * DASH: 转换为 timescale 单位后使用
   * HLS: 映射为 #EXTINF 的时长值
   */
  duration: number;

  /** 分片 URL [必传]
   * 相对于 Representation.baseUrl 解析，或绝对 URL
   * DASH: 映射为 SegmentURL@media
   * HLS: 映射为分片行的 URL
   */
  url: string;

  /** 分片字节范围 [选传]
   * 格式: "start-end"，如 "5331-123456"
   * DASH: 映射为 SegmentURL@mediaRange
   * HLS: 映射为 #EXT-X-BYTERANGE
   */
  byteRange?: string;
}

/**
 * 分片信息 — 描述媒体数据的组织方式
 *
 * 支持三种模式：
 * 1. 单文件模式（mode: 'single'）：
 *    整个媒体是一个文件，通过字节范围定位初始化段和索引。
 *    DASH: 映射为 <SegmentBase>
 *    HLS: 不支持此模式
 *
 * 2. 模板模式（mode: 'template'）：
 *    通过 URL 模板 + 时间线描述分片，适合大量分片。
 *    DASH: 映射为 <SegmentTemplate> + <SegmentTimeline>
 *    HLS: 在 JS 侧展开为具体分片列表
 *
 * 3. 列表模式（mode: 'list'）：
 *    显式列出每个分片的 URL 和时长，适合少量分片。
 *    DASH: 映射为 <SegmentList> + <SegmentURL>
 *    HLS: 映射为 #EXTINF 分片列表
 */
export interface SegmentInfo {
  /** 分片模式 [必传]
   * 'single'  — 单文件字节范围模式（DASH SegmentBase）
   * 'template' — URL 模板模式（DASH SegmentTemplate + SegmentTimeline）
   * 'list'     — 显式分片列表模式（DASH SegmentList / HLS #EXTINF）
   */
  mode: 'single' | 'template' | 'list';

  // ---- 通用字段 ----

  /** 时间刻度 [选传，默认 1]
   * DASH 专用，将秒级时长转为整数刻度以避免浮点精度损失
   * 视频通常为 1000 * 帧率（如 60000 = 1000 * 59.94），音频通常为采样率（如 48000）
   * HLS: 不使用（HLS 使用 #EXTINF 浮点时长）
   * DASH: 映射为 SegmentTemplate@timescale / SegmentList@timescale
   *
   * 示例：targetDuration=4.170833, timescale=60000 → duration=250250（精确）
   *       targetDuration=4.170833, timescale=1     → duration=4（不精确，导致画面重叠）
   */
  timescale?: number;

  /** 呈现时间偏移（timescale 单位） [选传，默认 0]
   * DASH: 映射为 @presentationTimeOffset
   * 用于 Period 间时间对齐或多 Period 场景
   */
  presentationTimeOffset?: number;

  // ---- 通用分片字段 ----

  /** 初始化段 [选传，根据 mode 语义不同]
   *
   * - single 模式：初始化段的字节范围，如 "0-934"
   *   DASH: 映射为 SegmentBase.Initialization@range
   *   参考 Bilibili playurl API 的 SegmentBase.Initialization 字段
   *
   * - template/list 模式：初始化段 URL，相对于 Representation.baseUrl 解析，或绝对 URL
   *   DASH: 映射为 SegmentTemplate@initialization / SegmentList.Initialization@sourceURL
   *   HLS: 映射为 #EXT-X-MAP:URI
   *   fMP4 格式必须提供此字段
   */
  initialization?: string;

  /** sidx 索引的字节范围 [single 模式必传]
   * 如 "935-5330"
   * DASH: 映射为 SegmentBase@indexRange
   */
  indexRange?: string;

  // ---- 模板模式字段（mode: 'template'） ----

  /** 目标分片时长（秒） [template 模式推荐填写]
   * DASH: 配合 timescale 计算 SegmentTemplate@duration
   * HLS: 映射为 #EXT-X-TARGETDURATION
   */
  targetDuration?: number;

  /**
   * 分片 URL 命名模式 [template/list 模式选传，不传时自动推导]
   *
   * 使用 * 通配符表示分片序号位置，直观简洁，无需暴露协议模板变量。
   * 内部自动转换为 DASH SegmentTemplate 语法（* → $Number$）和 HLS 分片 URL 列表。
   *
   * 不传时，从 initialization 自动推导命名规则：
   * - "0-0.m4s" → "0-*.m4s"（替换扩展名前的数字为 *）
   * - "1-0.m4s" → "1-*.m4s"
   *
   * 示例:
   *   "0-*.m4s"   → "0-1.m4s", "0-2.m4s", ...
   *   "seg-*.m4s" → "seg-1.m4s", "seg-2.m4s", ...
   *   "0-*.ts"    → "0-1.ts", "0-2.ts", ...（HLS MPEG-TS）
   */
  media?: string;

  /** 分片起始序号 [选传，默认 1]
   * DASH: 映射为 SegmentTemplate@startNumber / SegmentList@startNumber
   * HLS: 映射为 #EXT-X-MEDIA-SEQUENCE
   */
  startNumber?: number;

  /** 分片总数 [选传]
   * 显式指定分片数量，优先于从 duration/targetDuration 计算。
   * 适用于分片数量已知但时长不精确的场景。
   * 不传时，从 duration / targetDuration 自动计算。
   */
  totalCount?: number;

  /**
   * 分片文件格式 [选传，默认从 initialization 或 media 推导]
   *
   * 用于 HLS 和 DASH 使用不同文件格式的场景：
   * - 不传时，使用 initialization/media 中的后缀（通常为 m4s）
   * - 传 "ts" 时，HLS 转换器将后缀替换为 .ts（MPEG-TS 格式）
   * - DASH 转换器始终使用原始后缀（.m4s）
   *
   * 示例:
   *   initialization: "0-0.m4s", suffix: "ts"
   *   → DASH: "0-$Number$.m4s"
   *   → HLS:  "0-1.ts", "0-2.ts", ...
   */
  suffix?: string;

  /**
   * 分片时间线条目 [template 模式选传，推荐填写以获得精确时间戳]
   *
   * 直接提供 SegmentTimeline 的 S 元素数组，避免从 duration 推算的精度损失。
   * DASH: 映射为 <SegmentTimeline> 子元素
   * HLS: 不使用（HLS 使用 #EXTINF 浮点时长）
   *
   * 示例（视频 timescale=60000, 64个标准分片 + 1个最后分片）：
   * [
   *   { t: 0, d: 250250, r: 63 },  // 64个标准分片
   *   { d: 80080 }                   // 最后分片
   * ]
   *
   * 不设置时，从 targetDuration 和 duration 自动推算（精度较低）。
   */
  segmentTimeline?: SegmentTimelineEntry[];

  // ---- 列表模式字段（mode: 'list'） ----

  /** 完整分片列表 [list 模式选传]
   * 不传时，从 media + startNumber + totalCount 自动生成分片列表。
   * 仅在分片时长不一致且需要精确控制每个分片时使用。
   * DASH: 映射为 <SegmentList> + <SegmentURL>
   * HLS: 映射为 #EXTINF 分片列表
   */
  segments?: Segment[];

  // ---- HLS 专用字段 ----

  /** 媒体序列号起始值 [选传，默认 0]
   * HLS: 映射为 #EXT-X-MEDIA-SEQUENCE
   * DASH: 不使用
   */
  mediaSequence?: number;
}

// ============================================================================
// 媒体表示类型
// ============================================================================

/**
 * 媒体表示 — 描述一个特定清晰度的视频流或音频流
 *
 * 对应 DASH 的 Representation 或 HLS 的 Variant Stream / Audio Rendition。
 * video 和 audio 共用此类型，通过 mimeType 区分。
 *
 * URL 解析规则（优先级从高到低）：
 * 1. 以 http:// 或 https:// 开头 → 绝对 URL，直接使用
 * 2. 以 / 开头 → 根路径，拼接 CDN 域名
 * 3. 其他 → 相对路径，拼接上级 URL
 *
 * 多 CDN 故障切换：
 * - baseUrl 为主 URL，优先使用
 * - backupUrls 为备用 URL 列表，主 URL 请求失败时按顺序切换
 * - 参考 Bilibili playurl API 的 baseUrl + backupUrl 模式
 */
export interface MediaRepresentation {
  /** 表示 ID [必传]
   * 唯一标识此流，同一 Period 内不可重复
   * DASH: 映射为 Representation@id
   * HLS: 用于内部标识
   */
  id: number | string;

  /** 主 URL [选传，不传时默认当前域]
   * 作为此 Representation 下所有 segment URL 的基础路径。
   * 参考 Bilibili playurl API 的 baseUrl 字段。
   *
   * URL 解析规则（优先级从高到低）：
   * 1. segment URL 以 http:// 或 https:// 开头 → 绝对 URL，忽略 baseUrl
   * 2. segment URL 以 / 开头 → 根路径，忽略 baseUrl
   * 3. segment URL 为相对路径 → 拼接 baseUrl
   * 4. baseUrl 未提供 → segment URL 视为绝对或根路径
   *
   * 用法示例：
   * - 单文件模式: "https://cdn-a.example.com/video.m4s"
   * - 模板/列表模式: "/test/" 或 "https://cdn-a.example.com/stream/"
   * - 不传时，segmentInfo 中的 URL 必须是绝对路径或根路径
   */
  baseUrl?: string;

  /** 备用 URL 列表 [选传]
   * 主 URL 请求失败时按顺序切换到备用 URL
   * 单文件模式：备用完整 URL 列表
   * 模板/列表模式：备用基础路径列表
   *
   * DASH: 映射为 Representation<BaseURL> 的后续元素（带 serviceLocation 属性）
   * HLS: 用于 CDN 故障切换
   *
   * 参考 Bilibili playurl API 的 backupUrl 字段
   *
   * 示例：
   * - 单文件模式: ["https://cdn-b.example.com/video.m4s", "https://cdn-c.example.com/video.m4s"]
   * - 模板模式: ["/backup/", "https://cdn-b.example.com/stream/"]
   */
  backupUrls?: string[];

  /** 带宽（bps） [必传]
   * DASH: 映射为 Representation@bandwidth
   * HLS: 映射为 #EXT-X-STREAM-INF:BANDWIDTH
   */
  bandwidth: number;

  /** 平均带宽（bps） [选传]
   * DASH: 无直接映射
   * HLS: 映射为 #EXT-X-STREAM-INF:AVERAGE-BANDWIDTH
   * 优先于 bandwidth 用于 ABR 选择
   */
  averageBandwidth?: number;

  /** MIME 类型 [必传]
   * 视频: "video/mp4"，音频: "audio/mp4"
   * DASH: 映射为 AdaptationSet@mimeType 或 Representation@mimeType
   * HLS: 从 codecs 推断
   */
  mimeType: string;

  /** 编码格式字符串 [必传]
   * 如 "avc1.640033"（H.264）, "hvc1.1.6.L93.B0"（H.265）, "mp4a.40.2"（AAC-LC）,
   * "ec-3"（Dolby Digital Plus）, "ac-4"（Dolby AC-4）
   * DASH: 映射为 Representation@codecs
   * HLS: 映射为 #EXT-X-STREAM-INF:CODECS
   */
  codecs: string;

  // ---- 视频专用字段 ----

  /** 视频宽度（像素） [视频必传]
   * DASH: 映射为 Representation@width
   * HLS: 映射为 #EXT-X-STREAM-INF:RESOLUTION 宽度部分
   */
  width?: number;

  /** 视频高度（像素） [视频必传]
   * DASH: 映射为 Representation@height
   * HLS: 映射为 #EXT-X-STREAM-INF:RESOLUTION 高度部分
   */
  height?: number;

  /** 帧率 [视频选传]
   * DASH: 映射为 Representation@frameRate
   * HLS: 映射为 #EXT-X-STREAM-INF:FRAME-RATE
   */
  frameRate?: number;

  /** 采样宽高比 [选传]
   * 如 "1:1"、"1280:1281"
   * DASH: 映射为 Representation@sar
   * HLS: 无直接映射
   */
  sar?: string;

  /** 视频范围 [选传]
   * "SDR" | "PQ" (HDR10/Dolby Vision) | "HLG" (HDR HLG)
   * DASH: 无直接映射（通过 SupplementalProperty 描述）
   * HLS: 映射为 #EXT-X-STREAM-INF:VIDEO-RANGE
   */
  videoRange?: 'SDR' | 'PQ' | 'HLG';

  // ---- 音频专用字段 ----

  /** 音频采样率 [音频选传]
   * DASH: 映射为 Representation@audioSamplingRate
   * HLS: 无直接映射
   */
  audioSamplingRate?: number;

  /** 音频声道配置 [音频选传]
   * DASH: 映射为 <AudioChannelConfiguration> 元素
   * HLS: 映射为 #EXT-X-MEDIA:CHANNELS
   * 不设置时默认立体声（2声道）
   */
  channelConfig?: AudioChannelConfig;

  // ---- 语言与角色 ----

  /** 语言标签 [音频/字幕选传，视频不使用]
   * BCP 47 格式，如 "en"、"zh"、"ja"、"ko"
   * DASH: 映射为 AdaptationSet@lang
   * HLS: 映射为 #EXT-X-MEDIA:LANGUAGE
   */
  lang?: string;

  /** 角色描述 [选传]
   * DASH: 映射为 <Role> 元素的 value 属性
   * HLS: 映射为 #EXT-X-MEDIA:CHARACTERISTICS
   *
   * 音频常用值：
   * - "main" — 主音频轨道
   * - "alternate" — 备用音频
   * - "commentary" — 评论音轨
   * - "dub" — 配音
   * - "description" — 音频描述（视障辅助）
   *
   * 字幕常用值：
   * - "subtitle" — 字幕
   * - "caption" — 闭路字幕
   * - "forced-subtitle" — 强制字幕
   */
  role?: string;

  /** 显示名称 [选传]
   * DASH: 映射为 <Label> 元素
   * HLS: 映射为 #EXT-X-MEDIA:NAME
   * 如 "English 5.1"、"导演评论"
   */
  name?: string;

  /** 是否为默认轨道 [选传，默认 false]
   * DASH: 无直接映射（通过 Role@value="main" 判断）
   * HLS: 映射为 #EXT-X-MEDIA:DEFAULT=YES
   */
  isDefault?: boolean;

  /** 是否自动选择 [选传，默认 false]
   * HLS: 映射为 #EXT-X-MEDIA:AUTOSELECT=YES
   * DASH: 无直接映射
   */
  autoSelect?: boolean;

  // ---- 分片信息 ----

  /** 分片信息 [必传]
   * 描述如何定位和加载此流的媒体数据
   */
  segmentInfo: SegmentInfo;

  // ---- 加密 ----

  /** AES-128 分片加密配置 [选传]
   * 不传时表示不加密，传了才用于解密播放
   * HLS: 映射为 #EXT-X-KEY:METHOD=AES-128
   * DASH: 无直接映射（DASH 使用 contentProtection 字段）
   */
  encryption?: Aes128Encryption;
}

// ============================================================================
// 字幕相关类型
// ============================================================================

/**
 * 字幕表示 — 描述一个字幕轨道
 *
 * DASH: 映射为 AdaptationSet(contentType="text") + Representation
 * HLS: 映射为 #EXT-X-MEDIA:TYPE=SUBTITLES 或 TYPE=CLOSED-CAPTIONS
 */
export interface SubtitleRepresentation {
  /** 字幕轨道 ID [必传] */
  id: number | string;

  /** 字幕基础路径 [选传]
   * 语义同 MediaRepresentation.baseUrl
   */
  baseUrl?: string;

  /** MIME 类型 [必传]
   * "text/vtt" — WebVTT
   * "application/ttml+xml" — TTML (IMSC1)
   * "application/mp4" — stpp (TTML in MP4，需要 segmentInfo)
   */
  mimeType: string;

  /** 编码格式 [选传]
   * "wvtt" — WebVTT
   * "stpp" — TTML in MP4
   * "imsc1" — IMSC1
   */
  codecs?: string;

  /** 语言标签 [必传]
   * BCP 47 格式，如 "en"、"zh"
   * DASH: 映射为 AdaptationSet@lang
   * HLS: 映射为 #EXT-X-MEDIA:LANGUAGE
   */
  lang: string;

  /** 角色描述 [选传，默认 "subtitle"]
   * "subtitle" — 字幕
   * "caption" — 闭路字幕
   * "forced-subtitle" — 强制字幕
   * DASH: 映射为 <Role> 元素
   * HLS: 映射为 #EXT-X-MEDIA:CHARACTERISTICS
   */
  role?: string;

  /** 显示名称 [选传]
   * DASH: 映射为 <Label>
   * HLS: 映射为 #EXT-X-MEDIA:NAME
   */
  name?: string;

  /** 是否为默认字幕 [选传，默认 false]
   * HLS: 映射为 #EXT-X-MEDIA:DEFAULT=YES
   */
  isDefault?: boolean;

  /** 是否为强制字幕 [选传，默认 false]
   * HLS: 映射为 #EXT-X-MEDIA:FORCED=YES
   * 强制字幕通常在无法关闭的情况下显示（如外语片段翻译）
   */
  forced?: boolean;

  /** 字幕特征描述 [选传]
   * HLS: 映射为 #EXT-X-MEDIA:CHARACTERISTICS
   * 如 "public.accessibility.describes-music-and-sound"
   */
  characteristics?: string;

  /** 分片信息 [选传]
   * 仅 stpp (TTML in MP4) 等分片字幕格式需要
   * WebVTT/TTML 侧载字幕不需要此字段
   */
  segmentInfo?: SegmentInfo;
}

// ============================================================================
// 直播相关类型
// ============================================================================

/**
 * 直播配置 — 描述直播流的参数
 *
 * 当 MediaManifest.live = true 时使用此配置。
 * DASH: 映射为 MPD@type="dynamic" 及相关属性
 * HLS: 映射为无 #EXT-X-ENDLIST 的媒体播放列表
 */
export interface LiveConfig {
  /** 直播类型 [必传]
   * 'live' — 真正的直播流，窗口持续滑动
   * 'event' — 事件流，分片只增不减，最终可能变为点播
   * DASH: live → type="dynamic", event → type="dynamic" + minimumUpdatePeriod
   * HLS: live → 无 #EXT-X-PLAYLIST-TYPE, event → #EXT-X-PLAYLIST-TYPE:EVENT
   */
  type: 'live' | 'event';

  /** 时移窗口深度（秒） [选传]
   * 观众可以回看的时间范围
   * DASH: 映射为 MPD@timeShiftBufferDepth
   * HLS: 由 #EXT-X-SERVER-CONTROL:HOLD-BACK 控制
   */
  timeShiftBufferDepth?: number;

  /** MPD/清单刷新周期（秒） [选传]
   * DASH: 映射为 MPD@minimumUpdatePeriod
   * HLS: 由 #EXT-X-TARGETDURATION 决定刷新间隔
   */
  minimumUpdatePeriod?: number;

  /** 分片可用起始时间 [选传]
   * ISO 8601 日期时间格式，如 "2024-01-01T00:00:00Z"
   * DASH: 映射为 MPD@availabilityStartTime
   * HLS: 不使用
   */
  availabilityStartTime?: string;

  /** MPD 发布时间 [选传]
   * ISO 8601 日期时间格式
   * DASH: 映射为 MPD@publishTime
   * HLS: 不使用
   */
  publishTime?: string;

  // ---- 低延迟 HLS 专用 ----

  /** 部分段目标时长（秒） [选传，低延迟 HLS 使用]
   * HLS: 映射为 #EXT-X-PART-INF:PART-TARGET
   */
  partTargetDuration?: number;

  /** 是否支持阻塞重载 [选传，默认 false]
   * HLS: 映射为 #EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD
   */
  canBlockReload?: boolean;

  /** 可跳过边界（秒） [选传，低延迟 HLS 使用]
   * HLS: 映射为 #EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL
   */
  canSkipUntil?: number;

  /** 保持回退时间（秒） [选传]
   * HLS: 映射为 #EXT-X-SERVER-CONTROL:HOLD-BACK
   */
  holdBack?: number;

  /** 部分段保持回退时间（秒） [选传]
   * HLS: 映射为 #EXT-X-SERVER-CONTROL:PART-HOLD-BACK
   */
  partHoldBack?: number;
}

// ============================================================================
// 时段（Period）相关类型
// ============================================================================

/**
 * 时段定义 — 多 Period 支持
 *
 * 用于广告插入、多集连播、编码格式切换等场景。
 * DASH: 映射为 <Period> 元素（dash.js 完整支持多 Period）
 * HLS: 不支持多 Period（HLS 无此概念，需特殊处理如 Interstitials）
 */
export interface Period {
  /** 时段 ID [必传] */
  id: string;

  /** 起始时间（秒） [必传]
   * DASH: 映射为 Period@start（对象模式下必须为数字秒，不能是 ISO 8601 字符串）
   */
  start: number;

  /** 时长（秒） [选传]
   * DASH: 映射为 Period@duration
   * 不设置时由下一个 Period 的 start 推算，或由 MPD 的 mediaPresentationDuration 决定
   */
  duration?: number;

  /** 视频流列表 [必传，至少一个] */
  video: MediaRepresentation[];

  /** 音频流列表 [选传] */
  audio?: MediaRepresentation[];

  /** 字幕流列表 [选传] */
  subtitle?: SubtitleRepresentation[];

  /** 内容保护（DRM） [选传]
   * 此 Period 专用的 DRM 配置，覆盖顶层 contentProtection
   */
  contentProtection?: ContentProtection[];
}

// ============================================================================
// UTC 时钟同步
// ============================================================================

/**
 * UTC 时钟同步 — 用于直播流的时间校准
 *
 * DASH: 映射为 <UTCTiming> 元素
 * HLS: 不使用（HLS 使用 #EXT-X-PROGRAM-DATE-TIME）
 */
export interface UtcTiming {
  /** 时钟方案标识 URI [必传]
   * 常用值：
   * - "urn:mpeg:dash:utc:http-xsdate:2014" — HTTP XSDate
   * - "urn:mpeg:dash:utc:http-iso:2014" — HTTP ISO 8601
   * - "urn:mpeg:dash:utc:http-head:2014" — HTTP HEAD（使用 Date 响应头）
   */
  schemeIdUri: string;

  /** 时钟源 URL 或值 [必传] */
  value: string;
}

// ============================================================================
// 事件流
// ============================================================================

/**
 * 事件流描述 — 用于带内事件通知
 *
 * DASH: 映射为 <InbandEventStream> 元素
 * HLS: 不使用（HLS 使用 #EXT-X-DATERANGE）
 */
export interface EventStream {
  /** 事件方案标识 URI [必传] */
  schemeIdUri: string;

  /** 事件值 [选传] */
  value?: string;

  /** 时间刻度 [选传，默认 1] */
  timescale?: number;
}

// ============================================================================
// 补充/必需属性
// ============================================================================

/**
 * 补充属性 — 描述非必需的附加信息
 *
 * 如果客户端不识别此属性，可以忽略该属性但不忽略所属元素。
 * DASH: 映射为 <SupplementalProperty> 元素
 */
export interface SupplementalProperty {
  /** 属性方案标识 URI [必传] */
  schemeIdUri: string;

  /** 属性值 [必传] */
  value: string;
}

/**
 * 必需属性 — 描述客户端必须识别的属性
 *
 * 如果客户端不识别此属性，必须忽略整个所属元素。
 * DASH: 映射为 <EssentialProperty> 元素
 */
export interface EssentialProperty {
  /** 属性方案标识 URI [必传] */
  schemeIdUri: string;

  /** 属性值 [必传] */
  value: string;
}

// ============================================================================
// 统一清单对象 — 播放器的唯一入口类型
// ============================================================================

/**
 * 统一媒体清单对象 — 播放器的唯一入口类型
 *
 * 所有字段使用小驼峰命名，内部一次性转换为目标格式。
 * DASH 和 HLS 共用同一格式，由播放器内部区分处理。
 *
 * URL 解析规则（优先级从高到低）：
 * 1. 以 http:// 或 https:// 开头 → 绝对 URL，直接使用
 * 2. 以 / 开头 → 根路径，拼接 CDN 域名
 * 3. 其他 → 相对路径，拼接上级 URL
 *
 * 多 CDN 故障切换：
 * 每个 Representation 通过 baseUrl + backupUrls 定义主备 URL，
 * 主 URL 失败时自动切换到备用 URL，参考 Bilibili playurl API 模式。
 */
export interface MediaManifest {
  // ========================================================================
  // 内容转向
  // ========================================================================

  /** 内容转向配置 [选传]
   * 动态 CDN 选择，根据客户端网络条件调整 CDN 优先级
   * DASH: 映射为 <ContentSteering> 元素
   * HLS: 映射为 #EXT-X-CONTENT-STEERING 标签
   */
  contentSteering?: ContentSteeringConfig;

  // ========================================================================
  // 基本信息
  // ========================================================================

  /** 视频总时长（秒） [必传]
   * DASH: 映射为 MPD@mediaPresentationDuration（对象模式下必须为数字秒）
   * HLS: 用于计算播放列表总时长和 endList 设置
   */
  duration: number;

  /** 最小缓冲时间（秒） [选传，默认 1.5]
   * DASH: 映射为 MPD@minBufferTime（对象模式下必须为数字秒）
   * HLS: 不使用（HLS 由播放器自行决定缓冲策略）
   */
  minBufferTime?: number;

  /** 最大分片时长（秒） [选传]
   * DASH: 映射为 MPD@maxSegmentDuration
   * HLS: 不使用
   */
  maxSegmentDuration?: number;

  /** 内容标题 [选传]
   * DASH: 映射为 ProgramInformation@Title
   * HLS: 不使用
   */
  title?: string;

  // ========================================================================
  // 媒体轨道
  // ========================================================================

  /** 视频流列表 [必传，至少一个]
   * 按带宽从高到低排序
   * DASH: 映射为 AdaptationSet(contentType="video") 下的 Representation 列表
   * HLS: 映射为 #EXT-X-STREAM-INF 变体流列表
   */
  video: MediaRepresentation[];

  /** 音频流列表 [选传]
   * DASH: 映射为 AdaptationSet(contentType="audio") 下的 Representation 列表
   * HLS: 映射为 #EXT-X-MEDIA:TYPE=AUDIO 音频轨道列表
   */
  audio?: MediaRepresentation[];

  /** 字幕流列表 [选传]
   * DASH: 映射为 AdaptationSet(contentType="text") 下的 Representation 列表
   * HLS: 映射为 #EXT-X-MEDIA:TYPE=SUBTITLES 字幕轨道列表
   */
  subtitle?: SubtitleRepresentation[];

  // ========================================================================
  // 多时段（Period）
  // ========================================================================

  /** 时段列表 [选传]
   * 如果定义了 periods，则忽略顶层的 video/audio/subtitle/contentProtection
   * 每个 Period 独立定义媒体轨道和 DRM
   * DASH: 映射为多个 <Period> 元素
   * HLS: 不支持多 Period（需特殊处理）
   */
  periods?: Period[];

  // ========================================================================
  // 内容保护（DRM）
  // ========================================================================

  /** 内容保护列表 [选传]
   * 全局 DRM 配置，适用于所有 Period
   * 如果 Period 内也定义了 contentProtection，则 Period 级别的优先
   * DASH: 映射为 AdaptationSet 下的 <ContentProtection> 元素
   * HLS: 映射为 #EXT-X-KEY 标签
   */
  contentProtection?: ContentProtection[];

  /** AES-128 分片加密配置 [选传]
   * 全局 AES-128 加密，适用于所有 Representation
   * 不传时表示不加密，传了才用于解密播放
   * Representation 级别的 encryption 优先于全局
   * HLS: 映射为 #EXT-X-KEY:METHOD=AES-128
   * DASH: 无直接映射（DASH 使用 contentProtection 字段）
   */
  encryption?: Aes128Encryption;

  /** License Server 配置 [选传]
   * 播放器通过此配置获取解密密钥
   * 适用于密钥不在 JSON/MPD/M3U8 中内嵌的场景
   */
  licenseServer?: LicenseServer;

  // ========================================================================
  // 直播
  // ========================================================================

  /** 是否为直播流 [选传，默认 false（点播）]
   * DASH: true → MPD@type="dynamic", false → MPD@type="static"
   * HLS: true → 无 #EXT-X-ENDLIST, false → 有 #EXT-X-ENDLIST
   */
  live?: boolean;

  /** 直播配置 [选传，live=true 时推荐填写]
   * 详细直播参数，包括时移窗口、刷新周期、低延迟等
   */
  liveConfig?: LiveConfig;

  // ========================================================================
  // 播放控制
  // ========================================================================

  /** 起始播放偏移（秒） [选传]
   * 正值从开头偏移，负值从末尾偏移
   * DASH: 映射为 Period@start 或通过 Representation@presentationTimeOffset
   * HLS: 映射为 #EXT-X-START:TIME-OFFSET
   */
  startTimeOffset?: number;

  /** 起始偏移是否精确 [选传，默认 false]
   * true: 必须从指定时间开始播放（可能需要等待关键帧）
   * false: 可以从最近的键帧开始播放
   * HLS: 映射为 #EXT-X-START:PRECISE
   */
  startPrecise?: boolean;

  // ========================================================================
  // MPD/清单刷新
  // ========================================================================

  /** 清单重定向 URL [选传]
   * 刷新清单时从该 URL 获取新版本
   * DASH: 映射为 <Location> 元素
   * HLS: 不使用
   */
  location?: string;

  /** MPD 最小更新周期（秒） [选传]
   * DASH: 映射为 MPD@minimumUpdatePeriod
   * HLS: 不使用（HLS 通过 #EXT-X-TARGETDURATION 决定刷新间隔）
   */
  minimumUpdatePeriod?: number;

  // ========================================================================
  // 时钟同步
  // ========================================================================

  /** UTC 时钟同步配置 [选传，直播推荐]
   * DASH: 映射为 <UTCTiming> 元素
   * HLS: 不使用
   */
  utcTiming?: UtcTiming[];

  // ========================================================================
  // 事件与属性
  // ========================================================================

  /** 带内事件流列表 [选传]
   * DASH: 映射为 <InbandEventStream> 元素
   * HLS: 不使用
   */
  eventStreams?: EventStream[];

  /** 补充属性列表 [选传]
   * DASH: 映射为 <SupplementalProperty> 元素
   */
  supplementalProperties?: SupplementalProperty[];

  /** 必需属性列表 [选传]
   * DASH: 映射为 <EssentialProperty> 元素
   */
  essentialProperties?: EssentialProperty[];
}
