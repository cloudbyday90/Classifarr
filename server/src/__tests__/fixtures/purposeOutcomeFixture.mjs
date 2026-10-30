/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { purposeMatchFixture } from './purposeMatchEvidenceFixture.mjs';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { applySpecializedDestinationIdentityEvidence } from '../../services/policySpecializedDestinationIdentityEvidence.mjs';
import { createLivePolicyEvaluationCapture, getLivePolicyEvaluationCapture } from '../../services/policyEvaluationCapture.mjs';
import { buildPurposeOutcomeReference } from '../../services/purposeOutcomeReference.mjs';
import { authorizedEvaluationRow } from '../helpers/authorizedOutcomeEvaluationFixture.mjs';

export function livePurposeEvaluationFixture({ tmdbId = 42, mediaType = 'movie', libraryId = 4, policyId = 14, origin = 'declared_native' } = {}) {
  const { policy } = purposeMatchFixture({ origin });
  Object.assign(policy, { id: policyId, library_id: libraryId, library_media_type: mediaType });
  Object.assign(policy.policy_intent_contract, { policy_id: policyId, library_id: libraryId });
  const item = { media_type: mediaType, tmdb_id: tmdbId, genres: ['Animation'] };
  const runtime = evaluateNativePolicyIntent(policy, item);
  const raw = { policy_id: policyId, library_id: libraryId, score: 70, native_intent_runtime: runtime,
    scores: { preset: 0, intent: runtime.score, pattern: 0, rag: 0, history: 0, profile: 0 },
    weights: { preset: 0, intent: 1, pattern: 0, rag: 0, history: 0, profile: 0 },
    auto_classify_threshold: 85, prompt_threshold: 60, candidate_diagnostics: { purpose_evidence: runtime.purposeEvidence } };
  const collector = createLivePolicyEvaluationCapture(item);
  collector.start([policy], [policy], 0); collector.record(raw);
  const ranked = applySpecializedDestinationIdentityEvidence({ evaluations: [raw], policies: [policy], item });
  const retained = collector.finish({ ranked });
  return { item, policy, raw, ranked, collector, retained, capture: getLivePolicyEvaluationCapture(retained), result: { policyResult: retained } };
}

export const PURPOSE_COHORT_NOW = '2026-10-29T12:00:00.000Z';
export function purposeCohortRow({ classificationId = '1', tmdbId = 42, destination = 4, action = 'correction',
  at = '2026-10-29T10:00:00.000Z', eventKey = `classification_correction:${classificationId}`, origin = 'declared_native', mediaType = 'movie' } = {}) {
  const fixture = livePurposeEvaluationFixture({ tmdbId, origin, mediaType });
  const payload = structuredClone(fixture.capture.payload);
  payload.capturedAt = '2026-10-29T09:00:00.000Z';
  const context = { classificationId, observedAt: at, mediaType, identityKey: `${mediaType}:${tmdbId}` };
  const capture = { classification_id: classificationId, capture_version: 2, media_type: mediaType, identity_key: context.identityKey,
    observed_at: payload.capturedAt, expires_at: '2026-11-28T09:00:00.000Z', expired_at: null, reason_id: 'complete', payload };
  const reference = buildPurposeOutcomeReference(capture, context, Date.parse(at));
  const source = authorizedEvaluationRow({ classification_id: classificationId, source_id: classificationId, identity_key: context.identityKey, tmdb_id: tmdbId, media_type: mediaType,
    selected_library_id: destination, was_correction: action === 'correction', observed_at: at, decision_context: null,
    authorized_snapshot: { snapshot_version: 1, event_key: eventKey, action_kind: action, snapshot_missing: false, binding_valid: true } });
  const supplement = { event_key: eventKey, classification_id: classificationId, authorized_receipt_id: classificationId,
    feedback_classification_id: null, supplement_version: 1, source_kind: 'manual', action_reference: 'manual_prior_destination',
    media_type: mediaType, identity_key: context.identityKey, selected_library_id: destination, action_kind: action,
    observed_at: at, frozen_at: at, expires_at: reference.expiresAt, reason_id: reference.reason, payload: reference.payload, expired_at: null };
  return { event_key: eventKey, classification_id: classificationId, observed_at: at, observed_order: String(Date.parse(at) * 1000), origin: 'authorized', source,
    supplement, holdout_identity: context.identityKey };
}
export const purposeCohortInput = rows => ({ observedAt: PURPOSE_COHORT_NOW,
  window: { since: '2026-09-29T12:00:00.000Z', until: PURPOSE_COHORT_NOW }, rows });
