/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  aiProviderCapabilityMetricsFailureBreakdownLimiterConfig,
} from '../config/rateLimits.mjs';
import {
  createAiProviderCapabilityMetricsFailureBreakdownService,
} from '../services/aiProviderCapabilityMetricsFailureBreakdownService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers an administrator-only, fixed-window breakdown of only safe
 * capability-metric persistence categories. The request accepts no filters
 * and cannot read raw diagnostics or change application behavior.
 */
export function registerAiProviderCapabilityMetricsFailureBreakdownRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createBreakdownService = createAiProviderCapabilityMetricsFailureBreakdownService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Capability-metrics failure breakdown requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Capability-metrics failure breakdown requires a rate-limit factory.');
  }

  const breakdownService = createBreakdownService({ database: db });
  const breakdownLimiter = rateLimit(aiProviderCapabilityMetricsFailureBreakdownLimiterConfig);

  router.get('/ai-provider-capability-metrics-failure-breakdown', requireAdmin, breakdownLimiter, asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return sendData(res, await breakdownService.getReport());
  }));
}
