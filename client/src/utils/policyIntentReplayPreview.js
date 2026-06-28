/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const ALLOWED_READINESS = new Set(['ready', 'no_samples'])
const ALLOWED_SAMPLE_SELECTION_STATUS = new Set([
  'selected',
  'no_history',
  'media_type_filtered',
  'no_eligible_history',
  'no_samples_returned',
])
const ALLOWED_EVIDENCE_COMPLETENESS = new Set(['strong', 'partial', 'sparse'])
const ALLOWED_EVIDENCE_FIELDS = new Set([
  'rating',
  'genres',
  'keywords',
  'studio',
  'language',
  'overview',
  'runtime',
  'vote_average',
])
const ALLOWED_ENRICHMENT_ELIGIBILITY_STATUS = new Set([
  'eligible',
  'not_needed',
  'insufficient_identity',
  'no_safe_source',
])
const ALLOWED_ENRICHMENT_SOURCES = new Set([
  'tmdb_metadata',
  'omdb_rating',
  'web_search_metadata',
])
const ALLOWED_PROVIDER_READINESS = new Set(['ready', 'partial', 'unavailable', 'not_needed'])
const ALLOWED_PROVIDER_READINESS_STATUS = new Set(['ready', 'unavailable'])
const ALLOWED_ENRICHMENT_ADAPTER_READINESS = new Set(['ready', 'partial', 'blocked', 'not_needed'])
const ALLOWED_ENRICHMENT_ADAPTER_STATUS = new Set(['ready', 'blocked', 'unavailable'])
const ALLOWED_TMDB_ADAPTER_STATUS = new Set([
  'blocked',
  'ready',
  'unavailable',
  'not_needed',
])
const ALLOWED_TMDB_EXECUTION_SWITCH_STATUS = new Set([
  'enabled',
  'blocked',
  'unavailable',
])
const ALLOWED_TMDB_ADAPTER_ITEM_STATUS = new Set([
  'ready',
  'unavailable',
  'insufficient_identity',
  'provider_error',
])
const ALLOWED_TMDB_COVERAGE_STATUS = new Set([
  'blocked',
  'unavailable',
  'not_needed',
  'improved',
  'unchanged',
])
const ALLOWED_TMDB_COVERAGE_ITEM_STATUS = new Set([
  'improved',
  'unchanged',
  'not_improved',
  'not_previewed',
])
const ALLOWED_COMPLETENESS_LEVELS = new Set(['strong', 'partial', 'sparse'])
const ALLOWED_OUTCOMES = new Set(['final_success', 'review_or_pending'])
const ALLOWED_MEDIA_TYPES = new Set(['movie', 'tv'])
const ALLOWED_PARITY = new Set(['matching', 'different', 'unavailable', 'unknown'])
const ALLOWED_IMPACT_LEVELS = new Set(['none', 'medium', 'high', 'unknown'])
const ALLOWED_SIGNAL_FITS = new Set(['strong', 'review', 'blocked', 'insufficient'])
const ALLOWED_DELTA_ACTIONS = new Set([
  'would_remain',
  'would_now_candidate',
  'would_now_review',
  'would_now_block',
  'insufficient_evidence',
])
const ALLOWED_DELTA_LEVELS = new Set(['low', 'medium', 'high', 'unknown'])
const ALLOWED_RECOMMENDATIONS = new Set([
  'would_remain_candidate',
  'would_need_review',
  'would_be_blocked',
  'insufficient_evidence',
])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function boundedNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback
}

function boundedString(value, fallback = 'unknown', maxLength = 120) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : fallback
}

function normalizeIsoString(value) {
  if (!value || typeof value !== 'string') {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeSampleItem(item) {
  const value = asObject(item)
  const mediaType = ALLOWED_MEDIA_TYPES.has(value.media_type) ? value.media_type : null
  const outcome = ALLOWED_OUTCOMES.has(value.current_outcome)
    ? value.current_outcome
    : 'review_or_pending'

  return {
    sample_id: boundedNumber(value.sample_id, 0),
    title: boundedString(value.title, 'Unknown title', 160),
    year: boundedNumber(value.year, null),
    media_type: mediaType,
    library_name: boundedString(value.library_name, null, 160),
    current_confidence: boundedNumber(value.current_confidence, null),
    current_method: boundedString(value.current_method, 'unknown', 64),
    current_status: boundedString(value.current_status, 'unknown', 64),
    current_outcome: outcome,
    created_at: normalizeIsoString(value.created_at),
  }
}

function normalizeSampleDiagnostics(diagnostics, fallback = {}) {
  const value = asObject(diagnostics)
  const status = ALLOWED_SAMPLE_SELECTION_STATUS.has(value.selection_status)
    ? value.selection_status
    : 'no_samples_returned'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'representative_sample_selection_diagnostics', 80),
    enabled: value.enabled === true,
    requested_limit: boundedNumber(value.requested_limit, fallback.requested_limit || 0),
    returned_count: boundedNumber(value.returned_count, fallback.returned_count || 0),
    media_type_filter: ALLOWED_MEDIA_TYPES.has(value.media_type_filter) ? value.media_type_filter : null,
    total_history_count: boundedNumber(value.total_history_count, 0),
    eligible_history_count: boundedNumber(value.eligible_history_count, 0),
    final_success_count: boundedNumber(value.final_success_count, 0),
    review_or_pending_count: boundedNumber(value.review_or_pending_count, 0),
    media_type_filtered_out_count: boundedNumber(value.media_type_filtered_out_count, 0),
    sparse_evidence_count: boundedNumber(value.sparse_evidence_count, 0),
    selection_status: status,
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeEvidenceFieldList(value) {
  return asArray(value)
    .filter(item => ALLOWED_EVIDENCE_FIELDS.has(item))
    .slice(0, 12)
}

function normalizeEvidenceCompletenessItem(item) {
  const value = asObject(item)
  const completeness = ALLOWED_EVIDENCE_COMPLETENESS.has(value.completeness)
    ? value.completeness
    : 'sparse'
  const counts = asObject(value.field_counts)

  return {
    sample_id: boundedNumber(value.sample_id, 0),
    completeness,
    available_fields: normalizeEvidenceFieldList(value.available_fields),
    missing_fields: normalizeEvidenceFieldList(value.missing_fields),
    field_counts: {
      genres: boundedNumber(counts.genres, 0),
      keywords: boundedNumber(counts.keywords, 0),
      studios: boundedNumber(counts.studios, 0),
    },
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeEvidenceCompleteness(completeness) {
  const value = asObject(completeness)

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'representative_replay_evidence_completeness', 80),
    enabled: value.enabled === true,
    sample_count: boundedNumber(value.sample_count, 0),
    strong_count: boundedNumber(value.strong_count, 0),
    partial_count: boundedNumber(value.partial_count, 0),
    sparse_count: boundedNumber(value.sparse_count, 0),
    items: asArray(value.items).map(normalizeEvidenceCompletenessItem).slice(0, 25),
  }
}

function normalizeEnrichmentSourceList(value) {
  return asArray(value)
    .filter(item => ALLOWED_ENRICHMENT_SOURCES.has(item))
    .slice(0, 4)
}

function normalizeEnrichmentEligibilityItem(item) {
  const value = asObject(item)
  const status = ALLOWED_ENRICHMENT_ELIGIBILITY_STATUS.has(value.status)
    ? value.status
    : 'no_safe_source'

  return {
    sample_id: boundedNumber(value.sample_id, 0),
    status,
    missing_fields: normalizeEvidenceFieldList(value.missing_fields),
    eligible_sources: normalizeEnrichmentSourceList(value.eligible_sources),
    provider_calls_enabled: value.provider_calls_enabled === true,
    ai_calls_enabled: value.ai_calls_enabled === true,
    persistence_enabled: value.persistence_enabled === true,
    arr_writes_enabled: value.arr_writes_enabled === true,
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeEnrichmentEligibility(eligibility) {
  const value = asObject(eligibility)

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'representative_replay_enrichment_eligibility', 80),
    enabled: value.enabled === true,
    provider_calls_enabled: value.provider_calls_enabled === true,
    ai_calls_enabled: value.ai_calls_enabled === true,
    persistence_enabled: value.persistence_enabled === true,
    arr_writes_enabled: value.arr_writes_enabled === true,
    sample_count: boundedNumber(value.sample_count, 0),
    eligible_count: boundedNumber(value.eligible_count, 0),
    not_needed_count: boundedNumber(value.not_needed_count, 0),
    insufficient_identity_count: boundedNumber(value.insufficient_identity_count, 0),
    no_safe_source_count: boundedNumber(value.no_safe_source_count, 0),
    items: asArray(value.items).map(normalizeEnrichmentEligibilityItem).slice(0, 25),
  }
}

function normalizeProviderReadinessSource(item) {
  const value = asObject(item)
  const source = ALLOWED_ENRICHMENT_SOURCES.has(value.source)
    ? value.source
    : 'web_search_metadata'
  const status = ALLOWED_PROVIDER_READINESS_STATUS.has(value.status)
    ? value.status
    : 'unavailable'

  return {
    source,
    status,
    configured: value.configured === true,
    quota_safe: value.quota_safe === true,
    cooldown_active: value.cooldown_active === true,
    eligible_sample_count: boundedNumber(value.eligible_sample_count, 0),
    selected_provider_key: boundedString(value.selected_provider_key, null, 40),
    available_provider_count: boundedNumber(value.available_provider_count, 0),
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeProviderReadiness(readiness) {
  const value = asObject(readiness)
  const readinessValue = ALLOWED_PROVIDER_READINESS.has(value.readiness)
    ? value.readiness
    : 'not_needed'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'representative_replay_provider_readiness', 80),
    enabled: value.enabled === true,
    live_provider_calls_enabled: value.live_provider_calls_enabled === true,
    ai_calls_enabled: value.ai_calls_enabled === true,
    persistence_enabled: value.persistence_enabled === true,
    arr_writes_enabled: value.arr_writes_enabled === true,
    source_count: boundedNumber(value.source_count, 0),
    ready_source_count: boundedNumber(value.ready_source_count, 0),
    unavailable_source_count: boundedNumber(value.unavailable_source_count, 0),
    demanded_source_count: boundedNumber(value.demanded_source_count, 0),
    readiness: readinessValue,
    sources: asArray(value.sources).map(normalizeProviderReadinessSource).slice(0, 8),
  }
}

function normalizeEnrichmentAdapterSource(item) {
  const value = asObject(item)
  const source = ALLOWED_ENRICHMENT_SOURCES.has(value.source)
    ? value.source
    : 'web_search_metadata'
  const status = ALLOWED_ENRICHMENT_ADAPTER_STATUS.has(value.status)
    ? value.status
    : 'blocked'

  return {
    source,
    status,
    enabled: value.enabled === true,
    provider_ready: value.provider_ready === true,
    configured: value.configured === true,
    quota_safe: value.quota_safe === true,
    cooldown_active: value.cooldown_active === true,
    eligible_sample_count: boundedNumber(value.eligible_sample_count, 0),
    selected_provider_key: boundedString(value.selected_provider_key, null, 40),
    available_provider_count: boundedNumber(value.available_provider_count, 0),
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeEnrichmentAdapterContract(contract) {
  const value = asObject(contract)
  const readiness = ALLOWED_ENRICHMENT_ADAPTER_READINESS.has(value.readiness)
    ? value.readiness
    : 'not_needed'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'replay_enrichment_adapter_contract', 80),
    enabled: value.enabled === true,
    live_provider_calls_enabled: value.live_provider_calls_enabled === true,
    ai_calls_enabled: value.ai_calls_enabled === true,
    persistence_enabled: value.persistence_enabled === true,
    arr_writes_enabled: value.arr_writes_enabled === true,
    adapter_count: boundedNumber(value.adapter_count, 0),
    enabled_adapter_count: boundedNumber(value.enabled_adapter_count, 0),
    ready_adapter_count: boundedNumber(value.ready_adapter_count, 0),
    blocked_adapter_count: boundedNumber(value.blocked_adapter_count, 0),
    unavailable_adapter_count: boundedNumber(value.unavailable_adapter_count, 0),
    demanded_adapter_count: boundedNumber(value.demanded_adapter_count, 0),
    readiness,
    sources: asArray(value.sources).map(normalizeEnrichmentAdapterSource).slice(0, 8),
  }
}

function normalizeTmdbMetadataAdapterItem(item) {
  const value = asObject(item)
  const status = ALLOWED_TMDB_ADAPTER_ITEM_STATUS.has(value.status)
    ? value.status
    : 'unavailable'
  const counts = asObject(value.field_counts)

  return {
    sample_id: boundedNumber(value.sample_id, 0),
    status,
    available_fields: normalizeEvidenceFieldList(value.available_fields),
    improved_fields: normalizeEvidenceFieldList(value.improved_fields),
    field_counts: {
      genres: boundedNumber(counts.genres, 0),
      keywords: boundedNumber(counts.keywords, 0),
      studios: boundedNumber(counts.studios, 0),
    },
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeTmdbMetadataExecutionSwitch(executionSwitch) {
  const value = asObject(executionSwitch)
  const status = ALLOWED_TMDB_EXECUTION_SWITCH_STATUS.has(value.status)
    ? value.status
    : 'blocked'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'replay_tmdb_metadata_execution_switch', 80),
    source: ALLOWED_ENRICHMENT_SOURCES.has(value.source) ? value.source : 'tmdb_metadata',
    enabled: value.enabled === true,
    status,
    requested: value.requested === true,
    server_enabled: value.server_enabled === true,
    provider_ready: value.provider_ready === true,
    quota_safe: value.quota_safe === true,
    cooldown_active: value.cooldown_active === true,
    selected_provider_key: boundedString(value.selected_provider_key, null, 40),
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeTmdbMetadataAdapterPreview(preview) {
  const value = asObject(preview)
  const status = ALLOWED_TMDB_ADAPTER_STATUS.has(value.status)
    ? value.status
    : 'blocked'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'replay_tmdb_metadata_adapter_preview', 80),
    source: ALLOWED_ENRICHMENT_SOURCES.has(value.source) ? value.source : 'tmdb_metadata',
    enabled: value.enabled === true,
    status,
    provider_payload_exposed: value.provider_payload_exposed === true,
    live_provider_calls_enabled: value.live_provider_calls_enabled === true,
    ai_calls_enabled: value.ai_calls_enabled === true,
    persistence_enabled: value.persistence_enabled === true,
    arr_writes_enabled: value.arr_writes_enabled === true,
    cache_mutation_enabled: value.cache_mutation_enabled === true,
    execution_switch: normalizeTmdbMetadataExecutionSwitch(value.execution_switch),
    requested_field_count: boundedNumber(value.requested_field_count, 0),
    eligible_sample_count: boundedNumber(value.eligible_sample_count, 0),
    preview_limit: boundedNumber(value.preview_limit, 0),
    previewed_count: boundedNumber(value.previewed_count, 0),
    improved_sample_count: boundedNumber(value.improved_sample_count, 0),
    improved_field_count: boundedNumber(value.improved_field_count, 0),
    items: asArray(value.items).map(normalizeTmdbMetadataAdapterItem).slice(0, 5),
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeTmdbMetadataCoverageComparisonItem(item) {
  const value = asObject(item)
  const status = ALLOWED_TMDB_COVERAGE_ITEM_STATUS.has(value.status)
    ? value.status
    : 'not_previewed'
  const beforeCompleteness = ALLOWED_COMPLETENESS_LEVELS.has(value.before_completeness)
    ? value.before_completeness
    : 'sparse'
  const afterCompleteness = ALLOWED_COMPLETENESS_LEVELS.has(value.after_completeness)
    ? value.after_completeness
    : beforeCompleteness

  return {
    sample_id: boundedNumber(value.sample_id, 0),
    status,
    before_completeness: beforeCompleteness,
    after_completeness: afterCompleteness,
    before_available_fields: normalizeEvidenceFieldList(value.before_available_fields),
    added_fields: normalizeEvidenceFieldList(value.added_fields),
    after_available_fields: normalizeEvidenceFieldList(value.after_available_fields),
    remaining_missing_fields: normalizeEvidenceFieldList(value.remaining_missing_fields),
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeTmdbMetadataCoverageComparison(comparison) {
  const value = asObject(comparison)
  const status = ALLOWED_TMDB_COVERAGE_STATUS.has(value.status)
    ? value.status
    : 'not_needed'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'replay_tmdb_metadata_coverage_comparison', 80),
    enabled: value.enabled === true,
    status,
    sample_count: boundedNumber(value.sample_count, 0),
    comparable_count: boundedNumber(value.comparable_count, 0),
    improved_sample_count: boundedNumber(value.improved_sample_count, 0),
    upgraded_completeness_count: boundedNumber(value.upgraded_completeness_count, 0),
    added_field_count: boundedNumber(value.added_field_count, 0),
    remaining_missing_field_count: boundedNumber(value.remaining_missing_field_count, 0),
    before_strong_count: boundedNumber(value.before_strong_count, 0),
    after_strong_count: boundedNumber(value.after_strong_count, 0),
    reason_codes: normalizeStringList(value.reason_codes),
    items: asArray(value.items)
      .map(normalizeTmdbMetadataCoverageComparisonItem)
      .slice(0, 25),
  }
}

function normalizeStringList(value) {
  return asArray(value)
    .filter(item => typeof item === 'string' && item.length > 0)
    .map(item => item.slice(0, 120))
    .slice(0, 8)
}

function normalizePolicyEngineComparisonItem(item) {
  const value = asObject(item)
  const fit = ALLOWED_SIGNAL_FITS.has(value.policy_engine_fit)
    ? value.policy_engine_fit
    : 'insufficient'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'deterministic_policy_engine_preview', 80),
    enabled: value.enabled === true,
    policy_engine_score: boundedNumber(value.policy_engine_score, 0),
    policy_engine_fit: fit,
    evidence_available: value.evidence_available === true,
    preset_count: boundedNumber(value.preset_count, 0),
    scored_preset_count: boundedNumber(value.scored_preset_count, 0),
    positive_signal_count: boundedNumber(value.positive_signal_count, 0),
    blocking_signal_count: boundedNumber(value.blocking_signal_count, 0),
    blocker_count: boundedNumber(value.blocker_count, 0),
    blockers: normalizeStringList(value.blockers),
  }
}

function normalizeScoringItem(item) {
  const value = asObject(item)
  const fit = ALLOWED_SIGNAL_FITS.has(value.draft_signal_fit)
    ? value.draft_signal_fit
    : 'insufficient'
  const recommendation = ALLOWED_RECOMMENDATIONS.has(value.recommendation)
    ? value.recommendation
    : 'insufficient_evidence'
  const matched = asObject(value.matched)

  return {
    sample_id: boundedNumber(value.sample_id, 0),
    draft_signal_fit: fit,
    recommendation,
    evidence_available: value.evidence_available === true,
    matched: {
      identity: normalizeStringList(matched.identity),
      compatibility: normalizeStringList(matched.compatibility),
      boosters: normalizeStringList(matched.boosters),
    },
    missing_required: normalizeStringList(value.missing_required),
    exclusion_hits: normalizeStringList(value.exclusion_hits),
    policy_engine: normalizePolicyEngineComparisonItem(value.policy_engine),
  }
}

function normalizePolicyEngineComparisonSummary(summary) {
  const value = asObject(summary)

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'deterministic_policy_engine_preview', 80),
    enabled: value.enabled === true,
    compared_count: boundedNumber(value.compared_count, 0),
    strong_count: boundedNumber(value.strong_count, 0),
    review_count: boundedNumber(value.review_count, 0),
    blocked_count: boundedNumber(value.blocked_count, 0),
    insufficient_count: boundedNumber(value.insufficient_count, 0),
  }
}

function normalizeParityDeltaItem(item) {
  const value = asObject(item)
  const action = ALLOWED_DELTA_ACTIONS.has(value.delta_action)
    ? value.delta_action
    : 'insufficient_evidence'
  const level = ALLOWED_DELTA_LEVELS.has(value.delta_level)
    ? value.delta_level
    : 'unknown'

  return {
    sample_id: boundedNumber(value.sample_id, 0),
    current_outcome: ALLOWED_OUTCOMES.has(value.current_outcome)
      ? value.current_outcome
      : 'review_or_pending',
    draft_signal_fit: ALLOWED_SIGNAL_FITS.has(value.draft_signal_fit)
      ? value.draft_signal_fit
      : 'insufficient',
    policy_engine_fit: ALLOWED_SIGNAL_FITS.has(value.policy_engine_fit)
      ? value.policy_engine_fit
      : 'insufficient',
    delta_action: action,
    delta_level: level,
    reason_codes: normalizeStringList(value.reason_codes),
  }
}

function normalizeParityDelta(delta) {
  const value = asObject(delta)

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'representative_replay_parity_delta', 80),
    enabled: value.enabled === true,
    compared_count: boundedNumber(value.compared_count, 0),
    would_remain_count: boundedNumber(value.would_remain_count, 0),
    would_now_candidate_count: boundedNumber(value.would_now_candidate_count, 0),
    would_now_review_count: boundedNumber(value.would_now_review_count, 0),
    would_now_block_count: boundedNumber(value.would_now_block_count, 0),
    insufficient_count: boundedNumber(value.insufficient_count, 0),
    items: asArray(value.items).map(normalizeParityDeltaItem).slice(0, 25),
  }
}

function normalizeDryRunScoring(scoring) {
  const value = asObject(scoring)

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'deterministic_signal_fit', 80),
    enabled: value.enabled === true,
    full_classification_run: value.full_classification_run === true,
    ai_calls_enabled: value.ai_calls_enabled === true,
    provider_calls_enabled: value.provider_calls_enabled === true,
    arr_writes_enabled: value.arr_writes_enabled === true,
    persistence_enabled: value.persistence_enabled === true,
    sample_count: boundedNumber(value.sample_count, 0),
    scored_count: boundedNumber(value.scored_count, 0),
    strong_fit_count: boundedNumber(value.strong_fit_count, 0),
    review_count: boundedNumber(value.review_count, 0),
    blocked_count: boundedNumber(value.blocked_count, 0),
    insufficient_count: boundedNumber(value.insufficient_count, 0),
    policy_engine_comparison: normalizePolicyEngineComparisonSummary(value.policy_engine_comparison),
    items: asArray(value.items).map(normalizeScoringItem).slice(0, 25),
  }
}

export function normalizePolicyIntentReplayPreview(preview) {
  const value = asObject(preview)
  if (Object.keys(value).length === 0) {
    return null
  }

  const validation = asObject(value.validation)
  const execution = asObject(value.execution)
  const impactSummary = asObject(value.impact_summary)
  const sample = asObject(value.sample)
  const readiness = ALLOWED_READINESS.has(sample.readiness) ? sample.readiness : 'no_samples'
  const parity = ALLOWED_PARITY.has(impactSummary.parity) ? impactSummary.parity : 'unknown'
  const impactLevel = ALLOWED_IMPACT_LEVELS.has(impactSummary.impact_level)
    ? impactSummary.impact_level
    : 'unknown'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'read_only_replay_preview'),
    persistence_enabled: value.persistence_enabled === true,
    execution: {
      classification_run: execution.classification_run === true,
      ai_calls_enabled: execution.ai_calls_enabled === true,
      provider_calls_enabled: execution.provider_calls_enabled === true,
      arr_writes_enabled: execution.arr_writes_enabled === true,
    },
    validation: {
      valid: validation.valid !== false,
      errors: asArray(validation.errors).filter(error => typeof error === 'string').slice(0, 8),
    },
    impact_summary: {
      parity,
      impact_level: impactLevel,
      changed_bucket_count: boundedNumber(impactSummary.changed_bucket_count),
    },
    sample: {
      requested_limit: boundedNumber(sample.requested_limit, 0),
      returned_count: boundedNumber(sample.returned_count, 0),
      readiness,
      diagnostics: normalizeSampleDiagnostics(sample.diagnostics, {
        requested_limit: boundedNumber(sample.requested_limit, 0),
        returned_count: boundedNumber(sample.returned_count, 0),
      }),
      evidence_completeness: normalizeEvidenceCompleteness(sample.evidence_completeness),
      enrichment_eligibility: normalizeEnrichmentEligibility(sample.enrichment_eligibility),
      provider_readiness: normalizeProviderReadiness(sample.provider_readiness),
      enrichment_adapter_contract: normalizeEnrichmentAdapterContract(sample.enrichment_adapter_contract),
      tmdb_metadata_adapter_preview: normalizeTmdbMetadataAdapterPreview(sample.tmdb_metadata_adapter_preview),
      tmdb_metadata_coverage_comparison: normalizeTmdbMetadataCoverageComparison(sample.tmdb_metadata_coverage_comparison),
      items: asArray(sample.items).map(normalizeSampleItem).slice(0, 25),
    },
    dry_run_scoring: normalizeDryRunScoring(value.dry_run_scoring),
    parity_delta: normalizeParityDelta(value.parity_delta),
  }
}

export function buildPolicyIntentReplayPreviewNotice(preview) {
  const normalized = normalizePolicyIntentReplayPreview(preview)
  if (!normalized) {
    return null
  }

  if (!normalized.validation.valid) {
    return {
      tone: 'error',
      title: 'Replay preview validation failed',
      message: 'The server rejected the intent draft before selecting representative samples.',
    }
  }

  if (normalized.sample.readiness === 'no_samples') {
    return {
      tone: 'warning',
      title: 'No representative samples found',
      message: 'This library does not have recent classification history to preview against yet.',
    }
  }

  if (normalized.impact_summary.impact_level === 'high') {
    return {
      tone: 'warning',
      title: 'Replay samples ready for high-impact change',
      message: 'Samples are available, but the structural impact preview found high-impact intent drift.',
    }
  }

  return {
    tone: 'success',
    title: 'Replay samples are ready',
    message: 'Classifarr selected recent sanitized classifications and ran deterministic signal-fit replay without AI, providers, arr writes, or persistence.',
  }
}

export function summarizePolicyIntentReplaySamples(preview) {
  const normalized = normalizePolicyIntentReplayPreview(preview)
  return normalized?.sample.items || []
}
