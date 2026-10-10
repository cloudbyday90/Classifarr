/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { compareScopeEvidence, readScopeCatalog, scopeEvidencePlan } from '../services/sourceScopeCatalogEvidence.mjs';

const ids = (tmdb = [], tvdb = [], imdb = []) => ({ tmdb_id: tmdb, tvdb_id: tvdb, imdb_id: imdb });
const episode = (season, number, tmdb = [], tvdb = []) => ({ season, episode: number, providerIds: ids(tmdb, tvdb) });
const source = () => ({ identity: { mediaType: 'tv', providerIds: ids([], [7, 8]) },
  seasons: [0, 1, 2].map(number => ({ number })), episodes: [episode(1, 1, [101])] });
const scope = () => ({ kind: 'seasons', coverage: 'partial', sourceSeasonNumbers: [2, 0, 1],
  mappings: [{ sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 5 }] });
const catalog = () => new Map([[101, { seriesId: 10, season: 5, episode: 1 }]]);

test('preserves an explicitly remapped season without changing parent identity', () => {
  const data = source(), before = structuredClone(data);
  expect(compareScopeEvidence(data, scopeEvidencePlan(data, scope()), catalog())).toEqual({ unit: 'episode', total: 1, matched: 1, exclusions: [] });
  expect(data).toEqual(before);
});
test('refuses undeclared source seasons even when the draft claims completeness', () => {
  const input = scope(); input.sourceSeasonNumbers = [1]; input.coverage = 'complete';
  expect(() => scopeEvidencePlan(source(), input)).toThrow('source_seasons_changed');
});
test('bounds works and season reads independently of structural draft validity', () => {
  const data = source(); data.seasons = Array.from({ length: 33 }, (_, number) => ({ number }));
  expect(() => scopeEvidencePlan(data, { kind: 'whole_work', tmdbId: 10 })).toThrow('scope_limit');
  const input = { kind: 'seasons', coverage: 'complete', sourceSeasonNumbers: [0, 1, 2, 3, 4],
    mappings: [0, 1, 2, 3, 4].map(number => ({ sourceSeason: number, tmdbSeriesId: number + 10, tmdbSeason: 1 })) };
  data.seasons = input.sourceSeasonNumbers.map(number => ({ number }));
  expect(() => scopeEvidencePlan(data, input)).toThrow('scope_limit');
  expect(() => scopeEvidencePlan(data, {})).toThrow('invalid_scope');
});
test.each([
  [episode(0, 1, [101]), 'unmapped_season'],
  [episode(1, 1, [101, 102]), 'ambiguous_episode_ids'],
  [episode(1, 1, [101], [7, 8]), 'ambiguous_episode_ids'],
  [episode(1, 1), 'missing_tmdb_episode_id'],
  [episode(1, 1, [999]), 'episode_absent_from_scope'],
  [episode(1, 2, [101]), 'episode_numbering_differs'],
])('excludes an unsupported episode: %s', (item, reason) => {
  const data = source(); data.episodes = [item];
  expect(compareScopeEvidence(data, scopeEvidencePlan(data, scope()), catalog())).toMatchObject({ matched: 0,
    exclusions: [{ season: item.season, episode: item.episode, reason }] });
});
test('rejects IDs reused across mapped and unmapped seasons, including other providers', () => {
  const data = source(); data.episodes = [episode(1, 1, [101], [7]), episode(0, 1, [102], [7])];
  expect(compareScopeEvidence(data, scopeEvidencePlan(data, scope()), catalog()).exclusions.map(item => item.reason))
    .toEqual(['reused_episode_id', 'unmapped_season']);
});
test('catalog membership in a different target is not accepted', () => {
  const members = catalog(); members.get(101).seriesId = 20;
  expect(compareScopeEvidence(source(), scopeEvidencePlan(source(), scope()), members).exclusions[0].reason).toBe('episode_outside_mapping');
});
test.each([[[10], 1], [[10, 20], 0], [[], 0]])('movie declarations are typed, never selected by title', (tmdb, matched) => {
  const data = { identity: { mediaType: 'movie', providerIds: ids(tmdb) } };
  expect(compareScopeEvidence(data, scopeEvidencePlan(data, { kind: 'whole_work', tmdbId: 10 }), new Map()))
    .toMatchObject({ unit: 'movie', total: 1, matched });
});
const provider = () => ({ getIdentityDetails: jest.fn(async () => ({ id: 10, name: 'Fixture', seasons: [{ id: 50, season_number: 5, episode_count: 1 }] })),
  getIdentitySeasonDetails: jest.fn(async () => ({ id: 50, season_number: 5, episodes: [{ id: 101, show_id: 10, season_number: 5, episode_number: 1 }] })) });
const read = p => readScopeCatalog(scopeEvidencePlan(source(), scope()), p, new AbortController().signal);
test('uses complete typed season membership and stable order-independent digests', async () => {
  const p = provider(); const result = await read(p);
  expect(result.catalog).toEqual(catalog()); expect((await read(p)).digest).toBe(result.digest);
  expect(p.getIdentitySeasonDetails).toHaveBeenCalledWith(10, 5, expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
test.each(['wrong_type', 'missing_season', 'too_many', 'incomplete', 'wrong_parent', 'duplicate'])('rejects invalid catalog %s', async kind => {
  const p = provider();
  if (kind === 'wrong_type') p.getIdentityDetails.mockResolvedValue({ id: 10, title: 'Movie' });
  if (kind === 'missing_season') p.getIdentityDetails.mockResolvedValue({ id: 10, name: 'Fixture', seasons: [] });
  if (kind === 'too_many') {
    const data = source(); data.seasons = [{ number: 1 }, { number: 2 }];
    p.getIdentityDetails.mockResolvedValue({ id: 10, name: 'Fixture', seasons: [1, 2].map(n => ({ id: n, season_number: n, episode_count: 6000 })) });
    p.getIdentitySeasonDetails.mockImplementation(async (_id, n) => ({ id: n, season_number: n,
      episodes: Array.from({ length: 6000 }, (_, i) => ({ id: i + 1, show_id: 10, season_number: n, episode_number: i })) }));
    await expect(readScopeCatalog(scopeEvidencePlan(data, { kind: 'whole_work', tmdbId: 10 }), p, new AbortController().signal)).rejects.toThrow('catalog_scope_limit');
    expect(p.getIdentitySeasonDetails).toHaveBeenCalledTimes(1); return;
  }
  if (kind === 'incomplete') p.getIdentitySeasonDetails.mockResolvedValue({ id: 50, season_number: 5, episodes: [] });
  if (kind === 'wrong_parent') p.getIdentitySeasonDetails.mockResolvedValue({ id: 50, season_number: 5, episodes: [{ id: 101, show_id: 20, season_number: 5, episode_number: 1 }] });
  if (kind === 'duplicate') p.getIdentityDetails.mockResolvedValue({ id: 10, name: 'Fixture', seasons: [{ id: 50, season_number: 5, episode_count: 1 }, { id: 50, season_number: 5, episode_count: 1 }] });
  await expect(read(p)).rejects.toThrow();
});
test('aborts before catalog I/O and accepts typed movie details without season reads', async () => {
  const p = provider(), controller = new AbortController(); controller.abort();
  await expect(readScopeCatalog({ works: [10], mediaType: 'movie', edges: [] }, p, controller.signal)).rejects.toThrow();
  expect(p.getIdentityDetails).not.toHaveBeenCalled();
  p.getIdentityDetails.mockResolvedValue({ id: 10, title: 'Fixture' });
  await readScopeCatalog({ works: [10], mediaType: 'movie', edges: [] }, p, new AbortController().signal);
  expect(p.getIdentitySeasonDetails).not.toHaveBeenCalled();
});
