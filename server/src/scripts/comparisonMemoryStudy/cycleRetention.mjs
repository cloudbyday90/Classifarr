/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { projectPostStopSample } from './postStopGcContract.mjs';

const LIMITS = { comparison: 256 * 1024 ** 2, representative: 32 * 1024 ** 2 };
const SUCCESSES = { comparison: ['ready', 'revalidated'], representative: ['published', 'up_to_date'] };
const NUMBERS = ['elapsedMs', 'heapUsed', 'heapTotal', 'rss', 'external', 'arrayBuffers', 'containerBytes',
  'createdWorkers', 'exitedWorkers', 'activeWorkers'];
const REFERENCES = ['snapshot', 'decodedVector', 'ownedSource', 'ownedVector', 'comparisonHandle',
  'communityRows', 'communityVector', 'verificationMetadata', 'shadowBatch', 'neighborhoodBatch', 'representativeModel'];
const keys = (value, allowed) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...allowed].sort());
};
const integer = (value, max = Number.MAX_SAFE_INTEGER) => assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= max);
const successful = row => SUCCESSES[row.worker]?.includes(row.status) === true;

function assertPoint(point) {
  keys(point, ['memory', 'caches']);
  keys(point.memory, [...NUMBERS, 'diagnosticGc', 'alive']);
  for (const key of NUMBERS) integer(point.memory[key]);
  assert.equal(point.memory.diagnosticGc, false);
  keys(point.memory.alive, REFERENCES);
  for (const count of Object.values(point.memory.alive)) integer(count, 256);
  integer(Object.values(point.memory.alive).reduce((sum, n) => sum + n, 0), 256);
  keys(point.caches, Object.keys(LIMITS));
  for (const [kind, limit] of Object.entries(LIMITS)) {
    const cache = point.caches[kind];
    keys(cache, ['entries', 'estimatedBytes']);
    integer(cache.entries, 1); integer(cache.estimatedBytes, limit);
    assert.equal(cache.entries === 0, cache.estimatedBytes === 0);
  }
}

function projectPoint(sample, caches) {
  const point = { memory: projectPostStopSample(sample), caches: Object.fromEntries(Object.keys(LIMITS)
    .map(kind => [kind, { entries: caches[kind].entries, estimatedBytes: caches[kind].estimatedBytes }])) };
  assertPoint(point); return point;
}

/** Scalar-only evidence: never retain the caller's sample, cache, snapshot or model. */
export function createRefreshCycleRetention() {
  const completed = [];
  return {
    record(attempt, sample, caches) {
      if (!successful(attempt)) return;
      assert.ok(completed.length < 120, 'comparison_cycle_evidence_budget');
      const row = { worker: attempt.worker, attempt: attempt.attempt, status: attempt.status,
        completedAtMs: attempt.elapsedMs, ...projectPoint(sample, caches) };
      integer(row.attempt, 60); assert.ok(row.attempt > 0); integer(row.completedAtMs);
      assert.ok(!completed.some(prior => prior.worker === row.worker && prior.attempt === row.attempt));
      completed.push(row);
    },
    finish(sample, caches) {
      return { version: 1, completed: structuredClone(completed), stopped: projectPoint(sample, caches) };
    },
  };
}

export function assertRefreshCycleRetention(value, study) {
  keys(value, ['version', 'completed', 'stopped']); assert.equal(value.version, 1);
  assert.ok(Array.isArray(value.completed) && value.completed.length <= 120);
  const expected = study.attempts.filter(successful);
  assert.equal(value.completed.length, expected.length);
  const seen = new Set();
  for (const row of value.completed) {
    keys(row, ['worker', 'attempt', 'status', 'completedAtMs', 'memory', 'caches']);
    const attempt = expected.find(item => item.worker === row.worker && item.attempt === row.attempt);
    assert.ok(attempt); assert.equal(row.status, attempt.status); assert.equal(row.completedAtMs, attempt.elapsedMs);
    integer(row.completedAtMs); integer(row.attempt, 60); assert.ok(row.attempt > 0);
    assert.ok(row.completedAtMs <= study.durationMs);
    const identity = `${row.worker}:${row.attempt}`;
    assert.ok(!seen.has(identity)); seen.add(identity);
    assertPoint({ memory: row.memory, caches: row.caches });
    assert.ok(row.memory.elapsedMs >= row.completedAtMs);
    assert.ok(row.memory.elapsedMs <= value.stopped.memory.elapsedMs);
    assert.equal(row.caches[row.worker].entries, 1);
  }
  for (const worker of Object.keys(SUCCESSES)) {
    const rows = value.completed.filter(row => row.worker === worker);
    assert.ok(rows.filter(row => row.completedAtMs > study.drainedAtMs).length >= 2);
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i].attempt > rows[i - 1].attempt);
      assert.ok(rows[i].completedAtMs >= rows[i - 1].completedAtMs);
      assert.ok(rows[i].memory.elapsedMs >= rows[i - 1].memory.elapsedMs);
    }
  }
  assertPoint(value.stopped);
  const memory = value.stopped.memory;
  assert.ok(memory.elapsedMs <= study.durationMs);
  assert.equal(memory.activeWorkers, 0); assert.ok(memory.createdWorkers > 0);
  assert.equal(memory.createdWorkers, memory.exitedWorkers);
  assert.equal(memory.createdWorkers, study.measurement.createdWorkers);
  for (const cache of Object.values(value.stopped.caches)) assert.equal(cache.entries, 0);
}
