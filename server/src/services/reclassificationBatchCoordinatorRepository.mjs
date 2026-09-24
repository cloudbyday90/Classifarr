/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AppError, NotFoundError } from '../utils/appError.mjs';

export function createBatchCoordinatorRepository(db) {
  return {
    async start(id) {
      const result = await db.query(`UPDATE reclassification_batches SET
        status='executing', started_at=COALESCE(started_at,NOW()),
        next_attempt_at=CASE WHEN status='executing' THEN next_attempt_at ELSE NOW() END,
        error_message=CASE WHEN status='executing' THEN error_message ELSE NULL END, updated_at=NOW()
        WHERE id=$1 AND status IN ('pending','validated','validation_failed','paused','executing') RETURNING id`, [id]);
      if (result.rows.length) return;
      const found = await db.query('SELECT id FROM reclassification_batches WHERE id=$1', [id]);
      if (!found.rows.length) throw new NotFoundError('Batch not found');
      throw new AppError('Batch cannot be started in its current state.', 409);
    },
    async claim() {
      return db.withTransaction(async client => {
        const batch = (await client.query(`SELECT * FROM reclassification_batches
          WHERE status='executing' AND next_attempt_at<=NOW()
          ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
        if (!batch) return null;
        await client.query(`UPDATE reclassification_batches
          SET next_attempt_at=NOW()+INTERVAL '30 seconds', updated_at=NOW() WHERE id=$1`, [batch.id]);
        const item = (await client.query(`SELECT * FROM reclassification_batch_items
          WHERE batch_id=$1 AND status IN ('executing','pending','validated')
          ORDER BY (status='executing') DESC,execution_order,id LIMIT 1 FOR UPDATE`, [batch.id])).rows[0];
        if (!item) {
          await client.query(`UPDATE reclassification_batches SET status='completed', completed_at=NOW(), updated_at=NOW()
            WHERE id=$1 AND status='executing'`, [batch.id]);
          return null;
        }
        const interrupted = item.status === 'executing';
        if (!interrupted) await client.query(`UPDATE reclassification_batch_items
          SET status='executing', execution_version=1, updated_at=NOW() WHERE id=$1`, [item.id]);
        return { batch, item, interrupted };
      });
    },
    async defer(batchId, seconds = 30) {
      await db.query(`UPDATE reclassification_batches SET next_attempt_at=NOW()+make_interval(secs=>$2), updated_at=NOW()
        WHERE id=$1 AND status='executing'`, [batchId, seconds]);
    },
    async stopped(item) {
      await db.query(`UPDATE reclassification_batch_items SET
        status=CASE WHEN batch.status='cancelled' THEN 'cancelled' ELSE 'validated' END, updated_at=NOW()
        FROM reclassification_batches batch WHERE reclassification_batch_items.id=$1
          AND batch.id=reclassification_batch_items.batch_id AND batch.status IN ('paused','cancelled')
          AND reclassification_batch_items.status='executing'
          AND reclassification_batch_items.execution_result->>'moveOperationId' IS NULL`, [item.id]);
    },
    async success(item, result) {
      await db.query(`UPDATE reclassification_batch_items SET status='completed', error_message=NULL,
        execution_result=COALESCE(execution_result,'{}'::jsonb)||$2::jsonb, updated_at=NOW()
        WHERE id=$1 AND status IN ('executing','completed')`, [item.id, JSON.stringify(result)]);
    },
    async failure({ batch, item }, message, forcePause = false) {
      await db.withTransaction(async client => {
        // Parent first, matching claim and cancellation lock order.
        await client.query('SELECT id FROM reclassification_batches WHERE id=$1 FOR UPDATE', [batch.id]);
        const updated = await client.query(`UPDATE reclassification_batch_items
          SET status='failed', error_message=$2, updated_at=NOW()
          WHERE id=$1 AND status='executing' RETURNING id`, [item.id, message]);
        if (updated.rows.length && (batch.pause_on_error || forcePause)) {
          await client.query(`UPDATE reclassification_batches SET status='paused', paused_at_item=$2,
            error_message=$3, updated_at=NOW() WHERE id=$1 AND status='executing'`,
          [batch.id, item.execution_order, message]);
        }
      });
    },
  };
}
