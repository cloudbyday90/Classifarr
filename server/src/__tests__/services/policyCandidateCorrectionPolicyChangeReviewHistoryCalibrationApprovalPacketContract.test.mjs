/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketContract.mjs';
import {
  evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationOfflineEvaluation.mjs';

function buildPassingEvaluation() {
  return evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus({
    version: 'policy.candidate_correction_policy_change_calibration_fixture_corpus.v1',
    fixtures: ['awaiting-aggregate-evidence', 'review-process-follow-up-required', 'ready-for-offline-protocol']
      .map((id, index) => ({
        id,
        protocolInput: {
          calibrationReadiness: {
            statusId: index === 0 ? 'insufficient_activity' : 'ready_for_human_review',
            reviewEligible: index !== 0,
            automaticPolicyChange: false,
            automaticAiRagTuning: false,
            routingChanged: false,
          },
          consistency: {
            statusId: index === 1 ? 'shifted' : 'consistent',
            comparisonAvailable: true,
            automaticPolicyChange: false,
            automaticAiRagTuning: false,
            routingChanged: false,
          },
        },
        expected: index === 0
          ? { statusId: 'awaiting_aggregate_evidence', protocolAvailable: false, procedureIds: [] }
          : index === 1
            ? { statusId: 'review_process_follow_up_required', protocolAvailable: false, procedureIds: [] }
            : {
                statusId: 'ready_for_offline_protocol',
                protocolAvailable: true,
                procedureIds: [
                  'freeze_aggregate_snapshot',
                  'run_checked_in_synthetic_fixture_suite',
                  'compare_fixed_policy_bands',
                  'prepare_human_approval_packet',
                ],
              },
      })),
  });
}

describe('policy-change calibration approval packet contract', () => {
  test('creates only a versioned, content-free human approval packet after a passed evaluation', () => {
    const result = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel({
      evaluation: buildPassingEvaluation(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'human_approval_required',
      packetAvailable: true,
      humanApprovalRequired: true,
      approvalRecorded: false,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
      packet: expect.objectContaining({
        version: 'policy.candidate_correction_policy_change_human_review_packet.v1',
        fixtureCount: 3,
        approvalRecorded: false,
      }),
    }));
    expect(JSON.stringify(result)).not.toMatch(/"(?:actor|signature|policyId|threshold|media|provider|prompt|response)"\s*:/u);
  });

  test('does not produce a packet from a mismatched or authority-bearing evaluation', () => {
    const passingEvaluation = buildPassingEvaluation();
    const mismatch = { ...passingEvaluation, statusId: 'expectation_mismatch' };
    const authorityBearing = {
      ...passingEvaluation,
      authority: {
        ...passingEvaluation.authority,
        automaticActions: {
          ...passingEvaluation.authority.automaticActions,
          policyChange: true,
        },
      },
    };

    [mismatch, authorityBearing].forEach((evaluation) => {
      expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel({ evaluation }))
        .toEqual(expect.objectContaining({
          statusId: 'offline_evaluation_not_ready',
          packetAvailable: false,
          packet: null,
          approvalRecorded: false,
        }));
    });
  });
});
