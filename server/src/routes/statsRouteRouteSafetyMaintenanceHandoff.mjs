/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { routeSafetyMaintenanceHandoffLimiterConfig } from '../config/rateLimits.mjs';
import { createRouteSafetyMaintenanceHandoffService } from '../services/routeSafetyMaintenanceHandoffService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

/**
 * Registers an advisory, aggregate-only handoff to the existing policy list.
 * It is administrator-only, parameter-free, no-store, rate-limited, and
 * cannot modify policy, route media, invoke providers, or queue work.
 */
export function registerRouteSafetyMaintenanceHandoffRoutes(router, {
  db,
  requireAdmin,
  rateLimit,
  createHandoffService = createRouteSafetyMaintenanceHandoffService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Route-safety maintenance handoff requires administrator authorization.');
  }
  if (typeof rateLimit !== 'function') {
    throw new TypeError('Route-safety maintenance handoff requires a rate-limit factory.');
  }

  const handoffService = createHandoffService({ database: db });
  const handoffLimiter = rateLimit(routeSafetyMaintenanceHandoffLimiterConfig);

  router.get('/route-safety-maintenance-handoff', requireAdmin, handoffLimiter,
    asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      return sendData(res, await handoffService.getReport());
    }));
}
