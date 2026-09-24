/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const LIBRARY_UNDERSTANDING_SUMMARY_VERSION = 'library.understanding_summary.v1'

const profileKeys = ['current', 'updating', 'coolingDown', 'unverified', 'paused', 'noInventory']

const isCount = value => Number.isSafeInteger(value) && value >= 0

export function parseLibraryUnderstandingSummary(value, readiness) {
  if (value?.version !== LIBRARY_UNDERSTANDING_SUMMARY_VERSION ||
      value.asOf !== readiness.asOf || value.libraryCount !== readiness.libraryCount ||
      value.classificationQuality !== 'not_measured' ||
      !profileKeys.every(key => isCount(value.profile?.[key])) ||
      profileKeys.reduce((sum, key) => sum + value.profile[key], 0) !== readiness.libraryCount ||
      value.profile.current !== readiness.profile.current ||
      value.profile.updating !== readiness.profile.queued + readiness.profile.processing +
        readiness.profile.retryWait + readiness.profile.waiting ||
      value.profile.coolingDown !== readiness.profile.cooldown ||
      value.profile.unverified !== readiness.profile.unverified ||
      value.profile.paused !== readiness.profile.paused ||
      value.profile.noInventory !== readiness.profile.noInventory ||
      !isCount(value.recovery?.overdueLibraryCount) ||
      typeof value.recovery.workerStalled !== 'boolean' ||
      value.recovery.overdueLibraryCount !== (readiness.recovery?.plannerOverdue || 0) +
        (readiness.recovery?.workerOverdue || 0) +
        (readiness.recovery?.leaseRecoveryOverdue || 0) ||
      (value.recovery.workerStalled && value.recovery.overdueLibraryCount === 0) ||
      !isCount(value.sourceIdentity?.unresolvedItemCount) ||
      !isCount(value.sourceIdentity?.coveredActiveLibraryCount) ||
      !isCount(value.sourceIdentity?.activeLibraryCount) ||
      value.sourceIdentity.unresolvedItemCount !== readiness.sourceIdentity.unresolvedItemCount ||
      value.sourceIdentity.coveredActiveLibraryCount !== readiness.sourceIdentity.completeCaptureLibraryCount ||
      value.sourceIdentity.activeLibraryCount !== readiness.activeLibraryCount) return null
  return {
    version: value.version, asOf: value.asOf, libraryCount: value.libraryCount,
    profile: Object.fromEntries(profileKeys.map(key => [key, value.profile[key]])),
    recovery: { overdueLibraryCount: value.recovery.overdueLibraryCount,
      workerStalled: value.recovery.workerStalled },
    sourceIdentity: { unresolvedItemCount: value.sourceIdentity.unresolvedItemCount,
      coveredActiveLibraryCount: value.sourceIdentity.coveredActiveLibraryCount,
      activeLibraryCount: value.sourceIdentity.activeLibraryCount },
    classificationQuality: 'not_measured',
  }
}
