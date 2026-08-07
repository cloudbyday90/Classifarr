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
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
  applyPolicyNativeIntentChange,
} from '../services/policyNativeIntentChangeService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function getChangeHttpError(result) {
  if (
    result?.statusId === POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.FAILED_ROLLED_BACK ||
    result?.statusId === POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY
  ) {
    return new ServiceUnavailableError(
      'Native intent change did not complete. Verify database availability and retry.',
      { code: 'POLICY_NATIVE_INTENT_CHANGE_UNAVAILABLE' },
    );
  }

  if (result?.statusId === POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.AUTHORIZATION_REJECTED) {
    return new ForbiddenError('Administrator access is required for native intent changes.');
  }

  if (result?.statusId === POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION) {
    return new ConflictError('The native intent revision is stale. Reload the current authority and retry.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_STALE_REVISION',
      change: result,
    });
  }

  if (result?.statusId === POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.RETRYABLE) {
    return new ValidationError('The native intent change request is invalid or incomplete.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_RETRYABLE',
    });
  }

  return new ConflictError('Native intent change cannot be applied in the current state.', {
    code: 'POLICY_NATIVE_INTENT_CHANGE_BLOCKED',
    change: result,
  });
}

function isSuccessfulChange(result) {
  return result?.statusId === POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED;
}

export function registerPolicyNativeIntentChangeRoutes(router, { db, logger }) {
  router.post('/:id/native-intent/changes', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const actorId = toPositiveInteger(req.user.id);
    if (!actorId) {
      throw new ValidationError('A verified administrator identity is required for native intent changes', {
        code: 'POLICY_NATIVE_INTENT_CHANGE_ACTOR_REQUIRED',
      });
    }

    const expectedRevision = toPositiveInteger(req.body?.expected_revision);
    if (!expectedRevision) {
      throw new ValidationError('Expected revision is required', {
        code: 'POLICY_NATIVE_INTENT_CHANGE_REVISION_REQUIRED',
      });
    }

    const changeCommands = Array.isArray(req.body?.change_commands) ? req.body.change_commands : [];

    const result = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: req.params.id,
      expectedRevision,
      actorId,
      actorRole: req.user.role,
      idempotencyKey: req.headers['idempotency-key'],
      changeCommands,
      authorityState: req.body?.authority_state ?? {},
      legacyPayload: req.body?.legacy_payload ?? null,
    });

    logger.info('Policy native intent change evaluated', {
      policyId: result.policyId,
      actorId,
      statusId: result.statusId,
      applied: result.change?.applied === true,
    });

    if (!isSuccessfulChange(result)) {
      throw getChangeHttpError(result);
    }

    return sendData(res, result);
  }));
}
