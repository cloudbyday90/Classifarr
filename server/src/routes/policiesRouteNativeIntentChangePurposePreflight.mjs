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
  NotFoundError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyNativeIntentChangePurposePreflightValidationError,
} from '../services/policyNativeIntentChangePurposePreflightContract.mjs';
import {
  PolicyNativeIntentChangePurposePreflightAuthorityError,
  PolicyNativeIntentChangePurposePreflightNotFoundError,
  PolicyNativeIntentChangePurposePreflightStaleRevisionError,
  policyNativeIntentChangePurposePreflightService,
} from '../services/policyNativeIntentChangePurposePreflightService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function requirePurposeChangePreflightRequest(body) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const allowedFields = new Set(['expected_revision', 'change_command']);
  const unexpectedFields = Object.keys(payload).filter(field => !allowedFields.has(field));
  if (unexpectedFields.length > 0) {
    throw new ValidationError('Native purpose change preflight accepts only expected_revision and change_command.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_REQUEST_INVALID',
    });
  }

  const expectedRevision = toPositiveInteger(payload.expected_revision);
  if (!expectedRevision) {
    throw new ValidationError('Expected revision is required for native purpose change preflight.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_REVISION_REQUIRED',
    });
  }

  if (payload.change_command === undefined) {
    throw new ValidationError('An update_purpose change command is required for native purpose change preflight.', {
      code: 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_REQUIRED',
    });
  }

  return {
    expectedRevision,
    changeCommand: payload.change_command,
  };
}

export function registerPolicyNativeIntentChangePurposePreflightRoutes(router, { db }) {
  router.post('/:id/native-intent/changes/purpose-coverage/preflight', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const policyId = toPositiveInteger(req.params.id);
    if (!policyId) {
      throw new ValidationError('A valid policy identifier is required.', {
        code: 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_POLICY_ID_INVALID',
      });
    }

    try {
      const request = requirePurposeChangePreflightRequest(req.body);
      return sendData(res, await policyNativeIntentChangePurposePreflightService.preflight({
        dbClient: db,
        policyId,
        ...request,
      }));
    } catch (error) {
      if (error instanceof PolicyNativeIntentChangePurposePreflightNotFoundError) {
        throw new NotFoundError('Policy not found');
      }

      if (error instanceof PolicyNativeIntentChangePurposePreflightStaleRevisionError) {
        throw new ConflictError('The native intent revision is stale. Reload the current authority and retry.', {
          code: 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_STALE_REVISION',
        });
      }

      if (error instanceof PolicyNativeIntentChangePurposePreflightAuthorityError) {
        throw new ConflictError('The current native policy authority cannot accept this purpose change preflight.', {
          code: 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_AUTHORITY_UNAVAILABLE',
        });
      }

      if (error instanceof PolicyNativeIntentChangePurposePreflightValidationError) {
        throw new ValidationError(error.message, {
          code: error.code,
        });
      }

      throw error;
    }
  }));
}
