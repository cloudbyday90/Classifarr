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
import { NotFoundError, ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyIntentRequestValidationError,
  summarizePolicyIntentRequestValidationError,
} from '../services/policyIntentRequestValidator.mjs';
import {
  PolicyDestinationCompetitionPreviewNotFoundError,
  policyDestinationCompetitionPreviewService,
} from '../services/policyDestinationCompetitionPreviewService.mjs';
import {
  requirePolicySimulationAdministrator,
  requirePolicySimulationDraft,
  requirePolicySimulationId,
} from './policySimulationRouteRequest.mjs';

export function registerPolicyDestinationCompetitionPreviewRoutes(router, { db }) {
  router.post('/:id/native-intent/destination-competition-preview', asyncHandler(async (req, res) => {
    requirePolicySimulationAdministrator(req);
    const policyId = requirePolicySimulationId(req.params.id, {
      codePrefix: 'POLICY_DESTINATION_COMPETITION_PREVIEW',
    });

    try {
      return sendData(res, await policyDestinationCompetitionPreviewService.preview({
        dbClient: db,
        policyId,
        draft: requirePolicySimulationDraft(req.body, {
          codePrefix: 'POLICY_DESTINATION_COMPETITION_PREVIEW',
          label: 'Policy destination competition preview',
        }),
      }));
    } catch (error) {
      if (error instanceof PolicyDestinationCompetitionPreviewNotFoundError) {
        throw new NotFoundError('Policy not found');
      }

      if (error instanceof PolicyIntentRequestValidationError) {
        throw new ValidationError(
          `Invalid policy intent draft: ${summarizePolicyIntentRequestValidationError(error)}`,
          { code: 'POLICY_DESTINATION_COMPETITION_PREVIEW_DRAFT_INVALID' },
        );
      }

      throw error;
    }
  }));
}
