/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildPolicyIntentReplayItemFromHistoryRow } from './policyIntentReplayItemAdapter.mjs';

export const POLICY_INTENT_REPLAY_ENRICHMENT_ELIGIBILITY_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_ENRICHMENT_ELIGIBILITY_MODE = 'representative_replay_enrichment_eligibility';

const MAX_ITEMS = 25;
const ENRICHABLE_FIELDS = Object.freeze([
  'rating',
  'genres',
  'keywords',
  'studio',
  'language',
  'overview',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function boundedString(value, fallback = null, maxLength = 120) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function parseMetadata(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return asObject(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return asObject(value);
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

function normalizeMediaType(value) {
  const normalized = boundedString(value, null, 20);
  return ['movie', 'tv'].includes(normalized) ? normalized : null;
}

function evidenceAvailability(item = {}) {
  return {
    rating: hasValue(item.certification),
    genres: hasValue(item.genres),
    keywords: hasValue(item.keywords),
    studio: hasValue(item.primary_studio_name) || hasValue(item.studios),
    language: hasValue(item.original_language),
    overview: hasValue(item.overview),
  };
}

function missingEnrichableFields(item = {}) {
  const available = evidenceAvailability(item);
  return ENRICHABLE_FIELDS.filter((field) => !available[field]);
}

function hasTmdbIdentity(row = {}, metadata = {}) {
  return Number.isInteger(Number(row.tmdb_id ?? metadata.tmdb_id ?? metadata.tmdbId));
}

function hasImdbIdentity(metadata = {}) {
  return Boolean(boundedString(
    metadata.imdb_id
      ?? metadata.imdbId
      ?? metadata.imdb
      ?? metadata.external_ids?.imdb_id,
    null,
    40
  ));
}

function hasTitleIdentity(row = {}, item = {}) {
  const title = boundedString(row.title, null, 160);
  return Boolean(title && normalizeMediaType(row.media_type ?? item.media_type));
}

function candidateSources({ row, item, metadata, missingFields }) {
  const sources = [];
  const mediaType = normalizeMediaType(row.media_type ?? item.media_type);

  if (missingFields.length === 0) {
    return sources;
  }

  if (hasTmdbIdentity(row, metadata) && mediaType) {
    sources.push('tmdb_metadata');
  }
  if (hasImdbIdentity(metadata) && missingFields.includes('rating')) {
    sources.push('omdb_rating');
  }
  if (hasTitleIdentity(row, item) && missingFields.some((field) => ['keywords', 'studio', 'overview'].includes(field))) {
    sources.push('web_search_metadata');
  }

  return sources.slice(0, 4);
}

function determineStatus({ missingFields, sources, row, item, metadata }) {
  if (missingFields.length === 0) {
    return 'not_needed';
  }

  if (sources.length > 0) {
    return 'eligible';
  }

  if (!hasTmdbIdentity(row, metadata) && !hasTitleIdentity(row, item)) {
    return 'insufficient_identity';
  }

  return 'no_safe_source';
}

function buildReasonCodes({ status, missingFields, sources, row, item, metadata }) {
  const reasons = [`status:${status}`];

  for (const field of missingFields.slice(0, 4)) {
    reasons.push(`missing:${field}`);
  }
  if (hasTmdbIdentity(row, metadata)) {
    reasons.push('identity:tmdb_available');
  }
  if (hasImdbIdentity(metadata)) {
    reasons.push('identity:imdb_available');
  }
  if (hasTitleIdentity(row, item)) {
    reasons.push('identity:title_available');
  }
  for (const source of sources.slice(0, 3)) {
    reasons.push(`source:${source}`);
  }

  return reasons.slice(0, 8);
}

function buildEligibilityItem(row = {}, index = 0) {
  const item = buildPolicyIntentReplayItemFromHistoryRow(row);
  const metadata = parseMetadata(row.metadata);
  const missingFields = missingEnrichableFields(item);
  const sources = candidateSources({
    row,
    item,
    metadata,
    missingFields,
  });
  const status = determineStatus({
    missingFields,
    sources,
    row,
    item,
    metadata,
  });

  return {
    sample_id: index + 1,
    status,
    missing_fields: missingFields,
    eligible_sources: sources,
    provider_calls_enabled: false,
    ai_calls_enabled: false,
    persistence_enabled: false,
    arr_writes_enabled: false,
    reason_codes: buildReasonCodes({
      status,
      missingFields,
      sources,
      row,
      item,
      metadata,
    }),
  };
}

export function buildPolicyIntentReplayEnrichmentEligibility({ samples = [] } = {}) {
  const items = asArray(samples)
    .slice(0, MAX_ITEMS)
    .map((sample, index) => buildEligibilityItem(sample, index));

  return {
    schema_version: POLICY_INTENT_REPLAY_ENRICHMENT_ELIGIBILITY_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_ENRICHMENT_ELIGIBILITY_MODE,
    enabled: true,
    provider_calls_enabled: false,
    ai_calls_enabled: false,
    persistence_enabled: false,
    arr_writes_enabled: false,
    sample_count: items.length,
    eligible_count: items.filter((item) => item.status === 'eligible').length,
    not_needed_count: items.filter((item) => item.status === 'not_needed').length,
    insufficient_identity_count: items.filter((item) => item.status === 'insufficient_identity').length,
    no_safe_source_count: items.filter((item) => item.status === 'no_safe_source').length,
    items,
  };
}
