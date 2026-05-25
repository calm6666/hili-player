import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['**/*.test.ts'],
      insertTypesEntry: true,
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
    outDir: 'dist',
    sourcemap: true,
    minify: false,
  },
  resolve: {
    alias: [
      { find: /^@\/hili-player\/plugins/, replacement: resolve(__dirname, '../plugins/src') },
      { find: /^@\/hili-player/, replacement: resolve(__dirname, 'src') },
      { find: /^@\//, replacement: resolve(__dirname, '../..') + '/' },
    ],
  },
  root: resolve(__dirname, '../..'),
  server: {
    port: 8686,
    open: true,
  },
});
