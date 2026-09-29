/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Orchestration-only fake. Claim/transaction behavior is tested against real PG separately. */
export function unitEnrichmentWriteSession(deps, { task, enrichmentItemStateService }) {
  return {
    query: deps.queryWithTimeout,
    markProcessing: id => enrichmentItemStateService.markProcessing(id),
    queueRetry: deps.queueRetry || (async () => {}),
    finish: async (result, itemId, persist = async () => {}) => {
      await persist({ query: deps.queryWithTimeout });
      const acknowledged = await deps.completeTask(task.id, result, task.claim_token);
      if (acknowledged !== false && itemId) await enrichmentItemStateService.syncItemState(itemId);
    },
  };
}
