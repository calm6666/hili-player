/**
 * ============================================
 * 智能合并工具函数
 * ============================================
 * 提供对象深度合并功能，返回变更的属性列表
 */

import type { MergeResult } from '@/hili-player/types';

/**
 * 深度克隆对象
 * @param obj - 要克隆的对象
 * @returns 克隆后的对象
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (Array.isArray(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * 智能合并两个对象
 * @param target - 目标对象
 * @param source - 源对象
 * @returns 合并结果，包含变更的属性列表
 */
export function smartMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): MergeResult<T> {
  const result = deepClone(target);
  const changedProps: Array<{ key: string; oldVal: string | number | boolean | null; newVal: string | number | boolean | null }> = [];

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const oldVal = result[key];
      const newVal = source[key];

      if (oldVal !== newVal) {
        changedProps.push({
          key,
          oldVal: oldVal as string | number | boolean | null,
          newVal: newVal as string | number | boolean | null,
        });
        (result as Record<string, unknown>)[key] = newVal;
      }
    }
  }

  return { target: result, changedProps };
}
