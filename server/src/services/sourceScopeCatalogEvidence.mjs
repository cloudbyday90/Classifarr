/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { catalogSeasonPlan, appendCatalogSeason } from './catalogEpisodeEvidence.mjs';
import { copySourceCatalogScope } from './sourceCatalogScopePlan.mjs';
import { projectReviewCandidate } from './mediaIdentityReviewContract.mjs';
import { createEpisodeGapReader } from './sourceEpisodeGap.mjs';
import { episodePositionKey, reviewedEpisodeMatches, scopeCatalogSeasons } from './reviewedEpisodeMappings.mjs';

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
  if (works.length > 4 || edges.length > 32 || scopeCatalogSeasons(edges, scope.episodeMappings).length > 32) fail('scope_limit');
  if (scope.episodeMappings?.some(edge => !source.episodes.some(item =>
    item.season === edge.sourceSeason && item.episode === edge.sourceEpisode))) fail('episode_source_missing');
  return { mediaType: 'tv', works, edges, ...(scope.episodeMappings ? { episodeMappings: scope.episodeMappings } : {}) };
}

/** Fresh typed reads; retain only bounded IDs/positions, never provider payloads. */
export async function readScopeCatalog(plan, provider, signal) {
  const catalog = new Map(), details = [], seasonDescriptions = [], episodeReviews = [];
  // Preserve legacy fingerprint ordering when no episode declarations are present.
  const requestedSeasons = plan.episodeMappings ? scopeCatalogSeasons(plan.edges, plan.episodeMappings) : plan.edges;
  let episodeCount = 0;
  for (const id of plan.works) {
    signal.throwIfAborted();
    const data = await provider.getIdentityDetails(id, plan.mediaType, { signal });
    signal.throwIfAborted();
    const candidate = projectReviewCandidate(data, id, plan.mediaType);
    details.push(candidate);
    if (plan.mediaType === 'movie') continue;
    const seasons = catalogSeasonPlan(id, data);
    for (const edge of requestedSeasons.filter(value => value.tmdbSeriesId === id)) {
      const season = seasons.find(value => value.number === edge.tmdbSeason);
      if (!season) fail('catalog_season_missing');
      episodeCount += season.count;
      if (episodeCount > 10000) fail('catalog_scope_limit');
      const payload = await provider.getIdentitySeasonDetails(id, season.number, { signal });
      signal.throwIfAborted();
      appendCatalogSeason(catalog, season, payload);
      for (const mapping of (plan.episodeMappings ?? []).filter(value => value.tmdbSeriesId === id && value.tmdbSeason === season.number)) {
        if (!reviewedEpisodeMatches(mapping, catalog)) fail('episode_target_missing');
        const episode = payload.episodes.find(value => value.id === mapping.tmdbEpisodeId);
        if (typeof episode.name !== 'string' || !episode.name.trim()) fail('episode_target_missing');
        episodeReviews.push({ ...mapping, title: episode.name.slice(0, 500) });
      }
      seasonDescriptions.push({ tmdbSeriesId: id, seasonNumber: season.number,
        overview: typeof payload.overview === 'string' ? payload.overview.slice(0, 4000) : null });
    }
  }
  return { catalog, details, seasons: seasonDescriptions, episodeReviews,
    digest: scopeEvidenceDigest({ details, seasons: seasonDescriptions, episodes: [...catalog].sort(([a], [b]) => a - b),
      ...(plan.episodeMappings ? { episodeReviews } : {}) }) };
}

function episodeExclusion(item, edge, manual, catalog, sourceUses, effectiveUses) {
  if (!edge) return 'unmapped_season';
  if (Object.values(item.providerIds).some(values => values.length > 1)) return 'ambiguous_episode_ids';
  if (Object.entries(item.providerIds).some(([field, values]) => values.some(id => sourceUses.get(`${field}:${id}`) > 1))) return 'reused_episode_id';
  const ids = item.providerIds.tmdb_id;
  if (effectiveUses.get(manual?.tmdbEpisodeId ?? ids[0]) > 1) return 'reused_episode_target';
  if (manual) return reviewedEpisodeMatches(manual, catalog) ? null : 'episode_target_missing';
  if (!ids.length) return 'missing_tmdb_episode_id';
  const member = catalog.get(ids[0]);
  if (!member) return 'episode_absent_from_scope';
  if (member.seriesId !== edge.tmdbSeriesId || member.season !== edge.tmdbSeason) return 'episode_outside_mapping';
  return member.episode !== item.episode ? 'episode_numbering_differs' : null;
}

/** Typed membership and explicit human declarations, not independent identity proof. */
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
  const exclusions = [], effectiveUses = new Map();
  const reviewed = new Map((plan.episodeMappings ?? []).map(edge => [episodePositionKey(edge.sourceSeason, edge.sourceEpisode), edge]));
  for (const item of source.episodes) {
    const manual = reviewed.get(episodePositionKey(item.season, item.episode));
    const id = manual?.tmdbEpisodeId ?? (item.providerIds.tmdb_id.length === 1 ? item.providerIds.tmdb_id[0] : null);
    if (id) effectiveUses.set(id, (effectiveUses.get(id) ?? 0) + 1);
  }
  let operatorReviewed = 0;
  const readGap = createEpisodeGapReader(plan, catalog);
  for (const item of source.episodes) {
    const edge = plan.edges.find(value => value.sourceSeason === item.season);
    const manual = reviewed.get(episodePositionKey(item.season, item.episode));
    const reason = episodeExclusion(item, edge, manual, catalog, uses, effectiveUses);
    if (reason) {
      const gap = readGap(item, reason);
      exclusions.push({ season: item.season, episode: item.episode, reason, ...(gap ? { gap } : {}) });
    } else if (manual) operatorReviewed++;
  }
  return { unit: 'episode', total: source.episodes.length, matched: source.episodes.length - exclusions.length, exclusions,
    ...(plan.episodeMappings ? { operatorReviewed } : {}) };
}
