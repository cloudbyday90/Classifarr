/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ValidationError } from '../utils/appError.mjs';
import { buildPolicyIntentReplayParityDelta } from './policyIntentReplayParityDelta.mjs';

export const POLICY_INTENT_REPLAY_PREVIEW_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_PREVIEW_DEFAULT_LIMIT = 10;
export const POLICY_INTENT_REPLAY_PREVIEW_MAX_LIMIT = 25;

const FINAL_SUCCESS_STATUSES = new Set(['completed', 'routed', 'verified', 'reclassified']);
const ALLOWED_MEDIA_TYPES = new Set(['movie', 'tv']);

function boundedString(value, maxLength = 160, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerOrNull(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function toIsoStringOrNull(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMediaType(value) {
  const normalized = boundedString(value, 20, null);
  return ALLOWED_MEDIA_TYPES.has(normalized) ? normalized : null;
}

export function normalizePolicyIntentReplayLimit(value) {
  if (value === null || value === undefined || value === '') {
    return POLICY_INTENT_REPLAY_PREVIEW_DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return POLICY_INTENT_REPLAY_PREVIEW_DEFAULT_LIMIT;
  }

  return Math.min(
    POLICY_INTENT_REPLAY_PREVIEW_MAX_LIMIT,
    Math.max(1, parsed)
  );
}

export function buildPolicyIntentReplaySampleQuery({ libraryId, mediaType = null, limit }) {
  const parsedLibraryId = Number.parseInt(libraryId, 10);
  if (!Number.isInteger(parsedLibraryId) || parsedLibraryId <= 0) {
    throw new ValidationError('A valid library_id is required for replay preview');
  }

  const normalizedLimit = normalizePolicyIntentReplayLimit(limit);
  const normalizedMediaType = normalizeMediaType(mediaType);
  const values = [parsedLibraryId];
  const predicates = ['library_id = $1'];

  if (normalizedMediaType) {
    values.push(normalizedMediaType);
    predicates.push(`media_type = $${values.length}`);
  }

  values.push(normalizedLimit);
  const limitParameter = `$${values.length}`;

  return {
    text: `
      SELECT
        title,
        year,
        media_type,
        library_name,
        confidence,
        method,
        status,
        metadata,
        genre_names,
        primary_studio_name,
        created_at
      FROM classification_history
      WHERE ${predicates.join(' AND ')}
      ORDER BY
        CASE
          WHEN status IN ('completed', 'routed', 'verified', 'reclassified') THEN 0
          ELSE 1
        END,
        created_at DESC,
        id DESC
      LIMIT ${limitParameter}
    `,
    values,
  };
}

export function sanitizePolicyIntentReplaySample(row = {}, index = 0) {
  const status = boundedString(row.status, 32, 'unknown');

  return {
    sample_id: index + 1,
    title: boundedString(row.title, 160, 'Unknown title'),
    year: integerOrNull(row.year),
    media_type: normalizeMediaType(row.media_type),
    library_name: boundedString(row.library_name, 160, null),
    current_confidence: numberOrNull(row.confidence),
    current_method: boundedString(row.method, 64, 'unknown'),
    current_status: status,
    current_outcome: FINAL_SUCCESS_STATUSES.has(status) ? 'final_success' : 'review_or_pending',
    created_at: toIsoStringOrNull(row.created_at),
  };
}

export function buildPolicyIntentReplayPreview({
  impactPreview,
  samples = [],
  scoring = null,
  requestedLimit = POLICY_INTENT_REPLAY_PREVIEW_DEFAULT_LIMIT,
} = {}) {
  const normalizedLimit = normalizePolicyIntentReplayLimit(requestedLimit);
  const sanitizedSamples = samples.map((sample, index) => sanitizePolicyIntentReplaySample(sample, index));
  const comparison = impactPreview?.comparison ?? {};
  const parityDelta = buildPolicyIntentReplayParityDelta({
    samples: sanitizedSamples,
    scoring,
  });

  return {
    schema_version: POLICY_INTENT_REPLAY_PREVIEW_SCHEMA_VERSION,
    mode: 'read_only_replay_preview',
    persistence_enabled: false,
    execution: {
      classification_run: false,
      ai_calls_enabled: false,
      provider_calls_enabled: false,
      arr_writes_enabled: false,
    },
    validation: impactPreview?.validation ?? {
      valid: true,
      errors: [],
    },
    impact_summary: {
      parity: comparison.parity ?? 'unknown',
      impact_level: comparison.impact_level ?? 'unknown',
      changed_bucket_count: Array.isArray(comparison.changed_buckets)
        ? comparison.changed_buckets.length
        : 0,
    },
    sample: {
      requested_limit: normalizedLimit,
      returned_count: sanitizedSamples.length,
      readiness: sanitizedSamples.length > 0 ? 'ready' : 'no_samples',
      items: sanitizedSamples,
    },
    dry_run_scoring: scoring ?? {
      schema_version: 1,
      mode: 'deterministic_signal_fit',
      enabled: false,
      full_classification_run: false,
      ai_calls_enabled: false,
      provider_calls_enabled: false,
      arr_writes_enabled: false,
      persistence_enabled: false,
      sample_count: 0,
      scored_count: 0,
      strong_fit_count: 0,
      review_count: 0,
      blocked_count: 0,
      insufficient_count: 0,
      policy_engine_comparison: {
        schema_version: 1,
        mode: 'deterministic_policy_engine_preview',
        enabled: false,
        compared_count: 0,
        strong_count: 0,
        review_count: 0,
        blocked_count: 0,
        insufficient_count: 0,
      },
      items: [],
    },
    parity_delta: parityDelta,
  };
}
