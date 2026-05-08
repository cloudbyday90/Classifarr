/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import * as dbModule from '../config/database.mjs';
import { createLogger as _createLogger } from '../utils/logger.mjs';
import * as classificationRetryPayloadsModule from '../utils/classificationRetryPayloads.mjs';

class ClassificationRetryFollowupService {
  constructor(deps = {}) {
    this.db = deps.db || dbModule;
    this.logger = deps.logger || _createLogger('ClassificationRetryFollowupService');
    this.classificationRetryPayloads = deps.classificationRetryPayloads || classificationRetryPayloadsModule;
  }

  async enqueueMetadataEnrichmentTask({
    classificationId,
    mediaItemId,
    retryPayload,
    metadata,
    actor,
    correlationId,
    metadataEnrichmentSource,
    route,
  }) {
    if (!mediaItemId) {
      return {
        metadataEnrichmentQueued: false,
        metadataEnrichmentTaskId: null,
        metadataEnrichmentReason: 'no_media_item_link'
      };
    }

    const { buildMetadataEnrichmentPayload } = this.classificationRetryPayloads;
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
        ['metadata_enrichment', JSON.stringify(enrichmentPayload), 1, metadataEnrichmentSource, 5]
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
        route,
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
}

export { ClassificationRetryFollowupService };
