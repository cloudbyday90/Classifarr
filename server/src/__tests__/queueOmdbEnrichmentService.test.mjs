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
import {
  createMockDb,
  createMockLogger,
  createNamedMockModule,
} from './helpers/mockFactory.mjs';

const mockEnrichmentRetryService = {
    queueForRetry: jest.fn(),
};
jest.unstable_mockModule('../services/enrichmentRetryService.mjs', () => createNamedMockModule('enrichmentRetryService', mockEnrichmentRetryService));

const _enrichmentRetryService = mockEnrichmentRetryService;

const { QueueOmdbEnrichmentService } = await import('../services/queueOmdbEnrichmentService.mjs');

const makeOmdbService = () => ({ getByTitle: jest.fn() });
const makeQueryWithTimeout = () => jest.fn().mockResolvedValue({});
const sourceSnapshot = (mediaType = 'movie') => ({ media_server_id: 1, external_id: 'fixture',
  library_id: 1, media_type: mediaType, title: 'Fixture', year: 2001, imdb_id: null, tvdb_id: null });

function makeSvc(overrides = {}) {
  return new QueueOmdbEnrichmentService({
    db: createMockDb(),
    logger: createMockLogger(),
    metadataProviderIntegrityService: { warnProviderRuntimeFailure: jest.fn() },
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
  mockEnrichmentRetryService.queueForRetry.mockClear();
  queueForRetry = mockEnrichmentRetryService.queueForRetry;
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
  test('does not report success when source type changed before the rating update', async () => {
    const svc = makeSvc();
    svc.db.query.mockResolvedValue({ rows: [{ content_rating: 'PG' }] });
    svc.queryWithTimeout.mockResolvedValue({ rowCount: 0 });
    await svc.maybeBackfillRating(1, { type: 'series', rated: 'TV-MA' }, 'tv', sourceSnapshot('tv'), null);
    expect(svc.queryWithTimeout).toHaveBeenCalledWith(expect.stringContaining('media_type = $3'),
      [1, 'TV-MA', 'tv', null, JSON.stringify(sourceSnapshot('tv'))]);
    expect(svc.db.query).not.toHaveBeenCalled();
    expect(svc.logger.info).not.toHaveBeenCalled();
  });
  test('skips when no itemId', async () => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(null, { rated: 'PG', type: 'movie' }, 'movie');
    expect(svc.db.query).not.toHaveBeenCalled();
  });

  test('skips when rated is N/A', async () => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(1, { rated: 'N/A', type: 'movie' }, 'movie');
    expect(svc.db.query).not.toHaveBeenCalled();
  });

  test('skips when rated is undefined', async () => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(1, { type: 'movie' }, 'movie');
    expect(svc.db.query).not.toHaveBeenCalled();
  });

  test('updates content_rating when item exists', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ content_rating: 'PG' }] });
    const queryWithTimeout = makeQueryWithTimeout();
    const svc = new QueueOmdbEnrichmentService({
      db,
      logger: createMockLogger(),
      omdbService: makeOmdbService(),
      queryWithTimeout,
      isOmdbSslBlocked: jest.fn(),
      getRuntimeState: jest.fn().mockReturnValue({}),
      setRuntimeState: jest.fn()
    });
    queryWithTimeout.mockResolvedValue({ rowCount: 1, rows: [{ original_rating: 'PG' }] });
    await svc.maybeBackfillRating(42, { rated: 'R', type: 'movie' }, 'movie', sourceSnapshot(), null);
    expect(queryWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('media_server_items'),
      [42, 'R', 'movie', null, JSON.stringify(sourceSnapshot())]
    );
    expect(db.query).not.toHaveBeenCalled();
    expect(svc.logger.info).toHaveBeenCalledWith('Rating updated from OMDb', { itemId: 42, original: 'PG', omdb: 'R' });
  });

  test('swallows rating update error', async () => {
    const svc = makeSvc({ queryWithTimeout: jest.fn().mockRejectedValue(new Error('DB error')) });
    await expect(svc.maybeBackfillRating(1, { rated: 'PG', type: 'movie' }, 'movie', sourceSnapshot(), null)).resolves.toBeUndefined();
    expect(svc.logger.debug).toHaveBeenCalledWith('Failed to update rating from OMDb', { error: 'DB error' });
  });

  test.each([undefined, null, {}, { media_type: 'movie' }])('refuses an absent or partial source snapshot: %j', async snapshot => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(1, { rated: 'R', type: 'movie' }, 'movie', snapshot, null);
    expect(svc.db.query).not.toHaveBeenCalled();
    expect(svc.queryWithTimeout).not.toHaveBeenCalled();
  });

  test.each([undefined, 0, '12suffix'])('refuses unknown or malformed expected TMDb identity: %j', async id => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(1, { rated: 'R', type: 'movie' }, 'movie', sourceSnapshot(), id);
    expect(svc.queryWithTimeout).not.toHaveBeenCalled();
  });

  test.each(['', ' ', 'x'.repeat(21), {}, 42])('refuses malformed ratings: %j', async rated => {
    const svc = makeSvc();
    await svc.maybeBackfillRating(1, { rated, type: 'movie' }, 'movie', sourceSnapshot(), null);
    expect(svc.queryWithTimeout).not.toHaveBeenCalled();
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
    expect(await svc.enrich({ title: 'X', media_type: 'movie' }, data)).toBe(data);
  });

  test('returns enrichmentData unchanged when no active omdb config', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = makeSvc({ db });
    const data = {};
    expect(await svc.enrich({ title: 'X', media_type: 'movie' }, data)).toBe(data);
  });

  test('returns enrichmentData unchanged when config has no api_key', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: null }] });
    const svc = makeSvc({ db });
    expect(await svc.enrich({ title: 'X', media_type: 'movie' }, {})).toBeDefined();
  });

  test('returns enrichmentData unchanged when SSL blocked', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    const isOmdbSslBlocked = jest.fn().mockResolvedValueOnce(true);
    const svc = makeSvc({ db, isOmdbSslBlocked });
    const data = {};
    expect(await svc.enrich({ title: 'X', itemId: 1, media_type: 'movie' }, data)).toBe(data);
    expect(queueForRetry).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// enrich — successful path
// ---------------------------------------------------------------------------

describe('enrich — success', () => {
  test.each([{}, { media_type: 'person' }, { media_type: 'tv', media: { media_type: 'movie' } }])(
    'rejects invalid declaration before config, provider, or retry access: %j', async (declaration) => {
      const svc = makeSvc();
      const data = {};
      expect(await svc.enrich({ title: 'Private', ...declaration }, data)).toBe(data);
      expect(svc.db.query).not.toHaveBeenCalled();
      expect(svc.omdbService.getByTitle).not.toHaveBeenCalled();
      expect(queueForRetry).not.toHaveBeenCalled();
      expect(svc.logger.warn).toHaveBeenCalledWith('OMDb enrichment skipped', { reason: 'invalid_media_identity' });
    });

  test.each([{}, { type: 'movie' }, { type: 'episode' }, { type: 'series', Type: 'movie' }])(
    'rejects absent/conflicting provider type without accepting metadata or rating: %j', async (declaration) => {
      const svc = makeSvc();
      svc.db.query.mockResolvedValue({ rows: [{ api_key: 'fixture' }] });
      svc.omdbService.getByTitle.mockResolvedValue({ rated: 'R', ...declaration });
      const data = {};
      expect(await svc.enrich({ title: 'Example', itemId: 1, media_type: 'tv' }, data)).toEqual({});
      expect(svc.queryWithTimeout).not.toHaveBeenCalled();
      expect(queueForRetry).not.toHaveBeenCalled();
    });

  test('captures top-level TV identity and item ID before provider waits', async () => {
    const svc = makeSvc();
    const payload = { title: 'Example', itemId: 1, media_type: ' TV ',
      source_identity_snapshot: sourceSnapshot('tv'), tmdb_id: null };
    svc.db.query.mockResolvedValue({ rows: [{ api_key: 'fixture' }] });
    svc.omdbService.getByTitle.mockImplementation(async () => {
      payload.itemId = 2; payload.media_type = 'movie';
      payload.source_identity_snapshot.title = 'Mutated'; payload.tmdb_id = 99;
      return { type: 'series', rated: 'TV-PG', imdbId: 'tt1234' };
    });
    const rating = jest.spyOn(svc, 'maybeBackfillRating').mockResolvedValue();
    const result = await svc.enrich(payload, {});
    expect(svc.omdbService.getByTitle).toHaveBeenCalledWith('Example', undefined, 'tv', 'fixture');
    expect(rating).toHaveBeenCalledWith(1, result.omdb.data, 'tv', sourceSnapshot('tv'), null);
  });

  test('populates enrichmentData.omdb and content_analysis on success', async () => {
    const db = createMockDb();
    db.query
      .mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] })     // omdb_config
      .mockResolvedValueOnce({ rows: [{ content_rating: null }] }); // maybeBackfillRating SELECT
    const omdbService = makeOmdbService();
    omdbService.getByTitle.mockResolvedValueOnce({ type: 'movie', rated: 'G', genre: 'Family, Animation', imdbRating: '6.0' });
    const queryWithTimeout = makeQueryWithTimeout();
    const svc = new QueueOmdbEnrichmentService({
      db,
      logger: createMockLogger(),
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

  test('queues provider-neutral web-search fallback and returns data unchanged when omdb returns null', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'key123' }] });
    const omdbService = makeOmdbService();
    omdbService.getByTitle.mockResolvedValueOnce(null);
    const svc = makeSvc({ db, omdbService });

    const data = {};
    const result = await svc.enrich({ title: 'Unknown', year: 2000, itemId: 10, media_type: 'movie' }, data);
    expect(result).toBe(data);
    expect(queueForRetry).toHaveBeenCalledWith(10, 'web_search', expect.any(String), expect.any(Number));
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

describe('handleGenericError', () => {
  test('emits a deduped provider warning before queueing retry', async () => {
    const metadataProviderIntegrityService = { warnProviderRuntimeFailure: jest.fn() };
    const svc = makeSvc({ metadataProviderIntegrityService });
    jest.spyOn(svc, 'queueRetry').mockResolvedValueOnce();
    const error = new Error('provider unavailable');
    error.code = 'ECONNREFUSED';

    await svc.handleGenericError({ title: 'X', itemId: 9 }, error);

    expect(metadataProviderIntegrityService.warnProviderRuntimeFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'omdb',
        category: 'queue_failure',
        message: 'OMDb enrichment failed; queuing for OMDb retry',
      })
    );
    expect(svc.queueRetry).toHaveBeenCalledWith(9, 'omdb', expect.any(String), 7);
  });
});

// ---------------------------------------------------------------------------
// handleLimitReached
// ---------------------------------------------------------------------------

describe('handleLimitReached', () => {
  test('sets omdbLimitHit=true and queues provider-neutral web-search retry', async () => {
    const setRuntimeState = jest.fn();
    const svc = makeSvc({ setRuntimeState });
    jest.spyOn(svc, 'queueRetry').mockResolvedValueOnce();
    await svc.handleLimitReached({ title: 'X', itemId: 3 }, new Error('Limit'));
    expect(setRuntimeState).toHaveBeenCalledWith({ omdbLimitHit: true });
    expect(svc.queueRetry).toHaveBeenCalledWith(3, 'web_search', expect.any(String), 3);
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
