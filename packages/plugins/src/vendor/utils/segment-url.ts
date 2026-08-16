/**
 * 分片 URL 工具函数
 *
 * 提供从 initialization 自动推导 media 命名模式、
 * 以及后缀替换（HLS .ts 支持）的工具函数。
 */

/**
 * 从 initialization URL 自动推导 media 命名模式
 *
 * 规则：将扩展名前的最后一个数字替换为 * 通配符
 *
 * 示例：
 * - "0-0.m4s"   → "0-*.m4s"
 * - "1-0.m4s"   → "1-*.m4s"
 * - "0-0.ts"    → "0-*.ts"
 * - "seg-0.m4s" → "seg-*.m4s"
 * - "init.m4s"  → null（无法推导，没有数字部分）
 *
 * @param initialization - 初始化段 URL
 * @returns 推导出的 media 模式，无法推导时返回 null
 */
export function deriveMediaPattern(initialization: string): string | null {
  // 匹配扩展名前的最后一个数字（通常是 0，表示初始化段）
  // 例如 "0-0.m4s" 中匹配 ".m4s" 前的 "0"
  const match = initialization.match(/(\d+)(\.\w+)$/);
  if (!match) return null;

  const numberPart = match[1];
  const extension = match[2];
  const prefix = initialization.slice(0, -numberPart.length - extension.length);

  return `${prefix}*${extension}`;
}

/**
 * 替换 URL 模式中的文件后缀
 *
 * 用于 HLS 和 DASH 使用不同文件格式的场景：
 * - DASH 使用 .m4s（fMP4）
 * - HLS 可使用 .ts（MPEG-TS）
 *
 * suffix 不含点号，系统自动添加：
 * - applySuffix("0-*.m4s", "ts")  → "0-*.ts"
 * - applySuffix("0-*.m4s", "m4s") → "0-*.m4s"（不变）
 * - applySuffix("0-*.m4s")        → "0-*.m4s"（不变）
 *
 * @param pattern - URL 模式（含 * 通配符）
 * @param suffix - 目标格式，如 "ts"、"m4s"；不传时不替换
 * @returns 替换后的 URL 模式
 */
export function applySuffix(pattern: string, suffix?: string): string {
  if (!suffix) return pattern;
  // 自动添加点号前缀，替换最后一个扩展名
  return pattern.replace(/\.\w+$/, `.${suffix}`);
}
