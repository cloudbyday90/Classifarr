/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createComparisonMemoryEvidence, describeComparisonMemoryEvidence } from '../../services/comparisonMemoryEvidence.mjs';
import { createLiveInventoryModelCache } from '../../services/liveInventoryModelCache.mjs';

const pressure = { status: 'deferred', reason: 'memory_pressure' };
function setup() {
  let rss = 100, at = 1000;
  const usage = jest.fn(() => ({ rss, heapUsed: rss / 2, heapTotal: rss, external: 2, arrayBuffers: 1, secret: 'PRIVATE' }));
  const evidence = createComparisonMemoryEvidence({ readUsage: usage, now: () => at,
    readMemory: () => ({ available: 1000 - rss, constrained: 2000, total: 10000, secret: 'PRIVATE' }) });
  return { evidence, usage, set: (value, time = at + 100) => { rss = value; at = time; } };
}

test('links pressure, repeated attempts and recovery to a bounded completed-cycle reference', () => {
  const v = setup();
  for (let index = 0; index < 10; index++) {
    const cycle = v.evidence.begin(); v.set(100 + 2 * index);
    expect(cycle.finish({ status: 'ready' })).toBeUndefined();
  }
  const attempt = v.evidence.begin(() => ({ entries: 1, estimatedBytes: 500, data: 'PRIVATE' }));
  v.set(700); attempt.stage('profile_build');
  attempt.decision({ phase: 'running_checkpoint', allowed: false, reason: 'memory_pressure',
    availableBytes: 300, constrainedBytes: 2000, requiredBytes: 400, reserveBytes: 400, workBytes: 0 });
  v.set(200); attempt.stage('publication');
  const first = attempt.finish(pressure);
  expect(first).toMatchObject({ version: 1, attempts: 1, samples: 5, referenceKind: 'last_completed_refresh',
    peak: { stage: 'profile_build', process: { rss: 700 } }, end: { process: { rss: 200 } },
    decision: { phase: 'running_checkpoint', stage: 'profile_build', availableBytes: 300, requiredBytes: 400 },
    rssDeltaFromReference: 82, heapDeltaFromReference: 41 });
  expect(first.recentCompleted).toHaveLength(3);
  expect(first.recentCompleted.at(-1).end.process.rss).toBe(118);
  const next = v.evidence.begin().finish(pressure);
  expect(next.reference).toBe(first.reference); expect(next.attemptId).not.toBe(first.attemptId);
  expect(next.attempts).toBe(2);
  // Failed/cancelled attempts must not manufacture a completed reference or recovery.
  expect(v.evidence.begin().finish({ status: 'cancelled' })).toBeUndefined();
  const recovered = v.evidence.begin().finish({ status: 'revalidated' });
  expect(recovered.reference).toBe(first.reference); expect(recovered.attempts).toBe(4);
  const later = v.evidence.begin().finish(pressure);
  expect(later.reference).not.toBe(first.reference); expect(later.attempts).toBe(1);
  expect(later.recentCompleted.at(-1).status).toBe('revalidated');
  expect(JSON.stringify(first)).not.toContain('PRIVATE');
  expect(JSON.stringify(first).length).toBeLessThan(8000);
  expect(Object.isFrozen(first.recentCompleted[0].end.process)).toBe(true);
  expect(describeComparisonMemoryEvidence(first)).toBe(first);
  expect(describeComparisonMemoryEvidence({ ...first, arbitrary: 'PRIVATE' })).toBeUndefined();
  expect(describeComparisonMemoryEvidence(null)).toBeUndefined();
});

test('bounds observations, records unknown telemetry and never copies arbitrary data', () => {
  const v = setup(), attempt = v.evidence.begin();
  for (let index = 0; index < 1000; index++) attempt.stage('profile_build');
  const report = attempt.finish(pressure);
  expect(v.usage).toHaveBeenCalledTimes(16); expect(report.samples).toBe(16);
  expect(report.referenceKind).toBe('no_completed_refresh'); expect(report.rssDeltaFromReference).toBeNull();
  const bad = new Proxy({}, { get() { throw new Error('PRIVATE'); } });
  const unavailable = createComparisonMemoryEvidence({ readUsage: () => bad,
    readMemory: () => { throw new Error('PRIVATE'); }, now: () => NaN }).begin(() => bad);
  unavailable.decision(bad);
  unavailable.decision({ phase: 'start_checkpoint', allowed: false, reason: 'memory_unknown', requiredBytes: Infinity });
  const missing = unavailable.finish({ status: 'deferred', reason: 'memory_unknown' });
  expect(missing.end).toMatchObject({ at: null, availableBytes: null, process: { rss: null }, cache: { entries: null } });
  expect(missing.decision.requiredBytes).toBeNull();
  expect(JSON.stringify(missing)).not.toContain('PRIVATE');
  expect(createComparisonMemoryEvidence().begin().finish(pressure).reference).not.toBe(report.reference);
});

test('first refusal survives subsequent decisions and captures shared admission separately', () => {
  const attempt = setup().evidence.begin();
  attempt.decision({ phase: 'shared_admission', allowed: true, active: { ingestion: 0, queue: 0, discovery: 0 },
    reservedBytes: 0, requiredBytes: 1024 });
  attempt.decision({ phase: 'running_checkpoint', allowed: false, reason: 'memory_pressure', requiredBytes: 256 });
  attempt.decision({ phase: 'start_checkpoint', allowed: true, requiredBytes: 999 });
  const report = attempt.finish(pressure);
  expect(report.admission).toMatchObject({ allowed: true, requiredBytes: 1024 });
  expect(report.decision).toMatchObject({ allowed: false, requiredBytes: 256 });
});

test('cache observations do not prune, extend TTL or expose entries', () => {
  let now = 0;
  const cache = createLiveInventoryModelCache({ now: () => now, ttlMs: 10 });
  cache.set('a'.repeat(64), { secret: 'PRIVATE' }, 100);
  now = 20;
  expect(cache.inspect()).toEqual({ entries: 1, estimatedBytes: 100 });
  expect(cache.get('a'.repeat(64))).toBeUndefined();
  expect(cache.inspect()).toEqual({ entries: 0, estimatedBytes: 0 });
});
