/**
 * ============================================
 * 事件总线
 * ============================================
 * 提供跨组件/插件的事件通信机制
 * 支持类型安全的事件监听和触发
 */

/**
 * 事件总线接口
 * 提供跨组件/插件的事件通信机制
 */
export interface EventBus {
  /**
   * 监听事件
   * @param event - 事件名称
   * @param handler - 事件处理函数
   * @returns 取消监听的函数
   */
  on<T>(event: string, handler: (payload: T) => void): () => void;

  /**
   * 取消监听事件
   * @param event - 事件名称
   * @param handler - 事件处理函数
   */
  off<T>(event: string, handler: (payload: T) => void): void;

  /**
   * 触发事件
   * @param event - 事件名称
   * @param payload - 事件数据（可选）
   */
  emit<T>(event: string, payload?: T): void;
}

/**
 * 创建事件总线实例
 * 提供事件监听和触发功能
 *
 * @returns 事件总线实例
 *
 * @example
 * const events = createEventBus();
 *
 * // 监听事件
 * const unsubscribe = events.on<{ message: string }>('custom:event', (data) => {
 *   console.log(data.message);
 * });
 *
 * // 触发事件
 * events.emit('custom:event', { message: 'Hello' });
 *
 * // 取消监听
 * unsubscribe();
 */
export function createEventBus(): EventBus {
  /**
   * 事件监听器映射表
   * key: 事件名称
   * value: 该事件下的监听器集合
   */
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  return {
    /**
     * 监听事件
     * @param event - 事件名称
     * @param handler - 事件处理函数
     * @returns 取消监听的函数
     */
    on: <T>(event: string, handler: (payload: T) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      const fn = handler as (payload: unknown) => void;
      listeners.get(event)!.add(fn);
      return () => listeners.get(event)?.delete(fn);
    },

    /**
     * 取消监听事件
     * @param event - 事件名称
     * @param handler - 事件处理函数
     */
    off: <T>(event: string, handler: (payload: T) => void) => {
      const fn = handler as (payload: unknown) => void;
      listeners.get(event)?.delete(fn);
    },

    /**
     * 触发事件
     * @param event - 事件名称
     * @param payload - 事件数据（可选）
     */
    emit: <T>(event: string, payload?: T) => {
      listeners.get(event)?.forEach(fn => {
        try {
          fn(payload);
        } catch (e) {
          console.error(e);
        }
      });
    },
  };
}
