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

import { QueueTaskProcessorService } from '../services/queueTaskProcessorService.mjs';

import { createMockLogger } from './helpers/mockFactory.mjs';
const ratingNormalizer = { getPriorityRating: jest.fn() };
const metadataEnrichment = { hasWebSearchEnrichmentMetadata: jest.fn() };

const makeClient = () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() });

/** Creates a mock db whose withTransaction delegates to pool.connect (matching real behavior). */
function makeTestDb(client) {
  const pool = { connect: jest.fn().mockResolvedValueOnce(client) };
  const db = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    pool,
    withTransaction: async (fn) => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const result = await fn(c);
        await c.query('COMMIT');
        return result;
      } catch (err) {
        try { await c.query('ROLLBACK'); } catch (_) {}
        throw err;
      } finally {
        c.release();
      }
    },
  };
  return db;
}

function makeSvc(overrides = {}) {
  const pool = { connect: jest.fn() };
  const db = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    pool,
    withTransaction: async (fn) => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const result = await fn(c);
        await c.query('COMMIT');
        return result;
      } catch (err) {
        try { await c.query('ROLLBACK'); } catch (_) {}
        throw err;
      } finally {
        c.release();
      }
    },
  };
  const queueOmdbEnrichmentService = { enrich: jest.fn().mockImplementation((p, d) => Promise.resolve(d)) };
  const queueWebSearchEnrichmentService = { enrich: jest.fn().mockImplementation((p, d) => Promise.resolve(d)) };
  const queueTmdbResolutionService = { resolveAndBackfill: jest.fn().mockResolvedValue(null) };
  const queueClassificationHistoryService = { persist: jest.fn().mockResolvedValue() };
  return new QueueTaskProcessorService({
    db,
    logger: createMockLogger(),
    classificationService: { classifyQueueTask: jest.fn().mockResolvedValue({ bestMatch: null, library: null }) },
    omdbService: {},
    tmdbService: {},
    completeTask: jest.fn().mockResolvedValue(),
    failTask: jest.fn().mockResolvedValue(),
    queryWithTimeout: jest.fn().mockResolvedValue({}),
    queueOmdbEnrichmentService,
    queueWebSearchEnrichmentService,
    queueTmdbResolutionService,
    queueClassificationHistoryService,
    ratingNormalizer,
    metadataEnrichment,
    ...overrides
  });
}

beforeEach(() => {
  metadataEnrichment.hasWebSearchEnrichmentMetadata.mockReset();
  ratingNormalizer.getPriorityRating.mockReset();
  jest.restoreAllMocks();
});

describe('resolveSourceLibraryName', () => {
  test('returns sourceLibraryName as-is when already provided', async () => {
    const svc = makeSvc();
    const result = await svc.resolveSourceLibraryName(1, 'Movies', {});
    expect(result).toBe('Movies');
    expect(svc.db.query).not.toHaveBeenCalled();
  });

  test('returns sourceLibraryName as-is when no sourceLibraryId', async () => {
    const svc = makeSvc();
    expect(await svc.resolveSourceLibraryName(null, null, {})).toBeNull();
  });

  test('looks up library name from DB when name is missing', async () => {
    const svc = makeSvc();
    svc.db.query.mockResolvedValueOnce({ rows: [{ name: 'Movies' }] });
    const result = await svc.resolveSourceLibraryName(5, null, {});
    expect(result).toBe('Movies');
    expect(svc.db.query).toHaveBeenCalledWith(
      expect.stringContaining('libraries'),
      [5]
    );
  });

  test('returns null and swallows error when DB lookup fails', async () => {
    const svc = makeSvc();
    svc.db.query.mockRejectedValueOnce(new Error('DB error'));
    const result = await svc.resolveSourceLibraryName(5, null, {});
    expect(result).toBeNull();
  });
});

describe('processClassificationTask', () => {
  test('calls the queue-specific classification path and completes the task', async () => {
    const classifyResult = { bestMatch: null, library: null };
    const classificationService = { classifyQueueTask: jest.fn().mockResolvedValueOnce(classifyResult) };
    const completeTask = jest.fn().mockResolvedValue();
    const svc = makeSvc({ classificationService, completeTask });

    await svc.processClassificationTask({ id: 'task1', payload: { title: 'Movie', itemId: null }, webhook_log_id: null });
    expect(classificationService.classifyQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task1' }),
      expect.objectContaining({ taskId: 'task1' }),
    );
    expect(completeTask).toHaveBeenCalledWith('task1', classifyResult);
  });

  test('updates media_server_items metadata when bestMatch present', async () => {
    const classifyResult = {
      bestMatch: { type: 'movie', confidence: 95 },
      library: { name: 'Movies' }
    };
    const classificationService = { classifyQueueTask: jest.fn().mockResolvedValueOnce(classifyResult) };
    const queryWithTimeout = jest.fn().mockResolvedValue({});
    const svc = makeSvc({ classificationService, queryWithTimeout });

    await svc.processClassificationTask({ id: 'task1', payload: { title: 'Movie', itemId: 42 }, webhook_log_id: null });
    expect(queryWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('media_server_items'),
      expect.arrayContaining([42])
    );
  });

  test('updates webhook_log when webhook_log_id is present', async () => {
    const svc = makeSvc();
    await svc.processClassificationTask({
      id: 'task1',
      payload: { title: 'Movie', itemId: null },
      webhook_log_id: 99,
      started_at: new Date().toISOString()
    });
    expect(svc.db.query).toHaveBeenCalledWith(
      expect.stringContaining('webhook_log'),
      expect.arrayContaining([99])
    );
  });

  test('records a bounded request routing admission and writes the selected library name to the webhook log', async () => {
    const requestDestinationAdmission = {
      statusId: 'outcome_only',
      audit: { ok: true },
    };
    const policyRequestImportDestinationAdmissionService = {
      build: jest.fn().mockReturnValue(requestDestinationAdmission),
    };
    const classificationService = {
      classifyQueueTask: jest.fn().mockResolvedValue({
        classification_id: 87,
        library: 'Movies',
        destination: {
          libraryId: 3,
          libraryName: 'Movies',
        },
        routingOutcome: {
          shouldRoute: true,
          routeResult: {
            attempted: true,
            routed: true,
            reason: 'routed',
          },
        },
        bestMatch: null,
      }),
    };
    const completeTask = jest.fn().mockResolvedValue();
    const svc = makeSvc({
      classificationService,
      completeTask,
      policyRequestImportDestinationAdmissionService,
    });
    const task = {
      id: 'task1',
      source: 'webhook',
      payload: { title: 'Movie', itemId: null },
      webhook_log_id: 99,
      started_at: new Date().toISOString(),
    };

    await svc.processClassificationTask(task);

    expect(policyRequestImportDestinationAdmissionService.build).toHaveBeenCalledWith({
      task,
      classification: expect.objectContaining({
        classification_id: 87,
        destination: {
          libraryId: 3,
          libraryName: 'Movies',
        },
      }),
      queueQuestionReduction: undefined,
    });
    expect(completeTask).toHaveBeenCalledWith('task1', expect.objectContaining({
      requestDestinationAdmission,
    }));
    expect(svc.db.query).toHaveBeenCalledWith(
      expect.stringContaining('webhook_log'),
      expect.arrayContaining([99, 'Movies'])
    );
  });
});

describe('processRatingNormalization', () => {
  test('completes with skipped=true when item not found', async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const db = makeTestDb(client);
    const completeTask = jest.fn().mockResolvedValue();
    const svc = makeSvc({ db, completeTask });

    await svc.processRatingNormalization({
      id: 'task1',
      payload: { media_item_id: 99 }
    });
    expect(completeTask).toHaveBeenCalledWith('task1', { skipped: true, reason: 'Item not found' });
  });

  test('normalizes rating when different from original', async () => {
    ratingNormalizer.getPriorityRating.mockReturnValueOnce('PG-13');
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, content_rating: 'R', metadata: {}, media_type: 'movie' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const db = makeTestDb(client);
    const completeTask = jest.fn().mockResolvedValue();
    const svc = makeSvc({ db, completeTask });

    await svc.processRatingNormalization({ id: 'task1', payload: { media_item_id: 1 } });
    expect(completeTask).toHaveBeenCalledWith('task1', { normalized: true, original: 'R', new: 'PG-13' });
  });

  test('rolls back transaction on error', async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('DB crash'))
      .mockResolvedValueOnce({ rows: [] });
    const db = makeTestDb(client);
    const svc = makeSvc({ db });

    await expect(svc.processRatingNormalization({ id: 'task1', payload: { media_item_id: 1 } }))
      .rejects.toThrow('DB crash');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('processMetadataEnrichmentTask', () => {
  test('calls OMDb and provider-neutral web-search enrichment before completing the task', async () => {
    metadataEnrichment.hasWebSearchEnrichmentMetadata.mockReturnValue(true);
    const svc = makeSvc();
    const task = {
      id: 'task1',
      payload: {
        title: 'Movie',
        itemId: null,
        source_library_id: 1,
        source_library_name: 'Movies',
        tmdb_id: 123
      }
    };
    await svc.processMetadataEnrichmentTask(task);
    expect(svc.queueOmdbEnrichmentService.enrich).toHaveBeenCalled();
    expect(svc.queueWebSearchEnrichmentService.enrich).toHaveBeenCalled();
    expect(svc.completeTask).toHaveBeenCalledWith('task1', expect.objectContaining({ enriched: true }));
  });

  test('fetches missing tmdbId and libraryId from DB when itemId provided', async () => {
    metadataEnrichment.hasWebSearchEnrichmentMetadata.mockReturnValue(false);
    const svc = makeSvc();
    svc.db.query
      .mockResolvedValueOnce({ rows: [{ tmdb_id: 999, library_id: 2, library_name: 'Movies', metadata: null }] })
      .mockResolvedValue({ rows: [] });

    await svc.processMetadataEnrichmentTask({
      id: 't1',
      payload: { title: 'X', itemId: 42, source_library_id: null, source_library_name: null }
    });
    expect(svc.queueTmdbResolutionService.resolveAndBackfill).toHaveBeenCalled();
  });

  test('persists classification history when itemId provided', async () => {
    metadataEnrichment.hasWebSearchEnrichmentMetadata.mockReturnValue(false);
    const svc = makeSvc();
    await svc.processMetadataEnrichmentTask({
      id: 't1',
      payload: { title: 'X', itemId: 5, source_library_id: 1, source_library_name: 'Movies', tmdb_id: 10 }
    });
    expect(svc.queueClassificationHistoryService.persist).toHaveBeenCalled();
  });
});

describe('rebuildImageIndexes', () => {
  test('runs 3 CREATE INDEX queries and completes', async () => {
    const svc = makeSvc();
    await svc.rebuildImageIndexes({ id: 'task1' });
    expect(svc.db.query).toHaveBeenCalledTimes(3);
    expect(svc.completeTask).toHaveBeenCalledWith('task1', expect.objectContaining({ rebuilt: true }));
  });
});

describe('processTask', () => {
  test('dispatches classification task type', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'processClassificationTask').mockResolvedValueOnce();
    await svc.processTask({ id: 't1', task_type: 'classification', payload: {} });
    expect(svc.processClassificationTask).toHaveBeenCalled();
  });

  test('dispatches metadata_enrichment task type', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'processMetadataEnrichmentTask').mockResolvedValueOnce();
    await svc.processTask({ id: 't1', task_type: 'metadata_enrichment', payload: {} });
    expect(svc.processMetadataEnrichmentTask).toHaveBeenCalled();
  });

  test('dispatches rating_normalization task type', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'processRatingNormalization').mockResolvedValueOnce();
    await svc.processTask({ id: 't1', task_type: 'rating_normalization', payload: {} });
    expect(svc.processRatingNormalization).toHaveBeenCalled();
  });

  test('dispatches rebuild_hnsw_index task type', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'rebuildImageIndexes').mockResolvedValueOnce();
    await svc.processTask({ id: 't1', task_type: 'rebuild_hnsw_index', payload: {} });
    expect(svc.rebuildImageIndexes).toHaveBeenCalled();
  });

  test('calls failTask for unknown task type', async () => {
    const svc = makeSvc();
    await svc.processTask({ id: 't1', task_type: 'bogus', attempts: 1, max_attempts: 3 });
    expect(svc.failTask).toHaveBeenCalledWith('t1', 'task_unknown_type', 1, 3);
  });

  test('calls failTask on uncaught error', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'processClassificationTask').mockRejectedValueOnce(new Error('crash'));
    await svc.processTask({
      id: 't1',
      task_type: 'classification',
      payload: {},
      attempts: 1,
      max_attempts: 3,
      webhook_log_id: null
    });
    expect(svc.failTask).toHaveBeenCalledWith('t1', 'task_processing_failed', 1, 3);
    expect(JSON.stringify(svc.logger.error.mock.calls)).not.toContain('crash');
  });

  test('updates webhook_log on task error when webhook_log_id present', async () => {
    const svc = makeSvc();
    jest.spyOn(svc, 'processClassificationTask').mockRejectedValueOnce(new Error('crash'));
    await svc.processTask({
      id: 't1',
      task_type: 'classification',
      payload: {},
      attempts: 1,
      max_attempts: 3,
      webhook_log_id: 77
    });
    expect(svc.db.query).toHaveBeenCalledWith(
      expect.stringContaining('webhook_log'),
      [77, 'task_processing_failed']
    );
  });
});
