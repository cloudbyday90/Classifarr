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

beforeEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// resolveFromTvdb
// ---------------------------------------------------------------------------

describe('resolveFromTvdb', () => {
  test('returns null when no tvdb_id in payload', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    expect(await svc.resolveFromTvdb({ title: 'Show' })).toBeNull();
  });

  test('returns tmdb_id from tv_results', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValueOnce({ tv_results: [{ id: 5555 }] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTvdb({ tvdb_id: 123, title: 'Show' })).toBe(5555);
  });

  test('returns null when tv_results empty', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValueOnce({ tv_results: [] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTvdb({ tvdb_id: 99 })).toBeNull();
  });

  test('returns null on lookup error', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockRejectedValueOnce(new Error('API down'));
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTvdb({ tvdb_id: 99 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveFromImdb
// ---------------------------------------------------------------------------

describe('resolveFromImdb', () => {
  test('returns null when no imdb_id in payload or enrichmentData', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    expect(await svc.resolveFromImdb({ title: 'X' }, {})).toBeNull();
  });

  test('prefers imdb_id from enrichmentData.omdb.data', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValueOnce({ movie_results: [{ id: 1234 }] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    const result = await svc.resolveFromImdb(
      { title: 'X' },
      { omdb: { data: { imdbID: 'tt9999' } } }
    );
    expect(result).toBe(1234);
    expect(tmdbService.findByExternalId).toHaveBeenCalledWith('tt9999', 'imdb_id');
  });

  test('falls back to tv_results when no movie_results', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockResolvedValueOnce({ movie_results: [], tv_results: [{ id: 7777 }] });
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromImdb({ imdb_id: 'tt1234' }, {})).toBe(7777);
  });

  test('returns null on lookup error', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.findByExternalId.mockRejectedValueOnce(new Error('fail'));
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromImdb({ imdb_id: 'tt1234' }, {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveFromTitle
// ---------------------------------------------------------------------------

describe('resolveFromTitle', () => {
  test('returns null when no title', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    expect(await svc.resolveFromTitle({})).toBeNull();
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
    const result = await svc.resolveFromTitle({ title: 'The Matrix', year: 1999 });
    expect(result).toBe(200);
  });

  test('returns null when search returns empty', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.search.mockResolvedValueOnce([]);
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTitle({ title: 'Unknown' })).toBeNull();
  });

  test('returns null on search error', async () => {
    const tmdbService = makeTmdbService();
    tmdbService.search.mockRejectedValueOnce(new Error('API down'));
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService });
    expect(await svc.resolveFromTitle({ title: 'X' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// backfillTmdbId
// ---------------------------------------------------------------------------

describe('backfillTmdbId', () => {
  test('does not query when missing itemId or tmdbId', async () => {
    const queryWithTimeout = makeQueryWithTimeout();
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService(), queryWithTimeout });
    await svc.backfillTmdbId(null, 1);
    await svc.backfillTmdbId(1, null);
    expect(queryWithTimeout).not.toHaveBeenCalled();
  });

  test('calls queryWithTimeout to update media_server_items', async () => {
    const queryWithTimeout = makeQueryWithTimeout().mockResolvedValue();
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService(), queryWithTimeout });
    await svc.backfillTmdbId(42, 9999);
    expect(queryWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('media_server_items'),
      [9999, 42]
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
    const result = await svc.resolveAndBackfill({ itemId: 1, title: 'X' }, {}, 777);
    expect(result).toBe(777);
    expect(svc.resolveFromTvdb).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(1, 777);
  });

  test('tries tvdb then imdb then title in cascade', async () => {
    const svc = new QueueTmdbResolutionService({ logger: createMockLogger(), tmdbService: makeTmdbService() });
    jest.spyOn(svc, 'resolveFromTvdb').mockResolvedValueOnce(null);
    jest.spyOn(svc, 'resolveFromImdb').mockResolvedValueOnce(null);
    jest.spyOn(svc, 'resolveFromTitle').mockResolvedValueOnce(555);
    jest.spyOn(svc, 'backfillTmdbId').mockResolvedValueOnce();

    const result = await svc.resolveAndBackfill({ itemId: 5, title: 'Movie' }, {});
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

    const result = await svc.resolveAndBackfill({ itemId: 5, title: 'X' }, {});
    expect(result).toBeNull();
    expect(backfill).not.toHaveBeenCalled();
  });
});
