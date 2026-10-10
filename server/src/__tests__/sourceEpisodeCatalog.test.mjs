/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { inspectSourceCatalogEpisodes } from '../services/sourceEpisodeCatalogInspection.mjs';
import { appendCatalogSeason } from '../services/catalogEpisodeEvidence.mjs';

const episode = (id, season = 1, number = 1) => ({ id: `source-${id}`, season, episode: number,
  providerIds: { tmdb_id: [id], imdb_id: [], tvdb_id: [] } });
const source = (episodes = [episode(100)], candidates = [10]) => ({
  identity: { mediaType: 'tv', providerIds: { tmdb_id: candidates } }, episodes,
});
const series = (id = 10) => ({ id, name: 'Synthetic', seasons: [{ id: id + 1, season_number: 1, episode_count: 1 }] });
const season = (show = 10, id = 100) => ({ id: show + 1, season_number: 1,
  episodes: [{ id, show_id: show, season_number: 1, episode_number: 1 }] });
const setup = () => ({ getIdentityDetails: jest.fn(async id => series(id)),
  getIdentitySeasonDetails: jest.fn(async id => season(id, id * 10)) });
const inspect = (s = source(), t = setup(), extra = {}) => inspectSourceCatalogEpisodes(s, t, {
  signal: new AbortController().signal, budget: { remainingSeasons: 128 }, ...extra,
});

test('joins exact typed episode IDs, independently of titles and numbering', async () => {
  const t = setup();
  expect(await inspect(source([episode(100, 3, 9)]), t)).toMatchObject({ outcome: 'episodes_inspected',
    comparisons: { episode_numbering_differs: 1 }, groupsSpanningCatalogSeries: 0 });
  expect(t.getIdentitySeasonDetails).toHaveBeenCalledWith(10, 1, { signal: expect.any(AbortSignal) });
});

test('preserves a source group spanning multiple candidate series', async () => {
  expect(await inspect(source([episode(100), episode(200, 2)], [10, 20]))).toMatchObject({
    comparisons: { episode_numbering_agrees: 1, episode_numbering_differs: 1 }, groupsSpanningCatalogSeries: 1,
  });
});

test('reports unknown, ambiguous, duplicate and absent IDs without choosing a winner', async () => {
  const items = [episode(100), episode(100, 2), episode(999),
    { ...episode(1), providerIds: { tmdb_id: [] } }, { ...episode(2), providerIds: { tmdb_id: [100, 200] } }];
  expect((await inspect(source(items))).comparisons).toEqual({ episode_identity_reused: 2,
    episode_identity_absent_from_candidates: 1, episode_identity_missing: 1, episode_identity_ambiguous: 1 });
});

test('movies, missing candidates and empty episode lists do no catalog work', async () => {
  const t = setup();
  expect((await inspect({ identity: { mediaType: 'movie' } }, t)).outcome).toBe('episode_preview_not_applicable');
  expect((await inspect(source([], [10]), t)).outcome).toBe('source_layout_empty');
  expect((await inspect(source([episode(1)], []), t)).outcome).toBe('no_tmdb_candidate');
  expect(t.getIdentityDetails).not.toHaveBeenCalled();
});

test.each([
  { id: 99, season_number: 1, episodes: [] },
  { ...season(), season_number: 2 },
  { ...season(), episodes: [] },
  { ...season(), episodes: [{ ...season().episodes[0], show_id: 99 }] },
  { ...season(), episodes: [{ ...season().episodes[0], season_number: 99 }] },
  { ...season(), episodes: [{ ...season().episodes[0], id: null }] },
  { ...season(), episodes: [{ ...season().episodes[0], episode_number: -1 }] },
])('rejects malformed catalog membership without partial findings', async payload => {
  const t = setup(); t.getIdentitySeasonDetails.mockResolvedValue(payload);
  expect(await inspect(source(), t)).toEqual({ outcome: 'catalog_invalid' });
});

test('rejects duplicate identities and coordinates across a complete season', async () => {
  const t = setup(); t.getIdentityDetails.mockResolvedValue({ ...series(), seasons: [{ id: 11, season_number: 1, episode_count: 2 }] });
  t.getIdentitySeasonDetails.mockResolvedValue({ ...season(), episodes: [season().episodes[0], season().episodes[0]] });
  expect(await inspect(source(), t)).toEqual({ outcome: 'catalog_invalid' });
  t.getIdentitySeasonDetails.mockResolvedValue({ ...season(), episodes: [season().episodes[0], { ...season().episodes[0], id: 200 }] });
  expect(await inspect(source(), t)).toEqual({ outcome: 'catalog_invalid' });
});

test('shared request budget is consumed and never becomes a negative match', async () => {
  const t = setup(), budget = { remainingSeasons: 1 };
  expect((await inspect(source(), t, { budget })).outcome).toBe('episodes_inspected');
  expect(budget.remainingSeasons).toBe(0);
  expect(await inspect(source(), t, { budget })).toEqual({ outcome: 'catalog_request_limit' });
  expect(t.getIdentitySeasonDetails).toHaveBeenCalledTimes(1);
});

test('provider failure is sanitized; cancellation stops before another request', async () => {
  const t = setup(); t.getIdentitySeasonDetails.mockRejectedValue(new Error('private URL/token'));
  expect(await inspect(source(), t)).toEqual({ outcome: 'catalog_unavailable' });
  const controller = new AbortController();
  t.getIdentityDetails.mockImplementation(async () => { controller.abort(); return series(); });
  await expect(inspect(source(), t, { signal: controller.signal })).rejects.toThrow();
  expect(t.getIdentitySeasonDetails).toHaveBeenCalledTimes(1);
});

test.each([
  null, { ...series(), id: 99 }, { ...series(), name: '' }, { ...series(), seasons: null },
  { ...series(), seasons: [{ id: 0, season_number: 1, episode_count: 1 }] },
  { ...series(), seasons: [...series().seasons, ...series().seasons] },
  { ...series(), seasons: [{ id: 11, season_number: 1, episode_count: 10001 }] },
])('malformed series never starts season requests', async payload => {
  const t = setup(); t.getIdentityDetails.mockResolvedValue(payload);
  expect(await inspect(source(), t)).toEqual({ outcome: 'catalog_invalid' });
  expect(t.getIdentitySeasonDetails).not.toHaveBeenCalled();
});
test.each(['seasons', 'episodes'])('catalog %s bounds refuse rather than truncate', async limit => {
  const t = setup();
  const seasons = limit === 'seasons'
    ? Array.from({ length: 65 }, (_, i) => ({ id: i + 1, season_number: i, episode_count: 0 }))
    : [{ id: 1, season_number: 0, episode_count: 10000 }, { id: 2, season_number: 1, episode_count: 1 }];
  t.getIdentityDetails.mockResolvedValue({ ...series(), seasons });
  expect(await inspect(source(), t)).toEqual({ outcome: 'catalog_scope_limit' });
  expect(t.getIdentitySeasonDetails).not.toHaveBeenCalled();
});
test('candidate bounds refuse before catalog reads', async () => {
  const t = setup();
  expect(await inspect(source([episode(100)], [1, 2, 3, 4, 5]), t)).toEqual({ outcome: 'candidate_limit' });
  expect(t.getIdentityDetails).not.toHaveBeenCalled();
});
test('specials and a declared empty season are valid, not missing responses', async () => {
  const t = setup();
  t.getIdentityDetails.mockResolvedValue({ ...series(), seasons: [
    { id: 11, season_number: 0, episode_count: 1 }, { id: 12, season_number: 1, episode_count: 0 }] });
  t.getIdentitySeasonDetails.mockImplementation(async (_id, n) => ({ id: n + 11, season_number: n,
    episodes: n ? [] : [{ id: 100, show_id: 10, season_number: 0, episode_number: 1 }] }));
  expect((await inspect(source([episode(100, 0)]), t)).comparisons).toEqual({ episode_numbering_agrees: 1 });
});
test('malformed late entries cannot partially mutate a catalog', () => {
  const target = new Map();
  expect(() => appendCatalogSeason(target, { id: 11, seriesId: 10, number: 1, count: 2 },
    { ...season(), episodes: [season().episodes[0], { ...season().episodes[0], id: 200 }] })).toThrow();
  expect(target.size).toBe(0);
});
