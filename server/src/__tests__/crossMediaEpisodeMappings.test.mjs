/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { copySourceCatalogScope, reviewSourceCatalogScopePlan } from '../services/sourceCatalogScopePlan.mjs';
import { scopeEvidencePlan, readScopeCatalog, compareScopeEvidence } from '../services/sourceScopeCatalogEvidence.mjs';
import { approvedScopeDocuments } from '../services/sourceMappingContract.mjs';

const exception = () => ({ sourceSeason: 1, sourceEpisode: 2, tmdbMovieId: 101 });
const scope = () => ({ kind: 'seasons', coverage: 'complete', sourceSeasonNumbers: [1],
  mappings: [{ sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 1 }], episodeMappings: [exception()] });
const source = () => ({ identity: { mediaType: 'tv' }, seasons: [{ number: 1 }],
  episodes: [1, 2].map(episode => ({ season: 1, episode,
    providerIds: { tmdb_id: episode === 1 ? [101] : [], tvdb_id: [], imdb_id: [] } })) });
const provider = () => ({
  getIdentityDetails: jest.fn(async (id, type) => type === 'movie'
    ? { id, title: 'Synthetic movie', release_date: '2026-01-01', overview: 'Never TV learning' }
    : { id, name: 'Synthetic series', seasons: [{ id: 51, season_number: 1, episode_count: 1 }] }),
  getIdentitySeasonDetails: jest.fn(async () => ({ id: 51, season_number: 1, overview: 'TV season evidence',
    episodes: [{ id: 101, show_id: 10, season_number: 1, episode_number: 1, name: 'TV episode' }] })),
});
const read = (p = provider(), data = source(), proposal = scope()) => readScopeCatalog(
  scopeEvidencePlan(data, proposal), p, new AbortController().signal);

test('copies a typed movie exception without confusing same-number episode IDs', async () => {
  const input = scope(); expect(copySourceCatalogScope('tv', input)).toEqual(input);
  const p = provider(), result = await read(p);
  expect(p.getIdentityDetails.mock.calls.map(call => call.slice(0, 2))).toEqual([[10, 'tv'], [101, 'movie']]);
  expect(result.episodeReviews).toEqual([{ ...exception(), title: 'Synthetic movie' }]);
  expect(compareScopeEvidence(source(), scopeEvidencePlan(source(), input), result.catalog))
    .toEqual({ unit: 'episode', total: 2, matched: 2, operatorReviewed: 1, exclusions: [] });
  expect(approvedScopeDocuments(input, 'tv', result, source())).toEqual([
    { catalogScope: { kind: 'season', tmdbSeriesId: 10, seasonNumber: 1 }, overview: 'TV season evidence' },
    { catalogScope: { kind: 'whole_work', mediaType: 'movie', tmdbId: 101 }, evidenceUse: 'review_only' },
  ]);
});

test.each(['whole_work', 'mixed_fields', 'unknown_field', 'duplicate_source', 'duplicate_movie', 'string', 'zero', 'unmapped'])('rejects invalid movie declaration: %s', mode => {
  const input = scope();
  if (mode === 'whole_work') { input.kind = 'whole_work'; input.tmdbId = 10; delete input.coverage; delete input.sourceSeasonNumbers; delete input.mappings; }
  if (mode === 'mixed_fields') input.episodeMappings[0].tmdbEpisodeId = 101;
  if (mode === 'unknown_field') input.episodeMappings[0].confirmed = true;
  if (mode === 'duplicate_source') input.episodeMappings.push({ sourceSeason: 1, sourceEpisode: 2, tmdbSeriesId: 10, tmdbSeason: 1, tmdbEpisode: 1, tmdbEpisodeId: 101 });
  if (mode === 'duplicate_movie') input.episodeMappings.push({ ...exception(), sourceEpisode: 3 });
  if (mode === 'string') input.episodeMappings[0].tmdbMovieId = '101';
  if (mode === 'zero') input.episodeMappings[0].tmdbMovieId = 0;
  if (mode === 'unmapped') input.episodeMappings[0].sourceSeason = 2;
  expect(copySourceCatalogScope('tv', input)).toBeNull();
});

test('movie and TV exception IDs have independent namespaces but source positions do not', async () => {
  const input = scope(); input.episodeMappings.push({ sourceSeason: 1, sourceEpisode: 1,
    tmdbSeriesId: 10, tmdbSeason: 1, tmdbEpisode: 1, tmdbEpisodeId: 101 });
  expect(copySourceCatalogScope('tv', input).episodeMappings).toHaveLength(2);
  const result = await read(provider(), source(), input);
  expect(compareScopeEvidence(source(), scopeEvidencePlan(source(), input), result.catalog).operatorReviewed).toBe(2);
});

test.each(['id', 'type', 'title'])('rejects invalid typed movie details: %s', async mode => {
  const p = provider(), original = p.getIdentityDetails.getMockImplementation();
  p.getIdentityDetails.mockImplementation(async (id, type) => {
    const data = await original(id, type);
    if (type === 'movie') { if (mode === 'id') data.id++; if (mode === 'type') data.media_type = 'tv'; if (mode === 'title') delete data.title; }
    return data;
  });
  await expect(read(p)).rejects.toThrow();
});

test('movie title changes change evidence; a missing typed target cannot count as covered', async () => {
  const p = provider(), first = await read(p), original = p.getIdentityDetails.getMockImplementation();
  p.getIdentityDetails.mockImplementation(async (id, type) => ({ ...await original(id, type), ...(type === 'movie' ? { title: 'Changed movie' } : {}) }));
  expect((await read(p)).digest).not.toBe(first.digest);
  first.catalog.delete('movie:101');
  expect(compareScopeEvidence(source(), scopeEvidencePlan(source(), scope()), first.catalog).matched).toBe(1);
  expect(() => approvedScopeDocuments(scope(), 'tv', first, source())).toThrow();
});

test.each(['ambiguous', 'reused', 'incomplete'])('movie exceptions preserve %s source guards', async mode => {
  const data = source();
  if (mode === 'ambiguous') data.episodes[1].providerIds.tvdb_id = [8, 9];
  if (mode === 'reused') data.episodes.forEach(item => { item.providerIds.tvdb_id = [8]; });
  if (mode === 'incomplete') data.episodes.push({ ...data.episodes[1], episode: 3 });
  const result = await read(provider(), data);
  expect(compareScopeEvidence(data, scopeEvidencePlan(data, scope()), result.catalog).matched).toBeLessThan(data.episodes.length);
});

test('movie reads count toward the total work and document limits before HTTP', () => {
  const input = scope(), data = source();
  input.episodeMappings = [1, 2, 3, 4].map(n => ({ sourceSeason: 1, sourceEpisode: n, tmdbMovieId: n }));
  expect(() => scopeEvidencePlan(data, input)).toThrow('scope_limit');
  input.episodeMappings = [exception()];
  input.sourceSeasonNumbers = Array.from({ length: 32 }, (_, i) => i + 1);
  input.mappings = input.sourceSeasonNumbers.map(n => ({ sourceSeason: n, tmdbSeriesId: 10, tmdbSeason: n }));
  data.seasons = input.sourceSeasonNumbers.map(number => ({ number }));
  expect(() => scopeEvidencePlan(data, input)).toThrow('scope_limit');
});

test('structural summaries count movie and TV namespaces separately without authorizing work', () => {
  const proposal = scope(); proposal.episodeMappings[0].tmdbMovieId = 10;
  const result = reviewSourceCatalogScopePlan({ version: 'source_catalog_scope_plan.v1', intent: 'preserve_source_grouping',
    source: { mediaServerId: 1, externalId: 'synthetic', mediaType: 'tv', identityDigest: 'a'.repeat(64) }, scope: proposal });
  expect(result).toMatchObject({ canApply: false, verification: 'structure_only', summary: { targetWorks: 2 } });
});

test('cancellation during the movie read cannot return a usable preview', async () => {
  const p = provider(), controller = new AbortController(), original = p.getIdentityDetails.getMockImplementation();
  p.getIdentityDetails.mockImplementation(async (id, type) => {
    if (type === 'movie') controller.abort();
    return original(id, type);
  });
  await expect(readScopeCatalog(scopeEvidencePlan(source(), scope()), p, controller.signal)).rejects.toThrow();
});
