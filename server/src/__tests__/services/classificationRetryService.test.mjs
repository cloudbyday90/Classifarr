import { jest } from '@jest/globals';

const mockDb = {
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
};

const mockRecordOutcome = jest.fn().mockResolvedValue({ updated: true });

jest.unstable_mockModule('../../config/database.mjs', () => ({ ...mockDb, default: mockDb }));
jest.unstable_mockModule('../../services/classificationOutcomeService.mjs', () => ({
  recordOutcome: mockRecordOutcome,
  classificationOutcomeService: { recordOutcome: mockRecordOutcome }
}));

const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
}

describe('ClassificationRetryService', () => {
  let logger;
  let db;
  let client;
  let service;
  let followupService;
  let evidenceService;

  beforeEach(() => {
    logger = createMockLogger();
    client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db = {
      query: jest.fn(),
      pool: {
        connect: jest.fn().mockResolvedValue(client)
      }
    };
    db.withTransaction = jest.fn(async (fn) => {
      const conn = await db.pool.connect();
      try {
        await conn.query('BEGIN');
        const result = await fn(conn);
        await conn.query('COMMIT');
        return result;
      } catch (err) {
        try { await conn.query('ROLLBACK'); } catch (_) {}
        throw err;
      } finally {
        conn.release();
      }
    });
    followupService = {
      enqueueMetadataEnrichmentTask: jest.fn()
    };
    evidenceService = {
      purgeEvidence: jest.fn().mockResolvedValue({
        deleted: 0,
        deletedByScope: { item_exact: 0 }
      })
    };
    service = new ClassificationRetryService({ db, logger, followupService, evidenceService });
    jest.spyOn(service, 'captureRetryLineage').mockResolvedValue(null);
  });

  test('normalizeIds validates and de-duplicates ids', () => {
    expect(service.normalizeIds([10, '10', 22, 22])).toEqual({
      error: null,
      ids: [10, 22]
    });
    expect(service.normalizeIds(['nope']).error).toBe('classificationIds must contain only positive integers');
  });

  test('retryClassifications throws validation error for invalid batch', async () => {
    await expect(service.retryClassifications({ classificationIds: [] })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'classificationIds must contain at least one id'
    });
  });

  test('retryClassifications aggregates batch results and logs summary', async () => {
    jest.spyOn(service, 'retrySingle')
      .mockResolvedValueOnce({ queued: true, skipped: false, failed: false })
      .mockResolvedValueOnce({ queued: false, skipped: true, failed: false, reasonCode: 'status_ineligible' });

    const result = await service.retryClassifications({
      classificationIds: [101, 102, 101],
      actor: 'admin',
      correlationId: 'corr-123'
    });

    expect(result).toMatchObject({
      correlationId: 'corr-123',
      requested: 2,
      queued: 1,
      skipped: 1,
      failed: 0
    });
    expect(service.retrySingle).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('Classification retry requested', expect.objectContaining({
      correlationId: 'corr-123',
      actor: 'admin',
      batchSize: 2,
      route: '/api/classification/retry',
      result: 'request_accepted'
    }));
    expect(logger.info).toHaveBeenCalledWith('Classification retry batch completed', expect.objectContaining({
      queued: 1,
      skipped: 1,
      failed: 0,
      route: '/api/classification/retry',
      result: 'batch_completed'
    }));
  });

  test('retryClassifications preserves exact-match learning by default', async () => {
    const retrySingleSpy = jest.spyOn(service, 'retrySingle')
      .mockResolvedValueOnce({ queued: true, skipped: false, failed: false });

    await service.retryClassifications({
      classificationIds: [103],
      actor: 'admin',
      correlationId: 'corr-default-learning'
    });

    expect(retrySingleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        classificationId: 103,
        purgeLearning: false
      })
    );
  });

  test('retrySingle skips when classification is not found', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM classification_history')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await service.retrySingle({
      classificationId: 301,
      actor: 'admin',
      purgeLearning: true,
      correlationId: 'corr-not-found'
    });

    expect(result).toMatchObject({
      classificationId: 301,
      skipped: true,
      reasonCode: 'not_found'
    });
    expect(logger.warn).toHaveBeenCalledWith('Classification retry skipped: not found', expect.objectContaining({
      classificationId: 301,
      route: '/api/classification/retry',
      result: 'skipped',
      reasonCode: 'not_found'
    }));
  });

  test('retrySingle skips when status is ineligible', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM classification_history')) {
        return {
          rows: [{
            id: 302,
            tmdb_id: 999,
            media_type: 'movie',
            title: 'Complete Item',
            year: 2025,
            status: 'completed',
            metadata: '{}'
          }]
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await service.retrySingle({
      classificationId: 302,
      actor: 'admin',
      purgeLearning: true,
      correlationId: 'corr-status'
    });

    expect(result).toMatchObject({
      classificationId: 302,
      skipped: true,
      reasonCode: 'status_ineligible'
    });
    expect(logger.warn).toHaveBeenCalledWith('Classification retry skipped: status ineligible', expect.objectContaining({
      classificationId: 302,
      status: 'completed',
      route: '/api/classification/retry',
      result: 'skipped',
      reasonCode: 'status_ineligible'
    }));
  });

  test('retrySingle skips when duplicate pending task exists', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM classification_history')) {
        return {
          rows: [{
            id: 303,
            tmdb_id: 111,
            media_type: 'movie',
            title: 'Duplicate Item',
            year: 2026,
            status: 'awaiting_decision',
            metadata: '{}'
          }]
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    jest.spyOn(service, 'hasPendingClassificationTask').mockResolvedValueOnce({ id: 8801, status: 'pending' });

    const result = await service.retrySingle({
      classificationId: 303,
      actor: 'admin',
      purgeLearning: true,
      correlationId: 'corr-dup'
    });

    expect(result).toMatchObject({
      classificationId: 303,
      skipped: true,
      reasonCode: 'duplicate_pending_task'
    });
    expect(logger.warn).toHaveBeenCalledWith('Classification retry skipped: duplicate pending task', expect.objectContaining({
      classificationId: 303,
      existingTaskId: 8801,
      route: '/api/classification/retry',
      result: 'skipped',
      reasonCode: 'duplicate_pending_task'
    }));
  });

  test('hasPendingClassificationTask falls back to title/year when TMDB lookup misses', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 8802, status: 'pending' }] });

    const result = await service.hasPendingClassificationTask(client, {
      tmdbId: 444,
      mediaType: 'movie',
      title: 'Duplicate Item',
      year: '2026'
    });

    expect(result).toEqual({ id: 8802, status: 'pending' });
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("(payload->>'tmdb_id')"),
      [444, 'movie']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("LOWER(TRIM(COALESCE(payload->>'title'"),
      ['Duplicate Item', '2026', 'movie']
    );
  });

  test('retrySingle queues retry with cleanup and optional learning purge', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM classification_history')) {
        return {
          rows: [{
            id: 304,
            tmdb_id: 555,
            media_type: 'movie',
            title: 'Retry Item',
            year: 2026,
            status: 'awaiting_decision',
            retry_count: 2,
            max_retries: 4,
            metadata: '{}'
          }]
        };
      }
      if (sql.includes('UPDATE classification_history') && sql.includes("status = 'reclassified'")) return { rowCount: 1, rows: [] };
      if (sql.includes('INSERT INTO task_queue')) return { rows: [{ id: 9901 }] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    jest.spyOn(service, 'hasPendingClassificationTask').mockResolvedValueOnce(null);
    jest.spyOn(service, 'resolveMediaItemId').mockResolvedValueOnce(7001);
    service.captureRetryLineage.mockResolvedValueOnce({
      original_classification_id: 304,
      media_request_ids: [41, 42],
      webhook_log_ids: [88]
    });
    jest.spyOn(service, 'cleanupClassificationArtifacts').mockResolvedValueOnce();
    jest.spyOn(service, 'cleanupEnrichmentState').mockResolvedValueOnce({
      enrichmentQueueRowsRemoved: 1,
      metadataEnrichmentTasksRemoved: 1,
      enrichmentMetadataReset: true,
      enrichmentCleanupSkipped: null
    });
    evidenceService.purgeEvidence.mockResolvedValueOnce({
      deleted: 1,
      deletedByScope: { item_exact: 1 }
    });
    followupService.enqueueMetadataEnrichmentTask.mockResolvedValueOnce({
      metadataEnrichmentQueued: true,
      metadataEnrichmentTaskId: 9902,
      metadataEnrichmentReason: 'queued'
    });

    const result = await service.retrySingle({
      classificationId: 304,
      actor: 'admin',
      purgeLearning: true,
      correlationId: 'corr-success'
    });

    expect(result).toMatchObject({
      classificationId: 304,
      queued: true,
      reasonCode: 'queued',
      taskId: 9901,
      purgedLearning: true,
      enrichmentQueueRowsRemoved: 1,
      metadataEnrichmentTasksRemoved: 1,
      enrichmentMetadataReset: true,
      metadataEnrichmentQueued: true,
      metadataEnrichmentTaskId: 9902,
      metadataEnrichmentReason: 'queued'
    });
    const classificationEnqueueCall = client.query.mock.calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO task_queue')
    );
    const classificationPayload = JSON.parse(classificationEnqueueCall[1][1]);
    expect(classificationPayload.retry_count).toBe(2);
    expect(classificationPayload.max_retries).toBe(4);
    expect(classificationPayload.retry_lineage).toEqual({
      original_classification_id: 304,
      media_request_ids: [41, 42],
      webhook_log_ids: [88]
    });
    expect(followupService.enqueueMetadataEnrichmentTask).toHaveBeenCalledWith(expect.objectContaining({
      classificationId: 304,
      mediaItemId: 7001,
      metadataEnrichmentSource: 'manual_retry_followup'
    }));
    expect(evidenceService.purgeEvidence).toHaveBeenCalledWith(expect.objectContaining({
      tmdbId: 555,
      mediaType: 'movie',
      scopes: ['item_exact'],
      client,
      actor: 'admin',
      reason: 'classification_retry'
    }));
    expect(mockRecordOutcome).toHaveBeenCalledWith(304, expect.objectContaining({
      type: 'retried',
      source: 'manual_retry',
      actor: 'admin',
      replacement_task_id: 9901,
      purged_learning: true
    }), { client });
    expect(logger.info).toHaveBeenCalledWith('Classification retry queued', expect.objectContaining({
      classificationId: 304,
      taskId: 9901,
      metadataEnrichmentTaskId: 9902,
      metadataEnrichmentQueued: true,
      route: '/api/classification/retry',
      result: 'queued',
      reasonCode: 'queued'
    }));
  });

  test('retrySingle keeps classification queued when follow-up metadata enqueue fails', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM classification_history')) {
        return {
          rows: [{
            id: 306,
            tmdb_id: 777,
            media_type: 'movie',
            title: 'Retry With Metadata Enqueue Failure',
            year: 2026,
            status: 'awaiting_decision',
            metadata: '{}'
          }]
        };
      }
      if (sql.includes('UPDATE classification_history') && sql.includes("status = 'reclassified'")) return { rowCount: 1, rows: [] };
      if (sql.includes('INSERT INTO task_queue')) return { rows: [{ id: 9903 }] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    jest.spyOn(service, 'hasPendingClassificationTask').mockResolvedValueOnce(null);
    jest.spyOn(service, 'resolveMediaItemId').mockResolvedValueOnce(7010);
    jest.spyOn(service, 'cleanupClassificationArtifacts').mockResolvedValueOnce();
    jest.spyOn(service, 'cleanupEnrichmentState').mockResolvedValueOnce({
      enrichmentQueueRowsRemoved: 0,
      metadataEnrichmentTasksRemoved: 0,
      enrichmentMetadataReset: true,
      enrichmentCleanupSkipped: null
    });
    followupService.enqueueMetadataEnrichmentTask.mockResolvedValueOnce({
      metadataEnrichmentQueued: false,
      metadataEnrichmentTaskId: null,
      metadataEnrichmentReason: 'enqueue_failed'
    });

    const result = await service.retrySingle({
      classificationId: 306,
      actor: 'admin',
      purgeLearning: true,
      correlationId: 'corr-metadata-enqueue-failure'
    });

    expect(result).toMatchObject({
      classificationId: 306,
      queued: true,
      reasonCode: 'queued',
      taskId: 9903,
      metadataEnrichmentQueued: false,
      metadataEnrichmentTaskId: null,
      metadataEnrichmentReason: 'enqueue_failed'
    });
    expect(followupService.enqueueMetadataEnrichmentTask).toHaveBeenCalledWith(expect.objectContaining({
      classificationId: 306,
      mediaItemId: 7010
    }));
  });

  test('retrySingle returns failed result and logs error on transaction failure', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM classification_history')) {
        return {
          rows: [{
            id: 305,
            tmdb_id: 556,
            media_type: 'movie',
            title: 'Failure Item',
            year: 2026,
            status: 'awaiting_decision',
            metadata: '{}'
          }]
        };
      }
      if (sql.includes('UPDATE classification_history') && sql.includes("status = 'reclassified'")) return { rowCount: 1, rows: [] };
      if (sql.includes('INSERT INTO task_queue')) throw new Error('insert failed');
      throw new Error(`Unexpected query: ${sql}`);
    });

    jest.spyOn(service, 'hasPendingClassificationTask').mockResolvedValueOnce(null);
    jest.spyOn(service, 'resolveMediaItemId').mockResolvedValueOnce(7002);
    jest.spyOn(service, 'cleanupClassificationArtifacts').mockResolvedValueOnce();
    jest.spyOn(service, 'cleanupEnrichmentState').mockResolvedValueOnce({
      enrichmentQueueRowsRemoved: 0,
      metadataEnrichmentTasksRemoved: 0,
      enrichmentMetadataReset: false,
      enrichmentCleanupSkipped: null
    });

    const result = await service.retrySingle({
      classificationId: 305,
      actor: 'admin',
      purgeLearning: true,
      correlationId: 'corr-failure'
    });

    expect(result).toMatchObject({
      classificationId: 305,
      failed: true,
      reasonCode: 'retry_failed',
      error: 'insert failed'
    });
    expect(db.query).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Classification retry failed', expect.objectContaining({
      classificationId: 305,
      route: '/api/classification/retry',
      result: 'failed',
      reasonCode: 'retry_failed',
      error: 'insert failed'
    }));
  });

  test('resolveMediaItemId uses source_library_id to disambiguate TMDB matches', async () => {
    client.query.mockResolvedValueOnce({ rows: [{ id: 8101 }] });

    const result = await service.resolveMediaItemId(
      client,
      { source_library_id: 77 },
      { tmdbId: 991, mediaType: 'movie', title: 'Duplicated Title', year: '2025' }
    );

    expect(result).toBe(8101);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('AND library_id = $3'),
      [991, 'movie', 77]
    );
  });

  test('captureRetryLineage collects linked media request and webhook ids', async () => {
    service.captureRetryLineage.mockRestore();
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 51 }, { id: 52 }] })
      .mockResolvedValueOnce({ rows: [{ id: 91 }] });

    const result = await service.captureRetryLineage(client, 777);

    expect(result).toEqual({
      original_classification_id: 777,
      media_request_ids: [51, 52],
      webhook_log_ids: [91]
    });
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM media_requests'),
      [777]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM webhook_log'),
      [777]
    );
  });

  test('resolveMediaItemId uses source_library_id to disambiguate title/year fallback matches', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 8102 }] });

    const result = await service.resolveMediaItemId(
      client,
      { source_library_id: 44 },
      { tmdbId: 1234, mediaType: 'movie', title: 'Duplicated Title', year: '2025' }
    );

    expect(result).toBe(8102);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND library_id = $3'),
      [1234, 'movie', 44]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND library_id = $4'),
      ['Duplicated Title', 'movie', '2025', 44]
    );
  });
});
