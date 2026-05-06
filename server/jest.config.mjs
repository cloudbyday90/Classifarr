import { baseJestConfig } from './jest.shared.mjs';

export default {
  ...baseJestConfig,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,mjs}',
    '!src/index.mjs',
    '!src/**/__tests__/**',
    '!src/**/*.test.js',
    '!src/**/*.test.mjs',
    '!src/migrations/**',
    '!src/cli/**',
  ],
  testMatch: [
    '**/src/**/__tests__/**/*.test.js',
    '**/src/**/__tests__/**/*.test.mjs',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/__tests__/integration/',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/mockLogger.mjs'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 58,
      lines: 40,
      statements: 40,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testTimeout: 10000,
  slowTestThreshold: 300,
};
