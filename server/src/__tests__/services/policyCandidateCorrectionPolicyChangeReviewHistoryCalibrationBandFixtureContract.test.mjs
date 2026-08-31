/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_CORPUS_VERSION,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS,
  validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureContract.mjs';

const FIXTURES = Object.freeze([
  ['manual-floor', 0, 'manual_review', 'manual'],
  ['manual-before-selection', 39, 'manual_review', 'manual'],
  ['selection-boundary', 40, 'operator_selection', 'prompt_select'],
  ['selection-before-confirmation', 59, 'operator_selection', 'prompt_select'],
  ['confirmation-boundary', 60, 'operator_confirmation', 'prompt_confirm'],
  ['confirmation-before-automatic', 84, 'operator_confirmation', 'prompt_confirm'],
  ['automatic-boundary', 85, 'automatic_candidate', 'auto_classify'],
  ['automatic-policy-ceiling', 95, 'automatic_candidate', 'auto_classify'],
]);

function buildCorpus() {
  return {
    version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_CORPUS_VERSION,
    specification: {
      version: 'policy.candidate_decision_band_specification.v1',
      selectionMinimum: 40,
      confirmationMinimum: 60,
      automaticMinimum: 85,
    },
    fixtures: FIXTURES.map(([id, score, bandId, action]) => ({
      id,
      score,
      expected: { bandId, action },
    })),
  };
}

describe('policy-change calibration band fixture contract', () => {
  test('accepts the complete, fixed synthetic default-band corpus', () => {
    expect(validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(buildCorpus())).toEqual({
      ok: true,
      fixtureCount: 8,
      issues: [],
    });
  });

  test('rejects an altered fixed specification and unknown authority fields', () => {
    const corpus = buildCorpus();
    corpus.specification.automaticMinimum = 84;
    corpus.fixtures[0].routingChanged = true;

    const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(corpus);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_SPECIFICATION,
        path: 'corpus.specification',
      }),
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.UNKNOWN_FIELD,
        path: 'corpus.fixtures[0].routingChanged',
      }),
    ]));
  });

  test('rejects duplicate fixture IDs and mismatched expected actions', () => {
    const corpus = buildCorpus();
    corpus.fixtures[7] = {
      ...corpus.fixtures[7],
      id: corpus.fixtures[0].id,
      expected: { bandId: 'automatic_candidate', action: 'prompt_confirm' },
    };

    const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(corpus);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.DUPLICATE_FIXTURE_ID,
        path: 'corpus.fixtures[7].id',
      }),
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_EXPECTATION,
        path: 'corpus.fixtures[7].expected',
      }),
    ]));
  });
});
