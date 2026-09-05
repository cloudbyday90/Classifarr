/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createTmdbIdentityOrigin } from './mediaSourceIdentity.mjs';
import { ENRICHMENT_SOURCE_SQL, encodeEnrichmentSource } from './queueEnrichmentSourceGuard.mjs';

/** Compare source fields, allowing independent enrichment/rating updates during provider I/O. */
export async function persistResolvedIdentity(query, itemId, tmdbId, mediaType, source) {
  const snapshot = encodeEnrichmentSource(source, mediaType);
  if (!snapshot) return { rowCount: 0 };
  const origin = createTmdbIdentityOrigin(source, tmdbId, 'queue_resolution');
  return query(`UPDATE media_server_items SET tmdb_id = $1,
    metadata = (COALESCE(metadata, '{}'::jsonb) - 'tmdb_identity_origin') || $4::jsonb
    WHERE id = $2 AND media_type = $3 AND tmdb_id IS NULL
      AND ${ENRICHMENT_SOURCE_SQL} = $5::jsonb`, // sql-interpolation: fixed source projection; values are bound
  [tmdbId, itemId, mediaType, JSON.stringify(origin ? { tmdb_identity_origin: origin } : {}),
    snapshot]);
}
