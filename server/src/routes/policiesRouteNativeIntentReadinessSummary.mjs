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
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  policyNativeReadinessSummaryService,
} from '../services/policyNativeReadinessSummaryService.mjs';
import {
  POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS,
  normalizePositiveInteger,
} from '../services/policyNativeReadinessSummaryContract.mjs';

export function registerPolicyNativeIntentReadinessSummaryRoutes(router, {
  db,
  logger,
  nativeReadinessSummaryService = policyNativeReadinessSummaryService,
} = {}) {
  router.get('/:id/native-intent/readiness-summary', asyncHandler(async (req, res) => {
    const policyId = normalizePositiveInteger(req.params.id);
    if (!policyId) {
      throw new ValidationError('policyId must be a positive integer');
    }

    const result = await nativeReadinessSummaryService.getSummary({
      dbClient: db,
      policyId,
    });

    const logContext = {
      policyId: result.policyId,
      statusId: result.statusId,
      readinessStateId: result.readiness?.stateId ?? null,
    };

    if (result.statusId === POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.READ_UNAVAILABLE) {
      logger?.warn('Native policy readiness summary unavailable', logContext);
      throw new ServiceUnavailableError(
        'Native policy readiness is temporarily unavailable. Retry without making changes.',
        { code: 'POLICY_NATIVE_READINESS_UNAVAILABLE' }
      );
    }

    if (result.statusId === POLICY_NATIVE_READINESS_SUMMARY_STATUS_IDS.POLICY_NOT_FOUND) {
      throw new NotFoundError('Policy not found');
    }

    logger?.info('Native policy readiness summary read', logContext);
    return sendData(res, result);
  }));
}
