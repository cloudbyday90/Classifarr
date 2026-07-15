/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { policyNativeIntentConversionLimiterConfig } from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  ConflictError,
  ForbiddenError,
  ServiceUnavailableError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS,
  applyPolicyNativeIntentConversion,
  previewPolicyNativeIntentConversion,
} from '../services/policyNativeIntentConversionOperatorAction.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function assertAdministrator(req) {
  if (req.user?.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
}

function getConversionHttpError(result) {
  if (result.statusId === POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_REQUEST) {
    return new ValidationError('Native intent conversion request is invalid', {
      code: 'POLICY_NATIVE_INTENT_CONVERSION_REQUEST_INVALID',
      issues: result.validation?.issues ?? [],
    });
  }

  if (result.statusId === POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.FAILED_ROLLED_BACK) {
    return new ServiceUnavailableError(
      'Native intent conversion did not complete. Verify database availability and retry.',
      { code: 'POLICY_NATIVE_INTENT_CONVERSION_UNAVAILABLE' }
    );
  }

  return new ConflictError('Native intent conversion is not currently eligible', {
    code: 'POLICY_NATIVE_INTENT_CONVERSION_BLOCKED',
    conversion: {
      statusId: result.statusId,
      selection: result.selection ?? null,
      issues: result.validation?.issues ?? [],
    },
  });
}

export function registerPolicyNativeIntentConversionRoutes(router, { db, logger, rateLimit }) {
  const conversionLimiter = rateLimit(policyNativeIntentConversionLimiterConfig);

  router.get('/native-intent-conversions/preview', conversionLimiter, asyncHandler(async (req, res) => {
    assertAdministrator(req);
    const result = await previewPolicyNativeIntentConversion({ dbClient: db });
    return sendData(res, result);
  }));

  router.post('/native-intent-conversions/apply', conversionLimiter, asyncHandler(async (req, res) => {
    assertAdministrator(req);

    const actorId = toPositiveInteger(req.user?.id);
    const result = await applyPolicyNativeIntentConversion({
      dbClient: db,
      action: {
        actorId,
        policyIds: req.body?.policy_ids,
        confirmation: req.body?.confirmation,
      },
    });

    logger.info('Policy native intent conversion evaluated', {
      actorId,
      requestedPolicyCount: result.summary?.requestedPolicyCount ?? 0,
      statusId: result.statusId,
      appliedPolicyCount: result.summary?.appliedPolicyCount ?? 0,
      alreadyConvertedCount: result.summary?.alreadyConvertedCount ?? 0,
      runtimeObservationStatusId: result.runtimeObservation?.statusId ?? null,
      runtimeObservationRiskCount: result.runtimeObservation?.riskCount ?? 0,
    });

    if (
      ![
        POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.APPLIED,
        POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.ALREADY_CURRENT,
      ].includes(result.statusId)
    ) {
      throw getConversionHttpError(result);
    }

    return sendData(res, result);
  }));
}
