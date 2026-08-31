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
import {
  evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandOfflineEvaluation.mjs';
import {
  evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyOfflineEvaluation.mjs';

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
                  'verify_route_safety_gates',
                  'prepare_human_approval_packet',
                ],
              },
      })),
  });
}

function buildPassingBandEvaluation() {
  return evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus({
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
  });
}

function buildRouteSafetyScenario(overrides = {}) {
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

function buildPassingRouteSafetyEvaluation() {
  return evaluatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus({
    version: 'policy.candidate_correction_policy_change_calibration_route_safety_fixture_corpus.v1',
    fixtures: [
      ['route-safety-baseline', {}, true, null, []],
      ['route-safety-provider', { providerRecoveryReviewRequired: true }, false, 'provider_recovery_review_required', ['provider_recovery_review_required']],
      ['route-safety-evidence', { manualEvidenceReviewRequired: true }, false, 'manual_policy_evidence_review_required', ['manual_policy_evidence_review_required']],
      ['route-safety-ai', { aiAdvisory: true }, false, 'ai_advisory_cannot_route', ['ai_advisory_cannot_route']],
      ['route-safety-provenance', { policyAutoProvenance: 'mismatched_library' }, false, 'policy_auto_provenance_required', ['policy_auto_provenance_required']],
      ['route-safety-confirmation', { requireAllConfirmations: true }, false, 'administrative_confirmation_required', ['administrative_confirmation_required']],
      ['route-safety-fallback', { fallbackResult: true }, false, 'fallback_result_review_required', ['fallback_result_review_required']],
      ['route-safety-confidence', { lowConfidence: true }, false, 'low_confidence_review_required', ['low_confidence_review_required']],
      ['route-safety-clarification', { clarificationRequested: true }, false, 'clarification_requested', ['clarification_requested']],
    ].map(([id, scenario, automaticRouteAllowed, primaryGateId, blockingGateIds]) => ({
      id,
      scenario: buildRouteSafetyScenario(scenario),
      expected: { automaticRouteAllowed, primaryGateId, blockingGateIds },
    })),
  });
}

describe('policy-change calibration approval packet contract', () => {
  test('creates only a versioned, content-free human approval packet after a passed evaluation', () => {
    const result = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel({
      evaluation: buildPassingEvaluation(),
      bandEvaluation: buildPassingBandEvaluation(),
      routeSafetyEvaluation: buildPassingRouteSafetyEvaluation(),
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
        bandFixtureCount: 8,
        bandEvidenceRequired: true,
        routeSafetyFixtureCount: 9,
        routeSafetyEvidenceRequired: true,
        approvalRecorded: false,
      }),
    }));
    expect(JSON.stringify(result)).not.toMatch(/"(?:actor|signature|policyId|threshold|media|provider|prompt|response)"\s*:/u);
  });

  test('does not produce a packet from a mismatched or authority-bearing evaluation', () => {
    const passingEvaluation = buildPassingEvaluation();
    const passingBandEvaluation = buildPassingBandEvaluation();
    const passingRouteSafetyEvaluation = buildPassingRouteSafetyEvaluation();
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
      expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel({
        evaluation,
        bandEvaluation: passingBandEvaluation,
        routeSafetyEvaluation: passingRouteSafetyEvaluation,
      }))
        .toEqual(expect.objectContaining({
          statusId: 'offline_evaluation_not_ready',
          packetAvailable: false,
          packet: null,
          approvalRecorded: false,
        }));
    });

    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel({
      evaluation: passingEvaluation,
      bandEvaluation: passingBandEvaluation,
    })).toEqual(expect.objectContaining({
      statusId: 'offline_evaluation_not_ready',
      packetAvailable: false,
    }));

    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel({
      evaluation: passingEvaluation,
      bandEvaluation: passingBandEvaluation,
      routeSafetyEvaluation: {
        ...passingRouteSafetyEvaluation,
        authority: {
          ...passingRouteSafetyEvaluation.authority,
          automaticActions: {
            ...passingRouteSafetyEvaluation.authority.automaticActions,
            routing: true,
          },
        },
      },
    })).toEqual(expect.objectContaining({
      statusId: 'offline_evaluation_not_ready',
      packetAvailable: false,
    }));
  });
});
