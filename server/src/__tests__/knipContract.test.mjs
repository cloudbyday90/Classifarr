/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const knipCli = fileURLToPath(new URL('../../node_modules/knip/bin/knip.js', import.meta.url));
const childEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE)$/i.test(key))),
  CI: 'true',
  NO_COLOR: '1',
};

function withFixture(files, run, { manifest = {}, config = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'classifarr-knip-contract-'));
  const contents = {
    'package.json': JSON.stringify({ name: 'classifarr-knip-fixture', private: true, type: 'module', ...manifest }),
    'knip.json': JSON.stringify({ entry: ['entry.mjs!'], project: ['*.mjs!'], tags: ['-lintignore'], ...config }),
    ...files,
  };
  try {
    for (const [path, content] of Object.entries(contents)) {
      const target = join(directory, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    run(directory);
  } finally {
    // Only the directory just created by this test is removed, never the repo.
    rmSync(directory, { recursive: true, force: true });
  }
}

function runKnip(directory, args = []) {
  const result = spawnSync(process.execPath, [knipCli, '--reporter', 'json', '--no-progress', ...args], {
    cwd: directory,
    env: childEnv,
    shell: false,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  expect(result.signal).toBeNull();
  return result;
}

function reported(result, type) {
  return JSON.parse(result.stdout).issues.flatMap(issue =>
    (issue[type] ?? []).map(item => `${issue.file.replaceAll('\\', '/')}:${item.name}`)).sort();
}

describe('installed Knip CLI contracts', () => {
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
