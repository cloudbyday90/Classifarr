/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { projectFreshPolicyConfiguration } from './freshInventoryPolicyRuntime.mjs';

const digest = /^[a-f0-9]{64}$/;
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const boundedText = (value, max) => typeof value === 'string' && value.length <= max;
const optionalText = (value, max) => value === null || boundedText(value, max);

function safeJson(value, depth = 0) {
  if (depth > 8) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1_000_000_000;
  if (typeof value === 'string') return value.length <= 5_000;
  if (Array.isArray(value)) return value.length <= 100 && value.every(entry => safeJson(entry, depth + 1));
  return value !== null && typeof value === 'object' && Object.keys(value).length <= 100 &&
    Object.keys(value).every(key => key.length <= 200 && !['__proto__', 'prototype', 'constructor'].includes(key) &&
      safeJson(value[key], depth + 1));
}

function validateMetadata(value, mediaType) {
  if (!exact(value, ['media_type', 'title', 'year', 'overview', 'genres', 'keywords', 'studio',
    'certification', 'original_language']) || value.media_type !== mediaType ||
    !boundedText(value.title, 500) || !value.title.trim() || !boundedText(value.overview, 10_000) ||
    !(value.year === null || Number.isInteger(value.year) && value.year >= 1800 && value.year <= 2200) ||
    ![value.studio, value.certification, value.original_language].every(entry => optionalText(entry, 200)) ||
    ![value.genres, value.keywords].every(entries => Array.isArray(entries) && entries.length <= 64 &&
      entries.every(entry => boundedText(entry, 200)))) throw new Error('frozen_policy_metadata_invalid');
  return value;
}

function validateDistribution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 200 ||
      Object.entries(value).some(([key, amount]) => key.length > 200 ||
        ['__proto__', 'constructor', 'prototype'].includes(key) ||
        !Number.isFinite(amount) || amount < 0 || amount > 100)) {
    throw new Error('frozen_policy_distribution_invalid');
  }
  return value;
}

function validateFold(fold) {
  if (!exact(fold, ['foldIndex', 'mediaType', 'heldDescriptionFingerprint', 'profiles']) ||
      !Number.isInteger(fold.foldIndex) || fold.foldIndex < 0 || fold.foldIndex > 99 ||
      !['movie', 'tv'].includes(fold.mediaType) || !digest.test(fold.heldDescriptionFingerprint) ||
      !Array.isArray(fold.profiles) || fold.profiles.length > 64) throw new Error('frozen_policy_fold_invalid');
  const ids = new Set();
  for (const entry of fold.profiles) {
    if (!exact(entry, ['libraryId', 'profile']) || !positiveId(entry.libraryId) || ids.has(entry.libraryId) ||
        !exact(entry.profile, ['media_type', 'rating_distribution', 'genre_distribution', 'keyword_distribution']) ||
        entry.profile.media_type !== fold.mediaType) throw new Error('frozen_policy_profile_invalid');
    ids.add(entry.libraryId);
    validateDistribution(entry.profile.rating_distribution);
    validateDistribution(entry.profile.genre_distribution);
    validateDistribution(entry.profile.keyword_distribution);
  }
  return fold;
}

function validatePoliciesAndFolds(input) {
  if (!Array.isArray(input.policies) || input.policies.length < 1 || input.policies.length > 64 ||
      !Array.isArray(input.folds) || input.folds.length < 1 || input.folds.length > 100 ||
      !Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 300 ||
      JSON.stringify(input).length > 8_000_000) throw new Error('frozen_policy_input_invalid');
  const policyIds = new Set();
  for (const policy of input.policies) {
    if (!positiveId(policy?.id) || !positiveId(policy?.library_id) || policyIds.has(policy.id) ||
        !boundedText(policy.name, 200) || !boundedText(policy.library_name, 200) ||
        !['movie', 'tv'].includes(policy.library_media_type) || !safeJson(policy) ||
        Object.keys(projectFreshPolicyConfiguration(policy)).length !== Object.keys(policy).length) {
      throw new Error('frozen_policy_configuration_invalid');
    }
    policyIds.add(policy.id);
  }
  const folds = new Set();
  for (const fold of input.folds) {
    validateFold(fold);
    const key = `${fold.foldIndex}:${fold.mediaType}`;
    if (folds.has(key)) throw new Error('frozen_policy_fold_duplicate');
    folds.add(key);
  }
  return folds;
}

/** A private fold-local scoring input. Labels are stripped before any worker is invoked. */
export function validateFrozenPolicyInput(input) {
  if (!exact(input, ['version', 'sourceFingerprint', 'sampleFingerprint', 'provenance',
    'eligibleCorrections', 'policies', 'folds', 'cases']) ||
      input.version !== 2 || !digest.test(input.sourceFingerprint) || !digest.test(input.sampleFingerprint) ||
      input.provenance !== 'temporally_screened_operator_corrections' ||
      !Number.isSafeInteger(input.eligibleCorrections) || input.eligibleCorrections < input.cases?.length ||
      input.eligibleCorrections > 1_000_000) throw new Error('frozen_policy_input_invalid');
  const folds = validatePoliciesAndFolds(input);
  for (const row of input.cases) {
    if (!exact(row, ['mediaType', 'labelLibraryId', 'foldIndex', 'metadata']) ||
        !['movie', 'tv'].includes(row.mediaType) || !positiveId(row.labelLibraryId) ||
        !Number.isInteger(row.foldIndex) || !folds.has(`${row.foldIndex}:${row.mediaType}`)) {
      throw new Error('frozen_policy_case_invalid');
    }
    validateMetadata(row.metadata, row.mediaType);
  }
  return input;
}

/** Defense in depth at the container boundary: no labels or unbounded content. */
export function validateFrozenPolicyWorkerInput(input) {
  if (!exact(input, ['version', 'policies', 'folds', 'cases']) || input.version !== 2) {
    throw new Error('frozen_policy_worker_input_invalid');
  }
  const folds = validatePoliciesAndFolds(input);
  for (const row of input.cases) {
    if (!exact(row, ['mediaType', 'foldIndex', 'metadata']) || !['movie', 'tv'].includes(row.mediaType) ||
        !Number.isInteger(row.foldIndex) || !folds.has(`${row.foldIndex}:${row.mediaType}`)) {
      throw new Error('frozen_policy_worker_case_invalid');
    }
    validateMetadata(row.metadata, row.mediaType);
  }
  return input;
}

export const fingerprintFrozenPolicyInput = input => createHash('sha256')
  .update(JSON.stringify(validateFrozenPolicyInput(input))).digest('hex');

export function projectFrozenPolicyWorkerInput(input) {
  const validated = validateFrozenPolicyInput(input);
  return { version: 2, policies: validated.policies, folds: validated.folds,
    cases: validated.cases.map(({ mediaType, foldIndex, metadata }) => ({ mediaType, foldIndex, metadata })) };
}
