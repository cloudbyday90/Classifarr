import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const clientRoot = import.meta.dirname;
const lintContracts = [
  './src/__tests__/lintToolingContract.test.js',
  './src/__tests__/vueEventLintContract.test.js',
];

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['./browser-tests/**'],
    silent: 'passed-only',
    setupFiles: ['./vitest.setup.js'],
    // jsdom suites allocate substantial memory. A bounded pool keeps router
    // guards and other async UI tests responsive on local and CI hosts.
    maxWorkers: 4,
    projects: [
      {
        extends: true,
        test: {
          name: 'lint-contracts',
          environment: 'node',
          include: lintContracts,
          fileParallelism: false,
          // Zero is Vitest's default sequential bucket, not an explicit first group.
          sequence: { groupOrder: 1 },
        },
      },
      {
        extends: true,
        test: {
          name: 'application',
          include: ['./src/__tests__/**/*.test.js'],
          exclude: lintContracts,
          fileParallelism: true,
          // Real ESLint config/plugin setup must finish before the UI and
          // compiler workload starts; keep isolation and default deadlines.
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(clientRoot, './src'),
    },
  },
});
