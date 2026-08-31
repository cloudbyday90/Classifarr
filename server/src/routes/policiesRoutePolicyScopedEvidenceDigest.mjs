/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  policyScopedEvidenceDigestReadLimiterConfig,
} from '../config/rateLimits.mjs';
import {
  policyScopedEvidenceDigestService,
} from '../services/policyScopedEvidenceDigestService.mjs';

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function createPolicyScopedEvidenceDigestReadLimiter(rateLimit) {
  return typeof rateLimit === 'function'
    ? rateLimit(policyScopedEvidenceDigestReadLimiterConfig)
    : (_req, _res, next) => next();
}

export function registerPolicyScopedEvidenceDigestRoutes(router, { db, rateLimit } = {}) {
  const evidenceDigestReadLimiter = createPolicyScopedEvidenceDigestReadLimiter(rateLimit);

  router.get('/:id/evidence-digest', evidenceDigestReadLimiter, asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const policyId = toPositiveInteger(req.params.id);
    if (!policyId) {
      throw new ValidationError('policyId must be a positive integer');
    }

    const digest = await policyScopedEvidenceDigestService.getDigest({
      dbClient: db,
      policyId,
    });
    if (!digest) throw new NotFoundError('Policy not found');

    res.set('Cache-Control', 'no-store');
    return sendData(res, digest);
  }));
}
