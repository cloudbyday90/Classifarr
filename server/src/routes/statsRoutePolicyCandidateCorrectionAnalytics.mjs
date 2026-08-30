/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_DEFAULT_WINDOW_DAYS,
  POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_MAX_WINDOW_DAYS,
} from '../services/policyCandidateCorrectionAnalyticsMetrics.mjs';
import {
  createPolicyCandidateCorrectionAnalyticsMetricsService,
} from '../services/policyCandidateCorrectionAnalyticsMetricsService.mjs';

/**
 * Authenticated, read-only aggregate monitoring for fixed leading-candidate
 * evidence states, score-margin bands, and validated operator selection
 * outcomes. No item, library, candidate, destination, actor, provider, model,
 * prompt, response, or routing control is exposed.
 */
export function registerPolicyCandidateCorrectionAnalyticsMetricsRoutes(router, {
  db,
  createMetricsService = createPolicyCandidateCorrectionAnalyticsMetricsService,
} = {}) {
  const metricsService = createMetricsService({ database: db });

  router.get('/policy-candidate-correction-analytics', asyncHandler(async (req, res) => {
    const windowDays = parseIntParam(
      req.query.days,
      POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_DEFAULT_WINDOW_DAYS,
      1,
      POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_MAX_WINDOW_DAYS,
    );
    return sendData(res, await metricsService.getSummary({ windowDays }));
  }));
}
