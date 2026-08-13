import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import {
  CANDIDATE_BOUND_VERIFICATION_METRICS_DEFAULT_WINDOW_DAYS,
  CANDIDATE_BOUND_VERIFICATION_METRICS_MAX_WINDOW_DAYS,
} from '../services/classificationCandidateBoundVerificationMetrics.mjs';
import {
  createCandidateBoundVerificationMetricsService,
} from '../services/classificationCandidateBoundVerificationMetricsService.mjs';

/**
 * Registers an authenticated, read-only aggregate report. The report is
 * status-only and advisory; it neither receives nor exposes classification
 * content and cannot invoke a route, retry, policy, or provider operation.
 */
export function registerCandidateBoundVerificationMetricsRoutes(router, {
  db,
  createMetricsService = createCandidateBoundVerificationMetricsService,
} = {}) {
  const metricsService = createMetricsService({ database: db });

  router.get('/candidate-bound-verification', asyncHandler(async (req, res) => {
    const windowDays = parseIntParam(
      req.query.days,
      CANDIDATE_BOUND_VERIFICATION_METRICS_DEFAULT_WINDOW_DAYS,
      1,
      CANDIDATE_BOUND_VERIFICATION_METRICS_MAX_WINDOW_DAYS,
    );
    const report = await metricsService.getSummary({ windowDays });
    return sendData(res, report);
  }));
}
