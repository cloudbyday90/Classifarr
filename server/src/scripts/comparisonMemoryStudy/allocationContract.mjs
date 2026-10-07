/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertVectorReadObservation } from './vectorReadContract.mjs';

export const ALLOCATION_PHASES = Object.freeze({ build_control: 'comparison', community_build: 'comparison',
  build_quality: 'comparison', comparison_verification: 'comparison', representative_verification: 'representative',
  representative_preparation: 'representative' });
const COMPONENTS = new Set(['other', 'community_neighbors', 'community_graph', 'community_summary',
  'community_partition', 'community_centroid', 'community_participation', 'shared_normalization',
  'vector_normalization', 'normalization_arithmetic', 'broad_control', 'membership_validation', 'profile_assembly',
  'vector_read', 'vector_cache', 'vector_fingerprint', 'comparison_verification', 'representative_verification',
  'representative_preparation', 'representative_validation', 'description_corpus', 'vector_parsing',
  'vector_validation', 'vector_assembly', 'database_transport', 'database_client', 'diagnostic_overhead']);
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  assert.ok(Number.isSafeInteger(value) && value >= min && value <= max, 'comparison_allocation_invalid');
const keys = (row, expected) => assert.deepEqual(Object.keys(row).sort(), expected.split(' ').sort());

/** Require genuine build and post-drain warm windows, not just valid-looking numbers. */
export function assertComparisonAllocationReceipt(report, study) {
  keys(report, 'version mode intervalBytes windows');
  assert.equal(report.version, 2); assert.equal(report.mode, 'allocations'); assert.equal(report.intervalBytes, 524288);
  assert.ok(Array.isArray(report.windows)); integer(report.windows.length, 6, 128);
  let previousEnd = 0;
  for (const row of report.windows) {
    keys(row, 'phase worker attempt startMs endMs heapStart heapEnd rssStart rssEnd profile vectorReads');
    assertVectorReadObservation(row.vectorReads);
    assert.ok(Object.hasOwn(ALLOCATION_PHASES, row.phase)); assert.equal(row.worker, ALLOCATION_PHASES[row.phase]);
    integer(row.attempt, 1, 60); integer(row.startMs, previousEnd, study.durationMs);
    integer(row.endMs, row.startMs, Math.min(study.durationMs, row.startMs + 360_000)); previousEnd = row.endMs;
    for (const key of ['heapStart', 'heapEnd', 'rssStart', 'rssEnd']) integer(row[key]);
    const attempt = study.attempts.find(a => a.worker === row.worker && a.attempt === row.attempt);
    assert.ok(attempt && row.endMs <= attempt.elapsedMs);
    const p = row.profile; keys(p, 'sampledEstimatedBytes nodes samples components');
    integer(p.sampledEstimatedBytes); integer(p.nodes, 1, 50_000); integer(p.samples, 0, 200_000);
    let total = 0;
    for (const [component, bytes] of Object.entries(p.components)) {
      assert.ok(COMPONENTS.has(component)); integer(bytes, 1); total += bytes; integer(total);
    }
    assert.equal(total, p.sampledEstimatedBytes);
  }
  for (const phase of Object.keys(ALLOCATION_PHASES)) assert.ok(report.windows.some(w => w.phase === phase));
  for (const [worker, status, phase] of [['comparison', 'revalidated', 'comparison_verification'],
    ['representative', 'up_to_date', 'representative_preparation']]) {
    const warm = study.attempts.filter(a => a.worker === worker && a.status === status && a.elapsedMs > study.drainedAtMs);
    assert.ok(warm.some(a => report.windows.some(w => w.phase === phase && w.attempt === a.attempt && w.startMs > study.drainedAtMs &&
      ['read', 'decode'].every(stage => w.vectorReads.owned[stage].rows >= study.coverage.cached &&
        w.vectorReads.owned[stage].components === w.vectorReads.owned[stage].rows * 1024))),
      'comparison_allocation_warm_missing');
  }
}
