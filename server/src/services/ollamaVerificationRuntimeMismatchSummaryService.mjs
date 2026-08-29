/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildOllamaVerificationRuntimeMismatchSummary,
} from './ollamaVerificationRuntimeMismatchSummary.mjs';
import {
  loadOllamaVerificationRuntimeMismatchSummary,
} from './ollamaVerificationRuntimeMismatchSummaryRepository.mjs';

export const OLLAMA_VERIFICATION_RUNTIME_MISMATCH_SUMMARY_CACHE_TTL_MS = 30_000;

function normalizeCacheTtlMs(value) {
  const ttlMs = Number(value);
  return Number.isSafeInteger(ttlMs) && ttlMs >= 1_000 && ttlMs <= 60_000
    ? ttlMs
    : OLLAMA_VERIFICATION_RUNTIME_MISMATCH_SUMMARY_CACHE_TTL_MS;
}

function normalizeNowMs(value) {
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

/**
 * Coalesces concurrent dashboard reads and retains only the already-sanitized
 * aggregate for a short, fixed TTL. Database failures are not cached.
 */
export function createOllamaVerificationRuntimeMismatchSummaryService({
  database = db,
  loadSummary = loadOllamaVerificationRuntimeMismatchSummary,
  buildSummary = buildOllamaVerificationRuntimeMismatchSummary,
  cacheTtlMs = OLLAMA_VERIFICATION_RUNTIME_MISMATCH_SUMMARY_CACHE_TTL_MS,
  now = () => Date.now(),
} = {}) {
  const ttlMs = normalizeCacheTtlMs(cacheTtlMs);
  let cachedSummary = null;
  let cacheExpiresAtMs = 0;
  let inFlight = null;

  return Object.freeze({
    async getSummary() {
      const nowMs = normalizeNowMs(now());
      if (cachedSummary && nowMs < cacheExpiresAtMs) {
        return cachedSummary;
      }

      if (inFlight) return inFlight;

      inFlight = (async () => {
        const row = await loadSummary(database);
        const summary = buildSummary(row);
        cachedSummary = summary;
        cacheExpiresAtMs = normalizeNowMs(now()) + ttlMs;
        return summary;
      })();

      try {
        return await inFlight;
      } finally {
        inFlight = null;
      }
    },
  });
}
