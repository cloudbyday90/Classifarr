/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const OBSERVATION_HEALTH_LIMITS = Object.freeze({ libraryLimit: 12, rowLimit: 20000, observationByteLimit: 4096 });

/** One snapshot, no per-item queries, and no numeric casts of queue payload input. */
export async function readLibraryObservationHealthSnapshot(db) {
    const { libraryLimit, rowLimit, observationByteLimit } = OBSERVATION_HEALTH_LIMITS;
    const { rows } = await db.query(`
        WITH selected_libraries AS MATERIALIZED (
            SELECT id, name FROM libraries WHERE is_active = true ORDER BY id LIMIT $1
        ), bounded_ids AS MATERIALIZED (
            SELECT msi.id FROM media_server_items msi JOIN selected_libraries l ON l.id = msi.library_id
            ORDER BY msi.id LIMIT $2
        ), size AS (SELECT COUNT(*)::int AS row_count FROM bounded_ids),
        inventory AS MATERIALIZED (
            SELECT msi.id, msi.library_id, msi.media_type, msi.tmdb_id,
                msi.inventory_tmdb_attempted_at::text, msi.inventory_tmdb_fetched_at::text,
                COALESCE(msi.metadata ? 'inventory_tmdb', false) AS has_observation,
                public.library_profile_observed_metadata(msi.metadata) -> 'inventory_tmdb' AS observation
            FROM bounded_ids b JOIN media_server_items msi ON msi.id = b.id
            WHERE (SELECT row_count FROM size) <= $3
        ), active_tasks AS (
            SELECT i.id, BOOL_OR(tq.status = 'processing') AS has_processing_task,
                BOOL_OR(tq.status = 'pending') AS has_pending_task
            FROM inventory i JOIN task_queue tq ON tq.payload ->> 'itemId' = i.id::text
            WHERE tq.task_type = 'metadata_enrichment' AND tq.status IN ('pending', 'processing')
            GROUP BY i.id
        )
        SELECT statement_timestamp()::text AS observed_at,
            EXISTS (SELECT 1 FROM tmdb_config WHERE is_active = true AND NULLIF(BTRIM(api_key), '') IS NOT NULL) AS acquisition_configured,
            (SELECT COUNT(*)::int FROM libraries WHERE is_active = true) AS active_library_count,
            (SELECT row_count FROM size) AS row_count,
            COALESCE((SELECT jsonb_agg(l ORDER BY l.id) FROM selected_libraries l), '[]'::jsonb) AS libraries,
            COALESCE((SELECT jsonb_object_agg(p.id, p.fingerprint) FROM (
                SELECT l.id, encode(sha256(convert_to(COALESCE(jsonb_agg(
                    jsonb_build_array(i.id, i.media_type, i.tmdb_id) ORDER BY i.id)
                    FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb)::text, 'UTF8')), 'hex') AS fingerprint
                FROM selected_libraries l LEFT JOIN inventory i ON i.library_id = l.id
                WHERE (SELECT row_count FROM size) <= $3 GROUP BY l.id
            ) p), '{}'::jsonb) AS population_fingerprints,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'library_id', i.library_id, 'media_type', i.media_type, 'tmdb_id', i.tmdb_id,
                'inventory_tmdb_attempted_at', i.inventory_tmdb_attempted_at, 'inventory_tmdb_fetched_at', i.inventory_tmdb_fetched_at,
                'has_observation', i.has_observation,
                'observation_withheld', COALESCE(octet_length(i.observation::text) > $4, false),
                'metadata', jsonb_build_object('inventory_tmdb', CASE WHEN octet_length(i.observation::text) <= $4 THEN i.observation ELSE NULL END),
                'has_processing_task', COALESCE(t.has_processing_task, false), 'has_pending_task', COALESCE(t.has_pending_task, false)
            )) FROM inventory i LEFT JOIN active_tasks t ON t.id = i.id), '[]'::jsonb) AS items`,
    [libraryLimit, rowLimit + 1, rowLimit, observationByteLimit]);
    return rows[0];
}
