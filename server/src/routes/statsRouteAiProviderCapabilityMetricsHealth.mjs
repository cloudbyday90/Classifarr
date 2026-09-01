/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { aiProviderCapabilityMetricsHealthLimiterConfig } from '../config/rateLimits.mjs';
import {
  createAiProviderCapabilityMetricsHealthService,
} from '../services/aiProviderCapabilityMetricsHealthService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers an administrator-only aggregate telemetry health read. The
 * parameter-free endpoint returns no dimensions or raw errors and cannot
 * trigger any AI, policy, RAG, or routing behavior.
 */
export function registerAiProviderCapabilityMetricsHealthRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createHealthService = createAiProviderCapabilityMetricsHealthService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Capability-metrics health requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Capability-metrics health requires a rate-limit factory.');
  }

  const healthService = createHealthService({ database: db });
  const healthLimiter = rateLimit(aiProviderCapabilityMetricsHealthLimiterConfig);

  router.get('/ai-provider-capability-metrics-health', requireAdmin, healthLimiter, asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return sendData(res, await healthService.getReport());
  }));
}
