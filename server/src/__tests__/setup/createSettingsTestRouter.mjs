import { authenticateToken, requireAdmin } from '../../middleware/auth.mjs';
import { createSettingsRouteDependencies } from '../../routes/settingsRouteDependencies.mjs';
import { createSettingsRouter } from '../../routes/settingsRouteShared.mjs';
function createSettingsTestRouter(express, dependencyOverrides = {}) {
  const { httpClient: overriddenHttpClient, ...routeDependencyOverrides } = dependencyOverrides;

  const routeDependencies = createSettingsRouteDependencies({
    httpClient: overriddenHttpClient,
    ...routeDependencyOverrides,
  });

  return createSettingsRouter({
    express,
    authenticateToken,
    requireAdmin,
    ...routeDependencies,
  });
}

export {
  createSettingsTestRouter,
};
