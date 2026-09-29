/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createQueueClaimWriteGuard, claimNotOwned } from './queueClaimWriteGuard.mjs';
import { completeQueueClaim } from './queueTaskAcknowledgementService.mjs';
import { enrichmentRetryService as defaultRetryService } from './enrichmentRetryService.mjs';

/** Per-task persistence authority. Provider work is deliberately outside this API. */
export function createQueueEnrichmentWriteSession({ db, task, logger, enrichmentItemStateService,
  retryService = defaultRetryService }) {
  const guard = createQueueClaimWriteGuard(db, task);
  const id = task.id, token = task.claim_token;
  return Object.freeze({
    query: guard.query,
    markProcessing: itemId => guard.run(client => enrichmentItemStateService.markProcessing(itemId, client)),
    queueRetry: async (...args) => {
      await guard.run(client => retryService.queueForRetry(...args, client));
      retryService.scheduleProcessing();
    },
    finish: async (result, itemId, persist = async () => {}) => {
      await guard.run(async client => {
        await persist(client);
        if (!await completeQueueClaim(client.query, id, result, token)) throw claimNotOwned();
        if (itemId) await enrichmentItemStateService.syncItemState(itemId, client);
      });
      logger.info('Task completed', { taskId: id });
    },
  });
}
