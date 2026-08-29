/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { normalizeOllamaModelDigest } from './ollamaVerificationCapabilityIdentity.mjs';

export const OLLAMA_VERIFICATION_MODEL_DIGEST_MISMATCH_CODE = 'MODEL_DIGEST_MISMATCH';

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;

function normalizeModel(value) {
  const model = String(value || '').trim();
  return model && model.length <= 255 ? model : null;
}

function normalizeConfigurationRevision(value) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

function normalizeFingerprint(value) {
  const fingerprint = String(value || '').trim().toLowerCase();
  return FINGERPRINT_PATTERN.test(fingerprint) ? fingerprint : null;
}

/**
 * Accepts only the fixed digest-mismatch signal emitted by the local Ollama
 * preflight for the exact verification capability that admitted the request.
 * It rejects generic provider errors and stale/configuration-free observations.
 */
export function buildOllamaVerificationCapabilityRuntimeInvalidationTarget({
  provider = null,
  authority = null,
  generationError = null,
} = {}) {
  if (
    provider?.type !== 'ollama'
    || authority?.providerId !== 'ollama'
    || authority?.effectiveMode !== 'verification'
    || String(generationError?.code || '').trim().toUpperCase()
      !== OLLAMA_VERIFICATION_MODEL_DIGEST_MISMATCH_CODE
  ) {
    return null;
  }

  const model = normalizeModel(provider?.config?.model);
  const expectedModelDigest = normalizeOllamaModelDigest(provider?.config?.verificationModelDigest);
  const configurationRevision = normalizeConfigurationRevision(
    provider?.config?.verificationConfigurationRevision,
  );
  const configurationFingerprint = normalizeFingerprint(
    provider?.config?.verificationConfigurationFingerprint,
  );

  if (!model || !expectedModelDigest || configurationRevision === null || !configurationFingerprint) {
    return null;
  }

  return Object.freeze({
    model,
    expectedModelDigest,
    configurationRevision,
    configurationFingerprint,
  });
}
