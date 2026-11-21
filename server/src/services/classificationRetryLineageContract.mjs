/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { parseRetryTargetId } from './classificationRetryTargetIds.mjs';

export const RETRY_LINEAGE_MAX_REFERENCES = 256;
export const RETRY_LINEAGE_REFUSED = 'task_retry_lineage_refused';
export const RETRY_LINEAGE_REFUSAL_CATEGORIES = Object.freeze({
  PROOF: 'proof_unavailable',
  SOURCE: 'source_relationship',
  ITEM: 'item_identity',
  REQUESTS: 'media_request_links',
  WEBHOOKS: 'webhook_links',
});

export const RETRY_LINEAGE_SOURCES = Object.freeze([
  'manual_retry', 'retry_queue', 'provider_recovery', 'historic_route_safety_refresh',
]);
const RETRY_SOURCES = new Set(RETRY_LINEAGE_SOURCES);
const REFUSAL_CATEGORIES = new Set(Object.values(RETRY_LINEAGE_REFUSAL_CATEGORIES));
const observedCategories = new WeakMap();

export const normalizeRetryLineageRefusalCategory = value => REFUSAL_CATEGORIES.has(value) ? value : null;
export const observedRetryLineageRefusalCategory = error => observedCategories.get(error) ?? null;

export class RetryLineageRefusal extends Error {
  constructor(category) {
    super(RETRY_LINEAGE_REFUSED);
    observedCategories.set(this, normalizeRetryLineageRefusalCategory(category));
  }
}

export class RetryLineageAlreadyCompleted extends Error {
  constructor() { super('retry_lineage_already_completed'); }
}

export const isRetryLineageSource = source => RETRY_SOURCES.has(source);
export const hasRetryLineage = payload => payload?.retry_lineage != null;

export function requireRetryLineage(condition, category) {
  if (!condition) throw new RetryLineageRefusal(category);
}

function optionalId(value, category) {
  if (value == null) return null;
  const id = parseRetryTargetId(value);
  requireRetryLineage(id !== null, category);
  return id;
}

export function retryLineageItem(mediaType, tmdbId, tvdbId) {
  const category = RETRY_LINEAGE_REFUSAL_CATEGORIES.ITEM;
  const tmdb = optionalId(tmdbId, category), tvdb = optionalId(tvdbId, category);
  requireRetryLineage((mediaType === 'movie' || mediaType === 'tv') && (tmdb !== null || (mediaType === 'tv' && tvdb !== null)), category);
  return { mediaType, tmdb, tvdb };
}

export function retryLineageHistoryItem(row) {
  const tvdb = row?.media_type === 'tv' ? row.metadata?.tvdb_id ?? row.metadata?.tvdbId : null;
  return retryLineageItem(row?.media_type, row?.tmdb_id, tvdb);
}

export function requireLineageItemMatch(expected, actual) {
  requireRetryLineage(expected && expected.mediaType === actual.mediaType &&
    expected.tmdb === actual.tmdb && expected.tvdb === actual.tvdb, RETRY_LINEAGE_REFUSAL_CATEGORIES.ITEM);
}

export function canonicalRetryLineageId(value, category) {
  const id = canonicalDatabaseBigintId(value);
  requireRetryLineage(id !== null, category);
  return id;
}

export function projectRetryLineageReferences(rows, category) {
  requireRetryLineage(Array.isArray(rows) && rows.length <= RETRY_LINEAGE_MAX_REFERENCES, category);
  let previousId = 0;
  return rows.map(row => {
    requireRetryLineage(row && typeof row === 'object' && !Array.isArray(row), category);
    const id = optionalId(row.id, category);
    const mediaType = row.media_type ?? null;
    requireRetryLineage(id !== null && id > previousId && (mediaType === null || ['movie', 'tv'].includes(mediaType)), category);
    previousId = id;
    return { id, media_type: mediaType, tmdb_id: optionalId(row.tmdb_id, category), tvdb_id: optionalId(row.tvdb_id, category) };
  });
}

export function requireCompatibleLineageReferences(item, rows) {
  for (const row of rows) {
    requireRetryLineage((row.media_type === null || row.media_type === item.mediaType) &&
      (row.tmdb_id === null || row.tmdb_id === item.tmdb) &&
      (row.tvdb_id === null || row.tvdb_id === item.tvdb));
  }
}
