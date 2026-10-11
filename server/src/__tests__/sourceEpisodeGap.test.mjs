/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createEpisodeGapReader } from '../services/sourceEpisodeGap.mjs';
import { compareScopeEvidence } from '../services/sourceScopeCatalogEvidence.mjs';

const plan = { mediaType: 'tv', works: [10], edges: [{ sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 5 }] };
const item = (tmdb = [], tvdb = []) => ({ season: 1, episode: 2, providerIds: { tmdb_id: tmdb, tvdb_id: tvdb, imdb_id: [] } });
const member = (seriesId = 10, season = 5, episode = 2) => new Map([[101, { seriesId, season, episode }]]);

test.each([
  [item(), 'missing_tmdb_episode_id', 'none'],
  [item([], [7]), 'missing_tmdb_episode_id', 'other_only'],
  [item([999]), 'episode_absent_from_scope', 'tmdb'],
])('reports source declarations without promoting numbered membership: %s', (episode, reason, sourceIds) => {
  const data = { episodes: [episode] }, before = structuredClone(data);
  const result = compareScopeEvidence(data, plan, member());
  expect(result).toEqual({ unit: 'episode', total: 1, matched: 0, exclusions: [{ season: 1, episode: 2, reason,
    gap: { sourceIds, catalogPosition: 'present', target: { tmdbSeriesId: 10, season: 5, episode: 2 } } }] });
  expect(data).toEqual(before);
});
test.each([new Map(), member(20), member(10, 1), member(10, 5, 3)])('does not mistake another catalog position for the proposal', catalog => {
  expect(createEpisodeGapReader(plan, catalog)(item(), 'missing_tmdb_episode_id')).toMatchObject({ catalogPosition: 'absent' });
});
test('uses explicit source-to-catalog season mappings, including specials', () => {
  const special = { edges: [{ sourceSeason: 0, tmdbSeriesId: 20, tmdbSeason: 3 }] };
  expect(createEpisodeGapReader(special, member(20, 3))({ ...item(), season: 0 }, 'missing_tmdb_episode_id'))
    .toEqual({ sourceIds: 'none', catalogPosition: 'present', target: { tmdbSeriesId: 20, season: 3, episode: 2 } });
});
test.each(['unmapped_season', 'ambiguous_episode_ids', 'reused_episode_id', 'episode_outside_mapping', 'episode_numbering_differs', 'unknown'])('adds no speculative diagnosis for %s', reason => {
  expect(createEpisodeGapReader(plan, member())(item(), reason)).toBeNull();
});
test('adds no diagnosis without a mapped season and leaves empty or matched scopes unchanged', () => {
  expect(createEpisodeGapReader({ edges: [] }, member())(item(), 'missing_tmdb_episode_id')).toBeNull();
  expect(compareScopeEvidence({ episodes: [] }, plan, new Map())).toEqual({ unit: 'episode', total: 0, matched: 0, exclusions: [] });
  expect(compareScopeEvidence({ episodes: [item([101])] }, plan, member()).exclusions).toEqual([]);
});
