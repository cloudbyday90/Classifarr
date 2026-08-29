/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildClassificationQueueAdmissionDiagnostics,
} from './classificationQueueAdmissionDiagnostics.mjs';
import {
  loadOllamaVerificationCapabilityConfiguration,
} from './ollamaVerificationCapabilityRepository.mjs';

/**
 * Keeps the queue read path bounded while projecting only diagnostic state.
 * The cached value is never returned directly, so provider identity and model
 * details cannot cross the queue API boundary.
 */
export function createClassificationQueueAdmissionDiagnosticsService({
  database = db,
  loadProviderConfiguration = loadOllamaVerificationCapabilityConfiguration,
  buildDiagnostics = buildClassificationQueueAdmissionDiagnostics,
  logger = null,
  now = () => Date.now(),
  cacheTtlMs = 5_000,
} = {}) {
  let cachedProviderConfiguration = null;
  let configurationCacheExpiresAt = 0;
  let hasCachedProviderConfiguration = false;

  async function getProviderConfiguration() {
    const currentTime = now();
    if (hasCachedProviderConfiguration && currentTime < configurationCacheExpiresAt) {
      return cachedProviderConfiguration;
    }

    try {
      cachedProviderConfiguration = await loadProviderConfiguration(database);
      hasCachedProviderConfiguration = true;
      configurationCacheExpiresAt = currentTime + cacheTtlMs;
      return cachedProviderConfiguration;
    } catch (error) {
      logger?.warn?.('Queue admission diagnostics could not read saved verification state', {
        error: error.message,
      });
      return null;
    }
  }

  return Object.freeze({
    async getDiagnostics({ queueStats, dispatchBlockers, runtimeState } = {}) {
      const pending = Number(queueStats?.pending);
      const providerConfiguration = Number.isSafeInteger(pending) && pending > 0
        ? await getProviderConfiguration()
        : null;

      return buildDiagnostics({
        queueStats,
        dispatchBlockers,
        runtimeState,
        providerConfiguration,
      });
    },
  });
}
