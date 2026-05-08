/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Integration tests for classification retry cleanup and enqueue behavior.
 */

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');
const { queueService } = await import('../../services/queueService.mjs');

describe('ClassificationRetryService integration', () => {
  let pool;
  let logger;
  let service;

  beforeAll(() => {
    pool = getPool();
  });

  beforeEach(async () => {
    logger = createMockLogger();
    service = new ClassificationRetryService({ db, logger });

    await pool.query(`
      TRUNCATE TABLE
        app_notifications,
        enrichment_retry_queue,
        task_queue,
        media_requests,
        webhook_log,
        learning_patterns,
        classification_history,
        media_server_items,
        libraries,
        media_server
      RESTART IDENTITY CASCADE
    `);
  });

  async function seedBaseEntities({ suffix = 'a', mediaType = 'movie' } = {}) {
    const mediaServer = await pool.query(
      `INSERT INTO media_server (name, type, url, api_key, is_active)
       VALUES ($1, 'plex', 'http://localhost:32400', 'integration-key', true)
       RETURNING id`,
      [`retry-int-server-${suffix}`]
    );
    const mediaServerId = mediaServer.rows[0].id;

    const library = await pool.query(
      `INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active, priority)
       VALUES ($1, $2, $3, $4, true, 5)
       RETURNING id`,
      [mediaServerId, `retry-int-lib-${suffix}`, `Retry Integration ${suffix}`, mediaType]
    );

    return {
      mediaServerId,
      libraryId: library.rows[0].id,
    };
  }

  test('retries awaiting_decision item, cleans related state, and keeps unrelated enrichment rows', async () => {
    const { mediaServerId, libraryId } = await seedBaseEntities({ suffix: 'cleanup', mediaType: 'movie' });

    const primaryMedia = await pool.query(
      `INSERT INTO media_server_items (
         media_server_id, library_id, external_id, tmdb_id, title, year, media_type, metadata, enrichment_status
       )
       VALUES ($1, $2, 'primary-item', 880001, 'Retry Integration Primary', 2026, 'movie',
         $3::jsonb, 'completed')
       RETURNING id`,
      [mediaServerId, libraryId, JSON.stringify({
        omdb: { imdbRating: '7.1' },
        tavily_imdb: { score: 0.82 },
        tavily_advisory: { value: 'PG-13' }
      })]
    );
    const primaryMediaItemId = primaryMedia.rows[0].id;

    const unrelatedMedia = await pool.query(
      `INSERT INTO media_server_items (
         media_server_id, library_id, external_id, tmdb_id, title, year, media_type, metadata, enrichment_status
       )
       VALUES ($1, $2, 'unrelated-item', 880002, 'Retry Integration Unrelated', 2026, 'movie',
         $3::jsonb, 'completed')
       RETURNING id`,
      [mediaServerId, libraryId, JSON.stringify({
        omdb: { imdbRating: '8.2' },
        tavily_imdb: { score: 0.91 }
      })]
    );
    const unrelatedMediaItemId = unrelatedMedia.rows[0].id;

    const classificationInsert = await pool.query(
      `INSERT INTO classification_history (
         tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status
       )
       VALUES (
         880001, 'movie', 'Retry Integration Primary', 2026, $1, 'Retry Integration cleanup',
         42.0, 'existing_media', 'Needs manual decision', $2::jsonb, 'awaiting_decision'
       )
       RETURNING id`,
      [libraryId, JSON.stringify({
        itemId: primaryMediaItemId,
        media_type: 'movie',
        tmdb_id: 880001,
        title: 'Retry Integration Primary',
        year: 2026
      })]
    );
    const oldClassificationId = classificationInsert.rows[0].id;

    await pool.query(
      `INSERT INTO media_requests (title, media_type, tmdb_id, classification_id)
       VALUES ('Retry Integration Primary', 'movie', 880001, $1)`,
      [oldClassificationId]
    );
    await pool.query(
      `INSERT INTO webhook_log (media_title, media_type, tmdb_id, classification_id)
       VALUES ('Retry Integration Primary', 'movie', 880001, $1)`,
      [oldClassificationId]
    );
    await pool.query(
      `INSERT INTO app_notifications (type, title, message, data)
       VALUES ('warning', 'Pending decision', 'Needs review', $1::jsonb)`,
      [JSON.stringify({ classificationId: oldClassificationId })]
    );
    await pool.query(
      `INSERT INTO learning_patterns (
         tmdb_id, media_type, library_id, pattern_type, pattern_data, confidence, created_by
       )
       VALUES (880001, 'movie', $1, 'exact_match', '{"source":"integration"}'::jsonb, 95.0, 'integration')`,
      [libraryId]
    );

    await pool.query(
      `INSERT INTO enrichment_retry_queue (media_item_id, enrichment_type, status, reason)
       VALUES ($1, 'tavily', 'pending', 'OMDb not found')`,
      [primaryMediaItemId]
    );
    await pool.query(
      `INSERT INTO enrichment_retry_queue (media_item_id, enrichment_type, status, reason)
       VALUES ($1, 'tavily', 'pending', 'Unrelated keep')`,
      [unrelatedMediaItemId]
    );

    await pool.query(
      `INSERT INTO task_queue (task_type, payload, status, source)
       VALUES ('metadata_enrichment', $1::jsonb, 'pending', 'integration')`,
      [JSON.stringify({ itemId: primaryMediaItemId, enrichment: 'omdb' })]
    );
    await pool.query(
      `INSERT INTO task_queue (task_type, payload, status, source)
       VALUES ('metadata_enrichment', $1::jsonb, 'pending', 'integration')`,
      [JSON.stringify({ itemId: unrelatedMediaItemId, enrichment: 'omdb' })]
    );

    const response = await service.retryClassifications({
      classificationIds: [oldClassificationId],
      actor: 'integration-admin',
      purgeLearning: true,
      correlationId: 'retry-int-cleanup'
    });

    expect(response).toMatchObject({
      requested: 1,
      queued: 1,
      skipped: 0,
      failed: 0
    });
    expect(response.results[0]).toMatchObject({
      classificationId: oldClassificationId,
      queued: true,
      reasonCode: 'queued',
      purgedLearning: true,
      enrichmentQueueRowsRemoved: 1,
      metadataEnrichmentTasksRemoved: 1,
      enrichmentMetadataReset: true,
      enrichmentCleanupSkipped: null,
      metadataEnrichmentQueued: true,
      metadataEnrichmentTaskId: expect.any(Number),
      metadataEnrichmentReason: 'queued'
    });

    const oldClassification = await pool.query(
      `SELECT id,
              status,
              metadata->'classification_details'->'outcome_link' AS outcome_link
       FROM classification_history
       WHERE id = $1`,
      [oldClassificationId]
    );
    expect(oldClassification.rows).toHaveLength(1);
    expect(oldClassification.rows[0].status).toBe('reclassified');
    expect(oldClassification.rows[0].outcome_link).toEqual(
      expect.objectContaining({
        type: 'retried',
        source: 'manual_retry',
        actor: 'integration-admin',
        replacement_task_id: expect.any(Number),
        purged_learning: true
      })
    );

    const newClassificationTask = await pool.query(
      `SELECT id, task_type, status, source, payload
       FROM task_queue
       WHERE task_type = 'classification'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    expect(newClassificationTask.rows).toHaveLength(1);
    expect(newClassificationTask.rows[0].source).toBe('manual_retry');
    expect(newClassificationTask.rows[0].status).toBe('pending');
    expect(newClassificationTask.rows[0].payload.tmdb_id).toBe(880001);

    const requestLink = await pool.query(
      'SELECT classification_id FROM media_requests WHERE tmdb_id = 880001'
    );
    expect(requestLink.rows[0].classification_id).toBeNull();

    const webhookLink = await pool.query(
      'SELECT classification_id FROM webhook_log WHERE tmdb_id = 880001'
    );
    expect(webhookLink.rows[0].classification_id).toBeNull();

    const staleNotification = await pool.query(
      `SELECT id
       FROM app_notifications
       WHERE data ? 'classificationId'
         AND (data->>'classificationId') ~ '^[0-9]+$'
         AND (data->>'classificationId')::int = $1`,
      [oldClassificationId]
    );
    expect(staleNotification.rows).toHaveLength(0);

    const learningPattern = await pool.query(
      `SELECT id FROM learning_patterns
       WHERE tmdb_id = 880001 AND media_type = 'movie' AND pattern_type = 'exact_match'`
    );
    expect(learningPattern.rows).toHaveLength(0);

    const primaryRetryRow = await pool.query(
      'SELECT id FROM enrichment_retry_queue WHERE media_item_id = $1',
      [primaryMediaItemId]
    );
    expect(primaryRetryRow.rows).toHaveLength(0);

    const unrelatedRetryRow = await pool.query(
      'SELECT id FROM enrichment_retry_queue WHERE media_item_id = $1',
      [unrelatedMediaItemId]
    );
    expect(unrelatedRetryRow.rows).toHaveLength(1);

    const primaryMetadataTask = await pool.query(
      `SELECT id, source, priority
       FROM task_queue
       WHERE task_type = 'metadata_enrichment'
         AND (
           ((payload->>'itemId') ~ '^[0-9]+$' AND (payload->>'itemId')::int = $1)
           OR ((payload->>'media_item_id') ~ '^[0-9]+$' AND (payload->>'media_item_id')::int = $1)
         )`,
      [primaryMediaItemId]
    );
    expect(primaryMetadataTask.rows).toHaveLength(1);
    expect(primaryMetadataTask.rows[0].source).toBe('manual_retry_followup');
    expect(primaryMetadataTask.rows[0].priority).toBe(1);

    const unrelatedMetadataTask = await pool.query(
      `SELECT id
       FROM task_queue
       WHERE task_type = 'metadata_enrichment'
         AND (
           ((payload->>'itemId') ~ '^[0-9]+$' AND (payload->>'itemId')::int = $1)
           OR ((payload->>'media_item_id') ~ '^[0-9]+$' AND (payload->>'media_item_id')::int = $1)
         )`,
      [unrelatedMediaItemId]
    );
    expect(unrelatedMetadataTask.rows).toHaveLength(1);

    const primaryMetadata = await pool.query(
      `SELECT enrichment_status, (metadata ? 'omdb') AS has_omdb, (metadata ? 'tavily_imdb') AS has_tavily_imdb
       FROM media_server_items
       WHERE id = $1`,
      [primaryMediaItemId]
    );
    expect(primaryMetadata.rows[0]).toMatchObject({
      enrichment_status: 'pending',
      has_omdb: false,
      has_tavily_imdb: false
    });

    const unrelatedMetadata = await pool.query(
      `SELECT enrichment_status, (metadata ? 'omdb') AS has_omdb, (metadata ? 'tavily_imdb') AS has_tavily_imdb
       FROM media_server_items
       WHERE id = $1`,
      [unrelatedMediaItemId]
    );
    expect(unrelatedMetadata.rows[0].has_omdb).toBe(true);
    expect(unrelatedMetadata.rows[0].has_tavily_imdb).toBe(true);
  });

  test('queues retry when media item link cannot be resolved and reports cleanup skipped reason', async () => {
    const { libraryId } = await seedBaseEntities({ suffix: 'nolink', mediaType: 'tv' });

    const classificationInsert = await pool.query(
      `INSERT INTO classification_history (
         tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status
       )
       VALUES (
         881001, 'tv', 'Retry Integration No Link', 2024, $1, 'Retry Integration nolink',
         31.0, 'existing_media', 'Awaiting decision', $2::jsonb, 'awaiting_decision'
       )
       RETURNING id`,
      [libraryId, JSON.stringify({
        media_type: 'tv',
        tmdb_id: 881001,
        title: 'Retry Integration No Link',
        year: 2024
      })]
    );
    const oldClassificationId = classificationInsert.rows[0].id;

    const response = await service.retryClassifications({
      classificationIds: [oldClassificationId],
      actor: 'integration-admin',
      purgeLearning: false,
      correlationId: 'retry-int-no-link'
    });

    expect(response).toMatchObject({
      requested: 1,
      queued: 1,
      skipped: 0,
      failed: 0
    });
    expect(response.results[0]).toMatchObject({
      classificationId: oldClassificationId,
      queued: true,
      reasonCode: 'queued',
      enrichmentCleanupSkipped: 'no_media_item_link',
      metadataEnrichmentQueued: false,
      metadataEnrichmentTaskId: null,
      metadataEnrichmentReason: 'no_media_item_link'
    });

    const newTask = await pool.query(
      `SELECT task_type, source, payload
       FROM task_queue
       WHERE task_type = 'classification'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    expect(newTask.rows[0].source).toBe('manual_retry');
    expect(newTask.rows[0].payload.media_type).toBe('tv');
  });

  test('skips retry when duplicate pending classification task already exists for same identity', async () => {
    const { libraryId } = await seedBaseEntities({ suffix: 'duplicate', mediaType: 'movie' });

    const classificationInsert = await pool.query(
      `INSERT INTO classification_history (
         tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status
       )
       VALUES (
         882001, 'movie', 'Retry Integration Duplicate', 2025, $1, 'Retry Integration duplicate',
         29.0, 'existing_media', 'Awaiting decision', $2::jsonb, 'awaiting_decision'
       )
       RETURNING id`,
      [libraryId, JSON.stringify({
        media_type: 'movie',
        tmdb_id: 882001,
        title: 'Retry Integration Duplicate',
        year: 2025
      })]
    );
    const oldClassificationId = classificationInsert.rows[0].id;

    await pool.query(
      `INSERT INTO task_queue (task_type, payload, status, source)
       VALUES ('classification', $1::jsonb, 'pending', 'webhook')`,
      [JSON.stringify({
        media_type: 'movie',
        tmdb_id: 882001,
        title: 'Retry Integration Duplicate',
        year: 2025,
        media: {
          media_type: 'movie',
          tmdbId: 882001,
          title: 'Retry Integration Duplicate',
          year: 2025
        }
      })]
    );

    const response = await service.retryClassifications({
      classificationIds: [oldClassificationId],
      actor: 'integration-admin',
      purgeLearning: true,
      correlationId: 'retry-int-duplicate'
    });

    expect(response).toMatchObject({
      requested: 1,
      queued: 0,
      skipped: 1,
      failed: 0
    });
    expect(response.results[0]).toMatchObject({
      classificationId: oldClassificationId,
      skipped: true,
      reasonCode: 'duplicate_pending_task'
    });

    const oldClassification = await pool.query(
      'SELECT id FROM classification_history WHERE id = $1',
      [oldClassificationId]
    );
    expect(oldClassification.rows).toHaveLength(1);

    const queuedClassificationTasks = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM task_queue
       WHERE task_type = 'classification'
         AND status = 'pending'`
    );
    expect(queuedClassificationTasks.rows[0].count).toBe(1);
  });

  test('concurrent retries for the same classification queue only one task', async () => {
    const { libraryId } = await seedBaseEntities({ suffix: 'concurrent', mediaType: 'movie' });

    const classificationInsert = await pool.query(
      `INSERT INTO classification_history (
         tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status
       )
       VALUES (
         883001, 'movie', 'Retry Integration Concurrent', 2025, $1, 'Retry Integration concurrent',
         35.0, 'existing_media', 'Awaiting decision', $2::jsonb, 'awaiting_decision'
       )
       RETURNING id`,
      [libraryId, JSON.stringify({
        media_type: 'movie',
        tmdb_id: 883001,
        title: 'Retry Integration Concurrent',
        year: 2025
      })]
    );
    const oldClassificationId = classificationInsert.rows[0].id;

    const [first, second] = await Promise.all([
      service.retryClassifications({
        classificationIds: [oldClassificationId],
        actor: 'integration-admin-a',
        purgeLearning: true,
        correlationId: 'retry-int-concurrent-a'
      }),
      service.retryClassifications({
        classificationIds: [oldClassificationId],
        actor: 'integration-admin-b',
        purgeLearning: true,
        correlationId: 'retry-int-concurrent-b'
      })
    ]);

    const allResults = [...first.results, ...second.results];
    const queuedResults = allResults.filter((result) => result.queued === true);
    const skippedResults = allResults.filter((result) => result.skipped === true);
    const failedResults = allResults.filter((result) => result.failed === true);

    expect(queuedResults.length).toBe(1);
    expect(failedResults.length).toBe(0);
    expect(skippedResults.length).toBe(1);
    expect(['status_ineligible', 'duplicate_pending_task']).toContain(skippedResults[0].reasonCode);

    const queuedClassificationTasks = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM task_queue
       WHERE task_type = 'classification'
         AND status = 'pending'`
    );
    expect(queuedClassificationTasks.rows[0].count).toBe(1);
  });

  test('preserves queue ordering semantics with webhook burst plus retry enqueue', async () => {
    const { libraryId } = await seedBaseEntities({ suffix: 'ordering', mediaType: 'movie' });

    const classificationInsert = await pool.query(
      `INSERT INTO classification_history (
         tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status
       )
       VALUES (
         884001, 'movie', 'Retry Integration Ordering', 2026, $1, 'Retry Integration ordering',
         40.0, 'existing_media', 'Awaiting decision', $2::jsonb, 'awaiting_decision'
       )
       RETURNING id`,
      [libraryId, JSON.stringify({
        media_type: 'movie',
        tmdb_id: 884001,
        title: 'Retry Integration Ordering',
        year: 2026
      })]
    );
    const retryClassificationId = classificationInsert.rows[0].id;

    const webhookTaskLowPriority = await queueService.enqueue(
      'classification',
      { title: 'Webhook Burst A', tmdb_id: 990001, media_type: 'movie' },
      { source: 'webhook', priority: 0 }
    );

    const webhookTaskDefaultPriority = await queueService.enqueue(
      'classification',
      { title: 'Webhook Burst B', tmdb_id: 990002, media_type: 'movie' },
      { source: 'webhook' }
    );

    const retryResponse = await service.retryClassifications({
      classificationIds: [retryClassificationId],
      actor: 'integration-admin',
      purgeLearning: false,
      correlationId: 'retry-int-ordering'
    });

    expect(retryResponse.queued).toBe(1);
    expect(webhookTaskLowPriority).toEqual(expect.any(Number));
    expect(webhookTaskDefaultPriority).toEqual(expect.any(Number));

    const orderedTasks = await pool.query(
      `SELECT id, source, priority, payload->>'title' AS title
       FROM task_queue
       WHERE task_type = 'classification'
         AND status = 'pending'
       ORDER BY priority DESC, created_at ASC`
    );

    expect(orderedTasks.rows).toEqual([
      expect.objectContaining({ source: 'manual_retry', priority: 2, title: 'Retry Integration Ordering' }),
      expect.objectContaining({ source: 'webhook', priority: 0, title: 'Webhook Burst A' }),
      expect.objectContaining({ source: 'webhook', priority: 0, title: 'Webhook Burst B' })
    ]);
  });
});
