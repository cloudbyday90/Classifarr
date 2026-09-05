/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Operational prefilter only. Full observation validity is checked by the shared JS reader. */
export const INVENTORY_TMDB_REFILL_SQL = `
    l.is_active = true AND msi.tmdb_id > 0
    AND EXISTS (SELECT 1 FROM tmdb_config WHERE is_active = true AND NULLIF(BTRIM(api_key), '') IS NOT NULL)
    AND (msi.inventory_tmdb_attempted_at IS NULL OR msi.inventory_tmdb_attempted_at <= NOW() - make_interval(hours => $1))`;
