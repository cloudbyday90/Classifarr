/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ragRecheckAdviceFixture, ragRecheckStageContext } from './ragRecheckAdviceFixture.mjs';

export function nonadoptedRagContext(value, { earlier = value.libraries.at(-1) } = {}) {
  const { ctx } = ragRecheckStageContext(value, { earlier });
  Object.assign(ctx.signalContext, { confidence: 80 });
  Object.assign(ctx.baselineResult, { confidence: 80, needs_clarification: true });
  ctx.policyResult = { action: 'prompt_confirm', confidence: 80,
    library: { library_id: earlier.id }, ranked: [{ library_id: earlier.id, score: 80, auto_classify_threshold: 95 }] };
  ctx.trigger = { trigger: 'policy_prompt_confirm' };
  ctx.pass1Diagnostics = { topSimilarity: 0.5, marginPoints: 30 };
  ctx.pass2Diagnostics = { topSimilarity: 0.6, marginPoints: 30 };
  Object.assign(ctx.config, { policy_recheck_min_similarity_delta: 0.08, policy_recheck_min_margin_delta: 10, policy_recheck_min_confidence_gain: 5 });
  return ctx;
}

export async function nonadoptedRagVerificationFixture(options = {}) {
  const value = await ragRecheckAdviceFixture({ confidence: 75, ...options });
  const ctx = nonadoptedRagContext(value);
  return { ...value, ctx, stage: { policyAfter: value.result, policyGate: { shouldAdopt: false }, pass2Candidate: null, hadError: false } };
}
