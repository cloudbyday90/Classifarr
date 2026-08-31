/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  policyCandidateCorrectionPolicyChangeOutcomeObservationCreateLimiterConfig,
  policyCandidateCorrectionPolicyChangeOutcomeObservationReadLimiterConfig,
} from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyCandidateCorrectionPolicyChangeOutcomeObservationActiveError,
  PolicyCandidateCorrectionPolicyChangeOutcomeObservationReceiptRequiredError,
  PolicyCandidateCorrectionPolicyChangeOutcomeObservationValidationError,
  createPolicyCandidateCorrectionPolicyChangeOutcomeObservationService,
} from '../services/policyCandidateCorrectionPolicyChangeOutcomeObservationService.mjs';
import {
  createReviewProjectionLimiter,
  preventReviewProjectionResponseCaching,
  requireReviewProjectionAdministrator,
} from './policiesRouteRepresentativeReviewProjectionGuards.mjs';

function hasRequestSelectors(req) {
  return Object.keys(req.query || {}).length > 0 ||
    (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && Object.keys(req.body).length > 0);
}

function mapPolicyChangeOutcomeObservationError(error) {
  if (error instanceof PolicyCandidateCorrectionPolicyChangeOutcomeObservationValidationError) {
    return new ValidationError(error.message, { code: error.code });
  }
  if (error instanceof PolicyCandidateCorrectionPolicyChangeOutcomeObservationReceiptRequiredError ||
      error instanceof PolicyCandidateCorrectionPolicyChangeOutcomeObservationActiveError) {
    return new ConflictError(error.message, { code: error.code });
  }
  return error;
}

export function registerPolicyCandidateCorrectionPolicyChangeOutcomeObservationRoutes(router, {
  db,
  logger,
  rateLimit,
  outcomeObservationService = createPolicyCandidateCorrectionPolicyChangeOutcomeObservationService({ db }),
} = {}) {
  const readLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionPolicyChangeOutcomeObservationReadLimiterConfig,
  );
  const createLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionPolicyChangeOutcomeObservationCreateLimiterConfig,
  );

  router.get('/candidate-correction/policy-change-outcome-observation', readLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    if (hasRequestSelectors(req)) {
      throw new ValidationError('Policy-change outcome observation does not accept request selectors.', {
        code: 'POLICY_CHANGE_OUTCOME_OBSERVATION_SELECTORS_FORBIDDEN',
      });
    }
    try {
      const result = await outcomeObservationService.getOutcomeObservation({ actorId });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result);
    } catch (error) {
      throw mapPolicyChangeOutcomeObservationError(error);
    }
  }));

  router.post('/candidate-correction/policy-change-outcome-observation', createLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    if (hasRequestSelectors(req)) {
      throw new ValidationError('Policy-change outcome observation does not accept request selectors.', {
        code: 'POLICY_CHANGE_OUTCOME_OBSERVATION_SELECTORS_FORBIDDEN',
      });
    }
    try {
      const result = await outcomeObservationService.startOutcomeObservation({ actorId });
      logger?.info('Policy-change outcome observation requested', {
        actorId,
        operationId: result.operationId,
        statusId: result.statusId,
      });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result, result.operationId === 'observation_started' ? 201 : 200);
    } catch (error) {
      throw mapPolicyChangeOutcomeObservationError(error);
    }
  }));
}

export { mapPolicyChangeOutcomeObservationError };
