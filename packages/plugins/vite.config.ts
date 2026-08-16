import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['**/*.test.ts'],
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
      external: ['@hili-player/player', 'dashjs', 'flv.js'],
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
      { find: /^@\/hili-player\/plugins/, replacement: resolve(__dirname, 'src') },
      { find: /^@\/hili-player/, replacement: resolve(__dirname, '../player/src') },
      { find: /^@\//, replacement: resolve(__dirname, '../..') + '/' },
      { find: '@hls-fork', replacement: resolve(__dirname, '../../media-manifest/hls.js/src/hls') },
      { find: 'hls.js', replacement: resolve(__dirname, 'src/hls/vendor/hls.mjs') },
    ],
  },
});
