import { registerPolicyReadRoutes } from './policiesRoutePolicyRead.mjs';
import { registerPolicyOperatorWorkflowReadRoutes } from './policiesRouteOperatorWorkflowRead.mjs';
import { registerPolicyOperatorWorkflowCustomIntentSignalRoutes } from './policiesRouteOperatorWorkflowCustomIntentSignal.mjs';
import { registerPolicyConstraintAdmissionRoutes } from './policiesRoutePolicyConstraintAdmission.mjs';
import { registerPolicyAuthoringProposalRoutes } from './policiesRoutePolicyAuthoringProposal.mjs';
import { registerPolicyNativeIntentReversionRoutes } from './policiesRouteNativeIntentReversion.mjs';
import { registerPolicyNativeIntentChangeRoutes } from './policiesRouteNativeIntentChange.mjs';
import { registerPolicyNativeIntentChangeRecentReceiptDiscoveryRoutes } from './policiesRouteNativeIntentChangeRecentReceiptDiscovery.mjs';
import { registerPolicyNativeIntentPurposeChangeReadRoutes } from './policiesRouteNativeIntentPurposeChangeRead.mjs';
import { registerPolicyNativeIntentChangePurposePreflightRoutes } from './policiesRouteNativeIntentChangePurposePreflight.mjs';
import { registerPolicyPurposeCoveragePreflightRoutes } from './policiesRoutePolicyPurposeCoveragePreflight.mjs';
import { registerPolicyCohortSimulationRoutes } from './policiesRoutePolicyCohortSimulation.mjs';
import { registerPolicyDestinationCompetitionPreviewRoutes } from './policiesRoutePolicyDestinationCompetitionPreview.mjs';
import { registerPolicyNativeIntentReconciliationRoutes } from './policiesRouteNativeIntentReconciliation.mjs';
import { registerPolicyInitialIntentEstablishmentRoutes } from './policiesRouteInitialIntentEstablishment.mjs';
import { registerPolicyInitialIntentEstablishmentReadinessRoutes } from './policiesRouteInitialIntentEstablishmentReadiness.mjs';
import { registerPolicyNativeIntentReadinessSummaryRoutes } from './policiesRouteNativeIntentReadinessSummary.mjs';
import { registerPolicyScopedEvidenceDigestRoutes } from './policiesRoutePolicyScopedEvidenceDigest.mjs';
import { registerPolicyWriteRoutes } from './policiesRoutePolicyWrite.mjs';
import { registerPolicyPresetRoutes } from './policiesRoutePolicyPresets.mjs';
import { registerPolicyEvaluationContextRoute } from './policiesRouteEvaluationContext.mjs';
import {
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusControlRoutes,
} from './policiesRouteRepresentativeReviewCorpusControl.mjs';
import {
  registerPolicyCandidateCorrectionRepresentativeReviewProjectionRoutes,
} from './policiesRouteRepresentativeReviewProjection.mjs';
import {
  registerPolicyCandidateCorrectionRepresentativeReviewEvaluationReportRoutes,
} from './policiesRouteRepresentativeReviewEvaluationReport.mjs';
import {
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationRoutes,
} from './policiesRouteRepresentativeReviewCorpusCaptureEvaluation.mjs';
import {
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportRoutes,
} from './policiesRouteRepresentativeReviewCorpusCaptureCalibrationReport.mjs';
import {
  registerPolicyCandidateCorrectionPolicyChangeOutcomeObservationRoutes,
} from './policiesRoutePolicyChangeOutcomeObservation.mjs';
import {
  registerPolicyCandidateCorrectionPolicyChangeDecisionRecordRoutes,
} from './policiesRoutePolicyChangeDecisionRecord.mjs';
import {
  registerPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryRoutes,
} from './policiesRoutePolicyChangeReviewHistorySummary.mjs';

export function registerPolicyCrudRoutes(router, deps) {
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusControlRoutes(router, deps);
  registerPolicyCandidateCorrectionRepresentativeReviewProjectionRoutes(router, deps);
  registerPolicyCandidateCorrectionRepresentativeReviewEvaluationReportRoutes(router, deps);
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationRoutes(router, deps);
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportRoutes(router, deps);
  registerPolicyCandidateCorrectionPolicyChangeOutcomeObservationRoutes(router, deps);
  registerPolicyCandidateCorrectionPolicyChangeDecisionRecordRoutes(router, deps);
  registerPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryRoutes(router, deps);
  registerPolicyEvaluationContextRoute(router, deps);
  registerPolicyOperatorWorkflowReadRoutes(router, deps);
  registerPolicyOperatorWorkflowCustomIntentSignalRoutes(router, deps);
  registerPolicyConstraintAdmissionRoutes(router, deps);
  registerPolicyAuthoringProposalRoutes(router, deps);
  registerPolicyReadRoutes(router, deps);
  registerPolicyNativeIntentReversionRoutes(router, deps);
  registerPolicyNativeIntentChangeRoutes(router, deps);
  registerPolicyNativeIntentChangeRecentReceiptDiscoveryRoutes(router, deps);
  registerPolicyNativeIntentPurposeChangeReadRoutes(router, deps);
  registerPolicyNativeIntentChangePurposePreflightRoutes(router, deps);
  registerPolicyPurposeCoveragePreflightRoutes(router, deps);
  registerPolicyCohortSimulationRoutes(router, deps);
  registerPolicyDestinationCompetitionPreviewRoutes(router, deps);
  registerPolicyNativeIntentReconciliationRoutes(router, deps);
  registerPolicyScopedEvidenceDigestRoutes(router, deps);
  registerPolicyInitialIntentEstablishmentRoutes(router, deps);
  registerPolicyInitialIntentEstablishmentReadinessRoutes(router, deps);
  registerPolicyNativeIntentReadinessSummaryRoutes(router, deps);
  registerPolicyWriteRoutes(router, deps);
  registerPolicyPresetRoutes(router, deps);
}
