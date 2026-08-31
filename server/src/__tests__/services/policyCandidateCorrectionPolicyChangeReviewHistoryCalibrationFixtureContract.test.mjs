/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS,
  validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureContract.mjs';

function buildFixture(overrides = {}) {
  return {
    id: 'ready-for-offline-protocol',
    protocolInput: {
      calibrationReadiness: {
        statusId: 'ready_for_human_review',
        reviewEligible: true,
        automaticPolicyChange: false,
        automaticAiRagTuning: false,
        routingChanged: false,
      },
      consistency: {
        statusId: 'consistent',
        comparisonAvailable: true,
        automaticPolicyChange: false,
        automaticAiRagTuning: false,
        routingChanged: false,
      },
    },
    expected: {
      statusId: 'ready_for_offline_protocol',
      protocolAvailable: true,
      procedureIds: [
        'freeze_aggregate_snapshot',
        'run_checked_in_synthetic_fixture_suite',
        'compare_fixed_policy_bands',
        'verify_route_safety_gates',
        'prepare_human_approval_packet',
      ],
    },
    ...overrides,
  };
}

function buildCorpus(fixtures = [buildFixture(), {
  ...buildFixture({ id: 'awaiting-aggregate-evidence' }),
  protocolInput: {
    ...buildFixture().protocolInput,
    calibrationReadiness: {
      ...buildFixture().protocolInput.calibrationReadiness,
      statusId: 'insufficient_activity',
      reviewEligible: false,
    },
  },
  expected: { statusId: 'awaiting_aggregate_evidence', protocolAvailable: false, procedureIds: [] },
}, {
  ...buildFixture({ id: 'review-process-follow-up-required' }),
  protocolInput: {
    ...buildFixture().protocolInput,
    consistency: { ...buildFixture().protocolInput.consistency, statusId: 'shifted' },
  },
  expected: { statusId: 'review_process_follow_up_required', protocolAvailable: false, procedureIds: [] },
}]) {
  return { version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION, fixtures };
}

describe('policy-change calibration fixture contract', () => {
  test('accepts the fixed synthetic status combinations', () => {
    expect(validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(buildCorpus())).toEqual({
      ok: true,
      fixtureCount: 3,
      issues: [],
    });
  });

  test('fails closed on live policy fields and automatic authority', () => {
    const fixture = buildFixture();
    fixture.policyId = 'live-policy-id';
    fixture.protocolInput.calibrationReadiness.automaticPolicyChange = true;

    const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(
      buildCorpus([fixture, buildCorpus().fixtures[1], buildCorpus().fixtures[2]]),
    );

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.UNKNOWN_FIELD,
        path: 'corpus.fixtures[0].policyId',
      }),
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_AUTHORITY,
        path: 'corpus.fixtures[0].protocolInput.calibrationReadiness',
      }),
    ]));
  });

  test('rejects duplicate fixture IDs and incomplete procedure expectations', () => {
    const duplicate = buildFixture({ id: 'ready-for-offline-protocol' });
    duplicate.expected.procedureIds = ['prepare_human_approval_packet'];

    const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(
      buildCorpus([buildFixture(), duplicate, buildCorpus().fixtures[1]]),
    );

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_EXPECTATION,
        path: 'corpus.fixtures[1].expected',
      }),
    ]));
  });
});
