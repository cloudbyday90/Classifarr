/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { aiProviderCapabilityMetricsHealthTrendLimiterConfig } from '../config/rateLimits.mjs';
import {
  createAiProviderCapabilityMetricsHealthTrendService,
} from '../services/aiProviderCapabilityMetricsHealthTrendService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers an administrator-only completed-window telemetry trend. The
 * parameter-free endpoint exposes no dimensions or raw diagnostics and cannot
 * trigger AI, policy, RAG, or routing behavior.
 */
export function registerAiProviderCapabilityMetricsHealthTrendRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createTrendService = createAiProviderCapabilityMetricsHealthTrendService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Capability-metrics health trend requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Capability-metrics health trend requires a rate-limit factory.');
  }

  const trendService = createTrendService({ database: db });
  const trendLimiter = rateLimit(aiProviderCapabilityMetricsHealthTrendLimiterConfig);

  router.get('/ai-provider-capability-metrics-health-trend', requireAdmin, trendLimiter, asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return sendData(res, await trendService.getReport());
  }));
}
