/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { constants } from 'node:perf_hooks';
import { POST_STOP_GC_WAIT_MS } from './naturalMajorGc.mjs';

const NUMBERS = ['elapsedMs', 'heapUsed', 'heapTotal', 'rss', 'external', 'arrayBuffers', 'containerBytes',
  'createdWorkers', 'exitedWorkers', 'activeWorkers'];
const REFERENCES = ['snapshot', 'decodedVector', 'ownedSource', 'ownedVector', 'comparisonHandle',
  'communityRows', 'communityVector', 'verificationMetadata', 'shadowBatch', 'neighborhoodBatch', 'representativeModel'];
const keys = (value, names) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...names].sort());
};
const finite = value => assert.ok(Number.isFinite(value) && value >= 0);

export function projectPostStopSample(row) {
  return { ...Object.fromEntries(NUMBERS.map(key => [key, row[key]])), diagnosticGc: row.diagnosticGc,
    alive: Object.fromEntries(REFERENCES.map(key => [key, row.alive[key] ?? 0])) };
}

export function assertPostStopGcReceipt(value) {
  keys(value, ['version', 'status', 'scope', 'windowStartMs', 'windowEndMs', 'waitBudgetMs', 'event', 'before', 'after']);
  assert.equal(value.version, 1); assert.equal(value.scope, 'main_thread_major_gc_event');
  assert.ok(['observed', 'not_observed'].includes(value.status));
  assert.equal(value.waitBudgetMs, POST_STOP_GC_WAIT_MS);
  finite(value.windowStartMs); finite(value.windowEndMs);
  const duration = value.windowEndMs - value.windowStartMs;
  // Timer delivery / final numeric sampling still must fit the existing finish allowance.
  assert.ok(duration >= 0 && duration <= POST_STOP_GC_WAIT_MS + 30_000);
  if (value.status === 'not_observed') {
    assert.equal(value.event, null); assert.ok(duration >= POST_STOP_GC_WAIT_MS);
  } else {
    keys(value.event, ['startMs', 'durationMs', 'kind', 'flags']);
    const event = value.event;
    finite(event.startMs); finite(event.durationMs);
    assert.equal(event.kind, constants.NODE_PERFORMANCE_GC_MAJOR);
    assert.ok(Number.isSafeInteger(event.flags) && event.flags >= 0 && event.flags <= 126 && (event.flags & 1) === 0);
    assert.equal(event.flags & constants.NODE_PERFORMANCE_GC_FLAGS_FORCED, 0);
    assert.ok(event.startMs >= value.windowStartMs);
    assert.ok(event.startMs + event.durationMs <= Math.min(value.windowEndMs, value.windowStartMs + POST_STOP_GC_WAIT_MS));
  }
  for (const row of [value.before, value.after]) {
    keys(row, [...NUMBERS, 'diagnosticGc', 'alive']); keys(row.alive, REFERENCES);
    for (const key of NUMBERS) assert.ok(Number.isSafeInteger(row[key]) && row[key] >= 0);
    assert.equal(row.diagnosticGc, false); assert.equal(row.activeWorkers, 0);
    assert.ok(row.createdWorkers > 0); assert.equal(row.createdWorkers, row.exitedWorkers);
    for (const count of Object.values(row.alive)) assert.ok(Number.isSafeInteger(count) && count >= 0 && count <= 256);
    assert.ok(Object.values(row.alive).reduce((sum, count) => sum + count, 0) <= 256);
  }
  assert.equal(value.before.createdWorkers, value.after.createdWorkers);
  const sampleSpan = value.after.elapsedMs - value.before.elapsedMs;
  assert.ok(sampleSpan >= Math.floor(duration) && sampleSpan <= POST_STOP_GC_WAIT_MS + 30_000);
  for (const kind of REFERENCES) assert.ok(value.after.alive[kind] <= value.before.alive[kind]);
}
