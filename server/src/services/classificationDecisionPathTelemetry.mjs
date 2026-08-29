/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const CLASSIFICATION_DECISION_PATH_TELEMETRY_VERSION =
  'classification.decision_path_telemetry.v1';

export const CLASSIFICATION_DECISION_PATH_TELEMETRY_WINDOW_HOURS = 24;

function toNonNegativeSafeInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Constructs the fixed rolling observation window used by the queue read
 * model. There is deliberately no caller-selected dimension or time range.
 */
export function buildClassificationDecisionPathTelemetryWindow({
  now = new Date(),
  windowHours = CLASSIFICATION_DECISION_PATH_TELEMETRY_WINDOW_HOURS,
} = {}) {
  if (!validDate(now)) {
    throw new TypeError('A valid observation time is required.');
  }

  const hours = Number(windowHours);
  if (!Number.isSafeInteger(hours) || hours <= 0 || hours > 168) {
    throw new TypeError('A bounded observation window is required.');
  }

  const end = new Date(now);
  const start = new Date(end.getTime() - (hours * 60 * 60 * 1000));

  return Object.freeze({
    hours,
    start,
    end,
  });
}

/**
 * Converts one fixed aggregate row into an allow-listed public projection.
 * The public contract has no item, policy, library, provider, model, prompt,
 * response, error text, or decision identifiers.
 */
export function buildClassificationDecisionPathTelemetry({
  aggregate = {},
  window = {},
} = {}) {
  const hours = Number(window?.hours);
  if (!Number.isSafeInteger(hours) || hours <= 0 || hours > 168) {
    throw new TypeError('A bounded telemetry window is required.');
  }

  return Object.freeze({
    version: CLASSIFICATION_DECISION_PATH_TELEMETRY_VERSION,
    window: Object.freeze({ hours }),
    counts: Object.freeze({
      deterministicPolicy: toNonNegativeSafeInteger(aggregate?.deterministic_policy_count),
      aiClassificationAttempt: toNonNegativeSafeInteger(aggregate?.ai_classification_attempt_count),
      aiUnavailableRetry: toNonNegativeSafeInteger(aggregate?.ai_unavailable_retry_count),
      strictVerificationAbstention: toNonNegativeSafeInteger(aggregate?.strict_verification_abstention_count),
    }),
  });
}
