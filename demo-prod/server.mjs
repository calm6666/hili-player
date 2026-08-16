/**
 * demo-prod SSR 服务器
 * ============================================
 * 与 demo/server.mjs 架构完全一致：Vite 中间件模式。
 * demo-prod/ 下无 vite.config.ts，Vite 自动向上查找到根目录的 vite.config.ts，
 * 复用其 resolve.alias（@/core → core/index.ts 等）和 hiliCompile 插件。
 *
 * 启动：node demo-prod/server.mjs
 * 端口：5175
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';

/** ESM 模块中等价于 __dirname */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Express 监听端口，与 dev demo（5174）错开 */
const PORT = 5175;
/** 播放器构建产物的静态样式，SSR 首屏需要显式注入 */
const PLAYER_STYLE_PATH = path.resolve(__dirname, '../packages/player/dist/style.css');

function readTextFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

async function main() {
  const app = express();

  // Vite 中间件模式：TypeScript 即时编译 + HMR + 模块解析
  // root 设为 demo-prod/，并显式使用 demo-prod/vite.config.ts
  const vite = await createViteServer({
    root: path.resolve(__dirname),
    configFile: path.resolve(__dirname, 'vite.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);

  async function collectSSRCss(entryUrl) {
    const cssChunks = [];
    const seenCss = new Set();
    const visited = new Set();

    function addCss(label, cssText) {
      const normalized = cssText.trim();
      if (!normalized || seenCss.has(normalized)) return;
      seenCss.add(normalized);
      cssChunks.push(`/* ${label} */`);
      cssChunks.push(normalized);
    }

    function extractCss(jsCode) {
      const patterns = [
        /__vite__css\s*=\s*"`([\s\S]*?)"`/,
        /__vite__css\s*=\s*"([\s\S]*?)"/,
        /__vite__css\s*=\s*'([\s\S]*?)'/,
        /__vite__css\s*=\s*`([\s\S]*?)`/,
      ];
      for (const pattern of patterns) {
        const match = jsCode.match(pattern);
        if (match) {
          return match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\')
            .replace(/\\t/g, '\t');
        }
      }
      return null;
    }

    async function traverse(mod) {
      if (!mod || visited.has(mod.url)) return;
      visited.add(mod.url);

      const isCss = /\.(css|scss|less|styl|sass)($|\?)/.test(mod.url);
      if (isCss) {
        try {
          const result = await vite.transformRequest(mod.url);
          if (result && result.code) {
            const css = extractCss(result.code);
            if (css) {
              addCss(mod.url, css);
            }
          }
        } catch (e) {
          console.warn('[demo-prod SSR CSS] Failed to collect:', mod.url, e?.message);
        }
      }

      const importedCss = mod.viteMetadata?.importedCss;
      if (importedCss) {
        for (const cssUrl of importedCss) {
          try {
            const result = await vite.transformRequest(cssUrl);
            if (result && result.code) {
              const css = extractCss(result.code);
              if (css) {
                addCss(cssUrl, css);
              }
            }
          } catch (e) {
            console.warn('[demo-prod SSR CSS] Failed to collect imported CSS:', cssUrl, e?.message);
          }
        }
      }

      for (const imported of mod.importedModules) {
        await traverse(imported);
      }
    }

    const entryModule = await vite.moduleGraph.getModuleByUrl(entryUrl, true);
    if (!entryModule) return '';
    await traverse(entryModule);

    // player 构建产物的 CSS 是独立文件，不一定会出现在 Vite 的 SSR 模块图中。
    // 这里作为稳定回退直接注入，保证首屏 SSR 一定有样式。
    const playerCss = readTextFileIfExists(PLAYER_STYLE_PATH);
    if (playerCss) {
      addCss(PLAYER_STYLE_PATH, playerCss);
    }

    return cssChunks.join('\n');
  }

  // SSR 路由：渲染页面
  app.get('/', async (_req, res) => {
    try {
      // 读取 demo-prod 目录下的 HTML 模板
      const tpl = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');

      // vite.ssrLoadModule 在 Node.js 中编译并加载 TypeScript 入口
      const { render, getSSRMeta } = await vite.ssrLoadModule('/entry-server.ts');

      // 将 SSR 渲染结果替换 HTML 中的占位符
      const appHtml = render();
      const ssrCss = await collectSSRCss('/entry-server.ts');
      const meta = getSSRMeta ? getSSRMeta() : { startTime: Date.now(), renderDuration: 0 };
      const metaTags =
        '<meta name="ssr-start-time" content="' + meta.startTime + '" />' +
        '<meta name="ssr-render-duration" content="' + meta.renderDuration.toFixed(2) + '" />';

      let html = tpl.replace('<!--ssr-outlet-->', appHtml);
      html = html.replace('<!--ssr-meta-outlet-->', metaTags);
      html = html.replace('<!--ssr-css-outlet-->', ssrCss ? '<style>' + ssrCss + '</style>' : '');

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      console.error('[demo-prod SSR Error]', e);
      res.status(500).set({ 'Content-Type': 'text/html' }).end(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>` +
        `<body style="background:#1a1a2e;color:#f87171;padding:40px;font-family:monospace;">` +
        `<h2>SSR Error</h2><pre>${e.stack}</pre></body></html>`
      );
    }
  });

  app.listen(PORT, () => {
    console.log(`\n  demo-prod → http://localhost:${PORT}\n`);
  });
}

main().catch(console.error);
