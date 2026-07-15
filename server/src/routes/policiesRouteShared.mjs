/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerPresetRoutes } from './policiesRoutePresets.mjs';
import { registerPolicyCrudRoutes } from './policiesRoutePolicyCrud.mjs';

export function createPoliciesRouter({
  express,
  rateLimit,
  db,
  logger,
  listPresets,
  describePresetRuntimeSemantics,
  normalizeSignalConfig,
  DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
  DEFAULT_POLICY_PROMPT_THRESHOLD,
  validatePolicyDecisionThresholds,
  validatePolicyThresholdField,
}) {
  const router = express.Router();

  const sharedDeps = {
    db,
    logger,
    normalizeSignalConfig,
    describePresetRuntimeSemantics,
  };

  registerPresetRoutes(router, {
    ...sharedDeps,
    listPresets,
  });

  registerPolicyCrudRoutes(router, {
    ...sharedDeps,
    rateLimit,
    DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
    DEFAULT_POLICY_PROMPT_THRESHOLD,
    validatePolicyDecisionThresholds,
    validatePolicyThresholdField,
  });

  return router;
}
