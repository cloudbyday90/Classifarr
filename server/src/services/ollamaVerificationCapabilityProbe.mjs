/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  findModelMatch,
} from './ollamaPreflightUtils.mjs';
import {
  normalizeOllamaModelDigest,
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS,
} from './ollamaVerificationCapabilityIdentity.mjs';

export const OLLAMA_VERIFICATION_CAPABILITY_PROBE_VERSION =
  'ollama.verification_capability_probe.v1';

export const OLLAMA_VERIFICATION_CAPABILITY_PROBE_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    status: Object.freeze({ type: 'string', enum: Object.freeze(['ready']) }),
    contract: Object.freeze({ type: 'string', enum: Object.freeze(['candidate-bound-verification']) }),
  }),
  required: Object.freeze(['status', 'contract']),
});

const PROBE_PROMPT = `Return only JSON that matches this schema exactly:\n${JSON.stringify(
  OLLAMA_VERIFICATION_CAPABILITY_PROBE_RESPONSE_SCHEMA,
)}`;

function buildProbeOutcome({ identity, statusId, modelDigest = null, errorCode = null, latencyMs = null }) {
  return Object.freeze({
    version: OLLAMA_VERIFICATION_CAPABILITY_PROBE_VERSION,
    statusId,
    configurationRevision: identity.configurationRevision,
    configurationFingerprint: identity.fingerprint,
    modelDigest,
    errorCode,
    checkedAt: new Date().toISOString(),
    latencyMs: Number.isSafeInteger(latencyMs) && latencyMs >= 0 ? latencyMs : null,
  });
}

function isValidProbeResponse(response) {
  if (typeof response !== 'string' || response.length > 4096) {
    return false;
  }

  try {
    const parsed = JSON.parse(response);
    const keys = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.keys(parsed)
      : [];
    return keys.length === 2
      && keys.includes('status')
      && keys.includes('contract')
      && parsed.status === 'ready'
      && parsed.contract === 'candidate-bound-verification';
  } catch {
    return false;
  }
}

/**
 * Runs a fixed, media-free JSON-schema probe. The caller receives only fixed
 * status and bounded diagnostic identifiers; model output never crosses this
 * service boundary or reaches persistence.
 */
export async function probeOllamaVerificationCapability({ identity, ollamaClient }) {
  if (!identity?.applicable) {
    return buildProbeOutcome({
      identity,
      statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.NOT_APPLICABLE,
      errorCode: 'ollama_not_primary_provider',
    });
  }

  const startedAt = Date.now();
  let preflight;
  try {
    preflight = await ollamaClient.preflightConnection({
      model: identity.model,
      force: true,
      includeModels: true,
      probeGeneration: false,
      cacheMs: 0,
    });
  } catch {
    return buildProbeOutcome({
      identity,
      statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.UNAVAILABLE,
      errorCode: 'preflight_failed',
      latencyMs: Date.now() - startedAt,
    });
  }

  if (!preflight?.success) {
    return buildProbeOutcome({
      identity,
      statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.UNAVAILABLE,
      errorCode: String(preflight?.failureType || 'preflight_failed').slice(0, 64),
      latencyMs: Date.now() - startedAt,
    });
  }

  const matchedModel = findModelMatch(preflight.models, identity.model);
  const modelDigest = normalizeOllamaModelDigest(matchedModel?.digest);
  if (!modelDigest) {
    return buildProbeOutcome({
      identity,
      statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY,
      errorCode: 'model_digest_unavailable',
      latencyMs: Date.now() - startedAt,
    });
  }

  try {
    const response = await ollamaClient.generate(
      PROBE_PROMPT,
      identity.model,
      0,
      { format: OLLAMA_VERIFICATION_CAPABILITY_PROBE_RESPONSE_SCHEMA },
    );
    if (!isValidProbeResponse(response)) {
      return buildProbeOutcome({
        identity,
        statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY,
        errorCode: 'structured_response_invalid',
        latencyMs: Date.now() - startedAt,
      });
    }
  } catch {
    return buildProbeOutcome({
      identity,
      statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY,
      errorCode: 'structured_generation_failed',
      latencyMs: Date.now() - startedAt,
    });
  }

  return buildProbeOutcome({
    identity,
    statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.VERIFICATION_READY,
    modelDigest,
    latencyMs: Date.now() - startedAt,
  });
}
