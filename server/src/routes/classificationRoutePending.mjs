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
  safeParseJsonObject,
  safeParsePolicyQuestion,
} from './classificationRouteHelpers.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { recordNativePendingRouteOutcome } from '../services/policyNativePendingRouteOutcomePersistence.mjs';
import {
  buildPolicyRuntimeQuestionAnswerContract,
  parsePolicyRuntimeQuestionAnswer,
} from '../services/policyRuntimeQuestionAnswerContract.mjs';

function resolveActor(req) {
  const candidates = [
    req.user?.username,
    req.user?.email,
    req.user?.id ? `user:${req.user.id}` : null,
    req.auth?.subject ? `api:${req.auth.subject}` : null,
  ];

  return candidates.find(candidate => typeof candidate === 'string' && candidate.trim()) || 'authenticated_operator';
}

export function registerPendingRoutes(router, { db, clarificationService, classificationService, STALE_AWAITING_DECISION_DAYS, logger }) {
  router.get('/pending', asyncHandler(async (_req, res) => {
    const pending = await clarificationService.getPendingClassifications();
    const items = pending.map((item) => {
      const policyQuestion = safeParsePolicyQuestion(item.policy_question);
      return {
        ...item,
        policy_question: policyQuestion,
        policy_question_answer: buildPolicyRuntimeQuestionAnswerContract({
          classification: item,
          question: policyQuestion,
          isStale: item.policy_question_stale === true,
          currentContextVersion: item.policy_question_current_context_version,
        }),
      };
    });

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

    const classificationId = Number.parseInt(id, 10);

    if (!Number.isInteger(classificationId) || classificationId < 1) {
      throw new ValidationError('Invalid classification id');
    }

    const parsedAnswer = parsePolicyRuntimeQuestionAnswer(req.body);
    if (!parsedAnswer.ok) {
      throw new ValidationError('Invalid policy question answer');
    }
    if (parsedAnswer.answer.destinationLibraryId) {
      const libraryExists = await db.query(
        'SELECT id FROM libraries WHERE id = $1 LIMIT 1',
        [parsedAnswer.answer.destinationLibraryId],
      );
      if (libraryExists.rows.length === 0) {
        throw new ValidationError('Invalid destination_library_id');
      }
    }

    const answerPayload = {
      contract_version: parsedAnswer.answer.contractVersion,
      contract_fingerprint: parsedAnswer.answer.contractFingerprint,
      action_id: parsedAnswer.answer.actionId,
      ...(parsedAnswer.answer.destinationLibraryId
        ? { destination_library_id: parsedAnswer.answer.destinationLibraryId }
        : {}),
    };

    const result = await clarificationService.resolveRuntimeQuestionAnswer(
      classificationId,
      answerPayload,
      resolveActor(req),
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
          if (result.nativeResolutionProvenance) {
            const routeOutcomePersistence = await recordNativePendingRouteOutcome({
              classificationId,
              nativeResolutionProvenance: result.nativeResolutionProvenance,
              routingOutcome: routeResult,
            });
            if (routeOutcomePersistence.persisted !== true &&
                routeOutcomePersistence.reason !== 'not_applicable') {
              logger.warn('Native pending route result was not persisted', {
                classificationId,
                reason: routeOutcomePersistence.reason,
                eventTypeId: routeOutcomePersistence.routeOutcome.eventTypeId,
              });
            }
          }

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
