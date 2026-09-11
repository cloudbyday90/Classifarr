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
  ConflictError,
  ForbiddenError,
  ServiceUnavailableError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS,
  validatePolicyPurposeProposalBatchRequest,
} from '../services/policyPurposeProposalBatchContract.mjs';
import {
  policyPurposeProposalBatchService,
} from '../services/policyPurposeProposalBatchService.mjs';
import {
  PolicyNativeIntentChangeIdempotencyError,
  readNativeIntentChangeIdempotencyKey,
} from '../services/policyNativeIntentChangeIdempotency.mjs';

function getVerifiedAdministratorId(req) {
  if (req.user?.role !== 'admin') throw new ForbiddenError('Admin access required');
  const actorId = Number(req.user?.id);
  if (!Number.isInteger(actorId) || actorId <= 0) {
    throw new ValidationError('A verified administrator identity is required.', {
      code: 'POLICY_PURPOSE_PROPOSAL_BATCH_ACTOR_REQUIRED',
    });
  }
  return actorId;
}

function getIdempotencyKey(headers) {
  try {
    return readNativeIntentChangeIdempotencyKey(headers);
  } catch (error) {
    if (error instanceof PolicyNativeIntentChangeIdempotencyError) {
      throw new ValidationError('Purpose proposals require a valid Idempotency-Key header.', {
        code: error.code,
      });
    }
    throw error;
  }
}

function getApplyError(result) {
  if (result?.statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REQUEST_INVALID) {
    return new ValidationError('Purpose proposal application requires the current proposal fingerprint and exact policy list.', {
      code: 'POLICY_PURPOSE_PROPOSAL_BATCH_REQUEST_INVALID',
    });
  }
  if (result?.statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.TRANSACTION_UNAVAILABLE ||
      result?.statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.FAILED_ROLLED_BACK) {
    return new ServiceUnavailableError('Purpose proposal application did not complete. Verify database availability and retry.', {
      code: 'POLICY_PURPOSE_PROPOSAL_BATCH_UNAVAILABLE',
    });
  }
  return new ConflictError('The purpose proposal changed before it could be applied. Classifarr made no changes; refresh and retry.', {
    code: result?.statusId === POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REPLAY_INCOMPLETE
      ? 'POLICY_PURPOSE_PROPOSAL_BATCH_REPLAY_INCOMPLETE'
      : 'POLICY_PURPOSE_PROPOSAL_BATCH_STALE',
  });
}

function requireProposalBatchRequest(body) {
  if (!validatePolicyPurposeProposalBatchRequest(body).valid) {
    throw new ValidationError('Purpose proposal application requires the current proposal fingerprint and exact policy list.', {
      code: 'POLICY_PURPOSE_PROPOSAL_BATCH_REQUEST_INVALID',
    });
  }
  return body;
}

export function registerPolicyPurposeProposalBatchRoutes(router, { db, logger }) {
  router.get('/native-intent-reconciliation/purpose-proposals', asyncHandler(async (req, res) => {
    getVerifiedAdministratorId(req);
    res.set('Cache-Control', 'no-store');
    return sendData(res, await policyPurposeProposalBatchService.getProposal({ dbClient: db }));
  }));

  router.post('/native-intent-reconciliation/purpose-proposals/apply', asyncHandler(async (req, res) => {
    const actorId = getVerifiedAdministratorId(req);
    const result = await policyPurposeProposalBatchService.applyProposal({
      dbClient: db,
      actorId,
      actorRole: req.user.role,
      idempotencyKey: getIdempotencyKey(req.headers),
      request: requireProposalBatchRequest(req.body),
    });

    logger.info('Policy purpose proposal batch evaluated', {
      actorId,
      statusId: result.statusId,
      policyCount: result.policyCount,
      replayed: result.replayed === true,
    });

    if (![POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.APPLIED,
      POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REPLAYED].includes(result.statusId)) {
      throw getApplyError(result);
    }

    return sendData(res, result);
  }));
}
