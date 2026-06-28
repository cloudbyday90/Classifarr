/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildPolicyIntentReplayItemFromHistoryRow } from './policyIntentReplayItemAdapter.mjs';
import {
  createPolicyIntentReplayEnrichmentAdapterContext,
  PolicyIntentReplayEnrichmentAdapterBlockedError,
} from './policyIntentReplayEnrichmentAdapterContract.mjs';

export const POLICY_INTENT_REPLAY_TMDB_METADATA_ADAPTER_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_TMDB_METADATA_ADAPTER_MODE = 'replay_tmdb_metadata_adapter_preview';
export const POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE = 'tmdb_metadata';

const MAX_PREVIEW_ITEMS = 5;
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
const TMDB_APPEND_TO_RESPONSE = 'keywords,release_dates';
const ALLOWED_MEDIA_TYPES = new Set(['movie', 'tv']);
const ALLOWED_EXECUTION_SWITCH_STATUS = new Set(['enabled', 'blocked', 'unavailable']);

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

function positiveIntegerOrNull(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  return ALLOWED_MEDIA_TYPES.has(normalized) ? normalized : null;
}

function normalizeNamedList(values = []) {
  const seen = new Set();
  const normalized = [];

  for (const value of asArray(values)) {
    const object = asObject(value);
    const name = boundedString(object.name ?? object.title ?? object.keyword ?? value, null, 120);
    if (!name) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(name);
  }

  return normalized.slice(0, 25);
}

function firstCertification(countries = [], childKey = 'release_dates') {
  const preferred = asArray(countries).find(country => country?.iso_3166_1 === 'US')
    || asArray(countries)[0];
  const entries = asArray(preferred?.[childKey]);
  const certification = entries.length > 0
    ? entries.find(entry => boundedString(entry?.certification ?? entry?.rating, null, 20))
    : preferred;

  return boundedString(certification?.certification ?? certification?.rating, null, 20);
}

function extractCertification(payload = {}) {
  const releaseDatesCertification = firstCertification(payload.release_dates?.results, 'release_dates');
  if (releaseDatesCertification) {
    return releaseDatesCertification;
  }

  const releasesCertification = firstCertification(payload.releases?.countries, 'releases');
  if (releasesCertification) {
    return releasesCertification;
  }

  const contentRating = firstCertification(payload.content_ratings?.results, 'ratings');
  if (contentRating) {
    return contentRating;
  }

  return null;
}

function normalizeTmdbMetadataPayload(payload = {}) {
  const value = asObject(payload);
  const genres = normalizeNamedList(value.genres);
  const keywords = normalizeNamedList(value.keywords?.keywords ?? value.keywords?.results);
  const studios = normalizeNamedList(value.production_companies);
  const availability = {
    rating: hasValue(extractCertification(value)),
    genres: genres.length > 0,
    keywords: keywords.length > 0,
    studio: studios.length > 0,
    language: hasValue(value.original_language),
    overview: hasValue(value.overview),
    runtime: hasValue(value.runtime),
    vote_average: hasValue(value.vote_average),
  };

  return {
    available_fields: FIELD_ORDER.filter(field => availability[field]),
    field_counts: {
      genres: genres.length,
      keywords: keywords.length,
      studios: studios.length,
    },
  };
}

function existingFieldAvailability(row = {}) {
  const item = buildPolicyIntentReplayItemFromHistoryRow(row);

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

function buildImprovedFields(row = {}, normalizedPayload = {}) {
  const existing = existingFieldAvailability(row);
  const available = new Set(normalizedPayload.available_fields || []);

  return FIELD_ORDER.filter(field => !existing[field] && available.has(field));
}

function sourceFromContract(adapterContract = {}) {
  return asArray(adapterContract.sources)
    .find(source => source?.source === POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE) || null;
}

function sanitizeExecutionSwitch(executionSwitch = {}) {
  const value = asObject(executionSwitch);
  const status = ALLOWED_EXECUTION_SWITCH_STATUS.has(value.status)
    ? value.status
    : 'blocked';

  return {
    schema_version: 1,
    mode: boundedString(value.mode, 'replay_tmdb_metadata_execution_switch', 80),
    source: POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE,
    enabled: value.enabled === true,
    status,
    requested: value.requested === true,
    server_enabled: value.server_enabled === true,
    provider_ready: value.provider_ready === true,
    quota_safe: value.quota_safe === true,
    cooldown_active: value.cooldown_active === true,
    selected_provider_key: boundedString(value.selected_provider_key, null, 40),
    reason_codes: asArray(value.reason_codes)
      .filter(reason => typeof reason === 'string' && reason.length > 0)
      .map(reason => reason.slice(0, 120))
      .slice(0, 8),
  };
}

function basePreview({
  adapterContract = null,
  context,
  samples = [],
  executionSwitch = null,
} = {}) {
  const source = sourceFromContract(adapterContract);

  return {
    schema_version: POLICY_INTENT_REPLAY_TMDB_METADATA_ADAPTER_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_TMDB_METADATA_ADAPTER_MODE,
    source: POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE,
    enabled: true,
    status: 'blocked',
    provider_payload_exposed: false,
    live_provider_calls_enabled: context.live_provider_calls_enabled,
    ai_calls_enabled: context.ai_calls_enabled,
    persistence_enabled: false,
    arr_writes_enabled: false,
    cache_mutation_enabled: false,
    execution_switch: sanitizeExecutionSwitch(executionSwitch),
    requested_field_count: FIELD_ORDER.length,
    eligible_sample_count: source?.eligible_sample_count || 0,
    preview_limit: Math.min(MAX_PREVIEW_ITEMS, asArray(samples).length),
    previewed_count: 0,
    improved_sample_count: 0,
    improved_field_count: 0,
    items: [],
    reason_codes: [
      source?.status === 'ready' ? 'adapter_contract:ready' : `adapter_contract:${source?.status || 'missing'}`,
      context.live_provider_calls_enabled ? 'execution:live_provider_calls_enabled' : 'execution:live_provider_calls_disabled',
    ].slice(0, 8),
  };
}

async function previewSample({ row, index, fetchMovieDetails }) {
  const tmdbId = positiveIntegerOrNull(row.tmdb_id);
  const mediaType = normalizeMediaType(row.media_type);

  if (!tmdbId || !mediaType) {
    return {
      sample_id: index + 1,
      status: 'insufficient_identity',
      available_fields: [],
      improved_fields: [],
      field_counts: { genres: 0, keywords: 0, studios: 0 },
      reason_codes: [
        tmdbId ? 'identity:tmdb_available' : 'identity:tmdb_missing',
        mediaType ? `media_type:${mediaType}` : 'media_type:missing',
      ],
    };
  }

  if (typeof fetchMovieDetails !== 'function') {
    return {
      sample_id: index + 1,
      status: 'unavailable',
      available_fields: [],
      improved_fields: [],
      field_counts: { genres: 0, keywords: 0, studios: 0 },
      reason_codes: ['provider_fetcher:not_configured'],
    };
  }

  try {
    const payload = await fetchMovieDetails({
      tmdbId,
      mediaType,
      appendToResponse: TMDB_APPEND_TO_RESPONSE,
    });
    const normalizedPayload = normalizeTmdbMetadataPayload(payload);
    const improvedFields = buildImprovedFields(row, normalizedPayload);

    return {
      sample_id: index + 1,
      status: 'ready',
      available_fields: normalizedPayload.available_fields,
      improved_fields: improvedFields,
      field_counts: normalizedPayload.field_counts,
      reason_codes: [
        `media_type:${mediaType}`,
        'provider_payload:sanitized',
        improvedFields.length > 0 ? 'enrichment:would_improve' : 'enrichment:no_missing_fields_improved',
      ],
    };
  } catch {
    return {
      sample_id: index + 1,
      status: 'provider_error',
      available_fields: [],
      improved_fields: [],
      field_counts: { genres: 0, keywords: 0, studios: 0 },
      reason_codes: ['provider:error_suppressed'],
    };
  }
}

export async function buildPolicyIntentReplayTmdbMetadataAdapterPreview({
  samples = [],
  adapterContract = null,
  context = createPolicyIntentReplayEnrichmentAdapterContext(),
  fetchMovieDetails = null,
  executionSwitch = null,
} = {}) {
  const normalizedContext = context || createPolicyIntentReplayEnrichmentAdapterContext();
  const preview = basePreview({
    adapterContract,
    context: normalizedContext,
    samples,
    executionSwitch,
  });

  try {
    normalizedContext.assertSourceAllowed(POLICY_INTENT_REPLAY_TMDB_METADATA_SOURCE, {
      adapter: POLICY_INTENT_REPLAY_TMDB_METADATA_ADAPTER_MODE,
    });
  } catch (error) {
    if (error instanceof PolicyIntentReplayEnrichmentAdapterBlockedError) {
      return {
        ...preview,
        status: 'blocked',
        reason_codes: [
          ...preview.reason_codes,
          error.details?.reason || 'adapter:blocked',
        ].slice(0, 8),
      };
    }
    throw error;
  }

  const source = sourceFromContract(adapterContract);
  if (source?.status !== 'ready') {
    return {
      ...preview,
      status: 'unavailable',
      reason_codes: [
        ...preview.reason_codes,
        'adapter_contract:not_ready',
      ].slice(0, 8),
    };
  }

  if (source?.quota_safe !== true || source?.cooldown_active === true) {
    return {
      ...preview,
      status: 'unavailable',
      reason_codes: [
        ...preview.reason_codes,
        source?.cooldown_active === true ? 'provider:cooldown_active' : 'provider:quota_unavailable',
      ].slice(0, 8),
    };
  }

  const items = [];
  for (const [index, row] of asArray(samples).slice(0, MAX_PREVIEW_ITEMS).entries()) {
    items.push(await previewSample({
      row,
      index,
      fetchMovieDetails,
    }));
  }

  const improvedSampleCount = items.filter(item => item.improved_fields.length > 0).length;
  const improvedFieldCount = items.reduce((sum, item) => sum + item.improved_fields.length, 0);

  return {
    ...preview,
    status: items.length > 0 ? 'ready' : 'not_needed',
    previewed_count: items.length,
    improved_sample_count: improvedSampleCount,
    improved_field_count: improvedFieldCount,
    items,
    reason_codes: [
      ...preview.reason_codes,
      items.length > 0 ? 'preview:bounded_items' : 'preview:no_samples',
    ].slice(0, 8),
  };
}
