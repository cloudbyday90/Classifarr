/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const linter = new ESLint({ cwd: fileURLToPath(new URL('../../', import.meta.url)) });
const productionFile = 'src/services/lintContractFixture.mjs';
const lint = async (code, filePath = productionFile) => (await linter.lintText(code, { filePath }))[0].messages;

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
