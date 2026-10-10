/**
 * ============================================
 * 插件样式运行时注入工具 (injectPluginStyle)
 * ============================================
 * 插件 CSS 解耦的核心机制：
 * - 插件样式随插件自身的 SCSS 文件维护（通过 Vite `?inline` 导入为字符串），
 *   不再打进播放器样式包；
 * - 插件 install 时调用本工具，把样式以 <style> 标签注入 document.head；
 * - 同一插件多次注入幂等（按 data-lumina-plugin 标识去重）；
 * - 卸载插件时不移除样式（样式表本身无状态，多个播放器实例共享；
 *   移除反而会造成共享实例闪烁），由页面卸载时自然回收。
 *
 * SSR 安全：服务端无 document，直接跳过注入。
 */

/** 已注入样式的标识集合（模块级缓存，跨多个插件实例共享） */
const injectedIds = new Set<string>();

/**
 * 向 document.head 注入插件样式（幂等）
 *
 * @param id - 插件样式唯一标识（写入 data-lumina-plugin 属性，用于去重与调试）
 * @param css - 完整的 CSS 文本（由 `import xxx from './xxx.scss?inline'` 提供）
 */
export function injectPluginStyle(id: string, css: string): void {
  // SSR 环境无 document，跳过注入（水合后 install 会在浏览器侧再次执行）
  if (typeof document === 'undefined') return;

  // 幂等：同 id 样式只注入一次
  if (injectedIds.has(id)) return;

  // 兜底：即使缓存丢失，也通过 DOM 查询防止重复标签
  if (document.querySelector(`style[data-lumina-plugin="${id}"]`)) {
    injectedIds.add(id);
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.setAttribute('data-lumina-plugin', id);
  styleElement.textContent = css;
  document.head.appendChild(styleElement);

  injectedIds.add(id);
}
