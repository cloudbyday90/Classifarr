/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { POLICY_EVALUATION_GAPS, validPolicyEvaluationCapture } from './policyEvaluationCaptureContract.mjs';
import { purposeOutcomeTime } from './purposeOutcomeReference.mjs';

export const PURPOSE_POLICY_CONTEXT_GAPS = Object.freeze([...new Set(['missing', 'legacy_capture', 'expired',
  'leader_mismatch', ...POLICY_EVALUATION_GAPS])]);
const keys = ['classificationId', 'version', 'mediaType', 'identityKey', 'observedMicros', 'expiresMicros',
  'reasonId', 'expiredAt', 'payloadBytes', 'payload'];
const micros = value => typeof value === 'string' && /^[0-9]{1,20}$/.test(value) ? BigInt(value) : null;
const millisToMicros = value => BigInt(purposeOutcomeTime(value)) * 1000n;

/** Optional evidence only. A context failure never repairs or changes the already-prepared purpose cohort. */
export function readPurposePolicyContext(event, record, now) {
  const fail = reason => ({ status: 'unavailable', reason });
  if (record == null) return fail('missing');
  if (typeof record !== 'object' || Array.isArray(record) || Object.keys(record).length !== keys.length ||
      !keys.every(key => Object.hasOwn(record, key))) return fail('capture_invalid');
  if (record.classificationId !== event.classificationId || record.mediaType !== event.mediaType ||
      record.identityKey !== event.identityKey) return fail('binding_failure');
  const observed = micros(record.observedMicros), expires = micros(record.expiresMicros);
  if (observed === null || expires === null || expires - observed !== 30n * 86400000000n ||
      !Number.isFinite(now) || !Number.isFinite(event.at) || observed > BigInt(event.at) * 1000n || observed > BigInt(now) * 1000n ||
      ![1, 2].includes(record.version)) return fail('capture_invalid');
  if (expires <= BigInt(now) * 1000n) return fail('expired');
  if (record.version === 1) return fail('legacy_capture');
  if (record.expiredAt !== null) return fail('capture_invalid');
  if (record.reasonId !== 'complete') return POLICY_EVALUATION_GAPS.includes(record.reasonId) &&
      record.payload === null && record.payloadBytes === null ? fail(record.reasonId) : fail('capture_invalid');
  if (Number.isInteger(record.payloadBytes) && record.payloadBytes > 65536) return fail('payload_overflow');
  const payload = record.payload;
  if (!Number.isInteger(record.payloadBytes) || record.payloadBytes <= 0 || !validPolicyEvaluationCapture(payload) ||
      payload.version !== 'policy_evaluation.v2') return fail('capture_invalid');
  if (payload.identityKey !== event.identityKey || payload.mediaType !== event.mediaType ||
      millisToMicros(payload.capturedAt) !== observed || observed !== millisToMicros(event.payload.capturedAt) ||
      expires !== millisToMicros(event.payload.expiresAt)) return fail('binding_failure');
  const leader = payload.ranked[0], frozen = event.payload;
  const candidate = payload.candidates.find(row => row.policyId === leader?.policyId);
  if (!leader || leader.policyId !== frozen.policyId || leader.libraryId !== frozen.libraryId || leader.score !== frozen.score ||
      !candidate?.purposeEvidence || !Object.keys(frozen.purposeEvidence).every(key => candidate.purposeEvidence[key] === frozen.purposeEvidence[key])) {
    return fail('leader_mismatch');
  }
  // The closed capture validator admits only numeric/fixed-category evidence and canonical typed identity/time.
  return { status: 'available', reference: 'retained_policy_evaluation', expiresAt: new Date(purposeOutcomeTime(frozen.expiresAt)).toISOString(),
    ...JSON.parse(JSON.stringify(payload)) };
}
