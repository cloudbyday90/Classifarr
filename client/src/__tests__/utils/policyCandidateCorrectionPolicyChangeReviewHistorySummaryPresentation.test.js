/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  normalizePolicyCandidateCorrectionPolicyChangeReviewHistorySummary,
  presentPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriod,
} from '@/utils/policyCandidateCorrectionPolicyChangeReviewHistorySummaryPresentation'

function response(overrides = {}) {
  return {
    version: 'policy.candidate_correction_policy_change_review_history_summary.v4',
    statusId: 'available',
    historyAvailable: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    consistency: {
      statusId: 'insufficient_activity',
      comparisonAvailable: false,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
    },
    calibrationReadiness: {
      statusId: 'insufficient_activity',
      reviewEligible: false,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
    },
    calibrationProtocol: {
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
    },
    periods: [{
      periodId: 'most_recent_completed',
      periodStart: '2026-07-29',
      conclusionSummaries: [
        { decisionId: 'retain_current_policy', recordedCount: 2, revisedCount: 1, totalCount: 3 },
        { decisionId: 'investigate_policy_evidence', recordedCount: 0, revisedCount: 0, totalCount: 0 },
        { decisionId: 'prepare_manual_policy_change', recordedCount: 1, revisedCount: 0, totalCount: 1 },
      ],
    }],
    ...overrides,
  }
}

describe('policy-change review history summary presentation', () => {
  it('projects only fixed completed-period count dimensions', () => {
    const normalized = normalizePolicyCandidateCorrectionPolicyChangeReviewHistorySummary(response({
      actorId: 7,
      policyId: 8,
    }))

    expect(normalized).toEqual(expect.objectContaining({ statusId: 'available', historyAvailable: true }))
    expect(presentPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriod(normalized.periods[0]))
      .toEqual(expect.objectContaining({ label: 'Most recent completed 30-day period' }))
    expect(JSON.stringify(normalized)).not.toContain('periodStart')
    expect(JSON.stringify(normalized)).not.toContain('actorId')
    expect(JSON.stringify(normalized)).not.toContain('policyId')
  })

  it('rejects a malformed count total or an unknown decision dimension', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistorySummary(response({
      periods: [{
        ...response().periods[0],
        conclusionSummaries: [
          { decisionId: 'apply_policy', recordedCount: 1, revisedCount: 0, totalCount: 1 },
          ...response().periods[0].conclusionSummaries.slice(1),
        ],
      }],
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistorySummary(response({
      periods: [{
        ...response().periods[0],
        conclusionSummaries: [
          { decisionId: 'retain_current_policy', recordedCount: 1, revisedCount: 0, totalCount: 2 },
          ...response().periods[0].conclusionSummaries.slice(1),
        ],
      }],
    }))).toBeNull()
  })
})
