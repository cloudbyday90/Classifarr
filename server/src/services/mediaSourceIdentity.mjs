/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

export function normalizeImdbId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^tt[0-9]{1,12}$/.test(normalized) ? normalized : null;
}

function missing(value) {
  return value == null || value === '';
}

export function normalizeSourceProviderIds(source) {
  const result = {};
  for (const field of ['tmdb_id', 'imdb_id', 'tvdb_id']) {
    const value = source[field];
    result[field] = field === 'imdb_id' ? normalizeImdbId(value) : positiveDatabaseInteger(value);
    if (!missing(value) && !result[field]) return null;
  }
  return source.provider_identity_invalid ? null : result;
}

function sourceAnchor(source) {
  if (!source || typeof source !== 'object') return null;
  const ids = normalizeSourceProviderIds(source);
  const mediaServerId = positiveDatabaseInteger(source.media_server_id);
  const mediaType = canonicalMediaType(source.media_type);
  const externalId = source.external_id;
  const title = typeof source.title === 'string'
    ? source.title.normalize('NFKC').replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ').trim().toLowerCase() : '';
  const year = missing(source.year) ? null : positiveDatabaseInteger(source.year);
  if (!ids || !mediaServerId || !mediaType || typeof externalId !== 'string' ||
      !externalId.trim() || externalId.length > 500 || !title || title.length > 500 ||
      (!missing(source.year) && (!year || year > 9999))) return null;
  return { media_server_id: mediaServerId, external_id: externalId, media_type: mediaType,
    title, year, imdb_id: ids.imdb_id, tvdb_id: ids.tvdb_id };
}

function continuous(left, right) {
  if (!left || !right || ['media_server_id', 'external_id', 'media_type', 'title']
    .some(field => left[field] !== right[field])) return false;
  const evidence = ['year', 'imdb_id', 'tvdb_id'];
  if (evidence.some(field => left[field] != null && right[field] != null && left[field] !== right[field])) return false;
  return evidence.some(field => left[field] != null && left[field] === right[field]);
}

export function createTmdbIdentityOrigin(source, tmdbId, method) {
  const anchor = sourceAnchor(source);
  const id = positiveDatabaseInteger(tmdbId);
  if (!anchor || !id || !['queue_resolution', 'operator'].includes(method)) return null;
  return { version: 1, method, tmdb_id: id, media_type: anchor.media_type, source_anchor: anchor };
}

/** Source responses cannot introduce server-owned enrichment or resolution evidence. */
export function sourceMetadata(metadata) {
  const copy = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {};
  delete copy.tmdb_identity_origin;
  delete copy.tmdb_resolution;
  delete copy.inventory_tmdb;
  return copy;
}

/** Keep old metadata only when it still describes the same typed source item. */
export function decideSyncedIdentity(current, incoming) {
  const before = sourceAnchor(current);
  const after = sourceAnchor(incoming);
  const oldId = positiveDatabaseInteger(current?.tmdb_id);
  let tmdbId = positiveDatabaseInteger(incoming.tmdb_id);
  const metadata = current?.metadata && typeof current.metadata === 'object' ? current.metadata : {};
  const origin = metadata.tmdb_identity_origin;
  const proof = sourceAnchor(origin?.source_anchor);
  const validOrigin = origin?.version === 1 && ['queue_resolution', 'operator'].includes(origin.method) &&
    origin.tmdb_id === oldId && oldId != null && origin.media_type === before?.media_type &&
    continuous(proof, before) && continuous(proof, after) && continuous(before, after);
  if (!tmdbId && validOrigin) tmdbId = oldId;
  const preserve = continuous(before, after) && oldId === tmdbId;
  const merged = { ...(preserve ? metadata : {}), ...sourceMetadata(incoming.metadata) };
  delete merged.tmdb_identity_origin;
  if (validOrigin && tmdbId === oldId) {
    const anchor = { ...proof };
    for (const field of ['year', 'imdb_id', 'tvdb_id']) anchor[field] ??= before[field] ?? after[field];
    merged.tmdb_identity_origin = { ...origin, source_anchor: anchor };
  }
  return { tmdbId, metadata: merged, preserveRating: preserve };
}
