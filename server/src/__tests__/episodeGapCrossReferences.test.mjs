/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { inspectEpisodeGapReferences } from '../services/episodeGapCrossReferenceInspection.mjs';
import { inspectEpisodeExternalIdResponse } from '../services/episodeExternalIdEvidence.mjs';
import { findTmdbIdentityByExternalId } from '../services/tmdbIdentitySearch.mjs';
import { httpGet } from '../utils/httpClient.mjs';
import { createIdentityHttpFixture, withinIdentityTestDeadline } from './helpers/identityHttpFixture.mjs';

const episode = (ids = {}) => ({ season: 1, episode: 1, providerIds: { tmdb_id: [], imdb_id: ['tt123'], tvdb_id: [21], ...ids } });
const member = { seriesId: 10, season: 1, episode: 1 };
const payload = (overrides = {}) => ({ tv_episode_results: [{ id: 100, show_id: 10, season_number: 1, episode_number: 1, ...overrides }] });
function setup(episodes = [episode()], catalog = new Map([[100, member]])) {
  const source = { episodes, identity: { providerIds: { tmdb_id: [10] } } };
  const tmdb = { findIdentityByExternalId: jest.fn().mockResolvedValue(payload()) };
  const budget = { remainingLookups: 128 }, controller = new AbortController();
  return { tmdb, source, budget, controller, run: () => inspectEpisodeGapReferences(source, catalog, tmdb, { signal: controller.signal, budget }) };
}

test('checks only gaps using declared IDs and outputs aggregate evidence without activation', async () => {
  const t = setup([episode(), { ...episode({ tmdb_id: [100], imdb_id: ['tt456'], tvdb_id: [22] }), episode: 2 }]);
  expect(await t.run()).toEqual({ gapLookups: 2, gapComparisons: { candidate_agrees: 1 } });
  expect(t.tmdb.findIdentityByExternalId.mock.calls.map(([id, field]) => [id, field])).toEqual([['tt123', 'imdb_id'], [21, 'tvdb_id']]);
  expect(t.budget.remainingLookups).toBe(126);
});
test.each([
  [{ imdb_id: [], tvdb_id: [] }, 'no_external_ids'],
  [{ imdb_id: ['tt123', 'tt456'] }, 'external_ids_ambiguous'],
])('unusable declarations do no provider work', async (ids, code) => {
  const t = setup([episode(ids)]);
  expect(await t.run()).toEqual({ gapLookups: 0, gapComparisons: { [code]: 1 } });
  expect(t.tmdb.findIdentityByExternalId).not.toHaveBeenCalled();
});
test.each(['imdb_id', 'tvdb_id', 'tmdb_id'])('reused %s is not independent identity evidence', async field => {
  const a = episode({ imdb_id: [], tvdb_id: [] }), b = episode({ imdb_id: [], tvdb_id: [] });
  a.providerIds.imdb_id = ['tt123']; b.providerIds.tvdb_id = [22];
  const value = field === 'imdb_id' ? 'tt567' : 999;
  a.providerIds[field] = [value]; b.providerIds[field] = [value];
  const t = setup([a, { ...b, episode: 2 }]);
  expect((await t.run()).gapComparisons).toEqual({ source_id_reused: 2 });
  expect(t.tmdb.findIdentityByExternalId).not.toHaveBeenCalled();
});
test('IDs reused by an already matched episode are still refused', async () => {
  const t = setup([episode(), episode({ tmdb_id: [100] })]);
  expect((await t.run()).gapComparisons).toEqual({ source_id_reused: 1 });
});
test.each([
  [{ tv_episode_results: [] }, 'no_typed_matches'],
  [{ tv_episode_results: [], tv_results: [{ id: 100 }] }, 'other_media_only'],
  [{ tv_episode_results: [...payload().tv_episode_results, ...payload({ id: 200 }).tv_episode_results] }, 'ambiguous_matches'],
  [payload({ show_id: 99 }), 'match_outside_candidates'],
  [payload({ id: 200 }), 'catalog_membership_disagrees'],
  [payload({ season_number: 2 }), 'catalog_membership_disagrees'],
])('keeps missing, wrong-type and disagreeing evidence distinct', async (response, code) => {
  const t = setup(); t.tmdb.findIdentityByExternalId.mockResolvedValue(response);
  expect((await t.run()).gapComparisons).toEqual({ [code]: 1 });
});
test.each([
  [payload({ id: 200 }), 'conflicting_matches'],
  [payload({ season_number: 2 }), 'conflicting_matches'],
  [{ tv_episode_results: [] }, 'agreement_with_missing_mapping'],
  [{ tv_episode_results: [], movie_results: [{ id: 100 }] }, 'agreement_with_other_media_mapping'],
])('never hides a disagreeing or missing second mapping', async (second, code) => {
  const t = setup(); t.tmdb.findIdentityByExternalId.mockResolvedValueOnce(payload()).mockResolvedValueOnce(second);
  expect((await t.run()).gapComparisons).toEqual({ [code]: 1 });
});
test('an absent source TMDb ID is not silently replaced by independent results', async () => {
  const t = setup([episode({ tmdb_id: [999] })]);
  expect((await t.run()).gapComparisons).toEqual({ source_episode_id_disagrees: 1 });
});
test('known catalog membership with different source numbering stays explicit', async () => {
  const t = setup([{ ...episode(), season: 3 }]);
  expect((await t.run()).gapComparisons).toEqual({ numbering_differs: 1 });
});
test.each([
  null, [], {}, { tv_episode_results: null }, { tv_episode_results: new Array(1) },
  payload({ id: 0 }), payload({ show_id: null }), payload({ season_number: -1 }), payload({ episode_number: '1' }),
  { ...payload(), movie_results: null }, { ...payload(), tv_results: [{ id: '100' }] },
  { ...payload(), person_results: Array.from({ length: 21 }, () => ({ id: 1 })) },
])('rejects malformed provider data, not a negative match', response => {
  expect(() => inspectEpisodeExternalIdResponse(response)).toThrow('episode_references_invalid');
});
test.each([null, { tmdb_id: [], imdb_id: ['not-an-id'], tvdb_id: [] }])('invalid source evidence never starts HTTP', async providerIds => {
  const t = setup([{ ...episode(), providerIds }]);
  expect(await t.run()).toEqual({ outcome: 'episode_references_invalid' });
  expect(t.tmdb.findIdentityByExternalId).not.toHaveBeenCalled();
});
test('group and shared request limits refuse complete scope before HTTP', async () => {
  const t = setup(); t.budget.remainingLookups = 1;
  expect(await t.run()).toEqual({ outcome: 'episode_reference_limit' });
  expect(t.budget.remainingLookups).toBe(1);
  const many = setup(Array.from({ length: 33 }, (_, i) => ({ ...episode({ imdb_id: [`tt${i + 100}`], tvdb_id: [i + 100] }), episode: i })));
  expect(await many.run()).toEqual({ outcome: 'episode_reference_limit' });
  expect(many.tmdb.findIdentityByExternalId).not.toHaveBeenCalled();
  t.budget.remainingLookups = NaN;
  expect(await t.run()).toEqual({ outcome: 'episode_reference_limit' });
});
test.each(['unavailable', 'invalid'])('late %s response discards partial matches and charges attempted reads', async kind => {
  const t = setup(); t.tmdb.findIdentityByExternalId.mockResolvedValueOnce(payload());
  if (kind === 'unavailable') t.tmdb.findIdentityByExternalId.mockRejectedValueOnce(new Error('private token URL'));
  else t.tmdb.findIdentityByExternalId.mockResolvedValueOnce({});
  expect(await t.run()).toEqual({ outcome: `episode_references_${kind}` });
  expect(t.budget.remainingLookups).toBe(126);
});
test.each(['before', 'response'])('cancellation at %s starts no further requests', async stage => {
  const t = setup();
  if (stage === 'before') t.controller.abort();
  else t.tmdb.findIdentityByExternalId.mockImplementation(async () => { t.controller.abort(); return payload(); });
  await expect(t.run()).rejects.toThrow();
  expect(t.tmdb.findIdentityByExternalId).toHaveBeenCalledTimes(stage === 'before' ? 0 : 1);
});
test('provider awaits cannot rewrite copied declarations or candidate scope', async () => {
  const t = setup(); t.tmdb.findIdentityByExternalId.mockImplementation(async () => {
    t.source.episodes[0].providerIds.tvdb_id[0] = 999;
    t.source.identity.providerIds.tmdb_id[0] = 999;
    return payload();
  });
  expect((await t.run()).gapComparisons).toEqual({ candidate_agrees: 1 });
  expect(t.tmdb.findIdentityByExternalId.mock.calls[1][0]).toBe(21);
});

test.each(['valid', 'malformed', 'oversized', 'cancelled'])('real bounded Find HTTP: %s', async mode => {
  const body = mode === 'valid' ? payload() : mode === 'malformed' ? { tv_episode_results: null }
    : mode === 'oversized' ? { private: 'x'.repeat(1048577) } : null;
  const f = await createIdentityHttpFixture(body), t = setup();
  t.tmdb.findIdentityByExternalId.mockImplementation((id, field, options) => findTmdbIdentityByExternalId(id, field, {
    baseUrl: f.url, httpGet, getApiKey: async () => 'synthetic', executeRateLimited: fn => fn(),
  }, options));
  try {
    const pending = t.run();
    if (mode === 'cancelled') {
      const rejected = expect(pending).rejects.toThrow();
      await withinIdentityTestDeadline(f.received); t.controller.abort();
      await withinIdentityTestDeadline(rejected); await withinIdentityTestDeadline(f.disconnected);
    } else {
      const result = await withinIdentityTestDeadline(pending);
      if (mode === 'valid') expect(result.gapComparisons).toEqual({ candidate_agrees: 1 });
      else expect(result).toEqual({ outcome: `episode_references_${mode === 'malformed' ? 'invalid' : 'unavailable'}` });
    }
    expect(f.requests).toBe(mode === 'valid' ? 2 : 1);
  } finally { await f.close(); }
});
