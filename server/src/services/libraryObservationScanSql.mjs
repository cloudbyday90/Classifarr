/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Fixed SQL only. Callers define selected_libraries and selection from the fair cursor.
// A composite range preserves library-index ordering; item IDs are PostgreSQL integers.
export const OBSERVATION_SCAN_CTES = `scan_inputs AS MATERIALIZED (
    SELECT l.id AS library_id, COALESCE(r.revision,0)::text AS inventory_revision,
        COALESCE(r.observation_clock_revision,0)::text AS clock_revision,
        to_jsonb(p) AS previous,
        CASE WHEN p.library_id IS NULL THEN NULL
            WHEN p.inventory_revision <> COALESCE(r.revision,0) THEN 'inventory_changed'
            WHEN p.clock_revision <> COALESCE(r.observation_clock_revision,0) THEN 'observation_clocks_changed'
            WHEN p.continuity_since <> s.next_continuity THEN 'sampling_gap'
            WHEN p.acquisition_configured <> EXISTS(SELECT 1 FROM tmdb_config
                WHERE is_active=true AND NULLIF(BTRIM(api_key),'') IS NOT NULL) THEN 'configuration_changed'
            WHEN p.scan_started_at < s.now - INTERVAL '7 days' THEN 'expired'
            WHEN p.scan_started_at > s.now THEN 'clock_anomaly' END AS restart_reason
    FROM selected_libraries l CROSS JOIN selection s
    LEFT JOIN library_profile_inventory_state r ON r.library_id=l.id
    LEFT JOIN library_observation_scan_progress p ON p.library_id=l.id
), scan_context AS MATERIALIZED (
    SELECT library_id, inventory_revision, clock_revision, restart_reason,
        CASE WHEN restart_reason IS NULL THEN previous END AS previous,
        CASE WHEN restart_reason IS NULL THEN COALESCE((previous->>'after_id')::integer,0) ELSE 0 END AS after_id,
        CASE WHEN restart_reason IS NULL THEN COALESCE(previous->>'scan_started_at',s.now::text)
            ELSE s.now::text END AS scan_started_at
    FROM scan_inputs CROSS JOIN selection s
), lookahead_ids AS MATERIALIZED (
    SELECT b.id FROM scan_context c CROSS JOIN LATERAL (
        SELECT id FROM media_server_items
        WHERE (library_id,id) > (c.library_id,c.after_id) AND (library_id,id) <= (c.library_id,2147483647)
        ORDER BY library_id,id LIMIT $2
    ) b
), bounded_ids AS MATERIALIZED (SELECT id FROM lookahead_ids ORDER BY id LIMIT $3)`;
