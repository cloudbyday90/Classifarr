/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { evaluatePresetSignals } from './policyEngineSignalScoring.mjs';
import {
  FORMULA_CONFIDENCE_CAP,
  normalizeCombinationMode,
  normalizePresetAttachmentWeight,
} from './policyEngineUtils.mjs';
import { POLICY_INTENT_DRAFT_BUCKETS } from './policyIntentRequestValidator.mjs';

export const POLICY_INTENT_REPLAY_ENGINE_COMPARISON_SCHEMA_VERSION = 1;
export const POLICY_INTENT_REPLAY_ENGINE_COMPARISON_MODE = 'deterministic_policy_engine_preview';

const MAX_REASONS = 8;
const STRING_LIMIT = 120;
const ARRAY_KEYS = Object.freeze(['require_all', 'require_any', 'include', 'prefer', 'exclude']);
const SCALAR_KEYS = Object.freeze(['mode', 'max', 'min', 'min_minutes', 'max_minutes', 'strict', 'semantics']);
const SIGNAL_TYPE_ALIASES = Object.freeze({
  ratings: 'certifications',
});

const POSITIVE_BUCKETS = Object.freeze([
  POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
  POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY,
  POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS,
]);

const BLOCKING_BUCKETS = Object.freeze([
  POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS,
  POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS,
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

function boundedNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.round(Math.max(0, Math.min(FORMULA_CONFIDENCE_CAP, numeric)) * 100) / 100;
}

function normalizeSignalType(value) {
  const normalized = boundedString(value, null, 80);
  return SIGNAL_TYPE_ALIASES[normalized] || normalized;
}

function normalizeList(values = []) {
  const seen = new Set();
  const normalized = [];

  for (const value of asArray(values)) {
    const text = boundedString(value);
    if (!text) {
      continue;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(text);
  }

  return normalized.slice(0, 50);
}

function normalizeEntryValues(entry = {}, bucketName = null) {
  const values = asObject(entry.values);
  const metadata = asObject(entry.metadata);
  const config = {};

  for (const key of ARRAY_KEYS) {
    const list = normalizeList(values[key]);
    if (list.length > 0) {
      config[key] = list;
    }
  }

  for (const key of SCALAR_KEYS) {
    if (values[key] !== undefined) {
      config[key] = values[key];
    }
  }

  if (
    bucketName === POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS
    && config.exclude?.length > 0
    && !config.mode
  ) {
    config.mode = 'exclude';
  }

  if (metadata.semantics) {
    config.semantics = metadata.semantics;
  } else if (bucketName === POLICY_INTENT_DRAFT_BUCKETS.IDENTITY) {
    config.semantics = 'identity';
  } else if (
    bucketName === POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY
    || bucketName === POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS
  ) {
    config.semantics = 'compatibility';
  }

  if (bucketName === POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS) {
    config.strict = true;
  }

  return config;
}

function mergeSignalConfig(target = {}, source = {}) {
  const merged = { ...target };

  for (const key of ARRAY_KEYS) {
    const values = normalizeList([asArray(target[key]), asArray(source[key])].flat());
    if (values.length > 0) {
      merged[key] = values;
    }
  }

  for (const key of SCALAR_KEYS) {
    if (source[key] !== undefined) {
      merged[key] = source[key];
    }
  }

  return merged;
}

function entriesForPresetBucket(preset = {}, bucketName) {
  return asArray(preset?.buckets?.[bucketName]);
}

export function buildPolicyEngineSignalsFromIntentEntries(entries = [], { bucketName = null } = {}) {
  const signals = {};

  for (const entry of asArray(entries)) {
    const signalType = normalizeSignalType(entry?.signal_type);
    if (!signalType) {
      continue;
    }

    const config = normalizeEntryValues(entry, bucketName);
    if (Object.keys(config).length === 0) {
      continue;
    }

    signals[signalType] = mergeSignalConfig(signals[signalType], config);
  }

  return signals;
}

function positiveEntriesForPreset(preset = {}) {
  return POSITIVE_BUCKETS.flatMap((bucketName) => entriesForPresetBucket(preset, bucketName)
    .map((entry) => ({ entry, bucketName })));
}

function blockingEntriesForPreset(preset = {}) {
  return BLOCKING_BUCKETS.flatMap((bucketName) => entriesForPresetBucket(preset, bucketName)
    .map((entry) => ({ entry, bucketName })));
}

function buildPositiveSignals(preset = {}) {
  const signals = {};

  for (const { entry, bucketName } of positiveEntriesForPreset(preset)) {
    const partial = buildPolicyEngineSignalsFromIntentEntries([entry], { bucketName });
    for (const [signalType, config] of Object.entries(partial)) {
      signals[signalType] = mergeSignalConfig(signals[signalType], config);
    }
  }

  return signals;
}

function buildBlockingSignal(entry, bucketName) {
  return buildPolicyEngineSignalsFromIntentEntries([entry], { bucketName });
}

function hasReplayEvidence(item = {}) {
  const fields = asArray(item.evidence?.fields);
  return fields.some((field) => field !== 'title');
}

function countSignalFields(signals = {}) {
  return Object.keys(signals).length;
}

function reasonForBlockingEntry(entry = {}, bucketName = null) {
  const signalType = normalizeSignalType(entry.signal_type) || 'signal';
  const bucket = boundedString(bucketName, 'bucket', 80);
  return `${bucket}:${signalType}`;
}

function entryHasRelevantItemEvidence(entry = {}, item = {}) {
  const signalType = normalizeSignalType(entry.signal_type);

  switch (signalType) {
    case 'certifications':
      return Boolean(item.certification);
    case 'genres':
      return asArray(item.genres).length > 0;
    case 'keywords':
      return asArray(item.keywords).length > 0 || Boolean(item.overview);
    case 'studios':
      return asArray(item.studios).length > 0 || asArray(item.production_companies).length > 0;
    case 'language':
      return Boolean(item.original_language);
    case 'media_type':
      return Boolean(item.media_type);
    case 'release_year':
      return Number.isFinite(Number(item.year));
    case 'vote_average':
      return Number.isFinite(Number(item.rating)) || Number.isFinite(Number(item.vote_average));
    case 'runtime':
      return Number.isFinite(Number(item.runtime));
    default:
      return false;
  }
}

function scorePresetSignals(signals = {}, item = {}) {
  if (Object.keys(signals).length === 0) {
    return 0;
  }

  return boundedNumber(evaluatePresetSignals(signals, item));
}

function scorePositivePresets(presets = [], item = {}, combinationMode = 'best_match') {
  const scores = [];

  for (const preset of asArray(presets)) {
    const signals = buildPositiveSignals(preset);
    const signalCount = countSignalFields(signals);
    if (signalCount === 0) {
      continue;
    }

    scores.push({
      score: scorePresetSignals(signals, item),
      weight: normalizePresetAttachmentWeight(preset.weight),
      signal_count: signalCount,
    });
  }

  if (scores.length === 0) {
    return {
      score: 0,
      scored_preset_count: 0,
      positive_signal_count: 0,
    };
  }

  const mode = normalizeCombinationMode(combinationMode);
  let score = 0;

  if (mode === 'best_match') {
    score = Math.max(...scores.map((entry) => entry.score));
  } else if (mode === 'average') {
    score = scores.reduce((sum, entry) => sum + entry.score, 0) / scores.length;
  } else if (mode === 'require_all' && scores.some((entry) => entry.score <= 0)) {
    score = 0;
  } else {
    const totalWeight = scores.reduce((sum, entry) => sum + entry.weight, 0);
    const weightedScore = scores.reduce((sum, entry) => sum + (entry.score * entry.weight), 0);
    score = totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  return {
    score: boundedNumber(score),
    scored_preset_count: scores.length,
    positive_signal_count: scores.reduce((sum, entry) => sum + entry.signal_count, 0),
  };
}

function collectBlockingReasons(presets = [], item = {}) {
  const reasons = [];
  let blockingSignalCount = 0;

  for (const preset of asArray(presets)) {
    for (const { entry, bucketName } of blockingEntriesForPreset(preset)) {
      const signals = buildBlockingSignal(entry, bucketName);
      if (countSignalFields(signals) === 0) {
        continue;
      }

      blockingSignalCount += countSignalFields(signals);
      if (!entryHasRelevantItemEvidence(entry, item)) {
        continue;
      }

      if (scorePresetSignals(signals, item) === 0) {
        reasons.push(reasonForBlockingEntry(entry, bucketName));
      }
    }
  }

  return {
    blocker_count: reasons.length,
    blocking_signal_count: blockingSignalCount,
    blockers: normalizeList(reasons).slice(0, MAX_REASONS),
  };
}

function fitForPolicyEngineComparison({ score, evidenceAvailable, blockerCount, positiveSignalCount }) {
  if (blockerCount > 0) {
    return 'blocked';
  }

  if (!evidenceAvailable || positiveSignalCount === 0) {
    return 'insufficient';
  }

  return score >= 70 ? 'strong' : 'review';
}

export function buildPolicyIntentReplayEngineComparison({
  payload,
  item,
  combinationMode = 'best_match',
} = {}) {
  const presets = asArray(payload?.policyIntentDraft?.presets);
  const evidenceAvailable = hasReplayEvidence(item);
  const positive = scorePositivePresets(presets, item, combinationMode);
  const blocking = collectBlockingReasons(presets, item);
  const fit = fitForPolicyEngineComparison({
    score: positive.score,
    evidenceAvailable,
    blockerCount: blocking.blocker_count,
    positiveSignalCount: positive.positive_signal_count,
  });

  return {
    schema_version: POLICY_INTENT_REPLAY_ENGINE_COMPARISON_SCHEMA_VERSION,
    mode: POLICY_INTENT_REPLAY_ENGINE_COMPARISON_MODE,
    enabled: true,
    policy_engine_score: positive.score,
    policy_engine_fit: fit,
    evidence_available: evidenceAvailable,
    preset_count: presets.length,
    scored_preset_count: positive.scored_preset_count,
    positive_signal_count: positive.positive_signal_count,
    blocking_signal_count: blocking.blocking_signal_count,
    blocker_count: blocking.blocker_count,
    blockers: blocking.blockers,
  };
}
