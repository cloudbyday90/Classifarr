/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { catalogSeasonPlan, appendCatalogSeason } from './catalogEpisodeEvidence.mjs';
import { copySourceCatalogScope } from './sourceCatalogScopePlan.mjs';
import { projectReviewCandidate } from './mediaIdentityReviewContract.mjs';

export class ScopeEvidenceError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new ScopeEvidenceError(code); };
export const scopeEvidenceDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Translate a declared scope, never infer a catalog identity from numbering. */
export function scopeEvidencePlan(source, input) {
  const scope = copySourceCatalogScope(source.identity.mediaType, input);
  if (!scope) fail('invalid_scope');
  if (source.identity.mediaType === 'movie') return { mediaType: 'movie', works: [scope.tmdbId], edges: [] };
  const actual = source.seasons.map(season => season.number);
  if (scope.kind === 'seasons' && JSON.stringify(actual) !== JSON.stringify(scope.sourceSeasonNumbers)) {
    fail('source_seasons_changed');
  }
  const edges = scope.kind === 'seasons' ? scope.mappings : actual.map(number => ({
    sourceSeason: number, tmdbSeriesId: scope.tmdbId, tmdbSeason: number,
  }));
  const works = [...new Set(edges.map(edge => edge.tmdbSeriesId))].sort((a, b) => a - b);
  if (works.length > 4 || edges.length > 32) fail('scope_limit');
  return { mediaType: 'tv', works, edges };
}

/** Fresh typed reads; retain only bounded IDs/positions, never provider payloads. */
export async function readScopeCatalog(plan, provider, signal) {
  const catalog = new Map(), details = [], seasonDescriptions = [];
  let episodeCount = 0;
  for (const id of plan.works) {
    signal.throwIfAborted();
    const data = await provider.getIdentityDetails(id, plan.mediaType, { signal });
    signal.throwIfAborted();
    const candidate = projectReviewCandidate(data, id, plan.mediaType);
    details.push(candidate);
    if (plan.mediaType === 'movie') continue;
    const seasons = catalogSeasonPlan(id, data);
    for (const edge of plan.edges.filter(value => value.tmdbSeriesId === id)) {
      const season = seasons.find(value => value.number === edge.tmdbSeason);
      if (!season) fail('catalog_season_missing');
      episodeCount += season.count;
      if (episodeCount > 10000) fail('catalog_scope_limit');
      const payload = await provider.getIdentitySeasonDetails(id, season.number, { signal });
      signal.throwIfAborted();
      appendCatalogSeason(catalog, season, payload);
      seasonDescriptions.push({ tmdbSeriesId: id, seasonNumber: season.number,
        overview: typeof payload.overview === 'string' ? payload.overview.slice(0, 4000) : null });
    }
  }
  return { catalog, details, seasons: seasonDescriptions,
    digest: scopeEvidenceDigest({ details, seasons: seasonDescriptions, episodes: [...catalog].sort(([a], [b]) => a - b) }) };
}

/** Exact source TMDb episode membership, not independent cross-provider approval. */
export function compareScopeEvidence(source, plan, catalog) {
  if (plan.mediaType === 'movie') return {
    unit: 'movie', total: 1,
    matched: source.identity.providerIds.tmdb_id.length === 1 &&
      source.identity.providerIds.tmdb_id[0] === plan.works[0] ? 1 : 0,
    exclusions: source.identity.providerIds.tmdb_id.length === 1 &&
      source.identity.providerIds.tmdb_id[0] === plan.works[0] ? [] : [{ reason: 'parent_identity_unresolved' }],
  };
  const uses = new Map();
  for (const item of source.episodes) for (const [field, ids] of Object.entries(item.providerIds)) {
    for (const id of ids) uses.set(`${field}:${id}`, (uses.get(`${field}:${id}`) ?? 0) + 1);
  }
  const exclusions = [];
  for (const item of source.episodes) {
    const edge = plan.edges.find(value => value.sourceSeason === item.season);
    const ids = item.providerIds.tmdb_id;
    const member = ids.length === 1 ? catalog.get(ids[0]) : null;
    const reason = !edge ? 'unmapped_season'
      : Object.values(item.providerIds).some(values => values.length > 1) ? 'ambiguous_episode_ids'
        : Object.entries(item.providerIds).some(([field, values]) => values.some(id => uses.get(`${field}:${id}`) > 1)) ? 'reused_episode_id'
          : !ids.length ? 'missing_tmdb_episode_id'
            : !member ? 'episode_absent_from_scope'
              : member.seriesId !== edge.tmdbSeriesId || member.season !== edge.tmdbSeason ? 'episode_outside_mapping'
                : member.episode !== item.episode ? 'episode_numbering_differs' : null;
    if (reason) exclusions.push({ season: item.season, episode: item.episode, reason });
  }
  return { unit: 'episode', total: source.episodes.length, matched: source.episodes.length - exclusions.length, exclusions };
}
