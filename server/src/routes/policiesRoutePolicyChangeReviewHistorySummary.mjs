/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  policyCandidateCorrectionPolicyChangeReviewHistorySummaryReadLimiterConfig,
} from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError,
  createPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryService,
} from '../services/policyCandidateCorrectionPolicyChangeReviewHistorySummaryService.mjs';
import {
  createReviewProjectionLimiter,
  preventReviewProjectionResponseCaching,
  requireReviewProjectionAdministrator,
} from './policiesRouteRepresentativeReviewProjectionGuards.mjs';

function hasNonEmptyBody(value) {
  if (value === undefined || value === null) return false;
  return !value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0;
}

function requireSelectorFreeRequest(req) {
  if (Object.keys(req.query || {}).length > 0 || hasNonEmptyBody(req.body)) {
    throw new ValidationError('Policy-change review history summaries do not accept request selectors.', {
      code: 'POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_SELECTORS_FORBIDDEN',
    });
  }
}

function mapPolicyChangeReviewHistorySummaryError(error) {
  if (error instanceof PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError) {
    return new ValidationError(error.message, { code: error.code });
  }
  return error;
}

export function registerPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryRoutes(router, {
  db,
  rateLimit,
  reviewHistorySummaryService = createPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryService({ db }),
} = {}) {
  const readLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionPolicyChangeReviewHistorySummaryReadLimiterConfig,
  );

  router.get('/candidate-correction/policy-change-review-history-summary', readLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    requireSelectorFreeRequest(req);
    try {
      const result = await reviewHistorySummaryService.getReviewHistorySummary({ actorId });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result);
    } catch (error) {
      throw mapPolicyChangeReviewHistorySummaryError(error);
    }
  }));
}

export { mapPolicyChangeReviewHistorySummaryError };
