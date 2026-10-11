/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const fields = ['sourceSeason', 'sourceEpisode', 'tmdbSeriesId', 'tmdbSeason', 'tmdbEpisode', 'tmdbEpisodeId'];
const movieFields = ['sourceSeason', 'sourceEpisode', 'tmdbMovieId'];
const id = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const position = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;
export const episodePositionKey = (season, episode) => `${season}:${episode}`;
export const reviewedTargetKey = edge => edge?.tmdbMovieId !== undefined ? `movie:${edge.tmdbMovieId}` : edge?.tmdbEpisodeId;

/** Explicit human declarations only. No inferred identity or provider mutation. */
export function copyReviewedEpisodeMappings(value, scope) {
  if (!Array.isArray(value) || !value.length || value.length > 64) return null;
  const works = new Set(scope.kind === 'whole_work' ? [scope.tmdbId] : scope.mappings.map(edge => edge.tmdbSeriesId));
  const sources = new Set(), targets = new Set(), ids = new Set(), copied = [];
  for (const edge of value) {
    const movie = edge?.tmdbMovieId !== undefined, required = movie ? movieFields : fields;
    if (!edge || Object.keys(edge).length !== required.length || !required.every(key => Object.hasOwn(edge, key)) ||
        !(movie ? scope.kind === 'seasons' && id(edge.tmdbMovieId)
          : id(edge.tmdbSeriesId) && id(edge.tmdbEpisodeId) && works.has(edge.tmdbSeriesId) && position(edge.tmdbSeason) && position(edge.tmdbEpisode)) ||
        !['sourceSeason', 'sourceEpisode'].every(key => position(edge[key])) ||
        (scope.kind === 'seasons' && !scope.mappings.some(item => item.sourceSeason === edge.sourceSeason))) return null;
    const source = episodePositionKey(edge.sourceSeason, edge.sourceEpisode);
    const target = movie ? reviewedTargetKey(edge) : `${edge.tmdbSeriesId}:${edge.tmdbSeason}:${edge.tmdbEpisode}`;
    if (sources.has(source) || targets.has(target) || ids.has(reviewedTargetKey(edge))) return null;
    sources.add(source); targets.add(target); ids.add(reviewedTargetKey(edge));
    copied.push(Object.fromEntries(required.map(key => [key, edge[key]])));
  }
  return copied.sort((a, b) => a.sourceSeason - b.sourceSeason || a.sourceEpisode - b.sourceEpisode);
}

export function reviewedEpisodeMatches(edge, catalog) {
  const member = catalog.get(reviewedTargetKey(edge));
  if (edge.tmdbMovieId !== undefined) return member?.mediaType === 'movie' && member.tmdbId === edge.tmdbMovieId;
  return member?.seriesId === edge.tmdbSeriesId && member.season === edge.tmdbSeason && member.episode === edge.tmdbEpisode;
}

/** Unique catalog seasons used for reads/documents, within the existing scope cap. */
export function scopeCatalogSeasons(edges, episodeMappings = []) {
  const seasons = new Map();
  for (const edge of [...edges, ...episodeMappings]) {
    if (edge.tmdbMovieId !== undefined) continue;
    seasons.set(`${edge.tmdbSeriesId}:${edge.tmdbSeason}`, { tmdbSeriesId: edge.tmdbSeriesId, tmdbSeason: edge.tmdbSeason });
  }
  return [...seasons.values()].sort((a, b) => a.tmdbSeriesId - b.tmdbSeriesId || a.tmdbSeason - b.tmdbSeason);
}
