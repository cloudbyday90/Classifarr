/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const LIBRARY_UNDERSTANDING_SUMMARY_VERSION = 'library.understanding_summary.v1';

const STALLED_WORKER_STATUSES = new Set([
    'not_observed', 'check_in_overdue', 'cycle_failed', 'no_recent_completion',
    'overdue_without_claimable_work',
]);

/** Project observed profile and recovery facts; never infer classification accuracy. */
export function projectLibraryUnderstandingSummary(readiness) {
    const { profile, recovery, sourceIdentity, workerHealth } = readiness;
    const overdueLibraryCount = recovery.plannerOverdue + recovery.workerOverdue +
        recovery.leaseRecoveryOverdue;
    return {
        version: LIBRARY_UNDERSTANDING_SUMMARY_VERSION,
        asOf: readiness.asOf,
        libraryCount: readiness.libraryCount,
        profile: {
            current: profile.current,
            updating: profile.queued + profile.processing + profile.retryWait + profile.waiting,
            coolingDown: profile.cooldown,
            unverified: profile.unverified,
            paused: profile.paused,
            noInventory: profile.noInventory,
        },
        recovery: {
            overdueLibraryCount,
            workerStalled: overdueLibraryCount > 0 && STALLED_WORKER_STATUSES.has(workerHealth.statusId),
        },
        sourceIdentity: {
            unresolvedItemCount: sourceIdentity.unresolvedItemCount,
            coveredActiveLibraryCount: sourceIdentity.completeCaptureLibraryCount,
            activeLibraryCount: readiness.activeLibraryCount,
        },
        classificationQuality: 'not_measured',
    };
}
