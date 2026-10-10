-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Refine only the known stage. Never infer a historical 404 or replay a task.
WITH refined AS (
    UPDATE task_queue
    SET error_message = 'task_metadata_fetch_failed'
    WHERE task_type = 'classification' AND status = 'failed'
      AND current_stage = 'metadata_fetch'
      AND error_message = 'task_processing_failed'
      AND claim_token IS NULL AND routing_classification_id IS NULL
    RETURNING id
)
UPDATE classification_intake_receipts AS receipt
SET last_failure_code = 'task_metadata_fetch_failed'
FROM refined
WHERE receipt.queue_task_id = refined.id
  AND receipt.status_id = 'failed'
  AND receipt.last_failure_code = 'task_processing_failed';
