/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ValidationError } from '../utils/appError.mjs';
import { buildPolicyIntentReplayParityDelta } from './policyIntentReplayParityDelta.mjs';

export const POLICY_BUILDER_PHASE8_REPLAY_MIGRATION_VERIFIER_SCHEMA_VERSION = 1;
export const POLICY_BUILDER_PHASE8_REPLAY_MIGRATION_VERIFIER_DEFAULT_LIMIT = 10;
export const POLICY_BUILDER_PHASE8_REPLAY_MIGRATION_VERIFIER_MAX_LIMIT = 25;

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

export function normalizePolicyBuilderPhase8ReplayMigrationLimit(value) {
  if (value === null || value === undefined || value === '') {
    return POLICY_BUILDER_PHASE8_REPLAY_MIGRATION_VERIFIER_DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return POLICY_BUILDER_PHASE8_REPLAY_MIGRATION_VERIFIER_DEFAULT_LIMIT;
  }

  return Math.min(
    POLICY_BUILDER_PHASE8_REPLAY_MIGRATION_VERIFIER_MAX_LIMIT,
    Math.max(1, parsed)
  );
}

export function buildPolicyBuilderPhase8ReplayMigrationSampleQuery({
  libraryId,
  mediaType = null,
  limit,
}) {
  const parsedLibraryId = Number.parseInt(libraryId, 10);
  if (!Number.isInteger(parsedLibraryId) || parsedLibraryId <= 0) {
    throw new ValidationError('A valid library_id is required for replay migration verification');
  }

  const normalizedLimit = normalizePolicyBuilderPhase8ReplayMigrationLimit(limit);
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
        tmdb_id,
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

export function sanitizePolicyBuilderPhase8ReplayMigrationSample(row = {}, index = 0) {
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

export function buildPolicyBuilderPhase8ReplayMigrationVerifier({
  impactPreview,
  samples = [],
  scoring = null,
  sampleDiagnostics = null,
  evidenceCompleteness = null,
  enrichmentEligibility = null,
  providerReadiness = null,
  enrichmentAdapterContract = null,
  tmdbMetadataAdapterPreview = null,
  tmdbMetadataCoverageComparison = null,
  requestedLimit = POLICY_BUILDER_PHASE8_REPLAY_MIGRATION_VERIFIER_DEFAULT_LIMIT,
} = {}) {
  const normalizedLimit = normalizePolicyBuilderPhase8ReplayMigrationLimit(requestedLimit);
  const sanitizedSamples = samples.map((sample, index) => (
    sanitizePolicyBuilderPhase8ReplayMigrationSample(sample, index)
  ));
  const comparison = impactPreview?.comparison ?? {};
  const parityDelta = buildPolicyIntentReplayParityDelta({
    samples: sanitizedSamples,
    scoring,
  });

  return {
    schema_version: POLICY_BUILDER_PHASE8_REPLAY_MIGRATION_VERIFIER_SCHEMA_VERSION,
    mode: 'read_only_replay_migration_verifier',
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
      diagnostics: sampleDiagnostics ?? {
        schema_version: 1,
        mode: 'representative_sample_selection_diagnostics',
        enabled: false,
        requested_limit: normalizedLimit,
        returned_count: sanitizedSamples.length,
        media_type_filter: null,
        total_history_count: 0,
        eligible_history_count: 0,
        final_success_count: 0,
        review_or_pending_count: 0,
        media_type_filtered_out_count: 0,
        sparse_evidence_count: 0,
        selection_status: sanitizedSamples.length > 0 ? 'selected' : 'no_samples_returned',
        reason_codes: [],
      },
      evidence_completeness: evidenceCompleteness ?? {
        schema_version: 1,
        mode: 'representative_replay_evidence_completeness',
        enabled: false,
        sample_count: sanitizedSamples.length,
        strong_count: 0,
        partial_count: 0,
        sparse_count: 0,
        items: [],
      },
      enrichment_eligibility: enrichmentEligibility ?? {
        schema_version: 1,
        mode: 'representative_replay_enrichment_eligibility',
        enabled: false,
        provider_calls_enabled: false,
        ai_calls_enabled: false,
        persistence_enabled: false,
        arr_writes_enabled: false,
        sample_count: sanitizedSamples.length,
        eligible_count: 0,
        not_needed_count: 0,
        insufficient_identity_count: 0,
        no_safe_source_count: 0,
        items: [],
      },
      provider_readiness: providerReadiness ?? {
        schema_version: 1,
        mode: 'representative_replay_provider_readiness',
        enabled: false,
        live_provider_calls_enabled: false,
        ai_calls_enabled: false,
        persistence_enabled: false,
        arr_writes_enabled: false,
        source_count: 0,
        ready_source_count: 0,
        unavailable_source_count: 0,
        demanded_source_count: 0,
        readiness: 'not_needed',
        sources: [],
      },
      enrichment_adapter_contract: enrichmentAdapterContract ?? {
        schema_version: 1,
        mode: 'replay_enrichment_adapter_contract',
        enabled: false,
        live_provider_calls_enabled: false,
        ai_calls_enabled: false,
        persistence_enabled: false,
        arr_writes_enabled: false,
        adapter_count: 0,
        enabled_adapter_count: 0,
        ready_adapter_count: 0,
        blocked_adapter_count: 0,
        unavailable_adapter_count: 0,
        demanded_adapter_count: 0,
        readiness: 'not_needed',
        sources: [],
      },
      tmdb_metadata_adapter_preview: tmdbMetadataAdapterPreview ?? {
        schema_version: 1,
        mode: 'replay_tmdb_metadata_adapter_preview',
        source: 'tmdb_metadata',
        enabled: false,
        status: 'blocked',
        provider_payload_exposed: false,
        live_provider_calls_enabled: false,
        ai_calls_enabled: false,
        persistence_enabled: false,
        arr_writes_enabled: false,
        cache_mutation_enabled: false,
        execution_switch: {
          schema_version: 1,
          mode: 'replay_tmdb_metadata_execution_switch',
          source: 'tmdb_metadata',
          enabled: false,
          status: 'blocked',
          requested: false,
          server_enabled: false,
          provider_ready: false,
          quota_safe: false,
          cooldown_active: false,
          selected_provider_key: null,
          reason_codes: [],
        },
        requested_field_count: 8,
        eligible_sample_count: 0,
        preview_limit: 0,
        previewed_count: 0,
        improved_sample_count: 0,
        improved_field_count: 0,
        items: [],
        reason_codes: [],
      },
      tmdb_metadata_coverage_comparison: tmdbMetadataCoverageComparison ?? {
        schema_version: 1,
        mode: 'replay_tmdb_metadata_coverage_comparison',
        enabled: false,
        status: 'not_needed',
        sample_count: 0,
        comparable_count: 0,
        improved_sample_count: 0,
        upgraded_completeness_count: 0,
        added_field_count: 0,
        remaining_missing_field_count: 0,
        before_strong_count: 0,
        after_strong_count: 0,
        reason_codes: [],
        items: [],
      },
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
