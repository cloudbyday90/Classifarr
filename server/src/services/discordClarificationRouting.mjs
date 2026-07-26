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
import { createLogger } from '../utils/logger.mjs';
import { routeToArr } from './classificationRoutingService.mjs';
import * as notificationBuilder from './discordNotificationBuilder.mjs';

const logger = createLogger('discordClarificationRouting');

export async function routeAfterClarification(classificationId) {
  const outcome = {
    attempted: false,
    routed: false,
    reason: null,
    error: null,
    arrType: null,
  };

  try {
    const result = await db.query(
      `SELECT ch.*, l.arr_type, l.arr_id, l.name as library_name,
              l.radarr_settings, l.sonarr_settings, l.root_folder, l.quality_profile_id
       FROM classification_history ch
       JOIN libraries l ON ch.library_id = l.id
       WHERE ch.id = $1`,
      [classificationId],
    );

    if (result.rows.length === 0) {
      outcome.reason = 'classification_not_found';
      return outcome;
    }

    const classification = result.rows[0];
    outcome.arrType = classification.arr_type || null;
    let metadata = classification.metadata;
    if (typeof metadata === 'string') {
      metadata = notificationBuilder.safeParseJson(metadata);
    }

    if (!metadata || typeof metadata !== 'object') {
      logger.warn('Skipping *arr routing due to invalid metadata', {
        classificationId,
        metadataType: typeof classification.metadata,
      });
      outcome.reason = 'invalid_metadata';
      return outcome;
    }

    if (classification.status === 'routed') {
      outcome.routed = true;
      outcome.reason = 'already_routed';
      return outcome;
    }

    const routeResult = await routeToArr(metadata, {
      id: classification.library_id,
      arr_type: classification.arr_type,
      arr_id: classification.arr_id,
      radarr_settings: classification.radarr_settings,
      sonarr_settings: classification.sonarr_settings,
      root_folder: classification.root_folder,
      quality_profile_id: classification.quality_profile_id,
      name: classification.library_name,
    });
    outcome.attempted = routeResult?.attempted === true;

    if (!routeResult?.routed) {
      outcome.reason = routeResult?.reason || 'route_skipped';
      outcome.error = routeResult?.error || null;
      logger.warn('Routing after clarification skipped', {
        classificationId,
        reason: outcome.reason,
        error: outcome.error,
      });
      return outcome;
    }

    await db.query(
      'UPDATE classification_history SET status = $1 WHERE id = $2',
      ['routed', classificationId],
    );

    logger.info(
      `Routed after clarification: ${metadata.title} -> ${classification.library_name}`,
    );
    outcome.routed = true;
    outcome.reason = 'routed';
    return outcome;
  } catch (error) {
    logger.error('Error routing after clarification:', error);
    outcome.reason = 'exception';
    outcome.error = error.message;
    return outcome;
  }
}
