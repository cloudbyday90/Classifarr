/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { POLICY_INTENT_DRAFT_BUCKETS } from './policyIntentRequestValidator.mjs';
import {
  buildPolicyIntentReplayExecutionSummary,
  createPolicyIntentReplayExecutionContext,
} from './policyIntentReplayExecutionContext.mjs';

export const POLICY_INTENT_REPLAY_SCORING_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_SCORING_MODE = 'deterministic_signal_fit';

const MAX_ITEMS = 25;
const MAX_MATCHES = 8;
const STRING_LIMIT = 120;

const CERTIFICATION_ORDER = Object.freeze([
  'G',
  'TV-Y',
  'TV-G',
  'PG',
  'TV-PG',
  'PG-13',
  'TV-14',
  'R',
  'TV-MA',
  'NC-17',
]);

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

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];

  for (const value of values.flat(Infinity)) {
    const normalized = boundedString(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }

  return result.slice(0, MAX_MATCHES);
}

function normalizeToken(value) {
  return boundedString(value, '', STRING_LIMIT).toLowerCase();
}

function normalizeCertification(value) {
  const normalized = boundedString(value, null, 40);
  return normalized ? normalized.toUpperCase() : null;
}

function certificationRank(value) {
  const normalized = normalizeCertification(value);
  if (!normalized) {
    return null;
  }

  const index = CERTIFICATION_ORDER.indexOf(normalized);
  return index >= 0 ? index : null;
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

function metadataList(metadata, keys = []) {
  return keys.flatMap((key) => asArray(metadata[key]));
}

function extractSampleFeatures(sample = {}) {
  const metadata = parseMetadata(sample.metadata);
  const genres = uniqueStrings([
    asArray(sample.genre_names),
    metadataList(metadata, ['genres', 'genre_names']),
  ]);
  const keywords = uniqueStrings(metadataList(metadata, ['keywords', 'keyword_names', 'tags']));
  const studios = uniqueStrings(metadataList(metadata, ['studios', 'production_companies']));
  const languages = uniqueStrings([
    sample.original_language,
    metadata.original_language,
    metadata.language,
  ]);
  const rating = normalizeCertification(
    metadata.rating
      || metadata.certification
      || metadata.content_rating
      || metadata.normalized_rating
  );

  return {
    title: boundedString(sample.title, 'Unknown title', 160),
    media_type: boundedString(sample.media_type, null, 20),
    year: Number.isFinite(Number(sample.year)) ? Number(sample.year) : null,
    rating,
    genres,
    keywords,
    studios,
    languages,
    has_evidence: Boolean(
      rating
        || genres.length
        || keywords.length
        || studios.length
        || languages.length
        || sample.media_type
        || sample.year
    ),
  };
}

function entriesForBucket(payload, bucketName) {
  return asArray(payload?.policyIntentDraft?.presets)
    .flatMap((preset) => asArray(preset?.buckets?.[bucketName]));
}

function valuesForEntry(entry = {}) {
  return asObject(entry.values);
}

function listValues(values = {}, keys = []) {
  return uniqueStrings(keys.flatMap((key) => asArray(values[key])));
}

function matchAny(configuredValues = [], sampleValues = []) {
  const sampleTokens = new Set(sampleValues.map(normalizeToken).filter(Boolean));
  return configuredValues.filter((value) => sampleTokens.has(normalizeToken(value)));
}

function keywordMatches(configuredValues = [], sampleValues = []) {
  const sampleText = sampleValues.map(normalizeToken).join(' ');
  return configuredValues.filter((value) => {
    const token = normalizeToken(value);
    return token && sampleText.includes(token);
  });
}

function matchEntry(entry = {}, features = {}) {
  const signalType = boundedString(entry.signal_type, null, 80);
  const values = valuesForEntry(entry);
  const configured = listValues(values, ['require_all', 'require_any', 'include', 'prefer', 'exclude']);

  switch (signalType) {
    case 'genres':
      return matchAny(configured, features.genres);
    case 'keywords':
      return keywordMatches(configured, [
        ...features.keywords,
        features.title,
      ]);
    case 'studios':
      return keywordMatches(configured, features.studios);
    case 'language':
      return matchAny(configured, features.languages);
    case 'media_type':
      return values.include?.includes(features.media_type) ? [features.media_type] : [];
    case 'certifications':
    case 'ratings':
      return features.rating && configured.map(normalizeCertification).includes(features.rating)
        ? [features.rating]
        : [];
    case 'release_year': {
      if (features.year === null) {
        return [];
      }
      const min = Number(values.min);
      const max = Number(values.max);
      if (Number.isFinite(min) && features.year < min) {
        return [];
      }
      if (Number.isFinite(max) && features.year > max) {
        return [];
      }
      return [String(features.year)];
    }
    default:
      return [];
  }
}

function entryRequirementMiss(entry = {}, features = {}) {
  const signalType = boundedString(entry.signal_type, null, 80);
  const values = valuesForEntry(entry);

  if (signalType === 'certifications' && values.mode === 'max') {
    const maxRank = certificationRank(values.max);
    const itemRank = certificationRank(features.rating);
    if (maxRank === null || itemRank === null) {
      return null;
    }
    return itemRank > maxRank ? `certifications:max:${boundedString(values.max, 'unknown')}` : null;
  }

  if (signalType === 'release_year') {
    if (features.year === null) {
      return null;
    }
    const min = Number(values.min);
    const max = Number(values.max);
    if (Number.isFinite(min) && features.year < min) {
      return `release_year:min:${min}`;
    }
    if (Number.isFinite(max) && features.year > max) {
      return `release_year:max:${max}`;
    }
  }

  const required = listValues(values, ['require_all', 'require_any', 'include']);
  if (required.length === 0) {
    return null;
  }

  return matchEntry(entry, features).length > 0
    ? null
    : `${signalType}:required`;
}

function exclusionHit(entry = {}, features = {}) {
  const values = valuesForEntry(entry);
  const excluded = listValues(values, ['exclude']);
  if (excluded.length === 0) {
    return null;
  }

  const matches = matchEntry({
    ...entry,
    values: {
      ...values,
      require_any: excluded,
      include: excluded,
      prefer: excluded,
    },
  }, features);

  if (matches.length === 0) {
    return null;
  }

  return `${boundedString(entry.signal_type, 'signal')}:${matches[0]}`;
}

function summarizeBucket(entries = [], features = {}) {
  const matched = [];
  const unmatched = [];

  for (const entry of entries) {
    const signalType = boundedString(entry.signal_type, 'signal', 80);
    const matches = matchEntry(entry, features);
    if (matches.length > 0) {
      matched.push(...matches.map((match) => `${signalType}:${match}`));
    } else {
      unmatched.push(signalType);
    }
  }

  return {
    configured_count: entries.length,
    matched: uniqueStrings(matched),
    unmatched: uniqueStrings(unmatched),
  };
}

function scoreSample(sample = {}, sampleIndex = 0, payload = {}) {
  const features = extractSampleFeatures(sample);
  const identityEntries = entriesForBucket(payload, POLICY_INTENT_DRAFT_BUCKETS.IDENTITY);
  const compatibilityEntries = entriesForBucket(payload, POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY);
  const boosterEntries = entriesForBucket(payload, POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS);
  const strictEntries = entriesForBucket(payload, POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS);
  const exclusionEntries = entriesForBucket(payload, POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS);

  const strict_misses = strictEntries
    .map((entry) => entryRequirementMiss(entry, features))
    .filter(Boolean)
    .slice(0, MAX_MATCHES);
  const exclusion_hits = exclusionEntries
    .map((entry) => exclusionHit(entry, features))
    .filter(Boolean)
    .slice(0, MAX_MATCHES);

  const identity = summarizeBucket(identityEntries, features);
  const compatibility = summarizeBucket(compatibilityEntries, features);
  const boosters = summarizeBucket(boosterEntries, features);
  const blocked = strict_misses.length > 0 || exclusion_hits.length > 0;
  const positiveMatchCount = identity.matched.length + compatibility.matched.length + boosters.matched.length;
  const draft_signal_fit = blocked
    ? 'blocked'
    : !features.has_evidence
      ? 'insufficient'
      : identity.configured_count > 0 && identity.matched.length === 0
        ? 'review'
        : positiveMatchCount > 0
          ? 'strong'
          : 'review';

  const recommendation = {
    strong: 'would_remain_candidate',
    review: 'would_need_review',
    blocked: 'would_be_blocked',
    insufficient: 'insufficient_evidence',
  }[draft_signal_fit];

  return {
    sample_id: sampleIndex + 1,
    draft_signal_fit,
    recommendation,
    evidence_available: features.has_evidence,
    matched: {
      identity: identity.matched,
      compatibility: compatibility.matched,
      boosters: boosters.matched,
    },
    missing_required: strict_misses,
    exclusion_hits,
  };
}

export function buildPolicyIntentReplayScoring({
  payload,
  samples = [],
  executionContext = createPolicyIntentReplayExecutionContext(),
} = {}) {
  const boundedSamples = asArray(samples).slice(0, MAX_ITEMS);
  const items = boundedSamples.map((sample, index) => scoreSample(sample, index, payload));
  const executionSummary = buildPolicyIntentReplayExecutionSummary(executionContext);

  return {
    schema_version: POLICY_INTENT_REPLAY_SCORING_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_SCORING_MODE,
    enabled: true,
    ...executionSummary,
    sample_count: items.length,
    scored_count: items.filter((item) => item.draft_signal_fit !== 'insufficient').length,
    strong_fit_count: items.filter((item) => item.draft_signal_fit === 'strong').length,
    review_count: items.filter((item) => item.draft_signal_fit === 'review').length,
    blocked_count: items.filter((item) => item.draft_signal_fit === 'blocked').length,
    insufficient_count: items.filter((item) => item.draft_signal_fit === 'insufficient').length,
    items,
  };
}
