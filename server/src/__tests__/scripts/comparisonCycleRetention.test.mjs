/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { createRefreshCycleRetention, assertRefreshCycleRetention } from '../../scripts/comparisonMemoryStudy/cycleRetention.mjs';
import { formatComparisonCycleSummary } from '../../../../scripts/lib/comparisonCycleSummary.mjs';
import { collectComparisonStudyTrace } from '../../../../scripts/lib/comparisonStudyTrace.mjs';

const sample = elapsedMs => ({ elapsedMs, heapUsed: 100, heapTotal: 200, rss: 300, external: 10,
  arrayBuffers: 5, containerBytes: 400, createdWorkers: 2, exitedWorkers: 2, activeWorkers: 0,
  diagnosticGc: false, alive: { snapshot: 1 }, private: 'not retained' });
const caches = (entries = 1) => ({ comparison: { entries, estimatedBytes: entries * 500, model: {} },
  representative: { entries, estimatedBytes: entries * 100, key: 'private' } });
function fixture() {
  const attempts = ['comparison', 'representative'].flatMap(worker => [1, 2].map(attempt => ({ worker, attempt,
    status: worker === 'comparison' ? 'revalidated' : 'up_to_date', elapsedMs: attempt * 300000 })));
  const recorder = createRefreshCycleRetention();
  for (const row of attempts) recorder.record(row, sample(row.elapsedMs), caches());
  return { recorder, study: { attempts, drainedAtMs: 1, durationMs: 700000, measurement: { createdWorkers: 2 } } };
}
test('records each completed refresher, estimates separately, then validates cleared caches', () => {
  const { recorder, study } = fixture();
  const result = recorder.finish(sample(650000), caches(0));
  expect(() => assertRefreshCycleRetention(result, study)).not.toThrow();
  expect(JSON.stringify(result)).not.toMatch(/private|model|key/);
  expect(result.completed).toHaveLength(4);
  expect(result.stopped.memory.alive.snapshot).toBe(1); // Not a leak verdict before collection.
  const summary = formatComparisonCycleSummary({ ...study, cycleRetention: result });
  expect(summary).toContain('comparison first (#1)'); expect(summary).toContain('representative last (#2)');
  expect(summary).toContain('not peaks or leak verdicts'); expect(summary).toContain('| stopped |');
});
test('projects copies, ignores unsuccessful attempts and rejects duplicate evidence', () => {
  const recorder = createRefreshCycleRetention(), row = { worker: 'comparison', attempt: 1, status: 'ready', elapsedMs: 1 };
  recorder.record({ ...row, status: 'deferred' }, null, null);
  const usage = sample(1), cache = caches(); recorder.record(row, usage, cache);
  usage.alive.snapshot = 99; cache.comparison.entries = 99; row.status = 'private';
  const result = recorder.finish(sample(2), caches(0));
  expect(result.completed[0].memory.alive.snapshot).toBe(1);
  expect(result.completed[0].caches.comparison.entries).toBe(1);
  expect(result.completed[0].status).toBe('ready');
  result.completed[0].status = 'changed';
  expect(recorder.finish(sample(2), caches(0)).completed[0].status).toBe('ready');
  expect(() => recorder.record({ ...row, status: 'ready' }, sample(2), caches())).toThrow();
});
test.each([
  result => { delete result.completed; },
  result => { result.version = 0; },
  result => { result.private = 'payload'; },
  result => { result.completed.pop(); },
  result => { result.completed[1] = structuredClone(result.completed[0]); },
  result => { result.completed[0].worker = 'unknown'; },
  result => { result.completed[0].status = 'published'; },
  result => { result.completed[0].completedAtMs++; },
  result => { result.completed[0].memory.elapsedMs = 800000; },
  result => { result.completed[0].memory.elapsedMs = 0; },
  result => { result.stopped.memory.elapsedMs = 800000; },
  result => { result.completed[0].memory.heapUsed = NaN; },
  result => { result.completed[0].memory.alive.snapshot = 257; },
  result => { result.completed[0].memory.diagnosticGc = true; },
  result => { result.completed[0].caches.comparison.estimatedBytes = 257 * 1024 ** 2; },
  result => { result.completed[0].caches.comparison.entries = 0; },
  result => { result.stopped.caches.representative = { entries: 1, estimatedBytes: 100 }; },
  result => { result.stopped.memory.activeWorkers = 1; },
  result => { result.stopped.memory.exitedWorkers = 1; },
  result => { result.completed.reverse(); },
])('rejects missing, forged, unbounded or inconsistent cycle evidence %#', change => {
  const { recorder, study } = fixture(), result = recorder.finish(sample(650000), caches(0));
  change(result); expect(() => assertRefreshCycleRetention(result, study)).toThrow();
});
test('failure trace preserves only numeric cache evidence, never keys or objects', () => {
  const [row] = collectComparisonStudyTrace('STUDY_PROGRESS ' + JSON.stringify({ phase: 'recovery_comparison',
    comparisonCacheEntries: 1, comparisonCacheBytes: 123, representativeCacheEntries: 0,
    representativeCacheBytes: 0, caches: { secret: 'private' }, cacheKey: 'private' }));
  expect(row).toEqual({ phase: 'recovery_comparison', comparisonCacheEntries: 1, comparisonCacheBytes: 123,
    representativeCacheEntries: 0, representativeCacheBytes: 0 });
});
test('rejects missing second post-drain cycle or mismatched final worker inventory', () => {
  const { recorder, study } = fixture(), result = recorder.finish(sample(650000), caches(0));
  expect(() => assertRefreshCycleRetention(result, { ...study, drainedAtMs: 350000 })).toThrow();
  expect(() => assertRefreshCycleRetention(result, { ...study, measurement: { createdWorkers: 3 } })).toThrow();
});
test('bounds retained observations at 120, with at most 60 attempts per worker', () => {
  const recorder = createRefreshCycleRetention();
  for (const worker of ['comparison', 'representative']) for (let attempt = 1; attempt <= 60; attempt++) {
    recorder.record({ worker, attempt, status: worker === 'comparison' ? 'ready' : 'published', elapsedMs: attempt }, sample(attempt), caches());
  }
  expect(() => recorder.record({ worker: 'comparison', attempt: 61, status: 'ready', elapsedMs: 61 }, sample(61), caches())).toThrow();
});
