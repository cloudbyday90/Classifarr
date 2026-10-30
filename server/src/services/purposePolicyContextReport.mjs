/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PURPOSE_POLICY_CONTEXT_GAPS, readPurposePolicyContext } from './purposePolicyContext.mjs';

/** Extend only the explicit opt-in report. Default v1 reports never acquire these fields. */
export function createPurposePolicyContextProjection(report, input) {
  if (!(input.policyContextInputs instanceof Map)) throw new Error('purpose_context_invalid_input');
  report.version = 'policy.purpose_outcome_cases.v2';
  report.policyEvaluationCoverage = { scope: 'first_item_eligible_events_before_display_caps', eligible: report.evaluation.sampleSize,
    available: 0, gaps: Object.fromEntries(PURPOSE_POLICY_CONTEXT_GAPS.map(reason => [reason, 0])) };
  Object.assign(report.limits, { inputEvents: 5000, inputBytes: 67108864, policyCandidates: 64, policyCaptureBytes: 65536 });
  report.evidenceGaps.fullPolicyAlternatives = 'see_optional_policy_evaluation_context';
  Object.assign(report.interpretation, { optionalContextChangesEligibility: false, selectedPolicyNotEstablished: true,
    policyContextReference: 'retained_policy_evaluation_not_later_ai_routing_trace', purposeOriginAloneIsNotMatchProof: true });
  return (event, item) => {
    const context = readPurposePolicyContext(event, input.policyContextInputs.get(event.classificationId), Date.parse(input.observedAt));
    if (context.status === 'available') report.policyEvaluationCoverage.available++;
    else report.policyEvaluationCoverage.gaps[context.reason]++;
    item.policyEvaluation = context;
  };
}
