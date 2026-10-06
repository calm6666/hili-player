import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['core/**/*.ts', 'packages/player/src/**/*.ts', 'packages/plugins/src/**/*.ts'],
    },
  },
  resolve: {
    alias: [
      // ===== 精确匹配正则（必须放在子路径和 catch-all 之前）=====
      { find: /^@\/core$/, replacement: path.resolve(__dirname, 'core/index.ts') },
      { find: /^@\/types$/, replacement: path.resolve(__dirname, 'types/index.ts') },
      { find: /^@\/utils$/, replacement: path.resolve(__dirname, 'utils/index.ts') },
      { find: /^@\/events$/, replacement: path.resolve(__dirname, 'events/index.ts') },
      { find: /^@\/error$/, replacement: path.resolve(__dirname, 'error/index.ts') },
      { find: /^@\/directives$/, replacement: path.resolve(__dirname, 'directives/index.ts') },

      // ===== 子路径正则（从具体到一般排序）=====
      { find: /^@\/hili-player\/plugins\/(.*)/, replacement: path.resolve(__dirname, 'packages/plugins/src/$1') },
      { find: /^@\/hili-player\/(.*)/, replacement: path.resolve(__dirname, 'packages/player/src/$1') },
      { find: /^@\/core\/(.*)/, replacement: path.resolve(__dirname, 'core/$1') },
      { find: /^@\/types\/(.*)/, replacement: path.resolve(__dirname, 'types/$1') },
      { find: /^@\/utils\/(.*)/, replacement: path.resolve(__dirname, 'utils/$1') },
      { find: /^@\/directives\/(.*)/, replacement: path.resolve(__dirname, 'directives/$1') },
      { find: /^@\/events\/(.*)/, replacement: path.resolve(__dirname, 'events/$1') },
      { find: /^@\/error\/(.*)/, replacement: path.resolve(__dirname, 'error/$1') },

      // ===== catch-all（必须放最后）=====
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, 'packages/player/src/$1') },

      // ===== 外部库别名 =====
      { find: 'hls.js', replacement: path.resolve(__dirname, 'hls-fork/dist/hls.mjs') },
      { find: 'dashjs', replacement: path.resolve(__dirname, 'tests/__stubs__/dashjs.ts') },
      { find: 'flv.js', replacement: path.resolve(__dirname, 'tests/__stubs__/flvjs.ts') },
    ],
  },
});
