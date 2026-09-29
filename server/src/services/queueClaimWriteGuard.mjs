/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isQueueClaimToken } from './queueTaskAcknowledgementService.mjs';

export class QueueClaimWriteError extends Error {
  constructor(reason = 'queue_claim_write_failed', cause) {
    super(reason, { cause });
    this.name = 'QueueClaimWriteError';
    this.reason = reason;
  }
}

export const claimNotOwned = () => new QueueClaimWriteError('queue_claim_not_owned');

/** DB-only callbacks. Never use this scope for provider calls or timers. */
export function createQueueClaimWriteGuard(db, task) {
  // Capture authority before any await; never substitute the current row's token.
  const id = task?.id, token = task?.claim_token;
  const run = async work => {
    if (!isQueueClaimToken(token)) throw claimNotOwned();
    if (typeof db?.withTransaction !== 'function') throw new QueueClaimWriteError();
    try {
      return await db.withTransaction(async client => {
        await client.query("SET LOCAL lock_timeout = '2s'");
        await client.query("SET LOCAL statement_timeout = '10s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
        await client.query("SET LOCAL transaction_timeout = '15s'");
        const { rows: [claim] } = await client.query(`SELECT visible_at::text AS deadline
          FROM task_queue WHERE id = $1 AND claim_token = $2::uuid
            AND task_type = 'metadata_enrichment' AND status = 'processing'
          FOR UPDATE`, [id, token]);
        if (!claim?.deadline) throw claimNotOwned();
        const checkDeadline = async () => {
          const { rows: [clock] } = await client.query(
            'SELECT clock_timestamp() < $1::timestamptz AS live', [claim.deadline]);
          if (clock?.live !== true) throw claimNotOwned();
        };
        // A predicate evaluated before waiting for a lock can outlive its lease.
        await checkDeadline();
        let active = true;
        const scoped = Object.freeze({ query: (...args) => {
          if (!active) return Promise.reject(claimNotOwned());
          return client.query(...args);
        } });
        try {
          const result = await work(scoped);
          await checkDeadline();
          return result;
        } finally {
          active = false;
        }
      });
    } catch (error) {
      if (error instanceof QueueClaimWriteError) throw error;
      throw new QueueClaimWriteError('queue_claim_write_failed', error);
    }
  };
  return Object.freeze({ run, query: (...args) => run(client => client.query(...args)) });
}
