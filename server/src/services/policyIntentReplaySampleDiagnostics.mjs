/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ValidationError } from '../utils/appError.mjs';
import {
  normalizePolicyReplayPreviewMigrationLimit,
} from './policyReplayPreviewMigrationVerifier.mjs';

export const POLICY_INTENT_REPLAY_SAMPLE_DIAGNOSTICS_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_SAMPLE_DIAGNOSTICS_MODE = 'representative_sample_selection_diagnostics';

const ALLOWED_MEDIA_TYPES = new Set(['movie', 'tv']);

function boundedString(value, fallback = null, maxLength = 80) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function boundedCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function normalizeMediaType(value) {
  const normalized = boundedString(value, null, 20);
  return ALLOWED_MEDIA_TYPES.has(normalized) ? normalized : null;
}

function parseLibraryId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError('A valid library_id is required for replay diagnostics');
  }
  return parsed;
}

export function buildPolicyIntentReplaySampleDiagnosticsQuery({ libraryId, mediaType = null }) {
  const parsedLibraryId = parseLibraryId(libraryId);
  const normalizedMediaType = normalizeMediaType(mediaType);

  return {
    text: `
      WITH scoped AS (
        SELECT status, media_type, metadata, genre_names, primary_studio_name
        FROM classification_history
        WHERE library_id = $1
      ),
      eligible AS (
        SELECT *
        FROM scoped
        WHERE ($2::text IS NULL OR media_type::text = $2::text)
      )
      SELECT
        (SELECT COUNT(*) FROM scoped)::int AS total_history_count,
        (SELECT COUNT(*) FROM eligible)::int AS eligible_history_count,
        (SELECT COUNT(*) FROM eligible WHERE status IN ('completed', 'routed', 'verified', 'reclassified'))::int AS final_success_count,
        (SELECT COUNT(*) FROM eligible WHERE status IS NULL OR status NOT IN ('completed', 'routed', 'verified', 'reclassified'))::int AS review_or_pending_count,
        (SELECT COUNT(*) FROM scoped WHERE $2::text IS NOT NULL AND media_type::text IS DISTINCT FROM $2::text)::int AS media_type_filtered_out_count,
        (
          SELECT COUNT(*)
          FROM eligible
          WHERE (genre_names IS NULL OR cardinality(genre_names) = 0)
            AND primary_studio_name IS NULL
            AND metadata IS NULL
        )::int AS sparse_evidence_count
    `,
    values: [parsedLibraryId, normalizedMediaType],
  };
}

function determineStatus({
  totalHistoryCount,
  eligibleHistoryCount,
  returnedCount,
  mediaTypeFilteredOutCount,
}) {
  if (returnedCount > 0) {
    return 'selected';
  }

  if (totalHistoryCount === 0) {
    return 'no_history';
  }

  if (eligibleHistoryCount === 0 && mediaTypeFilteredOutCount > 0) {
    return 'media_type_filtered';
  }

  if (eligibleHistoryCount === 0) {
    return 'no_eligible_history';
  }

  return 'no_samples_returned';
}

function buildReasonCodes(summary) {
  const reasons = [`status:${summary.selection_status}`];

  if (summary.total_history_count === 0) {
    reasons.push('history:none');
  }
  if (summary.media_type_filtered_out_count > 0) {
    reasons.push('media_type:filtered');
  }
  if (summary.final_success_count > 0) {
    reasons.push('history:final_success_available');
  }
  if (summary.review_or_pending_count > 0) {
    reasons.push('history:review_or_pending_available');
  }
  if (summary.sparse_evidence_count > 0) {
    reasons.push('evidence:sparse_rows_available');
  }
  if (summary.returned_count < summary.requested_limit && summary.eligible_history_count > summary.returned_count) {
    reasons.push('limit:not_all_eligible_rows_returned');
  }

  return reasons.slice(0, 8);
}

export function buildPolicyIntentReplaySampleDiagnostics({
  row = {},
  requestedLimit,
  returnedCount = 0,
  mediaType = null,
} = {}) {
  const normalizedLimit = normalizePolicyReplayPreviewMigrationLimit(requestedLimit);
  const summary = {
    schema_version: POLICY_INTENT_REPLAY_SAMPLE_DIAGNOSTICS_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_SAMPLE_DIAGNOSTICS_MODE,
    enabled: true,
    requested_limit: normalizedLimit,
    returned_count: boundedCount(returnedCount),
    media_type_filter: normalizeMediaType(mediaType),
    total_history_count: boundedCount(row.total_history_count),
    eligible_history_count: boundedCount(row.eligible_history_count),
    final_success_count: boundedCount(row.final_success_count),
    review_or_pending_count: boundedCount(row.review_or_pending_count),
    media_type_filtered_out_count: boundedCount(row.media_type_filtered_out_count),
    sparse_evidence_count: boundedCount(row.sparse_evidence_count),
  };

  summary.selection_status = determineStatus({
    totalHistoryCount: summary.total_history_count,
    eligibleHistoryCount: summary.eligible_history_count,
    returnedCount: summary.returned_count,
    mediaTypeFilteredOutCount: summary.media_type_filtered_out_count,
  });
  summary.reason_codes = buildReasonCodes(summary);

  return summary;
}

export function buildEmptyPolicyIntentReplaySampleDiagnostics({ requestedLimit, mediaType = null } = {}) {
  return buildPolicyIntentReplaySampleDiagnostics({
    row: {},
    requestedLimit,
    returnedCount: 0,
    mediaType,
  });
}
