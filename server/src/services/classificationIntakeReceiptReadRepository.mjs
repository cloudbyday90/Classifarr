/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const FIELDS = `queue_task_id, webhook_log_id, classification_id, source_class,
  status_id, comparison_status_id, comparison_reason_id, attempt_count,
  last_failure_code, queued_at, started_at, finished_at, classification_linked_at`;

export const CLASSIFICATION_INTAKE_RECEIPT_ROWS_SQL = `
  SELECT ${FIELDS} FROM classification_intake_receipts
  WHERE queued_at >= $1::timestamptz AND queued_at < $2::timestamptz
  ORDER BY queued_at, queue_task_id LIMIT $3::integer
`;

export const CLASSIFICATION_INTAKE_RECEIPT_GROUPS_SQL = `
  SELECT status_id, comparison_status_id, comparison_reason_id, COUNT(*)::bigint AS event_count
  FROM classification_intake_receipts
  WHERE queued_at >= $1::timestamptz AND queued_at < $2::timestamptz
  GROUP BY status_id, comparison_status_id, comparison_reason_id
  ORDER BY status_id, comparison_status_id, comparison_reason_id
`;

export const CLASSIFICATION_INTAKE_WEBHOOK_GROUPS_SQL = `
  SELECT CASE WHEN processing_status IN ('received', 'queued', 'skipped', 'completed', 'failed')
    THEN processing_status ELSE 'other' END AS status_id,
    COUNT(*)::bigint AS event_count
  FROM webhook_log
  WHERE received_at >= $1::timestamptz AND received_at < $2::timestamptz
  GROUP BY 1 ORDER BY 1
`;

export const CLASSIFICATION_INTAKE_RECEIPT_BY_TASK_SQL = `
  SELECT ${FIELDS} FROM classification_intake_receipts WHERE queue_task_id = $1::bigint
`;
