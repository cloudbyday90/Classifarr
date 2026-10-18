/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { soakArrivals, distribution, runSoakArrivals, summarizeSoak } from '../fixtures/ollamaGatewayRehearsal/soakWorkload.mjs';

test('finite workload stays below unchanged rate credits and preserves phase boundaries', () => {
  const plan = soakArrivals(); assert.equal(plan.length, 528);
  for (let start = 0; start < 480000; start += 60000) assert.equal(plan.filter(row => row.at >= start && row.at < start + 60000).length, 66);
  assert.deepEqual(['before', 'archives', 'after'].map(phase => plan.filter(row => row.phase === phase).length), [66, 396, 66]);
});
test('percentiles retain tails, empty samples are missing not zero, invalid samples fail', () => {
  assert.deepEqual(distribution([9, 1, 2, 3]), { count: 4, p50: 2, p95: 9, p99: 9, max: 9 });
  assert.equal(distribution([]).p95, null);
  for (const values of [[NaN], [-1], Array(601).fill(1)]) assert.throws(() => distribution(values));
});
test('late and capacity-dropped arrivals are explicit, not rescheduled or retried', async () => {
  let clock = 0, calls = 0;
  const late = await runSoakArrivals({ plan: [{ id: 1, at: 1 }], now: () => clock,
    sleep: async () => { clock = 700; }, request: async () => { calls++; } });
  assert.equal(late[0].outcome, 'dropped'); assert.equal(calls, 0);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const capacity = await runSoakArrivals({ plan: Array.from({ length: 5 }, (_, id) => ({ id, at: id })), now: () => clock,
    sleep: async ms => { clock += ms; if (clock >= 704) setImmediate(release); }, request: async () => { calls++; await held; return 200; } });
  assert.equal(calls, 4); assert.equal(capacity.filter(row => row.outcome === 'dropped').length, 1);
});
test('request failures remain evidence, invalid plans fail before requests', async () => {
  const rows = await runSoakArrivals({ plan: [{ id: 1, at: 0 }], request: () => { throw new Error('synthetic'); } });
  assert.equal(rows[0].outcome, 'failed');
  for (const plan of [[], [{ at: -1 }], [{ at: 2 }, { at: 1 }]]) await assert.rejects(runSoakArrivals({ plan, request() {} }));
});
test('summary refuses drops, unexpected status, missing or duplicate admission observations', () => {
  const results = soakArrivals().map(row => ({ ...row, outcome: 'response', status: row.installation === 'background' ? 429 : 200,
    latenessMs: 0, latencyMs: 1 }));
  const observations = results.filter(row => row.status === 200).map(row => ({ id: row.id, preClaimMs: 1, claimMs: 1 }));
  assert.equal(summarizeSoak(results, observations)[1].completed, 360);
  for (const bad of [[...observations.slice(1)], [...observations.slice(1), observations[1]]]) assert.throws(() => summarizeSoak(results, bad));
  for (const patch of [{ outcome: 'dropped' }, { status: 503 }]) assert.throws(() => summarizeSoak([{ ...results[0], ...patch }, ...results.slice(1)], observations));
});
