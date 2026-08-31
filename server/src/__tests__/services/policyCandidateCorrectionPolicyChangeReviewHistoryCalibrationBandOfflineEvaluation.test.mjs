/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandOfflineEvaluation.mjs';

function buildCorpus() {
  return {
    version: 'policy.candidate_correction_policy_change_calibration_band_fixture_corpus.v1',
    specification: {
      version: 'policy.candidate_decision_band_specification.v1',
      selectionMinimum: 40,
      confirmationMinimum: 60,
      automaticMinimum: 85,
    },
    fixtures: [
      ['manual-floor', 0, 'manual_review', 'manual'],
      ['manual-before-selection', 39, 'manual_review', 'manual'],
      ['selection-boundary', 40, 'operator_selection', 'prompt_select'],
      ['selection-before-confirmation', 59, 'operator_selection', 'prompt_select'],
      ['confirmation-boundary', 60, 'operator_confirmation', 'prompt_confirm'],
      ['confirmation-before-automatic', 84, 'operator_confirmation', 'prompt_confirm'],
      ['automatic-boundary', 85, 'automatic_candidate', 'auto_classify'],
      ['automatic-policy-ceiling', 95, 'automatic_candidate', 'auto_classify'],
    ].map(([id, score, bandId, action]) => ({ id, score, expected: { bandId, action } })),
  };
}

describe('policy-change calibration band offline evaluation', () => {
  test('passes the fixed, synthetic default-band boundaries without routing authority', () => {
    const result = evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(buildCorpus());

    expect(result).toEqual(expect.objectContaining({
      statusId: 'passed',
      summary: { fixtureCount: 8, matchedExpectationCount: 8, mismatchCount: 0 },
      validation: { ok: true, fixtureCount: 8, issueCount: 0, riskIds: [] },
      authority: expect.objectContaining({
        scope: 'offline_synthetic_fixed_band_comparison_only',
        automaticActions: expect.objectContaining({ routing: false, policyChange: false }),
      }),
    }));
  });

  test('reports an aggregate mismatch when a boundary expectation drifts', () => {
    const corpus = buildCorpus();
    corpus.fixtures[6].score = 84;

    expect(evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(corpus)).toEqual(
      expect.objectContaining({
        statusId: 'expectation_mismatch',
        summary: { fixtureCount: 8, matchedExpectationCount: 7, mismatchCount: 1 },
      }),
    );
  });

  test('fails closed on an invalid corpus without exposing individual fixture data', () => {
    const corpus = buildCorpus();
    corpus.fixtures[0].livePolicyId = 'not-permitted';
    const result = evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(corpus);

    expect(result).toEqual(expect.objectContaining({
      statusId: 'invalid_fixture_corpus',
      summary: { fixtureCount: 0, matchedExpectationCount: 0, mismatchCount: 0 },
    }));
    expect(JSON.stringify(result)).not.toMatch(/manual-floor|not-permitted/iu);
  });
});
