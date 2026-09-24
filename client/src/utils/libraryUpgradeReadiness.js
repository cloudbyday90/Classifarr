/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseLibraryUnderstandingSummary } from './libraryUnderstandingSummary'

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
      (value.workerHealth != null && (
        !['idle', 'not_observed', 'check_in_overdue', 'cycle_failed',
          'no_recent_completion', 'backlog_progressing', 'overdue_without_claimable_work']
          .includes(value.workerHealth.statusId) ||
        !nonNegativeCount(value.workerHealth.claimableCount) ||
        !['lastTickAt', 'lastSuccessAt', 'lastClaimedAt', 'lastCompletedAt', 'oldestClaimableAt']
          .every(key => value.workerHealth[key] == null ||
            (typeof value.workerHealth[key] === 'string' &&
              Number.isFinite(Date.parse(value.workerHealth[key])))) ||
        (value.workerHealth.lastSuccessAgeMinutes != null &&
          !nonNegativeCount(value.workerHealth.lastSuccessAgeMinutes)) ||
        (value.workerHealth.lastSuccessAt == null &&
          value.workerHealth.lastSuccessAgeMinutes != null) ||
        (value.workerHealth.lastSuccessAt != null &&
          !nonNegativeCount(value.workerHealth.lastSuccessAgeMinutes)) ||
        (value.workerHealth.claimableCount === 0 &&
          (value.workerHealth.oldestClaimableAt != null ||
            value.workerHealth.oldestClaimableAgeMinutes != null)) ||
        (value.workerHealth.claimableCount > 0 &&
          (value.workerHealth.oldestClaimableAt == null ||
            !nonNegativeCount(value.workerHealth.oldestClaimableAgeMinutes))) ||
        value.workerHealth.checkInGraceMinutes !== 5 ||
        value.workerHealth.completionGraceMinutes !== 15)) ||
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
  const report = {
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
    workerHealth: value.workerHealth == null ? null : {
      statusId: value.workerHealth.statusId,
      claimableCount: value.workerHealth.claimableCount,
      lastTickAt: value.workerHealth.lastTickAt,
      lastSuccessAt: value.workerHealth.lastSuccessAt,
      lastSuccessAgeMinutes: value.workerHealth.lastSuccessAgeMinutes,
      lastClaimedAt: value.workerHealth.lastClaimedAt,
      lastCompletedAt: value.workerHealth.lastCompletedAt,
      oldestClaimableAt: value.workerHealth.oldestClaimableAt,
      oldestClaimableAgeMinutes: value.workerHealth.oldestClaimableAgeMinutes,
      checkInGraceMinutes: value.workerHealth.checkInGraceMinutes,
      completionGraceMinutes: value.workerHealth.completionGraceMinutes,
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
  report.understanding = value.understanding == null
    ? null : parseLibraryUnderstandingSummary(value.understanding, report)
  return report
}
