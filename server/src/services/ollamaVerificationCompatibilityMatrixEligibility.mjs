/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

/**
 * Alternative probes must fit this fixed artifact-size budget. The explicitly
 * configured model is deliberately evaluated separately, even when larger.
 */
export const OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_MAX_ALTERNATIVE_SIZE_BYTES =
  24 * 1024 ** 3;

const EMBEDDING_FAMILY_MARKER = /(?:bert|embed)/iu;
const EMBEDDING_MODEL_NAME_MARKER = /(?:^|[-_.:/])embed(?:ding)?(?:[-_.:/]|\d|$)/iu;

function hasKnownBoundedArtifactSize(value) {
  return Number.isSafeInteger(value)
    && value > 0
    && value <= OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_MAX_ALTERNATIVE_SIZE_BYTES;
}

/** @param {{ name?: unknown, family?: unknown }} model */
function isClearlyEmbeddingOnly({ name, family } = {}) {
  return EMBEDDING_FAMILY_MARKER.test(String(family ?? ''))
    || EMBEDDING_MODEL_NAME_MARKER.test(String(name ?? ''));
}

/**
 * Keeps comparison probes resource-bounded using server-discovered tag data.
 * The configured model is not passed here because its explicit single-model
 * capability check remains the operator's intended diagnostic.
 */
/** @param {{ artifactSizeBytes?: unknown, name?: unknown, family?: unknown }} model */
export function isOllamaVerificationCompatibilityMatrixAlternativeEligible(model = {}) {
  return hasKnownBoundedArtifactSize(model.artifactSizeBytes)
    && !isClearlyEmbeddingOnly(model);
}
