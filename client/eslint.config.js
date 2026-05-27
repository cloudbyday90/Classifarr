import js from '@eslint/js';
import globals from 'globals';
import vue from 'eslint-plugin-vue';

const unusedVarsRule = ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }];
const vueUnusedVarsRule = ['error', { ignorePattern: '^_' }];

export default [
  {
    name: 'client/ignores',
    ignores: ['coverage/**', 'dist/**', 'node_modules/**']
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    }
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    name: 'client/app',
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-unused-vars': unusedVarsRule,
      'vue/no-unused-vars': vueUnusedVarsRule,
      'vue/multi-word-component-names': 'off',
      'vue/no-undef-components': ['error', { ignorePatterns: ['router-link', 'router-view', 'RouterLink', 'RouterView'] }],
      'vue/no-undef-directives': ['error', { ignore: ['tooltip'] }],
      'vue/no-undef-properties': 'error',
      'vue/no-multi-spaces': 'error',
      'vue/no-template-shadow': 'error',
      'vue/require-explicit-emits': 'error',
      'vue/require-prop-types': 'error'
    }
  },
  {
    name: 'client/node',
    files: ['vite.config.js', 'vitest.config.js', 'vitest.setup.js', 'playwright.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': unusedVarsRule
    }
  },
  {
    name: 'client/tests',
    files: ['src/__tests__/**/*.js', 'src/views/__tests__/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest
      }
    },
    rules: {
      'vue/one-component-per-file': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='describe'][callee.property.name='only']",
          message: 'describe.only() must not be committed.'
        },
        {
          selector: "CallExpression[callee.object.name='it'][callee.property.name='only']",
          message: 'it.only() must not be committed.'
        },
        {
          selector: "CallExpression[callee.object.name='test'][callee.property.name='only']",
          message: 'test.only() must not be committed.'
        }
      ],
      'no-unused-vars': unusedVarsRule
    }
  }
];
