/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertStudyCgroup } from './resourceStudyMetrics.mjs';
import { assertStudyBudget, assertStudyBudgetContinuity, summarizeBudgetEnforcement } from './resourceStudyBudget.mjs';

export const IMAGE_MIXED_CASES = Object.freeze(['baseline', 'mixed_build', 'cancelled_build', 'recovery']);
export function assertImageIndexMixedReceipt(study, budget = 'image-capacity') {
  assert.equal(budget, 'image-capacity'); assert.equal(study.budget, budget);
  assert.equal(study.version, 'image_index_mixed.v1'); assert.equal(study.profile, 'image-index-mixed');
  assert.equal(study.status, 'measured'); assert.equal(study.rows, 50000);
  for (const flag of ['rowsPreserved', 'workersStopped', 'databaseIdle', 'invalidObserved', 'staleClaimRejected']) assert.equal(study[flag], true);
  assert(Number.isSafeInteger(study.durationMs) && study.durationMs > 0 && study.durationMs <= 1200000);
  assert.equal(study.cases.length, IMAGE_MIXED_CASES.length);
  for (const [i, row] of study.cases.entries()) {
    assert.equal(row.name, IMAGE_MIXED_CASES[i]);
    assert.equal(row.foreground.inventory, (i + 1) * 80);
    assert(Number.isFinite(row.foreground.durationMs) && row.foreground.durationMs > 0 && row.foreground.durationMs < 300000);
    for (const [key, count] of [['scans', 4], ['retrievals', 40]]) {
      const latency = row.foreground[key]; assert.equal(latency.count, count);
      assert([latency.p50Ms, latency.p95Ms, latency.maxMs].every(n => Number.isFinite(n) && n >= 0));
      assert(latency.p50Ms <= latency.p95Ms && latency.p95Ms <= latency.maxMs);
    }
    assert(Number.isFinite(row.containerPeakBytes) && row.containerPeakBytes > 0);
    assert(Number.isFinite(row.containerCpuP95) && row.containerCpuP95 >= 0);
    if (i === 0) { assert.equal(row.execution, null); continue; }
    assert.equal(row.startedDuringBuild, true); assert(row.overlapRetrievals > 0 && row.overlapRetrievals <= 40);
    const execution = row.execution;
    assert(Number.isSafeInteger(execution.databaseStopMs) && execution.databaseStopMs >= 0 && execution.databaseStopMs <= 10000);
    assert(Number.isSafeInteger(execution.durationMs) && execution.durationMs > 0 && execution.durationMs < 155000);
    assert.equal(execution.watchdog, false);
    if (i === 2) {
      assert.equal(execution.signal, 'SIGTERM'); assert.equal(execution.exitCode, null);
      assert.equal(execution.interrupted, true); assert.equal(row.acknowledged, false);
      assert.equal(row.workMemMiB, null);
    } else {
      assert.equal(execution.signal, null); assert.equal(execution.exitCode, 0);
      assert.equal(row.acknowledged, true); assert.equal(row.workMemMiB, 512); assert.equal(row.validIndexes, 3);
    }
  }
  for (const value of [study.initial, study.final]) { assertStudyCgroup(value); assertStudyBudget(value, budget); }
  assertStudyBudgetContinuity(study.initial, study.final); summarizeBudgetEnforcement(study.initial, study.final);
  assert.equal(study.final.oomKill, 0); assert.equal(study.final.memoryLimitHits, 0); assert([null, 0].includes(study.final.oom));
}
