/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
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
  POLICY_NATIVE_INTENT_REVERSION_RISK_IDS,
  POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS,
  applyPolicyNativeIntentReversion,
} from '../services/policyNativeIntentReversionService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function toReasonCode(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getReversionHttpError(result) {
  const riskId = result?.validation?.issues?.[0]?.riskId;

  if (
    result?.statusId === POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.FAILED_ROLLED_BACK ||
    result?.statusId === POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY
  ) {
    return new ServiceUnavailableError(
      'Policy reversion did not complete. Verify database availability and retry.',
      { code: 'POLICY_NATIVE_INTENT_REVERSION_UNAVAILABLE' }
    );
  }

  if (
    riskId === POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.ACTION_ACTOR_INVALID ||
    riskId === POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.ACTION_REASON_INVALID
  ) {
    return new ValidationError(result.validation.issues[0].message, {
      code: 'POLICY_NATIVE_INTENT_REVERSION_REQUEST_INVALID',
    });
  }

  if (
    riskId === POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.POLICY_NOT_FOUND ||
    riskId === POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_NOT_FOUND
  ) {
    return new NotFoundError('Policy rollback snapshot not found');
  }

  return new ConflictError('Policy native authority cannot be reverted in its current state', {
    code: 'POLICY_NATIVE_INTENT_REVERSION_BLOCKED',
    reversion: result,
  });
}

function isSuccessfulReversion(result) {
  return [
    POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.APPLIED_TO_COMPATIBILITY,
    POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.APPLIED_TO_PREVIOUS_NATIVE_INTENT,
    POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.ALREADY_REVERTED,
  ].includes(result?.statusId);
}

export function registerPolicyNativeIntentReversionRoutes(router, { db, logger }) {
  router.post('/:id/native-intent-rollbacks/:snapshotId/apply', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const actorId = toPositiveInteger(req.user.id);
    if (!actorId) {
      throw new ValidationError('A verified administrator identity is required for policy reversion', {
        code: 'POLICY_NATIVE_INTENT_REVERSION_ACTOR_REQUIRED',
      });
    }

    const result = await applyPolicyNativeIntentReversion({
      dbClient: db,
      policyId: req.params.id,
      snapshotId: req.params.snapshotId,
      action: {
        actorSourceId: 'manual_operator',
        actorId,
        reasonCode: toReasonCode(req.body?.reason_code),
      },
    });

    logger.info('Policy native authority reversion evaluated', {
      policyId: result.policyId,
      snapshotId: result.snapshotId,
      actorId,
      statusId: result.statusId,
      applied: result.reversion?.applied === true,
    });

    if (!isSuccessfulReversion(result)) {
      throw getReversionHttpError(result);
    }

    return sendData(res, result);
  }));
}
