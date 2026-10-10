/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { STALE_AWAITING_DECISION_DAYS } from '../constants/classificationFlow.mjs';

export const STALE_CLASSIFICATION_BATCH_SIZE = 100;

const HANDOFF_SQL = `
  WITH candidates AS MATERIALIZED (
    SELECT history.id, history.title, history.tmdb_id, history.media_type
    FROM classification_history history
    WHERE history.status = 'awaiting_decision'
      AND history.created_at < NOW() - ($1::integer * INTERVAL '1 day')
      AND history.media_type IN ('movie', 'tv') AND history.tmdb_id > 0
      AND LENGTH(BTRIM(history.title)) > 0
      AND (history.metadata IS NULL OR jsonb_typeof(history.metadata) = 'object')
      AND NOT (COALESCE(history.metadata, '{}'::jsonb) ? 'stale_cleanup')
    ORDER BY history.created_at, history.id
    LIMIT $2::integer
    FOR UPDATE OF history SKIP LOCKED
  ), admitted AS (
    INSERT INTO task_queue (task_type, priority, payload, status)
    SELECT 'classification', 5,
      jsonb_build_object('tmdb_id', tmdb_id, 'media_type', media_type, 'title', title,
        'source', 'stale_cleanup', 'source_classification_id', id::text), 'pending'
    FROM candidates
    ON CONFLICT DO NOTHING
    RETURNING id, payload
  )
  UPDATE classification_history history
  SET status = 'pending',
      pending_reason = 'Re-queued after stale awaiting_decision; task ' || admitted.id::text,
      metadata = COALESCE(history.metadata, '{}'::jsonb) || jsonb_build_object(
        'stale_cleanup', jsonb_build_object('queue_task_id', admitted.id::text, 'admitted_at', NOW()))
  FROM admitted
  WHERE history.id = (admitted.payload->>'source_classification_id')::bigint
  RETURNING history.id AS classification_id, admitted.id AS queue_task_id
`;

/** Admit a bounded batch without exposing a pending row before its task exists. */
export function createStaleClassificationHandoffRepository({ withTransaction }) {
  return {
    handoff: () => withTransaction(async client => {
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      const { rows } = await client.query(HANDOFF_SQL,
        [STALE_AWAITING_DECISION_DAYS, STALE_CLASSIFICATION_BATCH_SIZE]);
      return rows;
    }),
  };
}
