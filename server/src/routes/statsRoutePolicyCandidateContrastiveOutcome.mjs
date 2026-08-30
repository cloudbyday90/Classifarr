/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import {
  POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_DEFAULT_WINDOW_DAYS,
  POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_MAX_WINDOW_DAYS,
} from '../services/policyCandidateContrastiveOutcomeMetrics.mjs';
import {
  createPolicyCandidateContrastiveOutcomeMetricsService,
} from '../services/policyCandidateContrastiveOutcomeMetricsService.mjs';

/**
 * Authenticated, read-only aggregate monitoring for the fixed contrastive
 * status and server-derived candidate-set resolution outcome. No row-level
 * identity, actor, provider, prompt, or routing control is exposed.
 */
export function registerPolicyCandidateContrastiveOutcomeMetricsRoutes(router, {
  db,
  createMetricsService = createPolicyCandidateContrastiveOutcomeMetricsService,
} = {}) {
  const metricsService = createMetricsService({ database: db });

  router.get('/policy-candidate-contrastive-outcomes', asyncHandler(async (req, res) => {
    const windowDays = parseIntParam(
      req.query.days,
      POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_DEFAULT_WINDOW_DAYS,
      1,
      POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_MAX_WINDOW_DAYS,
    );
    return sendData(res, await metricsService.getSummary({ windowDays }));
  }));
}
