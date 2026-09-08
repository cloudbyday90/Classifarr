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
import { heldOutSemanticStudyEligibilityDiagnostic } from './heldOutSemanticStudyEligibilityDiagnostics.mjs';
import {
  buildHeldOutSemanticStudyPolicySourceScreen,
  isHeldOutSemanticStudyExcludedInferredProfileRule,
} from './heldOutSemanticStudyPolicySourceScreen.mjs';

function withoutInferredProfileSources(policy) {
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
          (contract[key] ?? []).filter((rule) => !isHeldOutSemanticStudyExcludedInferredProfileRule(rule)),
        ])),
      },
    } : {}),
  };
}

/** No shared singleton mutation, decision telemetry, history, or learned profiles. */
export function createHeldOutSemanticStudyPreparation({
  loadPolicies = getActivePolicies,
  evaluate = evaluateItem,
} = {}) {
  async function loadPoliciesWithSourceScreen() {
    const sourcePolicies = await loadPolicies();
    return Object.freeze({
      policies: sourcePolicies.map(withoutInferredProfileSources),
      policySourceScreen: buildHeldOutSemanticStudyPolicySourceScreen({ policies: sourcePolicies }),
    });
  }

  async function assess({ metadata, policies }) {
    const result = await evaluate(metadata, { ragCache: { matches: [] }, relatedEvidence: [] }, {
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
    return Object.freeze({
      contract: buildPolicyCandidateContrastiveRetrievalContract({ policyResult: result, libraries, metadata }),
      diagnostic: heldOutSemanticStudyEligibilityDiagnostic(result),
    });
  }

  return Object.freeze({
    async loadPolicies() {
      return (await loadPoliciesWithSourceScreen()).policies;
    },
    loadPoliciesWithSourceScreen,
    /**
     * Select only a broad-policy candidate comparison before semantic
     * retrieval. This preserves the study's prospective cohort boundary: a
     * semantic outcome cannot decide whether its case enters the cohort.
     */
    assess,
    async prepare(input) {
      return (await assess(input)).contract;
    },
  });
}
