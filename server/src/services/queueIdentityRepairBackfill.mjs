/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ServiceUnavailableError, ValidationError } from '../utils/appError.mjs';
import { reviewBody, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { repairConflict, repairTaskId } from './queueIdentityRepairContract.mjs';
import { lockRepairWrites } from './queueIdentityRepairRepository.mjs';
import { retryIdentityRepairInTransaction } from './queueIdentityRepairRetry.mjs';
import { readRepairBackfillPage } from './queueIdentityRepairReadiness.mjs';

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
  let reading = false;
  return {
    async list(actorId, query = {}, signal) {
      const keys = Object.keys(query);
      if (keys.some(key => key !== 'afterId')) throw new ValidationError('Invalid repair cursor');
      const cursor = keys.length ? repairTaskId(query.afterId) : '0';
      signal?.throwIfAborted();
      if (reading) throw new ServiceUnavailableError('A readiness check is already running. Reload later.',
        { code: 'queue_identity_repair_readiness_busy' });
      reading = true;
      try { return await readRepairBackfillPage({ db, readProvider, actorId, cursor, signal }); }
      finally { reading = false; }
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
