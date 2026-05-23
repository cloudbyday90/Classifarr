import { registerClassificationStatsRoutes } from './statsRouteClassification.mjs';
import { registerPolicyStatsRoutes } from './statsRoutePolicies.mjs';
import { registerMonitoringRoutes } from './statsRouteMonitoring.mjs';

export function createStatsRouter({ express, db, authenticateTokenOrApiKey }) {
  const router = express.Router();
  router.use(authenticateTokenOrApiKey);
  registerClassificationStatsRoutes(router, { db });
  registerPolicyStatsRoutes(router, { db });
  registerMonitoringRoutes(router, { db });
  return router;
}
