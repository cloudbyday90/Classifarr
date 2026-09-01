/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  aiProviderCapabilityMetricsFailureCategoryCoverageLimiterConfig,
} from '../config/rateLimits.mjs';
import {
  createAiProviderCapabilityMetricsFailureCategoryCoverageService,
} from '../services/aiProviderCapabilityMetricsFailureCategoryCoverageService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers an administrator-only completed-window coverage report for the
 * fixed telemetry category contract. It accepts no filters and cannot read
 * diagnostics or change AI, policy, RAG, classification, or routing behavior.
 */
export function registerAiProviderCapabilityMetricsFailureCategoryCoverageRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createCoverageService = createAiProviderCapabilityMetricsFailureCategoryCoverageService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Capability-metrics category coverage requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Capability-metrics category coverage requires a rate-limit factory.');
  }

  const coverageService = createCoverageService({ database: db });
  const coverageLimiter = rateLimit(aiProviderCapabilityMetricsFailureCategoryCoverageLimiterConfig);

  router.get('/ai-provider-capability-metrics-failure-category-coverage', requireAdmin, coverageLimiter, asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return sendData(res, await coverageService.getReport());
  }));
}
