/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertStudyBudget, assertStudyBudgetContinuity } from '../resourceStudyBudget.mjs';
import { assertStudyCgroup } from '../resourceStudyMetrics.mjs';

export const COMPARISON_RECOVERY_PROFILE = Object.freeze({ durationMs: 1_500_000, idleMs: 120_000 });

export function comparisonRecoveryEvidence(attempts, decisions) {
  const pressure = attempts.find(row => row.worker === 'comparison' && row.status === 'deferred' &&
    row.reason === 'memory_pressure' && decisions.some(decision => decision.worker === row.worker &&
      decision.attempt === row.attempt && decision.reason === 'memory_pressure' && decision.allowed === false &&
      decision.availableBytes < decision.requiredBytes));
  const recovered = pressure && attempts.find(row => row.worker === 'comparison' &&
    row.attempt > pressure.attempt && ['ready', 'revalidated'].includes(row.status));
  const revalidated = recovered && attempts.find(row => row.worker === 'comparison' &&
    row.attempt > recovered.attempt && row.status === 'revalidated' && row.elapsedMs - recovered.elapsedMs >= 300_000);
  return { pressure, recovered, revalidated };
}

export function assertComparisonRecoveryReceipt(study, budget) {
  assert.equal(budget, 'bounded'); assert.equal(study?.budget, budget);
  assert.equal(study.version, 'comparison_recovery.v1'); assert.equal(study.profile, 'comparison-recovery');
  assert.equal(study.status, 'measured'); assert.equal(study.sourceChanges, 1);
  assert.ok(Number.isSafeInteger(study.durationMs) && study.durationMs >= 600_000 && study.durationMs <= 1_800_000);
  for (const row of [study.initial, study.final]) {
    assertStudyCgroup(row); assertStudyBudget(row, budget);
    assert.equal(row.oomKill, 0); assert.equal(row.memoryLimitHits, 0); assert.ok([null, 0].includes(row.oom));
  }
  assertStudyBudgetContinuity(study.initial, study.final);
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
      assert.equal(row.reserveBytes, 256 * 1024 ** 2);
      assert.equal(row.workBytes, 768 * 1024 ** 2);
      assert.equal(row.reservedBytes, 0);
      assert.ok([0, 64 * 1024 ** 2].includes(row.hysteresisBytes));
      for (const key of ['availableBytes', 'reserveBytes', 'reservedBytes', 'workBytes', 'hysteresisBytes', 'requiredBytes']) {
        assert.ok(Number.isSafeInteger(row[key]) && row[key] >= 0);
      }
      assert.equal(row.requiredBytes, row.reserveBytes + row.reservedBytes + row.workBytes + row.hysteresisBytes);
      assert.equal(row.allowed, row.availableBytes >= row.requiredBytes);
    }
  }
  const evidence = comparisonRecoveryEvidence(study.attempts, study.decisions);
  assert.ok(evidence.pressure && evidence.recovered && evidence.revalidated, 'comparison_natural_recovery_not_proven');
  for (const row of [evidence.recovered, evidence.revalidated]) assert.ok(study.decisions.some(decision =>
    decision.worker === row.worker && decision.attempt === row.attempt && decision.allowed === true));
  assert.ok(Number.isSafeInteger(study.measurement.createdWorkers) && study.measurement.createdWorkers > 0);
  assert.equal(study.measurement.createdWorkers, study.measurement.exitedWorkers);
  assert.equal(study.measurement.activeWorkers, 0);
  for (const kind of ['ingestion', 'queue', 'discovery']) assert.equal(study.admission[kind].active, 0);
}
