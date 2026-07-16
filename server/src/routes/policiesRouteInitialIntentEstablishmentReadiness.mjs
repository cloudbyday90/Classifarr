/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS,
} from '../services/policyInitialIntentEstablishmentReadinessContract.mjs';
import {
  getPolicyInitialIntentEstablishmentReadiness,
} from '../services/policyInitialIntentEstablishmentReadinessService.mjs';

export function registerPolicyInitialIntentEstablishmentReadinessRoutes(router, { db, logger }) {
  router.get('/:id/native-intent/initial-establishment/readiness', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const result = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient: db,
      policyId: req.params.id,
    });

    const logContext = {
      policyId: result.policyId,
      statusId: result.statusId,
      canEstablishInitialIntent: result.eligibility?.canEstablishInitialIntent === true,
      recoveryStateId: result.establishmentHistory?.recovery?.stateId ?? null,
    };

    if (result.statusId === POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.READ_UNAVAILABLE) {
      logger.warn('Initial native policy establishment readiness unavailable', logContext);
    } else {
      logger.info('Initial native policy establishment readiness read', logContext);
    }

    if (result.statusId === POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.POLICY_NOT_FOUND) {
      throw new NotFoundError('Policy not found');
    }

    if (result.statusId === POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS.READ_UNAVAILABLE) {
      throw new ServiceUnavailableError(
        'Initial native policy establishment readiness is temporarily unavailable. Retry without making changes.',
        { code: 'POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_UNAVAILABLE' }
      );
    }

    return sendData(res, result);
  }));
}
