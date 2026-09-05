/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Fixed identifiers only; durations are bound parameters supplied by the caller. */
export const INVENTORY_TMDB_REFILL_SQL = `
    l.is_active = true AND msi.tmdb_id > 0
    AND EXISTS (SELECT 1 FROM tmdb_config WHERE is_active = true AND NULLIF(BTRIM(api_key), '') IS NOT NULL)
    AND (msi.inventory_tmdb_attempted_at IS NULL OR msi.inventory_tmdb_attempted_at <= NOW() - make_interval(hours => $2))
    AND (msi.metadata #> '{inventory_tmdb,version}' IS DISTINCT FROM '1'::jsonb
        OR msi.metadata #>> '{inventory_tmdb,tmdb_id}' IS DISTINCT FROM msi.tmdb_id::text
        OR msi.metadata #>> '{inventory_tmdb,media_type}' IS DISTINCT FROM msi.media_type
        OR msi.inventory_tmdb_fetched_at IS NULL
        OR msi.inventory_tmdb_fetched_at <= NOW() - make_interval(days => $1))`;
