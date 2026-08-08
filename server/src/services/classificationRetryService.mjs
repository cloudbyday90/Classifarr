/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Retry + reset service for pending classifications.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { ClassificationRetryFollowupService } from './classificationRetryFollowupService.mjs';
import { ClassificationRetryStateService } from './classificationRetryStateService.mjs';
import * as classificationRetryPayloads from '../utils/classificationRetryPayloads.mjs';

const logger = createLogger('ClassificationRetryService');

const MAX_BATCH_SIZE = 100;
const ELIGIBLE_STATUSES = new Set(['awaiting_decision', 'pending_retry']);
const RETRY_ROUTE = '/api/classification/retry';
const DEFAULT_RETRY_TASK_SOURCE = 'manual_retry';
const DEFAULT_RETRY_FOLLOWUP_SOURCE = 'manual_retry_followup';

// Task source used by the scheduler's automatic retry queue. Retries from this
// source preserve the carried-forward retry_count so the auto-retry loop stays
// bounded by max_retries. Any other source is treated as an operator-initiated
// retry and resets the retry budget (fresh attempts) - mirroring the DLQ
// "operator resubmit after fixing the issue" pattern.
const SCHEDULER_RETRY_TASK_SOURCE = 'retry_queue';

function toPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export class ClassificationRetryService {
  constructor(deps = {}) {
    this.db = deps.db || db;
    this.logger = deps.logger || logger;
    this.followupService = deps.followupService || new ClassificationRetryFollowupService();
    this.stateService = deps.stateService || new ClassificationRetryStateService();
    this.classificationRetryPayloads = deps.classificationRetryPayloads || classificationRetryPayloads;
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
    correlationId = null,
    taskSource = DEFAULT_RETRY_TASK_SOURCE,
    metadataEnrichmentSource = DEFAULT_RETRY_FOLLOWUP_SOURCE,
    route = RETRY_ROUTE
  } = {}) {
    const normalized = this.normalizeIds(classificationIds);
    if (normalized.error) {
      throw new ValidationError(normalized.error);
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

    for (const classificationId of ids) {
      const itemResult = await this.retrySingle({
        classificationId,
        actor,
        correlationId,
        taskSource,
        metadataEnrichmentSource,
        route
      });
      results.push(itemResult);
    }

    const queued = results.filter((row) => row.queued === true).length;
    const skipped = results.filter((row) => row.skipped === true).length;
    const failed = results.filter((row) => row.failed === true).length;

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

  async retrySingle({
    classificationId,
    actor,
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
    };

    try {
      const txResult = await this.db.withTransaction(async (client) => {

      const rowResult = await client.query(
        `SELECT id, tmdb_id, media_type, title, year, status, metadata, retry_count, max_retries
         FROM classification_history
         WHERE id = $1
         FOR UPDATE`,
        [classificationId]
      );

      const row = rowResult.rows[0];
      if (!row) {
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

      const {
        buildRetryIdentity,
        buildRetryPayload,
        safeParseJsonObject,
      } = this.classificationRetryPayloads;
      const metadata = safeParseJsonObject(row.metadata, {});
      const identity = buildRetryIdentity(row, metadata);
      const existingTask = await this.hasPendingClassificationTask(client, identity);
      if (existingTask) {
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

      const retryPayload = buildRetryPayload(row, metadata, mediaItemId, {
        resetRetryBudget: taskSource !== SCHEDULER_RETRY_TASK_SOURCE,
      });
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
        purged_learning: false,
        replacement_task_id: taskId,
        correlation_id: correlationId,
        route
      }, { client });

      return {
        taskId,
        purgedLearning: false,
        enrichmentCleanup,
        mediaItemId,
        retryPayload,
        metadata,
      };
      }); // end withTransaction

      if (txResult.skipped) return txResult;

      const metadataEnrichmentResult = await this.followupService.enqueueMetadataEnrichmentTask({
        classificationId,
        mediaItemId: txResult.mediaItemId,
        retryPayload: txResult.retryPayload,
        metadata: txResult.metadata,
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
        taskId: txResult.taskId,
        metadataEnrichmentTaskId: metadataEnrichmentResult.metadataEnrichmentTaskId,
        metadataEnrichmentQueued: metadataEnrichmentResult.metadataEnrichmentQueued,
        result: 'queued',
        reasonCode: 'queued'
      });

      return {
        ...baseResult,
        queued: true,
        reasonCode: 'queued',
        taskId: txResult.taskId,
        purgedLearning: txResult.purgedLearning,
        ...txResult.enrichmentCleanup,
        ...metadataEnrichmentResult
      };
      } catch {
      this.logger.error('Classification retry failed', {
        correlationId,
        actor,
        route,
        classificationId,
        result: 'failed',
        reasonCode: 'retry_failed',
      });

      return {
        ...baseResult,
        failed: true,
        reasonCode: 'retry_failed',
      };
    }
  }
}

export const classificationRetryService = new ClassificationRetryService();
