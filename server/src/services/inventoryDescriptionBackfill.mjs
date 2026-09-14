/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { writeInventoryDescriptionBatch, verifyDescriptionRepresentation } from './inventoryDescriptionBatchWriter.mjs';
import { descriptionIsolationCode, descriptionIsolationDelay, planDescriptionBackfill } from './inventoryDescriptionIsolation.mjs';

export async function backfillInventoryDescriptions({
  embedder, identity, cache, isolation, signal, admit, hashes, texts, counts, recovery, random = Math.random,
}) {
  const present = await cache.findPresent(identity, hashes);
  await isolation.clear(identity, [...present]);
  const pending = hashes.filter(hash => !present.has(hash));
  const journal = await isolation.read(identity, pending);
  const plan = planDescriptionBackfill(pending, journal);
  counts.cacheHits = present.size; counts.remainingDescriptions = pending.length;
  counts.deferredDescriptions = journal.size; counts.isolatedDescriptions = 0;
  let consecutiveFailures = 0;
  for (const batch of plan) {
    let entries;
    try {
      entries = await writeInventoryDescriptionBatch({ embedder, identity, cache, signal, admit, hashes: batch, texts });
    } catch (error) {
      signal.throwIfAborted();
      const code = descriptionIsolationCode(error);
      if (!code) throw error;
      if (!await admit()) return 'yielded';
      await verifyDescriptionRepresentation(embedder, identity, signal);
      if (!await admit()) return 'yielded';
      const attempts = batch.length === 1 ? Math.min(7, (journal.get(batch[0])?.attempts ?? 0) + 1) : 0;
      const delayMs = descriptionIsolationDelay(attempts, random);
      await isolation.defer(identity, batch, { code, attempts, delayMs });
      for (const hash of batch) if (!journal.has(hash)) counts.deferredDescriptions++;
      counts.isolatedDescriptions += batch.length;
      recovery.isolated(error, batch.length, delayMs);
      if (++consecutiveFailures >= 2) throw error;
      continue;
    }
    if (!entries) return 'yielded';
    consecutiveFailures = 0;
    // Cache write is the checkpoint. Cleanup failure cannot cause it to be re-embedded.
    recovery.committed(entries.length);
    await isolation.clear(identity, batch);
    counts.deferredDescriptions -= batch.filter(hash => journal.has(hash)).length;
    counts.embeddedDescriptions += entries.length; counts.remainingDescriptions -= entries.length;
  }
  if (!await admit()) return 'yielded';
  if (!counts.remainingDescriptions) return 'up_to_date';
  return plan.length ? 'warming_cache' : 'waiting_for_retry';
}
