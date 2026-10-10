/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { copyCrossReferenceProviderIds } from './sourceIdentityCrossReferenceEvidence.mjs';

const BUCKETS = ['movie_results', 'tv_results', 'tv_season_results', 'tv_episode_results', 'person_results'];
const positiveId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const index = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;
export class EpisodeExternalIdEvidenceError extends Error {
  constructor() { super('episode_references_invalid'); }
}
const reject = () => { throw new EpisodeExternalIdEvidenceError(); };

/** Copy before awaits; never infer identity from descriptive metadata or numbering. */
export function episodeGapRequests(episodes, catalog) {
  const copied = episodes.map(item => {
    const providerIds = copyCrossReferenceProviderIds(item.providerIds);
    if (!providerIds || !index(item.season) || !index(item.episode)) reject();
    return { season: item.season, episode: item.episode, providerIds };
  });
  const uses = new Map();
  for (const item of copied) for (const field of ['tmdb_id', 'imdb_id', 'tvdb_id']) {
    for (const id of item.providerIds[field]) {
      const key = `${field}:${id}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  return copied.filter(item => !item.providerIds.tmdb_id.length ||
    (item.providerIds.tmdb_id.length === 1 && !catalog.has(item.providerIds.tmdb_id[0])))
    .map(item => {
      const requests = ['imdb_id', 'tvdb_id'].flatMap(field => item.providerIds[field].map(id => ({ field, id })));
      let outcome = null;
      if (!requests.length) outcome = 'no_external_ids';
      else if (['imdb_id', 'tvdb_id'].some(field => item.providerIds[field].length > 1)) outcome = 'external_ids_ambiguous';
      else if (requests.some(({ field, id }) => uses.get(`${field}:${id}`) > 1) ||
          item.providerIds.tmdb_id.some(id => uses.get(`tmdb_id:${id}`) > 1)) outcome = 'source_id_reused';
      return { item, requests: outcome ? [] : requests, outcome };
    });
}

/** Find is multi-type: a show/movie match is never a TV episode identity. */
export function inspectEpisodeExternalIdResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response) ||
      !Object.hasOwn(response, 'tv_episode_results')) reject();
  for (const key of BUCKETS) {
    if (!Object.hasOwn(response, key)) continue;
    if (!Array.isArray(response[key]) || response[key].length > 20 ||
        Array.from(response[key]).some(row => !positiveId(row?.id))) reject();
  }
  const matches = response.tv_episode_results;
  if (matches.some(row => !positiveId(row.show_id) || !index(row.season_number) || !index(row.episode_number))) reject();
  if (matches.length > 1) return { status: 'ambiguous' };
  if (!matches.length) return { status: BUCKETS.some(key => key !== 'tv_episode_results' && response[key]?.length)
    ? 'other_media_only' : 'not_found' };
  const row = matches[0];
  return { status: 'matched', id: row.id, seriesId: row.show_id, season: row.season_number, episode: row.episode_number };
}

export function compareEpisodeReferences(item, findings, catalog, candidates) {
  if (findings.some(f => f.status === 'ambiguous')) return 'ambiguous_matches';
  const matches = findings.filter(f => f.status === 'matched');
  const tuples = new Set(matches.map(f => JSON.stringify([f.id, f.seriesId, f.season, f.episode])));
  if (tuples.size > 1) return 'conflicting_matches';
  if (!matches.length) return findings.some(f => f.status === 'other_media_only') ? 'other_media_only' : 'no_typed_matches';
  const match = matches[0];
  if (item.providerIds.tmdb_id.length && item.providerIds.tmdb_id[0] !== match.id) return 'source_episode_id_disagrees';
  if (!candidates.includes(match.seriesId)) return 'match_outside_candidates';
  const member = catalog.get(match.id);
  if (!member || member.seriesId !== match.seriesId || member.season !== match.season || member.episode !== match.episode) {
    return 'catalog_membership_disagrees';
  }
  if (item.season !== match.season || item.episode !== match.episode) return 'numbering_differs';
  if (findings.some(f => f.status === 'other_media_only')) return 'agreement_with_other_media_mapping';
  return findings.some(f => f.status === 'not_found') ? 'agreement_with_missing_mapping' : 'candidate_agrees';
}
