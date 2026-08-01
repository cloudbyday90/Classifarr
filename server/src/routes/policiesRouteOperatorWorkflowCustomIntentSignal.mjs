/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { policyIntentSignalCustomEntryLimiterConfig } from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  ServiceUnavailableError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyIntentSignalCustomEntryValidationError,
  buildPolicyIntentSignalCustomEntryCandidate,
  getPolicyIntentSignalCustomEntryCandidateKey,
} from '../services/policyIntentSignalCustomEntry.mjs';
import {
  policyOperatorWorkflowReadService,
} from '../services/policyOperatorWorkflowReadService.mjs';
import {
  loadPolicyOperatorWorkflowRouteContext,
  loadPolicyOperatorWorkflowStarterTemplateSuggestions,
  normalizePolicyOperatorWorkflowLibraryId,
} from './policyOperatorWorkflowRouteContext.mjs';
import {
  assertPolicyOperatorWorkflowReadResponse,
} from './policyOperatorWorkflowReadResponse.mjs';

function createPolicyIntentSignalCustomEntryLimiter(rateLimit) {
  return typeof rateLimit === 'function'
    ? rateLimit(policyIntentSignalCustomEntryLimiterConfig)
    : (_req, _res, next) => next();
}

function projectionContainsCustomEntry(result = {}, customCandidate = {}) {
  const candidateKey = getPolicyIntentSignalCustomEntryCandidateKey(customCandidate);
  if (!candidateKey) return false;

  return Array.isArray(result?.observedProfile?.intentSignalProjection?.options) &&
    result.observedProfile.intentSignalProjection.options.some((option) => (
      getPolicyIntentSignalCustomEntryCandidateKey(option) === candidateKey
    ));
}

export function registerPolicyOperatorWorkflowCustomIntentSignalRoutes(router, {
  db,
  listPresets,
  logger,
  rateLimit,
  operatorWorkflowReadService = policyOperatorWorkflowReadService,
} = {}) {
  const customEntryLimiter = createPolicyIntentSignalCustomEntryLimiter(rateLimit);

  router.post(
    '/operator-workflow/libraries/:libraryId/intent-signals/custom',
    customEntryLimiter,
    asyncHandler(async (req, res) => {
      const libraryId = normalizePolicyOperatorWorkflowLibraryId(req.params.libraryId);
      if (libraryId === null) {
        throw new ValidationError('libraryId must be a positive integer');
      }

      let customCandidate;
      try {
        customCandidate = buildPolicyIntentSignalCustomEntryCandidate(req.body);
      } catch (error) {
        if (error instanceof PolicyIntentSignalCustomEntryValidationError) {
          logger?.warn('Rejected custom policy intent-signal input', {
            libraryId,
            code: error.code,
          });
          throw new ValidationError(error.message, { code: error.code });
        }
        throw error;
      }

      const { library, routing } = await loadPolicyOperatorWorkflowRouteContext({ db, libraryId });
      const starterTemplateSuggestions = await loadPolicyOperatorWorkflowStarterTemplateSuggestions({
        library,
        listPresets,
        logger,
      });
      const result = await operatorWorkflowReadService.getWorkflow({
        library,
        routing,
        intentSignalSources: {
          starterTemplateSuggestions,
          customValueCandidates: [customCandidate],
        },
      });
      const audit = assertPolicyOperatorWorkflowReadResponse({ result, libraryId, logger });

      if (!projectionContainsCustomEntry(result, customCandidate)) {
        logger?.error('Custom policy intent-signal projection failed validation', {
          libraryId,
          auditIssues: audit.issues.map(issue => issue.riskId),
        });
        throw new ServiceUnavailableError(
          'Custom intent-signal validation is temporarily unavailable. Please try again.',
          { code: 'POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_UNAVAILABLE' },
        );
      }

      logger?.info('Custom policy intent signal validated without persistence', {
        libraryId,
        signalType: customCandidate.signalType,
      });

      return sendData(res, result);
    }),
  );
}

export {
  createPolicyIntentSignalCustomEntryLimiter,
  projectionContainsCustomEntry,
};
