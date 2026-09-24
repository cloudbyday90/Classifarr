/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { moveBlocked } from './reclassificationMoveContract.mjs';

// Persist the exact attempt reference before any file work. Never infer success
// from a library assignment, an error string, or a newer move for the same item.
export async function bindBatchMove(client, operation, batchItemId) {
  if (batchItemId === null) return;
  const result = await client.query(`UPDATE reclassification_batch_items item
    SET execution_result = jsonb_build_object('moveOperationId', $1::text), updated_at = NOW()
    WHERE item.id = $2 AND item.classification_id = $3 AND item.target_library_id = $4
      AND item.status = 'executing'
      AND EXISTS (SELECT 1 FROM reclassification_batches batch
        WHERE batch.id = item.batch_id AND batch.status = 'executing')
    RETURNING item.id`, [operation.id, batchItemId, operation.classification_id, operation.target_library_id]);
  if (!result.rows.length) throw moveBlocked('move_batch_changed', 'Batch execution was stopped or changed before this move started. No new file work was started.');
}

export async function completeBatchMove(client, operation) {
  // Legacy batch tables are created lazily; standalone moves must also work on
  // installations where no batch has ever been created.
  const relation = await client.query("SELECT to_regclass('public.reclassification_batch_items') AS relation");
  if (!relation.rows[0]?.relation) return;
  await client.query(`UPDATE reclassification_batch_items
    SET status = 'completed', error_message = NULL,
      execution_result = jsonb_build_object('moveOperationId', $1::text, 'success', true,
        'moveReconciled', true), updated_at = NOW()
    WHERE classification_id = $2 AND target_library_id = $3
      AND execution_result->>'moveOperationId' = $1
      AND status IN ('executing', 'failed', 'validated')`,
  [operation.id, operation.classification_id, operation.target_library_id]);
  // Pause/cancel are operator intent. Finishing one move must not resume a batch.
}

// Read counters from item outcomes, not increment-only counters that drift after
// retries, repeated skips, recovery, or a crash between the item and batch writes.
export const batchOutcomeCountsSql = `
  CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE status = 'completed')::integer AS completed_items,
      count(*) FILTER (WHERE status = 'failed')::integer AS failed_items,
      count(*) FILTER (WHERE status = 'skipped')::integer AS skipped_items,
      count(*) FILTER (WHERE status = 'cancelled')::integer AS cancelled_items
    FROM reclassification_batch_items WHERE batch_id = batch.id
  ) outcomes`;
