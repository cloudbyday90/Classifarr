/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { projectRepairReceipt, repairConflict, repairSourceVersion } from './queueIdentityRepairContract.mjs';
import { lockRepairWrites, readRepairReceipt, readRepairTask, requireNoRepairEffects } from './queueIdentityRepairRepository.mjs';

/** Explicit retry is a different command from approving the identity replacement. */
export async function retryIdentityRepair(db, actorId, taskId, receiptId, signal) {
  return db.withTransaction(async tx => {
    await lockRepairWrites(tx);
    await requireReviewActor(tx, actorId, true);
    return retryIdentityRepairInTransaction(tx, actorId, taskId, receiptId, signal);
  });
}

/** Caller holds the repair writer locks and has revalidated the current actor. */
export async function retryIdentityRepairInTransaction(tx, actorId, taskId, receiptId, signal, provider) {
  const receipt = await readRepairReceipt(tx, taskId);
  if (!receipt || receipt.id !== receiptId) throw repairConflict();
  if (receipt.retried_at) return projectRepairReceipt(receipt);
  if (provider && (!provider.configured || provider.revision !== receipt.provider_revision)) throw repairConflict();
  const task = await readRepairTask(tx, taskId, true);
  if (task.payload.identity_repair !== receipt.id || task.media_type !== receipt.media_type ||
      Number(task.tmdb_id) !== receipt.new_tmdb_id || task.attempts !== receipt.attempts ||
      task.max_attempts !== receipt.max_attempts || repairSourceVersion(task) !== receipt.repaired_version) {
    throw repairConflict();
  }
  await requireNoRepairEffects(tx, taskId, receipt.media_type, receipt.old_tmdb_id, receipt.new_tmdb_id);
  signal?.throwIfAborted();
  await tx.query(`UPDATE task_queue SET status='pending', error_message=NULL,
    next_retry_at=clock_timestamp(), completed_at=NULL, started_at=NULL WHERE id=$1`, [taskId]);
  await tx.query(`UPDATE classification_intake_receipts SET status_id='retry_scheduled',
    finished_at=NULL,updated_at=clock_timestamp()
    WHERE queue_task_id=$1 AND classification_id IS NULL AND status_id='failed'`, [taskId]);
  await tx.query(`UPDATE queue_identity_repair_receipts SET retried_at=clock_timestamp(),
    retry_actor_id=$2 WHERE task_id=$1`, [taskId, actorId]);
  const result = projectRepairReceipt(await readRepairReceipt(tx, taskId));
  signal?.throwIfAborted();
  return result;
}
