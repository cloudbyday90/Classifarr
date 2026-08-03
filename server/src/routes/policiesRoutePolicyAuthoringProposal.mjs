/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { policyAuthoringProposalLimiterConfig } from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS,
  POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS,
  POLICY_AUTHORING_PROPOSAL_STATUS_IDS,
  normalizePolicyAuthoringProposalReference,
  validatePolicyAuthoringProposalAdmissionRequest,
  validatePolicyAuthoringProposalPrepareRequest,
} from '../services/policyAuthoringProposalContract.mjs';
import {
  policyAuthoringProposalLifecycleService,
} from '../services/policyAuthoringProposalLifecycleService.mjs';
import {
  PolicyNativeIntentCreateIdempotencyError,
  readNativePolicyCreateIdempotencyKey,
} from '../services/policyNativeIntentCreateIdempotency.mjs';
import {
  normalizePolicyOperatorWorkflowLibraryId,
} from './policyOperatorWorkflowRouteContext.mjs';

function createPolicyAuthoringProposalLimiter(rateLimit) {
  return typeof rateLimit === 'function'
    ? rateLimit(policyAuthoringProposalLimiterConfig)
    : (_req, _res, next) => next();
}

function requirePolicyAuthoringAdministrator(req) {
  if (req.user?.role !== 'admin' || !Number.isInteger(Number(req.user?.id)) || Number(req.user.id) <= 0) {
    throw new ForbiddenError('Admin access required');
  }

  return Number(req.user.id);
}

function requirePolicyAuthoringLibraryId(value) {
  const libraryId = normalizePolicyOperatorWorkflowLibraryId(value);
  if (libraryId === null) {
    throw new ValidationError('libraryId must be a positive integer');
  }
  return libraryId;
}

function getAdmissionHttpStatus(statusId) {
  if (statusId === POLICY_AUTHORING_PROPOSAL_STATUS_IDS.CREATED) return 201;
  if (statusId === POLICY_AUTHORING_PROPOSAL_STATUS_IDS.REPLAYED) return 200;
  if (statusId === POLICY_AUTHORING_PROPOSAL_STATUS_IDS.IDEMPOTENCY_KEY_REUSED) return 422;
  return 409;
}

function preventProposalResponseCaching(res) {
  res.set('Cache-Control', 'no-store');
}

function validatePrepareRequestOrThrow(payload) {
  const validation = validatePolicyAuthoringProposalPrepareRequest(payload);
  if (!validation.ok) {
    throw new ValidationError('Policy proposal preparation request is invalid.', {
      code: POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS.INVALID_REQUEST,
    });
  }
}

function validateAdmissionRequestOrThrow(payload) {
  const validation = validatePolicyAuthoringProposalAdmissionRequest(payload);
  if (!validation.ok) {
    throw new ValidationError('Policy proposal admission request is invalid.', {
      code: POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS.INVALID_REQUEST,
    });
  }
  return validation.value;
}

function getIdempotencyKeyOrThrow(headers) {
  try {
    return readNativePolicyCreateIdempotencyKey(headers);
  } catch (error) {
    if (error instanceof PolicyNativeIntentCreateIdempotencyError) {
      throw new ValidationError('Policy proposal admission requires a valid Idempotency-Key header.', {
        code: error.code,
      });
    }
    throw error;
  }
}

function requireProposalReference(value) {
  const proposalReference = normalizePolicyAuthoringProposalReference(value);
  if (!proposalReference) {
    throw new ValidationError('proposalReference is invalid');
  }
  return proposalReference;
}

export function registerPolicyAuthoringProposalRoutes(router, {
  db,
  logger,
  rateLimit,
  proposalLifecycleService = policyAuthoringProposalLifecycleService,
} = {}) {
  const proposalLimiter = createPolicyAuthoringProposalLimiter(rateLimit);

  router.get('/operator-workflow/libraries/:libraryId/authoring-lifecycle', asyncHandler(async (req, res) => {
    const libraryId = requirePolicyAuthoringLibraryId(req.params.libraryId);
    requirePolicyAuthoringAdministrator(req);

    const lifecycle = await proposalLifecycleService.getLifecycle({ db, libraryId });
    if (lifecycle.statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.LIBRARY_NOT_FOUND) {
      throw new NotFoundError('Library not found');
    }

    preventProposalResponseCaching(res);
    return sendData(res, lifecycle);
  }));

  router.post('/operator-workflow/libraries/:libraryId/proposals', proposalLimiter, asyncHandler(async (req, res) => {
    const libraryId = requirePolicyAuthoringLibraryId(req.params.libraryId);
    const actorId = requirePolicyAuthoringAdministrator(req);
    validatePrepareRequestOrThrow(req.body);

    const result = await proposalLifecycleService.prepareProposal({
      db,
      libraryId,
      actorId,
    });
    if (result.statusId === POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.LIBRARY_NOT_FOUND) {
      throw new NotFoundError('Library not found');
    }

    logger?.info('Policy authoring proposal preparation completed', {
      libraryId,
      actorId,
      statusId: result.statusId,
    });
    preventProposalResponseCaching(res);
    return sendData(res, result);
  }));

  router.post('/operator-workflow/libraries/:libraryId/proposals/:proposalReference/admission', proposalLimiter, asyncHandler(async (req, res) => {
    const libraryId = requirePolicyAuthoringLibraryId(req.params.libraryId);
    const actorId = requirePolicyAuthoringAdministrator(req);
    const proposalReference = requireProposalReference(req.params.proposalReference);
    const request = validateAdmissionRequestOrThrow(req.body);
    const idempotencyKey = getIdempotencyKeyOrThrow(req.headers);

    const result = await proposalLifecycleService.admitProposal({
      db,
      libraryId,
      actorId,
      proposalReference,
      proposalRevision: request.proposalRevision,
      idempotencyKey,
    });

    logger?.info('Policy authoring proposal admission completed', {
      libraryId,
      actorId,
      statusId: result.statusId,
      policyId: result.policy?.id ?? null,
    });
    preventProposalResponseCaching(res);
    return sendData(res, result, getAdmissionHttpStatus(result.statusId));
  }));
}

export {
  createPolicyAuthoringProposalLimiter,
  getAdmissionHttpStatus,
  preventProposalResponseCaching,
  requirePolicyAuthoringAdministrator,
  requireProposalReference,
};
