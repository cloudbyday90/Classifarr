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
  policyCandidateCorrectionReviewProjectionCreateLimiterConfig,
  policyCandidateCorrectionReviewProjectionReadLimiterConfig,
} from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyCandidateCorrectionRepresentativeReviewProjectionConfigurationRequiredError,
  PolicyCandidateCorrectionRepresentativeReviewProjectionValidationError,
  createPolicyCandidateCorrectionRepresentativeReviewProjectionService,
} from '../services/policyCandidateCorrectionRepresentativeReviewProjectionService.mjs';
import {
  createReviewProjectionLimiter,
  preventReviewProjectionResponseCaching,
  requireReviewProjectionAdministrator,
} from './policiesRouteRepresentativeReviewProjectionGuards.mjs';

function mapReviewProjectionError(error) {
  if (error instanceof PolicyCandidateCorrectionRepresentativeReviewProjectionValidationError) {
    return new ValidationError(error.message, { code: error.code });
  }
  if (error instanceof PolicyCandidateCorrectionRepresentativeReviewProjectionConfigurationRequiredError) {
    return new ConflictError(error.message, { code: error.code });
  }
  return error;
}

export function registerPolicyCandidateCorrectionRepresentativeReviewProjectionRoutes(router, {
  db,
  logger,
  rateLimit,
  projectionService = createPolicyCandidateCorrectionRepresentativeReviewProjectionService({ db }),
} = {}) {
  const readLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionReviewProjectionReadLimiterConfig,
  );
  const createLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionReviewProjectionCreateLimiterConfig,
  );

  router.get('/candidate-correction/review-corpus/projection', readLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    try {
      const result = await projectionService.getProjection({ actorId });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result);
    } catch (error) {
      throw mapReviewProjectionError(error);
    }
  }));

  router.post('/candidate-correction/review-corpus/projection', createLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    try {
      const result = await projectionService.createProjection({ actorId });
      logger?.info('Representative review projection requested', {
        actorId,
        operationId: result.operationId,
        statusId: result.statusId,
        itemCount: result.projection?.itemCount ?? 0,
      });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result, result.operationId === 'projection_created' ? 201 : 200);
    } catch (error) {
      throw mapReviewProjectionError(error);
    }
  }));
}

export {
  createReviewProjectionLimiter,
  mapReviewProjectionError,
  preventReviewProjectionResponseCaching,
  requireReviewProjectionAdministrator,
};
