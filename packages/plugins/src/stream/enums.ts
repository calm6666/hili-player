/**
 * ============================================
 * 流媒体插件枚举定义
 * ============================================
 */



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
