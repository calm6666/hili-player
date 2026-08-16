import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { hiliCompile } from '../../plugins/vite-plugin-hili-compile';

export default defineConfig({
  plugins: [
    hiliCompile(),
    dts({
      root: __dirname,
      include: ['src/**/*'],
      exclude: ['**/*.test.ts'],
      insertTypesEntry: true,
      entryRoot: 'src',
      rollupTypes: true,
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler', // 或 'modern'
      },
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'HiliPlayer',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    outDir: resolve(__dirname, 'dist'),
    sourcemap: true,
    minify: false,
  },
  resolve: {
    alias: [
      { find: /^@\/core$/, replacement: resolve(__dirname, '../../core/index.ts') },
      { find: /^@\/types$/, replacement: resolve(__dirname, '../../types/index.ts') },
      { find: /^@\/utils$/, replacement: resolve(__dirname, '../../utils/index.ts') },
      { find: /^@\/events$/, replacement: resolve(__dirname, '../../events/index.ts') },
      { find: /^@\/error$/, replacement: resolve(__dirname, '../../error/index.ts') },
      { find: /^@\/directives$/, replacement: resolve(__dirname, '../../directives/index.ts') },
      { find: /^@\/core\/(.*)/, replacement: resolve(__dirname, '../../core/$1') },
      { find: /^@\/utils\/(.*)/, replacement: resolve(__dirname, '../../utils/$1') },
      { find: /^@\/types\/(.*)/, replacement: resolve(__dirname, '../../types/$1') },
      { find: /^@\/events\/(.*)/, replacement: resolve(__dirname, '../../events/$1') },
      { find: /^@\/error\/(.*)/, replacement: resolve(__dirname, '../../error/$1') },
      { find: /^@\/directives\/(.*)/, replacement: resolve(__dirname, '../../directives/$1') },
      { find: /^@\/hili-player\/plugins\/(.*)/, replacement: resolve(__dirname, '../plugins/src/$1') },
      { find: /^@\/hili-player\/(.*)/, replacement: resolve(__dirname, 'src/$1') },
      { find: /^@\/(.*)/, replacement: resolve(__dirname, 'src/$1') },
    ],
  },
  root: resolve(__dirname, '../..'),
  server: {
    port: 8686,
    open: true,
  },
});
