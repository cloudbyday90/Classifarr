/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const sourceClass = alias => `CASE ${alias}.source
  WHEN 'webhook' THEN 'webhook' WHEN 'manual' THEN 'manual'
  WHEN 'reprocess' THEN 'reprocess' ELSE 'other' END`;
const taskStatus = alias => `CASE ${alias}.status
  WHEN 'pending' THEN CASE WHEN ${alias}.attempts > 0 THEN 'retry_scheduled' ELSE 'queued' END
  WHEN 'processing' THEN 'processing' WHEN 'completed' THEN 'completed'
  WHEN 'failed' THEN 'failed' WHEN 'cancelled' THEN 'cancelled' ELSE 'queued' END`;

export const UPSERT_CLASSIFICATION_INTAKE_RECEIPT_SQL = `
  INSERT INTO classification_intake_receipts AS receipt
    (queue_task_id, webhook_log_id, source_class, queued_at, started_at, finished_at,
     status_id, attempt_count, classification_id, comparison_status_id,
     comparison_reason_id, last_failure_code, classification_linked_at, decision_context)
  SELECT task.id, task.webhook_log_id, ${sourceClass('task')},
    task.created_at AT TIME ZONE current_setting('TimeZone'),
    task.started_at AT TIME ZONE current_setting('TimeZone'),
    task.completed_at AT TIME ZONE current_setting('TimeZone'),
    ${taskStatus('task')},
    GREATEST(task.attempts, COALESCE($2::integer, 0)), $3::integer,
    COALESCE($4::text, 'not_evaluated'), $5::text, $6::text,
    CASE WHEN $3::integer IS NOT NULL THEN statement_timestamp() END, $7::jsonb
  FROM task_queue AS task
  WHERE task.id = $1 AND task.task_type = 'classification'
  ON CONFLICT (queue_task_id) DO UPDATE SET
    webhook_log_id = COALESCE(EXCLUDED.webhook_log_id, receipt.webhook_log_id),
    source_class = EXCLUDED.source_class,
    queued_at = LEAST(receipt.queued_at, EXCLUDED.queued_at),
    started_at = COALESCE(receipt.started_at, EXCLUDED.started_at),
    finished_at = COALESCE(EXCLUDED.finished_at, receipt.finished_at),
    status_id = CASE
      WHEN EXCLUDED.attempt_count < receipt.attempt_count THEN receipt.status_id
      WHEN receipt.status_id IN ('completed', 'failed', 'cancelled')
        AND EXCLUDED.status_id IN ('queued', 'processing', 'retry_scheduled')
        AND EXCLUDED.attempt_count = receipt.attempt_count THEN receipt.status_id
      ELSE EXCLUDED.status_id END,
    attempt_count = GREATEST(receipt.attempt_count, EXCLUDED.attempt_count),
    classification_id = COALESCE($3::integer, receipt.classification_id),
    decision_context = CASE
      WHEN $3::integer IS NULL THEN receipt.decision_context
      WHEN $3::integer = receipt.classification_id THEN COALESCE(receipt.decision_context, $7::jsonb)
      ELSE $7::jsonb END,
    comparison_status_id = CASE WHEN $4::text IS NULL THEN receipt.comparison_status_id
      ELSE EXCLUDED.comparison_status_id END,
    comparison_reason_id = CASE WHEN $4::text IS NULL THEN receipt.comparison_reason_id
      ELSE EXCLUDED.comparison_reason_id END,
    last_failure_code = COALESCE($6::text, receipt.last_failure_code),
    classification_linked_at = COALESCE(EXCLUDED.classification_linked_at,
      receipt.classification_linked_at),
    updated_at = statement_timestamp()
`;

export const RECONCILE_CLASSIFICATION_INTAKE_RECEIPTS_SQL = `
  WITH missing AS (
    SELECT task.id, task.webhook_log_id, task.source, task.created_at, task.started_at,
      task.completed_at, task.status, task.attempts
    FROM task_queue AS task
    WHERE task.task_type = 'classification'
      AND task.created_at >= statement_timestamp() - INTERVAL '30 days'
      AND NOT EXISTS (SELECT 1 FROM classification_intake_receipts AS receipt
        WHERE receipt.queue_task_id = task.id)
    ORDER BY task.created_at, task.id LIMIT 500
  )
  INSERT INTO classification_intake_receipts
    (queue_task_id, webhook_log_id, source_class, queued_at, started_at, finished_at,
     status_id, attempt_count)
  SELECT missing.id, missing.webhook_log_id, ${sourceClass('missing')},
    missing.created_at AT TIME ZONE current_setting('TimeZone'),
    missing.started_at AT TIME ZONE current_setting('TimeZone'),
    missing.completed_at AT TIME ZONE current_setting('TimeZone'),
    ${taskStatus('missing')}, missing.attempts
  FROM missing ON CONFLICT (queue_task_id) DO NOTHING
`;

export const RECONCILE_CLASSIFICATION_INTAKE_LINKS_SQL = `
  WITH latest AS (
    SELECT DISTINCT ON (receipt.queue_task_id)
      receipt.queue_task_id, witness.classification_id,
      history.metadata #>> '{classification_details,inventory_ranking_shadow_status_id}' AS comparison_status_id,
      CASE WHEN history.metadata #>> '{classification_details,inventory_ranking_shadow_reason_id}' IN (
        'not_applicable_media', 'no_policy_result', 'no_eligible_pool',
        'invalid_candidate_pool', 'candidate_pool_size', 'retrieval_unavailable',
        'retrieval_mismatch', 'description_unavailable', 'comparison_incomplete',
        'identity_mismatch', 'capture_disabled', 'capture_invalid',
        'unexpected_error', 'not_observed')
        THEN history.metadata #>> '{classification_details,inventory_ranking_shadow_reason_id}'
      END AS safe_reason_id
    FROM classification_intake_receipts AS receipt
    JOIN classification_queue_decision_witnesses AS witness
      ON witness.queue_task_id = receipt.queue_task_id
    JOIN classification_history AS history ON history.id = witness.classification_id
    WHERE receipt.classification_id IS NULL
      AND receipt.queued_at >= statement_timestamp() - INTERVAL '30 days'
    ORDER BY receipt.queue_task_id, witness.created_at DESC, witness.classification_id DESC
    LIMIT 500
  )
  UPDATE classification_intake_receipts AS receipt
  SET classification_id = latest.classification_id::integer,
    comparison_status_id = CASE
      WHEN latest.comparison_status_id = 'captured' THEN 'captured'
      WHEN latest.comparison_status_id = 'not_captured' AND latest.safe_reason_id IS NOT NULL
        THEN 'not_captured'
      ELSE receipt.comparison_status_id END,
    comparison_reason_id = CASE
      WHEN latest.comparison_status_id = 'captured' THEN NULL
      WHEN latest.comparison_status_id = 'not_captured' AND latest.safe_reason_id IS NOT NULL
        THEN latest.safe_reason_id
      ELSE receipt.comparison_reason_id END,
    classification_linked_at = statement_timestamp(), updated_at = statement_timestamp()
  FROM latest WHERE receipt.queue_task_id = latest.queue_task_id
`;

export const PRUNE_CLASSIFICATION_INTAKE_RECEIPTS_SQL = `
  WITH expired AS (
    SELECT queue_task_id FROM classification_intake_receipts
    WHERE queued_at < statement_timestamp() - INTERVAL '30 days'
    ORDER BY queued_at, queue_task_id LIMIT 500
  )
  DELETE FROM classification_intake_receipts AS receipt USING expired
  WHERE receipt.queue_task_id = expired.queue_task_id
`;

export class ClassificationIntakeReceiptRepository {
  constructor({ db }) { this.db = db; }

  async upsert(values) {
    const result = await this.db.query(UPSERT_CLASSIFICATION_INTAKE_RECEIPT_SQL, values);
    return result?.rowCount === 1;
  }

  async reconcile() {
    const result = await this.db.query(RECONCILE_CLASSIFICATION_INTAKE_RECEIPTS_SQL);
    return result?.rowCount ?? 0;
  }

  async reconcileClassificationLinks() {
    const result = await this.db.query(RECONCILE_CLASSIFICATION_INTAKE_LINKS_SQL);
    return result?.rowCount ?? 0;
  }

  async prune() {
    const result = await this.db.query(PRUNE_CLASSIFICATION_INTAKE_RECEIPTS_SQL);
    return result?.rowCount ?? 0;
  }
}
