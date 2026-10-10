/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CATALOG_EPISODE_LIMITS, CatalogEpisodeEvidenceError, catalogSeasonPlan,
  appendCatalogSeason, compareCatalogEpisodes } from './catalogEpisodeEvidence.mjs';

/** Bounded catalog reads between the caller's two source snapshots. Never repairs. */
export async function inspectSourceCatalogEpisodes(source, tmdb, { signal, budget }) {
  signal.throwIfAborted();
  if (source.identity.mediaType === 'movie') return { outcome: 'episode_preview_not_applicable' };
  if (!source.episodes.length) return { outcome: 'source_layout_empty' };
  const candidates = source.identity.providerIds.tmdb_id;
  if (!candidates.length) return { outcome: 'no_tmdb_candidate' };
  if (candidates.length > 4) return { outcome: 'candidate_limit' };
  try {
    const plans = [];
    for (const id of candidates) {
      signal.throwIfAborted();
      const details = await tmdb.getIdentityDetails(id, 'tv', { signal });
      signal.throwIfAborted();
      plans.push(...catalogSeasonPlan(id, details));
    }
    if (plans.length > CATALOG_EPISODE_LIMITS.seasonsPerItem ||
        plans.reduce((sum, plan) => sum + plan.count, 0) > CATALOG_EPISODE_LIMITS.episodesPerItem) {
      return { outcome: 'catalog_scope_limit' };
    }
    if (!Number.isSafeInteger(budget.remainingSeasons) || plans.length > budget.remainingSeasons) {
      return { outcome: 'catalog_request_limit' };
    }
    const catalog = new Map();
    for (const plan of plans) {
      signal.throwIfAborted();
      budget.remainingSeasons--;
      const details = await tmdb.getIdentitySeasonDetails(plan.seriesId, plan.number, { signal });
      signal.throwIfAborted();
      appendCatalogSeason(catalog, plan, details);
    }
    return { outcome: 'episodes_inspected', candidates: candidates.length,
      ...compareCatalogEpisodes(source.episodes, catalog) };
  } catch (error) {
    signal.throwIfAborted();
    return { outcome: error instanceof CatalogEpisodeEvidenceError ? error.code : 'catalog_unavailable' };
  }
}
