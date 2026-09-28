/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const profiles = Object.freeze({
  smoke: Object.freeze({ durationMs: 120000, growth: 5, rows: 400, dimensions: 768, evaluationIntervalMs: 1000 }),
  soak: Object.freeze({ durationMs: 1800000, growth: 20, rows: 400, dimensions: 768, evaluationIntervalMs: 1000 }),
  capacity: Object.freeze({ durationMs: 300000, growth: 20, rows: 6700, dimensions: 768, evaluationIntervalMs: 10000 }),
});

export function resourceStudyProfile(mode) {
  if (typeof mode !== 'string' || !Object.hasOwn(profiles, mode)) throw new Error('resource_study_profile_invalid');
  return profiles[mode];
}

export function assertResourceStudyReceipt(study, mode) {
  const profile = resourceStudyProfile(mode), recovery = study?.queueRecovery;
  if (study?.status !== 'passed' || study.version !== 'resource_study.v2' || study.profile !== mode ||
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
}
