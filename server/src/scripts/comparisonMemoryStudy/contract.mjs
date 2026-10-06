/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertStudyBudget, assertStudyBudgetContinuity } from '../resourceStudyBudget.mjs';
import { assertStudyCgroup } from '../resourceStudyMetrics.mjs';

export const COMPARISON_CONCURRENT_PROFILE = Object.freeze({ durationMs: 1_800_000, idleMs: 300_000 });

export function assertComparisonConcurrentReceipt(study, budget) {
  assert.equal(budget, 'bounded'); assert.equal(study?.budget, budget);
  assert.equal(study.version, 'comparison_concurrent.v1'); assert.equal(study.status, 'measured');
  assert.ok(['comparison-control', 'comparison-concurrent'].includes(study.profile));
  assert.ok(Number.isSafeInteger(study.durationMs) && study.durationMs >= 900_000 && study.durationMs <= 2_400_000);
  for (const row of [study.initial, study.final]) {
    assertStudyCgroup(row); assertStudyBudget(row, budget);
    assert.equal(row.oomKill, 0); assert.equal(row.memoryLimitHits, 0); assert.ok([null, 0].includes(row.oom));
  }
  assertStudyBudgetContinuity(study.initial, study.final);
  assert.equal(study.refresh.cycles.length, 3);
  assert.ok(['ready', 'revalidated'].includes(study.refresh.cycles.at(-1).comparison));
  assert.ok(Number.isSafeInteger(study.refresh.builds) && study.refresh.builds >= 1 && study.refresh.builds <= 3);
  assert.ok(Number.isSafeInteger(study.refresh.reads) && study.refresh.reads >= 4 && study.refresh.reads <= 12);
  assert.ok(Number.isSafeInteger(study.measurement.createdWorkers) && study.measurement.createdWorkers > 0);
  assert.equal(study.measurement.createdWorkers, study.measurement.exitedWorkers);
  assert.equal(study.measurement.activeWorkers, 0);
  for (const kind of ['ingestion', 'queue', 'discovery']) assert.equal(study.admission[kind].active, 0);
  assert.ok(study.idle.length >= 10 && study.idle.length <= 12);
  let previous = 0;
  for (const row of study.idle) {
    assert.ok(Number.isSafeInteger(row.elapsedMs) && row.elapsedMs > previous && row.elapsedMs <= study.durationMs);
    for (const key of ['heapUsed', 'rss', 'containerBytes']) assert.ok(Number.isSafeInteger(row[key]) && row[key] >= 0);
    previous = row.elapsedMs;
  }
  assert.ok(study.idle.at(-1).elapsedMs - study.idle[0].elapsedMs >= 269_000);
  if (study.profile === 'comparison-concurrent') {
    assert.equal(study.work.waves, 20); assert.equal(study.work.inventory, 1600); assert.equal(study.work.completed, 1600);
    for (const key of ['pending', 'failed', 'routing', 'handoffs', 'serviceErrors']) assert.equal(study.work[key], 0);
    for (const key of ['ingestion', 'queue']) {
      assert.ok(Number.isSafeInteger(study.overlap[key]) && study.overlap[key] > 0, 'comparison_study_overlap_missing');
    }
  } else {
    assert.equal(study.work, null); assert.deepEqual(study.overlap, { ingestion: 0, queue: 0 });
  }
}
