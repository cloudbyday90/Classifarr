/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolContract.mjs';

function readiness(overrides = {}) {
  return {
    statusId: 'ready_for_human_review',
    reviewEligible: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    ...overrides,
  };
}

function consistency(overrides = {}) {
  return {
    statusId: 'consistent',
    comparisonAvailable: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    ...overrides,
  };
}

describe('policy-change review history calibration protocol contract', () => {
  test('waits for six eligible aggregate periods without exposing a procedure', () => {
    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel({
      calibrationReadiness: readiness({ statusId: 'insufficient_activity', reviewEligible: false }),
      consistency: consistency(),
    })).toEqual(expect.objectContaining({
      statusId: 'awaiting_aggregate_evidence',
      protocolAvailable: false,
      procedureIds: [],
    }));
  });

  test('requires a currently consistent review process before admitting the offline procedure', () => {
    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel({
      calibrationReadiness: readiness(),
      consistency: consistency({ statusId: 'shifted' }),
    })).toEqual(expect.objectContaining({
      statusId: 'review_process_follow_up_required',
      protocolAvailable: false,
    }));
  });

  test('returns only the fixed human protocol after both bounded signals pass', () => {
    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel({
      calibrationReadiness: readiness(),
      consistency: consistency(),
    })).toEqual(expect.objectContaining({
      statusId: 'ready_for_offline_protocol',
      protocolAvailable: true,
      procedureIds: [
        'freeze_aggregate_snapshot',
        'run_checked_in_synthetic_fixture_suite',
        'compare_fixed_policy_bands',
        'prepare_human_approval_packet',
      ],
      humanApprovalRequired: true,
      proposalGenerated: false,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
    }));
  });

  test('fails closed for malformed or authority-bearing input without returning review data', () => {
    const result = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel({
      calibrationReadiness: readiness({ automaticPolicyChange: true }),
      consistency: consistency(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'awaiting_aggregate_evidence',
      protocolAvailable: false,
    }));
    expect(JSON.stringify(result)).not.toMatch(/recordedCount|revisedCount|totalCount|periodStart|actor|policyId|threshold/iu);
  });
});
