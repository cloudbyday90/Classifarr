/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import {
  buildNativeIntentReconciliationCandidateFingerprint,
  NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES,
} from './nativeIntentReconciliationLedgerContract.mjs';

const NATIVE_INTENT_RECONCILIATION_STATE_VERSION =
  'native_intent_reconciliation.state.v1';
const NATIVE_INTENT_RECONCILIATION_RETRY_BASE_MS = 5 * 60 * 1000;
const NATIVE_INTENT_RECONCILIATION_RETRY_MAX_MS = 60 * 60 * 1000;
const NATIVE_INTENT_RECONCILIATION_MAX_RETRY_ATTEMPTS = 3;

const NATIVE_INTENT_RECONCILIATION_REASON_IDS = Object.freeze({
  ACTIVE_INTENT_AUTHORITY_CONFLICT: 'active_intent_authority_conflict',
  SERVER_CONTRACT_VALIDATION_FAILED: 'server_contract_validation_failed',
  UNSUPPORTED_LEGACY_SHAPE: 'unsupported_legacy_shape',
  PARTIAL_LEGACY_INFERENCE: 'partial_inference_requires_review',
  OPERATOR_REVIEW_REQUIRED: 'operator_review_required',
  CANDIDATE_NOT_READY: 'candidate_not_ready',
  REQUIRED_VERIFIER_FAILED: 'required_verifier_failed',
  POLICY_AUTHORITY_UNAVAILABLE: 'policy_authority_unavailable',
  CONTRACT_VALIDATION_FAILED: 'contract_validation_failed',
  POLICY_INPUT_MISSING: 'policy_input_missing',
  CONVERSION_ACTION_INVALID: 'conversion_action_invalid',
  EXECUTION_BUDGET_EXHAUSTED: 'execution_budget_exhausted',
  APPLY_FAILED_ROLLED_BACK: 'apply_failed_rolled_back',
  SELECTED_CANDIDATE_NOT_APPLIED: 'selected_candidate_not_applied',
  RETRY_BACKOFF_ACTIVE: 'retry_backoff_active',
  TECHNICAL_RETRY_LIMIT_REACHED: 'technical_retry_limit_reached',
});

const TERMINAL_OUTCOME_STATES = new Set([
  NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
  NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
]);

const RETRYABLE_OUTCOME_STATES = new Set([
  NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.DEFERRED_RETRY,
  NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.SYSTEM_FAILURE,
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function normalizeSafeId(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9][a-z0-9_:-]{0,79}$/u.test(normalized) ? normalized : fallback;
}

function normalizeTimestamp(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const normalized = Number.isNaN(date.getTime()) ? fallback : date;
  return normalized.toISOString();
}

function normalizeRetryTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCandidate(candidate = {}) {
  const policyId = normalizePositiveInteger(candidate.policyId);
  if (!policyId) return null;

  const statusId = normalizeSafeId(candidate.statusId, 'unknown_candidate_state');
  const reasonIds = [...new Set(asArray(candidate.reasonIds)
    .map(reasonId => normalizeSafeId(reasonId, null))
    .filter(Boolean))]
    .slice(0, 12);

  return {
    policyId,
    statusId,
    canConvert: candidate.canConvert === true,
    reasonIds,
    intentContract: candidate.intentContract && typeof candidate.intentContract === 'object'
      ? candidate.intentContract
      : {},
    authorityEligibility: candidate.authorityEligibility && typeof candidate.authorityEligibility === 'object'
      ? candidate.authorityEligibility
      : {},
    candidateFingerprint: buildNativeIntentReconciliationCandidateFingerprint({
      ...candidate,
      policyId,
      statusId,
      reasonIds,
    }),
  };
}

function normalizePersistedState(state = {}) {
  const source = state && typeof state === 'object' ? state : {};
  const policyId = normalizePositiveInteger(source.policyId ?? source.policy_id);
  if (!policyId) return null;

  const outcomeState = normalizeSafeId(source.outcomeState ?? source.outcome_state, null);
  if (!RETRYABLE_OUTCOME_STATES.has(outcomeState) && !TERMINAL_OUTCOME_STATES.has(outcomeState)) {
    return null;
  }

  const candidateFingerprint = typeof (source.candidateFingerprint ?? source.candidate_fingerprint) === 'string'
    ? (source.candidateFingerprint ?? source.candidate_fingerprint)
    : '';
  if (!/^sha256:[a-f0-9]{64}$/u.test(candidateFingerprint)) return null;

  return {
    policyId,
    candidateFingerprint,
    candidateStatusId: normalizeSafeId(
      source.candidateStatusId ?? source.candidate_status_id,
      'unknown_candidate_state',
    ),
    outcomeState,
    reasonId: normalizeSafeId(source.reasonId ?? source.reason_id, 'candidate_not_ready'),
    retryNotBefore: normalizeRetryTimestamp(source.retryNotBefore ?? source.retry_not_before),
    failureCount: normalizeNonNegativeInteger(source.failureCount ?? source.failure_count),
    evaluatedAt: normalizeRetryTimestamp(source.evaluatedAt ?? source.evaluated_at),
  };
}

function getCandidateReasonId(candidate, fallback) {
  return candidate.reasonIds[0] || fallback;
}

function classifyCandidateDisposition(candidate = {}) {
  const normalized = normalizeCandidate(candidate);
  if (!normalized) return null;

  if (normalized.canConvert && normalized.statusId === 'ready_to_convert') {
    return {
      candidate: normalized,
      eligibility: 'eligible',
      outcomeState: null,
      reasonId: null,
    };
  }

  switch (normalized.statusId) {
    case 'unsupported_legacy_shape':
      return {
        candidate: normalized,
        eligibility: 'requires_maintenance',
        outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
        reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.UNSUPPORTED_LEGACY_SHAPE,
      };
    case 'partial_legacy_inference':
      return {
        candidate: normalized,
        eligibility: 'requires_maintenance',
        outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
        reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.PARTIAL_LEGACY_INFERENCE,
      };
    case 'needs_operator_review':
      return {
        candidate: normalized,
        eligibility: 'requires_maintenance',
        outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
        reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.OPERATOR_REVIEW_REQUIRED,
      };
    case 'blocked_by_active_intent_authority':
      return {
        candidate: normalized,
        eligibility: 'blocked_current_state',
        outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
        reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT,
      };
    case 'blocked_by_server_contract_validation':
      return {
        candidate: normalized,
        eligibility: 'blocked_current_state',
        outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
        reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.SERVER_CONTRACT_VALIDATION_FAILED,
      };
    default:
      return {
        candidate: normalized,
        eligibility: 'blocked_current_state',
        outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
        reasonId: getCandidateReasonId(
          normalized,
          NATIVE_INTENT_RECONCILIATION_REASON_IDS.CANDIDATE_NOT_READY,
        ),
      };
  }
}

function isSameCandidateState(candidate, state) {
  return Boolean(
    state &&
    candidate.policyId === state.policyId &&
    candidate.candidateFingerprint === state.candidateFingerprint,
  );
}

function isRetryBackoffActive(state, evaluatedAt) {
  if (!state || !RETRYABLE_OUTCOME_STATES.has(state.outcomeState)) return false;
  if (!state.retryNotBefore) return false;
  return new Date(state.retryNotBefore).getTime() > new Date(evaluatedAt).getTime();
}

function buildStableJitterMs({ candidateFingerprint, failureCount, maximumDelayMs }) {
  const digest = createHash('sha256')
    .update(`${candidateFingerprint}:${failureCount}`, 'utf8')
    .digest();
  const ratio = digest.readUInt32BE(0) / 0xffffffff;
  return Math.floor(maximumDelayMs * (0.5 + (ratio * 0.5)));
}

function buildRetryDisposition({
  candidate,
  previousState = null,
  outcomeState = NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.SYSTEM_FAILURE,
  reasonId = NATIVE_INTENT_RECONCILIATION_REASON_IDS.APPLY_FAILED_ROLLED_BACK,
  evaluatedAt = new Date(),
  incrementFailureCount = true,
} = {}) {
  const normalizedCandidate = normalizeCandidate(candidate);
  if (!normalizedCandidate) return null;

  const normalizedPreviousState = normalizePersistedState(previousState);
  const previousFailureCount = isSameCandidateState(normalizedCandidate, normalizedPreviousState)
    ? normalizedPreviousState.failureCount
    : 0;
  const failureCount = incrementFailureCount ? previousFailureCount + 1 : previousFailureCount;
  const normalizedEvaluatedAt = normalizeTimestamp(evaluatedAt);

  if (
    incrementFailureCount &&
    failureCount >= NATIVE_INTENT_RECONCILIATION_MAX_RETRY_ATTEMPTS
  ) {
    return {
      policyId: normalizedCandidate.policyId,
      candidateFingerprint: normalizedCandidate.candidateFingerprint,
      candidateStatusId: normalizedCandidate.statusId,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.REQUIRES_MAINTENANCE,
      reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.TECHNICAL_RETRY_LIMIT_REACHED,
      retryNotBefore: null,
      failureCount,
      evaluatedAt: normalizedEvaluatedAt,
    };
  }

  const maximumDelayMs = Math.min(
    NATIVE_INTENT_RECONCILIATION_RETRY_MAX_MS,
    NATIVE_INTENT_RECONCILIATION_RETRY_BASE_MS * (2 ** (Math.max(failureCount, 1) - 1)),
  );
  const delayMs = buildStableJitterMs({
    candidateFingerprint: normalizedCandidate.candidateFingerprint,
    failureCount: Math.max(failureCount, 1),
    maximumDelayMs,
  });

  return {
    policyId: normalizedCandidate.policyId,
    candidateFingerprint: normalizedCandidate.candidateFingerprint,
    candidateStatusId: normalizedCandidate.statusId,
    outcomeState,
    reasonId: normalizeSafeId(reasonId, NATIVE_INTENT_RECONCILIATION_REASON_IDS.APPLY_FAILED_ROLLED_BACK),
    retryNotBefore: new Date(new Date(normalizedEvaluatedAt).getTime() + delayMs).toISOString(),
    failureCount,
    evaluatedAt: normalizedEvaluatedAt,
  };
}

function buildTerminalDisposition({ candidate, outcomeState, reasonId, evaluatedAt = new Date() } = {}) {
  const normalizedCandidate = normalizeCandidate(candidate);
  if (!normalizedCandidate || !TERMINAL_OUTCOME_STATES.has(outcomeState)) return null;

  return {
    policyId: normalizedCandidate.policyId,
    candidateFingerprint: normalizedCandidate.candidateFingerprint,
    candidateStatusId: normalizedCandidate.statusId,
    outcomeState,
    reasonId: normalizeSafeId(reasonId, NATIVE_INTENT_RECONCILIATION_REASON_IDS.CANDIDATE_NOT_READY),
    retryNotBefore: null,
    failureCount: 0,
    evaluatedAt: normalizeTimestamp(evaluatedAt),
  };
}

function statesEqual(left, right) {
  if (!left || !right) return false;

  return left.policyId === right.policyId &&
    left.candidateFingerprint === right.candidateFingerprint &&
    left.candidateStatusId === right.candidateStatusId &&
    left.outcomeState === right.outcomeState &&
    left.reasonId === right.reasonId &&
    left.retryNotBefore === right.retryNotBefore &&
    left.failureCount === right.failureCount;
}

function buildNativeIntentReconciliationCandidatePlan({
  candidates = [],
  persistedStates = [],
  maxPolicies = 10,
  evaluatedAt = new Date(),
} = {}) {
  const normalizedEvaluatedAt = normalizeTimestamp(evaluatedAt);
  const normalizedMaxPolicies = Math.max(1, Math.min(100, normalizePositiveInteger(maxPolicies) || 10));
  const stateByPolicyId = new Map(asArray(persistedStates)
    .map(normalizePersistedState)
    .filter(Boolean)
    .map(state => [state.policyId, state]));
  const selectedCandidates = [];
  const ledgerCandidates = [];
  const outcomeOverrides = [];
  const stateUpserts = [];
  const stateDeletes = [];
  const deferredPolicyIds = [];
  const quarantinedPolicyIds = [];

  asArray(candidates).forEach(sourceCandidate => {
    const disposition = classifyCandidateDisposition(sourceCandidate);
    if (!disposition) return;

    const { candidate } = disposition;
    const previousState = stateByPolicyId.get(candidate.policyId) || null;

    if (disposition.eligibility === 'eligible') {
      if (
        isSameCandidateState(candidate, previousState) &&
        TERMINAL_OUTCOME_STATES.has(previousState.outcomeState)
      ) {
        quarantinedPolicyIds.push(candidate.policyId);
        return;
      }

      if (isSameCandidateState(candidate, previousState) && isRetryBackoffActive(previousState, normalizedEvaluatedAt)) {
        deferredPolicyIds.push(candidate.policyId);
        return;
      }

      if (previousState && !isSameCandidateState(candidate, previousState)) {
        stateDeletes.push(candidate.policyId);
      }

      if (selectedCandidates.length < normalizedMaxPolicies) {
        selectedCandidates.push(candidate);
        ledgerCandidates.push(candidate);
      }
      return;
    }

    const desiredState = buildTerminalDisposition({
      candidate,
      outcomeState: disposition.outcomeState,
      reasonId: disposition.reasonId,
      evaluatedAt: normalizedEvaluatedAt,
    });
    if (!desiredState) return;

    if (!statesEqual(desiredState, previousState)) {
      stateUpserts.push(desiredState);
      ledgerCandidates.push(candidate);
      outcomeOverrides.push({
        policyId: desiredState.policyId,
        outcomeState: desiredState.outcomeState,
        reasonId: desiredState.reasonId,
        retryNotBefore: null,
      });
    }
  });

  return {
    version: NATIVE_INTENT_RECONCILIATION_STATE_VERSION,
    evaluatedAt: normalizedEvaluatedAt,
    selectedCandidates,
    selectedPolicyIds: selectedCandidates.map(candidate => candidate.policyId),
    ledgerCandidates,
    outcomeOverrides,
    stateUpserts,
    stateDeletes: [...new Set(stateDeletes)],
    deferredPolicyIds: [...new Set(deferredPolicyIds)],
    quarantinedPolicyIds: [...new Set(quarantinedPolicyIds)],
    counts: {
      selectedPolicyCount: selectedCandidates.length,
      deferredPolicyCount: deferredPolicyIds.length,
      quarantinedPolicyCount: quarantinedPolicyIds.length,
      stateUpsertCount: stateUpserts.length,
      stateDeleteCount: [...new Set(stateDeletes)].length,
    },
  };
}

function buildNativeIntentReconciliationStateOutcome({
  candidate,
  previousState = null,
  applyGate = {},
  conversionStep = null,
  evaluatedAt = new Date(),
} = {}) {
  const normalizedCandidate = normalizeCandidate(candidate);
  if (!normalizedCandidate) return null;

  const appliedResult = asArray(applyGate.results).find(result => (
    normalizePositiveInteger(result?.policyId) === normalizedCandidate.policyId
  ));
  if (appliedResult) {
    return {
      policyId: normalizedCandidate.policyId,
      candidateFingerprint: normalizedCandidate.candidateFingerprint,
      candidateStatusId: normalizedCandidate.statusId,
      outcomeState: appliedResult.alreadyConverted === true
        ? NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.ALREADY_NATIVE
        : NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.APPLIED,
      reasonId: appliedResult.alreadyConverted === true ? 'already_native' : 'conversion_applied',
      retryNotBefore: null,
      failureCount: 0,
      evaluatedAt: normalizeTimestamp(evaluatedAt),
      clearState: true,
    };
  }

  const stepStatusId = normalizeSafeId(conversionStep?.statusId, null);
  const stepReasonIds = asArray(conversionStep?.reasonIds)
    .map(reasonId => normalizeSafeId(reasonId, null))
    .filter(Boolean);
  if (stepStatusId === 'blocked_by_verifier') {
    return buildTerminalDisposition({
      candidate: normalizedCandidate,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
      reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.REQUIRED_VERIFIER_FAILED,
      evaluatedAt,
    });
  }

  if (stepStatusId && stepStatusId !== 'ready_to_apply') {
    return buildTerminalDisposition({
      candidate: normalizedCandidate,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
      reasonId: stepReasonIds[0] || NATIVE_INTENT_RECONCILIATION_REASON_IDS.CANDIDATE_NOT_READY,
      evaluatedAt,
    });
  }

  const operatorErrorIds = asArray(applyGate.operatorErrorIds)
    .map(reasonId => normalizeSafeId(reasonId, null))
    .filter(Boolean);
  const policyBlockerReasonId = operatorErrorIds.find(reasonId => [
    NATIVE_INTENT_RECONCILIATION_REASON_IDS.POLICY_AUTHORITY_UNAVAILABLE,
    NATIVE_INTENT_RECONCILIATION_REASON_IDS.CONTRACT_VALIDATION_FAILED,
    NATIVE_INTENT_RECONCILIATION_REASON_IDS.POLICY_INPUT_MISSING,
    NATIVE_INTENT_RECONCILIATION_REASON_IDS.CONVERSION_ACTION_INVALID,
  ].includes(reasonId));
  if (policyBlockerReasonId) {
    return buildTerminalDisposition({
      candidate: normalizedCandidate,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE,
      reasonId: policyBlockerReasonId,
      evaluatedAt,
    });
  }

  if (applyGate.statusId === 'deferred_by_execution_budget') {
    return buildRetryDisposition({
      candidate: normalizedCandidate,
      previousState,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.DEFERRED_RETRY,
      reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.EXECUTION_BUDGET_EXHAUSTED,
      evaluatedAt,
      incrementFailureCount: false,
    });
  }

  if (applyGate.statusId === 'applied') {
    return buildRetryDisposition({
      candidate: normalizedCandidate,
      previousState,
      outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.SYSTEM_FAILURE,
      reasonId: NATIVE_INTENT_RECONCILIATION_REASON_IDS.SELECTED_CANDIDATE_NOT_APPLIED,
      evaluatedAt,
    });
  }

  return buildRetryDisposition({
    candidate: normalizedCandidate,
    previousState,
    outcomeState: NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.SYSTEM_FAILURE,
    reasonId: normalizeSafeId(
      applyGate.failureCategory,
      NATIVE_INTENT_RECONCILIATION_REASON_IDS.APPLY_FAILED_ROLLED_BACK,
    ),
    evaluatedAt,
  });
}

export {
  NATIVE_INTENT_RECONCILIATION_MAX_RETRY_ATTEMPTS,
  NATIVE_INTENT_RECONCILIATION_REASON_IDS,
  NATIVE_INTENT_RECONCILIATION_RETRY_BASE_MS,
  NATIVE_INTENT_RECONCILIATION_RETRY_MAX_MS,
  NATIVE_INTENT_RECONCILIATION_STATE_VERSION,
  buildNativeIntentReconciliationCandidatePlan,
  buildNativeIntentReconciliationStateOutcome,
  classifyCandidateDisposition,
  normalizeCandidate,
  normalizePersistedState,
};
