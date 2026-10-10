/**
 * 语言包聚合模块
 *
 * 导入内置 en-US / zh-CN 语言包并自动注册到 i18n 注册表。
 * 新增语言只需创建对应 JSON 文件并在此 import + registerLocale。
 */

import enUS from './en-US.json';
import zhCN from './zh-CN.json';
import { registerLocale } from '../i18n';

/**
 * 类型谓词：判断值是否为 Record<string, string>
 * 替代 as 断言，用于校验 JSON 导入结果
 */
function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  for (const v of Object.values(value)) {
    if (typeof v !== 'string') return false;
  }
  return true;
}

// 自动注册内置语言包
if (isStringRecord(enUS)) registerLocale('en-US', enUS);
if (isStringRecord(zhCN)) registerLocale('zh-CN', zhCN);

// 导出内置语言包（供外部按需使用）
export const bundledEnUS: Record<string, string> = isStringRecord(enUS) ? enUS : {};
export const bundledZhCN: Record<string, string> = isStringRecord(zhCN) ? zhCN : {};
