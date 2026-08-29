/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const OLLAMA_VERIFICATION_RUNTIME_MISMATCH_SUMMARY_VERSION =
  'ollama.verification_runtime_mismatch_summary.v1';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/;

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim();
  if (!NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)) return '0';

  return normalized.replace(/^0+(?=\d)/, '');
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

/**
 * Reduces aggregate persistence to the only two operator-visible facts. This
 * intentionally drops database dimensions such as model, provider host, and
 * raw failure information.
 */
export function buildOllamaVerificationRuntimeMismatchSummary(row = {}) {
  return Object.freeze({
    version: OLLAMA_VERIFICATION_RUNTIME_MISMATCH_SUMMARY_VERSION,
    modelDigestMismatchCount: normalizeNonNegativeDecimal(
      row?.model_digest_mismatch_count ?? row?.modelDigestMismatchCount,
    ),
    lastObservedAt: normalizeTimestamp(
      row?.last_model_digest_mismatch_at ?? row?.lastObservedAt,
    ),
  });
}
