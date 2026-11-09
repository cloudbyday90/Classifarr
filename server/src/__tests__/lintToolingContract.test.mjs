/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import { ESLint, Linter } from 'eslint';

const linter = new ESLint({ cwd: fileURLToPath(new URL('../../', import.meta.url)) });
const productionFile = 'src/services/lintContractFixture.mjs';
const lint = async (code, filePath = productionFile) => (await linter.lintText(code, { filePath }))[0].messages;

const restrictedGlobals = (code, globals) => new Linter().verify(code, {
  languageOptions: { globals: { window: 'readonly', self: 'readonly' } },
  rules: { 'no-restricted-globals': ['error', { globals, checkGlobalObject: true }] },
});

test.each(['const obj = { foo: window };', 'class C { foo = globalThis; }'])
('global objects used as property values do not crash the real rule: %s', code => {
  expect(restrictedGlobals(code, ['foo'])).toEqual([]);
});

test('restricted shorthand globals still produce the exact blocking diagnostic', () => {
  expect(restrictedGlobals('const obj = { self };', ['self'])).toEqual([
    expect.objectContaining({ ruleId: 'no-restricted-globals', messageId: 'defaultMessage',
      severity: 2, line: 1, column: 15, endLine: 1, endColumn: 19 }),
  ]);
});

test('production config retains ESM and blocking security checks', async () => {
  const config = await linter.calculateConfigForFile(productionFile);
  expect(config.languageOptions.sourceType).toBe('module');
  expect(config.linterOptions.reportUnusedDisableDirectives).toBe(2);
  for (const rule of ['security/detect-eval-with-expression', 'security/detect-bidi-characters',
    'security/detect-invisible-characters', 'n/no-missing-import', 'n/no-deprecated-api']) {
    expect(config.rules[rule]?.[0]).toBe(2);
  }
});

test('valid ESM, native imports and readable international text pass', async () => {
  expect(await lint("import { basename } from 'node:path';\nexport const name = basename('日本語');")).toEqual([]);
  expect(await lint("export const placeholder = '\\u3164';")).toEqual([]);
});

test('configured Node globals pass while an undefined sentinel remains blocking', async () => {
  expect(await lint("export const runtime = process.versions.node;\nexport const bytes = Buffer.from('ok');")).toEqual([]);
  expect(await lint('export const missing = classifarrUndefinedGlobal;')).toEqual([
    expect.objectContaining({ ruleId: 'no-undef', messageId: 'undef', severity: 2,
      message: "'classifarrUndefinedGlobal' is not defined." }),
  ]);
});

test.each([
  ["export function run(input) { return eval(input); }", 'security/detect-eval-with-expression'],
  ["import fs from 'fs'; export const read = fs.readFile;", 'n/prefer-node-protocol'],
  ["import missing from './missingLintContractFixture.mjs'; export const value = missing;", 'n/no-missing-import'],
  ["export const label = '\u3164';", 'security/detect-invisible-characters'],
  ["// hidden \uFFA0\nexport const safe = true;", 'security/detect-invisible-characters'],
  ["// deceptive \u202E\nexport const safe = true;", 'security/detect-bidi-characters'],
])('configured lint rejects %s', async (code, rule) => {
  expect(await lint(code)).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: rule, severity: 2 })]));
});

test('focused tests remain prohibited in the test-only config', async () => {
  expect(await lint("test.only('synthetic', () => {});", 'src/__tests__/lintContractFixture.test.mjs'))
    .toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'no-restricted-syntax', severity: 2 })]));
});
