/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { soakProfile } from '../fixtures/ollamaGatewayRehearsal/soakProfile.mjs';
import { soakArrivals, summarizeSoak, distribution, runSoakArrivals } from '../fixtures/ollamaGatewayRehearsal/soakWorkload.mjs';
import { studyPadding } from '../fixtures/ollamaGatewayRehearsal/studyHistory.mjs';

test('allowlisted profiles preserve old bounds and align every extended accounting/deadline', () => {
  assert.equal(soakProfile().runnerMs, 530000); assert.equal(soakProfile().workerMs, 510000);
  const profile = soakProfile('extended');
  assert.equal(profile.durationMs, 1800000); assert.equal(profile.settleMs, 60000);
  const plan = soakArrivals('extended'); assert.equal(plan.length, 1980);
  assert.equal(profile.foreground, 1800); assert.equal(profile.background, 180);
  for (let at = 0; at < profile.durationMs; at += 60000) assert.equal(plan.filter(row => row.at >= at && row.at < at + 60000).length, 66);
  assert.deepEqual(profile.phases.map(phase => plan.filter(row => row.phase === phase.name).length), [66, 1848, 66]);
  assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.phases[0]));
  for (const value of ['__proto__', '60m', '', {}, null]) assert.throws(() => soakProfile(value));
});

test('extended accounting rejects short, missing, failed and duplicate evidence', () => {
  const rows = soakArrivals('extended').map(row => ({ ...row, outcome: 'response', status: row.installation === 'background' ? 429 : 200, latenessMs: 0, latencyMs: 1 }));
  const observed = rows.filter(row => row.status === 200).map(row => ({ id: row.id, preClaimMs: 1, claimMs: 1 }));
  assert.equal(summarizeSoak(rows, observed, 'extended')[1].completed, 1680);
  assert.throws(() => summarizeSoak(rows.slice(1), observed, 'extended'));
  assert.throws(() => summarizeSoak(rows, [...observed.slice(1), observed[1]], 'extended'));
  assert.throws(() => summarizeSoak([{ ...rows[0], outcome: 'dropped' }, ...rows.slice(1)], observed, 'extended'));
  assert.throws(() => distribution(Array(2049).fill(1), 'extended'));
});

test('extended plan keeps late drops explicit and refuses unknown profiles before calls', async () => {
  let calls = 0;
  await assert.rejects(runSoakArrivals({ profileName: 'unknown', request() { calls++; } })); assert.equal(calls, 0);
  const rows = await runSoakArrivals({ profileName: 'extended', plan: [{ id: 1, at: 0 }], request: async () => 200 });
  assert.equal(rows[0].status, 200);
});

test('public varied padding is deterministic, bounded and less compressible than repeat padding', () => {
  const first = studyPadding(0); assert.equal(first.length, 75000); assert.equal(first, studyPadding(0));
  assert.notEqual(first, studyPadding(1)); assert.match(first, /^[a-zA-Z0-9_-]+$/);
  assert.ok(deflateSync(first).length / first.length > 0.7);
  assert.ok(deflateSync('x'.repeat(first.length)).length / first.length < 0.01);
  for (const index of [-1, 3000, NaN, 0.5]) assert.throws(() => studyPadding(index));
});
