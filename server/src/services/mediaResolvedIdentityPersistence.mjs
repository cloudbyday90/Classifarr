/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createTmdbIdentityOrigin } from './mediaSourceIdentity.mjs';

/** Compare source fields, allowing independent enrichment/rating updates during provider I/O. */
export async function persistResolvedIdentity(query, itemId, tmdbId, mediaType, source) {
  const origin = createTmdbIdentityOrigin(source, tmdbId, 'queue_resolution');
  return query(`UPDATE media_server_items SET tmdb_id = $1,
    metadata = (COALESCE(metadata, '{}'::jsonb) - 'tmdb_identity_origin') || $4::jsonb
    WHERE id = $2 AND media_type = $3 AND tmdb_id IS NULL
      AND media_server_id IS NOT DISTINCT FROM $5::integer
      AND external_id IS NOT DISTINCT FROM $6::text
      AND library_id IS NOT DISTINCT FROM $7::integer
      AND title IS NOT DISTINCT FROM $8::text AND year IS NOT DISTINCT FROM $9::integer
      AND imdb_id IS NOT DISTINCT FROM $10::text AND tvdb_id IS NOT DISTINCT FROM $11::integer`,
  [tmdbId, itemId, mediaType, JSON.stringify(origin ? { tmdb_identity_origin: origin } : {}),
    source.media_server_id ?? null, source.external_id ?? null, source.library_id ?? null,
    source.title ?? null, source.year ?? null, source.imdb_id ?? null, source.tvdb_id ?? null]);
}
