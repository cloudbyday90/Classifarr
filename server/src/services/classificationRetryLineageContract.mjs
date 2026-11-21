/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { parseRetryTargetId } from './classificationRetryTargetIds.mjs';

export const RETRY_LINEAGE_MAX_REFERENCES = 256;
export const RETRY_LINEAGE_REFUSED = 'task_retry_lineage_refused';

const RETRY_SOURCES = new Set(['manual_retry', 'retry_queue', 'provider_recovery', 'historic_route_safety_refresh']);

export class RetryLineageRefusal extends Error {
  constructor() { super(RETRY_LINEAGE_REFUSED); }
}

export class RetryLineageAlreadyCompleted extends Error {
  constructor() { super('retry_lineage_already_completed'); }
}

export const isRetryLineageSource = source => RETRY_SOURCES.has(source);
export const hasRetryLineage = payload => payload?.retry_lineage != null;

export function requireRetryLineage(condition) {
  if (!condition) throw new RetryLineageRefusal();
}

function optionalId(value) {
  if (value == null) return null;
  const id = parseRetryTargetId(value);
  requireRetryLineage(id !== null);
  return id;
}

export function retryLineageItem(mediaType, tmdbId, tvdbId) {
  const tmdb = optionalId(tmdbId), tvdb = optionalId(tvdbId);
  requireRetryLineage((mediaType === 'movie' || mediaType === 'tv') && (tmdb !== null || (mediaType === 'tv' && tvdb !== null)));
  return { mediaType, tmdb, tvdb };
}

export function retryLineageHistoryItem(row) {
  const tvdb = row?.media_type === 'tv' ? row.metadata?.tvdb_id ?? row.metadata?.tvdbId : null;
  return retryLineageItem(row?.media_type, row?.tmdb_id, tvdb);
}

export function requireLineageItemMatch(expected, actual) {
  requireRetryLineage(expected && expected.mediaType === actual.mediaType &&
    expected.tmdb === actual.tmdb && expected.tvdb === actual.tvdb);
}

export function canonicalRetryLineageId(value) {
  const id = canonicalDatabaseBigintId(value);
  requireRetryLineage(id !== null);
  return id;
}

export function projectRetryLineageReferences(rows) {
  requireRetryLineage(Array.isArray(rows) && rows.length <= RETRY_LINEAGE_MAX_REFERENCES);
  let previousId = 0;
  return rows.map(row => {
    requireRetryLineage(row && typeof row === 'object' && !Array.isArray(row));
    const id = optionalId(row.id);
    const mediaType = row.media_type ?? null;
    requireRetryLineage(id !== null && id > previousId && (mediaType === null || ['movie', 'tv'].includes(mediaType)));
    previousId = id;
    return { id, media_type: mediaType, tmdb_id: optionalId(row.tmdb_id), tvdb_id: optionalId(row.tvdb_id) };
  });
}

export function requireCompatibleLineageReferences(item, rows) {
  for (const row of rows) {
    requireRetryLineage((row.media_type === null || row.media_type === item.mediaType) &&
      (row.tmdb_id === null || row.tmdb_id === item.tmdb) &&
      (row.tvdb_id === null || row.tvdb_id === item.tvdb));
  }
}
