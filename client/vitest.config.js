import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const clientRoot = import.meta.dirname;

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['./src/__tests__/**/*.test.js'],
    exclude: ['./browser-tests/**'],
    silent: 'passed-only',
    setupFiles: ['./vitest.setup.js'],
  },
  resolve: {
    alias: {
      '@': path.resolve(clientRoot, './src'),
    },
  },
});
