/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { buildAiProviderCapabilityMetricDelta } from './aiProviderCapabilityMetrics.mjs';
import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from './aiProviderCapabilityMetricsLogging.mjs';
import { incrementAiProviderCapabilityMetrics } from './aiProviderCapabilityMetricsRepository.mjs';

export function createAiProviderCapabilityMetricsService({
  database = db,
  logger = createLogger(AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE),
  buildMetricDelta = buildAiProviderCapabilityMetricDelta,
  incrementMetrics = incrementAiProviderCapabilityMetrics,
} = {}) {
  return {
    async record(observation = {}) {
      const delta = buildMetricDelta(observation);

      try {
        await incrementMetrics(database, delta);
      } catch (error) {
        logger.warn(AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE, {
          providerId: delta.providerId,
          model: delta.model,
          authorityMode: delta.authorityMode,
          reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
          error: error.message,
        });
      }

      return delta;
    },
  };
}

export const aiProviderCapabilityMetricsService = createAiProviderCapabilityMetricsService();
