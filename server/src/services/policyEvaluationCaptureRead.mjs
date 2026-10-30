/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_PROSPECTIVE_OUTCOME_SQL } from './inventoryProspectiveOutcomeRepository.mjs';
import { POLICY_EVALUATION_GAPS, validPolicyEvaluationCapture } from './policyEvaluationCaptureContract.mjs';
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';
import { prospectiveClassificationId, prospectiveTimestamp } from './inventoryProspectiveValues.mjs';

// Only the explicit private report selects this sidecar. No policy/library configuration joins.
export const READ_POLICY_EVALUATION_INPUT_SQL = `WITH source_rows AS MATERIALIZED (${INVENTORY_PROSPECTIVE_OUTCOME_SQL}),
  audit_rows AS MATERIALIZED (SELECT r.*, CASE WHEN c.classification_id IS NOT NULL THEN jsonb_build_object(
    'classificationId',c.classification_id::text,'version',c.capture_version,'mediaType',c.media_type,
    'identityKey',c.identity_key,'observedAt',c.observed_at,'expiresAt',c.expires_at,'expiredAt',c.expired_at,
    'reasonId',c.reason_id,'payload',CASE WHEN c.expires_at>$2::timestamptz AND c.expired_at IS NULL
      AND octet_length(c.payload::text)<=65536 THEN c.payload END) END AS policy_evaluation
    FROM source_rows r LEFT JOIN classification_policy_evaluation_captures c ON c.classification_id=r.classification_id),
  budget AS (SELECT COUNT(*)::int AS captures,COALESCE(SUM(octet_length(to_jsonb(r)::text)),0)::text AS payload_bytes FROM audit_rows r)
  SELECT to_jsonb(r)||jsonb_build_object('classification_id',r.classification_id::text) AS input,b.captures,b.payload_bytes
  FROM audit_rows r CROSS JOIN budget b WHERE b.captures<=5000 AND b.payload_bytes::bigint<=$3::bigint
  UNION ALL SELECT NULL,b.captures,b.payload_bytes FROM budget b
  WHERE b.captures=0 OR b.captures>5000 OR b.payload_bytes::bigint>$3::bigint`;

/** Validates historical evidence only; optional diagnostic failures never alter shared cohort eligibility. */
export function readPolicyEvaluationContext(row, now) {
  const fail = reason => ({ status: 'unavailable', reason });
  const record = row.policy_evaluation;
  if (record == null) return fail('missing');
  const key = inventoryRankingItemIdentity(row), observed = prospectiveTimestamp(record.observedAt), expires = prospectiveTimestamp(record.expiresAt);
  if (!prospectiveClassificationId(record.classificationId) || record.classificationId !== prospectiveClassificationId(row.classification_id) ||
    record.mediaType !== row.media_type || record.identityKey !== key) return fail('binding_failure');
  if (![1, 2].includes(record.version) || !Number.isFinite(observed) || !Number.isFinite(expires) || expires - observed !== 30 * 86400000 ||
    observed > prospectiveTimestamp(row.recorded_at) || !Number.isFinite(prospectiveTimestamp(row.recorded_at)) ||
    observed > now || !Number.isFinite(now)) return fail('capture_invalid');
  if (record.reasonId !== 'complete') return POLICY_EVALUATION_GAPS.includes(record.reasonId) &&
    record.payload === null && record.expiredAt === null ? fail(record.reasonId) : fail('capture_invalid');
  if (expires <= now) return fail('expired');
  const payload = record.payload;
  if (record.expiredAt !== null || !validPolicyEvaluationCapture(payload) || payload.version !== `policy_evaluation.v${record.version}`) return fail('capture_invalid');
  if (payload.identityKey !== key || payload.mediaType !== record.mediaType || Date.parse(payload.capturedAt) !== observed) return fail('binding_failure');
  // Every nested field was closed and validated above. Return a detached JSON projection, never the source row/header.
  return { status: 'available', reference: 'retained_policy_evaluation', ...JSON.parse(JSON.stringify(payload)) };
}
