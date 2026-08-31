/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
