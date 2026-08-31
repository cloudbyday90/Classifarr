/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationOfflineEvaluation.mjs';

function buildCorpus() {
  return {
    version: 'policy.candidate_correction_policy_change_calibration_fixture_corpus.v1',
    fixtures: [
      {
        id: 'awaiting-aggregate-evidence',
        protocolInput: {
          calibrationReadiness: {
            statusId: 'insufficient_activity', reviewEligible: false, automaticPolicyChange: false,
            automaticAiRagTuning: false, routingChanged: false,
          },
          consistency: {
            statusId: 'consistent', comparisonAvailable: true, automaticPolicyChange: false,
            automaticAiRagTuning: false, routingChanged: false,
          },
        },
        expected: { statusId: 'awaiting_aggregate_evidence', protocolAvailable: false, procedureIds: [] },
      },
      {
        id: 'review-process-follow-up-required',
        protocolInput: {
          calibrationReadiness: {
            statusId: 'ready_for_human_review', reviewEligible: true, automaticPolicyChange: false,
            automaticAiRagTuning: false, routingChanged: false,
          },
          consistency: {
            statusId: 'shifted', comparisonAvailable: true, automaticPolicyChange: false,
            automaticAiRagTuning: false, routingChanged: false,
          },
        },
        expected: { statusId: 'review_process_follow_up_required', protocolAvailable: false, procedureIds: [] },
      },
      {
        id: 'ready-for-offline-protocol',
        protocolInput: {
          calibrationReadiness: {
            statusId: 'ready_for_human_review', reviewEligible: true, automaticPolicyChange: false,
            automaticAiRagTuning: false, routingChanged: false,
          },
          consistency: {
            statusId: 'consistent', comparisonAvailable: true, automaticPolicyChange: false,
            automaticAiRagTuning: false, routingChanged: false,
          },
        },
        expected: {
          statusId: 'ready_for_offline_protocol',
          protocolAvailable: true,
          procedureIds: [
            'freeze_aggregate_snapshot',
            'run_checked_in_synthetic_fixture_suite',
            'compare_fixed_policy_bands',
            'prepare_human_approval_packet',
          ],
        },
      },
    ],
  };
}

describe('policy-change calibration offline evaluation', () => {
  test('passes the three fixed protocol-admission cases without live details', () => {
    const result = evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(buildCorpus());

    expect(result).toEqual(expect.objectContaining({
      statusId: 'passed',
      fixtureCorpusVersion: 'policy.candidate_correction_policy_change_calibration_fixture_corpus.v1',
      summary: { fixtureCount: 3, matchedExpectationCount: 3, mismatchCount: 0 },
      validation: { ok: true, fixtureCount: 3, issueCount: 0, riskIds: [] },
    }));
    expect(JSON.stringify(result)).not.toMatch(/policyId|threshold|media|library|provider|prompt|response|rag/iu);
  });

  test('reports a fixed mismatch summary when the protocol changes unexpectedly', () => {
    const corpus = buildCorpus();
    corpus.fixtures[2].expected.protocolAvailable = false;
    corpus.fixtures[2].expected.procedureIds = [];

    const result = evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(corpus);

    expect(result).toEqual(expect.objectContaining({
      statusId: 'expectation_mismatch',
      summary: { fixtureCount: 3, matchedExpectationCount: 2, mismatchCount: 1 },
    }));
  });

  test('fails closed without admitting invalid fixture content', () => {
    const corpus = buildCorpus();
    corpus.fixtures[0].protocolInput.consistency.rawProviderResponse = '{"unsafe":true}';

    expect(evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(corpus)).toEqual(
      expect.objectContaining({
        statusId: 'invalid_fixture_corpus',
        summary: { fixtureCount: 0, matchedExpectationCount: 0, mismatchCount: 0 },
        validation: expect.objectContaining({ ok: false }),
      }),
    );
  });
});
