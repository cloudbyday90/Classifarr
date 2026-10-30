/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validPolicyEvaluationCapture } from './policyEvaluationCaptureContract.mjs';
import { validFrozenPolicyPurposeEvidence } from './policyPurposeMatchEvidence.mjs';

export const PURPOSE_OUTCOME_GAPS = Object.freeze(['missing_capture', 'legacy_capture', 'expired_capture', 'capture_gap',
  'invalid_capture', 'unverified_purpose', 'no_policy_leader', 'source_only_identity', 'binding_failure', 'legacy_event']);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const id = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
export const purposeOutcomeTime = value => value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;

export function validPurposeOutcomeReference(value) {
  return exact(value, ['version', 'captureVersion', 'capturedAt', 'expiresAt', 'policyId', 'libraryId', 'score', 'purposeEvidence']) &&
    value.version === 'policy.purpose_outcome_reference.v1' && value.captureVersion === 'policy_evaluation.v2' &&
    Number.isFinite(purposeOutcomeTime(value.capturedAt)) && Number.isFinite(purposeOutcomeTime(value.expiresAt)) &&
    purposeOutcomeTime(value.expiresAt) - purposeOutcomeTime(value.capturedAt) === 30 * 86400000 &&
    id(value.policyId) && id(value.libraryId) && typeof value.score === 'number' && Number.isFinite(value.score) &&
    Math.abs(value.score) <= 1000000 && validFrozenPolicyPurposeEvidence(value.purposeEvidence);
}

/** Never read current policy/History diagnostics. The caller supplies an exact immutable child row. */
export function buildPurposeOutcomeReference(capture, context, now) {
  const gap = reason => ({ reason, payload: null, expiresAt: new Date(purposeOutcomeTime(context.observedAt) + 30 * 86400000).toISOString() });
  if (context.priorAlias) return gap('legacy_event');
  if (context.identityKey.startsWith('source:')) return gap('source_only_identity');
  if (!capture) return gap('missing_capture');
  if (String(capture.classification_id) !== context.classificationId || capture.media_type !== context.mediaType ||
      capture.identity_key !== context.identityKey) return gap('binding_failure');
  if (capture.capture_version === 1) return gap('legacy_capture');
  const captured = purposeOutcomeTime(capture.observed_at), expires = purposeOutcomeTime(capture.expires_at);
  if (capture.capture_version !== 2 || !Number.isFinite(captured) || !Number.isFinite(expires) || expires - captured !== 30 * 86400000 ||
      captured > purposeOutcomeTime(context.observedAt) || captured > now) return gap('invalid_capture');
  if (expires <= now || capture.expired_at !== null) return gap('expired_capture');
  if (capture.reason_id !== 'complete') return gap('capture_gap');
  const payload = capture.payload;
  if (!validPolicyEvaluationCapture(payload) || payload.version !== 'policy_evaluation.v2' ||
      payload.identityKey !== context.identityKey || payload.mediaType !== context.mediaType || Date.parse(payload.capturedAt) !== captured) return gap('invalid_capture');
  const leader = payload.ranked[0];
  if (!leader) return gap('no_policy_leader');
  const candidate = payload.candidates.find(value => value.policyId === leader.policyId && value.libraryId === leader.libraryId);
  if (!candidate?.purposeEvidence) return gap('unverified_purpose');
  const reference = { version: 'policy.purpose_outcome_reference.v1', captureVersion: payload.version,
    capturedAt: payload.capturedAt, expiresAt: new Date(expires).toISOString(), policyId: leader.policyId, libraryId: leader.libraryId,
    score: leader.score, purposeEvidence: { ...candidate.purposeEvidence } };
  if (!validPurposeOutcomeReference(reference)) return gap('invalid_capture');
  return { reason: 'available', payload: reference,
    expiresAt: new Date(Math.min(expires, purposeOutcomeTime(context.observedAt) + 30 * 86400000)).toISOString() };
}
