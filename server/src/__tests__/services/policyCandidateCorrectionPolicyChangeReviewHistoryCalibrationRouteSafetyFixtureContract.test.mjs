/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS,
  validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureContract.mjs';

function buildScenario(overrides = {}) {
  return {
    providerRecoveryReviewRequired: false,
    manualEvidenceReviewRequired: false,
    aiAdvisory: false,
    policyAutoProvenance: 'current',
    requireAllConfirmations: false,
    fallbackResult: false,
    lowConfidence: false,
    clarificationRequested: false,
    ...overrides,
  };
}

function buildFixture(id, overrides = {}) {
  return {
    id,
    scenario: buildScenario(),
    expected: {
      automaticRouteAllowed: true,
      primaryGateId: null,
      blockingGateIds: [],
    },
    ...overrides,
  };
}

function buildCorpus() {
  return {
    version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION,
    fixtures: Array.from({ length: 9 }, (_, index) => buildFixture(`fixture-${index}`)),
  };
}

describe('policy-change calibration route-safety fixture contract', () => {
  test('accepts the complete fixed synthetic route-safety corpus shape', () => {
    expect(validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(buildCorpus())).toEqual({
      ok: true,
      fixtureCount: 9,
      issues: [],
    });
  });

  test('rejects live authority fields and incomplete scenario controls', () => {
    const corpus = buildCorpus();
    corpus.fixtures[0].routingChanged = true;
    delete corpus.fixtures[1].scenario.aiAdvisory;

    const validation =
      validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(corpus);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.UNKNOWN_FIELD,
        path: 'corpus.fixtures[0].routingChanged',
      }),
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.INVALID_SCENARIO,
        path: 'corpus.fixtures[1].scenario',
      }),
    ]));
  });

  test('rejects duplicate IDs and incoherent route-safety expectations', () => {
    const corpus = buildCorpus();
    corpus.fixtures[8] = buildFixture(corpus.fixtures[0].id, {
      expected: {
        automaticRouteAllowed: false,
        primaryGateId: null,
        blockingGateIds: [],
      },
    });

    const validation =
      validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(corpus);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.DUPLICATE_FIXTURE_ID,
        path: 'corpus.fixtures[8].id',
      }),
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.INVALID_EXPECTATION,
        path: 'corpus.fixtures[8].expected',
      }),
    ]));
  });
});
