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
import { ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  policyOperatorWorkflowReadService,
} from '../services/policyOperatorWorkflowReadService.mjs';
import {
  loadPolicyOperatorWorkflowRouteContext,
  loadPolicyOperatorWorkflowStarterTemplateSuggestions,
  normalizePolicyOperatorWorkflowLibraryId,
} from './policyOperatorWorkflowRouteContext.mjs';

export function registerPolicyOperatorWorkflowReadRoutes(router, {
  db,
  listPresets,
  logger,
  operatorWorkflowReadService = policyOperatorWorkflowReadService,
} = {}) {
  router.get('/operator-workflow/libraries/:libraryId', asyncHandler(async (req, res) => {
    const libraryId = normalizePolicyOperatorWorkflowLibraryId(req.params.libraryId);
    if (libraryId === null) {
      throw new ValidationError('libraryId must be a positive integer');
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
      intentSignalSources: { starterTemplateSuggestions },
    });

    return sendData(res, result);
  }));
}
