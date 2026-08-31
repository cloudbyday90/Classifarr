/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryConsistencyContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_ID =
  'aggregate_synthetic_fixed_bands_v1';
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROPOSAL_PACKET_VERSION =
  'policy.candidate_correction_policy_change_human_review_packet.v1';
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_PROCEDURE_IDS = Object.freeze([
  'freeze_aggregate_snapshot',
  'run_checked_in_synthetic_fixture_suite',
  'compare_fixed_policy_bands',
  'verify_route_safety_gates',
  'prepare_human_approval_packet',
]);

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_STATUS_IDS = Object.freeze({
  AWAITING_AGGREGATE_EVIDENCE: 'awaiting_aggregate_evidence',
  REVIEW_PROCESS_FOLLOW_UP_REQUIRED: 'review_process_follow_up_required',
  READY_FOR_OFFLINE_PROTOCOL: 'ready_for_offline_protocol',
});

const READINESS_ELIGIBILITY = Object.freeze({
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.COLLECTING_PERIODS]: false,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.INSUFFICIENT_ACTIVITY]: false,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.READY_FOR_HUMAN_REVIEW]: true,
});

const CONSISTENCY_COMPARISON_AVAILABILITY = Object.freeze({
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.COLLECTING]: false,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.INSUFFICIENT_ACTIVITY]: false,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.CONSISTENT]: true,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.SHIFTED]: true,
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasNoAutomaticAuthority(source) {
  return source?.automaticPolicyChange === false && source.automaticAiRagTuning === false &&
    source.routingChanged === false;
}

function normalizeCalibrationReadiness(value) {
  const source = asPlainObject(value);
  if (!source || !Object.hasOwn(READINESS_ELIGIBILITY, source.statusId) ||
      source.reviewEligible !== READINESS_ELIGIBILITY[source.statusId] || !hasNoAutomaticAuthority(source)) {
    return null;
  }
  return Object.freeze({ statusId: source.statusId, reviewEligible: source.reviewEligible });
}

function normalizeConsistency(value) {
  const source = asPlainObject(value);
  if (!source || !Object.hasOwn(CONSISTENCY_COMPARISON_AVAILABILITY, source.statusId) ||
      source.comparisonAvailable !== CONSISTENCY_COMPARISON_AVAILABILITY[source.statusId] ||
      !hasNoAutomaticAuthority(source)) {
    return null;
  }
  return Object.freeze({ statusId: source.statusId, comparisonAvailable: source.comparisonAvailable });
}

function createReadModel({ statusId, protocolAvailable } = {}) {
  return Object.freeze({
    statusId,
    protocolAvailable,
    protocolId: protocolAvailable
      ? POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_ID
      : null,
    proposalPacketVersion: protocolAvailable
      ? POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROPOSAL_PACKET_VERSION
      : null,
    procedureIds: protocolAvailable
      ? POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_PROCEDURE_IDS
      : Object.freeze([]),
    humanApprovalRequired: true,
    proposalGenerated: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
  });
}

/**
 * Describes only a future human-controlled offline procedure. It cannot
 * calculate or persist a policy proposal, threshold, snapshot, or routing
 * action and accepts only already-redacted aggregate status read models.
 */
export function buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolReadModel({
  calibrationReadiness = null,
  consistency = null,
} = {}) {
  const normalizedReadiness = normalizeCalibrationReadiness(calibrationReadiness);
  if (!normalizedReadiness || !normalizedReadiness.reviewEligible) {
    return createReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_STATUS_IDS.AWAITING_AGGREGATE_EVIDENCE,
      protocolAvailable: false,
    });
  }

  const normalizedConsistency = normalizeConsistency(consistency);
  if (!normalizedConsistency ||
      normalizedConsistency.statusId !== POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.CONSISTENT) {
    return createReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_STATUS_IDS.REVIEW_PROCESS_FOLLOW_UP_REQUIRED,
      protocolAvailable: false,
    });
  }

  return createReadModel({
    statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_STATUS_IDS.READY_FOR_OFFLINE_PROTOCOL,
    protocolAvailable: true,
  });
}
