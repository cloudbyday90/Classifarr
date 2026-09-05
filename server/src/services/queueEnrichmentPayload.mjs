/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { canonicalMediaType, payloadMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { parsePayload } from '../utils/queueHelpers.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { readInventoryTmdbObservation } from './inventoryTmdbObservation.mjs';

export function captureQueueEnrichmentPayload(payload) {
  const mediaType = payloadMediaType(payload);
  if (!mediaType) return null;
  const captured = JSON.parse(JSON.stringify(payload));
  captured.media = { ...captured.media, media_type: mediaType };
  if (captured.media_type !== undefined) captured.media_type = mediaType;
  return captured;
}

/** Verify source identity before provider calls; never derive type from a library. */
export async function prepareQueueEnrichmentPayload(payload, query) {
  const captured = captureQueueEnrichmentPayload(payload);
  if (!captured) return null;
  delete captured.source_identity_snapshot;
  const ids = [captured.tmdbId, captured.tmdb_id].filter((value) => value !== null && value !== undefined);
  if (ids.some((id) => !positiveDatabaseInteger(id)) ||
      new Set(ids.map(positiveDatabaseInteger)).size > 1) return null;
  captured.tmdb_id = ids.length ? positiveDatabaseInteger(ids[0]) : null;
  delete captured.tmdbId;
  if (captured.itemId === null || captured.itemId === undefined) return captured;
  const itemId = positiveDatabaseInteger(captured.itemId);
  if (!itemId) return null;
  const result = await query(`SELECT msi.tmdb_id, msi.media_type, msi.library_id, msi.metadata, msi.tags,
    msi.media_server_id, msi.external_id, msi.title, msi.year, msi.imdb_id, msi.tvdb_id,
    msi.inventory_tmdb_attempted_at, msi.inventory_tmdb_fetched_at,
    l.name AS library_name FROM media_server_items msi
    LEFT JOIN libraries l ON msi.library_id = l.id WHERE msi.id = $1`, [itemId]);
  const row = result.rows[0];
  if (!row || canonicalMediaType(row.media_type) !== captured.media.media_type) return null;
  const libraryId = positiveDatabaseInteger(row.library_id);
  const storedTmdbId = row.tmdb_id == null ? null : positiveDatabaseInteger(row.tmdb_id);
  if (!libraryId || (row.tmdb_id != null && !storedTmdbId) ||
      (captured.source_library_id != null && positiveDatabaseInteger(captured.source_library_id) !== libraryId) ||
      (storedTmdbId && captured.tmdb_id && storedTmdbId !== captured.tmdb_id)) return null;
  const metadata = parsePayload(row.metadata);
  captured.itemId = itemId;
  captured.source_identity_snapshot = Object.fromEntries([
    'media_server_id', 'external_id', 'library_id', 'media_type', 'title', 'year', 'imdb_id', 'tvdb_id',
  ].map(field => [field, row[field] ?? null]));
  for (const field of ['title', 'year', 'imdb_id', 'tvdb_id']) captured[field] = row[field] ?? null;
  // A queued ID can outlive source replacement; only the current row owns it.
  captured.tmdb_id = storedTmdbId;
  captured.source_library_id = libraryId;
  captured.source_library_name = row.library_name || captured.source_library_name;
  captured.posterPath ||= metadata?.posterPath;
  captured.poster_path ||= metadata?.poster_path;
  captured.inventory_tmdb = metadata?.inventory_tmdb;
  captured.inventory_tmdb_attempted_at = row.inventory_tmdb_attempted_at;
  captured.inventory_tmdb_fetched_at = row.inventory_tmdb_fetched_at;
  // Older queued payloads may contain source tags as keywords or a fabricated English default.
  const observation = readInventoryTmdbObservation({ ...row, metadata });
  captured.keywords = observation?.keywords || [];
  captured.original_language = observation?.original_language ?? null;
  captured.tags = normalizeMetadataList(row.tags);
  return captured;
}
