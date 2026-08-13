/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import {
  CANDIDATE_BOUND_VERIFICATION_METRICS_DEFAULT_WINDOW_DAYS,
  CANDIDATE_BOUND_VERIFICATION_METRICS_MAX_WINDOW_DAYS,
} from '../services/classificationCandidateBoundVerificationMetrics.mjs';
import {
  createCandidateBoundVerificationRemediationReadinessService,
} from '../services/classificationCandidateBoundVerificationRemediationReadinessService.mjs';

/**
 * Registers an administrator-authorized diagnostic that joins aggregate
 * verification status with current configuration readiness. It is read-only
 * and cannot call providers, disclose historic model output, or alter policy
 * or routing state.
 */
export function registerCandidateBoundVerificationRemediationReadinessRoutes(router, {
  db,
  requireAdmin,
  createReadinessService = createCandidateBoundVerificationRemediationReadinessService,
} = {}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Candidate-bound verification remediation readiness requires administrator authorization.');
  }

  const readinessService = createReadinessService({ database: db });

  router.get('/candidate-bound-verification/remediation-readiness', requireAdmin, asyncHandler(async (req, res) => {
    const windowDays = parseIntParam(
      req.query.days,
      CANDIDATE_BOUND_VERIFICATION_METRICS_DEFAULT_WINDOW_DAYS,
      1,
      CANDIDATE_BOUND_VERIFICATION_METRICS_MAX_WINDOW_DAYS,
    );
    const report = await readinessService.getReport({ windowDays });
    return sendData(res, report);
  }));
}
