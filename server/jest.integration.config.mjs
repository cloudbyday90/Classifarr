import { baseJestConfig } from './jest.shared.mjs';

export default {
  ...baseJestConfig,
  globalSetup: './src/__tests__/integration/global-setup.mjs',
  globalTeardown: './src/__tests__/integration/global-teardown.mjs',
  testMatch: ['**/__tests__/integration/**/*.test.js', '**/__tests__/integration/**/*.test.mjs'],
  setupFilesAfterEnv: ['./src/__tests__/integration/setup.mjs', './src/__tests__/integration/quiet-console.mjs'],
  testTimeout: 300000,
  automock: false,
  setupFiles: ['<rootDir>/src/__tests__/integration/jest.setup.mjs'],
};
