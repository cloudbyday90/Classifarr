/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { candidateDeclarations, candidateMatches, readSourceCandidates } from '../services/sourceCandidateProjection.mjs';
const source = () => ({ mediaType: 'tv', snapshotDigest: 'a'.repeat(64), providerIds: { tmdb_id: [10], imdb_id: ['tt123'], tvdb_id: [20, 30] } });
const matches = (ids = []) => ({ movie_results: [], tv_results: ids.map(id => ({ id })), tv_season_results: [], tv_episode_results: [], person_results: [] });
const signal = () => new AbortController().signal;
const provider = () => ({ findIdentityByExternalId: jest.fn(async () => matches([10, 11])),
  getIdentityDetails: jest.fn(async id => ({ id, name: `Show ${id}`, first_air_date: '2020-01-01' })) });

test('deduplicates typed candidates and retains every identifier provenance', async () => {
  const p = provider(), result = await readSourceCandidates(source(), p, signal());
  expect(result.candidates.map(x => x.tmdbId)).toEqual([10, 11]);
  expect(result.candidates[0]).toEqual({ tmdbId: 10, mediaType: 'tv', title: 'Show 10', releaseDate: '2020-01-01', available: true, lookupIndexes: [0, 1, 2, 3] });
  expect(result.candidates[1].lookupIndexes).toEqual([1, 2, 3]);
  expect(p.getIdentityDetails).toHaveBeenCalledTimes(2);
  expect(result.lookups.map(x => x.status)).toEqual(['declared', 'matched', 'matched', 'matched']);
});
test.each(['empty', 'episode', 'movie', 'person', 'season'])('never promotes %s results into a series', async kind => {
  const data = matches();
  if (kind !== 'empty') data[{ episode: 'tv_episode_results', movie: 'movie_results', person: 'person_results', season: 'tv_season_results' }[kind]] = [{ id: 999 }];
  const s = source(); s.providerIds = { tmdb_id: [], imdb_id: ['tt123'], tvdb_id: [] };
  const p = provider(); p.findIdentityByExternalId.mockResolvedValue(data);
  const result = await readSourceCandidates(s, p, signal());
  expect(result.candidates).toEqual([]); expect(p.getIdentityDetails).not.toHaveBeenCalled();
  expect(result.lookups[0].status).toBe(kind === 'empty' ? 'no_match' : 'other_scope');
});
test('movie lookup skips unsupported TVDB while retaining its declaration', async () => {
  const s = source(); s.mediaType = 'movie'; s.providerIds = { tmdb_id: [], imdb_id: [], tvdb_id: [20] };
  const p = provider(); expect((await readSourceCandidates(s, p, signal())).lookups[0].status).toBe('unsupported');
  expect(p.findIdentityByExternalId).not.toHaveBeenCalled();
});
test('404 is explicit absence; malformed details are not absence', async () => {
  const p = provider(); p.findIdentityByExternalId.mockRejectedValue({ response: { status: 404 } });
  p.getIdentityDetails.mockRejectedValue({ response: { status: 404 } });
  const result = await readSourceCandidates(source(), p, signal());
  expect(result.candidates[0]).toMatchObject({ available: false, title: null, releaseDate: null });
  expect(result.lookups[1].status).toBe('no_match');
  p.getIdentityDetails.mockResolvedValue(undefined);
  await expect(readSourceCandidates(source(), p, signal())).rejects.toThrow();
});
test.each([null, {}, { mediaType: 'episode' }, { ...source(), snapshotDigest: null },
  { ...source(), providerIds: { tmdb_id: [1, 1], imdb_id: [], tvdb_id: [] } },
  { ...source(), providerIds: { tmdb_id: [-1], imdb_id: [], tvdb_id: [] } },
  { ...source(), providerIds: { tmdb_id: [], imdb_id: ['https://bad'], tvdb_id: [] } },
  { ...source(), providerIds: { tmdb_id: [1, 2, 3, 4, 5, 6, 7, 8], imdb_id: ['tt1'], tvdb_id: [] } },
])('rejects malformed or unbounded source %j', value => { expect(() => candidateDeclarations(value)).toThrow(); });
test.each([null, {}, { ...matches(), tv_results: [{ id: 0 }] }, { ...matches(), tv_results: [{ id: 1 }, { id: 1 }] },
  { ...matches(), tv_results: [{ id: 1, media_type: 'movie' }] }, { ...matches(), tv_results: Array.from({ length: 21 }, (_, id) => ({ id: id + 1 })) },
])('rejects malformed catalog %j', data => { expect(() => candidateMatches(data, 'tv')).toThrow(); });
test('bounds total results and unique detail reads before partial return', async () => {
  expect(() => candidateMatches({ ...matches(Array.from({ length: 20 }, (_, i) => i + 1)), movie_results: [{ id: 99 }] }, 'tv')).toThrow();
  const p = provider(); p.findIdentityByExternalId.mockResolvedValue(matches(Array.from({ length: 9 }, (_, i) => i + 1)));
  await expect(readSourceCandidates(source(), p, signal())).rejects.toMatchObject({ code: 'lookup_limit' });
  expect(p.getIdentityDetails).not.toHaveBeenCalled();
});
test.each([429, 500])('does not return partial success on provider %s', async status => {
  const p = provider(); p.findIdentityByExternalId.mockRejectedValue({ status });
  await expect(readSourceCandidates(source(), p, signal())).rejects.toEqual({ status });
  p.findIdentityByExternalId.mockResolvedValue(matches()); p.getIdentityDetails.mockRejectedValue({ status });
  await expect(readSourceCandidates(source(), p, signal())).rejects.toEqual({ status });
});
test('cancellation rejects late provider responses', async () => {
  const p = provider(), controller = new AbortController();
  p.findIdentityByExternalId.mockImplementation(async () => { controller.abort(); return matches(); });
  await expect(readSourceCandidates(source(), p, controller.signal)).rejects.toThrow();
  expect(p.getIdentityDetails).not.toHaveBeenCalled();
});
