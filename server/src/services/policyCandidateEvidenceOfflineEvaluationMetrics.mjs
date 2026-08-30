/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';

const VALID_DECISION_IDS = new Set(Object.values(POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS));

function percentage(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function normalizedDecision(value) {
  return VALID_DECISION_IDS.has(value) ? value : null;
}

/**
 * Calculates precision and recall for the safety-sensitive `review` action.
 * `admit` and `abstain` are both non-review references; abstentions still
 * count against recall when human review was expected and are reported
 * independently so coverage cannot be hidden by a high abstention rate.
 */
export function buildPolicyCandidateEvidenceOfflineSignalMetrics({
  signalId,
  rows = [],
} = {}) {
  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      referenceDecisionId: normalizedDecision(row?.referenceDecisionId),
      signalDecisionId: normalizedDecision(row?.signalDecisionId),
    }))
    .filter((row) => row.referenceDecisionId && row.signalDecisionId);

  const evaluatedFixtureCount = normalizedRows.length;
  const referenceReviewCount = normalizedRows.filter((row) => (
    row.referenceDecisionId === POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW
  )).length;
  const predictedReviewCount = normalizedRows.filter((row) => (
    row.signalDecisionId === POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW
  )).length;
  const truePositiveCount = normalizedRows.filter((row) => (
    row.referenceDecisionId === POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW &&
    row.signalDecisionId === POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW
  )).length;
  const falsePositiveCount = normalizedRows.filter((row) => (
    row.referenceDecisionId !== POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW &&
    row.signalDecisionId === POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW
  )).length;
  const falseNegativeCount = normalizedRows.filter((row) => (
    row.referenceDecisionId === POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW &&
    row.signalDecisionId !== POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW
  )).length;
  const trueNegativeCount = normalizedRows.filter((row) => (
    row.referenceDecisionId !== POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW &&
    row.signalDecisionId !== POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.REVIEW
  )).length;
  const abstentionCount = normalizedRows.filter((row) => (
    row.signalDecisionId === POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS.ABSTAIN
  )).length;
  const agreementCount = normalizedRows.filter((row) => (
    row.referenceDecisionId === row.signalDecisionId
  )).length;

  return Object.freeze({
    signalId: typeof signalId === 'string' ? signalId : null,
    evaluatedFixtureCount,
    referenceReviewCount,
    predictedReviewCount,
    truePositiveCount,
    falsePositiveCount,
    falseNegativeCount,
    trueNegativeCount,
    abstentionCount,
    agreementCount,
    precisionPercent: percentage(truePositiveCount, predictedReviewCount),
    recallPercent: percentage(truePositiveCount, referenceReviewCount),
    abstentionRatePercent: percentage(abstentionCount, evaluatedFixtureCount),
    coverageRatePercent: percentage(evaluatedFixtureCount - abstentionCount, evaluatedFixtureCount),
    decisionAgreementRatePercent: percentage(agreementCount, evaluatedFixtureCount),
  });
}
