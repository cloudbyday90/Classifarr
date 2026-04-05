/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Retry + reset service for pending classifications.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const classificationOutcomeService = require('./classificationOutcomeService');
const ClassificationRetryFollowupService = require('./classificationRetryFollowupService');
const ClassificationRetryStateService = require('./classificationRetryStateService');
const classificationEvidenceService = require('./classificationEvidenceService');
const {
  buildRetryIdentity,
  buildRetryPayload,
  safeParseJsonObject,
  toPositiveInt,
} = require('../utils/classificationRetryPayloads');

const logger = createLogger('ClassificationRetryService');

const MAX_BATCH_SIZE = 100;
const ELIGIBLE_STATUSES = new Set(['awaiting_decision', 'pending_retry']);
const RETRY_ROUTE = '/api/classification/retry';
const DEFAULT_RETRY_TASK_SOURCE = 'manual_retry';
const DEFAULT_RETRY_FOLLOWUP_SOURCE = 'manual_retry_followup';

class ClassificationRetryService {
  constructor(deps = {}) {
    this.db = deps.db || db;
    this.logger = deps.logger || logger;
    this.followupService = deps.followupService || new ClassificationRetryFollowupService();
    this.stateService = deps.stateService || new ClassificationRetryStateService();
    this.evidenceService = deps.evidenceService || classificationEvidenceService;
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

  async retryClassifications({
    classificationIds,
    actor = 'admin',
    purgeLearning = false,
    correlationId = null,
    taskSource = DEFAULT_RETRY_TASK_SOURCE,
    metadataEnrichmentSource = DEFAULT_RETRY_FOLLOWUP_SOURCE,
    route = RETRY_ROUTE
  } = {}) {
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
      route,
      result: 'request_accepted'
    });

    const client = await this.db.pool.connect();
    try {
      for (const classificationId of ids) {
        const itemResult = await this.retrySingle(client, {
          classificationId,
          actor,
          purgeLearning,
          correlationId,
          taskSource,
          metadataEnrichmentSource,
          route
        });
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
      route,
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
    return this.stateService.hasPendingClassificationTask(client, identity);
  }

  async resolveMediaItemId(client, metadata, identity) {
    return this.stateService.resolveMediaItemId(client, metadata, identity);
  }

  async cleanupClassificationArtifacts(client, classificationId) {
    return this.stateService.cleanupClassificationArtifacts(client, classificationId);
  }

  async captureRetryLineage(client, classificationId) {
    return this.stateService.captureRetryLineage(client, classificationId);
  }

  async cleanupEnrichmentState(client, mediaItemId) {
    return this.stateService.cleanupEnrichmentState(client, mediaItemId);
  }

  async retrySingle(client, {
    classificationId,
    actor,
    purgeLearning,
    correlationId,
    taskSource = DEFAULT_RETRY_TASK_SOURCE,
    metadataEnrichmentSource = DEFAULT_RETRY_FOLLOWUP_SOURCE,
    route = RETRY_ROUTE
  }) {
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
        `SELECT id, tmdb_id, media_type, title, year, status, metadata, retry_count, max_retries
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
          route,
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
          route,
          classificationId,
          result: 'skipped',
          status: row.status,
          reasonCode: 'status_ineligible'
        });
        return { ...baseResult, skipped: true, reasonCode: 'status_ineligible' };
      }

      const metadata = safeParseJsonObject(row.metadata, {});
      const identity = buildRetryIdentity(row, metadata);
      const existingTask = await this.hasPendingClassificationTask(client, identity);
      if (existingTask) {
        await client.query('ROLLBACK');
        this.logger.warn('Classification retry skipped: duplicate pending task', {
          correlationId,
          actor,
          route,
          classificationId,
          result: 'skipped',
          existingTaskId: existingTask.id,
          existingTaskStatus: existingTask.status,
          reasonCode: 'duplicate_pending_task'
        });
        return { ...baseResult, skipped: true, reasonCode: 'duplicate_pending_task' };
      }

      const mediaItemId = await this.resolveMediaItemId(client, metadata, identity);
      const retryLineage = await this.captureRetryLineage(client, classificationId);
      if (retryLineage) {
        metadata.retry_lineage = retryLineage;
      }

      await this.cleanupClassificationArtifacts(client, classificationId);
      const enrichmentCleanup = await this.cleanupEnrichmentState(client, mediaItemId);

      let purgedLearning = false;
      if (purgeLearning && identity.tmdbId) {
        const learningResult = await this.evidenceService.purgeEvidence({
          tmdbId: identity.tmdbId,
          mediaType: identity.mediaType,
          scopes: ['item_exact'],
          client,
          actor,
          reason: 'classification_retry'
        });
        purgedLearning = (learningResult.deletedByScope?.item_exact || 0) > 0;
      }

      const retryPayload = buildRetryPayload(row, metadata, mediaItemId);
      const queueResult = await client.query(
        `INSERT INTO task_queue (task_type, payload, priority, source, max_attempts)
         VALUES ($1, $2::jsonb, $3, $4, $5)
         RETURNING id`,
        ['classification', JSON.stringify(retryPayload), 2, taskSource, 5]
      );
      const taskId = queueResult.rows[0]?.id || null;

      await client.query(
        `UPDATE classification_history
         SET status = 'reclassified',
             pending_reason = NULL
         WHERE id = $1`,
        [classificationId]
      );
      await classificationOutcomeService.recordOutcome(classificationId, {
        type: 'retried',
        source: taskSource,
        actor,
        purged_learning: purgedLearning,
        replacement_task_id: taskId,
        correlation_id: correlationId,
        route
      }, { client });

      await client.query('COMMIT');

      const metadataEnrichmentResult = await this.followupService.enqueueMetadataEnrichmentTask({
        classificationId,
        mediaItemId,
        retryPayload,
        metadata,
        actor,
        correlationId,
        metadataEnrichmentSource,
        route
      });

        this.logger.info('Classification retry queued', {
        correlationId,
        actor,
        route,
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
        route,
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
