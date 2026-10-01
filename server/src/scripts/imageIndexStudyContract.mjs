/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertStudyCgroup } from './resourceStudyMetrics.mjs';
import { assertStudyBudget, assertStudyBudgetContinuity, summarizeBudgetEnforcement } from './resourceStudyBudget.mjs';
import { IMAGE_INDEX_RESULTS, imageIndexResultCode } from '../utils/imageIndexResultProtocol.mjs';

export const IMAGE_INDEX_STUDY_PROFILE = Object.freeze({ durationMs: 1_200_000, idleMs: 0 });
export const IMAGE_INDEX_STUDY_CASES = Object.freeze([
  { name: 'small_build', rows: 1000 }, { name: 'interrupted_recovery', rows: 1000 },
  { name: 'large_build', rows: 10000 }, { name: 'capacity_build', rows: 50000 },
].map(Object.freeze));
export const IMAGE_INDEX_STUDY_PHASES = Object.freeze(['initializing', 'building', 'validation', 'writer_wait', 'snapshot_wait', 'other', 'idle']);
export const IMAGE_INDEX_STUDY_WAITS = Object.freeze(['Lock', 'IO', 'LWLock', 'Client', 'IPC', 'Timeout', 'Activity', 'BufferPin', 'none', 'other']);

export function studyIndexPhase(value) {
  if (value === undefined || value === null) return 'idle';
  if (value === 'initializing') return 'initializing';
  if (value.startsWith('building index')) return 'building';
  if (value.startsWith('index validation:')) return 'validation';
  if (value.startsWith('waiting for writers')) return 'writer_wait';
  return value === 'waiting for old snapshots' ? 'snapshot_wait' : 'other';
}

export function assertImageIndexStudyReceipt(study, budget = 'baseline') {
  assert.equal(study?.version, 'image_index_study.v1');
  assert.equal(study.status, 'measured'); assert.equal(study.profile, 'image-index');
  assert.equal(study.budget, budget); assert.equal(study.dimensions, 2000);
  assert.equal(study.rowsPreserved, true); assert.equal(study.workersStopped, true);
  assert.equal(study.databaseIdle, true); assert.equal(study.interruption?.invalidObserved, true);
  assert.equal(study.interruption?.claimRotated, true);
  assert.equal(study.interruption?.staleClaimRejected, true);
  assert.equal(study.cases?.length, IMAGE_INDEX_STUDY_CASES.length);
  assert(Number.isSafeInteger(study.durationMs) && study.durationMs > 0 && study.durationMs <= IMAGE_INDEX_STUDY_PROFILE.durationMs);
  for (const [index, expected] of IMAGE_INDEX_STUDY_CASES.entries()) {
    const row = study.cases[index];
    assert.equal(row.name, expected.name); assert.equal(row.rows, expected.rows);
    assert(['complete', 'incomplete'].includes(row.outcome));
    assert(Number.isSafeInteger(row.durationMs) && row.durationMs >= 0 && row.durationMs <= 155000);
    assert(Number.isInteger(row.validIndexes) && row.validIndexes >= 0 && row.validIndexes <= 3);
    assert.equal(row.acknowledged, row.outcome === 'complete');
    // Older v1 receipts did not capture the acknowledged workspace.
    if (Object.hasOwn(row, 'workMemMiB')) assert(row.outcome === 'complete'
      ? [64, 512].includes(row.workMemMiB) : row.workMemMiB === null);
    if (row.outcome === 'complete') {
      assert.equal(row.validIndexes, 3); assert.equal(row.exitCode, 0);
      assert.equal(row.signal, null); assert.equal(row.watchdog, false);
    } else assert.notEqual(row.exitCode, 0);
    assert(Number.isInteger(row.samples) && row.samples > 0 && row.samples <= 600);
    for (const key of ['containerPeakBytes', 'probePeakBytes', 'containerCpuP95']) assert(Number.isFinite(row[key]) && row[key] >= 0);
    for (const key of ['workerPeakBytes', 'postgresPeakBytes']) assert(row[key] === null || (Number.isFinite(row[key]) && row[key] > 0));
    for (const [key, values] of [['phases', IMAGE_INDEX_STUDY_PHASES], ['waits', IMAGE_INDEX_STUDY_WAITS]]) {
      assert.deepEqual(Object.keys(row[key]), [...values]);
      assert(Object.values(row[key]).every(n => Number.isInteger(n) && n >= 0));
      assert.equal(Object.values(row[key]).reduce((a, b) => a + b, 0), row.samples);
    }
    assert([0, 1, 2, 75, null].includes(row.exitCode)
      || (Number.isInteger(row.exitCode) && imageIndexResultCode(IMAGE_INDEX_RESULTS[row.exitCode]) === row.exitCode));
    assert([null, 'SIGTERM', 'SIGKILL'].includes(row.signal));
    assert.equal(row.exitCode === null, row.signal !== null);
    assert.equal(typeof row.watchdog, 'boolean');
  }
  for (const metrics of [study.initial, study.final]) { assertStudyCgroup(metrics); assertStudyBudget(metrics, budget); }
  assertStudyBudgetContinuity(study.initial, study.final);
  assert.equal(study.final.oomKill, 0); assert.equal(study.final.memoryLimitHits, 0);
  assert([null, 0].includes(study.final.oom));
  summarizeBudgetEnforcement(study.initial, study.final);
}
