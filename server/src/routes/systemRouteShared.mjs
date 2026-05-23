import { registerHealthProbeRoutes } from './systemRouteHealthProbes.mjs';
import { registerHealthCheckRoutes } from './systemRouteHealthCheck.mjs';
import { registerSystemInfoRoutes } from './systemRouteSystemInfo.mjs';

export { mapServiceStatus } from './systemRouteHealthCheck.mjs';

export function createSystemRouter({
  express,
  db,
  healthCheckService,
  authenticateToken,
  appVersion,
  fsPromises,
  pathModule,
}) {
  const router = express.Router();
  registerHealthProbeRoutes(router, { healthCheckService });
  router.use(authenticateToken);
  registerHealthCheckRoutes(router, { healthCheckService, appVersion });
  registerSystemInfoRoutes(router, { healthCheckService, db, appVersion, fsPromises, pathModule });
  return router;
}
