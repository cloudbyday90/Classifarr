/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const POLICY_INTENT_REPLAY_ITEM_SCHEMA_VERSION = 1;

const MAX_LIST_ITEMS = 25;
const STRING_LIMIT = 160;
const ALLOWED_MEDIA_TYPES = new Set(['movie', 'tv']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function boundedString(value, fallback = null, maxLength = STRING_LIMIT) {
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
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function integerOrNull(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isInteger(numeric) ? numeric : null;
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

function normalizeMediaType(value) {
  const normalized = boundedString(value, null, 20);
  return ALLOWED_MEDIA_TYPES.has(normalized) ? normalized : null;
}

function extractNamedValue(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return boundedString(value);
  }

  const object = asObject(value);
  return boundedString(
    object.name
      || object.title
      || object.value
      || object.label
      || object.keyword
      || object.iso_639_1
      || object.iso_3166_1
  );
}

function uniqueList(values = []) {
  const seen = new Set();
  const result = [];

  for (const value of values.flat(Infinity)) {
    const normalized = extractNamedValue(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result.slice(0, MAX_LIST_ITEMS);
}

function firstString(...values) {
  for (const value of values) {
    const normalized = boundedString(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function listFromMetadata(metadata, keys = []) {
  return keys.flatMap((key) => asArray(metadata[key]));
}

function buildEvidenceFields(item = {}) {
  const fields = [];
  if (item.title) fields.push('title');
  if (item.year !== null) fields.push('year');
  if (item.media_type) fields.push('media_type');
  if (item.certification) fields.push('certification');
  if (item.genres.length > 0) fields.push('genres');
  if (item.keywords.length > 0) fields.push('keywords');
  if (item.studios.length > 0) fields.push('studios');
  if (item.original_language) fields.push('original_language');
  if (item.overview) fields.push('overview');
  if (item.runtime !== null) fields.push('runtime');
  if (item.vote_average !== null) fields.push('vote_average');
  return fields;
}

export function buildPolicyIntentReplayItemFromHistoryRow(row = {}) {
  const metadata = parseMetadata(row.metadata);
  const genres = uniqueList([
    asArray(row.genre_names),
    listFromMetadata(metadata, ['genres', 'genre_names']),
  ]);
  const keywords = uniqueList(listFromMetadata(metadata, [
    'keywords',
    'keyword_names',
    'tags',
  ]));
  const studios = uniqueList([
    row.primary_studio_name,
    listFromMetadata(metadata, [
      'studios',
      'production_companies',
      'networks',
    ]),
  ]);
  const certification = firstString(
    metadata.rating,
    metadata.certification,
    metadata.content_rating,
    metadata.normalized_rating,
    metadata.mpaa_rating
  );
  const voteAverage = numberOrNull(
    metadata.vote_average
      ?? metadata.rating_value
      ?? metadata.tmdb_rating
      ?? metadata.imdb_rating
  );
  const item = {
    schema_version: POLICY_INTENT_REPLAY_ITEM_SCHEMA_VERSION,
    source: 'classification_history',
    title: boundedString(row.title, 'Unknown title', 500),
    year: integerOrNull(row.year ?? metadata.year),
    media_type: normalizeMediaType(row.media_type ?? metadata.media_type),
    certification,
    genres,
    keywords,
    studios,
    production_companies: studios,
    primary_studio_name: studios[0] || null,
    original_language: firstString(
      metadata.original_language,
      metadata.language,
      metadata.originalLanguage
    ),
    overview: boundedString(metadata.overview, '', 2000) || '',
    runtime: numberOrNull(metadata.runtime ?? metadata.runtime_minutes),
    vote_average: voteAverage,
    rating: voteAverage,
  };

  return {
    ...item,
    evidence: {
      available: buildEvidenceFields(item).length > 0,
      fields: buildEvidenceFields(item),
    },
  };
}

export function buildPolicyIntentReplayItemsFromHistoryRows(rows = []) {
  return asArray(rows).map((row) => buildPolicyIntentReplayItemFromHistoryRow(row));
}
