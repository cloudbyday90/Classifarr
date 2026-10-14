/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { projectRepairReceipt, repairConflict } from './queueIdentityRepairContract.mjs';
import { lockRepairWrites, readRepairReceipt } from './queueIdentityRepairRepository.mjs';
import { assessRepairRetry } from './queueIdentityRepairEligibility.mjs';

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
  const eligibility = await assessRepairRetry(tx, taskId, receipt, provider);
  if (eligibility.error) throw eligibility.error;
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
