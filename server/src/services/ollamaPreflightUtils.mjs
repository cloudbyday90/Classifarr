/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const MIN_TIMEOUT_MS = 1000;
const DEFAULT_SCHEDULED_PREFLIGHT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CONNECTIVITY_TIMEOUT_MS = 5000;
const DEFAULT_PROBE_TIMEOUT_MS = 120000;
const DEFAULT_PROBE_CONTEXT_LENGTH = 4096;
const DEFAULT_PREFLIGHT_RETRY_BASE_MS = 5 * 60 * 1000;
const DEFAULT_PREFLIGHT_RETRY_MAX_MS = 60 * 60 * 1000;
const DEFAULT_PREFLIGHT_WARN_DEDUPE_MS = 30 * 60 * 1000;

export {
  MIN_TIMEOUT_MS,
  DEFAULT_SCHEDULED_PREFLIGHT_INTERVAL_MS,
  DEFAULT_CONNECTIVITY_TIMEOUT_MS,
  DEFAULT_PROBE_TIMEOUT_MS,
  DEFAULT_PROBE_CONTEXT_LENGTH,
  DEFAULT_PREFLIGHT_RETRY_BASE_MS,
  DEFAULT_PREFLIGHT_RETRY_MAX_MS,
  DEFAULT_PREFLIGHT_WARN_DEDUPE_MS,
};

export function parseDurationMs(value, fallback, minimum = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

export function parseCacheMs(cacheMs, fallback = 60000) {
  return parseDurationMs(cacheMs, fallback, 0);
}

export function getConnectivityTimeoutMs(timeoutMs = process.env.OLLAMA_CONNECTIVITY_TIMEOUT_MS) {
  return parseDurationMs(timeoutMs, DEFAULT_CONNECTIVITY_TIMEOUT_MS, MIN_TIMEOUT_MS);
}

export function getProbeTimeoutMs(timeoutMs = process.env.OLLAMA_PROBE_TIMEOUT_MS) {
  return parseDurationMs(timeoutMs, DEFAULT_PROBE_TIMEOUT_MS, MIN_TIMEOUT_MS);
}

export function getProbeContextLength(contextLength = process.env.OLLAMA_PROBE_CONTEXT_LENGTH) {
  return parseDurationMs(contextLength, DEFAULT_PROBE_CONTEXT_LENGTH, 256);
}

export function getScheduledPreflightRetryBaseMs(value = process.env.OLLAMA_PREFLIGHT_RETRY_BASE_MS) {
  return parseDurationMs(value, DEFAULT_PREFLIGHT_RETRY_BASE_MS, MIN_TIMEOUT_MS);
}

export function getScheduledPreflightRetryMaxMs(value = process.env.OLLAMA_PREFLIGHT_RETRY_MAX_MS) {
  const baseMs = getScheduledPreflightRetryBaseMs();
  return parseDurationMs(value, DEFAULT_PREFLIGHT_RETRY_MAX_MS, baseMs);
}

export function getScheduledWarnDedupeMs(value = process.env.OLLAMA_PREFLIGHT_WARN_DEDUPE_MS) {
  return parseDurationMs(value, DEFAULT_PREFLIGHT_WARN_DEDUPE_MS, MIN_TIMEOUT_MS);
}

export function getScheduledPreflightRetryDelayMs(failureCount) {
  const baseMs = getScheduledPreflightRetryBaseMs();
  const maxMs = getScheduledPreflightRetryMaxMs();
  const attempt = Math.max(0, failureCount - 1);
  const cappedDelayMs = Math.min(maxMs, baseMs * (2 ** attempt));
  return Math.max(MIN_TIMEOUT_MS, Math.floor(Math.random() * cappedDelayMs));
}

export function classifyPreflightFailure(errorCode, errorMessage, stage = 'connectivity') {
  if (stage === 'model') {
    return 'model_not_found';
  }

  const normalizedCode = String(errorCode || '').trim().toUpperCase();
  const normalizedMessage = String(errorMessage || '').toLowerCase();
  const prefix = stage === 'generation'
    ? 'generation'
    : stage === 'scheduled'
      ? 'scheduled'
      : 'connectivity';

  if (normalizedCode === 'ECONNREFUSED') {
    return `${prefix}_connection_refused`;
  }

  if (normalizedCode === 'ENOTFOUND') {
    return `${prefix}_dns_error`;
  }

  if (normalizedCode === 'EHOSTUNREACH') {
    return `${prefix}_host_unreachable`;
  }

  if (normalizedCode === 'ETIMEDOUT' || normalizedCode === 'ECONNABORTED' || normalizedMessage.includes('timeout')) {
    return `${prefix}_timeout`;
  }

  return `${prefix}_failed`;
}

export function normalizeModelName(modelName) {
  return typeof modelName === 'string' ? modelName.trim() : '';
}

export function findModelMatch(models, modelName) {
  const normalizedModel = normalizeModelName(modelName).toLowerCase();
  if (!normalizedModel || !Array.isArray(models)) {
    return null;
  }

  return models.find((model) => {
    const currentName = String(model?.name || '').toLowerCase();
    if (!currentName) {
      return false;
    }
    return (
      currentName === normalizedModel
      || currentName.startsWith(`${normalizedModel}:`)
      || normalizedModel.startsWith(`${currentName}:`)
      || currentName.split(':')[0] === normalizedModel.split(':')[0]
    );
  }) || null;
}

export function buildPreflightCacheKey({ host, port, model, probeGeneration, expectedModelDigest = null }) {
  return `${host}:${port}:${normalizeModelName(model).toLowerCase()}:${probeGeneration ? 'probe' : 'noprobe'}:${String(expectedModelDigest || '').toLowerCase()}`;
}
