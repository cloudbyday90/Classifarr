/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { refinePolicyPurposeMatchEvidence } from '../../services/policyPurposeMatchEvidence.mjs';
import { buildClassificationCandidateCapture } from '../../services/classificationCandidateCapture.mjs';

export function purposeMatchFixture({ origin = 'declared_native', matched = true, specificity = 'positive_specialized_evidence', mode = 'best_match' } = {}) {
  const rule = source => ({ intent_role: 'purpose', signal_type: 'genres', operator: 'require_any',
    values: { require_any: [matched ? 'Animation' : 'Horror'] }, semantics: 'identity', constraint_mode: 'advisory',
    source, ...(source === 'media_server_library_profile' ? { inference_state: 'inferred' } : {}) });
  const purpose = origin === 'mixed' ? [rule('operator_declared_intent'), rule('media_server_library_profile')] :
    [rule(origin === 'declared_native' ? 'operator_declared_intent' : origin === 'profile_derived' ? 'media_server_library_profile' : 'unknown')];
  const policy = { id: 14, library_id: 4, library_media_type: 'movie', combination_mode: mode,
    policy_runtime_authority: { sourceId: 'native_intent', statusId: 'native_intent_active', validationOk: true },
    policy_intent_contract: { source: 'native_intent', policy_id: 14, library_id: 4, validation: { valid: true }, purpose,
      hard_limits: [], helpful_hints: [], avoid: [], review_behavior: { combination_mode: mode } } };
  const item = { media_type: 'movie', tmdb_id: 42, genres: ['Animation'] };
  const runtime = evaluateNativePolicyIntent(policy, item);
  const proof = refinePolicyPurposeMatchEvidence(runtime.purposeEvidence, policy, item, specificity);
  const candidate = { policy_id: 14, library_id: 4, score: 70, candidate_diagnostics: {
    purpose_evidence: proof, identity_evidence: { status_id: specificity }, positive_sources: {},
    native_intent_runtime: { eligible: runtime.eligible, rule_counts: runtime.ruleCounts } } };
  const classification = { ...item, method: 'policy_engine' };
  const sourceMetadata = { policyResult: { ranked: [candidate] }, classification_details: {
    candidate_capture: buildClassificationCandidateCapture({ method: 'policy_engine', policyResult: { ranked: [candidate] } }),
    ranked_candidates: [candidate] } };
  return { policy, item, runtime, proof, classification, candidate, sourceMetadata };
}
