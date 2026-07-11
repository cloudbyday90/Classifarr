import { registerPolicyReadRoutes } from './policiesRoutePolicyRead.mjs';
import { registerPolicyWriteRoutes } from './policiesRoutePolicyWrite.mjs';
import { registerPolicyPresetRoutes } from './policiesRoutePolicyPresets.mjs';
import { registerPolicyMigrationVerifierRoutes } from './policiesRouteMigrationVerifier.mjs';

export function registerPolicyCrudRoutes(router, deps) {
  registerPolicyReadRoutes(router, deps);
  registerPolicyWriteRoutes(router, deps);
  registerPolicyPresetRoutes(router, deps);
  registerPolicyMigrationVerifierRoutes(router, deps);
}
