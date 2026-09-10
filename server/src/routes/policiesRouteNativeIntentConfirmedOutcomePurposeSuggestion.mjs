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
  POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS,
} from '../services/policyNativeIntentConfirmedOutcomePurposeSuggestionContract.mjs';
import {
  policyNativeIntentConfirmedOutcomePurposeSuggestionService,
} from '../services/policyNativeIntentConfirmedOutcomePurposeSuggestionService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

export function registerPolicyNativeIntentConfirmedOutcomePurposeSuggestionRoutes(router, {
  db,
  confirmedOutcomePurposeSuggestionService = policyNativeIntentConfirmedOutcomePurposeSuggestionService,
} = {}) {
  router.get('/:id/native-intent/confirmed-outcome-purpose-suggestion', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const policyId = toPositiveInteger(req.params.id);
    if (!policyId) {
      throw new ValidationError('A valid policy identifier is required.', {
        code: 'POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_POLICY_ID_INVALID',
      });
    }

    const result = await confirmedOutcomePurposeSuggestionService.getSuggestion({
      dbClient: db,
      policyId,
    });

    if (result.statusId === POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.POLICY_NOT_FOUND) {
      throw new NotFoundError('Policy not found');
    }

    if (result.statusId === POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.AUTHORITY_UNAVAILABLE) {
      throw new ConflictError('The current native policy authority cannot accept a purpose suggestion.', {
        code: 'POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_AUTHORITY_UNAVAILABLE',
      });
    }

    if (result.statusId === POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.READ_UNAVAILABLE) {
      throw new ServiceUnavailableError(
        'Confirmed-outcome purpose suggestions are temporarily unavailable. Retry without making changes.',
        { code: 'POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_UNAVAILABLE' },
      );
    }

    res.set('Cache-Control', 'no-store');
    return sendData(res, result);
  }));
}
