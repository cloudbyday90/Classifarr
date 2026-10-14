/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError } from '../utils/appError.mjs';
import { repairConflict, repairSourceVersion } from './queueIdentityRepairContract.mjs';
import { readRepairTask, requireNoRepairEffects } from './queueIdentityRepairRepository.mjs';

const REASONS = new Map([
  ['queue_identity_repair_unsupported', 'request_unsupported'],
  ['queue_identity_repair_budget', 'retry_budget_exhausted'],
  ['queue_identity_repair_conflict', 'request_changed'],
  ['queue_identity_repair_prior_work', 'prior_work'],
  ['request_identity_conflict', 'identity_conflict'],
  ['request_identity_invalid', 'identity_invalid'],
]);
const blocked = (reason, error = repairConflict()) => ({ reason, error });

/** Local checks only. Readers observe; writers must hold locks and revalidate. */
export async function assessRepairRetry(db, taskId, receipt, provider) {
  if (provider !== undefined) {
    if (!provider?.configured) return blocked('provider_unconfigured');
    if (provider.revision !== receipt.provider_revision) return blocked('provider_changed');
  }
  try {
    const task = await readRepairTask(db, taskId, true);
    if (task.attempts !== receipt.attempts || task.max_attempts !== receipt.max_attempts) {
      return blocked('retry_budget_changed');
    }
    if (task.payload.identity_repair !== receipt.id || task.media_type !== receipt.media_type ||
        Number(task.tmdb_id) !== receipt.new_tmdb_id || repairSourceVersion(task) !== receipt.repaired_version) {
      return blocked('request_changed');
    }
    await requireNoRepairEffects(db, taskId, receipt.media_type, receipt.old_tmdb_id, receipt.new_tmdb_id);
    return { reason: 'ready', error: null };
  } catch (error) {
    if (error instanceof NotFoundError) return blocked('task_missing', error);
    if (error instanceof ConflictError) {
      const reason = error.code === undefined ? 'task_ineligible' : REASONS.get(error.code);
      if (reason) return blocked(reason, error);
    }
    // SQL/unknown failures must abort the entire read/transaction, never become readiness.
    throw error;
  }
}
