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

import securityPlugin from 'eslint-plugin-security';

const jestGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  jest: 'readonly',
  test: 'readonly',
};

const unusedVarsRule = ['warn', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
}];

export default [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.mjs'],
    ignores: ['src/__tests__/**'],
    plugins: {
      security: securityPlugin,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    rules: {
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-bidi-characters': 'error',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'no-unused-vars': unusedVarsRule,
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn'],
    },
  },
  {
    files: ['src/__tests__/**/*.mjs'],
    ignores: ['src/__tests__/setup/consoleHelpers.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: jestGlobals,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='jest'][callee.property.name='spyOn'][arguments.0.name='console']",
          message: 'Use consoleHelpers (createConsoleSpy/withConsoleSpy) instead of jest.spyOn(console, ...).',
        },
        {
          selector: "CallExpression[callee.object.name='describe'][callee.property.name='only']",
          message: 'describe.only() must not be committed — it silently skips all other tests in CI.',
        },
        {
          selector: "CallExpression[callee.object.name='it'][callee.property.name='only']",
          message: 'it.only() must not be committed — it silently skips all other tests in CI.',
        },
        {
          selector: "CallExpression[callee.object.name='test'][callee.property.name='only']",
          message: 'test.only() must not be committed — it silently skips all other tests in CI.',
        },
      ],
      'no-unused-vars': unusedVarsRule,
    },
  },
];