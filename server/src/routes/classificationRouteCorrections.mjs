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
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/appError.mjs';
import {
  buildPolicyManualCorrectionExecutionAuthorizationContext,
} from '../services/policyManualCorrectionExecutionAuthorization.mjs';
import {
  POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS,
} from '../services/policyManualCorrectionExecutionLifecycle.mjs';
import {
  PolicyManualCorrectionTransactionError,
  PolicyManualCorrectionTransactionService,
} from '../services/policyManualCorrectionTransactionService.mjs';

function getCorrectionActor(req) {
  const actor = req.user?.username || req.user?.email || req.user?.id ||
    (req.apiKey?.id ? `api-key:${req.apiKey.id}` : 'operator');
  return String(actor).trim().slice(0, 100) || 'operator';
}

function buildCorrectionAuthorizationContext(req, actorId) {
  return buildPolicyManualCorrectionExecutionAuthorizationContext({
    actorId,
    authenticated: Boolean(req.user || req.apiKey),
  });
}

function rethrowManualCorrectionExecutionError(error) {
  if (!(error instanceof PolicyManualCorrectionTransactionError)) {
    throw error;
  }

  switch (error.reasonId) {
    case POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.CLASSIFICATION_NOT_FOUND:
      throw new NotFoundError('Classification not found');
    case POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.DESTINATION_NOT_FOUND:
      throw new NotFoundError('Corrected library not found');
    case POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.DESTINATION_INACTIVE:
      throw new ValidationError('Corrected library must be active');
    case POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.DESTINATION_MEDIA_TYPE_MISMATCH:
      throw new ValidationError('Corrected library media type must match classification media type');
    case POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.EXECUTION_BLOCKED:
    case POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.LEARNING_ADMISSION_INVALID:
      throw new ForbiddenError('Manual correction is not currently authorized');
    default:
      throw error;
  }
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
  reclassificationService,
  logger,
  requireReadWrite,
  policyManualCorrectionTransactionService = new PolicyManualCorrectionTransactionService({ db }),
}) {
  router.post('/corrections', requireReadWrite, asyncHandler(async (req, res) => {
    const { classification_id, corrected_library_id } = req.body;

    if (!classification_id || !corrected_library_id) {
      throw new ValidationError('classification_id and corrected_library_id are required');
    }

    const correctedBy = getCorrectionActor(req);
    let correctionResult;
    try {
      correctionResult = await policyManualCorrectionTransactionService.execute({
        classificationId: classification_id,
        destinationLibraryId: corrected_library_id,
        actorId: correctedBy,
        authorizationContext: buildCorrectionAuthorizationContext(req, correctedBy),
      });
    } catch (error) {
      rethrowManualCorrectionExecutionError(error);
    }
    const { learning: learningResult, execution } = correctionResult;
    const exactItemMemoryRecorded = execution.operations.learning?.persisted === true;

    logger.info('Manual correction authorized outcome applied', {
      classification_id,
      learning_status: learningResult.statusId,
      learning_decision_id: learningResult.decision.learning.decisionId,
      learning_tier_id: learningResult.decision.learning.tierId,
      exact_item_memory_eligible: learningResult.exactItemMemory.eligible,
      exact_item_memory_recorded: exactItemMemoryRecorded,
      execution_status: execution.statusId,
      learning_reason_codes: learningResult.exactItemMemory.reasonCodes,
    });

    res.json({
      ...correctionResult.correction,
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
