/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const positionKey = (series, season, episode) => `${series}:${season}:${episode}`;

/** Diagnostic only: a numbered position never supplies or verifies an identity. */
export function createEpisodeGapReader(plan, catalog) {
  const positions = new Set([...catalog.values()].map(member =>
    positionKey(member.seriesId, member.season, member.episode)));
  const edges = new Map(plan.edges.map(edge => [edge.sourceSeason, edge]));
  return (item, reason) => {
    if (!['missing_tmdb_episode_id', 'episode_absent_from_scope'].includes(reason)) return null;
    const edge = edges.get(item.season);
    if (!edge) return null;
    return {
      sourceIds: item.providerIds.tmdb_id.length ? 'tmdb'
        : Object.values(item.providerIds).some(ids => ids.length) ? 'other_only' : 'none',
      catalogPosition: positions.has(positionKey(edge.tmdbSeriesId, edge.tmdbSeason, item.episode)) ? 'present' : 'absent',
      target: { tmdbSeriesId: edge.tmdbSeriesId, season: edge.tmdbSeason, episode: item.episode },
    };
  };
}
