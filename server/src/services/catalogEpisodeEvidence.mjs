/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const CATALOG_EPISODE_LIMITS = Object.freeze({ seasonsPerItem: 64, episodesPerItem: 10000, seasonsPerRun: 128 });
const positiveId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const index = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;

export class CatalogEpisodeEvidenceError extends Error {
  constructor(code = 'catalog_invalid') { super(code); this.code = code; }
}
const reject = () => { throw new CatalogEpisodeEvidenceError(); };

export function catalogSeasonPlan(seriesId, details) {
  if (!positiveId(seriesId) || details?.id !== seriesId || typeof details.name !== 'string' || !details.name.trim() ||
      !Array.isArray(details.seasons) || details.seasons.length > 256) reject();
  const ids = new Set(), numbers = new Set();
  return details.seasons.map(season => {
    if (!positiveId(season?.id) || !index(season.season_number) || !index(season.episode_count) ||
        ids.has(season.id) || numbers.has(season.season_number)) reject();
    ids.add(season.id); numbers.add(season.season_number);
    return { seriesId, id: season.id, number: season.season_number, count: season.episode_count };
  });
}

/** Validate the complete response before contributing any catalog membership. */
export function appendCatalogSeason(target, plan, payload) {
  if (payload?.id !== plan.id || payload.season_number !== plan.number || !Array.isArray(payload.episodes) ||
      payload.episodes.length !== plan.count) reject();
  const positions = new Set(), additions = new Map();
  for (const item of payload.episodes) {
    if (!positiveId(item?.id) || item.show_id !== plan.seriesId || item.season_number !== plan.number ||
        !index(item.episode_number) || target.has(item.id) || additions.has(item.id) || positions.has(item.episode_number)) reject();
    positions.add(item.episode_number);
    additions.set(item.id, { seriesId: plan.seriesId, season: plan.number, episode: item.episode_number });
  }
  for (const [id, member] of additions) target.set(id, member);
}

/** Compare exact ID declarations; titles and array order are not matching signals. */
export function compareCatalogEpisodes(episodes, catalog) {
  const uses = new Map(), matchedSeries = new Set(), comparisons = {};
  for (const item of episodes) {
    for (const id of item.providerIds.tmdb_id) uses.set(id, (uses.get(id) ?? 0) + 1);
  }
  for (const item of episodes) {
    const ids = item.providerIds.tmdb_id;
    let code;
    if (!ids.length) code = 'episode_identity_missing';
    else if (ids.length !== 1) code = 'episode_identity_ambiguous';
    else if (uses.get(ids[0]) !== 1) code = 'episode_identity_reused';
    else {
      const match = catalog.get(ids[0]);
      if (!match) code = 'episode_identity_absent_from_candidates';
      else {
        matchedSeries.add(match.seriesId);
        code = match.season === item.season && match.episode === item.episode
          ? 'episode_numbering_agrees' : 'episode_numbering_differs';
      }
    }
    comparisons[code] = (comparisons[code] ?? 0) + 1;
  }
  return { comparisons, groupsSpanningCatalogSeries: matchedSeries.size > 1 ? 1 : 0 };
}
