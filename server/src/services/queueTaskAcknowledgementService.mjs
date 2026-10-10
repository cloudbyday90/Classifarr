/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeQueueTaskFailureReasonId, QUEUE_TASK_LOG_REASON_IDS } from './queueTaskFailureReason.mjs';

const RETRY_DELAYS = [30, 60, 120, 300, 600];
const CLAIM_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isQueueClaimToken = value => typeof value === 'string' && CLAIM_TOKEN.test(value);

/** No logging or receipts here: callers may include this write in a transaction. */
export async function completeQueueClaim(query, taskId, result, claimToken) {
  if (!isQueueClaimToken(claimToken)) return null;
  const update = await query(`UPDATE task_queue
    SET status = 'completed', completed_at = NOW(), visible_at = NULL,
        claim_token = NULL, payload = payload || $2
    WHERE id = $1 AND status = 'processing' AND claim_token = $3::uuid
    RETURNING task_type, attempts`, [taskId, JSON.stringify({ result }), claimToken]);
  return update.rows?.[0] ?? null;
}

/** A task ID is not ownership. Never recover a missing token by reading the row. */
export class QueueTaskAcknowledgementService {
  constructor({ db, logger, receiptService }) {
    this.db = db;
    this.logger = logger;
    this.receiptService = receiptService;
  }

  rejected(taskId) {
    this.logger.debug('Queue acknowledgement ignored; claim is no longer owned', {
      taskId, reasonCode: 'queue_claim_not_owned',
    });
    return false;
  }

  async complete(taskId, result, claimToken) {
    if (!isQueueClaimToken(claimToken)) return this.rejected(taskId);
    try {
      const row = await completeQueueClaim((...args) => this.db.query(...args), taskId, result, claimToken);
      if (!row) return this.rejected(taskId);
      if (row.task_type === 'classification') await this.receiptService.recordTerminal(taskId, 'completed', row.attempts);
      this.logger.info('Task completed', { taskId });
      return true;
    } catch {
      this.logger.error('Failed to complete task', { taskId, reasonCode: QUEUE_TASK_LOG_REASON_IDS.COMPLETE_FAILED });
      return false;
    }
  }

  async fail(taskId, failureReasonId, claimToken) {
    if (!isQueueClaimToken(claimToken)) return this.rejected(taskId);
    const reason = normalizeQueueTaskFailureReasonId(failureReasonId);
    try {
      // Attempt budget is authoritative in the row, not in an old worker's copy.
      const update = await this.db.query(`UPDATE task_queue
        SET status = CASE WHEN $2 = 'task_metadata_not_found' OR attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
            error_message = $2, attempts = attempts + 1, claim_token = NULL, visible_at = NULL,
            completed_at = CASE WHEN $2 = 'task_metadata_not_found' OR attempts + 1 >= max_attempts THEN NOW() ELSE NULL END,
            started_at = CASE WHEN $2 = 'task_metadata_not_found' OR attempts + 1 >= max_attempts THEN started_at ELSE NULL END,
            next_retry_at = CASE WHEN $2 = 'task_metadata_not_found' OR attempts + 1 >= max_attempts THEN next_retry_at
              ELSE NOW() + ($4::integer[])[LEAST(attempts + 1, 5)] * INTERVAL '1 second' END
        WHERE id = $1 AND status = 'processing' AND claim_token = $3::uuid
        RETURNING task_type, attempts, status`, [taskId, reason, claimToken, RETRY_DELAYS]);
      const row = update.rows?.[0];
      if (!row) return this.rejected(taskId);
      const terminal = row.status === 'failed';
      if (row.task_type === 'classification') await this.receiptService.recordTerminal(
        taskId, terminal ? 'failed' : 'retry_scheduled', row.attempts, reason);
      this.logger[terminal ? 'error' : 'warn'](terminal ? 'Task permanently failed' : 'Task scheduled for retry', {
        taskId, attempts: row.attempts,
      });
      return true;
    } catch {
      this.logger.error('Failed to update task status', { taskId, reasonCode: QUEUE_TASK_LOG_REASON_IDS.STATUS_UPDATE_FAILED });
      return false;
    }
  }
}

/** Release only a specific received claim, including AI wait and shutdown paths. */
export async function releaseQueueClaim(db, task, reason = null) {
  if (!isQueueClaimToken(task?.claim_token)) return false;
  const update = await db.query(`UPDATE task_queue
    SET status = 'pending', started_at = NULL, visible_at = NULL, claim_token = NULL,
        error_message = COALESCE($3::text, error_message)
    WHERE id = $1 AND status = 'processing' AND claim_token = $2::uuid RETURNING id`,
  [task.id, task.claim_token, reason]);
  return update.rows?.length === 1;
}
