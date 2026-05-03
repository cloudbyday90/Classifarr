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

const enrichmentRetryService = jest.requireActual('../services/enrichmentRetryService');

const { QueueOmdbEnrichmentService } = await import('../services/queueOmdbEnrichmentService.mjs');

const makeDb = () => ({ query: jest.fn() });
const makeLogger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() });
const makeOmdbService = () => ({ getByTitle: jest.fn() });
const makeQueryWithTimeout = () => jest.fn().mockResolvedValue({});

function makeSvc(overrides = {}) {
  return new QueueOmdbEnrichmentService({
    db: makeDb(),
    logger: makeLogger(),
    omdbService: makeOmdbService(),
    queryWithTimeout: makeQueryWithTimeout(),
    isOmdbSslBlocked: jest.fn().mockResolvedValue(false),
    getRuntimeState: jest.fn().mockReturnValue({
      omdbLimitHit: false,
      lastOmdbCircuitWarnAt: 0,
      lastOmdbSslWarnAt: 0
    }),
    setRuntimeState: jest.fn(),
    ...overrides
  });
}

let queueForRetry;

beforeEach(() => {
  jest.restoreAllMocks();
  queueForRetry = jest.spyOn(enrichmentRetryService, 'queueForRetry');
});

// ---------------------------------------------------------------------------
// buildContentAnalysisPatch
// ---------------------------------------------------------------------------

describe('buildContentAnalysisPatch', () => {
  test('maps omdb fields to patch object', () => {
    const svc = makeSvc();
    const patch = svc.buildContentAnalysisPatch({
      rated: 'PG-13',
      genre: 'Action, Animation',
      imdbRating: '7.5'
    });
    expect(patch.omdb_rated).toBe('PG-13');
    expect(patch.omdb_genre).toBe('Action, Animation');
    expect(patch.omdb_imdb_rating).toBe('7.5');
    expect(patch.is_animation).toBe(true);
    expect(patch.is_documentary).toBe(false);
    expect(patch.is_kids).toBe(false);
    expect(patch.is_adult).toBe(false);
  });

  test('is_kids=true for G-rated content', () => {
    const svc = makeSvc();
    const patch = svc.buildContentAnalysisPatch({ rated: 'G', genre: 'Family' });
    expect(patch.is_kids).toBe(true);
    expect(patch.is_adult).toBe(false);
  });

  test('is_adult=true for R-rated content', () => {
    const svc = makeSvc();
    const patch = svc.buildContentAnalysisPatch({ rated: 'R', genre: 'Action' });
    expect(patch.is_adult).toBe(true);
    expect(patch.is_kids).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// maybeBackfillRating
// ---------------------------------------------------------------------------

describe('maybeBackfillRating', () => {
  test('skips when no itemId', async () => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(null, { rated: 'PG' });
    expect(svc.db.query).not.toHaveBeenCalled();
  });

  test('skips when rated is N/A', async () => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(1, { rated: 'N/A' });
    expect(svc.db.query).not.toHaveBeenCalled();
  });

  test('skips when rated is undefined', async () => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(1, {});
    expect(svc.db.query).not.toHaveBeenCalled();
  });

  test('updates content_rating when item exists', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ content_rating: 'PG' }] });
    const queryWithTimeout = makeQueryWithTimeout();
    const svc = new QueueOmdbEnrichmentService({
      db,
      logger: makeLogger(),
      omdbService: makeOmdbService(),
      queryWithTimeout,
      isOmdbSslBlocked: jest.fn(),
      getRuntimeState: jest.fn().mockReturnValue({}),
      setRuntimeState: jest.fn()
    });
    await svc.maybeBackfillRating(42, { rated: 'R' });
    expect(queryWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('media_server_items'),
      [42, 'PG', 'R']
    );
  });

  test('swallows rating update error', async () => {
    const db = makeDb();
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const svc = makeSvc({ db });
    await expect(svc.maybeBackfillRating(1, { rated: 'PG' })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// enrich — circuit breakers / guards
// ---------------------------------------------------------------------------

describe('enrich — guards', () => {
  test('returns enrichmentData unchanged when omdbLimitHit=true', async () => {
    const svc = makeSvc({
      getRuntimeState: jest.fn().mockReturnValue({ omdbLimitHit: true })
    });
    const data = { existing: true };
    expect(await svc.enrich({ title: 'X' }, data)).toBe(data);
  });

  test('returns enrichmentData unchanged when no active omdb config', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = makeSvc({ db });
    const data = {};
    expect(await svc.enrich({ title: 'X' }, data)).toBe(data);
  });

  test('returns enrichmentData unchanged when config has no api_key', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: null }] });
    const svc = makeSvc({ db });
    expect(await svc.enrich({ title: 'X' }, {})).toBeDefined();
  });

  test('returns enrichmentData unchanged when SSL blocked', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    const isOmdbSslBlocked = jest.fn().mockResolvedValueOnce(true);
    const svc = makeSvc({ db, isOmdbSslBlocked });
    const data = {};
    expect(await svc.enrich({ title: 'X', itemId: 1 }, data)).toBe(data);
    expect(queueForRetry).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// enrich — successful path
// ---------------------------------------------------------------------------

describe('enrich — success', () => {
  test('populates enrichmentData.omdb and content_analysis on success', async () => {
    const db = makeDb();
    db.query
      .mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] })     // omdb_config
      .mockResolvedValueOnce({ rows: [{ content_rating: null }] }); // maybeBackfillRating SELECT
    const omdbService = makeOmdbService();
    omdbService.getByTitle.mockResolvedValueOnce({ rated: 'G', genre: 'Family, Animation', imdbRating: '6.0' });
    const queryWithTimeout = makeQueryWithTimeout();
    const svc = new QueueOmdbEnrichmentService({
      db,
      logger: makeLogger(),
      omdbService,
      queryWithTimeout,
      isOmdbSslBlocked: jest.fn().mockResolvedValue(false),
      getRuntimeState: jest.fn().mockReturnValue({ omdbLimitHit: false, lastOmdbSslWarnAt: 0 }),
      setRuntimeState: jest.fn()
    });

    const data = {};
    const result = await svc.enrich({ title: 'Shrek', year: 2001, itemId: 5, media: { media_type: 'movie' } }, data);

    expect(result.omdb).toBeDefined();
    expect(result.omdb.data.rated).toBe('G');
    expect(result.content_analysis.is_family).toBe(true);
    expect(result.content_analysis.is_kids).toBe(true);
  });

  test('queues tavily fallback and returns data unchanged when omdb returns null', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    const omdbService = makeOmdbService();
    omdbService.getByTitle.mockResolvedValueOnce(null);
    const svc = makeSvc({ db, omdbService });

    const data = {};
    const result = await svc.enrich({ title: 'Unknown', year: 2000, itemId: 10 }, data);
    expect(result).toBe(data);
    expect(queueForRetry).toHaveBeenCalledWith(10, 'tavily', expect.any(String), expect.any(Number));
  });
});

// ---------------------------------------------------------------------------
// handleError — routing
// ---------------------------------------------------------------------------

describe('handleError', () => {
  test('routes OMDbLimitReachedError to handleLimitReached', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'handleLimitReached').mockResolvedValueOnce();
    const err = new Error('Limit Reached');
    err.name = 'OMDbLimitReachedError';
    await svc.handleError({ title: 'X', itemId: 1 }, err);
    expect(svc.handleLimitReached).toHaveBeenCalled();
  });

  test('routes message containing "Limit Reached" to handleLimitReached', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'handleLimitReached').mockResolvedValueOnce();
    await svc.handleError({ title: 'X', itemId: 1 }, new Error('OMDb Limit Reached'));
    expect(svc.handleLimitReached).toHaveBeenCalled();
  });

  test('routes CERT_HAS_EXPIRED to handleSslError', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'handleSslError').mockResolvedValueOnce();
    const err = new Error('certificate error');
    err.code = 'CERT_HAS_EXPIRED';
    await svc.handleError({ title: 'X', itemId: 1 }, err);
    expect(svc.handleSslError).toHaveBeenCalled();
  });

  test('routes CIRCUIT_BREAKER_OPEN to handleCircuitError', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'handleCircuitError').mockResolvedValueOnce();
    const err = new Error('circuit open');
    err.code = 'CIRCUIT_BREAKER_OPEN';
    await svc.handleError({ title: 'X', itemId: 1 }, err);
    expect(svc.handleCircuitError).toHaveBeenCalled();
  });

  test('routes generic errors to handleGenericError', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'handleGenericError').mockResolvedValueOnce();
    await svc.handleError({ title: 'X', itemId: 1 }, new Error('some unknown error'));
    expect(svc.handleGenericError).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleLimitReached
// ---------------------------------------------------------------------------

describe('handleLimitReached', () => {
  test('sets omdbLimitHit=true and queues tavily retry', async () => {
    const setRuntimeState = jest.fn();
    const svc = makeSvc({ setRuntimeState });
    jest.spyOn(svc, 'queueRetry').mockResolvedValueOnce();
    await svc.handleLimitReached({ title: 'X', itemId: 3 }, new Error('Limit'));
    expect(setRuntimeState).toHaveBeenCalledWith({ omdbLimitHit: true });
    expect(svc.queueRetry).toHaveBeenCalledWith(3, 'tavily', expect.any(String), 3);
  });
});

// ---------------------------------------------------------------------------
// queueRetry
// ---------------------------------------------------------------------------

describe('queueRetry', () => {
  test('does nothing when no itemId', async () => {
    const svc = makeSvc();
    await svc.queueRetry(null, 'omdb', 'reason', 5);
    expect(queueForRetry).not.toHaveBeenCalled();
  });

  test('calls enrichmentRetryService.queueForRetry', async () => {
    queueForRetry.mockResolvedValueOnce();
    const svc = makeSvc();
    await svc.queueRetry(7, 'omdb', 'SSL error', 6);
    expect(queueForRetry).toHaveBeenCalledWith(7, 'omdb', 'SSL error', 6);
  });

  test('swallows retry queue error', async () => {
    queueForRetry.mockRejectedValueOnce(new Error('retry fail'));
    const svc = makeSvc();
    await expect(svc.queueRetry(7, 'omdb', 'reason', 5)).resolves.toBeUndefined();
  });
});
