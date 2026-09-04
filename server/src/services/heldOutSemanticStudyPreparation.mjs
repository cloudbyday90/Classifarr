/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { evaluateItem, evaluatePolicy } from './policyEngineEvaluation.mjs';
import { getActivePolicies } from './policyEngineQueries.mjs';
import { scorePresets, scoreRAGWithDiagnostics } from './policyEngineSourceScoring.mjs';
import { projectPolicyCandidateDecision } from './policyCandidateDecisionProjection.mjs';
import { policyDecisionBuilder } from './policyDecisionBuilder.mjs';
import { buildPolicyCandidateContrastiveRetrievalContract } from './policyCandidateContrastiveRetrievalContract.mjs';
import { ragRetriever } from './ragRetriever.mjs';
import { assertHeldOutSemanticStudyMember } from './heldOutSemanticStudyScope.mjs';

function withoutLearnedSources(policy) {
  const contract = policy.policy_intent_contract;
  return {
    ...policy,
    trust_patterns: false,
    trust_history: false,
    ...(contract ? {
      policy_intent_contract: {
        ...contract,
        ...Object.fromEntries(['purpose', 'hard_limits', 'helpful_hints', 'avoid'].map((key) => [
          key,
          (contract[key] ?? []).filter((rule) => rule.source !== 'media_server_library_profile' &&
            rule.inference_state !== 'inferred'),
        ])),
      },
    } : {}),
  };
}

/** No shared singleton mutation, decision telemetry, history, or learned profiles. */
export function createHeldOutSemanticStudyPreparation({
  loadPolicies = getActivePolicies,
  search = (metadata, scope) => ragRetriever.semanticSearch(metadata, 5, {
    heldOutScope: scope, throwOnError: true,
  }),
  evaluate = evaluateItem,
} = {}) {
  return Object.freeze({
    async loadPolicies() {
      return (await loadPolicies()).map(withoutLearnedSources);
    },
    async prepare({ metadata, heldOutScope, policies }) {
      assertHeldOutSemanticStudyMember(heldOutScope, metadata);
      const matches = await search(metadata, heldOutScope);
      const result = await evaluate(metadata, { ragCache: { matches }, relatedEvidence: [] }, {
        checkAuthoritativeSignals: async () => null,
        getActivePolicies: async () => policies,
        evaluatePolicy: (policy, item, cache, related) => evaluatePolicy(policy, item, cache, related, {
          scorePresets,
          scoreRAGWithDiagnostics,
          scoreProfile: async () => 0,
          scorePatterns: async () => 0,
          scoreHistory: async () => 0,
        }),
        determineAction: (ranked) => policyDecisionBuilder.buildPolicyDecision(
          projectPolicyCandidateDecision({ ranked }),
        ),
      });
      const libraries = policies.map((policy) => ({
        id: policy.library_id, media_type: policy.library_media_type, is_active: true,
      }));
      return buildPolicyCandidateContrastiveRetrievalContract({ policyResult: result, libraries, metadata });
    },
  });
}
