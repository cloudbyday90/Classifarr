/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { policyRecoveryReferenceFixture } from './policyRecoveryReferenceFixture.mjs';
import { buildPolicyRecheckCandidate, buildAiRerunCandidate } from '../../services/classificationRagLoopServiceShared.mjs';
import { buildPolicyRecheckVerificationSignalContext } from '../../services/classificationRagLoopVerification.mjs';

export async function ragRecheckAdviceFixture(options) {
  const value = await policyRecoveryReferenceFixture(options);
  const earlier = { id: 2001, name: 'Earlier destination', media_type: value.item.media_type, is_active: true };
  value.libraries.push(earlier);
  return { ...value, ...ragRecheckStageContext(value, { earlier }) };
}

export function ragRecheckStageContext(value, { earlier = null } = {}) {
  const signalContext = { confidence: 10, suggestedLibrary: earlier, ranked: [{ library_id: 2001, score: 10 }],
    breakdown: [{ type: 'EARLIER PASS SENTINEL', score: 10, weight: 1 }], decisionDiagnostics: { reason_code: 'EARLIER PASS SENTINEL' } };
  const baselineResult = { library: earlier, confidence: 10, signalContext, needs_clarification: true };
  const before = { action: 'prompt_select', confidence: 10, ranked: signalContext.ranked };
  const ctx = { expandedMetadata: value.item, libraries: value.libraries, signalContext, baselineResult, policyResult: before,
    config: { policy_recheck_max_attempts: 1, policy_recheck_max_ai_calls_per_item: 2,
      policy_recheck_min_similarity_delta: 0, policy_recheck_min_margin_delta: 0, policy_recheck_min_confidence_gain: 1 },
    trigger: { trigger: 'policy_prompt_select' }, pass1Diagnostics: { topSimilarity: 0, marginPoints: 0 },
    pass2Diagnostics: { topSimilarity: 1, marginPoints: 100 }, pass2EvidenceMatches: [{ similarity: 0.95 }],
    pass2RagContext: null, remainingBudget: () => 5000, canRetryStage: () => false, retrievalRetryBaseDelayMs: 1,
    addEvent: () => {}, classifyStageError: async () => ({ reasonCode: 'owned_stage_failure' }), buildPolicyRecheckCandidate,
    buildAiRerunCandidate, buildAiRerunFailureEvent: ({ stageError }) => stageError, aiCallsUsed: 1 };
  const candidate = buildPolicyRecheckCandidate({ ...ctx, policyResult: value.result });
  const stage = { policyAfter: value.result, policyGate: { shouldAdopt: true }, pass2Candidate: candidate, hadError: false };
  const consumer = buildPolicyRecheckVerificationSignalContext({ signalContext, policyResult: value.result, libraries: value.libraries });
  return { ctx, stage, candidate, consumer };
}
