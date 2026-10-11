/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { copySourceCatalogScope } from '../services/sourceCatalogScopePlan.mjs';
import { scopeEvidencePlan, compareScopeEvidence, readScopeCatalog, scopeEvidenceDigest } from '../services/sourceScopeCatalogEvidence.mjs';
import { approvedScopeDocuments } from '../services/sourceMappingContract.mjs';

const edge = () => ({ sourceSeason: 1, sourceEpisode: 2, tmdbSeriesId: 10, tmdbSeason: 0, tmdbEpisode: 1, tmdbEpisodeId: 100 });
const scope = () => ({ kind: 'whole_work', tmdbId: 10, episodeMappings: [edge()] });
const episode = (number, ids = []) => ({ season: 1, episode: number, providerIds: { tmdb_id: ids, tvdb_id: [], imdb_id: [] } });
const source = () => ({ identity: { mediaType: 'tv' }, seasons: [{ number: 1 }], episodes: [episode(1, [101]), episode(2)] });
const catalog = () => new Map([[100, { seriesId: 10, season: 0, episode: 1 }], [101, { seriesId: 10, season: 1, episode: 1 }]]);
const compare = (data = source(), proposal = scope(), members = catalog()) => compareScopeEvidence(data, scopeEvidencePlan(data, proposal), members);

test('copies bounded human declarations without changing legacy scopes', () => {
  const input = scope(), copied = copySourceCatalogScope('tv', input);
  expect(copied).toEqual(input); input.episodeMappings[0].tmdbEpisodeId = 999;
  expect(copied.episodeMappings[0].tmdbEpisodeId).toBe(100);
  expect(copySourceCatalogScope('tv', { kind: 'whole_work', tmdbId: 10 })).toEqual({ kind: 'whole_work', tmdbId: 10 });
  expect(copySourceCatalogScope('movie', scope())).toBeNull();
});
test.each(['empty', 'limit', 'duplicate_source', 'duplicate_target', 'duplicate_id', 'foreign', 'negative', 'fraction', 'extra', 'missing', 'not_array'])('rejects %s declarations', mode => {
  const input = scope(), row = input.episodeMappings[0];
  if (mode === 'empty') input.episodeMappings = [];
  if (mode === 'limit') input.episodeMappings = Array.from({ length: 65 }, (_, i) => ({ ...edge(), sourceEpisode: i, tmdbEpisode: i, tmdbEpisodeId: i + 1 }));
  if (mode.startsWith('duplicate')) input.episodeMappings.push({ ...edge(),
    sourceEpisode: mode === 'duplicate_source' ? 2 : 3, tmdbEpisode: mode === 'duplicate_target' ? 1 : 2,
    tmdbEpisodeId: mode === 'duplicate_id' ? 100 : 102 });
  if (mode === 'foreign') row.tmdbSeriesId = 20;
  if (mode === 'negative') row.sourceEpisode = -1;
  if (mode === 'fraction') row.tmdbEpisodeId = 1.1;
  if (mode === 'extra') row.confirmed = true;
  if (mode === 'missing') delete row.tmdbEpisode;
  if (mode === 'not_array') input.episodeMappings = {};
  expect(copySourceCatalogScope('tv', input)).toBeNull();
});
test('separates declared-ID matches from human proposals and leaves source untouched', () => {
  const data = source(), before = structuredClone(data);
  expect(compare(data)).toEqual({ unit: 'episode', total: 2, matched: 2, operatorReviewed: 1, exclusions: [] });
  expect(data).toEqual(before);
  expect(compare(data, { kind: 'whole_work', tmdbId: 10 }).matched).toBe(1);
});
test.each(['missing_target', 'wrong_position', 'duplicate_effective', 'ambiguous', 'reused', 'partial'])('human rows do not bypass %s', mode => {
  const data = source(), members = catalog();
  if (mode === 'missing_target') members.delete(100);
  if (mode === 'wrong_position') members.get(100).episode = 9;
  if (mode === 'duplicate_effective') data.episodes[0].providerIds.tmdb_id = [100];
  if (mode === 'ambiguous') data.episodes[1].providerIds.tvdb_id = [1, 2];
  if (mode === 'reused') data.episodes.forEach(item => { item.providerIds.tvdb_id = [2]; });
  if (mode === 'partial') data.episodes.push(episode(3));
  expect(compare(data, scope(), members).matched).toBeLessThan(data.episodes.length);
});
test('unused source rows fail instead of approving a stale position', () => {
  const input = scope(); input.episodeMappings[0].sourceEpisode = 7;
  expect(() => scopeEvidencePlan(source(), input)).toThrow('episode_source_missing');
});
test('episode targets count toward the unchanged total season budget', () => {
  const data = source(); data.seasons = Array.from({ length: 32 }, (_, i) => ({ number: i + 1 }));
  expect(() => scopeEvidencePlan(data, scope())).toThrow('scope_limit');
});
function provider() {
  return { getIdentityDetails: jest.fn(async () => ({ id: 10, name: 'Synthetic', overview: 'Whole',
    seasons: [0, 1].map(n => ({ id: 50 + n, season_number: n, episode_count: 1 })) })),
  getIdentitySeasonDetails: jest.fn(async (_id, n) => ({ id: 50 + n, season_number: n, overview: `Season ${n}`,
    episodes: [{ id: 100 + n, show_id: 10, season_number: n, episode_number: 1, name: `Episode ${n}` }] })) };
}
test('reads each target season once and fingerprints human target titles', async () => {
  const p = provider(), plan = scopeEvidencePlan(source(), scope()), signal = new AbortController().signal;
  const read = await readScopeCatalog(plan, p, signal);
  expect(read.episodeReviews).toEqual([{ ...edge(), title: 'Episode 0' }]);
  expect(p.getIdentitySeasonDetails.mock.calls.map(call => call[1])).toEqual([0, 1]);
  const original = p.getIdentitySeasonDetails.getMockImplementation();
  p.getIdentitySeasonDetails.mockImplementation(async (...args) => { const data = await original(...args); data.episodes[0].name = 'Changed'; return data; });
  expect((await readScopeCatalog(plan, p, signal)).digest).not.toBe(read.digest);
});

test('legacy reordered season scopes retain their read order and fingerprint shape', async () => {
  const p = provider(), plan = { mediaType: 'tv', works: [10], edges: [
    { sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 1 },
    { sourceSeason: 2, tmdbSeriesId: 10, tmdbSeason: 0 },
  ] };
  const read = await readScopeCatalog(plan, p, new AbortController().signal);
  expect(p.getIdentitySeasonDetails.mock.calls.map(call => call[1])).toEqual([1, 0]);
  expect(read.digest).toBe(scopeEvidenceDigest({ details: read.details, seasons: read.seasons,
    episodes: [...read.catalog].sort(([a], [b]) => a - b) }));
});
test.each(['id', 'title', 'season'])('rejects an unverifiable target %s', async mode => {
  const p = provider(), input = scope();
  if (mode === 'id') input.episodeMappings[0].tmdbEpisodeId = 999;
  if (mode === 'season') input.episodeMappings[0].tmdbSeason = 9;
  if (mode === 'title') {
    const original = p.getIdentitySeasonDetails.getMockImplementation();
    p.getIdentitySeasonDetails.mockImplementation(async (...args) => { const data = await original(...args); data.episodes[0].name = ''; return data; });
  }
  await expect(readScopeCatalog(scopeEvidencePlan(source(), input), p, new AbortController().signal)).rejects.toThrow();
});
test('season documents contain only represented catalog seasons, including specials', async () => {
  const input = { kind: 'seasons', coverage: 'complete', sourceSeasonNumbers: [1],
    mappings: [{ sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 1 }], episodeMappings: [edge()] };
  const data = source(), read = await readScopeCatalog(scopeEvidencePlan(data, input), provider(), new AbortController().signal);
  expect(approvedScopeDocuments(input, 'tv', read, data).map(value => value.catalogScope.seasonNumber)).toEqual([0, 1]);
  data.episodes = [episode(2)];
  expect(approvedScopeDocuments(input, 'tv', read, data).map(value => value.catalogScope.seasonNumber)).toEqual([0]);
  expect(() => approvedScopeDocuments(input, 'tv', read)).toThrow();
});
