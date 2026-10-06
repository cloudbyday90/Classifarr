/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertStudyBudget, assertStudyBudgetContinuity } from '../resourceStudyBudget.mjs';
import { assertStudyCgroup } from '../resourceStudyMetrics.mjs';
import { comparisonRecoveryEvidence } from './recoveryContract.mjs';

export function comparisonCatalogCompletion(attempts, drainedAtMs) {
  if (!Number.isSafeInteger(drainedAtMs) || drainedAtMs <= 0) return false;
  const published = attempts.find(row => row.worker === 'comparison' &&
    row.elapsedMs > drainedAtMs && ['ready', 'revalidated'].includes(row.status));
  return Boolean(published && attempts.some(row => row.worker === 'comparison' &&
    row.attempt > published.attempt && row.status === 'revalidated' && row.elapsedMs - published.elapsedMs >= 300_000) &&
    attempts.some(row => row.worker === 'representative' && row.elapsedMs > drainedAtMs &&
      ['published', 'up_to_date'].includes(row.status)));
}

/** Workload completion is distinct from proof of naturally occurring pressure recovery. */
export function assertComparisonCatalogReceipt(study, budget) {
  assert.equal(budget, 'bounded'); assert.equal(study?.budget, budget);
  assert.equal(study.version, 'comparison_catalog.v1'); assert.equal(study.profile, 'comparison-catalog');
  assert.equal(study.status, 'measured');
  assert.ok(Number.isSafeInteger(study.durationMs) && study.durationMs >= 900_000 && study.durationMs <= 1_800_000);
  for (const row of [study.initial, study.final]) {
    assertStudyCgroup(row); assertStudyBudget(row, budget);
    assert.equal(row.oomKill, 0); assert.equal(row.memoryLimitHits, 0); assert.ok([null, 0].includes(row.oom));
  }
  assertStudyBudgetContinuity(study.initial, study.final);
  assert.ok(study.drainedAtMs >= 600_000 && study.drainedAtMs < study.durationMs);
  assert.equal(study.work.waves, 20);
  assert.equal(study.work.libraries, 10); assert.equal(study.work.owners, 10);
  for (const key of ['inventory', 'completed']) assert.equal(study.work[key], 5776);
  for (const key of ['pending', 'failed', 'routing', 'handoffs', 'serviceErrors']) assert.equal(study.work[key], 0);
  assert.deepEqual(study.coverage, { descriptions: 5776, cached: 5776 });
  assert.ok(study.attempts.length > 0 && study.attempts.length <= 120);
  assert.ok(study.decisions.length > 0 && study.decisions.length <= 128);
  for (const worker of ['comparison', 'representative']) {
    let previous = 0, elapsed = 0;
    for (const row of study.attempts.filter(row => row.worker === worker)) {
      assert.ok(Number.isSafeInteger(row.attempt) && row.attempt > previous && row.attempt <= 60);
      assert.ok(Number.isSafeInteger(row.elapsedMs) && row.elapsedMs >= elapsed && row.elapsedMs <= study.durationMs);
      previous = row.attempt; elapsed = row.elapsedMs;
    }
  }
  for (const row of study.decisions) {
    assert.ok(['comparison', 'representative'].includes(row.worker)); assert.equal(row.kind, 'discovery');
    assert.ok(study.attempts.some(attempt => attempt.worker === row.worker && attempt.attempt === row.attempt));
    if (!['busy', 'memory_unknown'].includes(row.reason)) {
      assert.equal(row.reserveBytes, 256 * 1024 ** 2); assert.equal(row.workBytes, 768 * 1024 ** 2);
      assert.equal(row.reservedBytes, 0); assert.ok([0, 64 * 1024 ** 2].includes(row.hysteresisBytes));
      for (const key of ['availableBytes', 'requiredBytes']) assert.ok(Number.isSafeInteger(row[key]) && row[key] >= 0);
      assert.equal(row.requiredBytes, row.reserveBytes + row.reservedBytes + row.workBytes + row.hysteresisBytes);
      assert.equal(row.allowed, row.availableBytes >= row.requiredBytes);
    }
  }
  assert.ok(comparisonCatalogCompletion(study.attempts, study.drainedAtMs), 'comparison_catalog_completion_missing');
  for (const row of study.attempts.filter(row => ['ready', 'revalidated', 'published', 'up_to_date'].includes(row.status))) {
    assert.ok(study.decisions.some(decision => decision.worker === row.worker && decision.attempt === row.attempt && decision.allowed));
  }
  const recovered = Boolean(comparisonRecoveryEvidence(study.attempts, study.decisions, study.drainedAtMs).revalidated);
  assert.equal(study.pressureRecoveryObserved, recovered);
  assert.ok(Number.isSafeInteger(study.measurement.createdWorkers) && study.measurement.createdWorkers > 0);
  assert.equal(study.measurement.createdWorkers, study.measurement.exitedWorkers); assert.equal(study.measurement.activeWorkers, 0);
  for (const kind of ['ingestion', 'queue', 'discovery']) assert.equal(study.admission[kind].active, 0);
  for (const kind of ['ingestion', 'queue']) assert.ok(Number.isSafeInteger(study.overlap[kind]) && study.overlap[kind] >= 0);
}
