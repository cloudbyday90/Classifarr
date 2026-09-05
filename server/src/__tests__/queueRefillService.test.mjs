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
import { createMockDb, createMockLogger, restoreAllAndResetMocks } from './helpers/mockFactory.mjs';
import { QueueRefillService, REFILL_QUEUE_BATCH_LIMIT } from '../services/queueRefillService.mjs';


beforeEach(() => {
  restoreAllAndResetMocks();
});

// ---------------------------------------------------------------------------
// REFILL_QUEUE_BATCH_LIMIT
// ---------------------------------------------------------------------------

describe('REFILL_QUEUE_BATCH_LIMIT', () => {
  test('is a positive integer', () => {
    expect(typeof REFILL_QUEUE_BATCH_LIMIT).toBe('number');
    expect(REFILL_QUEUE_BATCH_LIMIT).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// selectRefillCandidates
// ---------------------------------------------------------------------------

describe('selectRefillCandidates', () => {
  test('returns rows from DB query', async () => {
    const db = createMockDb();
    const rows = [{ id: 1, title: 'Movie A' }, { id: 2, title: 'Movie B' }];
    db.query.mockResolvedValueOnce({ rows });
    const svc = new QueueRefillService({ db, logger: createMockLogger() });
    const result = await svc.selectRefillCandidates();
    expect(result).toEqual(rows);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('returns empty array when no candidates', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = new QueueRefillService({ db, logger: createMockLogger() });
    expect(await svc.selectRefillCandidates()).toEqual([]);
  });

  test('executes query with OMDb subquery filter logic', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = new QueueRefillService({ db, logger: createMockLogger() });
    await svc.selectRefillCandidates();
    
    expect(db.query).toHaveBeenCalledTimes(1);
    const sqlQuery = db.query.mock.calls[0][0];
    expect(sqlQuery).toContain("EXISTS (SELECT 1 FROM omdb_config WHERE is_active = true)");
    expect(sqlQuery).toContain("msi.metadata->'omdb' IS NULL");
    expect(sqlQuery).toContain("msi.metadata->'content_analysis'->>'source' IS DISTINCT FROM 'metadata_enrichment'");
  });
});

// ---------------------------------------------------------------------------
// buildMetadataEnrichmentPayload
// ---------------------------------------------------------------------------

describe('buildMetadataEnrichmentPayload', () => {
  test('maps item fields to payload structure', () => {
    const svc = new QueueRefillService({ db: createMockDb(), logger: createMockLogger() });
    const item = {
      id: 42,
      title: 'Test Movie',
      year: 2024,
      metadata: { summary: 'A test movie', posterPath: '/poster.jpg' },
      genres: ['Action', 'Comedy'],
      tags: ['tag1'],
      content_rating: 'PG-13',
      tmdb_id: 999,
      tvdb_id: null,
      imdb_id: 'tt123',
      library_id: 1,
      library_name: 'Movies',
      media_type: 'movie'
    };

    const payload = svc.buildMetadataEnrichmentPayload(item);
    expect(payload.title).toBe('Test Movie');
    expect(payload.year).toBe(2024);
    expect(payload.overview).toBe('A test movie');
    expect(payload.genres).toEqual(['Action', 'Comedy']);
    expect(payload.keywords).toEqual([]);
    expect(payload.tags).toEqual(['tag1']);
    expect(payload.original_language).toBeNull();
    expect(payload.content_rating).toBe('PG-13');
    expect(payload.tmdb_id).toBe(999);
    expect(payload.imdb_id).toBe('tt123');
    expect(payload.posterPath).toBe('/poster.jpg');
    expect(payload.itemId).toBe(42);
    expect(payload.source_library_id).toBe(1);
    expect(payload.source_library_name).toBe('Movies');
    expect(payload.media.media_type).toBe('movie');
  });

  test('uses empty object when metadata is missing', () => {
    const svc = new QueueRefillService({ db: createMockDb(), logger: createMockLogger() });
    const item = {
      id: 1, title: 'X', year: 2000,
      metadata: null, genres: [], tags: [],
      content_rating: null, tmdb_id: null, tvdb_id: null, imdb_id: null,
      library_id: 2, library_name: 'Lib', media_type: 'tv'
    };
    const payload = svc.buildMetadataEnrichmentPayload(item);
    expect(payload.overview).toBe('');
    expect(payload.posterPath).toBeNull();
    expect(payload.media.media_type).toBe('tv');
  });
});

// ---------------------------------------------------------------------------
// refillQueue
// ---------------------------------------------------------------------------

describe('refillQueue', () => {
  test('enqueues metadata enrichment tasks for selected candidates', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    const enqueueTask = jest.fn().mockResolvedValue(1001);
    const rows = [{
      id: 42,
      title: 'Queued Movie',
      year: 2024,
      metadata: { summary: 'Ready for enrichment' },
      genres: [],
      tags: [],
      content_rating: 'PG',
      tmdb_id: 123,
      tvdb_id: null,
      imdb_id: 'tt1234567',
      library_id: 7,
      library_name: 'Movies',
      media_type: 'movie'
    }];
    db.query.mockResolvedValueOnce({ rows });

    const svc = new QueueRefillService({ db, logger, enqueueTask });
    const result = await svc.refillQueue();

    expect(result).toEqual({ queued: 1 });
    expect(enqueueTask).toHaveBeenCalledWith(
      'metadata_enrichment',
      expect.objectContaining({
        title: 'Queued Movie',
        itemId: 42,
      }),
      {
        priority: 5,
        source: 'gap_analysis',
      },
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Refill queue: Found 1 unanalyzed items. Queueing for metadata enrichment...'
    );
  });

  test('returns zero and logs debug when no candidates are found', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    const enqueueTask = jest.fn();
    db.query.mockResolvedValueOnce({ rows: [] });

    const svc = new QueueRefillService({ db, logger, enqueueTask });
    const result = await svc.refillQueue();

    expect(result).toEqual({ queued: 0 });
    expect(enqueueTask).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('Refill queue: No unanalyzed items found');
  });

  test('logs and rethrows enqueue failures', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    const error = new Error('enqueue failed');
    const enqueueTask = jest.fn().mockRejectedValue(error);
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 5,
        title: 'Failing Movie',
        year: 2024,
        metadata: {},
        genres: [],
        tags: [],
        content_rating: null,
        tmdb_id: null,
        tvdb_id: null,
        imdb_id: null,
        library_id: 2,
        library_name: 'Movies',
        media_type: 'movie'
      }]
    });

    const svc = new QueueRefillService({ db, logger, enqueueTask });

    await expect(svc.refillQueue()).rejects.toThrow('enqueue failed');
    expect(logger.error).toHaveBeenCalledWith('Error refilling queue', { error: 'enqueue failed' });
  });
});
