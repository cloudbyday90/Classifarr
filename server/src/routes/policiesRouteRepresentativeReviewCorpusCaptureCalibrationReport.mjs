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
  policyCandidateCorrectionReviewCorpusCaptureCalibrationReportReadLimiterConfig,
} from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError,
  createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService,
} from '../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService.mjs';
import {
  createReviewProjectionLimiter,
  preventReviewProjectionResponseCaching,
  requireReviewProjectionAdministrator,
} from './policiesRouteRepresentativeReviewProjectionGuards.mjs';

function hasNonEmptyBody(value) {
  return value !== undefined && value !== null &&
    (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0);
}

function requireSelectorFreeRequest(req) {
  if (Object.keys(req.query || {}).length > 0 || hasNonEmptyBody(req.body)) {
    throw new ValidationError('Future capture calibration reports do not accept request selectors.', {
      code: 'POLICY_CANDIDATE_CORRECTION_REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_SELECTORS_FORBIDDEN',
    });
  }
}

function mapReviewCorpusCaptureCalibrationReportError(error) {
  if (error instanceof PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError) {
    return new ValidationError(error.message, { code: error.code });
  }
  return error;
}

export function registerPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportRoutes(router, {
  db,
  logger,
  rateLimit,
  calibrationReportService,
} = {}) {
  const reportService = calibrationReportService ||
    createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService({
      db,
    });
  const readLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionReviewCorpusCaptureCalibrationReportReadLimiterConfig,
  );

  router.get('/candidate-correction/review-corpus/captured-outcomes/calibration-report', readLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    requireSelectorFreeRequest(req);
    try {
      const result = await reportService.getCalibrationReport({ actorId });
      logger?.info('Representative future capture calibration report requested', {
        actorId,
        statusId: result.statusId,
        recommendationId: result.report?.recommendation?.recommendationId ?? null,
      });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result);
    } catch (error) {
      throw mapReviewCorpusCaptureCalibrationReportError(error);
    }
  }));
}

export {
  mapReviewCorpusCaptureCalibrationReportError,
  requireSelectorFreeRequest,
};
