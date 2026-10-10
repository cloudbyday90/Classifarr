/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;
const positiveId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

/** Numbering/count comparison only: never interpret alignment as an identity match. */
export function compareSourceCatalogLayout(layout, candidateId, details) {
  const type = layout.identity.mediaType;
  if (!positiveId(candidateId) || details?.id !== candidateId ||
      typeof details[type === 'tv' ? 'name' : 'title'] !== 'string' ||
      !details[type === 'tv' ? 'name' : 'title'].trim()) return 'catalog_invalid';
  if (type === 'movie') return 'movie_candidate_present';
  if (!Array.isArray(details.seasons) || details.seasons.length > 256) return 'catalog_invalid';
  const seasons = new Map(), ids = new Set();
  for (const season of details.seasons) {
    if (!positiveId(season?.id) || !count(season.season_number) || !count(season.episode_count) ||
        seasons.has(season.season_number) || ids.has(season.id)) return 'catalog_invalid';
    seasons.set(season.season_number, season.episode_count);
    ids.add(season.id);
  }
  if (!layout.episodeCount) return 'source_layout_empty';
  for (const season of layout.seasons) {
    const maximum = seasons.get(season.number);
    if (maximum === undefined || season.episodes.some(number => number < 1 || number > maximum)) return 'outside_season_count_bounds';
  }
  const catalogEpisodes = [...seasons.values()].reduce((sum, size) => sum + size, 0);
  return layout.episodeCount === catalogEpisodes ? 'equal_season_count_bounds' : 'within_season_count_bounds';
}
