/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for ClassificationRetryService.
 */

jest.mock('../../config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
}));

const { ClassificationRetryService } = require('../../services/classificationRetryService');

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
    service = new ClassificationRetryService({ db, logger });
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
    expect(client.release).toHaveBeenCalledTimes(1);
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

  test('retrySingle skips when classification is not found', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM classification_history')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await service.retrySingle(client, {
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
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
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

    const result = await service.retrySingle(client, {
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
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
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

    const result = await service.retrySingle(client, {
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
            metadata: '{}'
          }]
        };
      }
      if (sql.includes('DELETE FROM learning_patterns')) return { rowCount: 1, rows: [] };
      if (sql.includes('DELETE FROM classification_history')) return { rowCount: 1, rows: [] };
      if (sql.includes('INSERT INTO task_queue')) return { rows: [{ id: 9901 }] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    jest.spyOn(service, 'hasPendingClassificationTask').mockResolvedValueOnce(null);
    jest.spyOn(service, 'resolveMediaItemId').mockResolvedValueOnce(7001);
    jest.spyOn(service, 'cleanupClassificationArtifacts').mockResolvedValueOnce();
    jest.spyOn(service, 'cleanupEnrichmentState').mockResolvedValueOnce({
      enrichmentQueueRowsRemoved: 1,
      metadataEnrichmentTasksRemoved: 1,
      enrichmentMetadataReset: true,
      enrichmentCleanupSkipped: null
    });
    db.query.mockResolvedValueOnce({ rows: [{ id: 9902 }] });

    const result = await service.retrySingle(client, {
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
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO task_queue'),
      expect.arrayContaining(['metadata_enrichment', expect.any(String), 1, 'manual_retry_followup', 5])
    );
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
      if (sql.includes('DELETE FROM learning_patterns')) return { rowCount: 0, rows: [] };
      if (sql.includes('DELETE FROM classification_history')) return { rowCount: 1, rows: [] };
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
    db.query.mockRejectedValueOnce(new Error('metadata enqueue failed'));

    const result = await service.retrySingle(client, {
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
    expect(logger.warn).toHaveBeenCalledWith(
      'Metadata enrichment enqueue skipped after classification retry',
      expect.objectContaining({
        classificationId: 306,
        reasonCode: 'metadata_enqueue_failed',
        result: 'skipped'
      })
    );
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
      if (sql.includes('DELETE FROM learning_patterns')) return { rowCount: 0, rows: [] };
      if (sql.includes('DELETE FROM classification_history')) return { rowCount: 1, rows: [] };
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

    const result = await service.retrySingle(client, {
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
});
