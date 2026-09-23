/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const LIBRARY_UPGRADE_READINESS_VERSION = 'library.upgrade_readiness.v1'

const profileKeys = ['current', 'queued', 'processing', 'retryWait', 'cooldown',
  'waiting', 'paused', 'unverified', 'noInventory', 'missing']

function nonNegativeCount(value) {
  return Number.isSafeInteger(value) && value >= 0
}

export function parseLibraryUpgradeReadiness(value) {
  if (value?.version !== LIBRARY_UPGRADE_READINESS_VERSION ||
      typeof value.asOf !== 'string' || !Number.isFinite(Date.parse(value.asOf)) ||
      !nonNegativeCount(value.libraryCount) || !nonNegativeCount(value.activeLibraryCount) ||
      value.activeLibraryCount > value.libraryCount ||
      typeof value.upgradeEnrollmentRecorded !== 'boolean' ||
      !profileKeys.every(key => nonNegativeCount(value.profile?.[key])) ||
      !['movie', 'tv', 'other'].every(key => nonNegativeCount(value.mediaTypes?.[key])) ||
      value.mediaTypes.movie + value.mediaTypes.tv + value.mediaTypes.other !== value.libraryCount ||
      !nonNegativeCount(value.sourceIdentity?.completeCaptureLibraryCount) ||
      (value.recovery != null && (
        !['plannerOverdue', 'workerOverdue', 'leaseRecoveryOverdue']
          .every(key => nonNegativeCount(value.recovery?.[key])) ||
        !Number.isSafeInteger(value.recovery.graceMinutes) ||
        value.recovery.graceMinutes < 1 || value.recovery.graceMinutes > 1440 ||
        value.recovery.plannerOverdue + value.recovery.workerOverdue +
          value.recovery.leaseRecoveryOverdue > value.activeLibraryCount)) ||
      !nonNegativeCount(value.sourceIdentity?.unresolvedItemCount) ||
      !nonNegativeCount(value.sourceIdentity?.conflictingProviderItemCount) ||
      !nonNegativeCount(value.sourceIdentity?.invalidProviderItemCount) ||
      !nonNegativeCount(value.sourceIdentity?.invalidMediaTypeItemCount) ||
      value.sourceIdentity.unresolvedItemCount !== value.sourceIdentity.conflictingProviderItemCount +
        value.sourceIdentity.invalidProviderItemCount + value.sourceIdentity.invalidMediaTypeItemCount ||
      value.sourceIdentity.completeCaptureLibraryCount > value.activeLibraryCount ||
      value.sourceIdentity.scope !== 'active_complete_full_captures_last_30_days') return null
  const statusTotal = profileKeys.filter(key => key !== 'missing')
    .reduce((sum, key) => sum + value.profile[key], 0)
  if (statusTotal !== value.libraryCount || value.profile.missing > value.libraryCount) return null
  return {
    asOf: value.asOf, libraryCount: value.libraryCount,
    activeLibraryCount: value.activeLibraryCount,
    mediaTypes: Object.fromEntries(['movie', 'tv', 'other'].map(key => [key, value.mediaTypes[key]])),
    profile: Object.fromEntries(profileKeys.map(key => [key, value.profile[key]])),
    upgradeEnrollmentRecorded: value.upgradeEnrollmentRecorded,
    recovery: value.recovery == null ? null : {
      plannerOverdue: value.recovery.plannerOverdue,
      workerOverdue: value.recovery.workerOverdue,
      leaseRecoveryOverdue: value.recovery.leaseRecoveryOverdue,
      graceMinutes: value.recovery.graceMinutes,
    },
    sourceIdentity: {
      completeCaptureLibraryCount: value.sourceIdentity.completeCaptureLibraryCount,
      unresolvedItemCount: value.sourceIdentity.unresolvedItemCount,
      conflictingProviderItemCount: value.sourceIdentity.conflictingProviderItemCount,
      invalidProviderItemCount: value.sourceIdentity.invalidProviderItemCount,
      invalidMediaTypeItemCount: value.sourceIdentity.invalidMediaTypeItemCount,
      scope: value.sourceIdentity.scope,
    },
  }
}
