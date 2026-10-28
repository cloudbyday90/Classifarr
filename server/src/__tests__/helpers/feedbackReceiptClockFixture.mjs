/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Disposable fixture creation, not a runtime clock rewrite: the real UPDATE guard stays enabled. */
export async function recreateFeedbackReceiptAt(client, classificationId, createdAt) {
  const result = await client.query(`WITH fixture AS (
    DELETE FROM policy_feedback_sources WHERE classification_id=$1 RETURNING *
  ) INSERT INTO policy_feedback_sources(classification_id,feedback_id,intake,request_fingerprint,created_at,outcome_snapshot)
    SELECT classification_id,feedback_id,intake,request_fingerprint,$2::timestamptz,outcome_snapshot FROM fixture`,
  [classificationId, createdAt]);
  if (result.rowCount !== 1) throw new Error('feedback_receipt_fixture_missing');
}
