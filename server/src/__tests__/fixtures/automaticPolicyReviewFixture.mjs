/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateItem, evaluatePolicy } from '../../services/policyEngineEvaluation.mjs';
import { recoveryPolicies } from './policyRecoveryReferenceFixture.mjs';
import { purposeMatchFixture } from './purposeMatchEvidenceFixture.mjs';
import { createLivePolicyRecoveryReference } from '../../services/policyRecoverySuggestionLiveReference.mjs';
import { createLivePolicyEvaluationCapture } from '../../services/policyEvaluationCapture.mjs';
import { projectPolicyCandidateDecision } from '../../services/policyCandidateDecisionProjection.mjs';
import { policyDecisionBuilder } from '../../services/policyDecisionBuilder.mjs';
import { ragRecheckStageContext } from './ragRecheckAdviceFixture.mjs';

/** Actual scoring and decision projection: no positive-action or evaluated-score override. */
export async function automaticPolicyReviewFixture({ source = 'native_intent', count = 1, score = 90,
  live = true, autoThreshold = 85, promptThreshold = 60, configure = () => {}, afterEvaluate = () => {},
  item: suppliedItem = null } = {}) {
  const item = suppliedItem ?? { ...purposeMatchFixture().item, title: 'Owned automatic item',
    genres: ['Animation'], keywords: ['Owned retrieval evidence'] };
  const policies = recoveryPolicies(count, source);
  policies.forEach((policy, index) => {
    Object.assign(policy, { trust_patterns: true, preset_weight: 0.35, profile_weight: 0.25, pattern_weight: 0.15,
      auto_classify_threshold: autoThreshold, prompt_threshold: promptThreshold });
    configure(policy, index);
  });
  const libraries = policies.map(policy => ({ id: policy.library_id, name: policy.library_name,
    media_type: item.media_type, is_active: true }));
  const earlier = { id: 2001, name: 'Original A', media_type: item.media_type, is_active: true };
  libraries.push(earlier);
  async function freshEvaluation(metadata = item, context = {}) {
    return evaluateItem(metadata, context, {
      checkAuthoritativeSignals: async () => null, getActivePolicies: async () => policies,
      evaluatePolicy: async (policy, ...args) => {
        const index = policies.indexOf(policy), target = index === 0 ? score : 70 - index / 100;
        // Native purpose contributes 80; corroborating profile/pattern uses the ordinary agreement formula.
        const support = source === 'native_intent' ? (target / 1.12 * 0.75 - 80 * 0.35) / 0.4 : target / 1.05;
        const row = await evaluatePolicy(policy, ...args, {
          scoreProfileWithDiagnostics: async () => ({ score: support, diagnostics: null }), scorePatterns: async () => support,
        });
        await afterEvaluate(row, policy); return row;
      },
      applyInventoryEvidence: async ({ evaluations }) => evaluations, rankResults: async rows => rows,
      determineAction: ranked => policyDecisionBuilder.buildPolicyDecision(projectPolicyCandidateDecision({ ranked })),
      ...(live ? { captureRecoveryReference: createLivePolicyRecoveryReference(metadata) } : {}),
      capturePolicyEvaluation: createLivePolicyEvaluationCapture(metadata),
    });
  }
  const result = await freshEvaluation();
  const original = { action: 'prompt_confirm', confidence: 80, ranked: [{ policy_id: 2001, library_id: earlier.id,
    score: 80, auto_classify_threshold: 95, prompt_threshold: 60, candidate_diagnostics: { primary_anchor_eligible: true } }] };
  const { ctx } = ragRecheckStageContext({ item, libraries, result }, { earlier });
  Object.assign(ctx.signalContext, { ranked: original.ranked, confidence: 80, suggestedLibrary: earlier });
  Object.assign(ctx.baselineResult, { confidence: 80, ai_authority: { sideEffects: { canRoute: false, canLearn: false } } });
  ctx.policyResult = original;
  const candidate = ctx.buildPolicyRecheckCandidate({ baselineResult: ctx.baselineResult, libraries, policyResult: result });
  const stage = { policyAfter: result, policyGate: { shouldAdopt: true }, pass2Candidate: candidate, hadError: false };
  return { item, policies, libraries, result, original, ctx, candidate, stage, freshEvaluation };
}
