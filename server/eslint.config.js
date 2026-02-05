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

const jestGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  jest: 'readonly',
  test: 'readonly'
};

module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**']
  },
  {
    files: ['src/__tests__/**/*.js'],
    ignores: ['src/__tests__/setup/consoleHelpers.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: jestGlobals
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='jest'][callee.property.name='spyOn'][arguments.0.name='console']",
          message: 'Use consoleHelpers (createConsoleSpy/withConsoleSpy) instead of jest.spyOn(console, ...).'
        }
      ]
    }
  }
];
