/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const episodeMappingFields = Object.freeze({ sourceSeason: 'Source season', sourceEpisode: 'Source episode',
  tmdbSeriesId: 'TMDb series ID', tmdbSeason: 'TMDb season', tmdbEpisode: 'TMDb episode number', tmdbEpisodeId: 'TMDb episode ID' })
const id = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647
const number = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000

export function parseReviewedEpisodeMappings(scope) {
  if (scope.episodeMappings === undefined) return []
  if (!Array.isArray(scope.episodeMappings) || !scope.episodeMappings.length || scope.episodeMappings.length > 64) return null
  const works = new Set(scope.kind === 'whole_work' ? [scope.tmdbId] : scope.mappings?.map(edge => edge.tmdbSeriesId))
  const sources = new Set(), targets = new Set(), ids = new Set(), result = []
  for (const edge of scope.episodeMappings) {
    if (!edge || !id(edge.tmdbSeriesId) || !id(edge.tmdbEpisodeId) || !works.has(edge.tmdbSeriesId) ||
        !['sourceSeason', 'sourceEpisode', 'tmdbSeason', 'tmdbEpisode'].every(key => number(edge[key])) ||
        (scope.kind === 'seasons' && !scope.mappings.some(value => value.sourceSeason === edge.sourceSeason))) return null
    const source = `${edge.sourceSeason}:${edge.sourceEpisode}`, target = `${edge.tmdbSeriesId}:${edge.tmdbSeason}:${edge.tmdbEpisode}`
    if (sources.has(source) || targets.has(target) || ids.has(edge.tmdbEpisodeId)) return null
    sources.add(source); targets.add(target); ids.add(edge.tmdbEpisodeId)
    result.push(Object.fromEntries(Object.keys(episodeMappingFields).map(key => [key, edge[key]])))
  }
  return result.sort((a, b) => a.sourceSeason - b.sourceSeason || a.sourceEpisode - b.sourceEpisode)
}

export function parseEpisodeReviews(data, scope, comparison) {
  const mappings = parseReviewedEpisodeMappings(scope)
  if (!mappings) return null
  if (!mappings.length) return data.episodeReviews === undefined && data.identityAuthority === undefined && comparison.operatorReviewed === undefined ? [] : null
  if (comparison.unit !== 'episode' || data.identityAuthority !== 'operator_episode_mapping' || data.combinedAudit !== undefined ||
      !Array.isArray(data.episodeReviews) || data.episodeReviews.length !== mappings.length) return null
  const excluded = new Set(comparison.exclusions.map(item => `${item.season}:${item.episode}`))
  const covered = mappings.filter(edge => !excluded.has(`${edge.sourceSeason}:${edge.sourceEpisode}`)).length
  if (comparison.operatorReviewed !== covered || covered > comparison.matched) return null
  const rows = new Map(mappings.map(edge => [`${edge.sourceSeason}:${edge.sourceEpisode}`, edge])), result = []
  for (const value of data.episodeReviews) {
    const key = `${value?.sourceSeason}:${value?.sourceEpisode}`, edge = rows.get(key)
    if (!edge || Object.keys(episodeMappingFields).some(field => value[field] !== edge[field]) ||
        typeof value.title !== 'string' || !value.title.trim() || value.title.length > 500) return null
    if (value.sourceTitle !== undefined && value.sourceTitle !== null &&
        (typeof value.sourceTitle !== 'string' || !value.sourceTitle.trim() || value.sourceTitle.length > 500 || /[\p{Cc}\p{Cf}]/u.test(value.sourceTitle))) return null
    rows.delete(key); result.push({ ...edge, title: value.title,
      ...(value.sourceTitle !== undefined ? { sourceTitle: value.sourceTitle } : {}) })
  }
  return result
}
