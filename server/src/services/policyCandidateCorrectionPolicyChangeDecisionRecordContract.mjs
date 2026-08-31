/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow,
} from './policyCandidateCorrectionPolicyChangeOutcomeObservationContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_VERSION =
  'policy.candidate_correction_policy_change_decision_record.v1';
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_CONTROL_KEY =
  'policy_change_decision_record';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_STATUS_IDS = Object.freeze({
  OUTCOME_NOT_READY: 'outcome_not_ready',
  REVIEW_READY: 'review_ready',
  DECISION_RECORDED: 'decision_recorded',
  EXPIRED: 'expired',
});

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS = Object.freeze([
  'retain_current_policy',
  'investigate_policy_evidence',
  'prepare_manual_policy_change',
]);

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RATIONALE_IDS = Object.freeze([
  'outcome_improved',
  'outcome_unchanged_or_inconclusive',
  'outcome_degraded',
  'requires_contextual_review',
]);

const HYPOTHESIS_ID_PATTERN = /^pco_[A-Za-z0-9_-]{32}$/u;

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function includesExact(values, value) {
  return typeof value === 'string' && values.includes(value);
}

/** Validates the only two non-concurrent decision input fields. */
export function normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordInput(value) {
  const source = asPlainObject(value);
  const decisionId = source?.decisionId ?? source?.decision_id;
  const rationaleId = source?.rationaleId ?? source?.rationale_id;
  if (!includesExact(POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS, decisionId) ||
      !includesExact(POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RATIONALE_IDS, rationaleId)) {
    return null;
  }
  return Object.freeze({ decisionId, rationaleId });
}

/** Validates the integer compare-and-swap token used only for revision. */
export function normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordExpectedRevision(value) {
  return normalizePositiveInteger(value);
}

/** Drops internal actor identity and unknown row fields before any read model is built. */
export function normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordRow(value) {
  const source = asPlainObject(value);
  const observationHypothesisId = source?.observation_hypothesis_id ?? source?.observationHypothesisId;
  const input = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordInput(source);
  const revision = normalizePositiveInteger(source?.revision);
  const createdAt = normalizeTimestamp(source?.created_at ?? source?.createdAt);
  const updatedAt = normalizeTimestamp(source?.updated_at ?? source?.updatedAt);
  const expiresAt = normalizeTimestamp(source?.expires_at ?? source?.expiresAt);

  if (!source || !HYPOTHESIS_ID_PATTERN.test(observationHypothesisId || '') || !input || !revision ||
      !createdAt || !updatedAt || !expiresAt || createdAt > updatedAt || updatedAt > expiresAt) {
    return null;
  }

  return Object.freeze({
    observationHypothesisId,
    ...input,
    revision,
    createdAt,
    updatedAt,
    expiresAt,
  });
}

function buildBaseReadModel({ statusId, reviewAvailable, observation = null, decision = null } = {}) {
  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_VERSION,
    statusId,
    reviewAvailable,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    observation,
    decision,
  });
}

/**
 * Builds the only browser-visible decision DTO from the existing bounded
 * observation and a matching bounded decision record. Neither input can
 * authorise a policy, AI/RAG, learning, retry, or routing change.
 */
export function buildPolicyCandidateCorrectionPolicyChangeDecisionRecordReadModel({
  observation = null,
  decisionRecord = null,
  now = new Date(),
} = {}) {
  const observedAt = normalizeTimestamp(now);
  if (!observedAt) throw new TypeError('A valid decision-record time is required.');

  const normalizedObservation = observation
    ? normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow(observation)
    : null;
  if (!normalizedObservation) {
    return buildBaseReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_STATUS_IDS.OUTCOME_NOT_READY,
      reviewAvailable: false,
    });
  }

  if (normalizedObservation.expiresAt <= observedAt) {
    return buildBaseReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_STATUS_IDS.EXPIRED,
      reviewAvailable: false,
    });
  }

  if (normalizedObservation.followupWindow.endAt > observedAt) {
    return buildBaseReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_STATUS_IDS.OUTCOME_NOT_READY,
      reviewAvailable: false,
    });
  }

  const reviewObservation = Object.freeze({
    hypothesisId: normalizedObservation.hypothesisId,
    outcomeAvailableAt: normalizedObservation.followupWindow.endAt,
    expiresAt: normalizedObservation.expiresAt,
  });
  const normalizedDecision = decisionRecord
    ? normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordRow(decisionRecord)
    : null;
  if (!normalizedDecision ||
      normalizedDecision.observationHypothesisId !== normalizedObservation.hypothesisId ||
      normalizedDecision.expiresAt !== normalizedObservation.expiresAt) {
    return buildBaseReadModel({
      statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_STATUS_IDS.REVIEW_READY,
      reviewAvailable: true,
      observation: reviewObservation,
    });
  }

  return buildBaseReadModel({
    statusId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_STATUS_IDS.DECISION_RECORDED,
    reviewAvailable: true,
    observation: reviewObservation,
    decision: Object.freeze({
      decisionId: normalizedDecision.decisionId,
      rationaleId: normalizedDecision.rationaleId,
      revision: normalizedDecision.revision,
      createdAt: normalizedDecision.createdAt,
      updatedAt: normalizedDecision.updatedAt,
      expiresAt: normalizedDecision.expiresAt,
    }),
  });
}
