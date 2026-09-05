/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { canonicalMediaType, payloadMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { parsePayload } from '../utils/queueHelpers.mjs';

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
  const ids = [captured.tmdbId, captured.tmdb_id].filter((value) => value !== null && value !== undefined);
  if (ids.some((id) => !positiveDatabaseInteger(id)) ||
      new Set(ids.map(positiveDatabaseInteger)).size > 1) return null;
  captured.tmdb_id = ids.length ? positiveDatabaseInteger(ids[0]) : null;
  delete captured.tmdbId;
  if (captured.itemId === null || captured.itemId === undefined) return captured;
  const itemId = positiveDatabaseInteger(captured.itemId);
  if (!itemId) return null;
  const result = await query(`SELECT msi.tmdb_id, msi.media_type, msi.library_id, msi.metadata,
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
  captured.tmdb_id = storedTmdbId ?? captured.tmdb_id;
  captured.source_library_id = libraryId;
  captured.source_library_name = row.library_name || captured.source_library_name;
  captured.posterPath ||= metadata?.posterPath;
  captured.poster_path ||= metadata?.poster_path;
  return captured;
}
