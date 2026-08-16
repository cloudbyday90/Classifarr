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
  ServiceUnavailableError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS,
} from '../services/policyNativeIntentPurposeChangeReadContract.mjs';
import {
  policyNativeIntentPurposeChangeReadService,
} from '../services/policyNativeIntentPurposeChangeReadService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

export function registerPolicyNativeIntentPurposeChangeReadRoutes(router, {
  db,
  purposeChangeReadService = policyNativeIntentPurposeChangeReadService,
} = {}) {
  router.get('/:id/native-intent/purpose-change', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const policyId = toPositiveInteger(req.params.id);
    if (!policyId) {
      throw new ValidationError('A valid policy identifier is required.', {
        code: 'POLICY_NATIVE_INTENT_PURPOSE_CHANGE_POLICY_ID_INVALID',
      });
    }

    const result = await purposeChangeReadService.getPurposeChange({
      dbClient: db,
      policyId,
    });

    if (result.statusId === POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.POLICY_NOT_FOUND) {
      throw new NotFoundError('Policy not found');
    }

    if (result.statusId === POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AUTHORITY_UNAVAILABLE) {
      throw new ConflictError('The current native policy authority cannot accept a purpose change.', {
        code: 'POLICY_NATIVE_INTENT_PURPOSE_CHANGE_AUTHORITY_UNAVAILABLE',
      });
    }

    if (result.statusId !== POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AVAILABLE) {
      throw new ServiceUnavailableError(
        'Native purpose change is temporarily unavailable. Retry without making changes.',
        { code: 'POLICY_NATIVE_INTENT_PURPOSE_CHANGE_UNAVAILABLE' },
      );
    }

    return sendData(res, result);
  }));
}
