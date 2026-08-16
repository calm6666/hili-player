/**
 * 日志工具模块
 *
 * 提供统一的日志记录接口，支持 debug/info/warn/error 四个级别。
 * debug 级别日志仅在开启调试模式时输出，其他级别始终输出。
 * 所有日志都带有统一的前缀标识，便于区分来源。
 */

/** 日志记录器接口，定义四个日志级别的签名 */
export interface Logger {
  /** 调试级别日志，仅在 debug 模式开启时输出 */
  debug(...args: unknown[]): void;
  /** 信息级别日志，用于记录一般性运行信息 */
  info(...args: unknown[]): void;
  /** 警告级别日志，用于记录潜在问题 */
  warn(...args: unknown[]): void;
  /** 错误级别日志，用于记录错误信息 */
  error(...args: unknown[]): void;
}

/**
 * 创建日志记录器实例
 *
 * @param debug - 是否开启调试模式（默认 false），开启后 debug 级别日志才会输出
 * @param prefix - 日志前缀字符串（默认 '[StreamPlayer]'），用于标识日志来源
 * @returns Logger 实例
 */
export function createLogger(debug = false, prefix = '[StreamPlayer]'): Logger {
  /** 空函数，用于 debug 关闭时的占位 */
  const noop = (): void => {};

  return {
    debug: debug ? (...args: unknown[]): void => { console.info(`[DEBUG] ${prefix}`, ...args); } : noop,
    info: (...args: unknown[]): void => { console.info(prefix, ...args); },
    warn: (...args: unknown[]): void => { console.warn(prefix, ...args); },
    error: (...args: unknown[]): void => { console.error(prefix, ...args); },
  };
}
