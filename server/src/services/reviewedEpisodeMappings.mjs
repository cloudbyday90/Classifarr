/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const fields = ['sourceSeason', 'sourceEpisode', 'tmdbSeriesId', 'tmdbSeason', 'tmdbEpisode', 'tmdbEpisodeId'];
const id = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const position = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;
export const episodePositionKey = (season, episode) => `${season}:${episode}`;

/** Explicit human declarations only. No inferred identity or provider mutation. */
export function copyReviewedEpisodeMappings(value, scope) {
  if (!Array.isArray(value) || !value.length || value.length > 64) return null;
  const works = new Set(scope.kind === 'whole_work' ? [scope.tmdbId] : scope.mappings.map(edge => edge.tmdbSeriesId));
  const sources = new Set(), targets = new Set(), ids = new Set(), copied = [];
  for (const edge of value) {
    if (!edge || Object.keys(edge).length !== fields.length || !fields.every(key => Object.hasOwn(edge, key)) ||
        !id(edge.tmdbSeriesId) || !id(edge.tmdbEpisodeId) || !works.has(edge.tmdbSeriesId) ||
        !['sourceSeason', 'sourceEpisode', 'tmdbSeason', 'tmdbEpisode'].every(key => position(edge[key])) ||
        (scope.kind === 'seasons' && !scope.mappings.some(item => item.sourceSeason === edge.sourceSeason))) return null;
    const source = episodePositionKey(edge.sourceSeason, edge.sourceEpisode);
    const target = `${edge.tmdbSeriesId}:${edge.tmdbSeason}:${edge.tmdbEpisode}`;
    if (sources.has(source) || targets.has(target) || ids.has(edge.tmdbEpisodeId)) return null;
    sources.add(source); targets.add(target); ids.add(edge.tmdbEpisodeId);
    copied.push(Object.fromEntries(fields.map(key => [key, edge[key]])));
  }
  return copied.sort((a, b) => a.sourceSeason - b.sourceSeason || a.sourceEpisode - b.sourceEpisode);
}

export function reviewedEpisodeMatches(edge, catalog) {
  const member = catalog.get(edge.tmdbEpisodeId);
  return member?.seriesId === edge.tmdbSeriesId && member.season === edge.tmdbSeason && member.episode === edge.tmdbEpisode;
}

/** Unique catalog seasons used for reads/documents, within the existing scope cap. */
export function scopeCatalogSeasons(edges, episodeMappings = []) {
  const seasons = new Map();
  for (const edge of [...edges, ...episodeMappings]) {
    seasons.set(`${edge.tmdbSeriesId}:${edge.tmdbSeason}`, { tmdbSeriesId: edge.tmdbSeriesId, tmdbSeason: edge.tmdbSeason });
  }
  return [...seasons.values()].sort((a, b) => a.tmdbSeriesId - b.tmdbSeriesId || a.tmdbSeason - b.tmdbSeason);
}
