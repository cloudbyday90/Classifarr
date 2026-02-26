/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Retry + reset service for pending classifications.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ClassificationRetryService');

const MAX_BATCH_SIZE = 100;
const ELIGIBLE_STATUSES = new Set(['awaiting_decision', 'pending_retry']);
const RETRY_ROUTE = '/api/classification/retry';

function isFinitePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0;
}

function toPositiveInt(value) {
  return isFinitePositiveInt(value) ? Number.parseInt(value, 10) : null;
}

function safeParseJsonObject(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const asString = String(value).trim();
  return asString.length > 0 ? asString : null;
}

function buildRetryPayload(row, metadata, mediaItemId) {
  const mediaType = row.media_type || metadata.media_type || 'movie';
  const tmdbId = toPositiveInt(row.tmdb_id ?? metadata.tmdb_id ?? metadata.tmdbId);
  const tvdbId = toPositiveInt(metadata.tvdb_id ?? metadata.tvdbId);
  const year = row.year || metadata.year || null;
  const requestedSeasons = Array.isArray(metadata.requested_seasons) ? metadata.requested_seasons : null;
  const payload = {
    title: row.title || metadata.title || 'Unknown',
    year,
    tmdb_id: tmdbId,
    media_type: mediaType,
    overview: metadata.overview || '',
    genres: Array.isArray(metadata.genres) ? metadata.genres : [],
    keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
    content_rating: metadata.content_rating || metadata.certification || null,
    original_language: metadata.original_language || 'en',
    requested_seasons: requestedSeasons,
    include_specials: metadata.include_specials === true,
    source_library_id: toPositiveInt(metadata.source_library_id),
    source_library_name: metadata.source_library_name || null,
    itemId: toPositiveInt(mediaItemId || metadata.itemId || metadata.item_id || metadata.media_item_id),
    media: {
      media_type: mediaType,
      tmdbId,
      tvdbId,
      title: row.title || metadata.title || null,
      year,
    }
  };

  if (!requestedSeasons) delete payload.requested_seasons;
  if (!payload.itemId) delete payload.itemId;

  return payload;
}

function buildMetadataEnrichmentPayload(retryPayload, metadata, mediaItemId) {
  if (!mediaItemId) return null;

  return {
    title: retryPayload.title,
    year: retryPayload.year || null,
    overview: retryPayload.overview || '',
    genres: Array.isArray(retryPayload.genres) ? retryPayload.genres : [],
    keywords: Array.isArray(retryPayload.keywords) ? retryPayload.keywords : [],
    content_rating: retryPayload.content_rating || null,
    original_language: retryPayload.original_language || 'en',
    tmdb_id: retryPayload.tmdb_id || null,
    tvdb_id: retryPayload.media?.tvdbId || null,
    imdb_id: metadata.imdb_id || metadata.imdbId || null,
    posterPath: metadata.posterPath || null,
    itemId: mediaItemId,
    source_library_id: retryPayload.source_library_id || null,
    source_library_name: retryPayload.source_library_name || null,
    media: {
      media_type: retryPayload.media_type || 'movie'
    }
  };
}

function getIdentity(row, metadata) {
  const tmdbId = toPositiveInt(row.tmdb_id ?? metadata.tmdb_id ?? metadata.tmdbId);
  const mediaType = row.media_type || metadata.media_type || 'movie';
  const title = normalizeTitle(row.title || metadata.title);
  const year = normalizeYear(row.year || metadata.year);
  return {
    tmdbId,
    mediaType,
    title,
    year,
  };
}

class ClassificationRetryService {
  constructor(deps = {}) {
    this.db = deps.db || db;
    this.logger = deps.logger || logger;
  }

  normalizeIds(rawIds) {
    if (!Array.isArray(rawIds)) {
      return { error: 'classificationIds must be an array', ids: [] };
    }
    if (rawIds.length === 0) {
      return { error: 'classificationIds must contain at least one id', ids: [] };
    }
    if (rawIds.length > MAX_BATCH_SIZE) {
      return { error: `classificationIds exceeds maximum batch size (${MAX_BATCH_SIZE})`, ids: [] };
    }

    const deduped = [];
    const seen = new Set();

    for (const rawId of rawIds) {
      const id = toPositiveInt(rawId);
      if (!id) return { error: 'classificationIds must contain only positive integers', ids: [] };
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(id);
      }
    }

    return { error: null, ids: deduped };
  }

  async retryClassifications({ classificationIds, actor = 'admin', purgeLearning = true, correlationId = null } = {}) {
    const normalized = this.normalizeIds(classificationIds);
    if (normalized.error) {
      const validationError = new Error(normalized.error);
      validationError.code = 'VALIDATION_ERROR';
      throw validationError;
    }

    const ids = normalized.ids;
    const startedAt = Date.now();
    const results = [];

    this.logger.info('Classification retry requested', {
      correlationId,
      actor,
      batchSize: ids.length,
      route: RETRY_ROUTE,
      result: 'request_accepted'
    });

    const client = await this.db.pool.connect();
    try {
      for (const classificationId of ids) {
        // eslint-disable-next-line no-await-in-loop
        const itemResult = await this.retrySingle(client, { classificationId, actor, purgeLearning, correlationId });
        results.push(itemResult);
      }
    } finally {
      client.release();
    }

    const queued = results.filter(row => row.queued === true).length;
    const skipped = results.filter(row => row.skipped === true).length;
    const failed = results.filter(row => row.failed === true).length;

    this.logger.info('Classification retry batch completed', {
      correlationId,
      actor,
      route: RETRY_ROUTE,
      batchSize: ids.length,
      queued,
      skipped,
      failed,
      result: 'batch_completed',
      durationMs: Date.now() - startedAt
    });

    return {
      correlationId,
      requested: ids.length,
      queued,
      skipped,
      failed,
      results
    };
  }

  async hasPendingClassificationTask(client, identity) {
    if (identity.tmdbId) {
      const result = await client.query(
        `SELECT id, status
         FROM task_queue
         WHERE task_type = 'classification'
           AND status IN ('pending', 'processing')
           AND COALESCE(payload->'media'->>'media_type', payload->>'media_type', 'movie') = $2
           AND (
             ((payload->'media'->>'tmdbId') ~ '^[0-9]+$' AND (payload->'media'->>'tmdbId')::int = $1)
             OR ((payload->>'tmdb_id') ~ '^[0-9]+$' AND (payload->>'tmdb_id')::int = $1)
           )
         ORDER BY created_at ASC
         LIMIT 1`,
        [identity.tmdbId, identity.mediaType]
      );
      return result.rows[0] || null;
    }

    if (!identity.title) return null;

    const result = await client.query(
      `SELECT id, status
       FROM task_queue
       WHERE task_type = 'classification'
         AND status IN ('pending', 'processing')
         AND COALESCE(payload->'media'->>'media_type', payload->>'media_type', 'movie') = $3
         AND LOWER(TRIM(COALESCE(payload->>'title', payload->>'subject', payload->'media'->>'title', ''))) = $1
         AND COALESCE(NULLIF(COALESCE(payload->>'year', payload->'media'->>'year', ''), ''), '') = COALESCE($2, '')
       ORDER BY created_at ASC
       LIMIT 1`,
      [identity.title, identity.year, identity.mediaType]
    );

    return result.rows[0] || null;
  }

  async resolveMediaItemId(client, metadata, identity) {
    const fromMetadata = toPositiveInt(metadata.itemId || metadata.item_id || metadata.media_item_id);
    if (fromMetadata) return fromMetadata;

    if (identity.tmdbId) {
      const byTmdb = await client.query(
        `SELECT id
         FROM media_server_items
         WHERE tmdb_id = $1
           AND media_type = $2
         ORDER BY last_synced DESC NULLS LAST, id DESC
         LIMIT 1`,
        [identity.tmdbId, identity.mediaType]
      );
      if (byTmdb.rows[0]?.id) return byTmdb.rows[0].id;
    }

    if (!identity.title) return null;

    const byTitle = await client.query(
      `SELECT id
       FROM media_server_items
       WHERE LOWER(TRIM(title)) = $1
         AND media_type = $2
         AND COALESCE(NULLIF(year::text, ''), '') = COALESCE($3, '')
       ORDER BY last_synced DESC NULLS LAST, id DESC
       LIMIT 1`,
      [identity.title, identity.mediaType, identity.year]
    );
    return byTitle.rows[0]?.id || null;
  }

  async cleanupClassificationArtifacts(client, classificationId) {
    await client.query('UPDATE media_requests SET classification_id = NULL WHERE classification_id = $1', [classificationId]);
    await client.query('UPDATE webhook_log SET classification_id = NULL WHERE classification_id = $1', [classificationId]);
    await client.query(
      `DELETE FROM app_notifications
       WHERE data IS NOT NULL
         AND (
           (data ? 'classificationId' AND (data->>'classificationId') ~ '^[0-9]+$' AND (data->>'classificationId')::int = $1)
           OR (data ? 'classification_id' AND (data->>'classification_id') ~ '^[0-9]+$' AND (data->>'classification_id')::int = $1)
         )`,
      [classificationId]
    );
    await client.query('DELETE FROM clarification_responses WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM content_analysis_log WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM classification_corrections WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM classification_embeddings WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM embedding_retry_queue WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM embedding_errors WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM pattern_match_log WHERE classification_id = $1', [classificationId]);
  }

  async cleanupEnrichmentState(client, mediaItemId) {
    if (!mediaItemId) {
      return {
        enrichmentQueueRowsRemoved: 0,
        metadataEnrichmentTasksRemoved: 0,
        enrichmentMetadataReset: false,
        enrichmentCleanupSkipped: 'no_media_item_link',
      };
    }

    const retryQueueResult = await client.query(
      `DELETE FROM enrichment_retry_queue
       WHERE media_item_id = $1`,
      [mediaItemId]
    );

    const metadataTaskResult = await client.query(
      `DELETE FROM task_queue
       WHERE task_type = 'metadata_enrichment'
         AND status IN ('pending', 'processing')
         AND (
           ((payload->>'itemId') ~ '^[0-9]+$' AND (payload->>'itemId')::int = $1)
           OR ((payload->>'media_item_id') ~ '^[0-9]+$' AND (payload->>'media_item_id')::int = $1)
         )`,
      [mediaItemId]
    );

    const metadataResetResult = await client.query(
      `UPDATE media_server_items
       SET metadata = (
         COALESCE(metadata, '{}'::jsonb)
         - 'omdb'
         - 'tavily_imdb'
         - 'tavily_advisory'
         - 'tavily_content_type'
         - 'tavily_holiday'
         - 'tavily_anime'
       ),
           enrichment_status = 'pending'
       WHERE id = $1`,
      [mediaItemId]
    );

    return {
      enrichmentQueueRowsRemoved: retryQueueResult.rowCount || 0,
      metadataEnrichmentTasksRemoved: metadataTaskResult.rowCount || 0,
      enrichmentMetadataReset: (metadataResetResult.rowCount || 0) > 0,
      enrichmentCleanupSkipped: null,
    };
  }

  async enqueueMetadataEnrichmentTask({ classificationId, mediaItemId, retryPayload, metadata, actor, correlationId }) {
    if (!mediaItemId) {
      return {
        metadataEnrichmentQueued: false,
        metadataEnrichmentTaskId: null,
        metadataEnrichmentReason: 'no_media_item_link'
      };
    }

    const enrichmentPayload = buildMetadataEnrichmentPayload(retryPayload, metadata, mediaItemId);
    if (!enrichmentPayload) {
      return {
        metadataEnrichmentQueued: false,
        metadataEnrichmentTaskId: null,
        metadataEnrichmentReason: 'payload_unavailable'
      };
    }

    try {
      const result = await this.db.query(
        `INSERT INTO task_queue (task_type, payload, priority, source, max_attempts)
         VALUES ($1, $2::jsonb, $3, $4, $5)
         RETURNING id`,
        ['metadata_enrichment', JSON.stringify(enrichmentPayload), 1, 'manual_retry_followup', 5]
      );

      const taskId = result.rows[0]?.id || null;
      return {
        metadataEnrichmentQueued: Boolean(taskId),
        metadataEnrichmentTaskId: taskId,
        metadataEnrichmentReason: taskId ? 'queued' : 'not_queued'
      };
    } catch (error) {
      this.logger.warn('Metadata enrichment enqueue skipped after classification retry', {
        correlationId,
        actor,
        route: RETRY_ROUTE,
        classificationId,
        mediaItemId,
        result: 'skipped',
        reasonCode: 'metadata_enqueue_failed',
        error: error.message
      });
      return {
        metadataEnrichmentQueued: false,
        metadataEnrichmentTaskId: null,
        metadataEnrichmentReason: 'enqueue_failed'
      };
    }
  }

  async retrySingle(client, { classificationId, actor, purgeLearning, correlationId }) {
    const baseResult = {
      classificationId,
      queued: false,
      skipped: false,
      failed: false,
      reasonCode: null,
      taskId: null,
      purgedLearning: false,
      enrichmentQueueRowsRemoved: 0,
      metadataEnrichmentTasksRemoved: 0,
      enrichmentMetadataReset: false,
      enrichmentCleanupSkipped: null,
      metadataEnrichmentQueued: false,
      metadataEnrichmentTaskId: null,
      metadataEnrichmentReason: null,
      oldClassificationId: classificationId,
      newClassificationId: null,
      error: null,
    };

    try {
      await client.query('BEGIN');

      const rowResult = await client.query(
        `SELECT id, tmdb_id, media_type, title, year, status, metadata
         FROM classification_history
         WHERE id = $1
         FOR UPDATE`,
        [classificationId]
      );

      const row = rowResult.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        this.logger.warn('Classification retry skipped: not found', {
          correlationId,
          actor,
          route: RETRY_ROUTE,
          classificationId,
          result: 'skipped',
          reasonCode: 'not_found'
        });
        return { ...baseResult, skipped: true, reasonCode: 'not_found' };
      }

      if (!ELIGIBLE_STATUSES.has(row.status)) {
        await client.query('ROLLBACK');
        this.logger.warn('Classification retry skipped: status ineligible', {
          correlationId,
          actor,
          route: RETRY_ROUTE,
          classificationId,
          result: 'skipped',
          status: row.status,
          reasonCode: 'status_ineligible'
        });
        return { ...baseResult, skipped: true, reasonCode: 'status_ineligible' };
      }

      const metadata = safeParseJsonObject(row.metadata, {});
      const identity = getIdentity(row, metadata);
      const existingTask = await this.hasPendingClassificationTask(client, identity);
      if (existingTask) {
        await client.query('ROLLBACK');
        this.logger.warn('Classification retry skipped: duplicate pending task', {
          correlationId,
          actor,
          route: RETRY_ROUTE,
          classificationId,
          result: 'skipped',
          existingTaskId: existingTask.id,
          existingTaskStatus: existingTask.status,
          reasonCode: 'duplicate_pending_task'
        });
        return { ...baseResult, skipped: true, reasonCode: 'duplicate_pending_task' };
      }

      const mediaItemId = await this.resolveMediaItemId(client, metadata, identity);

      await this.cleanupClassificationArtifacts(client, classificationId);
      const enrichmentCleanup = await this.cleanupEnrichmentState(client, mediaItemId);

      let purgedLearning = false;
      if (purgeLearning && identity.tmdbId) {
        const learningResult = await client.query(
          `DELETE FROM learning_patterns
           WHERE pattern_type = 'exact_match'
             AND tmdb_id = $1
             AND media_type = $2`,
          [identity.tmdbId, identity.mediaType]
        );
        purgedLearning = (learningResult.rowCount || 0) > 0;
      }

      await client.query('DELETE FROM classification_history WHERE id = $1', [classificationId]);

      const retryPayload = buildRetryPayload(row, metadata, mediaItemId);
      const queueResult = await client.query(
        `INSERT INTO task_queue (task_type, payload, priority, source, max_attempts)
         VALUES ($1, $2::jsonb, $3, $4, $5)
         RETURNING id`,
        ['classification', JSON.stringify(retryPayload), 2, 'manual_retry', 5]
      );
      const taskId = queueResult.rows[0]?.id || null;

      await client.query('COMMIT');

      const metadataEnrichmentResult = await this.enqueueMetadataEnrichmentTask({
        classificationId,
        mediaItemId,
        retryPayload,
        metadata,
        actor,
        correlationId
      });

      this.logger.info('Classification retry queued', {
        correlationId,
        actor,
        route: RETRY_ROUTE,
        classificationId,
        taskId,
        metadataEnrichmentTaskId: metadataEnrichmentResult.metadataEnrichmentTaskId,
        metadataEnrichmentQueued: metadataEnrichmentResult.metadataEnrichmentQueued,
        result: 'queued',
        reasonCode: 'queued'
      });

      return {
        ...baseResult,
        queued: true,
        reasonCode: 'queued',
        taskId,
        purgedLearning,
        ...enrichmentCleanup,
        ...metadataEnrichmentResult
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackError) {
        // Ignore rollback errors after primary failure
      }

      this.logger.error('Classification retry failed', {
        correlationId,
        actor,
        route: RETRY_ROUTE,
        classificationId,
        result: 'failed',
        reasonCode: 'retry_failed',
        error: error.message
      });

      return {
        ...baseResult,
        failed: true,
        reasonCode: 'retry_failed',
        error: error.message,
      };
    }
  }
}

const classificationRetryService = new ClassificationRetryService();

module.exports = classificationRetryService;
module.exports.ClassificationRetryService = ClassificationRetryService;
