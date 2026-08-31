/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { routeSafetyReadinessLimiterConfig } from '../config/rateLimits.mjs';
import { createRouteSafetyReadinessService } from '../services/routeSafetyReadinessService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers the bounded route-safety aggregate used by AI Settings. It is
 * administrator-only, parameter-free, no-store, rate-limited, and read-only:
 * it cannot probe providers, reveal media, or alter policy/routing behavior.
 */
export function registerRouteSafetyReadinessRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createReadinessService = createRouteSafetyReadinessService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Route-safety readiness requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Route-safety readiness requires a rate-limit factory.');
  }

  const readinessService = createReadinessService({ database: db });
  const readinessLimiter = rateLimit(routeSafetyReadinessLimiterConfig);

  router.get('/route-safety-readiness', requireAdmin, readinessLimiter, asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return sendData(res, await readinessService.getReport());
  }));
}
