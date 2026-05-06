/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

module.exports = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,mjs}',
    '!src/index.mjs',
    '!src/**/__tests__/**',
    '!src/**/*.test.js',
    '!src/**/*.test.mjs',
    '!src/migrations/**',
    '!src/cli/**'
  ],
  testMatch: [
    '**/src/**/__tests__/**/*.test.js',
    '**/src/**/__tests__/**/*.test.mjs'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/__tests__/integration/'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/mockLogger.mjs'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 58,
      lines: 40,
      statements: 40
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  verbose: true,
  testTimeout: 10000,
  slowTestThreshold: 300,
};
