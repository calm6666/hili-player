/**
 * URL 解析工具函数
 *
 * 将相对 URL 相对于 baseUrl 解析为完整 URL。
 * 遵循标准 URL 解析规则：
 * 1. 绝对 URL（http:// 或 https:// 开头）→ 直接返回
 * 2. 根路径（/ 开头）→ 直接返回
 * 3. 相对路径 → 拼接 baseUrl
 * 4. 无 baseUrl → 直接返回
 */

/**
 * 将相对 URL 解析为完整 URL
 *
 * @param baseUrl - 基础路径，如 "/test/" 或 "https://cdn.example.com/stream/"
 * @param relativeUrl - 待解析的 URL，如 "0-0.m4s" 或 "/test/0-0.m4s"
 * @returns 解析后的完整 URL
 */
export function resolveUrl(baseUrl: string | undefined, relativeUrl: string): string {
  /* 绝对 URL 或根路径，直接返回 */
  if (
    relativeUrl.startsWith('http://') ||
    relativeUrl.startsWith('https://') ||
    relativeUrl.startsWith('/')
  ) {
    return relativeUrl;
  }

  /* 无 baseUrl，直接返回 */
  if (!baseUrl) {
    return relativeUrl;
  }

  /* 相对路径：拼接 baseUrl */
  if (baseUrl.endsWith('/')) {
    return baseUrl + relativeUrl;
  }
  return baseUrl + '/' + relativeUrl;
}
