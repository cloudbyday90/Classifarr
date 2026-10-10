/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { captureSourceLayout } from '../services/sourceLayoutCapture.mjs';
import { compareSourceCatalogLayout } from '../services/sourceCatalogLayoutComparison.mjs';

const identity = { mediaType: 'tv', snapshotDigest: 'a'.repeat(64),
  providerIds: { tmdb_id: [10], imdb_id: ['tt10'], tvdb_id: [] } };
const episode = (number, season = 1) => ({ id: `${season}-${number}`, season, episode: number });
const capture = (items = [episode(1)], extra = {}) => captureSourceLayout({ readIdentity: async () => identity,
  readPage: async () => ({ offset: 0, total: items.length, items }), ...extra });
const details = (seasons = [{ id: 11, season_number: 1, episode_count: 1 }]) => ({ id: 10, name: 'Synthetic', seasons });

test('episode identity changes invalidate the snapshot, while provider order does not', async () => {
  const providerIds = { tmdb_id: [10, 20], tvdb_id: [30], imdb_id: ['tt123'] };
  const a = await capture([{ ...episode(1), providerIds }]);
  const b = await capture([{ ...episode(1), providerIds: { ...providerIds, tmdb_id: [20, 10] } }]);
  expect(a.digest).toBe(b.digest);
  expect((await capture([{ ...episode(1), providerIds: { ...providerIds, tmdb_id: [10] } }])).digest).not.toBe(a.digest);
  expect(a.episodes[0].providerIds).toEqual(providerIds);
  await expect(capture([{ ...episode(1), providerIds: null }])).rejects.toThrow('source_layout_invalid');
});

test('canonicalizes adapter-neutral source membership without exposing titles', async () => {
  const a = await capture([episode(2), episode(1), episode(1, 0)]);
  const b = await capture([episode(1, 0), episode(1), episode(2)]);
  expect(a.digest).toBe(b.digest);
  expect(a.seasons).toEqual([{ number: 0, episodes: [1] }, { number: 1, episodes: [1, 2] }]);
  expect(a.episodeCount).toBe(3);
  expect((await capture([episode(1)])).digest).not.toBe(a.digest);
});

test('movies do not request episode pages; empty TV captures stay empty', async () => {
  const readPage = jest.fn();
  const movie = await capture([], { readIdentity: async () => ({ ...identity, mediaType: 'movie' }), readPage });
  expect(readPage).not.toHaveBeenCalled();
  expect(movie.episodeCount).toBe(0);
  expect(compareSourceCatalogLayout(movie, 10, { id: 10, title: 'Synthetic' })).toBe('movie_candidate_present');
  expect(compareSourceCatalogLayout(await capture([]), 10, details())).toBe('source_layout_empty');
});

test('accepts exact page/episode bound, including a short final page', async () => {
  const readPage = jest.fn(async ({ offset, limit }) => ({ offset, total: 2000,
    items: Array.from({ length: limit }, (_, i) => episode(offset + i + 1)) }));
  expect((await capture([], { readPage })).episodeCount).toBe(2000);
  expect(readPage).toHaveBeenCalledTimes(20);
  expect((await capture([], { readPage: async ({ offset }) => ({ offset, total: 101,
    items: Array.from({ length: offset ? 1 : 100 }, (_, i) => episode(offset + i + 1)) }) })).episodeCount).toBe(101);
});

test.each([
  { offset: 1, total: 1, items: [episode(1)] },
  { offset: null, total: 1, items: [episode(1)] },
  { offset: 0, total: null, items: [] },
  { offset: 0, total: 2001, items: [] },
  { offset: 0, total: -1, items: [] },
  { offset: 0, total: 1, items: [] },
  { offset: 0, total: 0, items: [episode(1)] },
  { offset: 0, total: 101, items: Array.from({ length: 101 }, (_, i) => episode(i)) },
])('refuses incomplete or unbounded pages: %j', async page => {
  await expect(capture([], { readPage: async () => page })).rejects.toThrow('source_layout_invalid');
});

test.each([
  [episode(1), episode(1)],
  [episode(1), { ...episode(1), id: 'other' }],
  [{ ...episode(1), id: '' }],
  [{ ...episode(1), id: '\n' }],
  [{ ...episode(1), id: 'x'.repeat(501) }],
  [{ ...episode(1), season: -1 }],
  [{ ...episode(1), episode: 10001 }],
  [{ ...episode(1), end: 2 }],
  [{ ...episode(1), episode: '1' }],
].map(items => [items]))('refuses ambiguous numbering or membership', async items => {
  await expect(capture(items)).rejects.toThrow('source_layout_invalid');
});

test('refuses changing totals and exhaustion without complete enumeration', async () => {
  await expect(capture([], { readPage: async ({ offset }) => ({ offset, total: offset ? 2 : 3,
    items: [episode(offset + 1)] }) })).rejects.toThrow('source_layout_invalid');
  await expect(capture([], { readPage: async ({ offset }) => ({ offset, total: 21,
    items: [episode(offset + 1)] }) })).rejects.toThrow('source_layout_invalid');
});

test('invalid identity and cancellation stop admission', async () => {
  const readPage = jest.fn();
  await expect(capture([], { readIdentity: async () => null, readPage })).rejects.toThrow('source_layout_invalid');
  const signal = AbortSignal.abort(new Error('cancelled'));
  await expect(capture([], { signal, readPage })).rejects.toThrow('cancelled');
  expect(readPage).not.toHaveBeenCalled();
});

test.each([
  [details(), 'equal_season_count_bounds'],
  [details([{ id: 11, season_number: 1, episode_count: 2 }]), 'within_season_count_bounds'],
  [details([{ id: 11, season_number: 2, episode_count: 1 }]), 'outside_season_count_bounds'],
  [details([]), 'outside_season_count_bounds'],
  [{ ...details(), id: 99 }, 'catalog_invalid'],
  [{ ...details(), name: '' }, 'catalog_invalid'],
  [{ ...details(), seasons: null }, 'catalog_invalid'],
  [details([{ id: 11, season_number: 1, episode_count: -1 }]), 'catalog_invalid'],
  [details([{ id: 11, season_number: 1, episode_count: 1 }, { id: 12, season_number: 1, episode_count: 1 }]), 'catalog_invalid'],
  [details([{ id: 11, season_number: 1, episode_count: 1 }, { id: 11, season_number: 2, episode_count: 1 }]), 'catalog_invalid'],
])('compares counts but never asserts identity', async (catalog, outcome) => {
  expect(compareSourceCatalogLayout(await capture(), 10, catalog)).toBe(outcome);
});
