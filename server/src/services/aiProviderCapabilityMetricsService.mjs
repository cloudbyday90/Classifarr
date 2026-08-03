/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { buildAiProviderCapabilityMetricDelta } from './aiProviderCapabilityMetrics.mjs';
import { incrementAiProviderCapabilityMetrics } from './aiProviderCapabilityMetricsRepository.mjs';

export function createAiProviderCapabilityMetricsService({
  database = db,
  logger = createLogger('AIProviderCapabilityMetrics'),
  buildMetricDelta = buildAiProviderCapabilityMetricDelta,
  incrementMetrics = incrementAiProviderCapabilityMetrics,
} = {}) {
  return {
    async record(observation = {}) {
      const delta = buildMetricDelta(observation);

      try {
        await incrementMetrics(database, delta);
      } catch (error) {
        logger.warn('AI provider capability metric write failed', {
          providerId: delta.providerId,
          model: delta.model,
          authorityMode: delta.authorityMode,
          error: error.message,
        });
      }

      return delta;
    },
  };
}

export const aiProviderCapabilityMetricsService = createAiProviderCapabilityMetricsService();
