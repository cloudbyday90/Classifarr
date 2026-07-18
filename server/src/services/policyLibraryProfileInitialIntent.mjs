/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
  validatePolicyIntentContract,
} from './policyIntentSchema.mjs';

const POLICY_LIBRARY_PROFILE_INITIAL_INTENT_VERSION =
  'policy.library_profile_initial_intent.v1';
const POLICY_LIBRARY_PROFILE_INITIAL_INTENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PURPOSE_GENRES = 5;
const MAX_HELPFUL_STUDIOS = 3;
const MAX_LABEL_LENGTH = 120;

const POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS = Object.freeze({
  READY: 'ready',
  PROFILE_MISSING: 'profile_missing',
  PROFILE_STALE: 'profile_stale',
  PROFILE_INSUFFICIENT: 'profile_insufficient',
});

const POLICY_LIBRARY_PROFILE_INITIAL_INTENT_REASON_IDS = Object.freeze({
  READY: 'library_profile_initial_intent_ready',
  PROFILE_MISSING: 'library_profile_missing',
  PROFILE_STALE: 'library_profile_stale',
  PROFILE_INSUFFICIENT: 'library_profile_insufficient',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseObject(value) {
  if (typeof value !== 'string') return asObject(value);

  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function normalizeLabel(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const normalized = String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized ? normalized.slice(0, MAX_LABEL_LENGTH) : null;
}

function normalizePercentage(value) {
  const percentage = Number(value);
  return Number.isFinite(percentage) && percentage > 0 && percentage <= 100
    ? Math.round(percentage * 100) / 100
    : null;
}

function normalizeItemCount(value) {
  const itemCount = Number(value);
  return Number.isInteger(itemCount) && itemCount > 0 ? itemCount : null;
}

function normalizeMediaType(value) {
  const mediaType = normalizeLabel(value)?.toLowerCase();
  return mediaType === 'movie' || mediaType === 'show' || mediaType === 'series'
    ? mediaType
    : null;
}

function normalizeGeneratedAt(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function listDistributionValues(value, limit) {
  return Object.entries(parseObject(value))
    .map(([label, percentage]) => ({
      label: normalizeLabel(label),
      percentage: normalizePercentage(percentage),
    }))
    .filter(entry => entry.label && entry.percentage !== null)
    .sort((left, right) => (
      right.percentage - left.percentage || left.label.localeCompare(right.label)
    ))
    .slice(0, limit)
    .map(entry => entry.label);
}

function buildSafeProfileSummary({ itemCount, generatedAt, genres, studios, mediaType }) {
  const profileFingerprint = createHash('sha256')
    .update(JSON.stringify({
      itemCount,
      generatedAt: generatedAt?.toISOString() ?? null,
      genreCount: genres.length,
      studioCount: studios.length,
      mediaType,
    }))
    .digest('hex');

  return {
    itemCount,
    generatedAt: generatedAt?.toISOString() ?? null,
    genreSignalCount: genres.length,
    studioSignalCount: studios.length,
    mediaType,
    profileFingerprint: `sha256:${profileFingerprint}`,
  };
}

function buildEmptyContract(policy = {}) {
  const contract = {
    schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: policy.id ?? null,
    library_id: policy.library_id ?? null,
    library_name: policy.library_name ?? null,
    library_media_type: policy.library_media_type ?? null,
    source: POLICY_INTENT_SOURCES.EMPTY,
    inference_state: POLICY_INTENT_INFERENCE_STATES.EMPTY,
    model: {
      mode: 'library_profile_initialization_pending',
      intent_supported: true,
      native_intent: false,
      conversion_available: false,
    },
    purpose: [],
    hard_limits: [],
    helpful_hints: [],
    avoid: [],
    review_behavior: {
      auto_classify_threshold: Number.isFinite(Number(policy.auto_classify_threshold))
        ? Number(policy.auto_classify_threshold)
        : null,
      prompt_threshold: Number.isFinite(Number(policy.prompt_threshold))
        ? Number(policy.prompt_threshold)
        : null,
      require_ai_validation: policy.require_ai_validation !== false,
      trust_patterns: policy.trust_patterns !== false,
      trust_rag: policy.trust_rag !== false,
      trust_history: policy.trust_history !== false,
      combination_mode: policy.combination_mode || 'best_match',
    },
    template_links: [],
    warnings: [],
    unsupported_signals: [],
  };

  return {
    ...contract,
    validation: validatePolicyIntentContract(contract),
  };
}

function buildReadyContract({ policy, genres, studios, mediaType, summary }) {
  const purpose = [];

  if (genres.length > 0) {
    purpose.push({
      intent_role: 'purpose',
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: genres },
      constraint_mode: 'advisory',
      semantics: 'identity',
      source: 'media_server_library_profile',
      inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    });
  }

  if (mediaType) {
    purpose.push({
      intent_role: 'purpose',
      signal_type: 'media_type',
      operator: 'require_any',
      values: { require_any: [mediaType] },
      constraint_mode: 'advisory',
      semantics: 'identity',
      source: 'media_server_library_profile',
      inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    });
  }

  const contract = {
    schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: policy.id ?? null,
    library_id: policy.library_id ?? null,
    library_name: policy.library_name ?? null,
    library_media_type: policy.library_media_type ?? null,
    source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    model: {
      mode: 'library_profile_initialization',
      intent_supported: true,
      native_intent: true,
      conversion_available: true,
      profile_fingerprint: summary.profileFingerprint,
    },
    purpose,
    hard_limits: [],
    helpful_hints: studios.length > 0 ? [{
      intent_role: 'helpful_hint',
      signal_type: 'studios',
      operator: 'prefer',
      values: { prefer: studios },
      constraint_mode: 'advisory',
      semantics: 'compatibility',
      source: 'media_server_library_profile',
      inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    }] : [],
    avoid: [],
    review_behavior: buildEmptyContract(policy).review_behavior,
    template_links: [],
    warnings: [],
    unsupported_signals: [],
  };

  return {
    ...contract,
    validation: validatePolicyIntentContract(contract),
  };
}

function buildPolicyLibraryProfileInitialIntentContract({ policy = {}, now = new Date() } = {}) {
  const profile = asObject(policy.libraryProfile ?? policy.library_profile);
  const itemCount = normalizeItemCount(profile.item_count ?? profile.itemCount);
  const generatedAt = normalizeGeneratedAt(profile.last_generated_at ?? profile.lastGeneratedAt);
  const genres = listDistributionValues(
    profile.genre_distribution ?? profile.genreDistribution,
    MAX_PURPOSE_GENRES,
  );
  const studios = listDistributionValues(
    profile.studio_distribution ?? profile.studioDistribution,
    MAX_HELPFUL_STUDIOS,
  );
  const mediaType = normalizeMediaType(
    profile.media_type ?? profile.mediaType ?? policy.library_media_type,
  );
  const summary = buildSafeProfileSummary({ itemCount, generatedAt, genres, studios, mediaType });

  let statusId = POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.READY;
  let reasonId = POLICY_LIBRARY_PROFILE_INITIAL_INTENT_REASON_IDS.READY;
  if (!itemCount || !generatedAt) {
    statusId = POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.PROFILE_MISSING;
    reasonId = POLICY_LIBRARY_PROFILE_INITIAL_INTENT_REASON_IDS.PROFILE_MISSING;
  } else if (new Date(now).getTime() - generatedAt.getTime() > POLICY_LIBRARY_PROFILE_INITIAL_INTENT_MAX_AGE_MS) {
    statusId = POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.PROFILE_STALE;
    reasonId = POLICY_LIBRARY_PROFILE_INITIAL_INTENT_REASON_IDS.PROFILE_STALE;
  } else if (genres.length === 0) {
    statusId = POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.PROFILE_INSUFFICIENT;
    reasonId = POLICY_LIBRARY_PROFILE_INITIAL_INTENT_REASON_IDS.PROFILE_INSUFFICIENT;
  }

  const ready = statusId === POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.READY;
  return {
    version: POLICY_LIBRARY_PROFILE_INITIAL_INTENT_VERSION,
    mode: 'library_profile_initialization',
    sourceId: 'media_server_library_profile',
    statusId,
    reasonId,
    ready,
    profile: summary,
    contract: ready
      ? buildReadyContract({ policy, genres, studios, mediaType, summary })
      : buildEmptyContract(policy),
  };
}

export {
  POLICY_LIBRARY_PROFILE_INITIAL_INTENT_MAX_AGE_MS,
  POLICY_LIBRARY_PROFILE_INITIAL_INTENT_REASON_IDS,
  POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS,
  POLICY_LIBRARY_PROFILE_INITIAL_INTENT_VERSION,
  buildPolicyLibraryProfileInitialIntentContract,
};
