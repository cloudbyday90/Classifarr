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
  UnprocessableContentError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
  applyPolicyNativeIntentChange,
} from '../services/policyNativeIntentChangeService.mjs';
import {
  PolicyNativeIntentChangeIdempotencyError,
  readNativeIntentChangeIdempotencyKey,
} from '../services/policyNativeIntentChangeIdempotency.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function requireNativeIntentChangeRequest(body) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const allowedFields = new Set(['expected_revision', 'change_commands']);
  const unexpectedFields = Object.keys(payload).filter(field => !allowedFields.has(field));
  if (unexpectedFields.length > 0) {
    throw new ValidationError('Native intent changes accept only expected_revision and change_commands.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_REQUEST_INVALID',
    });
  }

  const expectedRevision = toPositiveInteger(payload.expected_revision);
  if (!expectedRevision) {
    throw new ValidationError('Expected revision is required', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_REVISION_REQUIRED',
    });
  }

  if (!Array.isArray(payload.change_commands)) {
    throw new ValidationError('Native intent changes require a change_commands array.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_COMMANDS_REQUIRED',
    });
  }

  return {
    expectedRevision,
    changeCommands: payload.change_commands,
  };
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

  if (result?.statusId === POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.IDEMPOTENCY_KEY_IN_PROGRESS) {
    return new ConflictError('The same native intent change is still in progress. Retry with the same Idempotency-Key.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_IDEMPOTENCY_KEY_IN_PROGRESS',
    });
  }

  if (result?.statusId === POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.IDEMPOTENCY_KEY_REUSED) {
    return new UnprocessableContentError('This Idempotency-Key is already bound to a different native intent change.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_IDEMPOTENCY_KEY_REUSED',
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

function getIdempotencyKeyOrThrow(headers) {
  try {
    return readNativeIntentChangeIdempotencyKey(headers);
  } catch (error) {
    if (error instanceof PolicyNativeIntentChangeIdempotencyError) {
      throw new ValidationError('Native intent changes require a valid Idempotency-Key header.', {
        code: error.code,
      });
    }
    throw error;
  }
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

    const { expectedRevision, changeCommands } = requireNativeIntentChangeRequest(req.body);
    const idempotencyKey = getIdempotencyKeyOrThrow(req.headers);

    const result = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: req.params.id,
      expectedRevision,
      actorId,
      actorRole: req.user.role,
      idempotencyKey,
      changeCommands,
    });

    logger.info('Policy native intent change evaluated', {
      policyId: result.policyId,
      actorId,
      statusId: result.statusId,
      applied: result.change?.applied === true,
      replayed: result.change?.replayed === true,
    });

    if (!isSuccessfulChange(result)) {
      throw getChangeHttpError(result);
    }

    return sendData(res, result);
  }));
}

export {
  getIdempotencyKeyOrThrow,
  requireNativeIntentChangeRequest,
};
