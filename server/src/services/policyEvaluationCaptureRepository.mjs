/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { projectHeldPolicyEvaluationCapture } from './policyEvaluationCapture.mjs';

/** Postcommit diagnostic only. Exact History binding and first-write conflict handling never refresh evidence. */
export async function persistPolicyEvaluationCapture(database, { classificationId, held, result, metadata }) {
  const id = canonicalDatabaseBigintId(classificationId);
  const capture = id && projectHeldPolicyEvaluationCapture(held, result, metadata, id);
  if (!capture || !id) return false;
  const saved = await database.query(`INSERT INTO classification_policy_evaluation_captures
    (classification_id, media_type, identity_key, observed_at, expires_at, reason_id, payload)
    SELECT ch.id, $2, $3, $4::timestamptz, $4::timestamptz + INTERVAL '720 hours', $5, $6::jsonb
    FROM classification_history ch WHERE ch.id = $1::bigint AND ch.media_type = $2
      AND ch.tmdb_id::text = split_part($3, ':', 2) AND ch.recorded_at >= $4::timestamptz
    ON CONFLICT (classification_id) DO NOTHING RETURNING classification_id`,
  [id, capture.mediaType, capture.identityKey, capture.capturedAt, capture.reasonId,
    capture.payload ? JSON.stringify(capture.payload) : null]);
  return saved.rowCount === 1;
}

/** Bounded, concurrent-safe expiry; keep the immutable row so later writes cannot refill it. */
export async function prunePolicyEvaluationCaptures(database) {
  const result = await database.query(`UPDATE classification_policy_evaluation_captures SET payload = NULL, expired_at = NOW()
    WHERE classification_id IN (SELECT classification_id FROM classification_policy_evaluation_captures
      WHERE payload IS NOT NULL AND expires_at <= NOW() ORDER BY expires_at, classification_id
      LIMIT 1000 FOR UPDATE SKIP LOCKED)`);
  return result.rowCount;
}
