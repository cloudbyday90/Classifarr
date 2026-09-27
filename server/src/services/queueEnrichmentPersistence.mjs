/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ENRICHMENT_SOURCE_SQL, encodeEnrichmentSource } from './queueEnrichmentSourceGuard.mjs';
import { INVENTORY_OBSERVATION_ACTIVITY_CTE } from './inventoryObservationActivitySql.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

export async function persistOmdbRating(query, itemId, rated, mediaType, source, tmdbId) {
  const snapshot = encodeEnrichmentSource(source, mediaType);
  if (!snapshot || tmdbId === undefined) return { rowCount: 0 };
  return query( // sql-interpolation: fixed source projection; all source and provider values are bound
    `UPDATE media_server_items AS msi
      SET original_rating = COALESCE(original_rating, content_rating), content_rating = $2
      WHERE msi.id = $1 AND msi.media_type = $3 AND msi.tmdb_id IS NOT DISTINCT FROM $4::integer
        AND ${ENRICHMENT_SOURCE_SQL} = $5::jsonb
        AND ${sourceConflictAuthorityExclusionForMediaServerItem('$6')}
      RETURNING original_rating`, [itemId, rated, mediaType, tmdbId, snapshot, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
}

export async function persistEnrichmentMetadata(query, payload, tmdbId, metadata, attempted, recovery = {}) {
  const type = payload.media.media_type;
  const snapshot = encodeEnrichmentSource(payload.source_identity_snapshot, type, payload.source_library_id);
  if (!snapshot || tmdbId === undefined) return { rowCount: 0 };
  if ((attempted && (!recovery.token || !recovery.outcome)) ||
      (!attempted && (recovery.token || metadata.inventory_tmdb))) return { rowCount: 0 };
  return query( // sql-interpolation: fixed source projection; all source and provider values are bound
    `WITH updated AS (UPDATE media_server_items AS msi
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
        inventory_tmdb_attempted_at = CASE WHEN $6 THEN NOW() ELSE inventory_tmdb_attempted_at END,
        inventory_tmdb_fetched_at = CASE WHEN $7 THEN NOW() ELSE inventory_tmdb_fetched_at END,
        inventory_tmdb_recovery = CASE WHEN $10::uuid IS NOT NULL THEN $11::jsonb ELSE inventory_tmdb_recovery END,
        inventory_tmdb_retry_after = CASE WHEN $10::uuid IS NOT NULL THEN $12::timestamptz ELSE inventory_tmdb_retry_after END,
        inventory_tmdb_lease_id = CASE WHEN $10::uuid IS NOT NULL THEN NULL ELSE inventory_tmdb_lease_id END,
        inventory_tmdb_lease_until = CASE WHEN $10::uuid IS NOT NULL THEN NULL ELSE inventory_tmdb_lease_until END
      WHERE msi.id = $2 AND msi.media_type = $3 AND msi.library_id = $4
        AND msi.tmdb_id IS NOT DISTINCT FROM $5::integer AND ${ENRICHMENT_SOURCE_SQL} = $8::jsonb
        AND ${sourceConflictAuthorityExclusionForMediaServerItem('$9')}
        AND ($10::uuid IS NULL OR (inventory_tmdb_lease_id = $10::uuid AND inventory_tmdb_lease_until > clock_timestamp()
          AND EXISTS (SELECT 1 FROM libraries l WHERE l.id = msi.library_id AND l.is_active = true)))
      RETURNING 1)
      ${INVENTORY_OBSERVATION_ACTIVITY_CTE}
      SELECT * FROM updated`,
    [JSON.stringify(metadata), payload.itemId, type, payload.source_library_id, tmdbId,
      attempted, Boolean(metadata.inventory_tmdb), snapshot, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS,
      recovery.token ?? null, recovery.outcome?.record ? JSON.stringify(recovery.outcome.record) : null,
      recovery.outcome?.retryAfter ?? null]);
}
