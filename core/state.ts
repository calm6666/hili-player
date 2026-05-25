/**
 * ============================================
 * 状态管理器
 * ============================================
 * 提供集中式状态存储和订阅机制
 * 支持路径式访问状态，如 'player.currentTime'
 */

/**
 * 状态管理器接口
 * 提供集中式状态存储和订阅机制
 */
export interface StateManager {
  /**
   * 获取完整状态对象的深拷贝
   * @returns 完整状态对象
   */
  getState(): Record<string, unknown>;

  /**
   * 根据路径获取状态值
   * @param path - 状态路径，如 'player.currentTime'
   * @returns 路径对应的值
   */
  get<R>(path: string): R | undefined;

  /**
   * 设置状态值
   * @param path - 状态路径，如 'player.currentTime'
   * @param value - 要设置的值
   * @param silent - 是否静默设置（不触发监听器），默认 false
   */
  set(path: string, value: unknown, silent?: boolean): void;

  /**
   * 订阅状态变化
   * @param path - 要订阅的状态路径
   * @param listener - 状态变化时的回调函数，接收新值和旧值
   * @returns 取消订阅的函数
   */
  subscribe(path: string, listener: (newVal: unknown, oldVal: unknown) => void): () => void;
}

/**
 * 根据路径获取对象中的值
 * 支持嵌套路径，如 'player.currentTime'
 *
 * @param obj - 源对象
 * @param path - 属性路径，使用点号分隔
 * @returns 路径对应的值，不存在则返回 undefined
 *
 * @example
 * getValue({ player: { currentTime: 10 } }, 'player.currentTime') // 10
 */
function getValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * 根据路径设置对象中的值
 * 自动创建不存在的中间对象
 *
 * @param obj - 目标对象
 * @param path - 属性路径，使用点号分隔
 * @param value - 要设置的值
 *
 * @example
 * setValue({}, 'player.currentTime', 10)
 * // obj 变为 { player: { currentTime: 10 } }
 */
function setValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * 深拷贝对象
 * 递归复制对象及其所有嵌套属性
 *
 * @param obj - 要拷贝的对象
 * @returns 拷贝后的新对象
 */
function clone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(clone) as unknown as T;
  const copy: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = clone((obj as Record<string, unknown>)[key]);
    }
  }
  return copy as T;
}

/**
 * 创建状态管理器实例
 * 提供状态存储、读取、设置和订阅功能
 *
 * @param initial - 初始状态对象
 * @returns 状态管理器实例
 *
 * @example
 * const state = createStateManager({
 *   player: { currentTime: 0, duration: 0 }
 * });
 *
 * // 获取状态
 * const time = state.get('player.currentTime');
 *
 * // 设置状态
 * state.set('player.currentTime', 10);
 *
 * // 订阅状态变化
 * const unsubscribe = state.subscribe('player.currentTime', (newVal, oldVal) => {
 *   console.log(`时间变化: ${oldVal} -> ${newVal}`);
 * });
 */
export function createStateManager(initial: Record<string, unknown> = {}): StateManager {
  /**
   * 深拷贝初始状态，避免外部修改影响内部状态
   */
  const state = clone(initial);

  /**
   * 监听器映射表
   * key: 状态路径
   * value: 该路径下的监听器集合
   */
  const listeners = new Map<string, Set<(newVal: unknown, oldVal: unknown) => void>>();

  /**
   * 通知指定路径的所有监听器
   *
   * @param path - 状态路径
   * @param newVal - 新值
   * @param oldVal - 旧值
   */
  const notify = (path: string, newVal: unknown, oldVal: unknown): void => {
    const set = listeners.get(path);
    if (set) {
      set.forEach(fn => {
        try {
          fn(newVal, oldVal);
        } catch (e) {
          console.error(e);
        }
      });
    }
  };

  return {
    /**
     * 获取完整状态对象的深拷贝
     * @returns 完整状态对象的深拷贝
     */
    getState: () => clone(state),

    /**
     * 根据路径获取状态值
     * @param path - 状态路径，如 'player.currentTime'
     * @returns 路径对应的值
     */
    get: (path: string) => getValue(state, path) as never,

    /**
     * 设置状态值
     * @param path - 状态路径，如 'player.currentTime'
     * @param value - 要设置的值
     * @param silent - 是否静默设置（不触发监听器），默认 false
     */
    set: (path: string, value: unknown, silent = false) => {
      const oldVal = getValue(state, path);
      if (oldVal === value) return;
      setValue(state, path, value);
      if (!silent) notify(path, value, oldVal);
    },

    /**
     * 订阅状态变化
     * @param path - 要订阅的状态路径
     * @param listener - 状态变化时的回调函数
     * @returns 取消订阅的函数
     */
    subscribe: (path: string, listener: (newVal: unknown, oldVal: unknown) => void) => {
      if (!listeners.has(path)) listeners.set(path, new Set());
      listeners.get(path)!.add(listener);
      return () => {
        listeners.get(path)?.delete(listener);
      };
    },
  };
}
