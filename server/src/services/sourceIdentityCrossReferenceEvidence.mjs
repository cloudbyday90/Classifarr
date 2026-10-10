/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildTmdbExternalIdRequest, decideTmdbExternalIdMatch } from './tmdbExternalIdMatch.mjs';
import { countCrossReferenceLookups, countCrossReferenceProviders } from './sourceIdentityCrossReferenceCounts.mjs';

const FIELDS = ['tmdb_id', 'imdb_id', 'tvdb_id'];
const BUCKETS = ['movie_results', 'tv_results', 'tv_season_results', 'tv_episode_results', 'person_results'];
const positiveId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

/** Copy transient evidence before asynchronous reads; never return it to the operator. */
export function copyCrossReferenceEvidence(evidence) {
  if (!['movie', 'tv'].includes(evidence?.mediaType) ||
      typeof evidence.snapshotDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(evidence.snapshotDigest)) return null;
  const providerIds = copyCrossReferenceProviderIds(evidence.providerIds);
  return providerIds ? Object.freeze({ mediaType: evidence.mediaType, snapshotDigest: evidence.snapshotDigest, providerIds }) : null;
}

export function copyCrossReferenceProviderIds(input) {
  if (!input || Object.keys(input).length !== FIELDS.length) return null;
  const providerIds = {};
  for (const field of FIELDS) {
    const values = input[field];
    if (!Array.isArray(values) || values.length > 20 || new Set(values).size !== values.length ||
        Array.from(values).some(value => field !== 'imdb_id' ? !positiveId(value)
          : !buildTmdbExternalIdRequest(value, field))) return null;
    providerIds[field] = Object.freeze([...values].sort());
  }
  return Object.freeze(providerIds);
}

export function crossReferenceRequests(evidence) {
  return ['imdb_id', ...(evidence.mediaType === 'tv' ? ['tvdb_id'] : [])]
    .flatMap(field => evidence.providerIds[field].map(id => buildTmdbExternalIdRequest(id, field)));
}

/** Other object types are context only, never evidence of the requested identity. */
export function inspectCrossReferenceResponse(mediaType, response) {
  const decision = decideTmdbExternalIdMatch(mediaType, response);
  const relevant = mediaType === 'tv' ? 'tv_results' : 'movie_results';
  const otherBuckets = BUCKETS.filter(key => key !== relevant && Object.hasOwn(response ?? {}, key));
  if (otherBuckets.some(key => !Array.isArray(response[key]) || response[key].length > 20 ||
      Array.from(response[key]).some(row => !positiveId(row?.id)))) {
    return { status: 'review_required', tmdbId: null, otherMediaResults: false };
  }
  return { status: decision.status, tmdbId: decision.tmdbId,
    otherMediaResults: otherBuckets.some(key => response[key].length > 0) };
}

export function summarizeCrossReferences(evidence, findings) {
  const ids = new Set(findings.filter(item => item.status === 'resolved').map(item => item.tmdbId));
  let outcome;
  if (findings.some(item => item.status === 'review_required')) outcome = 'provider_review_required';
  else if (ids.size > 1) outcome = 'conflicting_matches';
  else if (ids.size === 0) outcome = 'no_typed_matches';
  else if (!evidence.providerIds.tmdb_id.includes([...ids][0])) outcome = 'matches_outside_source_candidates';
  else if (findings.some(item => item.status === 'not_found')) outcome = 'agreement_with_missing_mappings';
  else outcome = 'all_agree_current_candidate';
  return { outcome, ...countCrossReferenceLookups(findings), byProvider: countCrossReferenceProviders(findings) };
}
