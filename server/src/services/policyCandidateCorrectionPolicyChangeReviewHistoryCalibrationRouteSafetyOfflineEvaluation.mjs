/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CLASSIFICATION_ROUTE_SAFETY_VERSION,
  evaluateClassificationRouteSafety,
} from './classificationRouteSafetyGate.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION,
  validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureContract.mjs';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetySyntheticInput,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetySyntheticInput.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_REPORT_VERSION =
  'policy.candidate_correction_policy_change_calibration_route_safety_offline_evaluation_report.v1';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_STATUS_IDS = Object.freeze({
  EXPECTATION_MISMATCH: 'expectation_mismatch',
  INVALID_FIXTURE_CORPUS: 'invalid_fixture_corpus',
  PASSED: 'passed',
});

function buildAuthority() {
  return Object.freeze({
    scope: 'offline_synthetic_route_safety_comparison_only',
    operatorWorkflowAdmission: false,
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    }),
  });
}

function projectValidation(validation) {
  return Object.freeze({
    ok: validation.ok === true,
    fixtureCount: Number.isSafeInteger(validation.fixtureCount) ? validation.fixtureCount : 0,
    issueCount: Array.isArray(validation.issues) ? validation.issues.length : 0,
    riskIds: Object.freeze([...new Set(
      (Array.isArray(validation.issues) ? validation.issues : [])
        .map(issue => issue?.riskId)
        .filter(riskId => typeof riskId === 'string'),
    )].sort()),
  });
}

function matchesExpectation(actual, expected) {
  const actualGateIds = actual.blocking_gates.map(gate => gate.id);
  return actual.automatic_route_allowed === expected.automaticRouteAllowed &&
    (actual.primary_gate?.id || null) === expected.primaryGateId &&
    actualGateIds.length === expected.blockingGateIds.length &&
    actualGateIds.every((gateId, index) => gateId === expected.blockingGateIds[index]);
}

/**
 * Exercises only the current route-safety resolver with checked-in synthetic
 * inputs. It reports aggregate pass/fail data and has no policy, provider,
 * AI/RAG, persistence, retry, or routing authority.
 */
export function evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(corpus) {
  const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(corpus);
  const projectedValidation = projectValidation(validation);
  if (!validation.ok) {
    return Object.freeze({
      authority: buildAuthority(),
      fixtureCorpusVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION,
      routeSafetyVersion: CLASSIFICATION_ROUTE_SAFETY_VERSION,
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_STATUS_IDS.INVALID_FIXTURE_CORPUS,
      summary: Object.freeze({ fixtureCount: 0, matchedExpectationCount: 0, mismatchCount: 0 }),
      validation: projectedValidation,
      version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_REPORT_VERSION,
    });
  }

  const matchedExpectationCount = corpus.fixtures.filter((fixture) => {
    const input = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetySyntheticInput(fixture.scenario);
    const actual = evaluateClassificationRouteSafety(input);
    return matchesExpectation(actual, fixture.expected);
  }).length;
  const fixtureCount = corpus.fixtures.length;
  const mismatchCount = fixtureCount - matchedExpectationCount;

  return Object.freeze({
    authority: buildAuthority(),
    fixtureCorpusVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION,
    routeSafetyVersion: CLASSIFICATION_ROUTE_SAFETY_VERSION,
    statusId: mismatchCount === 0
      ? POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_STATUS_IDS.PASSED
      : POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_STATUS_IDS.EXPECTATION_MISMATCH,
    summary: Object.freeze({ fixtureCount, matchedExpectationCount, mismatchCount }),
    validation: projectedValidation,
    version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_REPORT_VERSION,
  });
}
