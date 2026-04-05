/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for ClassificationRetryFollowupService.
 */

const ClassificationRetryFollowupService = require('../../services/classificationRetryFollowupService');

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
}

describe('ClassificationRetryFollowupService', () => {
  let db;
  let logger;
  let service;

  beforeEach(() => {
    db = {
      query: jest.fn()
    };
    logger = createMockLogger();
    service = new ClassificationRetryFollowupService({ db, logger });
  });

  test('skips metadata enrichment when no media item is linked', async () => {
    await expect(service.enqueueMetadataEnrichmentTask({
      classificationId: 10,
      mediaItemId: null,
      retryPayload: {},
      metadata: {},
      actor: 'admin',
      correlationId: 'corr-no-media-item',
      metadataEnrichmentSource: 'manual_retry_followup',
      route: '/api/classification/retry'
    })).resolves.toEqual({
      metadataEnrichmentQueued: false,
      metadataEnrichmentTaskId: null,
      metadataEnrichmentReason: 'no_media_item_link'
    });

    expect(db.query).not.toHaveBeenCalled();
  });

  test('queues metadata enrichment when payload can be built', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 7001 }] });

    const result = await service.enqueueMetadataEnrichmentTask({
      classificationId: 11,
      mediaItemId: 91,
      retryPayload: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Queued Follow-up',
        year: 2026
      },
      metadata: {},
      actor: 'admin',
      correlationId: 'corr-followup-success',
      metadataEnrichmentSource: 'manual_retry_followup',
      route: '/api/classification/retry'
    });

    expect(result).toEqual({
      metadataEnrichmentQueued: true,
      metadataEnrichmentTaskId: 7001,
      metadataEnrichmentReason: 'queued'
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO task_queue'),
      expect.arrayContaining(['metadata_enrichment', expect.any(String), 1, 'manual_retry_followup', 5])
    );
  });

  test('logs and returns enqueue_failed when follow-up enqueue throws', async () => {
    db.query.mockRejectedValueOnce(new Error('metadata enqueue failed'));

    const result = await service.enqueueMetadataEnrichmentTask({
      classificationId: 12,
      mediaItemId: 92,
      retryPayload: {
        tmdb_id: 124,
        media_type: 'movie',
        title: 'Failed Follow-up',
        year: 2026
      },
      metadata: {},
      actor: 'admin',
      correlationId: 'corr-followup-failure',
      metadataEnrichmentSource: 'manual_retry_followup',
      route: '/api/classification/retry'
    });

    expect(result).toEqual({
      metadataEnrichmentQueued: false,
      metadataEnrichmentTaskId: null,
      metadataEnrichmentReason: 'enqueue_failed'
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Metadata enrichment enqueue skipped after classification retry',
      expect.objectContaining({
        classificationId: 12,
        result: 'skipped',
        reasonCode: 'metadata_enqueue_failed'
      })
    );
  });
});
