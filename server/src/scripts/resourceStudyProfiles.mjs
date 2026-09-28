/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertStudyBudget, summarizeBudgetEnforcement } from './resourceStudyBudget.mjs';
import { assertStudyCgroup } from './resourceStudyMetrics.mjs';
const profiles = Object.freeze({
  smoke: Object.freeze({ durationMs: 120000, growth: 5, rows: 400, dimensions: 768, evaluationIntervalMs: 1000 }),
  soak: Object.freeze({ durationMs: 1800000, growth: 20, rows: 400, dimensions: 768, evaluationIntervalMs: 1000 }),
  capacity: Object.freeze({ durationMs: 300000, growth: 20, rows: 6700, dimensions: 768, evaluationIntervalMs: 10000 }),
});

export function resourceStudyProfile(mode) {
  if (typeof mode !== 'string' || !Object.hasOwn(profiles, mode)) throw new Error('resource_study_profile_invalid');
  return profiles[mode];
}

export function assertResourceStudyStartupReceipt(receipt, budget) {
  if (receipt?.budget !== budget) throw new Error('resource_study_startup_budget_invalid');
  assertStudyCgroup(receipt.metrics);
  assertStudyBudget(receipt.metrics, budget);
  if (receipt.metrics.memoryLimitHits !== 0 || receipt.metrics.oomKill !== 0 ||
    ![null, 0].includes(receipt.metrics.oom)) throw new Error('resource_study_startup_pressure');
}

export function assertResourceStudyReceipt(study, mode, budget = 'baseline') {
  const profile = resourceStudyProfile(mode), recovery = study?.queueRecovery;
  if (study?.status !== 'passed' || study.version !== 'resource_study.v3' || study.profile !== mode || study.budget !== budget ||
    study.requestedDurationMs !== profile.durationMs || !Number.isSafeInteger(study.durationMs) ||
    study.durationMs < profile.durationMs || study.durationMs > profile.durationMs + 180000 ||
    study.evaluationRows !== profile.rows || study.vectorDimensions !== profile.dimensions ||
    recovery?.cohortSize !== 20 || recovery.completed !== 20 || recovery.started !== 20 ||
    recovery.startedDuringPressure !== 0 || !Number.isFinite(recovery.heldMs) || recovery.heldMs < 5000 ||
    !Number.isSafeInteger(recovery.holdChecks) || recovery.holdChecks < 2 ||
    !Number.isFinite(recovery.firstDispatchMs) || recovery.firstDispatchMs < 0 || recovery.firstDispatchMs > 30000 ||
    !Number.isFinite(recovery.completedMs) || recovery.completedMs < recovery.firstDispatchMs || recovery.completedMs > 120000) {
    throw new Error('resource_study_receipt_invalid');
  }
  assertStudyBudget(study.initial, budget);
  assertStudyBudget(study.final, budget);
  assertStudyCgroup(study.initial);
  assertStudyCgroup(study.final);
  if (['cpuQuotaUsec', 'cpuPeriodUsec', 'pidsLimit'].some(key => study.initial[key] !== study.final[key])) {
    throw new Error('resource_study_budget_drift');
  }
  summarizeBudgetEnforcement(study.initial, study.final);
}
