/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// The worker runs every minute. Allow for startup delay, batching and normal scheduler jitter.
export const LIBRARY_PROFILE_RECOVERY_GRACE_MS = 15 * 60 * 1000;
export const LIBRARY_PROFILE_RECOVERY_REASON_IDS = Object.freeze({
    PLANNER_OVERDUE: 'planner_overdue',
    WORKER_OVERDUE: 'worker_overdue',
    LEASE_RECOVERY_OVERDUE: 'lease_recovery_overdue',
});

const overdue = (dueAt, asOf) => dueAt != null &&
    Number.isFinite(Date.parse(dueAt)) &&
    Date.parse(dueAt) <= Date.parse(asOf) - LIBRARY_PROFILE_RECOVERY_GRACE_MS;

/** Diagnose a due, dirty active library without changing its durable retry state. */
export function classifyLibraryProfileRecovery(row, asOf) {
    if (!row.is_active || !row.dirty) return null;
    const state = row.processing_state;
    if (state === 'processing') {
        return overdue(row.lease_expires_at ?? row.job_updated_at, asOf)
            ? LIBRARY_PROFILE_RECOVERY_REASON_IDS.LEASE_RECOVERY_OVERDUE : null;
    }
    if (state === 'pending') {
        return overdue(row.available_at ?? row.job_updated_at, asOf)
            ? LIBRARY_PROFILE_RECOVERY_REASON_IDS.WORKER_OVERDUE : null;
    }
    if (state === 'failed') {
        return overdue(row.probe_at, asOf)
            ? LIBRARY_PROFILE_RECOVERY_REASON_IDS.PLANNER_OVERDUE : null;
    }
    const changedAt = Date.parse(row.changed_at);
    const jobUpdatedAt = Date.parse(row.job_updated_at);
    const latestChange = Number.isFinite(jobUpdatedAt) && jobUpdatedAt > changedAt
        ? row.job_updated_at : row.changed_at;
    return overdue(latestChange, asOf)
        ? LIBRARY_PROFILE_RECOVERY_REASON_IDS.PLANNER_OVERDUE : null;
}

/** Internal SQL fragment for the same all-library, single-snapshot aggregate. */
export function libraryProfileRecoveryReasonSql(alias, graceParameter) {
    if (alias !== 'library_state' || graceParameter !== 2) {
        throw new TypeError('Unsupported recovery assessment SQL context');
    }
    const deadline = "statement_timestamp() - ($2::bigint * INTERVAL '1 millisecond')";
    return `CASE
        WHEN NOT ${alias}.is_active OR NOT ${alias}.dirty THEN NULL
        WHEN ${alias}.processing_state='processing' THEN CASE
            WHEN COALESCE(${alias}.lease_expires_at, ${alias}.job_updated_at) <= ${deadline}
                THEN 'lease_recovery_overdue' ELSE NULL END
        WHEN ${alias}.processing_state='pending' THEN CASE
            WHEN COALESCE(${alias}.available_at, ${alias}.job_updated_at) <= ${deadline}
                THEN 'worker_overdue' ELSE NULL END
        WHEN ${alias}.processing_state='failed' THEN CASE
            WHEN ${alias}.probe_at <= ${deadline} THEN 'planner_overdue' ELSE NULL END
        WHEN GREATEST(${alias}.changed_at, ${alias}.job_updated_at) <= ${deadline}
            THEN 'planner_overdue'
        ELSE NULL END`;
}
