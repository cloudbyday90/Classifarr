/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('classificationPersistence');

export async function rebindRetryLineage(classificationId, metadata = {}) {
  const lineage = metadata.retry_lineage;
  if (!lineage || typeof lineage !== 'object') {
    return;
  }

  const normalizeIds = (ids) => (
    Array.isArray(ids)
      ? [...new Set(
        ids
          .map((id) => Number.parseInt(id, 10))
          .filter((id) => Number.isInteger(id) && id > 0),
      )]
      : []
  );

  const mediaRequestIds = normalizeIds(lineage.media_request_ids);
  const webhookLogIds = normalizeIds(lineage.webhook_log_ids);
  const originalClassificationId = Number.parseInt(lineage.original_classification_id, 10);

  if (
    mediaRequestIds.length === 0 &&
    webhookLogIds.length === 0 &&
    (!Number.isInteger(originalClassificationId) || originalClassificationId < 1)
  ) {
    return;
  }

  try {
    if (mediaRequestIds.length > 0) {
      await db.query(
        `UPDATE media_requests
         SET classification_id = $1
         WHERE id = ANY($2::int[])`,
        [classificationId, mediaRequestIds],
      );
    }

    if (webhookLogIds.length > 0) {
      await db.query(
        `UPDATE webhook_log
         SET classification_id = $1
         WHERE id = ANY($2::int[])`,
        [classificationId, webhookLogIds],
      );
    }

    if (Number.isInteger(originalClassificationId) && originalClassificationId > 0) {
      await classificationOutcomeService.recordOutcome(originalClassificationId, {
        replacement_classification_id: classificationId,
      });
    }
  } catch (error) {
    logger.error('Failed to rebind retry lineage', {
      classificationId,
      originalClassificationId,
      mediaRequestIds,
      webhookLogIds,
      error: error.message,
    });
  }
}
