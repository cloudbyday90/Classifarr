/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  normalizeOllamaModelDigest,
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS,
} from './ollamaVerificationCapabilityIdentity.mjs';
import {
  isOllamaVerificationCompatibilityMatrixAlternativeEligible,
} from './ollamaVerificationCompatibilityMatrixEligibility.mjs';

export const OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_VERSION =
  'ollama.verification_compatibility_matrix.v1';
export const OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_MAX_MODELS = 6;
export const OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_BUILD_ID_LENGTH = 12;

export const OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  UNAVAILABLE: 'unavailable',
  NO_LOCAL_MODELS: 'no_local_models',
  COMPLETED: 'completed',
});

const SAFE_MODEL_NAME_PATTERN = /^[\p{L}\p{N}._:/+-]{1,255}$/u;
const SAFE_VERSION_PATTERN = /^[0-9A-Za-z._-]{1,64}$/;
const SAFE_BUILD_ID_PATTERN = /^[a-f0-9]{12}$/i;
const ALLOWED_OUTCOME_STATUS_IDS = new Set([
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.VERIFICATION_READY,
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY,
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.UNAVAILABLE,
]);

/**
 * @typedef {{
 *   name?: unknown,
 *   buildId?: unknown,
 *   artifactSizeBytes?: unknown,
 *   family?: unknown,
 * }} OllamaVerificationCompatibilityMatrixModel
 */

/**
 * @typedef {{
 *   models?: readonly OllamaVerificationCompatibilityMatrixModel[],
 *   omittedModelCount?: unknown,
 *   skippedAlternativeModelCount?: unknown,
 *   configuredModelIncluded?: unknown,
 * }} OllamaVerificationCompatibilityMatrixSelection
 */

/**
 * @typedef {{
 *   modelName?: unknown,
 *   statusId?: unknown,
 *   checkedAt?: unknown,
 *   latencyMs?: unknown,
 * }} OllamaVerificationCompatibilityMatrixOutcome
 */

/**
 * @typedef {{
 *   stateId?: string,
 *   ollamaVersion?: unknown,
 *   selection?: OllamaVerificationCompatibilityMatrixSelection,
 *   outcomes?: OllamaVerificationCompatibilityMatrixOutcome[],
 * }} OllamaVerificationCompatibilityMatrixReportInput
 */

function normalizeSafeModelName(value) {
  const name = String(value ?? '').trim();
  return SAFE_MODEL_NAME_PATTERN.test(name) ? name : null;
}

function isCloudTaggedModel(name) {
  return /:cloud$/i.test(name);
}

function normalizeVersion(value) {
  const version = String(value ?? '').trim();
  return SAFE_VERSION_PATTERN.test(version) ? version : null;
}

function normalizeLatencyMs(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeNonnegativeSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function normalizeTimestamp(value) {
  const timestamp = value ? new Date(value) : null;
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : null;
}

function normalizeOutcomeStatusId(value) {
  return ALLOWED_OUTCOME_STATUS_IDS.has(value)
    ? value
    : OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.UNAVAILABLE;
}

function buildModelBuildId(digest) {
  const normalizedDigest = normalizeOllamaModelDigest(digest);
  return normalizedDigest
    ? normalizedDigest.slice(0, OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_BUILD_ID_LENGTH)
    : null;
}

function normalizeBuildId(value) {
  const buildId = String(value ?? '').trim().toLowerCase();
  return SAFE_BUILD_ID_PATTERN.test(buildId) ? buildId : null;
}

function compareModelNames(left, right) {
  return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });
}

/**
 * Selects a server-controlled, local-only workset. Tags ending in `:cloud`
 * are not eligible because a diagnostic must not introduce cloud usage.
 */
export function selectOllamaVerificationCompatibilityMatrixModels(models, configuredModel) {
  const localModelsByName = new Map();
  for (const model of Array.isArray(models) ? models : []) {
    const name = normalizeSafeModelName(model?.name);
    if (!name || isCloudTaggedModel(name)) continue;

    const dedupeKey = name.toLowerCase();
    if (!localModelsByName.has(dedupeKey)) {
      localModelsByName.set(dedupeKey, Object.freeze({
        name,
        buildId: buildModelBuildId(model?.digest),
        artifactSizeBytes: model?.size,
        family: model?.details?.family,
      }));
    }
  }

  const localModels = [...localModelsByName.values()].sort(compareModelNames);
  const configuredName = normalizeSafeModelName(configuredModel);
  const configuredMatch = configuredName
    ? localModels.find((model) => model.name.toLowerCase() === configuredName.toLowerCase())
    : null;
  const remainingModels = localModels.filter((model) => model !== configuredMatch);
  const eligibleAlternativeModels = remainingModels
    .filter(isOllamaVerificationCompatibilityMatrixAlternativeEligible);
  const selectedModels = [configuredMatch, ...eligibleAlternativeModels]
    .filter(Boolean)
    .slice(0, OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_MAX_MODELS);

  return Object.freeze({
    models: Object.freeze(selectedModels),
    omittedModelCount: Math.max(0, localModels.length - selectedModels.length),
    skippedAlternativeModelCount: remainingModels.length - eligibleAlternativeModels.length,
    configuredModelIncluded: Boolean(configuredMatch && selectedModels.includes(configuredMatch)),
  });
}

/**
 * Produces the complete allow-listed report. The matrix is transient and never
 * includes provider settings, full digests, prompts, output, or raw errors.
 */
/** @param {OllamaVerificationCompatibilityMatrixReportInput} input */
export function buildOllamaVerificationCompatibilityMatrixReport({
  stateId,
  ollamaVersion = null,
  selection = /** @type {OllamaVerificationCompatibilityMatrixSelection} */ ({}),
  outcomes = [],
} = /** @type {OllamaVerificationCompatibilityMatrixReportInput} */ ({})) {
  /** @type {Set<string>} */
  const allowedStateIds = new Set(Object.values(OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS));
  const normalizedStateId = allowedStateIds.has(stateId)
    ? stateId
    : OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS.UNAVAILABLE;
  const selectedModels = Array.isArray(selection.models) ? selection.models : [];
  const normalizedOutcomes = selectedModels.map((selectedModel) => {
    const modelName = normalizeSafeModelName(selectedModel?.name);
    if (!modelName) return null;
    const matchingOutcome = outcomes.find((outcome) => outcome?.modelName === selectedModel.name);
    return Object.freeze({
      modelName,
      modelBuildId: buildModelBuildId(selectedModel?.buildId)
        || normalizeBuildId(selectedModel?.buildId),
      statusId: normalizeOutcomeStatusId(matchingOutcome?.statusId),
      checkedAt: normalizeTimestamp(matchingOutcome?.checkedAt),
      latencyMs: normalizeLatencyMs(matchingOutcome?.latencyMs),
    });
  }).filter(Boolean);

  return Object.freeze({
    version: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_VERSION,
    stateId: normalizedStateId,
    ollamaVersion: normalizeVersion(ollamaVersion),
    configuredModelIncluded: Boolean(selection.configuredModelIncluded),
    omittedModelCount: normalizeNonnegativeSafeInteger(selection.omittedModelCount),
    skippedAlternativeModelCount: normalizeNonnegativeSafeInteger(
      selection.skippedAlternativeModelCount,
    ),
    outcomes: Object.freeze(normalizedOutcomes),
  });
}
