/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_REPORT_VERSION,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_STATUS_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationOfflineEvaluation.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_CORPUS_VERSION,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_OFFLINE_EVALUATION_REPORT_VERSION,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_OFFLINE_EVALUATION_STATUS_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandOfflineEvaluation.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_REPORT_VERSION,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_STATUS_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyOfflineEvaluation.mjs';
import {
  POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION_VERSION,
} from './policyCandidateDecisionBandSpecification.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_ID,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_PROCEDURE_IDS,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROPOSAL_PACKET_VERSION,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_APPROVAL_PACKET_STATUS_IDS = Object.freeze({
  HUMAN_APPROVAL_REQUIRED: 'human_approval_required',
  OFFLINE_EVALUATION_NOT_READY: 'offline_evaluation_not_ready',
});

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExpectedAuthority(value) {
  return value?.scope === 'offline_synthetic_evaluation_only' && value?.operatorWorkflowAdmission === false &&
    value?.automaticActions?.aiInvocation === false && value?.automaticActions?.learning === false &&
    value?.automaticActions?.policyChange === false && value?.automaticActions?.retry === false &&
    value?.automaticActions?.routing === false;
}

function normalizeSuccessfulEvaluation(value) {
  const source = isPlainRecord(value) ? value : null;
  const validation = isPlainRecord(source?.validation) ? source.validation : null;
  const summary = isPlainRecord(source?.summary) ? source.summary : null;
  const fixtureCount = Number(summary?.fixtureCount);
  const matchedExpectationCount = Number(summary?.matchedExpectationCount);
  const mismatchCount = Number(summary?.mismatchCount);
  const validFixtureCount = Number.isSafeInteger(fixtureCount) && fixtureCount >= 3 && fixtureCount <= 16;

  if (!source || source.version !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_REPORT_VERSION ||
      source.fixtureCorpusVersion !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION ||
      source.statusId !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_STATUS_IDS.PASSED ||
      !hasExpectedAuthority(source.authority) || !validation || validation.ok !== true ||
      validation.fixtureCount !== fixtureCount || validation.issueCount !== 0 ||
      !Array.isArray(validation.riskIds) || validation.riskIds.length !== 0 || !validFixtureCount ||
      matchedExpectationCount !== fixtureCount || mismatchCount !== 0) {
    return null;
  }

  return Object.freeze({ fixtureCount });
}

function normalizeSuccessfulBandEvaluation(value) {
  const source = isPlainRecord(value) ? value : null;
  const validation = isPlainRecord(source?.validation) ? source.validation : null;
  const summary = isPlainRecord(source?.summary) ? source.summary : null;
  const fixtureCount = Number(summary?.fixtureCount);
  const matchedExpectationCount = Number(summary?.matchedExpectationCount);
  const mismatchCount = Number(summary?.mismatchCount);
  const validFixtureCount = Number.isSafeInteger(fixtureCount) && fixtureCount >= 8 && fixtureCount <= 16;

  if (!source || source.version !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_OFFLINE_EVALUATION_REPORT_VERSION ||
      source.fixtureCorpusVersion !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_CORPUS_VERSION ||
      source.specificationVersion !== POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION_VERSION ||
      source.statusId !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_OFFLINE_EVALUATION_STATUS_IDS.PASSED ||
      source.authority?.scope !== 'offline_synthetic_fixed_band_comparison_only' ||
      source.authority?.operatorWorkflowAdmission !== false ||
      source.authority?.automaticActions?.aiInvocation !== false ||
      source.authority?.automaticActions?.learning !== false ||
      source.authority?.automaticActions?.policyChange !== false ||
      source.authority?.automaticActions?.retry !== false ||
      source.authority?.automaticActions?.routing !== false ||
      !validation || validation.ok !== true || validation.fixtureCount !== fixtureCount ||
      validation.issueCount !== 0 || !Array.isArray(validation.riskIds) || validation.riskIds.length !== 0 ||
      !validFixtureCount || matchedExpectationCount !== fixtureCount || mismatchCount !== 0) {
    return null;
  }

  return Object.freeze({ fixtureCount });
}

function normalizeSuccessfulRouteSafetyEvaluation(value) {
  const source = isPlainRecord(value) ? value : null;
  const validation = isPlainRecord(source?.validation) ? source.validation : null;
  const summary = isPlainRecord(source?.summary) ? source.summary : null;
  const fixtureCount = Number(summary?.fixtureCount);
  const matchedExpectationCount = Number(summary?.matchedExpectationCount);
  const mismatchCount = Number(summary?.mismatchCount);
  const validFixtureCount = Number.isSafeInteger(fixtureCount) && fixtureCount >= 9 && fixtureCount <= 16;

  if (!source || source.version !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_REPORT_VERSION ||
      source.fixtureCorpusVersion !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION ||
      source.statusId !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_STATUS_IDS.PASSED ||
      source.authority?.scope !== 'offline_synthetic_route_safety_comparison_only' ||
      source.authority?.operatorWorkflowAdmission !== false ||
      source.authority?.automaticActions?.aiInvocation !== false ||
      source.authority?.automaticActions?.learning !== false ||
      source.authority?.automaticActions?.policyChange !== false ||
      source.authority?.automaticActions?.retry !== false ||
      source.authority?.automaticActions?.routing !== false ||
      !validation || validation.ok !== true || validation.fixtureCount !== fixtureCount ||
      validation.issueCount !== 0 || !Array.isArray(validation.riskIds) || validation.riskIds.length !== 0 ||
      !validFixtureCount || matchedExpectationCount !== fixtureCount || mismatchCount !== 0) {
    return null;
  }

  return Object.freeze({ fixtureCount });
}

function buildReadModel({ statusId, packet = null } = {}) {
  return Object.freeze({
    statusId,
    packetAvailable: packet !== null,
    packet,
    humanApprovalRequired: true,
    approvalRecorded: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    bandEvidenceRequired: true,
    routeSafetyEvidenceRequired: true,
    routingChanged: false,
  });
}

/**
 * Builds a versioned, content-free human approval packet only from a passing
 * synthetic evaluation. This is a format read model, not approval storage: it
 * has no actor, action, signature, policy value, threshold, or write path.
 */
export function buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationApprovalPacketReadModel({
  evaluation = null,
  bandEvaluation = null,
  routeSafetyEvaluation = null,
} = {}) {
  const normalizedEvaluation = normalizeSuccessfulEvaluation(evaluation);
  const normalizedBandEvaluation = normalizeSuccessfulBandEvaluation(bandEvaluation);
  const normalizedRouteSafetyEvaluation = normalizeSuccessfulRouteSafetyEvaluation(routeSafetyEvaluation);
  if (!normalizedEvaluation || !normalizedBandEvaluation || !normalizedRouteSafetyEvaluation) {
    return buildReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_APPROVAL_PACKET_STATUS_IDS.OFFLINE_EVALUATION_NOT_READY,
    });
  }

  return buildReadModel({
    statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_APPROVAL_PACKET_STATUS_IDS.HUMAN_APPROVAL_REQUIRED,
    packet: Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROPOSAL_PACKET_VERSION,
      protocolId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_ID,
      fixtureCorpusVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION,
      evaluationReportVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_OFFLINE_EVALUATION_REPORT_VERSION,
      fixtureCount: normalizedEvaluation.fixtureCount,
      bandFixtureCorpusVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_CORPUS_VERSION,
      bandEvaluationReportVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_OFFLINE_EVALUATION_REPORT_VERSION,
      bandFixtureCount: normalizedBandEvaluation.fixtureCount,
      routeSafetyFixtureCorpusVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION,
      routeSafetyEvaluationReportVersion: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_OFFLINE_EVALUATION_REPORT_VERSION,
      routeSafetyFixtureCount: normalizedRouteSafetyEvaluation.fixtureCount,
      procedureIds: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_PROCEDURE_IDS,
      humanApprovalRequired: true,
      approvalRecorded: false,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      bandEvidenceRequired: true,
      routeSafetyEvidenceRequired: true,
      routingChanged: false,
    }),
  });
}
