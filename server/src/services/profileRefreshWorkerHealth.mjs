/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const PROFILE_REFRESH_WORKER_CHECK_IN_GRACE_MS = 5 * 60_000;
export const PROFILE_REFRESH_WORKER_COMPLETION_GRACE_MS = 15 * 60_000;

function timestamp(value) {
    if (value == null) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid profile refresh worker timestamp');
    return date.toISOString();
}

function count(value) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) throw new TypeError('Invalid profile refresh worker count');
    return number;
}

/** Fixed-vocabulary diagnosis; absence of a check-in is not proof of a stopped process. */
export function assessProfileRefreshWorkerHealth(row, { asOf, overdueCount }) {
    const now = Date.parse(asOf);
    if (!Number.isFinite(now)) throw new TypeError('Invalid profile refresh worker assessment time');
    const lastTickAt = timestamp(row.worker_last_tick_at);
    const lastSuccessAt = timestamp(row.worker_last_success_at);
    const lastSuccessAgeMinutes = lastSuccessAt == null ? null :
        Math.max(0, Math.floor((now - Date.parse(lastSuccessAt)) / 60_000));
    const lastClaimedAt = timestamp(row.worker_last_claimed_at);
    const lastCompletedAt = timestamp(row.worker_last_completed_at);
    const oldestClaimableAt = timestamp(row.oldest_claimable_at);
    const claimableCount = count(row.claimable_count);
    const oldestClaimableAgeMinutes = oldestClaimableAt == null ? null :
        Math.max(0, Math.floor((now - Date.parse(oldestClaimableAt)) / 60_000));
    const outcomeId = row.worker_last_outcome_id;
    if (outcomeId != null && !['completed', 'partial_failure', 'failed'].includes(outcomeId)) {
        throw new TypeError('Invalid profile refresh worker outcome');
    }
    if (oldestClaimableAt && claimableCount === 0) throw new TypeError('Inconsistent claimable worker state');

    let statusId = 'idle';
    if (!lastTickAt) statusId = 'not_observed';
    else if (now - Date.parse(lastTickAt) > PROFILE_REFRESH_WORKER_CHECK_IN_GRACE_MS) statusId = 'check_in_overdue';
    else if (outcomeId !== 'completed') statusId = 'cycle_failed';
    else if (claimableCount > 0 && (!lastCompletedAt ||
        now - Date.parse(lastCompletedAt) > PROFILE_REFRESH_WORKER_COMPLETION_GRACE_MS)) {
        statusId = 'no_recent_completion';
    } else if (claimableCount > 0) statusId = 'backlog_progressing';
    else if (overdueCount > 0) statusId = 'overdue_without_claimable_work';

    return { statusId, claimableCount, lastTickAt, lastSuccessAt, lastSuccessAgeMinutes,
        lastClaimedAt, lastCompletedAt,
        oldestClaimableAt, oldestClaimableAgeMinutes,
        checkInGraceMinutes: 5, completionGraceMinutes: 15 };
}
