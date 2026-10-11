/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function parseEpisodeGap(gap, exclusion, scope) {
  if (!gap || !['missing_tmdb_episode_id', 'episode_absent_from_scope'].includes(exclusion.reason) ||
      !['present', 'absent'].includes(gap.catalogPosition) ||
      !(exclusion.reason === 'missing_tmdb_episode_id' ? ['none', 'other_only'] : ['tmdb']).includes(gap.sourceIds)) return null
  const edge = scope.kind === 'whole_work'
    ? { tmdbSeriesId: scope.tmdbId, tmdbSeason: exclusion.season }
    : scope.mappings?.find(value => value.sourceSeason === exclusion.season)
  if (!edge || gap.target?.tmdbSeriesId !== edge.tmdbSeriesId || gap.target.season !== edge.tmdbSeason ||
      gap.target.episode !== exclusion.episode) return null
  return { sourceIds: gap.sourceIds, catalogPosition: gap.catalogPosition,
    target: { tmdbSeriesId: edge.tmdbSeriesId, season: edge.tmdbSeason, episode: exclusion.episode } }
}

export const episodeIdGuidance = Object.freeze({
  none: 'The source supplied no supported external IDs for this episode. Check this episode’s match and ordering in your media server; a series poster or synopsis is not episode identity evidence.',
  other_only: 'The source supplied other external IDs but no TMDb episode ID. Verify this episode’s provider links and ordering before changing its match.',
  tmdb: 'The source supplied a TMDb episode ID, but it was not found in the checked catalog scope. Do not replace it solely because another episode has the same number.',
})
export const episodePositionGuidance = Object.freeze({
  absent: 'TMDb returned no episode at this proposed position. Check the proposed series, season and episode order against the catalog. A metadata refresh cannot guarantee a missing catalog entry will appear.',
  present: 'TMDb has an episode at this proposed position, but position alone does not verify its identity. Compare the episode’s provider records before changing the source or proposal.',
})
