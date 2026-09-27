/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceConflictAuthorityPredicateForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

export const INVENTORY_RECOVERY_PROGRESS_SQL = `WITH recent AS MATERIALIZED (
    SELECT msi.id,msi.library_id,msi.media_server_id,msi.external_id,msi.tmdb_id,msi.media_type,
      msi.inventory_tmdb_recovery,msi.inventory_tmdb_recovery_progress,
      msi.inventory_tmdb_retry_after,msi.inventory_tmdb_lease_until,msi.inventory_tmdb_attempted_at
    FROM media_server_items msi
    JOIN libraries l ON l.id=msi.library_id AND l.is_active AND l.media_type=msi.media_type
      AND l.media_server_id IS NOT DISTINCT FROM msi.media_server_id
    LEFT JOIN media_server ms ON ms.id=msi.media_server_id
    WHERE msi.media_type IN ('movie','tv') AND (msi.media_server_id IS NULL OR ms.is_active)
      AND msi.inventory_tmdb_recovery_progress IS NOT NULL
      AND msi.inventory_tmdb_recovery_progress->>'released_at'>=to_char((statement_timestamp()-interval '30 days')
        AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ORDER BY msi.inventory_tmdb_recovery_progress->>'released_at' DESC,msi.id DESC LIMIT 1001
), projected AS (
    SELECT msi.tmdb_id,msi.media_type,msi.inventory_tmdb_recovery AS recovery,
      msi.inventory_tmdb_recovery_progress AS progress,
      msi.inventory_tmdb_retry_after AS retry_after,msi.inventory_tmdb_lease_until AS lease_until,
      msi.inventory_tmdb_attempted_at AS attempted_at,
      ${sourceConflictAuthorityPredicateForMediaServerItem('$1')} AS source_blocked,
      EXISTS (SELECT 1 FROM task_queue tq WHERE tq.task_type='metadata_enrichment'
        AND tq.status IN ('pending','processing') AND tq.payload->>'itemId'=msi.id::text
        AND tq.payload->>'inventory_recovery_case_id'=msi.inventory_tmdb_recovery->>'case_id'
        AND tq.payload->>'inventory_recovery_generation'=msi.inventory_tmdb_recovery_progress->>'generation') AS queued
    FROM recent msi ORDER BY msi.inventory_tmdb_recovery_progress->>'released_at' DESC,msi.id DESC
)
SELECT statement_timestamp() AS as_of, COALESCE((SELECT jsonb_agg(projected) FROM projected),'[]'::jsonb) AS items`;
