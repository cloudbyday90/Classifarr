/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError, NotFoundError } from '../utils/appError.mjs';
import {
  policyManualCorrectionLearningService as defaultPolicyManualCorrectionLearningService,
} from '../services/policyManualCorrectionLearning.mjs';

function getCorrectionActor(req) {
  const actor = req.user?.username || req.user?.email || req.user?.id || 'operator';
  return String(actor).trim().slice(0, 100) || 'operator';
}

function normalizeMediaType(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildCorrectionLearningResponse(learningResult, exactItemMemoryRecorded) {
  return {
    version: learningResult.version,
    status: learningResult.statusId,
    decision_id: learningResult.decision.learning.decisionId,
    tier_id: learningResult.decision.learning.tierId,
    exact_item_memory_eligible: learningResult.exactItemMemory.eligible,
    exact_item_memory_recorded: exactItemMemoryRecorded,
    reason_codes: learningResult.exactItemMemory.reasonCodes,
  };
}

export function registerCorrectionRoutes(router, {
  db,
  classificationOutcomeService,
  classificationEvidenceService,
  reclassificationService,
  logger,
  policyManualCorrectionLearningService = defaultPolicyManualCorrectionLearningService,
}) {
  router.post('/corrections', asyncHandler(async (req, res) => {
    const { classification_id, corrected_library_id } = req.body;

    if (!classification_id || !corrected_library_id) {
      throw new ValidationError('classification_id and corrected_library_id are required');
    }

    const classResult = await db.query(
      'SELECT library_id, tmdb_id, media_type, metadata FROM classification_history WHERE id = $1',
      [classification_id]
    );

    if (classResult.rows.length === 0) {
      throw new NotFoundError('Classification not found');
    }

    const { library_id: original_library_id, tmdb_id, media_type, metadata } = classResult.rows[0];
    const correctedLibraryLookup = await db.query(
      'SELECT id, name, media_type FROM libraries WHERE id = $1',
      [corrected_library_id]
    );
    const correctedLibrary = correctedLibraryLookup.rows[0];

    if (!correctedLibrary) {
      throw new NotFoundError('Corrected library not found');
    }

    if (normalizeMediaType(media_type) !== normalizeMediaType(correctedLibrary.media_type)) {
      throw new ValidationError('Corrected library media type must match classification media type');
    }

    const correctedBy = getCorrectionActor(req);

    await db.query(
      `UPDATE classification_history 
       SET library_id = $1, 
           library_name = (SELECT name FROM libraries WHERE id = $1),
           status = $2 
       WHERE id = $3`,
      [corrected_library_id, 'corrected', classification_id]
    );

    const correctionResult = await db.query(
      `INSERT INTO classification_corrections 
       (classification_id, original_library_id, corrected_library_id, corrected_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [classification_id, original_library_id, corrected_library_id, correctedBy]
    );

    const outcomeResult = await classificationOutcomeService.recordOutcome(classification_id, {
      type: 'corrected',
      source: 'api_correction',
      actor: correctedBy,
      final_library_id: corrected_library_id,
      final_library_name: correctedLibrary.name,
    });

    const learningResult = policyManualCorrectionLearningService.build({
      classification: {
        id: classification_id,
        tmdbId: tmdb_id,
        mediaType: media_type,
      },
      destination: {
        libraryId: correctedLibrary.id,
        libraryName: correctedLibrary.name,
      },
      finalOutcomeRecorded: outcomeResult.updated === true,
      sourceEventId: `classification_correction:${correctionResult.rows[0].id}`,
      actorId: correctedBy,
    });

    let exactItemMemoryRecorded = false;
    if (learningResult.audit.ok && learningResult.exactItemMemory.eligible) {
      try {
        const evidence = await classificationEvidenceService.rememberExactMatch({
          tmdbId: learningResult.exactItemMemory.tmdbId,
          mediaType: learningResult.exactItemMemory.mediaType,
          libraryId: learningResult.exactItemMemory.libraryId,
          payload: metadata,
          createdBy: correctedBy,
          conflictMode: 'do_nothing',
        });
        exactItemMemoryRecorded = Boolean(evidence);
      } catch (error) {
        logger.warn('Manual correction exact-item memory persistence failed', {
          classification_id,
          error: error.message,
        });
      }
    }

    logger.info('Manual correction learning admission evaluated', {
      classification_id,
      learning_status: learningResult.statusId,
      learning_decision_id: learningResult.decision.learning.decisionId,
      learning_tier_id: learningResult.decision.learning.tierId,
      exact_item_memory_eligible: learningResult.exactItemMemory.eligible,
      exact_item_memory_recorded: exactItemMemoryRecorded,
      learning_reason_codes: learningResult.exactItemMemory.reasonCodes,
    });

    res.json({
      ...correctionResult.rows[0],
      policy_learning: buildCorrectionLearningResponse(
        learningResult,
        exactItemMemoryRecorded
      ),
    });
  }));

  router.post('/reclassify', asyncHandler(async (req, res) => {
    const { classification_id, target_library_id, corrected_by } = req.body;

    if (!classification_id || !target_library_id) {
      throw new ValidationError('classification_id and target_library_id are required');
    }

    const result = await reclassificationService.executeReclassification({
      classificationId: classification_id,
      targetLibraryId: target_library_id,
      correctedBy: corrected_by || 'user',
    });

    res.json(result);
  }));

  router.post('/reclassify/preview', asyncHandler(async (req, res) => {
    const { classification_id, target_library_id } = req.body;

    if (!classification_id || !target_library_id) {
      throw new ValidationError('classification_id and target_library_id are required');
    }

    const preview = await reclassificationService.previewReclassification({
      classificationId: classification_id,
      targetLibraryId: target_library_id,
    });

    res.json(preview);
  }));
}
