/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
  DEFAULT_POLICY_PROMPT_THRESHOLD,
  POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
} from '../utils/policyThresholds.mjs';

export const POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION_VERSION =
  'policy.candidate_decision_band_specification.v1';

/**
 * This is a versioned reference for the current default policy profile. It is
 * not live configuration and cannot authorize a policy change or a route.
 */
export const POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION = Object.freeze({
  version: POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION_VERSION,
  selectionMinimum: POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
  confirmationMinimum: DEFAULT_POLICY_PROMPT_THRESHOLD,
  automaticMinimum: DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
});

export function matchesPolicyCandidateDecisionBandSpecification(value) {
  return value?.version === POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION.version &&
    value?.selectionMinimum === POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION.selectionMinimum &&
    value?.confirmationMinimum === POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION.confirmationMinimum &&
    value?.automaticMinimum === POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION.automaticMinimum;
}
