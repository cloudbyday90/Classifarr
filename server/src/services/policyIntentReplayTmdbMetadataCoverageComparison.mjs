/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_INTENT_REPLAY_TMDB_METADATA_COVERAGE_COMPARISON_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_TMDB_METADATA_COVERAGE_COMPARISON_MODE = 'replay_tmdb_metadata_coverage_comparison';

const MAX_ITEMS = 25;
const FIELD_ORDER = Object.freeze([
  'rating',
  'genres',
  'keywords',
  'studio',
  'language',
  'overview',
  'runtime',
  'vote_average',
]);
const CORE_FIELDS = new Set(['rating', 'genres', 'language']);
const FIELD_SET = new Set(FIELD_ORDER);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function boundedNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizeFieldList(value = []) {
  const seen = new Set();
  const fields = [];

  for (const field of asArray(value)) {
    if (!FIELD_SET.has(field) || seen.has(field)) {
      continue;
    }
    seen.add(field);
    fields.push(field);
  }

  return FIELD_ORDER.filter(field => seen.has(field));
}

function classifyCompleteness(availableFields = []) {
  const available = new Set(availableFields);
  const coreAvailableCount = [...CORE_FIELDS].filter(field => available.has(field)).length;

  if (availableFields.length >= 5 && coreAvailableCount >= 2) {
    return 'strong';
  }
  if (availableFields.length >= 3 || coreAvailableCount >= 1) {
    return 'partial';
  }
  return 'sparse';
}

function evidenceItemsBySampleId(evidenceCompleteness = {}) {
  return new Map(
    asArray(evidenceCompleteness.items)
      .map(item => [boundedNumber(item?.sample_id, 0), item])
      .filter(([sampleId]) => sampleId > 0)
  );
}

function tmdbItemsBySampleId(tmdbMetadataAdapterPreview = {}) {
  return new Map(
    asArray(tmdbMetadataAdapterPreview.items)
      .map(item => [boundedNumber(item?.sample_id, 0), item])
      .filter(([sampleId]) => sampleId > 0)
  );
}

function buildComparisonItem(evidenceItem = {}, tmdbItem = null) {
  const sampleId = boundedNumber(evidenceItem.sample_id, 0);
  const beforeAvailableFields = normalizeFieldList(evidenceItem.available_fields);
  const beforeMissingFields = normalizeFieldList(evidenceItem.missing_fields);
  const beforeCompleteness = classifyCompleteness(beforeAvailableFields);

  if (!tmdbItem || tmdbItem.status !== 'ready') {
    return {
      sample_id: sampleId,
      status: tmdbItem ? 'not_improved' : 'not_previewed',
      before_completeness: beforeCompleteness,
      after_completeness: beforeCompleteness,
      before_available_fields: beforeAvailableFields,
      added_fields: [],
      after_available_fields: beforeAvailableFields,
      remaining_missing_fields: beforeMissingFields,
      reason_codes: [
        tmdbItem ? `tmdb_preview:${tmdbItem.status || 'unavailable'}` : 'tmdb_preview:not_previewed',
        'coverage:unchanged',
      ],
    };
  }

  const improvedFields = normalizeFieldList(tmdbItem.improved_fields);
  const addedSet = new Set(improvedFields.filter(field => beforeMissingFields.includes(field)));
  const afterAvailableSet = new Set([...beforeAvailableFields, ...addedSet]);
  const afterAvailableFields = FIELD_ORDER.filter(field => afterAvailableSet.has(field));
  const remainingMissingFields = beforeMissingFields.filter(field => !addedSet.has(field));
  const afterCompleteness = classifyCompleteness(afterAvailableFields);
  const addedFields = FIELD_ORDER.filter(field => addedSet.has(field));
  const status = addedFields.length > 0 ? 'improved' : 'unchanged';

  return {
    sample_id: sampleId,
    status,
    before_completeness: beforeCompleteness,
    after_completeness: afterCompleteness,
    before_available_fields: beforeAvailableFields,
    added_fields: addedFields,
    after_available_fields: afterAvailableFields,
    remaining_missing_fields: remainingMissingFields,
    reason_codes: [
      `tmdb_preview:${tmdbItem.status}`,
      addedFields.length > 0 ? 'coverage:would_add_fields' : 'coverage:no_new_fields',
      beforeCompleteness === afterCompleteness
        ? 'coverage:completeness_unchanged'
        : `coverage:completeness_${beforeCompleteness}_to_${afterCompleteness}`,
    ].slice(0, 8),
  };
}

function buildStatus(tmdbMetadataAdapterPreview = {}, items = []) {
  if (tmdbMetadataAdapterPreview.status === 'blocked') {
    return 'blocked';
  }
  if (tmdbMetadataAdapterPreview.status === 'unavailable') {
    return 'unavailable';
  }
  if (items.length === 0) {
    return 'not_needed';
  }
  if (items.some(item => item.added_fields.length > 0)) {
    return 'improved';
  }
  return 'unchanged';
}

export function buildPolicyIntentReplayTmdbMetadataCoverageComparison({
  evidenceCompleteness = null,
  tmdbMetadataAdapterPreview = null,
} = {}) {
  const evidenceBySampleId = evidenceItemsBySampleId(evidenceCompleteness);
  const tmdbBySampleId = tmdbItemsBySampleId(tmdbMetadataAdapterPreview);
  const items = [...evidenceBySampleId.values()]
    .slice(0, MAX_ITEMS)
    .map(evidenceItem => buildComparisonItem(
      evidenceItem,
      tmdbBySampleId.get(boundedNumber(evidenceItem.sample_id, 0)) || null
    ));
  const addedFieldCount = items.reduce((sum, item) => sum + item.added_fields.length, 0);
  const remainingMissingFieldCount = items.reduce((sum, item) => (
    sum + item.remaining_missing_fields.length
  ), 0);
  const upgradedCompletenessCount = items.filter(item => (
    item.before_completeness !== item.after_completeness
  )).length;
  const status = buildStatus(tmdbMetadataAdapterPreview || {}, items);

  return {
    schema_version: POLICY_INTENT_REPLAY_TMDB_METADATA_COVERAGE_COMPARISON_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_TMDB_METADATA_COVERAGE_COMPARISON_MODE,
    enabled: true,
    status,
    sample_count: items.length,
    comparable_count: items.filter(item => item.status !== 'not_previewed').length,
    improved_sample_count: items.filter(item => item.added_fields.length > 0).length,
    upgraded_completeness_count: upgradedCompletenessCount,
    added_field_count: addedFieldCount,
    remaining_missing_field_count: remainingMissingFieldCount,
    before_strong_count: items.filter(item => item.before_completeness === 'strong').length,
    after_strong_count: items.filter(item => item.after_completeness === 'strong').length,
    reason_codes: [
      `tmdb_adapter:${tmdbMetadataAdapterPreview?.status || 'missing'}`,
      addedFieldCount > 0 ? 'coverage:would_improve' : 'coverage:no_added_fields',
    ].slice(0, 8),
    items,
  };
}
