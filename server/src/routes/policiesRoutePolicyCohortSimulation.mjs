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
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyIntentRequestValidationError,
  summarizePolicyIntentRequestValidationError,
} from '../services/policyIntentRequestValidator.mjs';
import {
  PolicyCohortSimulationNotFoundError,
  policyCohortSimulationService,
} from '../services/policyCohortSimulationService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function requireCohortSimulationDraft(body) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const unexpectedFields = Object.keys(payload).filter(field => field !== 'policy_intent_draft');
  if (unexpectedFields.length > 0) {
    throw new ValidationError('Policy cohort simulation accepts only policy_intent_draft.', {
      code: 'POLICY_COHORT_SIMULATION_REQUEST_INVALID',
    });
  }

  if (payload.policy_intent_draft === undefined) {
    throw new ValidationError('A policy intent draft is required for cohort simulation.', {
      code: 'POLICY_COHORT_SIMULATION_DRAFT_REQUIRED',
    });
  }

  return payload.policy_intent_draft;
}

export function registerPolicyCohortSimulationRoutes(router, { db }) {
  router.post('/:id/native-intent/cohort-simulation', asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const policyId = toPositiveInteger(req.params.id);
    if (!policyId) {
      throw new ValidationError('A valid policy identifier is required.', {
        code: 'POLICY_COHORT_SIMULATION_POLICY_ID_INVALID',
      });
    }

    try {
      return sendData(res, await policyCohortSimulationService.simulate({
        dbClient: db,
        policyId,
        draft: requireCohortSimulationDraft(req.body),
      }));
    } catch (error) {
      if (error instanceof PolicyCohortSimulationNotFoundError) {
        throw new NotFoundError('Policy not found');
      }

      if (error instanceof PolicyIntentRequestValidationError) {
        throw new ValidationError(
          `Invalid policy intent draft: ${summarizePolicyIntentRequestValidationError(error)}`,
          { code: 'POLICY_COHORT_SIMULATION_DRAFT_INVALID' },
        );
      }

      throw error;
    }
  }));
}
