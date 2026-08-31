/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION,
} from './policyCandidateDecisionBandSpecification.mjs';

export const POLICY_CANDIDATE_DECISION_BAND_VERSION = 'policy.candidate_decision_band.v1';

export const POLICY_CANDIDATE_DECISION_BAND_IDS = Object.freeze({
  AUTOMATIC_CANDIDATE: 'automatic_candidate',
  MANUAL_REVIEW: 'manual_review',
  OPERATOR_CONFIRMATION: 'operator_confirmation',
  OPERATOR_SELECTION: 'operator_selection',
});

const BAND_DETAILS = Object.freeze({
  [POLICY_CANDIDATE_DECISION_BAND_IDS.AUTOMATIC_CANDIDATE]: Object.freeze({
    action: 'auto_classify',
    requiresOperatorConfirmation: false,
    requiresOperatorSelection: false,
  }),
  [POLICY_CANDIDATE_DECISION_BAND_IDS.MANUAL_REVIEW]: Object.freeze({
    action: 'manual',
    requiresOperatorConfirmation: true,
    requiresOperatorSelection: false,
  }),
  [POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_CONFIRMATION]: Object.freeze({
    action: 'prompt_confirm',
    requiresOperatorConfirmation: true,
    requiresOperatorSelection: false,
  }),
  [POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_SELECTION]: Object.freeze({
    action: 'prompt_select',
    requiresOperatorConfirmation: true,
    requiresOperatorSelection: true,
  }),
});

function buildReadModel(bandId) {
  const details = BAND_DETAILS[bandId];
  return Object.freeze({
    version: POLICY_CANDIDATE_DECISION_BAND_VERSION,
    bandId,
    action: details.action,
    requiresOperatorConfirmation: details.requiresOperatorConfirmation,
    requiresOperatorSelection: details.requiresOperatorSelection,
    automaticRouteAuthorized: false,
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    }),
  });
}

function hasValidThresholdOrder({ promptThreshold, autoClassifyThreshold }) {
  return Number.isFinite(promptThreshold) && Number.isFinite(autoClassifyThreshold) &&
    promptThreshold >= 0 && autoClassifyThreshold >= 0 &&
    promptThreshold <= autoClassifyThreshold;
}

/**
 * Resolves only the ordinary score-band action for one already-ranked policy
 * candidate. It deliberately does not handle ambiguity, weak-evidence gates,
 * AI verification, route safety, persistence, or routing authority.
 */
export function resolvePolicyCandidateDecisionBand({
  score = null,
  promptThreshold = null,
  autoClassifyThreshold = null,
} = {}) {
  if (!Number.isFinite(score) || !hasValidThresholdOrder({ promptThreshold, autoClassifyThreshold })) {
    return buildReadModel(POLICY_CANDIDATE_DECISION_BAND_IDS.MANUAL_REVIEW);
  }

  if (score >= autoClassifyThreshold) {
    return buildReadModel(POLICY_CANDIDATE_DECISION_BAND_IDS.AUTOMATIC_CANDIDATE);
  }

  if (score >= promptThreshold) {
    return buildReadModel(POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_CONFIRMATION);
  }

  if (score >= POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION.selectionMinimum) {
    return buildReadModel(POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_SELECTION);
  }

  return buildReadModel(POLICY_CANDIDATE_DECISION_BAND_IDS.MANUAL_REVIEW);
}
