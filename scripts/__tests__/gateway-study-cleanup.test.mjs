/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finishGatewayStudyCleanup } from '../lib/gatewayStudyCleanup.mjs';

test('every cleanup action and independent check runs after an earlier failure', () => {
  const visited = [];
  assert.throws(() => finishGatewayStudyCleanup(['worker', 'volume', 'scan'].map(name => ({ name, run() {
    visited.push(name); if (name === 'worker') throw new Error('ownership_mismatch');
  } }))), error => error.message === 'gateway_study_cleanup_incomplete' && error.failedResources.join() === 'worker');
  assert.deepEqual(visited, ['worker', 'volume', 'scan']);
});
test('clean completion requires all checks and CI runs study contracts without Docker', () => {
  let checks = 0; finishGatewayStudyCleanup([{ name: 'scan', run: () => { checks++; } }]); assert.equal(checks, 1);
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Test bounded gateway study contracts\s+run: npm run test:tooling:gateway/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.scripts['test:ci:preflight'].includes('test:tooling:gateway'));
  assert.ok(pkg.scripts['test:tooling:gateway'].startsWith('node --test '));
});
