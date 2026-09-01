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
  policyCandidateCorrectionReviewCorpusCaptureEvaluationReadLimiterConfig,
} from '../config/rateLimits.mjs';
import {
  PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError,
  createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService,
} from '../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  createReviewProjectionLimiter,
  preventReviewProjectionResponseCaching,
  requireReviewProjectionAdministrator,
} from './policiesRouteRepresentativeReviewProjectionGuards.mjs';

function mapReviewCorpusCaptureEvaluationError(error) {
  if (error instanceof PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError) {
    return new ValidationError(error.message, { code: error.code });
  }
  return error;
}

export function registerPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationRoutes(router, {
  db,
  logger,
  rateLimit,
  captureEvaluationService,
} = {}) {
  const evaluationService = captureEvaluationService ||
    createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService({ db });
  const readLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionReviewCorpusCaptureEvaluationReadLimiterConfig,
  );

  router.get('/candidate-correction/review-corpus/captured-outcomes/evaluation', readLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    try {
      const result = await evaluationService.getEvaluation({ actorId });
      logger?.info('Representative future capture evaluation requested', {
        actorId,
        statusId: result.statusId,
        capturedOutcomeCount: result.report?.capturedOutcomeCount ?? 0,
      });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result);
    } catch (error) {
      throw mapReviewCorpusCaptureEvaluationError(error);
    }
  }));
}

export { mapReviewCorpusCaptureEvaluationError };
