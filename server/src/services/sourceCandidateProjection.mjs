/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectReviewCandidate } from './mediaIdentityReviewContract.mjs';

export class SourceCandidateError extends Error {
  constructor(code) { super('Candidate lookup could not complete'); this.code = code; }
}
const fail = code => { throw new SourceCandidateError(code); };
const integer = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const fields = ['tmdb_id', 'imdb_id', 'tvdb_id'];

/** Only source-provided identifiers; no caller-selected destinations or search terms. */
export function candidateDeclarations(source) {
  if (!source || !['movie', 'tv'].includes(source.mediaType) || !/^[a-f0-9]{64}$/.test(source.snapshotDigest ?? '') ||
      !source.providerIds || Object.keys(source.providerIds).length !== fields.length) fail('source_invalid');
  const result = [];
  for (const provider of fields) {
    const ids = source.providerIds[provider];
    if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length || ids.some(id => provider === 'imdb_id'
      ? typeof id !== 'string' || !/^tt[0-9]{1,12}$/.test(id) : !integer(id))) fail('source_invalid');
    for (const id of ids) result.push({ provider, id });
  }
  if (result.length > 8) fail('lookup_limit');
  return result;
}

/** A season/episode/person ID is never promoted to a whole movie/series candidate. */
export function candidateMatches(data, mediaType) {
  const buckets = ['movie_results', 'tv_results', 'tv_season_results', 'tv_episode_results', 'person_results'];
  let count = 0;
  for (const bucket of buckets) {
    if (!Array.isArray(data?.[bucket]) || data[bucket].length > 20 ||
        data[bucket].some(item => !integer(item?.id)) ||
        new Set(data[bucket].map(item => item.id)).size !== data[bucket].length) fail('catalog_invalid');
    count += data[bucket].length;
  }
  if (count > 20) fail('lookup_limit');
  const values = data[mediaType === 'movie' ? 'movie_results' : 'tv_results'];
  if (values.some(item => item.media_type !== undefined && item.media_type !== mediaType)) fail('catalog_invalid');
  return { tmdbIds: values.map(item => item.id), otherScopeMatches: count - values.length };
}

export async function readSourceCandidates(source, provider, signal) {
  const declarations = candidateDeclarations(source), lookups = [], ids = new Set();
  for (const entry of declarations) {
    signal.throwIfAborted();
    let matches = { tmdbIds: [], otherScopeMatches: 0 }, status;
    if (entry.provider === 'tmdb_id') { matches.tmdbIds = [entry.id]; status = 'declared'; }
    else if (entry.provider === 'tvdb_id' && source.mediaType === 'movie') status = 'unsupported';
    else {
      let response;
      try { response = await provider.findIdentityByExternalId(entry.id, entry.provider, { signal }); }
      catch (error) {
        if (error?.response?.status !== 404 && error?.status !== 404) throw error;
        response = { movie_results: [], tv_results: [], tv_season_results: [], tv_episode_results: [], person_results: [] };
      }
      signal.throwIfAborted();
      matches = candidateMatches(response, source.mediaType);
      status = matches.tmdbIds.length ? 'matched' : matches.otherScopeMatches ? 'other_scope' : 'no_match';
    }
    for (const id of matches.tmdbIds) ids.add(id);
    if (ids.size > 8) fail('lookup_limit');
    lookups.push({ ...entry, ...matches, status });
  }
  const candidates = [];
  for (const tmdbId of [...ids].sort((a, b) => a - b)) {
    signal.throwIfAborted();
    let details, missing = false;
    try { details = await provider.getIdentityDetails(tmdbId, source.mediaType, { signal }); }
    catch (error) {
      if (error?.response?.status !== 404 && error?.status !== 404) throw error;
      missing = true;
    }
    signal.throwIfAborted();
    const projected = missing ? null : projectReviewCandidate(details, tmdbId, source.mediaType);
    candidates.push({ tmdbId, mediaType: source.mediaType, available: projected !== null,
      title: projected?.title ?? null, releaseDate: projected?.releaseDate ?? null,
      lookupIndexes: lookups.flatMap((entry, index) => entry.tmdbIds.includes(tmdbId) ? [index] : []) });
  }
  return { candidates, lookups };
}
