/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function assertStudyProviderReceipt(row) {
  const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000;
  if (row?.cohortSize !== 8 || row.uniqueCompleted !== 8 || row.pending !== 0 || row.chargedAttempts !== 2 ||
    row.httpAttempts !== 11 || row.successes !== 8 || row.authentication !== 1 || row.throttled !== 1 ||
    row.unavailable !== 1 || row.unexpected !== 0 || row.resets !== 1 || row.repairs !== 1 ||
    row.peakPending !== 8 || row.preservedWaitChecks < 2 || row.pressureDeferrals < 2 ||
    ![row.passes, row.preservedWaitChecks, row.pressureDeferrals].every(count) ||
    row.passes < row.preservedWaitChecks + row.pressureDeferrals ||
    !Number.isFinite(row.transientMinWaitMs) || row.transientMinWaitMs < 29000 ||
    !Number.isFinite(row.recoveryMs) || row.recoveryMs < 0 || row.recoveryMs > 240000 ||
    row.httpDuringPressure !== 0 || row.maxActive !== 1) throw new Error('resource_study_provider_receipt_invalid');
}
