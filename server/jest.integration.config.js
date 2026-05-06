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
    globalSetup: './src/__tests__/integration/global-setup.js',
    globalTeardown: './src/__tests__/integration/global-teardown.js',
    testEnvironment: 'node',
    coverageProvider: 'v8',
    testMatch: ['**/__tests__/integration/**/*.test.js', '**/__tests__/integration/**/*.test.mjs'],
    setupFilesAfterEnv: ['./src/__tests__/integration/setup.mjs', './src/__tests__/integration/quiet-console.js'],
    verbose: true,
    testTimeout: 300000,
    // Ensure we don't automatically mock everything if verify is used elsewhere
    automock: false,
    // Set test environment variable to skip rate limiting
    setupFiles: ['<rootDir>/src/__tests__/integration/jest.setup.js'],
};
