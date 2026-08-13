import { registerClassificationStatsRoutes } from './statsRouteClassification.mjs';
import { registerCandidateBoundVerificationMetricsRoutes } from './statsRouteCandidateBoundVerification.mjs';
import { registerPolicyStatsRoutes } from './statsRoutePolicies.mjs';
import { registerMonitoringRoutes } from './statsRouteMonitoring.mjs';

export function createStatsRouter({ express, db, authenticateTokenOrApiKey }) {
  const router = express.Router();
  router.use(authenticateTokenOrApiKey);
  registerClassificationStatsRoutes(router, { db });
  registerCandidateBoundVerificationMetricsRoutes(router, { db });
  registerPolicyStatsRoutes(router, { db });
  registerMonitoringRoutes(router, { db });
  return router;
}
