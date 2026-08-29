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

export const OLLAMA_VERIFICATION_CAPABILITY_VERSION =
  'ollama.verification_capability.v1';

export const OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  NOT_CHECKED: 'not_checked',
  VERIFICATION_READY: 'verification_ready',
  CLASSIFICATION_ONLY: 'classification_only',
  UNAVAILABLE: 'unavailable',
  MODEL_CHANGED: 'model_changed',
});

export const OLLAMA_VERIFICATION_CAPABILITY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const VALID_STATUS_IDS = new Set(Object.values(OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS));
const MODEL_DIGEST_PATTERN = /^[a-f0-9]{64}$/i;

function normalizeProviderId(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeHost(value) {
  return String(value || 'ollama').trim().toLowerCase().replace(/\/+$/, '') || 'ollama';
}

function normalizePort(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 11434;
}

function normalizeModel(value) {
  return String(value || 'llama3.2').trim().slice(0, 255) || 'llama3.2';
}

function normalizeConfigurationRevision(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeTimestamp(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function normalizeOllamaModelDigest(value) {
  const digest = String(value || '').trim().toLowerCase();
  return MODEL_DIGEST_PATTERN.test(digest) ? digest : null;
}

export function resolveOllamaVerificationCapabilityIdentity(configuration = {}) {
  const applicable = normalizeProviderId(configuration.primary_provider) === 'ollama';
  const model = normalizeModel(configuration.ollama_model);
  const host = normalizeHost(configuration.ollama_host);
  const port = normalizePort(configuration.ollama_port);
  const configurationRevision = normalizeConfigurationRevision(configuration.configuration_revision);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ providerId: 'ollama', host, port, model }))
    .digest('hex');

  return Object.freeze({
    version: OLLAMA_VERIFICATION_CAPABILITY_VERSION,
    applicable,
    providerId: 'ollama',
    model,
    configurationRevision,
    fingerprint,
  });
}

function normalizeStoredStatusId(value) {
  return VALID_STATUS_IDS.has(value)
    ? value
    : OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.NOT_CHECKED;
}

function isStoredResultCurrent({ configuration, identity, now }) {
  const checkedAt = normalizeTimestamp(configuration.ollama_verification_capability_checked_at);
  const storedRevision = normalizeConfigurationRevision(
    configuration.ollama_verification_capability_configuration_revision,
  );
  const storedFingerprint = String(
    configuration.ollama_verification_capability_fingerprint || '',
  ).trim().toLowerCase();

  return checkedAt !== null
    && checkedAt <= now
    && now - checkedAt <= OLLAMA_VERIFICATION_CAPABILITY_MAX_AGE_MS
    && storedRevision === identity.configurationRevision
    && storedFingerprint === identity.fingerprint;
}

/**
 * Resolves the only local structured-output evidence that may be handed to
 * the provider-authority layer. A save, model/endpoint change, malformed
 * record, or expired test always resolves to not_checked.
 */
export function getOllamaVerificationCapabilityState(configuration = {}, { now = Date.now() } = {}) {
  const identity = resolveOllamaVerificationCapabilityIdentity(configuration);

  if (!identity.applicable) {
    return Object.freeze({
      ...identity,
      statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.NOT_APPLICABLE,
      checkedAt: null,
      errorCode: null,
      modelDigest: null,
      current: false,
      verificationReady: false,
    });
  }

  if (!isStoredResultCurrent({ configuration, identity, now })) {
    return Object.freeze({
      ...identity,
      statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.NOT_CHECKED,
      checkedAt: null,
      errorCode: null,
      modelDigest: null,
      current: false,
      verificationReady: false,
    });
  }

  const statusId = normalizeStoredStatusId(configuration.ollama_verification_capability_status);
  const modelDigest = normalizeOllamaModelDigest(
    configuration.ollama_verification_capability_model_digest,
  );
  const verificationReady = statusId
    === OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.VERIFICATION_READY
    && Boolean(modelDigest);
  const modelChanged = statusId
    === OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.MODEL_CHANGED;
  const current = verificationReady || modelChanged || [
    OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY,
    OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.UNAVAILABLE,
  ].includes(statusId);

  return Object.freeze({
    ...identity,
    statusId: current
      ? statusId
      : OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.NOT_CHECKED,
    checkedAt: configuration.ollama_verification_capability_checked_at || null,
    errorCode: verificationReady
      ? null
      : String(configuration.ollama_verification_capability_error_code || '').trim() || null,
    modelDigest: verificationReady ? modelDigest : null,
    current,
    verificationReady,
  });
}

export function buildOllamaVerificationAuthorityEvidence(configuration = {}, options = {}) {
  const state = getOllamaVerificationCapabilityState(configuration, options);

  return Object.freeze({
    providerId: state.providerId,
    model: state.model,
    verified: state.verificationReady,
    modelDigest: state.modelDigest,
  });
}
