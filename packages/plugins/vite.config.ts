import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      // 注意：hls.js 现在指向仓库根的 fork（../../hls.js/dist/hls.mjs）。
      // dts 插件会按导入图把包外文件也镜像输出，路径会变成 dist/hls.js/dist/*，
      // 与 rollup 要写出的入口 chunk（entryFileNames 的 hls → dist/hls.js）**同名冲突**，
      // 导致 EISDIR 构建失败。故必须把 fork 目录排除在声明输出之外。
      exclude: ['**/*.test.ts', '**/hls-fork/**'],
      insertTypesEntry: true,
      entryRoot: 'src',
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        danmaku: resolve(__dirname, 'src/danmaku/index.ts'),
        subtitle: resolve(__dirname, 'src/subtitle/index.ts'),
        dash: resolve(__dirname, 'src/dash/index.ts'),
        hls: resolve(__dirname, 'src/hls/index.ts'),
        flv: resolve(__dirname, 'src/flv/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@lumina/nova', 'dashjs', 'flv.js'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
    outDir: resolve(__dirname, 'dist'),
    sourcemap: true,
    minify: false,
  },
  resolve: {
    alias: [
      { find: /^@\/lumina\/plugins/, replacement: resolve(__dirname, 'src') },
      { find: /^@\/nova/, replacement: resolve(__dirname, '../player/src') },
      { find: /^@\//, replacement: resolve(__dirname, '../..') + '/' },
      { find: 'hls.js', replacement: resolve(__dirname, '../../hls-fork/dist/hls.mjs') },
    ],
  },
});
