/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** One sequence allocation binds the actual row and its review frame in the existing transaction. */
export function insertCurrentPolicyReview(executor, values) {
  return executor.query(`WITH assigned_id AS MATERIALIZED (
  SELECT nextval(pg_get_serial_sequence('public.classification_history', 'id')::regclass) AS id
)
INSERT INTO classification_history
  (id, tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status, collection_id, signals_json, pending_reason, policy_question, profile_snapshot, retry_after, retry_count, max_retries, director_name, primary_studio_name, genre_names, cast_ids, cast_names, pending_identity_key, retry_failure_code, retry_recovery_attempts)
SELECT id, $1, $2, $3, $4, $5, $6, $7, $8, $9,
  jsonb_set($10::jsonb, '{classification_details,current_policy_review,classification_id}', to_jsonb(id::text), true),
  $11, $12, $13, $14, $15, $16, $17::timestamptz, $18, $19, $20, $21, $22, $23, $24, $25, $26,
  COALESCE((SELECT classification_recovery_attempts FROM task_queue WHERE id = $27),
    CASE WHEN $27::bigint IS NULL THEN 0 ELSE 1 END)
FROM assigned_id
RETURNING id`, values);
}
