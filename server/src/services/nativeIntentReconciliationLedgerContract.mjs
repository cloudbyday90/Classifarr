/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash, randomUUID } from 'node:crypto';

const NATIVE_INTENT_RECONCILIATION_LEDGER_VERSION = 'native_intent_reconciliation.ledger.v1';
const NATIVE_INTENT_RECONCILIATION_OUTCOME_RETENTION_DAYS = 30;
const NATIVE_INTENT_RECONCILIATION_RUN_RETENTION_DAYS = 90;
const DEFAULT_NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION_BATCH_SIZE = 100;
const MAX_NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION_BATCH_SIZE = 500;

const NATIVE_INTENT_RECONCILIATION_RUN_STATES = Object.freeze({
  APPLIED: 'applied',
  EVALUATED: 'evaluated',
  DEFERRED: 'deferred',
  FAILED: 'failed',
});

const NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES = Object.freeze({
  APPLIED: 'applied',
  ALREADY_NATIVE: 'already_native',
  DEFERRED_RETRY: 'deferred_retry',
  BLOCKED_CURRENT_STATE: 'blocked_current_state',
  SYSTEM_FAILURE: 'system_failure',
});

const NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS = Object.freeze({
  CONVERSION_APPLIED: 'conversion_applied',
  ALREADY_NATIVE: 'already_native',
  NO_CANDIDATES: 'no_candidates',
  CANDIDATE_NOT_APPLIED: 'candidate_not_applied',
  EXECUTION_BUDGET_EXHAUSTED: 'execution_budget_exhausted',
  APPLY_FAILED_ROLLED_BACK: 'apply_failed_rolled_back',
  BLOCKED_CURRENT_STATE: 'blocked_current_state',
  SYSTEM_FAILURE: 'system_failure',
});

const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_:-]{0,79}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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
  const normalized = typeof value === 'string' ? value.trim() : '';
  return SAFE_ID_PATTERN.test(normalized) ? normalized : fallback;
}

function normalizeTimestamp(value, fallback = new Date()) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? new Date(fallback).toISOString() : timestamp.toISOString();
}

function normalizeFinishedAt(value, startedAt) {
  const normalizedStartedAt = normalizeTimestamp(startedAt);
  const normalizedFinishedAt = normalizeTimestamp(value, normalizedStartedAt);

  return new Date(normalizedFinishedAt).getTime() < new Date(normalizedStartedAt).getTime()
    ? normalizedStartedAt
    : normalizedFinishedAt;
}

function normalizeReasonIds(value) {
  return [...new Set(asArray(value)
    .map(entry => normalizeSafeId(entry, null))
    .filter(Boolean))]
    .sort();
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((normalized, key) => {
        normalized[key] = canonicalizeJson(value[key]);
        return normalized;
      }, {});
  }

  return value;
}

function normalizeFingerprintInput(candidate = {}) {
  const intentContract = asObject(candidate.intentContract);
  const authorityEligibility = asObject(candidate.authorityEligibility);

  return {
    version: NATIVE_INTENT_RECONCILIATION_LEDGER_VERSION,
    policyId: normalizePositiveInteger(candidate.policyId),
    candidateStatusId: normalizeSafeId(candidate.statusId, 'unknown_candidate_state'),
    canConvert: candidate.canConvert === true,
    reasonIds: normalizeReasonIds(candidate.reasonIds),
    intentContract: {
      schemaVersion: normalizePositiveInteger(intentContract.schemaVersion),
      source: normalizeSafeId(intentContract.source, 'unknown'),
      inferenceState: normalizeSafeId(intentContract.inferenceState, 'unknown'),
      valid: intentContract.valid === true,
      errorCount: normalizeNonNegativeInteger(intentContract.errorCount),
      warningCount: normalizeNonNegativeInteger(intentContract.warningCount),
      unsupportedSignalCount: normalizeNonNegativeInteger(intentContract.unsupportedSignalCount),
    },
    authorityEligibility: {
      stateId: normalizeSafeId(authorityEligibility.stateId, 'not_applicable'),
      integrityStatusId: normalizeSafeId(authorityEligibility.integrityStatusId, 'not_applicable'),
      activeIntentCount: normalizeNonNegativeInteger(authorityEligibility.activeIntentCount),
    },
  };
}

function buildNativeIntentReconciliationCandidateFingerprint(candidate = {}) {
  const serialized = JSON.stringify(canonicalizeJson(normalizeFingerprintInput(candidate)));
  return `sha256:${createHash('sha256').update(serialized, 'utf8').digest('hex')}`;
}

function normalizeLedgerCandidate(candidate = {}) {
  const policyId = normalizePositiveInteger(candidate.policyId);
  if (!policyId) return null;

  const reasonIds = normalizeReasonIds(candidate.reasonIds);
  const statusId = normalizeSafeId(candidate.statusId, 'unknown_candidate_state');

  return {
    policyId,
    statusId,
    canConvert: candidate.canConvert === true,
    reasonIds,
    intentContract: asObject(candidate.intentContract),
    authorityEligibility: asObject(candidate.authorityEligibility),
    candidateFingerprint: buildNativeIntentReconciliationCandidateFingerprint({
      ...candidate,
      policyId,
      statusId,
      reasonIds,
    }),
  };
}

function buildFallbackCandidates(applyGate = {}) {
  return asArray(applyGate.readyPolicyIds).map(policyId => ({
    policyId,
    statusId: 'ready_to_convert',
    canConvert: true,
    reasonIds: ['ready_to_convert'],
  }));
}

function normalizeLedgerCandidates(applyGate = {}) {
  const sourceCandidates = asArray(applyGate.reconciliationCandidates);
  const candidates = sourceCandidates.length > 0 ? sourceCandidates : buildFallbackCandidates(applyGate);
  const byPolicyId = new Map();

  candidates.forEach(candidate => {
    const normalized = normalizeLedgerCandidate(candidate);
    if (normalized) {
      byPolicyId.set(normalized.policyId, normalized);
    }
  });

  return [...byPolicyId.values()].sort((left, right) => left.policyId - right.policyId);
}

function buildAppliedResultMap(applyGate = {}) {
  const resultsByPolicyId = new Map();
  asArray(applyGate.results).forEach(result => {
    const policyId = normalizePositiveInteger(result?.policyId);
    if (policyId) {
      resultsByPolicyId.set(policyId, { alreadyConverted: result?.alreadyConverted === true });
    }
  });
  return resultsByPolicyId;
}

function determineRunState(sourceStatusId) {
  if (sourceStatusId === 'applied') {
    return NATIVE_INTENT_RECONCILIATION_RUN_STATES.APPLIED;
  }
  if (sourceStatusId === 'deferred_by_execution_budget') {
    return NATIVE_INTENT_RECONCILIATION_RUN_STATES.DEFERRED;
  }
  if (sourceStatusId === 'failed_rolled_back') {
    return NATIVE_INTENT_RECONCILIATION_RUN_STATES.FAILED;
  }
  return NATIVE_INTENT_RECONCILIATION_RUN_STATES.EVALUATED;
}

function primaryReasonId(candidate, fallback) {
  return candidate.reasonIds[0] || fallback;
}

function primaryOperatorErrorId(applyGate = {}, fallback) {
  return normalizeReasonIds(applyGate.operatorErrorIds)[0] || fallback;
}

function buildOutcome({ candidate, sourceStatusId, runReasonId, appliedResults }) {
  const appliedResult = appliedResults.get(candidate.policyId);
  let outcomeState = NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.BLOCKED_CURRENT_STATE;
  let reasonId = primaryReasonId(candidate, runReasonId);

  if (appliedResult) {
    outcomeState = appliedResult.alreadyConverted
      ? NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.ALREADY_NATIVE
      : NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.APPLIED;
    reasonId = appliedResult.alreadyConverted
      ? NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.ALREADY_NATIVE
      : NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.CONVERSION_APPLIED;
  } else if (candidate.canConvert === true && sourceStatusId === 'applied') {
    outcomeState = NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.DEFERRED_RETRY;
    reasonId = NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.CANDIDATE_NOT_APPLIED;
  } else if (candidate.canConvert === true && sourceStatusId === 'deferred_by_execution_budget') {
    outcomeState = NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.DEFERRED_RETRY;
    reasonId = NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.EXECUTION_BUDGET_EXHAUSTED;
  } else if (candidate.canConvert === true && sourceStatusId === 'failed_rolled_back') {
    outcomeState = NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.SYSTEM_FAILURE;
    reasonId = NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.APPLY_FAILED_ROLLED_BACK;
  } else if (candidate.canConvert === true && sourceStatusId === 'failed') {
    outcomeState = NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.SYSTEM_FAILURE;
    reasonId = NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.SYSTEM_FAILURE;
  }

  return {
    policyId: candidate.policyId,
    candidateFingerprint: candidate.candidateFingerprint,
    candidateStatusId: candidate.statusId,
    outcomeState,
    reasonId: normalizeSafeId(reasonId, NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.BLOCKED_CURRENT_STATE),
    retryNotBefore: null,
  };
}

function countOutcomes(outcomes = []) {
  return asArray(outcomes).reduce((counts, outcome) => {
    switch (outcome.outcomeState) {
      case NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.APPLIED:
        counts.convertedCount += 1;
        break;
      case NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.ALREADY_NATIVE:
        counts.alreadyNativeCount += 1;
        break;
      case NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.DEFERRED_RETRY:
        counts.deferredCount += 1;
        break;
      case NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES.SYSTEM_FAILURE:
        counts.failedCount += 1;
        break;
      default:
        counts.blockedCount += 1;
        break;
    }
    return counts;
  }, {
    convertedCount: 0,
    alreadyNativeCount: 0,
    deferredCount: 0,
    blockedCount: 0,
    failedCount: 0,
  });
}

function resolveRunReasonId({ sourceStatusId, applyGate, candidateCount }) {
  if (candidateCount === 0 && sourceStatusId !== 'failed_rolled_back') {
    return NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.NO_CANDIDATES;
  }
  if (sourceStatusId === 'applied') {
    return NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.CONVERSION_APPLIED;
  }
  if (sourceStatusId === 'deferred_by_execution_budget') {
    return NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.EXECUTION_BUDGET_EXHAUSTED;
  }
  if (sourceStatusId === 'failed_rolled_back') {
    return NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.APPLY_FAILED_ROLLED_BACK;
  }
  return primaryOperatorErrorId(
    applyGate,
    NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS.BLOCKED_CURRENT_STATE,
  );
}

function buildNativeIntentReconciliationLedgerRecord({
  applyGate = {},
  startedAt = new Date(),
  finishedAt = new Date(),
  runKey = randomUUID(),
} = {}) {
  const normalizedStartedAt = normalizeTimestamp(startedAt);
  const normalizedFinishedAt = normalizeFinishedAt(finishedAt, normalizedStartedAt);
  const sourceStatusId = normalizeSafeId(applyGate.statusId, 'unknown');
  const candidates = normalizeLedgerCandidates(applyGate);
  const appliedResults = buildAppliedResultMap(applyGate);
  const runReasonId = resolveRunReasonId({
    sourceStatusId,
    applyGate,
    candidateCount: candidates.length,
  });
  const outcomes = candidates.map(candidate => buildOutcome({
    candidate,
    sourceStatusId,
    runReasonId,
    appliedResults,
  }));
  const outcomeCounts = countOutcomes(outcomes);

  return {
    run: {
      runKey,
      reconcilerVersion: NATIVE_INTENT_RECONCILIATION_LEDGER_VERSION,
      runState: determineRunState(sourceStatusId),
      sourceStatusId,
      reasonId: runReasonId,
      startedAt: normalizedStartedAt,
      finishedAt: normalizedFinishedAt,
      candidateCount: outcomes.length,
      ...outcomeCounts,
    },
    outcomes,
  };
}

function normalizeRetentionBatchSize(value) {
  const numeric = Number(value);
  const normalized = Number.isInteger(numeric) && numeric > 0
    ? numeric
    : DEFAULT_NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION_BATCH_SIZE;

  return Math.min(
    MAX_NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION_BATCH_SIZE,
    Math.max(1, normalized),
  );
}

export {
  DEFAULT_NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION_BATCH_SIZE,
  MAX_NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION_BATCH_SIZE,
  NATIVE_INTENT_RECONCILIATION_LEDGER_REASON_IDS,
  NATIVE_INTENT_RECONCILIATION_LEDGER_VERSION,
  NATIVE_INTENT_RECONCILIATION_OUTCOME_RETENTION_DAYS,
  NATIVE_INTENT_RECONCILIATION_OUTCOME_STATES,
  NATIVE_INTENT_RECONCILIATION_RUN_RETENTION_DAYS,
  NATIVE_INTENT_RECONCILIATION_RUN_STATES,
  buildNativeIntentReconciliationCandidateFingerprint,
  buildNativeIntentReconciliationLedgerRecord,
  normalizeRetentionBatchSize,
  normalizeTimestamp,
};
