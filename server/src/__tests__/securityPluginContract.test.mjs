/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Linter } from 'eslint';
import security from 'eslint-plugin-security';

const linter = new Linter();
const inspect = code => linter.verify(code, [{
  plugins: { security },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: { 'security/detect-non-literal-regexp': 'warn', 'security/detect-unsafe-regex': 'warn' },
}]).map(({ ruleId, severity }) => ({ ruleId, severity }));

describe('installed security plugin RegExp contracts', () => {
  test.each(['new RegExp(pattern)', 'RegExp(pattern)'])('%s reports the dynamic pattern at the existing warning severity', expression => {
    expect(inspect(`const pattern = readPattern(); ${expression};`)).toEqual([
      { ruleId: 'security/detect-non-literal-regexp', severity: 1 },
    ]);
  });

  test.each(["new RegExp('(a+)+$')", "RegExp('(a+)+$')", '/(a+)+$/'])('%s reports unsafe syntax without executing the expression', expression => {
    expect(inspect(`${expression};`)).toEqual([
      { ruleId: 'security/detect-unsafe-regex', severity: 1 },
    ]);
  });

  test.each(["new RegExp('ab+c')", "RegExp('ab+c')", '/ab+c/'])('%s preserves a safe literal control', expression => {
    expect(inspect(`${expression};`)).toEqual([]);
  });
});
