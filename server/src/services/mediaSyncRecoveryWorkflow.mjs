/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createMediaSyncRecoveryPlan } from './mediaSyncRecoveryPlan.mjs';
import { createSyncIdentityOutcomeRecorder } from './mediaSyncIdentityRecoveryOutcomes.mjs';
import { claimSyncIdentityRecovery, readSyncIdentityRecoveryPriority, readSyncIdentityRecoveryReceipt } from './mediaSyncIdentityRecoveryPersistence.mjs';

/** Preserve fast cached proof reuse, but defer fresh attempts until all pages are considered. */
export function createMediaSyncRecoveryWorkflow({ store, context, recovery, source, persistRecovery, upsert, logger,
  readPriority = item => readSyncIdentityRecoveryPriority(store, context, item),
  claimAttempt = (item, token) => claimSyncIdentityRecovery(store, context, item, token),
  readReceipt = item => readSyncIdentityRecoveryReceipt(store, context, item),
}) {
  const plan = createMediaSyncRecoveryPlan();
  const recordOutcome = createSyncIdentityOutcomeRecorder(store, context, logger);
  const options = { ...source, readReceipt, recordOutcome };
  let closed = false;

  async function complete(item, proof = null) {
    source.signal?.throwIfAborted();
    if (proof) {
      try {
        const persisted = await persistRecovery(store, context, proof);
        source.signal?.throwIfAborted();
        if (persisted) return 1;
        await recordOutcome(item, { reason: 'persistence_failed', attemptId: proof.attemptId ?? null });
      } catch {
        source.signal?.throwIfAborted();
        await recordOutcome(item, { reason: 'persistence_failed', attemptId: proof.attemptId ?? null });
        logger.warn('Source identity recovery deferred; sync will retry', { libraryId: context.libraryId },
          { dedupeKey: `identity-recovery:${context.libraryId}`, dedupeWindowMs: 3600000 });
      }
    }
    source.signal?.throwIfAborted();
    await upsert(item);
    source.signal?.throwIfAborted();
    return 1;
  }

  return Object.freeze({
    get pendingCount() { return plan.size; },
    async process(item) {
      source.signal?.throwIfAborted();
      if (closed) throw new Error('Recovery scan is already closed');
      // A later appearance owns the buffered snapshot, including a now-valid item.
      const previous = plan.withdraw(item?.external_id);
      let completed = previous ? await complete(previous) : 0;
      let admitted = false;
      let evicted = null;
      const proof = await recovery.recover(item, { ...options, claimAttempt: async candidate => {
        const priority = await readPriority(candidate);
        source.signal?.throwIfAborted();
        if (priority) ({ admitted, evicted } = plan.offer(candidate, priority.attemptedAt));
        // Planning is deliberately not an attempt or a durable reservation.
        return false;
      } });
      if (evicted) completed += await complete(evicted);
      return completed + (admitted ? 0 : await complete(item, proof));
    },
    async flush() {
      source.signal?.throwIfAborted();
      if (closed) return 0;
      closed = true;
      let completed = 0;
      for (const item of plan.drain()) {
        completed += await complete(item, await recovery.recover(item, { ...options, claimAttempt }));
      }
      return completed;
    },
  });
}
