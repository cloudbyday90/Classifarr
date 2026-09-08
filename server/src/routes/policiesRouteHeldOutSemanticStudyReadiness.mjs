/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  heldOutSemanticStudyReadinessLimiterConfig,
} from '../config/rateLimits.mjs';
import { ForbiddenError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  heldOutSemanticStudyReadinessService,
} from '../services/heldOutSemanticStudyReadinessService.mjs';

function createReadinessLimiter(rateLimit) {
  return typeof rateLimit === 'function'
    ? rateLimit(heldOutSemanticStudyReadinessLimiterConfig)
    : (_req, _res, next) => next();
}

function requireAdministrator(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }

  return next();
}

/**
 * Serves a versioned, aggregate-only study prerequisite. It is parameter-free,
 * administrator-only, no-store, rate-limited, and read-only.
 */
export function registerPolicyHeldOutSemanticStudyReadinessRoutes(router, { db, rateLimit } = {}) {
  const readinessLimiter = createReadinessLimiter(rateLimit);

  router.get('/native-intent-reconciliation/held-out-study-readiness', requireAdministrator, readinessLimiter,
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      return sendData(res, await heldOutSemanticStudyReadinessService.getReport({ dbClient: db }));
    }));
}
