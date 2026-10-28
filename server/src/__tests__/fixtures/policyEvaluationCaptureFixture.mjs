/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createLivePolicyEvaluationCapture, getLivePolicyEvaluationCapture } from '../../services/policyEvaluationCapture.mjs';

export function policyEvaluationFixture({ policyId = 10, libraryId = 1, source = 'native_intent', provenance = 'declared_native' } = {}) {
  const rule = kind => kind === 'profile_derived' ? { source: 'media_server_library_profile', inference_state: 'inferred' } :
    kind === 'declared_native' ? { source: 'operator_declared_intent' } : { source: 'unknown' };
  const policy = { id: policyId, name: 'PRIVATE POLICY', library_id: libraryId, library_name: 'PRIVATE LIBRARY', library_media_type: 'movie',
    policy_runtime_authority: { sourceId: source, statusId: source === 'native_intent' ? 'native_intent_active' : 'compatibility_bridge_fallback', validationOk: true },
    policy_intent_contract: { policy_id: policyId, library_id: libraryId, validation: { valid: true },
      purpose: provenance === 'mixed' ? [rule('profile_derived'), rule('declared_native')] : [rule(provenance)] } };
  const evaluation = { policy_id: policyId, library_id: libraryId, policy_name: 'PRIVATE POLICY', library_name: 'PRIVATE LIBRARY', score: 42,
    scores: { preset: 0, intent: 42, pattern: 0, rag: 0, history: 0, profile: 10 },
    weights: { preset: 0, intent: .35, pattern: .15, rag: .15, history: .1, profile: .25 },
    auto_classify_threshold: 85, prompt_threshold: 60,
    native_intent_runtime: source !== 'native_intent' ? null : { statusId: 'native_intent_runtime_active', eligible: true,
      ...(provenance === 'profile_derived' || provenance === 'mixed' ? { admissionBasis: 'inferred_profile_ranking' } : {}) } };
  return { policy, evaluation };
}

export function mintPolicyEvaluationFixture(item = { media_type: 'movie', tmdb_id: 42 }, options = {}) {
  const { policy, evaluation } = policyEvaluationFixture(options), collector = createLivePolicyEvaluationCapture(item);
  collector.start([policy], [policy], 0); collector.record(evaluation);
  const retained = collector.finish({ ranked: [{ ...evaluation, score: 37 }] });
  return { item, policy, evaluation, retained, capture: getLivePolicyEvaluationCapture(retained), result: { policyResult: retained } };
}

export function persistedPolicyEvaluationFixture(row) {
  const fixture = mintPolicyEvaluationFixture({ media_type: row.media_type, tmdb_id: row.tmdb_id });
  const payload = structuredClone(fixture.capture.payload);
  payload.capturedAt = '2026-10-28T17:57:30.000Z';
  return { classificationId: String(row.classification_id), version: 1, mediaType: row.media_type, identityKey: payload.identityKey,
    observedAt: payload.capturedAt, expiresAt: '2026-11-27T17:57:30.000Z', expiredAt: null, reasonId: 'complete', payload };
}
