/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { policyEngine } from './policyEngine.mjs';
import { evaluateItem } from './policyEngineEvaluation.mjs';
import { projectPolicyCandidateDecision } from './policyCandidateDecisionProjection.mjs';
import { policyDecisionBuilder } from './policyDecisionBuilder.mjs';

/** Reuse historical RAG; refresh live scoring without generation or decision finalization. */
export async function refreshCandidatePolicy(metadata, previous, relatedEvidence) {
  return evaluateItem(metadata, { ragCache: previous.ragCache ?? { matches: [] }, relatedEvidence }, {
    checkAuthoritativeSignals: item => policyEngine.checkAuthoritativeSignals(item),
    getActivePolicies: () => policyEngine.getActivePolicies(),
    evaluatePolicy: (...args) => policyEngine.evaluatePolicy(...args),
    determineAction: ranked => policyDecisionBuilder.buildPolicyDecision(projectPolicyCandidateDecision({ ranked })),
  });
}
