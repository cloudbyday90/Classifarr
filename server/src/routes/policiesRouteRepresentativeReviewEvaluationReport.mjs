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
  policyCandidateCorrectionReviewEvaluationReportReadLimiterConfig,
} from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError,
  createPolicyCandidateCorrectionRepresentativeReviewEvaluationReportService,
} from '../services/policyCandidateCorrectionRepresentativeReviewEvaluationReportService.mjs';
import {
  createPolicyCandidateCorrectionRepresentativeReviewProjectionService,
} from '../services/policyCandidateCorrectionRepresentativeReviewProjectionService.mjs';
import {
  createReviewProjectionLimiter,
  preventReviewProjectionResponseCaching,
  requireReviewProjectionAdministrator,
} from './policiesRouteRepresentativeReviewProjectionGuards.mjs';

function mapReviewEvaluationReportError(error) {
  if (error instanceof PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError) {
    return new ValidationError(error.message, { code: error.code });
  }
  return error;
}

export function registerPolicyCandidateCorrectionRepresentativeReviewEvaluationReportRoutes(router, {
  db,
  logger,
  rateLimit,
  evaluationReportService,
  projectionService,
} = {}) {
  const reportService = evaluationReportService ||
    createPolicyCandidateCorrectionRepresentativeReviewEvaluationReportService({
      projectionService: projectionService ||
        createPolicyCandidateCorrectionRepresentativeReviewProjectionService({ db }),
    });
  const readLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionReviewEvaluationReportReadLimiterConfig,
  );

  router.get('/candidate-correction/review-corpus/evaluation-report', readLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    try {
      const result = await reportService.getEvaluationReport({ actorId });
      logger?.info('Representative review evaluation report requested', {
        actorId,
        statusId: result.statusId,
        itemCount: result.report?.itemCount ?? 0,
      });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result);
    } catch (error) {
      throw mapReviewEvaluationReportError(error);
    }
  }));
}

export { mapReviewEvaluationReportError };
