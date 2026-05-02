/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import policyThresholds from './policyThresholds.shared.js';

export const DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD = policyThresholds.DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD;
export const DEFAULT_POLICY_PROMPT_THRESHOLD = policyThresholds.DEFAULT_POLICY_PROMPT_THRESHOLD;
export const POLICY_CLOSE_SCORE_MARGIN = policyThresholds.POLICY_CLOSE_SCORE_MARGIN;
export const POLICY_MAX_DECISION_THRESHOLD = policyThresholds.POLICY_MAX_DECISION_THRESHOLD;
export const POLICY_PROMPT_SELECT_MIN_CONFIDENCE = policyThresholds.POLICY_PROMPT_SELECT_MIN_CONFIDENCE;
export const normalizePolicyDecisionThresholds = policyThresholds.normalizePolicyDecisionThresholds;
export const parseFiniteThreshold = policyThresholds.parseFiniteThreshold;
export const validatePolicyDecisionThresholds = policyThresholds.validatePolicyDecisionThresholds;
export const validatePolicyThresholdField = policyThresholds.validatePolicyThresholdField;
export default policyThresholds;
