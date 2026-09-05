/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { ENRICHMENT_SOURCE_SQL, encodeEnrichmentSource } from './queueEnrichmentSourceGuard.mjs';

export function buildQueueClassificationHistoryExistsQuery(identity) {
  const hasTmdbId = identity.tmdbId !== null;
  return {
    text: `SELECT 1 FROM classification_history
      WHERE ${hasTmdbId ? 'tmdb_id = $1::integer' : 'title = $1::text AND tmdb_id IS NULL'}
        AND library_id = $2::integer AND media_type = $3::text
        AND method = 'source_library' LIMIT 1`,
    values: [hasTmdbId ? identity.tmdbId : identity.title, identity.libraryId, identity.mediaType],
  };
}

export function buildQueueClassificationHistoryReason(tmdbId, sourceLibraryName) {
  return tmdbId
    ? `Already in library: ${sourceLibraryName}`
    : `Already in library: ${sourceLibraryName} (no TMDB match)`;
}

export function buildQueueClassificationHistoryInsertQuery(identity, payload, sourceLibraryName, graph) {
  const guarded = payload.itemId != null;
  const source = payload.source_identity_snapshot;
  const snapshot = guarded ? encodeEnrichmentSource(source, identity.mediaType, identity.libraryId) : null;
  const itemId = positiveDatabaseInteger(payload.itemId);
  if (guarded && (!itemId || !snapshot || source.title !== identity.title || source.year !== (payload.year ?? null))) return null;
  const metadata = { ...payload };
  delete metadata.source_identity_snapshot;
  const sourceSelection = guarded ? `WITH source_guard AS MATERIALIZED (
    SELECT id FROM media_server_items WHERE id = $16 AND tmdb_id IS NOT DISTINCT FROM $1::integer
      AND ${ENRICHMENT_SOURCE_SQL} = $17::jsonb FOR SHARE
  ) ` : ''; // sql-interpolation: fixed source projection; all values are bound
  const selection = guarded ? 'SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15 FROM source_guard'
    : 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)';
  return {
    text: `${sourceSelection}INSERT INTO classification_history (
      tmdb_id, media_type, title, year, library_id, status,
      confidence, method, reason, metadata,
      director_name, primary_studio_name, genre_names, cast_ids, cast_names
    ) ${selection}`, // sql-interpolation: fixed guarded/standalone clauses; values are bound
    values: [
      identity.tmdbId, identity.mediaType, identity.title, payload.year,
      identity.libraryId, 'completed', 100, 'source_library',
      buildQueueClassificationHistoryReason(identity.tmdbId, sourceLibraryName),
      JSON.stringify(metadata), graph.director_name, graph.primary_studio_name,
      graph.genre_names, graph.cast_ids, graph.cast_names,
      ...(guarded ? [itemId, snapshot] : []),
    ],
  };
}
