/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  isValidOllamaVerificationCapabilityProbeResponse,
  OLLAMA_VERIFICATION_CAPABILITY_PROBE_PROMPT,
  OLLAMA_VERIFICATION_CAPABILITY_PROBE_RESPONSE_SCHEMA,
} from './ollamaVerificationCapabilityProbe.mjs';
import { OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS } from './ollamaVerificationCapabilityIdentity.mjs';

export const OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_PROBE_TIMEOUT_MS = 60_000;

/**
 * Runs the shared fixed JSON-schema contract without retaining provider text.
 * `keepAlive: 0` asks Ollama to release each model after the short probe.
 */
export async function probeOllamaVerificationCompatibilityMatrixModel({
  modelName,
  ollamaClient,
  now = () => new Date().toISOString(),
  clock = () => Date.now(),
} = {}) {
  const startedAt = clock();
  try {
    const response = await ollamaClient.generate(
      OLLAMA_VERIFICATION_CAPABILITY_PROBE_PROMPT,
      modelName,
      0,
      {
        format: OLLAMA_VERIFICATION_CAPABILITY_PROBE_RESPONSE_SCHEMA,
        keepAlive: 0,
        timeoutMs: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_PROBE_TIMEOUT_MS,
      },
    );

    return Object.freeze({
      modelName,
      statusId: isValidOllamaVerificationCapabilityProbeResponse(response)
        ? OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.VERIFICATION_READY
        : OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY,
      checkedAt: now(),
      latencyMs: Math.max(0, clock() - startedAt),
    });
  } catch {
    return Object.freeze({
      modelName,
      statusId: OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.CLASSIFICATION_ONLY,
      checkedAt: now(),
      latencyMs: Math.max(0, clock() - startedAt),
    });
  }
}
