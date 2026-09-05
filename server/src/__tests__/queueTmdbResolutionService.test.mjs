/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';

import { QueueTmdbResolutionService } from '../services/queueTmdbResolutionService.mjs';

import { createMockLogger } from './helpers/mockFactory.mjs';
const makeTmdbService = () => ({
  findByExternalId: jest.fn(),
  search: jest.fn()
});
const makeQueryWithTimeout = () => jest.fn();

describe('typed provider boundary', () => {
  test.each([{}, { media_type: 'person' }, { media_type: 'tv', media: { media_type: 'movie' } }])(
    'rejects invalid type before provider access or backfill: %j', async (declaration) => {
      const tmdbService = makeTmdbService();
      const queryWithTimeout = makeQueryWithTimeout();
      const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService, queryWithTimeout });
      const payload = { title: 'Example', tvdb_id: 12, imdb_id: 'tt1234', itemId: 1, ...declaration };
      expect(await svc.resolveFromTvdb(payload)).toBeNull();
      expect(await svc.resolveFromImdb(payload, {})).toBeNull();
      expect(await svc.resolveFromTitle(payload)).toBeNull();
      expect(await svc.resolveAndBackfill(payload, {}, 42)).toBeNull();
      expect(tmdbService.findByExternalId).not.toHaveBeenCalled();
      expect(tmdbService.search).not.toHaveBeenCalled();
      expect(queryWithTimeout).not.toHaveBeenCalled();
    });

  test.each([['tv', 222], ['movie', 111]])('IMDb selects only the %s bucket even when both exist', async (mediaType, expected) => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValue({ movie_results: [{ id: 111 }], tv_results: [{ id: 222 }] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromImdb({ imdb_id: 'tt1234', media_type: mediaType }, {})).toBe(expected);
  });

  test('a movie never consumes TVDB TV results or falls back to an IMDb TV bucket', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValue({ tv_results: [{ id: 222 }] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    const payload = { media_type: 'movie', tvdb_id: 123, imdb_id: 'tt1234' };
    expect(await svc.resolveFromTvdb(payload)).toBeNull();
    expect(tmdbService.findByExternalId).not.toHaveBeenCalled();
    expect(await svc.resolveFromImdb(payload, {})).toBeNull();
  });

  test('filters wrong-type and malformed title results before ranking', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.search.mockResolvedValue([
      { id: 99, title: 'Example', media_type: 'movie' },
      { id: 'bad', title: 'Example', media_type: 'tv' },
      { id: 0, title: 'Example', media_type: 'tv' },
      { id: 42, title: 'Example', media_type: 'tv' },
    ]);
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTitle({ title: 'Example', media_type: ' TV ' })).toBe(42);
    expect(tmdbService.search).toHaveBeenCalledWith('Example', 'tv');
  });

  test('captured type and item ID survive caller mutation during resolution', async () => {
    const payload = { title: 'Example', itemId: 1, media_type: 'tv' };
    const tmdbService = makeTmdbService();
    tmdbService.search.mockImplementation(async () => {
      payload.itemId = 2; payload.media_type = 'movie';
      return [{ id: 42, title: 'Example', media_type: 'tv' }];
    });
    const queryWithTimeout = makeQueryWithTimeout();
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService, queryWithTimeout });
    expect(await svc.resolveAndBackfill(payload, {})).toBe(42);
    expect(queryWithTimeout).toHaveBeenCalledWith(expect.stringContaining('media_type = $3'), [42, 1, 'tv']);
  });

  test.each([0, '', 'bad', 2147483648])('malformed current TMDb ID %j cannot trigger guessing', async (id) => {
    const tmdbService = makeTmdbService();
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveAndBackfill({ title: 'Example', media_type: 'tv' }, {}, id)).toBeNull();
    expect(tmdbService.search).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// resolveFromTvdb
// ---------------------------------------------------------------------------

describe('resolveFromTvdb', () => {
  test('returns null when no tvdb_id in payload', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    expect(await svc.resolveFromTvdb({ title: 'Show', media_type: 'tv' })).toBeNull();
  });

  test('returns tmdb_id from tv_results', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValueOnce({ tv_results: [{ id: 5555 }] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTvdb({ tvdb_id: 123, title: 'Show', media_type: 'tv' })).toBe(5555);
  });

  test('returns null when tv_results empty', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValueOnce({ tv_results: [] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTvdb({ tvdb_id: 99, media_type: 'tv' })).toBeNull();
  });

  test('returns null on lookup error', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockRejectedValueOnce(new Error('API down'));
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTvdb({ tvdb_id: 99, media_type: 'tv' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveFromImdb
// ---------------------------------------------------------------------------

describe('resolveFromImdb', () => {
  test('returns null when no imdb_id in payload or enrichmentData', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    expect(await svc.resolveFromImdb({ title: 'X', media_type: 'movie' }, {})).toBeNull();
  });

  test('prefers imdb_id from enrichmentData.omdb.data', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValueOnce({ movie_results: [{ id: 1234 }] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    const result = await svc.resolveFromImdb(
      { title: 'X', media_type: 'movie' },
      { omdb: { data: { imdbId: 'tt9999', type: 'movie' } } }
    );
    expect(result).toBe(1234);
    expect(tmdbService.findByExternalId).toHaveBeenCalledWith('tt9999', 'imdb_id');
  });

  test('selects tv_results for a TV identity', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValueOnce({ movie_results: [], tv_results: [{ id: 7777 }] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromImdb({ imdb_id: 'tt1234', media_type: 'tv' }, {})).toBe(7777);
  });

  test('returns null on lookup error', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockRejectedValueOnce(new Error('fail'));
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromImdb({ imdb_id: 'tt1234', media_type: 'tv' }, {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveFromTitle
// ---------------------------------------------------------------------------

describe('resolveFromTitle', () => {
  test('returns null when no title', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    expect(await svc.resolveFromTitle({ media_type: 'movie' })).toBeNull();
  });

  test('returns best exact match by title and year', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.search.mockResolvedValueOnce([
      { id: 100, title: 'The Matrix', year: '1998' },
      { id: 101, title: 'The Matrix', year: '1999' }
    ]);
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    const result = await svc.resolveFromTitle({ title: 'The Matrix', year: 1999, media: { media_type: 'movie' } });
    expect(result).toBe(101);
  });

  test('falls back to first result when no exact match', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.search.mockResolvedValueOnce([
      { id: 200, title: 'Matrix Reloaded', year: '2003' }
    ]);
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    const result = await svc.resolveFromTitle({ title: 'The Matrix', year: 1999, media_type: 'movie' });
    expect(result).toBe(200);
  });

  test('returns null when search returns empty', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.search.mockResolvedValueOnce([]);
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTitle({ title: 'Unknown', media_type: 'movie' })).toBeNull();
  });

  test('returns null on search error', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.search.mockRejectedValueOnce(new Error('API down'));
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTitle({ title: 'X', media_type: 'movie' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// backfillTmdbId
// ---------------------------------------------------------------------------

describe('backfillTmdbId', () => {
  test('does not report a backfill when the conditional update matches no row', async () => {
    const logger = createMockLogger();
    const svc = new QueueTmdbResolutionService({ logger, queryWithTimeout: jest.fn().mockResolvedValue({ rowCount: 0 }) });
    await svc.backfillTmdbId(1, 42, 'tv');
    expect(logger.info).not.toHaveBeenCalled();
  });
  test('does not query when missing itemId or tmdbId', async () => {
    const queryWithTimeout = makeQueryWithTimeout();
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService(), queryWithTimeout });
    await svc.backfillTmdbId(null, 1, 'movie');
    await svc.backfillTmdbId(1, null, 'movie');
    expect(queryWithTimeout).not.toHaveBeenCalled();
  });

  test('calls queryWithTimeout to update media_server_items', async () => {
    const queryWithTimeout = makeQueryWithTimeout().mockResolvedValue();
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService(), queryWithTimeout });
    await svc.backfillTmdbId(42, 9999, 'tv');
    expect(queryWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('media_server_items'),
      [9999, 42, 'tv']
    );
  });
});

// ---------------------------------------------------------------------------
// resolveAndBackfill
// ---------------------------------------------------------------------------

describe('resolveAndBackfill', () => {
  test('returns currentTmdbId without looking further', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    const spy = jest.spyOn(svc, 'backfillTmdbId').mockResolvedValueOnce();
    jest.spyOn(svc, 'resolveFromTvdb');
    const result = await svc.resolveAndBackfill({ itemId: 1, title: 'X', media_type: 'movie' }, {}, 777);
    expect(result).toBe(777);
    expect(svc.resolveFromTvdb).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(1, 777, 'movie');
  });

  test('tries tvdb then imdb then title in cascade', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    jest.spyOn(svc, 'resolveFromTvdb').mockResolvedValueOnce(null);
    jest.spyOn(svc, 'resolveFromImdb').mockResolvedValueOnce(null);
    jest.spyOn(svc, 'resolveFromTitle').mockResolvedValueOnce(555);
    jest.spyOn(svc, 'backfillTmdbId').mockResolvedValueOnce();

    const result = await svc.resolveAndBackfill({ itemId: 5, title: 'Movie', media_type: 'movie' }, {});
    expect(result).toBe(555);
    expect(svc.resolveFromTvdb).toHaveBeenCalled();
    expect(svc.resolveFromImdb).toHaveBeenCalled();
    expect(svc.resolveFromTitle).toHaveBeenCalled();
  });

  test('returns null without backfill when no tmdbId resolved', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    jest.spyOn(svc, 'resolveFromTvdb').mockResolvedValueOnce(null);
    jest.spyOn(svc, 'resolveFromImdb').mockResolvedValueOnce(null);
    jest.spyOn(svc, 'resolveFromTitle').mockResolvedValueOnce(null);
    const backfill = jest.spyOn(svc, 'backfillTmdbId');

    const result = await svc.resolveAndBackfill({ itemId: 5, title: 'X', media_type: 'movie' }, {});
    expect(result).toBeNull();
    expect(backfill).not.toHaveBeenCalled();
  });
});
