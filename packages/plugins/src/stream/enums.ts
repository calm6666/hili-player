/**
 * ============================================
 * 流媒体插件枚举定义
 * ============================================
 */

/**
 * 流媒体插件类型枚举
 * 定义支持的流媒体插件类型
 */
export enum StreamPluginTypeEnum {
  /** FLV 格式插件 */
  FLV = 'FLV',
  /** HLS 格式插件 */
  HLS = 'HLS',
  /** DASH 格式插件 */
  DASH = 'DASH',
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
}

/**
 * 缓冲状态枚举
 */
export enum BufferStatusEnum {
  /** 缓冲中 */
  BUFFERING = 'BUFFERING',
  /** 缓冲完成 */
  BUFFERED = 'BUFFERED',
  /** 缓冲不足 */
  STALLED = 'STALLED',
}

/**
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
  /** 开始缓冲 */
  BUFFER_START = 'BUFFER_START',
  /** 缓冲结束 */
  BUFFER_END = 'BUFFER_END',
  /** 缓冲进度 */
  BUFFER_PROGRESS = 'BUFFER_PROGRESS',

  // 播放事件
  /** 开始播放 */
  PLAY_START = 'PLAY_START',
  /** 播放暂停 */
  PLAY_PAUSE = 'PLAY_PAUSE',
  /** 播放错误 */
  PLAY_ERROR = 'PLAY_ERROR',

  // 元数据事件
  /** 元数据加载完成 */
  METADATA_LOADED = 'METADATA_LOADED',
  /** 统计信息更新 */
  STATS_UPDATE = 'STATS_UPDATE',

  // 错误事件
  /** 流媒体错误 */
  ERROR = 'ERROR',
  /** 网络错误 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 解码错误 */
  DECODE_ERROR = 'DECODE_ERROR',
}
