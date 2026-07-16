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
  ServiceUnavailableError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS,
  applyPolicyInitialIntentEstablishment,
} from '../services/policyInitialIntentEstablishmentService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function getEstablishmentHttpError(result) {
  const riskId = result?.validation?.issues?.[0]?.riskId;

  if (result?.statusId === POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.FAILED_ROLLED_BACK) {
    return new ServiceUnavailableError(
      'Initial native policy establishment did not complete. Verify database availability and retry.',
      { code: 'POLICY_INITIAL_INTENT_ESTABLISHMENT_UNAVAILABLE' }
    );
  }

  if (
    result?.statusId === POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_REQUEST ||
    riskId === POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.ACTOR_REQUIRED ||
    riskId === POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.DECLARED_INTENT_INVALID
  ) {
    return new ValidationError('Initial native policy establishment request is invalid.', {
      code: 'POLICY_INITIAL_INTENT_ESTABLISHMENT_REQUEST_INVALID',
    });
  }

  if (result?.statusId === POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY) {
    return new ServiceUnavailableError(
      'Initial native policy establishment requires a database transaction boundary.',
      { code: 'POLICY_INITIAL_INTENT_ESTABLISHMENT_UNAVAILABLE' }
    );
  }

  return new ConflictError('Initial native policy establishment is not available for this policy.', {
    code: 'POLICY_INITIAL_INTENT_ESTABLISHMENT_BLOCKED',
  });
}

function isSuccessfulEstablishment(result) {
  return [
    POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.ESTABLISHED,
    POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.REPLAYED,
  ].includes(result?.statusId);
}

export function registerPolicyInitialIntentEstablishmentRoutes(router, { db, logger }) {
  router.post('/:id/native-intent/initial-establishment', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const actorId = toPositiveInteger(req.user.id);
    if (!actorId) {
      throw new ValidationError('A verified administrator identity is required for initial native policy establishment.', {
        code: 'POLICY_INITIAL_INTENT_ESTABLISHMENT_ACTOR_REQUIRED',
      });
    }

    const result = await applyPolicyInitialIntentEstablishment({
      dbClient: db,
      policyId: req.params.id,
      actorId,
      request: req.body,
    });

    logger.info('Initial native policy establishment evaluated', {
      policyId: result.policyId,
      actorId,
      statusId: result.statusId,
      applied: result.establishment?.applied === true,
      replayed: result.establishment?.replayed === true,
    });

    if (!isSuccessfulEstablishment(result)) {
      throw getEstablishmentHttpError(result);
    }

    return sendData(res, result, result.establishment?.replayed === true ? 200 : 201);
  }));
}
