/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  policyCandidateCorrectionPolicyChangeDecisionRecordMutationLimiterConfig,
  policyCandidateCorrectionPolicyChangeDecisionRecordReadLimiterConfig,
} from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyCandidateCorrectionPolicyChangeDecisionRecordExistsError,
  PolicyCandidateCorrectionPolicyChangeDecisionRecordOutcomeNotReadyError,
  PolicyCandidateCorrectionPolicyChangeDecisionRecordRevisionConflictError,
  PolicyCandidateCorrectionPolicyChangeDecisionRecordValidationError,
  createPolicyCandidateCorrectionPolicyChangeDecisionRecordService,
} from '../services/policyCandidateCorrectionPolicyChangeDecisionRecordService.mjs';
import {
  createReviewProjectionLimiter,
  preventReviewProjectionResponseCaching,
  requireReviewProjectionAdministrator,
} from './policiesRouteRepresentativeReviewProjectionGuards.mjs';

const CREATE_PROPERTIES = Object.freeze(['decision_id', 'rationale_id']);
const REVISE_PROPERTIES = Object.freeze(['decision_id', 'rationale_id', 'expected_revision']);

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyProperties(value, allowedProperties) {
  return isPlainObject(value) && Object.keys(value).every(property => allowedProperties.includes(property)) &&
    allowedProperties.every(property => Object.hasOwn(value, property));
}

function hasRequestSelectors(req) {
  return Object.keys(req.query || {}).length > 0;
}

function hasNonEmptyBody(value) {
  if (value === undefined || value === null) return false;
  return !isPlainObject(value) || Object.keys(value).length > 0;
}

function mapPolicyChangeDecisionRecordError(error) {
  if (error instanceof PolicyCandidateCorrectionPolicyChangeDecisionRecordValidationError) {
    return new ValidationError(error.message, { code: error.code });
  }
  if (error instanceof PolicyCandidateCorrectionPolicyChangeDecisionRecordOutcomeNotReadyError ||
      error instanceof PolicyCandidateCorrectionPolicyChangeDecisionRecordExistsError ||
      error instanceof PolicyCandidateCorrectionPolicyChangeDecisionRecordRevisionConflictError) {
    return new ConflictError(error.message, { code: error.code });
  }
  return error;
}

function requireSelectorFreeRequest(req, { rejectBody = false } = {}) {
  if (hasRequestSelectors(req) || (rejectBody && hasNonEmptyBody(req.body))) {
    throw new ValidationError('Policy-change decision records do not accept request selectors.', {
      code: 'POLICY_CHANGE_DECISION_RECORD_SELECTORS_FORBIDDEN',
    });
  }
}

function requireStrictBody(req, allowedProperties) {
  if (!hasOnlyProperties(req.body, allowedProperties)) {
    throw new ValidationError('Policy-change decision record request properties are invalid.', {
      code: 'POLICY_CHANGE_DECISION_RECORD_PROPERTIES_INVALID',
    });
  }
}

export function registerPolicyCandidateCorrectionPolicyChangeDecisionRecordRoutes(router, {
  db,
  logger,
  rateLimit,
  decisionRecordService = createPolicyCandidateCorrectionPolicyChangeDecisionRecordService({ db }),
} = {}) {
  const readLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionPolicyChangeDecisionRecordReadLimiterConfig,
  );
  const mutationLimiter = createReviewProjectionLimiter(
    rateLimit,
    policyCandidateCorrectionPolicyChangeDecisionRecordMutationLimiterConfig,
  );

  router.get('/candidate-correction/policy-change-decision-record', readLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    requireSelectorFreeRequest(req, { rejectBody: true });
    try {
      const result = await decisionRecordService.getDecisionRecord({ actorId });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result);
    } catch (error) {
      throw mapPolicyChangeDecisionRecordError(error);
    }
  }));

  router.post('/candidate-correction/policy-change-decision-record', mutationLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    requireSelectorFreeRequest(req);
    requireStrictBody(req, CREATE_PROPERTIES);
    try {
      const result = await decisionRecordService.createDecisionRecord({
        actorId,
        decisionId: req.body.decision_id,
        rationaleId: req.body.rationale_id,
      });
      logger?.info('Policy-change reviewed decision recorded', { actorId, statusId: result.statusId });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result, 201);
    } catch (error) {
      throw mapPolicyChangeDecisionRecordError(error);
    }
  }));

  router.put('/candidate-correction/policy-change-decision-record', mutationLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewProjectionAdministrator(req);
    requireSelectorFreeRequest(req);
    requireStrictBody(req, REVISE_PROPERTIES);
    try {
      const result = await decisionRecordService.reviseDecisionRecord({
        actorId,
        decisionId: req.body.decision_id,
        rationaleId: req.body.rationale_id,
        expectedRevision: req.body.expected_revision,
      });
      logger?.info('Policy-change reviewed decision revised', { actorId, statusId: result.statusId });
      preventReviewProjectionResponseCaching(res);
      return sendData(res, result);
    } catch (error) {
      throw mapPolicyChangeDecisionRecordError(error);
    }
  }));
}

export { mapPolicyChangeDecisionRecordError };
