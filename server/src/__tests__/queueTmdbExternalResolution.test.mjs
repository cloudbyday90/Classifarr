/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { QueueTmdbResolutionService } from '../services/queueTmdbResolutionService.mjs';
import { createMockLogger } from './helpers/mockFactory.mjs';

const payload = (extra = {}) => ({ itemId: 1, media_type: 'tv', title: 'Example', year: 2001, ...extra });
const bucket = (...ids) => ({ tv_results: ids.map((id) => ({ id })) });
function setup() {
  const tmdbService = {
    findIdentityByExternalId: jest.fn(), findByExternalId: jest.fn(),
    searchIdentityCandidates: jest.fn().mockResolvedValue({ page: 1, total_pages: 1, total_results: 1,
      results: [{ id: 999, name: 'Example', first_air_date: '2001-01-01' }] }),
  };
  const queryWithTimeout = jest.fn().mockResolvedValue({ rowCount: 1 });
  const logger = createMockLogger();
  return { tmdbService, queryWithTimeout, logger,
    svc: new QueueTmdbResolutionService({ tmdbService, queryWithTimeout, logger }) };
}

describe('external-ID uncertainty is terminal for queue resolution', () => {
  test.each([
    [bucket(42, 43), 'ambiguous_external_id'], [bucket(42, '042'), 'duplicate_external_results'],
    [bucket(42, 0), 'invalid_response'], [{}, 'invalid_response'],
    [bucket(...Array.from({ length: 21 }, (_, index) => index + 1)), 'external_result_limit'],
  ])('cannot replace uncertain results with a title ID: %j', async (response, reason) => {
    const { svc, tmdbService, queryWithTimeout } = setup();
    tmdbService.findIdentityByExternalId.mockResolvedValue(response);
    const metadata = { tmdb_resolution: { status: 'resolved', reason: 'old' } };
    expect(await svc.resolveAndBackfill(payload({ tvdb_id: 123, imdb_id: 'tt456' }), metadata)).toBeNull();
    expect(metadata.tmdb_resolution).toEqual({ version: 1, status: 'review_required', method: 'tvdb', reason });
    expect(tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
    expect(tmdbService.searchIdentityCandidates).not.toHaveBeenCalled();
    expect(tmdbService.findByExternalId).not.toHaveBeenCalled();
    expect(queryWithTimeout).not.toHaveBeenCalled();
  });

  test.each(['tvdb_id', 'imdb_id'])('provider failure on %s remains review-required with bounded diagnostics', async (source) => {
    const { svc, tmdbService, queryWithTimeout, logger } = setup();
    tmdbService.findIdentityByExternalId.mockRejectedValue(new Error('api_key=private provider response'));
    const metadata = {};
    expect(await svc.resolveAndBackfill(payload({ [source]: source === 'tvdb_id' ? 123 : 'tt456' }), metadata)).toBeNull();
    expect(metadata.tmdb_resolution).toEqual({ version: 1, status: 'review_required',
      method: source === 'tvdb_id' ? 'tvdb' : 'imdb', reason: 'provider_unavailable' });
    expect(logger.debug.mock.calls).toEqual([['TMDB external identity evaluated', { reason: 'provider_unavailable' }]]);
    expect(tmdbService.searchIdentityCandidates).not.toHaveBeenCalled();
    expect(queryWithTimeout).not.toHaveBeenCalled();
  });

  test.each([
    [{ tvdb_id: 0 }, {}, 'invalid_external_id'],
    [{ imdb_id: '' }, {}, 'invalid_external_id'],
    [{ imdb_id: 'tt123' }, { omdb: { data: { type: 'series', imdbId: 'tt456' } } }, 'conflicting_external_ids'],
    [{ tvdb_id: 123 }, { omdb: { data: { type: 'series', imdbId: 'tt456', imdbID: 'bad' } } }, 'invalid_external_id'],
  ])('validates all declarations before the first request: %j', async (ids, metadata, reason) => {
    const { svc, tmdbService, queryWithTimeout } = setup();
    expect(await svc.resolveAndBackfill(payload(ids), metadata)).toBeNull();
    expect(metadata.tmdb_resolution.reason).toBe(reason);
    expect(tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
    expect(tmdbService.searchIdentityCandidates).not.toHaveBeenCalled();
    expect(queryWithTimeout).not.toHaveBeenCalled();
  });

  test.each([
    [bucket(42), bucket(43), 'conflicting_external_ids'],
    [bucket(42), bucket(), 'incomplete_external_evidence'],
    [bucket(), bucket(42), 'incomplete_external_evidence'],
  ])('requires all supplied identifiers to agree: %j / %j', async (tvdb, imdb, reason) => {
    const { svc, tmdbService, queryWithTimeout } = setup();
    tmdbService.findIdentityByExternalId.mockResolvedValueOnce(tvdb).mockResolvedValueOnce(imdb);
    const metadata = {};
    expect(await svc.resolveAndBackfill(payload({ tvdb_id: 123, imdb_id: 'tt456' }), metadata)).toBeNull();
    expect(metadata.tmdb_resolution).toEqual({ version: 1, status: 'review_required', method: 'external_ids', reason });
    expect(tmdbService.findIdentityByExternalId.mock.calls).toEqual([[123, 'tvdb_id'], ['tt456', 'imdb_id']]);
    expect(tmdbService.searchIdentityCandidates).not.toHaveBeenCalled();
    expect(queryWithTimeout).not.toHaveBeenCalled();
  });

  test('a successful first lookup cannot hide a later outage', async () => {
    const { svc, tmdbService, queryWithTimeout } = setup();
    tmdbService.findIdentityByExternalId.mockResolvedValueOnce(bucket(42)).mockRejectedValueOnce(new Error('private'));
    const metadata = {};
    expect(await svc.resolveAndBackfill(payload({ tvdb_id: 123, imdb_id: 'tt456' }), metadata)).toBeNull();
    expect(metadata.tmdb_resolution.reason).toBe('provider_unavailable');
    expect(tmdbService.searchIdentityCandidates).not.toHaveBeenCalled();
    expect(queryWithTimeout).not.toHaveBeenCalled();
  });
});

describe('resolved and absent external identity evidence', () => {
  test.each([
    [{ tvdb_id: 123 }, 'tvdb', 'external_id_match', 1],
    [{ imdb_id: 'tt456' }, 'imdb', 'external_id_match', 1],
    [{ tvdb_id: 123, imdb_id: 'tt456' }, 'external_ids', 'external_ids_agree', 2],
  ])('backfills only accepted identities: %j', async (ids, method, reason, calls) => {
    const { svc, tmdbService, queryWithTimeout } = setup();
    tmdbService.findIdentityByExternalId.mockResolvedValue(bucket(42));
    const metadata = {};
    expect(await svc.resolveAndBackfill(payload(ids), metadata)).toBe(42);
    expect(metadata.tmdb_resolution).toEqual({ version: 1, status: 'resolved', method, reason });
    expect(tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(calls);
    expect(tmdbService.searchIdentityCandidates).not.toHaveBeenCalled();
    expect(queryWithTimeout).toHaveBeenCalledWith(expect.stringContaining('tmdb_id IS NULL'), [42, 1, 'tv']);
  });

  test.each([{}, { tvdb_id: 123 }, { tvdb_id: 123, imdb_id: 'tt456' }])('allows conservative title resolution only when external evidence is absent: %j', async (ids) => {
    const { svc, tmdbService } = setup();
    tmdbService.findIdentityByExternalId.mockResolvedValue(bucket());
    const metadata = {};
    expect(await svc.resolveAndBackfill(payload(ids), metadata)).toBe(999);
    expect(tmdbService.searchIdentityCandidates).toHaveBeenCalledWith('Example', 'tv', 2001);
    expect(metadata.tmdb_resolution.reason).toBe('exact_title_year_match');
  });

  test('captures both external declarations and the source identity before lookup awaits', async () => {
    const { svc, tmdbService, queryWithTimeout } = setup();
    const item = payload({ tvdb_id: 123 });
    const metadata = { omdb: { data: { type: 'series', imdbId: 'tt456' } } };
    tmdbService.findIdentityByExternalId.mockImplementation(async () => {
      item.itemId = 2; item.media_type = 'movie'; item.imdb_id = 'tt999';
      metadata.omdb.data.imdbId = 'tt999';
      return bucket(42);
    });
    expect(await svc.resolveAndBackfill(item, metadata)).toBe(42);
    expect(tmdbService.findIdentityByExternalId.mock.calls).toEqual([[123, 'tvdb_id'], ['tt456', 'imdb_id']]);
    expect(queryWithTimeout).toHaveBeenCalledWith(expect.any(String), [42, 1, 'tv']);
  });

  test('existing source IDs are preserved without attempting conflicting external declarations', async () => {
    const { svc, tmdbService } = setup();
    const metadata = { tmdb_resolution: { status: 'review_required' } };
    expect(await svc.resolveAndBackfill(payload({ tvdb_id: 'bad', imdb_id: '' }), metadata, 77)).toBe(77);
    expect(metadata.tmdb_resolution.reason).toBe('identifier_available');
    expect(tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
    expect(tmdbService.searchIdentityCandidates).not.toHaveBeenCalled();
  });
});
