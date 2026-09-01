/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  aiProviderCapabilityMetricsFailureRecencyLimiterConfig,
} from '../config/rateLimits.mjs';
import {
  createAiProviderCapabilityMetricsFailureRecencyService,
} from '../services/aiProviderCapabilityMetricsFailureRecencyService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers an administrator-only aggregate warning-recency report. It has no
 * filters and cannot read diagnostics or change AI, policy, RAG,
 * classification, or routing behavior.
 */
export function registerAiProviderCapabilityMetricsFailureRecencyRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createRecencyService = createAiProviderCapabilityMetricsFailureRecencyService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Capability-metrics failure recency requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Capability-metrics failure recency requires a rate-limit factory.');
  }

  const recencyService = createRecencyService({ database: db });
  const recencyLimiter = rateLimit(aiProviderCapabilityMetricsFailureRecencyLimiterConfig);

  router.get('/ai-provider-capability-metrics-failure-recency', requireAdmin, recencyLimiter, asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return sendData(res, await recencyService.getReport());
  }));
}
