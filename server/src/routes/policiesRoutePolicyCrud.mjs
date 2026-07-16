import { registerPolicyReadRoutes } from './policiesRoutePolicyRead.mjs';
import { registerPolicyNativeIntentReversionRoutes } from './policiesRouteNativeIntentReversion.mjs';
import { registerPolicyNativeIntentReconciliationRoutes } from './policiesRouteNativeIntentReconciliation.mjs';
import { registerPolicyInitialIntentEstablishmentRoutes } from './policiesRouteInitialIntentEstablishment.mjs';
import { registerPolicyWriteRoutes } from './policiesRoutePolicyWrite.mjs';
import { registerPolicyPresetRoutes } from './policiesRoutePolicyPresets.mjs';

export function registerPolicyCrudRoutes(router, deps) {
  registerPolicyReadRoutes(router, deps);
  registerPolicyNativeIntentReversionRoutes(router, deps);
  registerPolicyNativeIntentReconciliationRoutes(router, deps);
  registerPolicyInitialIntentEstablishmentRoutes(router, deps);
  registerPolicyWriteRoutes(router, deps);
  registerPolicyPresetRoutes(router, deps);
}
