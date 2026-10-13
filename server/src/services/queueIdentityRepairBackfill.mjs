/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ValidationError } from '../utils/appError.mjs';
import { reviewBody, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { repairConflict, repairTaskId } from './queueIdentityRepairContract.mjs';
import { lockRepairWrites } from './queueIdentityRepairRepository.mjs';
import { retryIdentityRepairInTransaction } from './queueIdentityRepairRetry.mjs';

export function parseRepairBackfill(body) {
  reviewBody(body, ['items', 'confirmRetry']);
  if (body.confirmRetry !== true || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 5) {
    throw new ValidationError('Select one to five reviewed repairs and confirm retry');
  }
  const items = body.items.map(item => {
    reviewBody(item, ['taskId', 'receiptId']);
    return { taskId: repairTaskId(item.taskId), receiptId: reviewPreviewId(item.receiptId) };
  });
  if (new Set(items.map(item => item.taskId)).size !== items.length ||
      new Set(items.map(item => item.receiptId)).size !== items.length) {
    throw new ValidationError('Select each reviewed repair only once');
  }
  return items;
}

export function createQueueIdentityRepairBackfill({ db, readProvider }) {
  let busy = false;
  return {
    async list(actorId, query = {}) {
      const keys = Object.keys(query);
      if (keys.some(key => key !== 'afterId')) throw new ValidationError('Invalid repair cursor');
      const cursor = keys.length ? repairTaskId(query.afterId) : '0';
      return db.withTransaction(async tx => {
        await tx.query("SET LOCAL lock_timeout = '1s'");
        await tx.query("SET LOCAL statement_timeout = '3s'");
        await tx.query("SET LOCAL transaction_timeout = '5s'");
        await requireReviewActor(tx, actorId, true);
        const { rows } = await tx.query(`SELECT r.id AS "receiptId",r.task_id::text AS "taskId",
          r.old_tmdb_id AS "oldTmdbId",r.new_tmdb_id AS "newTmdbId",r.media_type AS "mediaType",
          left(r.candidate->>'title',500) AS title,r.confirmed_at AS "confirmedAt"
          FROM queue_identity_repair_receipts r JOIN task_queue t ON t.id=r.task_id
          WHERE r.task_id>$1 AND r.retried_at IS NULL AND t.status='failed'
          ORDER BY r.task_id LIMIT 21`, [cursor]);
        return { items: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].taskId : null };
      });
    },
    async run(actorId, body, signal) {
      const items = parseRepairBackfill(body);
      signal?.throwIfAborted();
      if (busy) throw repairConflict();
      busy = true;
      try {
        return await db.withTransaction(async tx => {
          await lockRepairWrites(tx);
          await requireReviewActor(tx, actorId, true);
          // This reads only local configuration. No provider request occurs under locks.
          const provider = await readProvider(tx);
          if (!provider) throw repairConflict();
          const receipts = [];
          for (const item of items) {
            signal?.throwIfAborted();
            receipts.push(await retryIdentityRepairInTransaction(tx, actorId,
              item.taskId, item.receiptId, signal, provider));
          }
          signal?.throwIfAborted();
          return { receipts };
        });
      } catch (error) {
        if (['55P03', '40P01', '57014'].includes(error?.code)) throw repairConflict();
        throw error;
      } finally { busy = false; }
    },
  };
}
