import { registerPolicyReadRoutes } from './policiesRoutePolicyRead.mjs';
import { registerPolicyOperatorWorkflowReadRoutes } from './policiesRouteOperatorWorkflowRead.mjs';
import { registerPolicyOperatorWorkflowCustomIntentSignalRoutes } from './policiesRouteOperatorWorkflowCustomIntentSignal.mjs';
import { registerPolicyConstraintAdmissionRoutes } from './policiesRoutePolicyConstraintAdmission.mjs';
import { registerPolicyAuthoringProposalRoutes } from './policiesRoutePolicyAuthoringProposal.mjs';
import { registerPolicyNativeIntentReversionRoutes } from './policiesRouteNativeIntentReversion.mjs';
import { registerPolicyNativeIntentChangeRoutes } from './policiesRouteNativeIntentChange.mjs';
import { registerPolicyPurposeCoveragePreflightRoutes } from './policiesRoutePolicyPurposeCoveragePreflight.mjs';
import { registerPolicyNativeIntentReconciliationRoutes } from './policiesRouteNativeIntentReconciliation.mjs';
import { registerPolicyInitialIntentEstablishmentRoutes } from './policiesRouteInitialIntentEstablishment.mjs';
import { registerPolicyInitialIntentEstablishmentReadinessRoutes } from './policiesRouteInitialIntentEstablishmentReadiness.mjs';
import { registerPolicyNativeIntentReadinessSummaryRoutes } from './policiesRouteNativeIntentReadinessSummary.mjs';
import { registerPolicyWriteRoutes } from './policiesRoutePolicyWrite.mjs';
import { registerPolicyPresetRoutes } from './policiesRoutePolicyPresets.mjs';

export function registerPolicyCrudRoutes(router, deps) {
  registerPolicyOperatorWorkflowReadRoutes(router, deps);
  registerPolicyOperatorWorkflowCustomIntentSignalRoutes(router, deps);
  registerPolicyConstraintAdmissionRoutes(router, deps);
  registerPolicyAuthoringProposalRoutes(router, deps);
  registerPolicyReadRoutes(router, deps);
  registerPolicyNativeIntentReversionRoutes(router, deps);
  registerPolicyNativeIntentChangeRoutes(router, deps);
  registerPolicyPurposeCoveragePreflightRoutes(router, deps);
  registerPolicyNativeIntentReconciliationRoutes(router, deps);
  registerPolicyInitialIntentEstablishmentRoutes(router, deps);
  registerPolicyInitialIntentEstablishmentReadinessRoutes(router, deps);
  registerPolicyNativeIntentReadinessSummaryRoutes(router, deps);
  registerPolicyWriteRoutes(router, deps);
  registerPolicyPresetRoutes(router, deps);
}
