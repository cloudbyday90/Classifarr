/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS,
} from './ollamaVerificationCapabilityIdentity.mjs';

export const OLLAMA_VERIFICATION_CAPABILITY_OUTCOME_HISTORY_VERSION =
  'ollama.verification_capability_outcome_history.v1';
export const OLLAMA_VERIFICATION_CAPABILITY_OUTCOME_HISTORY_WINDOW_DAYS = 30;

const NON_NEGATIVE_BIGINT_PATTERN = /^\d{1,19}$/;

export const OLLAMA_VERIFICATION_CAPABILITY_OUTCOME_STATUS_IDS = Object.freeze([
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.VERIFICATION_READY,
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY,
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.UNAVAILABLE,
]);

const OUTCOME_STATUS_DETAILS = Object.freeze({
  [OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.VERIFICATION_READY]: Object.freeze({
    label: 'Strict verification ready',
  }),
  [OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY]: Object.freeze({
    label: 'Classification only',
  }),
  [OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.UNAVAILABLE]: Object.freeze({
    label: 'Provider unavailable',
  }),
});

const SIGNAL_DETAILS = Object.freeze({
  no_tests: Object.freeze({
    label: 'No recent tests',
    message: 'No saved Ollama verification tests were recorded in the last 30 days. Run Test Ollama Verification to establish a baseline.',
  }),
  consistently_ready: Object.freeze({
    label: 'Consistently ready',
    message: 'Every recorded test in this window was ready for strict verification. The current saved capability remains the routing authority.',
  }),
  intermittent: Object.freeze({
    label: 'Mixed test outcomes',
    message: 'Both ready and non-ready outcomes were recorded. Check local Ollama availability and model state, then run the saved test again; history is advisory.',
  }),
  classification_only: Object.freeze({
    label: 'Strict output remains unavailable',
    message: 'Recorded tests could support general classification but not strict candidate-bound verification. The current saved capability remains blocked until a successful test.',
  }),
  unavailable: Object.freeze({
    label: 'Provider availability needs attention',
    message: 'Recorded tests could not reach or use the saved Ollama configuration. Confirm the local service and run the saved test again.',
  }),
  mixed_nonready: Object.freeze({
    label: 'Non-ready outcomes vary',
    message: 'Recorded tests were not ready and included both structured-output and availability failures. Resolve the current saved test before relying on strict verification.',
  }),
});

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim();
  if (!NON_NEGATIVE_BIGINT_PATTERN.test(normalized)) return '0';

  return normalized.replace(/^0+(?=\d)/, '');
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function sumOutcomeCounts(outcomes) {
  return outcomes.reduce((total, outcome) => total + BigInt(outcome.count), 0n).toString();
}

function getSignalId(outcomes) {
  const countByStatusId = Object.fromEntries(outcomes.map(outcome => [outcome.statusId, outcome.count]));
  const verificationReadyCount = BigInt(countByStatusId.verification_ready || '0');
  const classificationOnlyCount = BigInt(countByStatusId.classification_only || '0');
  const unavailableCount = BigInt(countByStatusId.unavailable || '0');

  if (verificationReadyCount === 0n && classificationOnlyCount === 0n && unavailableCount === 0n) {
    return 'no_tests';
  }
  if (verificationReadyCount > 0n && classificationOnlyCount === 0n && unavailableCount === 0n) {
    return 'consistently_ready';
  }
  if (verificationReadyCount > 0n) return 'intermittent';
  if (classificationOnlyCount > 0n && unavailableCount > 0n) return 'mixed_nonready';
  return classificationOnlyCount > 0n ? 'classification_only' : 'unavailable';
}

/**
 * Accepts only the three bounded verdicts emitted by the fixed saved-Ollama
 * test. Configuration, endpoint, model, prompt, response, error, and media
 * details are intentionally excluded from the retained aggregate.
 */
export function isOllamaVerificationCapabilityOutcomeStatusId(value) {
  return OLLAMA_VERIFICATION_CAPABILITY_OUTCOME_STATUS_IDS.includes(value);
}

/**
 * Projects database aggregates into the complete allow-listed operator view.
 * Unknown rows and every unapproved database column are dropped.
 */
export function buildOllamaVerificationCapabilityOutcomeHistory(rows = []) {
  const rowsByStatusId = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (isOllamaVerificationCapabilityOutcomeStatusId(row?.status_id)) {
      rowsByStatusId.set(row.status_id, row);
    }
  }

  const outcomes = OLLAMA_VERIFICATION_CAPABILITY_OUTCOME_STATUS_IDS.map((statusId) => {
    const row = rowsByStatusId.get(statusId);
    return Object.freeze({
      statusId,
      label: OUTCOME_STATUS_DETAILS[statusId].label,
      count: normalizeNonNegativeDecimal(row?.outcome_count),
      lastObservedAt: normalizeTimestamp(row?.last_observed_at),
    });
  });
  const signalId = getSignalId(outcomes);

  return Object.freeze({
    version: OLLAMA_VERIFICATION_CAPABILITY_OUTCOME_HISTORY_VERSION,
    windowDays: OLLAMA_VERIFICATION_CAPABILITY_OUTCOME_HISTORY_WINDOW_DAYS,
    totalTests: sumOutcomeCounts(outcomes),
    signal: Object.freeze({ id: signalId, ...SIGNAL_DETAILS[signalId] }),
    outcomes: Object.freeze(outcomes),
  });
}
