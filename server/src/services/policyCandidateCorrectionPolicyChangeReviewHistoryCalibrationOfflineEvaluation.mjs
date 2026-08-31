/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION,
  validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureContract.mjs';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_REPORT_VERSION =
  'policy.candidate_correction_policy_change_calibration_offline_evaluation_report.v1';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_STATUS_IDS = Object.freeze({
  EXPECTATION_MISMATCH: 'expectation_mismatch',
  INVALID_FIXTURE_CORPUS: 'invalid_fixture_corpus',
  PASSED: 'passed',
});

function buildAuthority() {
  return Object.freeze({
    scope: 'offline_synthetic_evaluation_only',
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
  return actual.statusId === expected.statusId && actual.protocolAvailable === expected.protocolAvailable &&
    actual.procedureIds.length === expected.procedureIds.length &&
    actual.procedureIds.every((procedureId, index) => procedureId === expected.procedureIds[index]);
}

/**
 * Exercises only the fixed, pure protocol contract against a checked-in
 * synthetic corpus. It accepts no paths or runtime inputs and cannot read live
 * data, invoke AI/RAG, persist evidence, approve a packet, alter policy, or
 * route media.
 */
export function evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(corpus) {
  const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(corpus);
  const projectedValidation = projectValidation(validation);
  if (!validation.ok) {
    return Object.freeze({
      authority: buildAuthority(),
      fixtureCorpusVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION,
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_STATUS_IDS.INVALID_FIXTURE_CORPUS,
      summary: Object.freeze({ fixtureCount: 0, matchedExpectationCount: 0, mismatchCount: 0 }),
      validation: projectedValidation,
      version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_REPORT_VERSION,
    });
  }

  const matchedExpectationCount = corpus.fixtures.filter((fixture) => {
    const actual = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel(
      fixture.protocolInput,
    );
    return matchesExpectation(actual, fixture.expected);
  }).length;
  const fixtureCount = corpus.fixtures.length;
  const mismatchCount = fixtureCount - matchedExpectationCount;

  return Object.freeze({
    authority: buildAuthority(),
    fixtureCorpusVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION,
    statusId: mismatchCount === 0
      ? POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_STATUS_IDS.PASSED
      : POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_STATUS_IDS.EXPECTATION_MISMATCH,
    summary: Object.freeze({ fixtureCount, matchedExpectationCount, mismatchCount }),
    validation: projectedValidation,
    version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_REPORT_VERSION,
  });
}
