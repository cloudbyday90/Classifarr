/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildPolicyIntentReplayItemFromHistoryRow } from './policyIntentReplayItemAdapter.mjs';

export const POLICY_INTENT_REPLAY_EVIDENCE_COMPLETENESS_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_EVIDENCE_COMPLETENESS_MODE = 'representative_replay_evidence_completeness';

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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function boundedCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

function fieldAvailabilityForItem(item = {}) {
  return {
    rating: hasValue(item.certification),
    genres: hasValue(item.genres),
    keywords: hasValue(item.keywords),
    studio: hasValue(item.primary_studio_name) || hasValue(item.studios),
    language: hasValue(item.original_language),
    overview: hasValue(item.overview),
    runtime: hasValue(item.runtime),
    vote_average: hasValue(item.vote_average),
  };
}

function fieldCountsForItem(item = {}) {
  return {
    genres: boundedCount(item.genres?.length),
    keywords: boundedCount(item.keywords?.length),
    studios: boundedCount(item.studios?.length),
  };
}

function classifyCompleteness(availableFields = []) {
  const available = new Set(availableFields);
  const coreAvailableCount = [...CORE_FIELDS].filter((field) => available.has(field)).length;

  if (availableFields.length >= 5 && coreAvailableCount >= 2) {
    return 'strong';
  }
  if (availableFields.length >= 3 || coreAvailableCount >= 1) {
    return 'partial';
  }
  return 'sparse';
}

function buildReasonCodes({ completeness, availableFields, missingFields }) {
  const reasons = [`status:${completeness}`];

  if (availableFields.includes('rating')) {
    reasons.push('evidence:rating_available');
  }
  if (availableFields.includes('genres')) {
    reasons.push('evidence:genres_available');
  }
  if (availableFields.includes('keywords')) {
    reasons.push('evidence:keywords_available');
  }
  if (availableFields.includes('overview')) {
    reasons.push('evidence:overview_available');
  }
  if (missingFields.includes('rating')) {
    reasons.push('missing:rating');
  }
  if (missingFields.includes('genres')) {
    reasons.push('missing:genres');
  }
  if (missingFields.includes('language')) {
    reasons.push('missing:language');
  }

  return reasons.slice(0, 8);
}

function buildCompletenessItem(row = {}, index = 0) {
  const replayItem = buildPolicyIntentReplayItemFromHistoryRow(row);
  const availability = fieldAvailabilityForItem(replayItem);
  const availableFields = FIELD_ORDER.filter((field) => availability[field]);
  const missingFields = FIELD_ORDER.filter((field) => !availability[field]);
  const completeness = classifyCompleteness(availableFields);

  return {
    sample_id: index + 1,
    completeness,
    available_fields: availableFields,
    missing_fields: missingFields,
    field_counts: fieldCountsForItem(replayItem),
    reason_codes: buildReasonCodes({
      completeness,
      availableFields,
      missingFields,
    }),
  };
}

export function buildPolicyIntentReplayEvidenceCompleteness({ samples = [] } = {}) {
  const items = asArray(samples)
    .slice(0, MAX_ITEMS)
    .map((sample, index) => buildCompletenessItem(sample, index));

  return {
    schema_version: POLICY_INTENT_REPLAY_EVIDENCE_COMPLETENESS_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_EVIDENCE_COMPLETENESS_MODE,
    enabled: true,
    sample_count: items.length,
    strong_count: items.filter((item) => item.completeness === 'strong').length,
    partial_count: items.filter((item) => item.completeness === 'partial').length,
    sparse_count: items.filter((item) => item.completeness === 'sparse').length,
    items,
  };
}
