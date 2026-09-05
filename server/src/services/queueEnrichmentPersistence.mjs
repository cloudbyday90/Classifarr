/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ENRICHMENT_SOURCE_SQL, encodeEnrichmentSource } from './queueEnrichmentSourceGuard.mjs';

export async function persistOmdbRating(query, itemId, rated, mediaType, source, tmdbId) {
  const snapshot = encodeEnrichmentSource(source, mediaType);
  if (!snapshot || tmdbId === undefined) return { rowCount: 0 };
  return query( // sql-interpolation: fixed source projection; all source and provider values are bound
    `UPDATE media_server_items
      SET original_rating = COALESCE(original_rating, content_rating), content_rating = $2
      WHERE id = $1 AND media_type = $3 AND tmdb_id IS NOT DISTINCT FROM $4::integer
        AND ${ENRICHMENT_SOURCE_SQL} = $5::jsonb
      RETURNING original_rating`, [itemId, rated, mediaType, tmdbId, snapshot]);
}

export async function persistEnrichmentMetadata(query, payload, tmdbId, metadata, attempted) {
  const type = payload.media.media_type;
  const snapshot = encodeEnrichmentSource(payload.source_identity_snapshot, type, payload.source_library_id);
  if (!snapshot || tmdbId === undefined) return { rowCount: 0 };
  return query( // sql-interpolation: fixed source projection; all source and provider values are bound
    `UPDATE media_server_items
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
        inventory_tmdb_attempted_at = CASE WHEN $6 THEN NOW() ELSE inventory_tmdb_attempted_at END,
        inventory_tmdb_fetched_at = CASE WHEN $7 THEN NOW() ELSE inventory_tmdb_fetched_at END
      WHERE id = $2 AND media_type = $3 AND library_id = $4
        AND tmdb_id IS NOT DISTINCT FROM $5::integer AND ${ENRICHMENT_SOURCE_SQL} = $8::jsonb`,
    [JSON.stringify(metadata), payload.itemId, type, payload.source_library_id, tmdbId,
      attempted, Boolean(metadata.inventory_tmdb), snapshot]);
}
