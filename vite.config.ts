import { defineConfig } from 'vite';
import path from 'path';
import { luminaCompile } from './plugins/vite-plugin-lumina-compile';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [
    // 零配置编译插件：自动检测 dev/prod，dev 模式零开销，prod 模式全量优化
    luminaCompile(),
  ],
  resolve: {
    alias: [
      // ===== 精确匹配正则 =====
      { find: /^@\/core$/, replacement: path.resolve(__dirname, 'core/index.ts') },
      { find: /^@\/types$/, replacement: path.resolve(__dirname, 'types/index.ts') },
      { find: /^@\/utils$/, replacement: path.resolve(__dirname, 'utils/index.ts') },
      { find: /^@\/events$/, replacement: path.resolve(__dirname, 'events/index.ts') },
      { find: /^@\/error$/, replacement: path.resolve(__dirname, 'error/index.ts') },
      { find: /^@\/directives$/, replacement: path.resolve(__dirname, 'directives/index.ts') },

      // ===== 子路径正则 =====
      { find: /^@\/lumina\/plugins\/(.*)/, replacement: path.resolve(__dirname, 'packages/plugins/src/$1') },
      { find: /^@\/nova\/(.*)/, replacement: path.resolve(__dirname, 'packages/player/src/$1') },
      { find: /^@\/core\/(.*)/, replacement: path.resolve(__dirname, 'core/$1') },
      { find: /^@\/types\/(.*)/, replacement: path.resolve(__dirname, 'types/$1') },
      { find: /^@\/utils\/(.*)/, replacement: path.resolve(__dirname, 'utils/$1') },
      { find: /^@\/directives\/(.*)/, replacement: path.resolve(__dirname, 'directives/$1') },
      { find: /^@\/events\/(.*)/, replacement: path.resolve(__dirname, 'events/$1') },
      { find: /^@\/error\/(.*)/, replacement: path.resolve(__dirname, 'error/$1') },

      // ===== catch-all =====
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, 'packages/player/src/$1') },

      // ===== 外部库别名 =====
      { find: 'hls.js', replacement: path.resolve(__dirname, 'packages/plugins/hls/dist/hls.mjs') },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  // lottie-web 已通过动态 import() 自动 code-split，无需 manualChunks
});
