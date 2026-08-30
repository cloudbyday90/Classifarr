import { registerClassificationStatsRoutes } from './statsRouteClassification.mjs';
import { registerCandidateBoundVerificationMetricsRoutes } from './statsRouteCandidateBoundVerification.mjs';
import { registerCurrentLibraryCandidateRetrievalMetricsRoutes } from './statsRouteCurrentLibraryCandidateRetrieval.mjs';
import { registerCandidateBoundVerificationRemediationReadinessRoutes } from './statsRouteCandidateBoundVerificationRemediationReadiness.mjs';
import { registerOllamaVerificationRuntimeMismatchSummaryRoutes } from './statsRouteOllamaVerificationRuntimeMismatchSummary.mjs';
import { registerOllamaVerificationCapabilityOutcomeHistoryRoutes } from './statsRouteOllamaVerificationCapabilityOutcomeHistory.mjs';
import { registerPolicyStatsRoutes } from './statsRoutePolicies.mjs';
import { registerMonitoringRoutes } from './statsRouteMonitoring.mjs';

export function createStatsRouter({ express, db, authenticateTokenOrApiKey, requireAdmin, rateLimit }) {
  const router = express.Router();
  router.use(authenticateTokenOrApiKey);
  registerClassificationStatsRoutes(router, { db });
  registerCandidateBoundVerificationMetricsRoutes(router, { db });
  registerCurrentLibraryCandidateRetrievalMetricsRoutes(router, { db });
  registerCandidateBoundVerificationRemediationReadinessRoutes(router, { db, requireAdmin });
  registerOllamaVerificationRuntimeMismatchSummaryRoutes(router, { db, requireAdmin, rateLimit });
  registerOllamaVerificationCapabilityOutcomeHistoryRoutes(router, { db, requireAdmin, rateLimit });
  registerPolicyStatsRoutes(router, { db });
  registerMonitoringRoutes(router, { db });
  return router;
}
