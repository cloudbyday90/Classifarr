/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { canonicalMediaType, payloadMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { omdbResultMatchesType } from './queueEnrichmentResults.mjs';

export function buildTmdbExternalIdRequest(externalId, source) {
  const id = source === 'tvdb_id' ? positiveDatabaseInteger(externalId)
    : source === 'imdb_id' && typeof externalId === 'string' && /^tt[0-9]{1,12}$/u.test(externalId) ? externalId : null;
  return id ? Object.freeze({ externalId: id, source }) : null;
}

/** Capture every applicable declaration before any provider wait. */
export function buildQueueExternalIdPlan(payload, enrichmentData) {
  const mediaType = payloadMediaType(payload);
  const invalid = (reason) => Object.freeze({ mediaType, reason, requests: Object.freeze([]) });
  if (!mediaType) return invalid('invalid_media_identity');
  const omdb = enrichmentData?.omdb?.data;
  const imdbIds = [payload?.imdb_id, ...(omdbResultMatchesType(omdb, mediaType) ? [omdb.imdbId, omdb.imdbID] : [])]
    .filter((value) => value != null);
  const tvdb = mediaType === 'tv' && payload?.tvdb_id != null
    ? buildTmdbExternalIdRequest(payload.tvdb_id, 'tvdb_id') : null;
  if ((mediaType === 'tv' && payload?.tvdb_id != null && !tvdb) ||
      imdbIds.some((id) => !buildTmdbExternalIdRequest(id, 'imdb_id'))) return invalid('invalid_external_id');
  if (new Set(imdbIds).size > 1) return invalid('conflicting_external_ids');
  const requests = [tvdb, imdbIds.length ? buildTmdbExternalIdRequest(imdbIds[0], 'imdb_id') : null].filter(Boolean);
  return Object.freeze({ mediaType, reason: null, requests: Object.freeze(requests) });
}

const review = (reason) => Object.freeze({ status: 'review_required', tmdbId: null, reason });

/** Validate the complete relevant bucket; never discard bad rows to manufacture uniqueness. */
export function decideTmdbExternalIdMatch(mediaType, response) {
  mediaType = canonicalMediaType(mediaType);
  if (!mediaType) return review('invalid_media_identity');
  const key = mediaType === 'movie' ? 'movie_results' : 'tv_results';
  if (!response || typeof response !== 'object' || Array.isArray(response) || !Object.hasOwn(response, key) ||
      !Array.isArray(response[key])) return review('invalid_response');
  const results = response[key];
  if (results.length > 20) return review('external_result_limit');
  const ids = Array.from(results, (row) => positiveDatabaseInteger(row?.id));
  if (ids.some((id) => !id) || results.some((row) => row.media_type !== undefined &&
      canonicalMediaType(row.media_type) !== mediaType)) return review('invalid_response');
  if (new Set(ids).size !== ids.length) return review('duplicate_external_results');
  if (ids.length > 1) return review('ambiguous_external_id');
  return Object.freeze(ids.length
    ? { status: 'resolved', tmdbId: ids[0], reason: 'external_id_match' }
    : { status: 'not_found', tmdbId: null, reason: 'external_id_not_found' });
}
