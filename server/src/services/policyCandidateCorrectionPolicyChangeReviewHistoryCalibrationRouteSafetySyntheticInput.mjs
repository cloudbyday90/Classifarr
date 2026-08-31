/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildProviderRecovery } from './classificationProviderRecovery.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_PROVENANCE_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureContract.mjs';

const RESULT_LIBRARY_ID = 'synthetic-route-library';
const MISMATCHED_POLICY_LIBRARY_ID = 'synthetic-route-other-library';
const POLICY_SCORE = 90;
const POLICY_AUTO_THRESHOLD = 85;

function freezePolicyResult({ scenario, policyLibraryId }) {
  return Object.freeze({
    action: 'auto_classify',
    ranked: Object.freeze([Object.freeze({
      library_id: policyLibraryId,
      score: POLICY_SCORE,
      prompt_threshold: 60,
      auto_classify_threshold: POLICY_AUTO_THRESHOLD,
    })]),
    ...(scenario.manualEvidenceReviewRequired ? {
      decisionDiagnostics: Object.freeze({
        requires_manual_review: true,
        reason_code: 'weak_evidence_primary',
      }),
    } : {}),
  });
}

function getMethod(scenario) {
  if (scenario.aiAdvisory) return 'ai_verified';
  if (scenario.fallbackResult) return 'fallback';
  return 'policy_auto';
}

/**
 * Builds a fully synthetic, high-score result for the existing route-safety
 * resolver. The fixture schema cannot carry runtime libraries, providers,
 * media, prompts, model output, or writable routing information.
 */
export function buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetySyntheticInput(scenario = {}) {
  const policyLibraryId = scenario.policyAutoProvenance ===
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_PROVENANCE_IDS.MISMATCHED_LIBRARY
    ? MISMATCHED_POLICY_LIBRARY_ID
    : RESULT_LIBRARY_ID;
  const policyResult = freezePolicyResult({ scenario, policyLibraryId });
  const result = Object.freeze({
    library: Object.freeze({ id: RESULT_LIBRARY_ID }),
    confidence: scenario.lowConfidence ? 69 : 90,
    method: getMethod(scenario),
    policyResult,
    ...(scenario.providerRecoveryReviewRequired ? {
      provider_recovery: buildProviderRecovery(),
    } : {}),
    ...(scenario.clarificationRequested ? { needs_clarification: true } : {}),
  });

  return Object.freeze({
    result,
    policyResult,
    requireAllConfirmations: scenario.requireAllConfirmations === true,
  });
}
