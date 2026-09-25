/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const READ_INTAKE_DECISION_RECOVERY_SQL = `
  WITH batch AS MATERIALIZED (
    SELECT queue_task_id, classification_id FROM classification_intake_receipts
    WHERE queue_task_id > $1::bigint AND classification_id IS NOT NULL
      AND decision_context IS NULL
      AND queued_at > statement_timestamp() - INTERVAL '30 days'
      AND queued_at <= statement_timestamp()
    ORDER BY queue_task_id LIMIT 500
  )
  SELECT batch.queue_task_id, batch.classification_id, history.media_type, history.tmdb_id, history.method,
    CASE WHEN octet_length((history.metadata #> '{classification_details,destination_decision}')::text) <= 1024
      THEN history.metadata #> '{classification_details,destination_decision}' END AS capture
  FROM batch LEFT JOIN classification_history history ON history.id = batch.classification_id
  ORDER BY batch.queue_task_id
`;

// Lock only eligible receipts. A competing live write wins; a later sweep can retry.
export const FILL_INTAKE_DECISION_CONTEXTS_SQL = `
  WITH candidates AS (
    SELECT * FROM jsonb_to_recordset($1::jsonb)
      AS candidate(queue_task_id bigint, classification_id integer, decision_context jsonb)
  ), ready AS MATERIALIZED (
    SELECT receipt.queue_task_id, candidate.classification_id, candidate.decision_context
    FROM candidates candidate
    JOIN classification_intake_receipts receipt ON receipt.queue_task_id = candidate.queue_task_id
      AND receipt.classification_id = candidate.classification_id
    JOIN classification_history history ON history.id = candidate.classification_id
    WHERE receipt.decision_context IS NULL
      AND receipt.queued_at > statement_timestamp() - INTERVAL '30 days'
      AND receipt.queued_at <= statement_timestamp()
      AND history.metadata #> '{classification_details,destination_decision}' = candidate.decision_context->'capture'
      AND history.media_type = candidate.decision_context #>> '{capture,mediaType}'
      AND history.method = candidate.decision_context #>> '{capture,method}'
      AND history.tmdb_id::text IS NOT DISTINCT FROM candidate.decision_context #>> '{capture,tmdbId}'
    ORDER BY receipt.queue_task_id
    FOR UPDATE OF receipt SKIP LOCKED
  )
  UPDATE classification_intake_receipts receipt
  SET decision_context = ready.decision_context, updated_at = statement_timestamp()
  FROM ready WHERE receipt.queue_task_id = ready.queue_task_id
    AND receipt.classification_id = ready.classification_id AND receipt.decision_context IS NULL
`;
