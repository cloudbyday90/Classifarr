/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  parseOptionalBoolean,
  safeParseJsonObject,
  safeParsePolicyQuestion,
} from './classificationRouteHelpers.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';

export function registerPendingRoutes(router, { db, clarificationService, classificationService, STALE_AWAITING_DECISION_DAYS, logger }) {
  router.get('/pending', asyncHandler(async (_req, res) => {
    const pending = await clarificationService.getPendingClassifications();
    const items = pending.map((item) => ({
      ...item,
      policy_question: safeParsePolicyQuestion(item.policy_question),
    }));

    res.json({
      count: items.length,
      items,
    });
  }));

  router.get('/pending/count', asyncHandler(async (_req, res) => {
    const result = await db.query(
      `SELECT COUNT(*) as count 
       FROM classification_history 
       WHERE status = 'awaiting_decision'
         AND created_at >= NOW() - ($1 || ' days')::INTERVAL`,
      [STALE_AWAITING_DECISION_DAYS]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  }));

  router.post('/pending/:id/resolve', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { library_id, selected_option, resolved_by = 'admin', generate_rule = true } = req.body;

    if (!library_id) {
      throw new ValidationError('library_id is required');
    }

    const classificationId = Number.parseInt(id, 10);
    const libraryId = Number.parseInt(library_id, 10);

    if (!Number.isInteger(classificationId) || classificationId < 1) {
      throw new ValidationError('Invalid classification id');
    }

    if (!Number.isInteger(libraryId) || libraryId < 1) {
      throw new ValidationError('Invalid library_id');
    }

    const parsedGenerateRule = parseOptionalBoolean(generate_rule, true);
    if (!parsedGenerateRule.valid) {
      throw new ValidationError('Invalid generate_rule');
    }

    const libraryExists = await db.query('SELECT id FROM libraries WHERE id = $1 LIMIT 1', [libraryId]);
    if (libraryExists.rows.length === 0) {
      throw new ValidationError('Invalid library_id');
    }

    const result = await clarificationService.resolvePolicyQuestion(
      classificationId,
      libraryId,
      selected_option || 'Manual selection',
      resolved_by,
      parsedGenerateRule.value
    );

    let wasRouted = false;
    let routeError = null;
    let routingReason = null;

    if (result.shouldRoute && result.libraryId) {
      try {
        const classResult = await db.query(
          `SELECT ch.*, l.arr_type, l.arr_id, l.radarr_settings, l.sonarr_settings, 
                l.root_folder, l.quality_profile_id, l.name as library_name
         FROM classification_history ch
         JOIN libraries l ON l.id = $2
         WHERE ch.id = $1`,
          [classificationId, result.libraryId]
        );

        if (classResult.rows.length > 0) {
          const row = classResult.rows[0];
          const parsedMeta = safeParseJsonObject(row.metadata, {});

          if (row.arr_type) {
            const routeResult = await classificationService.routeToArr(parsedMeta, {
              id: row.library_id,
              arr_type: row.arr_type,
              arr_id: row.arr_id,
              radarr_settings: row.radarr_settings,
              sonarr_settings: row.sonarr_settings,
              root_folder: row.root_folder,
              quality_profile_id: row.quality_profile_id,
              name: row.library_name,
            });

            routingReason = routeResult?.reason || null;
            if (routeResult?.routed === true) {
              await db.query('UPDATE classification_history SET status = $1 WHERE id = $2', ['routed', classificationId]);

              wasRouted = true;
              logger.info('Routed after resolution', {
                classificationId,
                title: parsedMeta.title,
                library: row.library_name,
              });
            } else {
              routeError = routeResult?.error ? new Error(routeResult.error) : null;
              logger.warn('Routing skipped after resolution', {
                classificationId,
                title: parsedMeta.title,
                library: row.library_name,
                reason: routingReason || 'unknown',
              });
            }
          }
        } else {
          logger.warn('No classification/library record found for routing after resolution', {
            classificationId,
            libraryId: result.libraryId,
          });
        }
      } catch (error) {
        routeError = error;
        logger.error('Failed to route after resolution', {
          classificationId,
          error: error.message,
        });
      }
    }

    res.json({
      ...result,
      routed: wasRouted,
      routingError: routeError?.message || null,
      routingReason,
    });
  }));
}
