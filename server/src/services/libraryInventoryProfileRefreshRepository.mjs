/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {
    POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_PROBE_DELAY_MS,
    POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_RETENTION_DAYS,
} from './policyNativeProfileRefreshCircuitVocabulary.mjs';

/** A locked dirty revision is only acknowledged by successful claim completion. */
export async function enqueueInventoryProfileRefreshes(client) {
    const result = await client.query(`WITH candidates AS MATERIALIZED (
        SELECT state.library_id, state.revision, previous.id AS previous_id
        FROM library_profile_inventory_state state
        JOIN libraries library ON library.id = state.library_id AND library.is_active = TRUE
        LEFT JOIN LATERAL (
            SELECT id, processing_state, updated_at FROM policy_profile_refresh_outbox
            WHERE library_id = state.library_id AND request_type = 'inventory_change'
            ORDER BY id DESC LIMIT 1
        ) previous ON TRUE
        WHERE state.revision > state.refreshed_revision
            AND NOT EXISTS (SELECT 1 FROM policy_profile_refresh_outbox active
                WHERE active.library_id = state.library_id AND active.processing_state IN ('pending', 'processing'))
            AND (previous.processing_state IS DISTINCT FROM 'failed'
                OR previous.updated_at <= NOW() - ($1::bigint * INTERVAL '1 millisecond'))
        ORDER BY state.changed_at, state.library_id
        LIMIT 25
    ), eligible AS (
        SELECT candidates.* FROM library_profile_inventory_state state
        JOIN candidates USING (library_id)
        ORDER BY state.library_id FOR UPDATE OF state SKIP LOCKED
    ) INSERT INTO policy_profile_refresh_outbox (
        source_id, source_event_id, library_id, refresh_reason_id, source_system, request_type, inventory_revision
    ) SELECT 'library_inventory_observation',
        'library-inventory:' || library_id || ':revision:' || revision || ':after:' || COALESCE(previous_id, 0),
        library_id, 'library_inventory_changed', 'library_inventory_profile_refresh', 'inventory_change', revision
    FROM eligible ON CONFLICT DO NOTHING RETURNING id`, [POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_PROBE_DELAY_MS]);
    return result.rows.length;
}

/** Preserve the newest recovery record and active claims; bound work per scheduler tick. */
export async function compactInventoryProfileRefreshes(client) {
    const result = await client.query(`WITH disposable AS (
        SELECT outbox.id FROM policy_profile_refresh_outbox outbox
        WHERE outbox.request_type = 'inventory_change' AND (
            NOT EXISTS (SELECT 1 FROM libraries WHERE id = outbox.library_id)
            OR (outbox.processing_state IN ('completed', 'failed')
                AND outbox.updated_at < NOW() - ($1::integer * INTERVAL '1 day')
                AND EXISTS (SELECT 1 FROM policy_profile_refresh_outbox newer
                    WHERE newer.library_id = outbox.library_id AND newer.request_type = 'inventory_change' AND newer.id > outbox.id))
        ) ORDER BY outbox.id LIMIT 1000 FOR UPDATE OF outbox SKIP LOCKED
    ) DELETE FROM policy_profile_refresh_outbox outbox USING disposable
    WHERE outbox.id = disposable.id RETURNING outbox.id`, [POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_RETENTION_DAYS]);
    return result.rows.length;
}
