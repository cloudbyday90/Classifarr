/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { OBSERVATION_HEALTH_LIMITS } from './libraryObservationHealthQuery.mjs';
import { OBSERVATION_INVENTORY_CTES, OBSERVATION_SNAPSHOT_FIELDS } from './libraryObservationSnapshotSql.mjs';

/** One consistent snapshot; one indexed library visit; a fixed ceiling prevents append starvation. */
export async function readLibraryObservationSamplingSnapshot(db) {
    const { rowLimit, observationByteLimit } = OBSERVATION_HEALTH_LIMITS;
    const { rows } = await db.query(`WITH clock AS (
        SELECT statement_timestamp() AS now,
            date_bin('5 minutes', statement_timestamp(), '2000-01-01T00:00:00Z'::timestamptz) AS slot_start
    ), cursor AS MATERIALIZED (
        SELECT s.*, clock.now, clock.slot_start, s.last_sample_at IS NULL OR s.last_sample_at < clock.slot_start AS due
        FROM library_observation_sampling_state s CROSS JOIN clock WHERE singleton = true
    ), remaining AS (
        SELECT l.id FROM libraries l, cursor c WHERE c.due AND l.is_active = true
            AND l.id > c.last_library_id AND l.id <= c.ceiling_library_id ORDER BY l.id LIMIT 1
    ), selection AS MATERIALIZED (
        SELECT c.*, COALESCE((SELECT id FROM remaining),
            (SELECT id FROM libraries WHERE is_active = true AND c.due ORDER BY id LIMIT 1)) AS next_id,
            CASE WHEN EXISTS (SELECT 1 FROM remaining) THEN c.ceiling_library_id
                ELSE COALESCE((SELECT id FROM libraries WHERE is_active = true ORDER BY id DESC LIMIT 1), 0) END AS next_ceiling,
            CASE WHEN c.last_sample_at >= c.slot_start - INTERVAL '5 minutes' THEN c.continuity_since
                ELSE c.now END AS next_continuity
        FROM cursor c
    ), selected_libraries AS MATERIALIZED (
        SELECT l.id, l.name FROM libraries l JOIN selection s ON s.next_id = l.id
        WHERE s.due AND l.is_active = true ORDER BY l.id LIMIT $1
    ), bounded_ids AS MATERIALIZED (
        SELECT b.id FROM selected_libraries l CROSS JOIN LATERAL (
            SELECT id FROM media_server_items WHERE library_id = l.id ORDER BY id LIMIT $2
        ) b
    ), ${OBSERVATION_INVENTORY_CTES}
    SELECT ${OBSERVATION_SNAPSHOT_FIELDS}, s.due, s.last_sample_at::text AS expected_last_sample_at,
        s.next_ceiling, s.next_continuity::text AS continuity_since
    FROM selection s`, [1, rowLimit + 1, rowLimit, observationByteLimit]);
    if (!rows[0]) throw new Error('Observation sampling state unavailable');
    return rows[0];
}
