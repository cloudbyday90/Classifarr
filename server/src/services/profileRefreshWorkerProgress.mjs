/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const OUTCOME_IDS = new Set(['completed', 'partial_failure', 'failed']);

/** A best-effort operational signal, not an authority to claim or retry work. */
export async function recordProfileRefreshWorkerProgress(db, { outcomeId, claimedCount = 0, completedCount = 0 }) {
    if (!OUTCOME_IDS.has(outcomeId) ||
        !Number.isSafeInteger(claimedCount) || claimedCount < 0 ||
        !Number.isSafeInteger(completedCount) || completedCount < 0 || completedCount > claimedCount) {
        throw new TypeError('Invalid profile refresh worker progress');
    }
    await db.query(`INSERT INTO profile_refresh_worker_progress
        (singleton_id, last_tick_at, last_success_at, last_claimed_at, last_completed_at, last_outcome_id)
        VALUES (1, statement_timestamp(),
            CASE WHEN $1='completed' THEN statement_timestamp() ELSE NULL END,
            CASE WHEN $2::bigint > 0 THEN statement_timestamp() ELSE NULL END,
            CASE WHEN $3::bigint > 0 THEN statement_timestamp() ELSE NULL END, $1)
        ON CONFLICT (singleton_id) DO UPDATE SET
            last_tick_at = EXCLUDED.last_tick_at,
            last_success_at = COALESCE(EXCLUDED.last_success_at,
                profile_refresh_worker_progress.last_success_at),
            last_claimed_at = COALESCE(EXCLUDED.last_claimed_at,
                profile_refresh_worker_progress.last_claimed_at),
            last_completed_at = COALESCE(EXCLUDED.last_completed_at,
                profile_refresh_worker_progress.last_completed_at),
            last_outcome_id = EXCLUDED.last_outcome_id`,
    [outcomeId, claimedCount, completedCount]);
}
