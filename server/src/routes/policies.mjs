/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  describePresetRuntimeSemantics,
  normalizeSignalConfig,
} from '../utils/policySignals.mjs';
import * as policyThresholdsModule from '../utils/policyThresholds.mjs';
import { listPresets } from '../utils/presetCatalog.mjs';
import { createPoliciesRouter } from './policiesRouteShared.mjs';

const {
  DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
  DEFAULT_POLICY_PROMPT_THRESHOLD,
  validatePolicyDecisionThresholds,
  validatePolicyThresholdField,
} = policyThresholdsModule;

const logger = createLogger('PoliciesRoute');

export const router = createPoliciesRouter({
  express,
  db,
  logger,
  listPresets,
  describePresetRuntimeSemantics,
  normalizeSignalConfig,
  DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
  DEFAULT_POLICY_PROMPT_THRESHOLD,
  validatePolicyDecisionThresholds,
  validatePolicyThresholdField,
});
