/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectLibraryUnderstandingSummary } from '../services/libraryUnderstandingSummary.mjs';

const readiness = {
    asOf: '2026-09-24T12:00:00.000Z', libraryCount: 4, activeLibraryCount: 3,
    profile: { current: 1, queued: 1, processing: 0, retryWait: 0, waiting: 0,
        cooldown: 1, unverified: 0, paused: 1, noInventory: 0 },
    recovery: { plannerOverdue: 1, workerOverdue: 0, leaseRecoveryOverdue: 0 },
    workerHealth: { statusId: 'check_in_overdue' },
    sourceIdentity: { unresolvedItemCount: 2, completeCaptureLibraryCount: 1 },
};

test('separates observed progress from overdue recovery without claiming accuracy', () => {
    expect(projectLibraryUnderstandingSummary(readiness)).toEqual({
        version: 'library.understanding_summary.v1', asOf: readiness.asOf, libraryCount: 4,
        profile: { current: 1, updating: 1, coolingDown: 1, unverified: 0,
            paused: 1, noInventory: 0 },
        recovery: { overdueLibraryCount: 1, workerStalled: true },
        sourceIdentity: { unresolvedItemCount: 2, coveredActiveLibraryCount: 1,
            activeLibraryCount: 3 },
        classificationQuality: 'not_measured',
    });
});

test('does not call an idle worker stalled or classify ordinary queues as operator action', () => {
    const result = projectLibraryUnderstandingSummary({ ...readiness,
        recovery: { plannerOverdue: 0, workerOverdue: 0, leaseRecoveryOverdue: 0 },
        workerHealth: { statusId: 'check_in_overdue' },
    });
    expect(result.recovery).toEqual({ overdueLibraryCount: 0, workerStalled: false });
    expect(result.profile.updating).toBe(1);
    expect(projectLibraryUnderstandingSummary({ ...readiness,
        workerHealth: { statusId: 'not_observed' },
    }).recovery.workerStalled).toBe(true);
});
