/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reported, runKnip, withFixture } from './helpers/knipCliFixture.mjs';

describe('installed Knip CLI contracts', () => {
  test('TOML-configured Bun preloads retain dependencies and expose genuine missing imports', () => {
    withFixture({
      'entry.mjs': 'export {};\n',
      'bunfig.toml': '[test]\npreload = ["./setup.mjs"]\n',
      'setup.mjs': "import 'fixture-retained';\nimport 'fixture-missing';\n",
      'node_modules/fixture-retained/package.json': JSON.stringify({ name: 'fixture-retained', version: '1.0.0', type: 'module' }),
    }, directory => {
      const result = runKnip(directory);
      expect(result.status).toBe(1);
      expect(reported(result, 'devDependencies')).toEqual([]);
      expect(reported(result, 'unlisted')).toEqual(['setup.mjs:fixture-missing']);
    }, { manifest: { scripts: { test: 'bun test' }, devDependencies: { 'fixture-retained': '1.0.0' } } });
  });

  test.each([
    ['direct', "/** @lintignore */\nexport { retained } from './source.mjs';\n", {}],
    ['renamed', "/** @lintignore */\nexport { retained as publicName } from './source.mjs';\n", {}],
    ['barrel alias', "/** @lintignore */\nexport { retained } from './barrel.mjs';\nexport { alternate } from './barrel.mjs';\n", {
      'barrel.mjs': "export { retained, retained as alternate } from './source.mjs';\n",
    }],
  ])('respects %s tagged re-exports without hiding untagged exports', (name, entry, extra) => {
    withFixture({
      'entry.mjs': `${entry}export { unused } from './source.mjs';\n`,
      'source.mjs': 'export const retained = 1;\nexport const unused = 2;\n',
      ...extra,
    }, directory => {
      const result = runKnip(directory, ['--include-entry-exports', '--exports']);
      expect(result.status).toBe(1);
      const expected = ['entry.mjs:unused', 'source.mjs:unused'];
      if (name === 'barrel alias') expected.push('entry.mjs:alternate', 'barrel.mjs:alternate');
      expect(reported(result, 'exports')).toEqual(expected.sort());
    });
  });

  test.each([
    { name: 'normal', args: [] },
    { name: 'production', args: ['--production', '--dependencies'] },
  ])('reports missing imports in $name mode', ({ args }) => {
    withFixture({
      'entry.mjs': "import 'fixture-undeclared';\nimport './missing.mjs';\n",
    }, directory => {
      const result = runKnip(directory, args);
      expect(result.status).toBe(1);
      expect(reported(result, 'unlisted')).toEqual(['entry.mjs:fixture-undeclared']);
      expect(reported(result, 'unresolved')).toEqual(['entry.mjs:./missing.mjs']);
    });
  });

  test('normal mode checks unused development dependencies while production checks runtime dependencies', () => {
    withFixture({
      'entry.mjs': 'export {};\n',
      'node_modules/fixture-runtime/package.json': JSON.stringify({ name: 'fixture-runtime', version: '1.0.0', type: 'module' }),
      'node_modules/fixture-dev/package.json': JSON.stringify({ name: 'fixture-dev', version: '1.0.0', type: 'module' }),
    }, directory => {
      const normal = runKnip(directory, ['--dependencies']);
      const production = runKnip(directory, ['--production', '--dependencies']);
      expect(normal.status).toBe(1);
      expect(production.status).toBe(1);
      expect(reported(normal, 'dependencies')).toEqual(['package.json:fixture-runtime']);
      expect(reported(normal, 'devDependencies')).toEqual(['package.json:fixture-dev']);
      expect(reported(production, 'dependencies')).toEqual(['package.json:fixture-runtime']);
      expect(reported(production, 'devDependencies')).toEqual([]);
    }, { manifest: { dependencies: { 'fixture-runtime': '1.0.0' }, devDependencies: { 'fixture-dev': '1.0.0' } } });
  });

  test('cold and warm cache preserve genuine unused-export findings', () => {
    withFixture({
      'entry.mjs': "import { used } from './source.mjs';\nused();\n",
      'source.mjs': 'export function used() {}\nexport function unused() {}\n',
    }, directory => {
      const args = ['--exports', '--cache', '--cache-location', join(directory, 'knip-cache')];
      const cold = runKnip(directory, args);
      const warm = runKnip(directory, args);
      expect(cold.status).toBe(1);
      expect(warm.status).toBe(1);
      expect(reported(cold, 'exports')).toEqual(['source.mjs:unused']);
      expect(JSON.parse(warm.stdout)).toEqual(JSON.parse(cold.stdout));
    });
  });

  test('valid configuration passes and invalid configuration fails closed', () => {
    withFixture({ 'entry.mjs': 'export {};\n' }, directory => {
      const valid = runKnip(directory);
      expect(valid.status).toBe(0);
      expect(JSON.parse(valid.stdout).issues).toEqual([]);
      writeFileSync(join(directory, 'knip.json'), '{ invalid json');
      const invalid = runKnip(directory);
      expect(invalid.status).toBe(2);
      expect(invalid.stderr).toContain('knip.json');
    });
  });
});
