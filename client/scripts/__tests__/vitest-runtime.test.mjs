/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { withVitestCliFixture } from '../lib/vitestCliFixture.mjs';

const passing = `import { test, expect } from 'vitest';
import { used } from './subject.mjs';
test('synthetic success', () => expect(used(1)).toBe(2));`;

test('real CLI runs an assertion and retains both covered and uncovered functions', () => {
  withVitestCliFixture(passing, ({ run, readReport, readCoverage }) => {
    const result = run(['--coverage']);
    assert.equal(result.status, 0, result.output);
    const report = readReport();
    assert.equal(report.numTotalTests, 1);
    assert.equal(report.numPassedTests, 1);
    const files = Object.values(readCoverage());
    assert.equal(files.length, 1);
    const functions = Object.fromEntries(Object.entries(files[0].fnMap)
      .map(([id, entry]) => [entry.name, files[0].f[id]]));
    assert.deepEqual(functions, { used: 1, unused: 0 });
  });
});

test('real CLI exits nonzero for a failed assertion', () => {
  withVitestCliFixture(passing.replace('toBe(2)', 'toBe(3)'), ({ run, readReport }) => {
    const result = run();
    assert.equal(result.status, 1, result.output);
    assert.equal(readReport().numFailedTests, 1);
  });
});

test('a warm transformed-module cache cannot hide changed application code', () => {
  withVitestCliFixture(passing, ({ run, readReport, replaceSubject }) => {
    assert.equal(run().status, 0);
    assert.equal(readReport().numPassedTests, 1);
    replaceSubject('export function used(value) { return value + 2; }\n');
    const result = run();
    assert.equal(result.status, 1, result.output);
    assert.equal(readReport().numFailedTests, 1);
  });
});

test('real CLI rejects an unfinished setup hook without executing its test', () => {
  withVitestCliFixture(`import { beforeAll, test } from 'vitest';
beforeAll(() => new Promise(() => {}), 50);
test('must not execute', () => { throw new Error('unexpected_fixture_execution'); });`, ({ run, readReport }) => {
    const result = run();
    assert.equal(result.status, 1, result.output);
    const report = readReport();
    assert.equal(report.numPassedTests, 0);
    const serialized = JSON.stringify(report);
    assert.match(serialized, /Hook timed out in 50ms/);
    assert.doesNotMatch(serialized, /Error: unexpected_fixture_execution/);
  });
});

for (const [name, filter, message] of [
  ['missing location file', 'absent.test.mjs:4', /Couldn.t find file absent\.test\.mjs/],
  ['unsupported location range', 'subject.test.mjs:1-5', /range location filters are not supported/],
]) {
  test(`real CLI rejects ${name}, even with passWithNoTests`, () => {
    withVitestCliFixture(passing, ({ run }) => {
      const result = run([filter, '--passWithNoTests']);
      assert.match(result.output, message);
      assert.equal(result.status, 1, result.output);
    });
  });
}

test('real CLI rejects an unknown changed revision instead of reporting no matching tests', () => {
  withVitestCliFixture(passing, ({ run }) => {
    const result = run([`--changed=refs/heads/classifarr-missing-${randomUUID()}`, '--passWithNoTests']);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /git diff --name-only .* failed:/);
  });
});
