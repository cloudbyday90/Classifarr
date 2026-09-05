/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import { buildQueueExternalIdPlan, buildTmdbExternalIdRequest, decideTmdbExternalIdMatch } from '../services/tmdbExternalIdMatch.mjs';

describe('external-ID input contract', () => {
  test.each([0, '', 'bad', '../123', 2147483648, 1.5, true, {}])('rejects invalid TVDB ID %j', (id) => {
    expect(buildTmdbExternalIdRequest(id, 'tvdb_id')).toBeNull();
    expect(buildQueueExternalIdPlan({ media_type: 'tv', tvdb_id: id }, {}).reason).toBe('invalid_external_id');
  });
  test.each(['', 'TT123', 'tt', 'tt123 ', 'tt123\n', 'tt123/other', 'tt1234567890123', 123, false, {}])(
    'rejects invalid IMDb ID %j', (id) => {
      expect(buildTmdbExternalIdRequest(id, 'imdb_id')).toBeNull();
      expect(buildQueueExternalIdPlan({ media_type: 'movie', imdb_id: id }, {}).reason).toBe('invalid_external_id');
    });
  test('normalizes numeric TVDB IDs and retains exact IMDb strings', () => {
    expect(buildTmdbExternalIdRequest(' 00123 ', 'tvdb_id')).toEqual({ externalId: 123, source: 'tvdb_id' });
    expect(buildTmdbExternalIdRequest('tt00123', 'imdb_id')).toEqual({ externalId: 'tt00123', source: 'imdb_id' });
    expect(buildTmdbExternalIdRequest('tt00123', 'wikidata_id')).toBeNull();
  });
  test.each([{}, { media_type: 'person' }, { media_type: 'movie', media: { media_type: 'tv' } }])(
    'requires explicit consistent type: %j', (payload) => {
      expect(buildQueueExternalIdPlan({ ...payload, imdb_id: 'tt123' }, {}).reason).toBe('invalid_media_identity');
    });
  test('ignores TVDB on movie tasks and null external declarations', () => {
    expect(buildQueueExternalIdPlan({ media_type: 'movie', tvdb_id: 'bad', imdb_id: null }, {})).toEqual({
      mediaType: 'movie', reason: null, requests: [],
    });
  });
  test.each([
    ['tt123', { imdbId: 'tt456' }], [undefined, { imdbId: 'tt123', imdbID: 'tt456' }],
    ['tt123', { imdbId: 'tt123', imdbID: 'tt456' }],
  ])('rejects contradictory IMDb evidence without precedence: %j', (payloadId, omdbIds) => {
    expect(buildQueueExternalIdPlan({ media_type: 'tv', imdb_id: payloadId }, {
      omdb: { data: { type: 'series', ...omdbIds } },
    }).reason).toBe('conflicting_external_ids');
  });
  test('does not drop a malformed OMDb alias when another declaration is valid', () => {
    expect(buildQueueExternalIdPlan({ media_type: 'movie', imdb_id: 'tt123' }, {
      omdb: { data: { type: 'movie', imdbId: 'tt123', imdbID: '' } },
    }).reason).toBe('invalid_external_id');
  });
  test('captures matching declarations once and excludes wrong-type OMDb data', () => {
    const payload = { media_type: 'tv', tvdb_id: 123, imdb_id: 'tt456' };
    const metadata = { omdb: { data: { type: 'series', imdbId: 'tt456', imdbID: 'tt456' } } };
    const plan = buildQueueExternalIdPlan(payload, metadata);
    payload.tvdb_id = 999; metadata.omdb.data.imdbId = 'tt999';
    expect(plan.requests).toEqual([{ externalId: 123, source: 'tvdb_id' }, { externalId: 'tt456', source: 'imdb_id' }]);
    expect(Object.isFrozen(plan.requests)).toBe(true);
    expect(Object.isFrozen(plan.requests[0])).toBe(true);
    expect(buildQueueExternalIdPlan({ media_type: 'tv', imdb_id: 'tt456' }, {
      omdb: { data: { type: 'movie', imdbId: 'tt999' } },
    }).requests).toEqual([{ externalId: 'tt456', source: 'imdb_id' }]);
  });
});

describe('whole-bucket external-ID validation', () => {
  const decide = (results) => decideTmdbExternalIdMatch('tv', { tv_results: results });
  test.each(['movie', 'tv'])('selects only the requested %s object bucket', (type) => {
    expect(decideTmdbExternalIdMatch(type, { movie_results: [{ id: 111 }], tv_results: [{ id: 222 }] })).toEqual({
      status: 'resolved', tmdbId: type === 'movie' ? 111 : 222, reason: 'external_id_match',
    });
  });
  test.each([null, {}, [], { tv_results: null }, { movie_results: [] }, { tv_results: {} }])(
    'missing or malformed selected bucket requires review: %j', (response) => {
      expect(decideTmdbExternalIdMatch('tv', response).reason).toBe('invalid_response');
    });
  test('empty and unavailable evidence have different outcomes', () => {
    expect(decide([])).toEqual({ status: 'not_found', tmdbId: null, reason: 'external_id_not_found' });
    expect(decide(undefined)).toEqual({ status: 'review_required', tmdbId: null, reason: 'invalid_response' });
  });
  test.each([null, {}, { id: 0 }, { id: 'bad' }, { id: 2147483648 }, { id: 1, media_type: 'movie' }, { id: 1, media_type: null }])(
    'a malformed row cannot be filtered into uniqueness: %j', (row) => {
      for (const rows of [[{ id: 42 }, row], [row, { id: 42 }]]) {
        expect(decide(rows)).toEqual({ status: 'review_required', tmdbId: null, reason: 'invalid_response' });
      }
    });
  test('sparse arrays cannot resolve an absent ID', () => {
    expect(decide(new Array(1)).reason).toBe('invalid_response');
  });
  test('duplicate and distinct multiple identities both require review in any order', () => {
    expect(decide([{ id: 42 }, { id: '042' }]).reason).toBe('duplicate_external_results');
    for (const rows of [[{ id: 42 }, { id: 43 }], [{ id: 43 }, { id: 42 }]]) {
      expect(decide(rows)).toEqual({ status: 'review_required', tmdbId: null, reason: 'ambiguous_external_id' });
    }
  });
  test('bounds evaluation without accepting a truncated prefix', () => {
    expect(decide(Array.from({ length: 21 }, (_, index) => ({ id: index + 1 }))).reason).toBe('external_result_limit');
    expect(decide(Array.from({ length: 20 }, (_, index) => ({ id: index + 1 }))).reason).toBe('ambiguous_external_id');
  });
  test('does not mutate provider objects or consume other-type buckets', () => {
    const response = { tv_results: [{ id: '42', media_type: ' TV ' }], movie_results: 'irrelevant' };
    const before = structuredClone(response);
    expect(decideTmdbExternalIdMatch('tv', response).tmdbId).toBe(42);
    expect(response).toEqual(before);
    expect(decideTmdbExternalIdMatch('multi', response).reason).toBe('invalid_media_identity');
  });
});
