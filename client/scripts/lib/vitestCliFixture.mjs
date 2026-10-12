/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const clientRoot = resolve(import.meta.dirname, '../..');
const fixtureRoot = join(clientRoot, '.tmp');

// Isolated synthetic files only; never rewrite the real client configuration.
export function withVitestCliFixture(source, action) {
  mkdirSync(fixtureRoot, { recursive: true });
  const directory = mkdtempSync(join(fixtureRoot, 'vitest-cli-contract-'));
  const report = join(directory, 'result.json');
  try {
    writeFileSync(join(directory, 'subject.test.mjs'), source);
    writeFileSync(join(directory, 'subject.mjs'),
      'export function used(value) { return value + 1; }\nexport function unused() { return 99; }\n');
    writeFileSync(join(directory, 'vitest.config.mjs'), `export default ${JSON.stringify({
      root: directory,
      test: {
        include: ['*.test.mjs'], environment: 'node', maxWorkers: 1,
        isolate: true, watch: false, fsModuleCache: true,
        fsModuleCachePath: join(directory, 'module-cache'),
        coverage: { provider: 'v8', include: ['subject.mjs'], reporter: ['json'], reportsDirectory: join(directory, 'coverage') },
      },
    })};\n`);
    const run = (args = []) => {
      rmSync(report, { force: true });
      const result = spawnSync(process.execPath, [
        join(clientRoot, 'scripts/run-vitest.mjs'), 'run',
        '--config', join(directory, 'vitest.config.mjs'),
        '--reporter=json', `--outputFile=${report}`, ...args,
      ], { cwd: clientRoot, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
      assert.ifError(result.error);
      assert.equal(result.signal, null, 'runner must exit normally, not be killed');
      return { ...result, output: result.stdout + result.stderr };
    };
    return action({
      run,
      readReport: () => JSON.parse(readFileSync(report, 'utf8')),
      readCoverage: () => JSON.parse(readFileSync(join(directory, 'coverage/coverage-final.json'), 'utf8')),
      replaceSubject: content => writeFileSync(join(directory, 'subject.mjs'), content),
    });
  } finally {
    assert.equal(dirname(resolve(directory)), fixtureRoot);
    rmSync(directory, { recursive: true, force: true });
  }
}
