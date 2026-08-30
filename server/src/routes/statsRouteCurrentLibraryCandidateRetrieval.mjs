import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import {
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_DEFAULT_WINDOW_DAYS,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_MAX_WINDOW_DAYS,
} from '../services/currentLibraryCandidateRetrievalTelemetryMetrics.mjs';
import {
  createCurrentLibraryCandidateRetrievalMetricsService,
} from '../services/currentLibraryCandidateRetrievalMetricsService.mjs';

/**
 * Authenticated, read-only aggregate monitoring. The endpoint has no item,
 * library, provider, prompt, response, or actor dimensions and cannot change
 * retrieval, AI, policy, or routing behavior.
 */
export function registerCurrentLibraryCandidateRetrievalMetricsRoutes(router, {
  db,
  createMetricsService = createCurrentLibraryCandidateRetrievalMetricsService,
} = {}) {
  const metricsService = createMetricsService({ database: db });

  router.get('/current-library-candidate-retrieval', asyncHandler(async (req, res) => {
    const windowDays = parseIntParam(
      req.query.days,
      CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_DEFAULT_WINDOW_DAYS,
      1,
      CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_MAX_WINDOW_DAYS,
    );
    return sendData(res, await metricsService.getSummary({ windowDays }));
  }));
}
