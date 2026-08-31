import { describe, expect, it } from 'vitest'
import {
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolPresentation,
  normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocol,
  presentPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolProcedure,
} from '@/utils/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolPresentation'

function response(overrides = {}) {
  return {
    statusId: 'ready_for_offline_protocol',
    protocolAvailable: true,
    protocolId: 'aggregate_synthetic_fixed_bands_v1',
    proposalPacketVersion: 'policy.candidate_correction_policy_change_human_review_packet.v1',
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
    ...overrides,
  }
}

describe('policy-change review history calibration protocol presentation', () => {
  it('projects only the fixed human procedure and drops unknown fields', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocol(response({
      periodStart: '2026-07-29',
      actorId: 7,
      threshold: 85,
    }))).toEqual({
      statusId: 'ready_for_offline_protocol',
      protocolAvailable: true,
      procedureIds: [
        'freeze_aggregate_snapshot',
        'run_checked_in_synthetic_fixture_suite',
        'compare_fixed_policy_bands',
        'prepare_human_approval_packet',
      ],
    })
  })

  it('fails closed for incomplete, reordered, or authority-bearing protocol data', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocol(response({
      procedureIds: response().procedureIds.slice(1),
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocol(response({
      proposalGenerated: true,
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocol(response({
      automaticPolicyChange: true,
    }))).toBeNull()
  })

  it('presents the controlled human procedure without an automatic action', () => {
    expect(getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolPresentation('ready_for_offline_protocol'))
      .toEqual(expect.objectContaining({
        heading: 'Offline calibration protocol is ready for human evaluation',
      }))
    expect(presentPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolProcedure(
      'prepare_human_approval_packet',
    )).toContain('do not apply a change automatically')
  })
})
