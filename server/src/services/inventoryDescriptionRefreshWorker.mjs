/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { INVENTORY_DESCRIPTION_CACHE_LOCK, inspectDescriptionRepresentation } from './inventoryDescriptionBatchWriter.mjs';
import { createInventoryDescriptionRecovery } from './inventoryDescriptionRecovery.mjs';
import { createInventoryDescriptionIsolationRepository } from './inventoryDescriptionIsolationRepository.mjs';
import { backfillInventoryDescriptions } from './inventoryDescriptionBackfill.mjs';

const QUIET_INTERVAL_MS = 300_000;

function eligibleConfig(state) {
  if (state?.rag_enabled !== true) return null;
  try { return JSON.stringify(resolveLocalStudyEmbeddingConfig(state)); }
  catch { return null; }
}

export function createInventoryDescriptionRefreshWorker({
  repository, cache, createEmbedder, withSessionAdvisoryLock, getRevision = () => 0, now = Date.now,
  recovery = createInventoryDescriptionRecovery({ now }),
  neighborhoodRecovery = null,
  isolation = createInventoryDescriptionIsolationRepository(repository), random = Math.random,
}) {
  let activeController = null;
  let stopped = false;
  let nextRunAt = 0;
  let completedRevision = -1;
  const result = (status, counts = {}) => ({ version: 'inventory_description_refresh.v1', mode: 'cache_only', status, ...counts });

  async function refresh(signal, revision) {
    signal.throwIfAborted();
    const expiredRowsPruned = await cache.pruneExpired();
    await isolation.pruneExpired();
    const state = await repository.readState();
    signal.throwIfAborted();
    if (state?.rag_enabled !== true) return result('disabled', { expiredRowsPruned });
    const configKey = eligibleConfig(state);
    if (!configKey) return result('unsupported_provider', { expiredRowsPruned });
    if (state.busy !== false) return result('yielded', { expiredRowsPruned });
    const corpus = await repository.readCorpus();
    const counts = { expiredRowsPruned, eligibleDescriptions: corpus.texts.size, cacheHits: 0,
      embeddedDescriptions: 0, remainingDescriptions: corpus.texts.size };
    const admit = async () => {
      signal.throwIfAborted();
      const current = await repository.readState();
      signal.throwIfAborted();
      return current?.busy === false && eligibleConfig(current) === configKey && getRevision() === revision;
    };
    if (!await admit()) return result('yielded', counts);
    if (!corpus.texts.size) return result('empty_corpus', counts);
    const embedder = createEmbedder(state);
    const identity = await inspectDescriptionRepresentation(embedder, signal);
    const status = await backfillInventoryDescriptions({ embedder, identity, cache, isolation, signal, admit,
      hashes: [...corpus.texts.keys()], texts: corpus.texts, counts, recovery, random, neighborhoodRecovery, corpus, configKey });
    return result(status, counts);
  }

  return {
    stop() { stopped = true; activeController?.abort(); },
    async run({ signal } = {}) {
      if (stopped || signal?.aborted) return result('cancelled');
      if (activeController) return result('already_running');
      if (recovery.isCoolingDown()) return result('cooldown');
      const revision = getRevision();
      if (now() < nextRunAt && completedRevision === revision) return result('not_due');
      const controller = new AbortController();
      activeController = controller;
      const runSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000), ...(signal ? [signal] : [])]);
      try {
        let report;
        const acquired = await withSessionAdvisoryLock(INVENTORY_DESCRIPTION_CACHE_LOCK, async () => {
          report = await refresh(runSignal, revision);
        });
        if (!acquired) return result('already_running');
        // Yielding, disabling RAG, or lock contention is not evidence of recovery.
        if (report.status === 'up_to_date') recovery.completed();
        if (['up_to_date', 'empty_corpus', 'disabled', 'unsupported_provider'].includes(report.status)) {
          completedRevision = revision;
          nextRunAt = now() + QUIET_INTERVAL_MS;
        }
        return report;
      } catch (error) {
        if (controller.signal.aborted || signal?.aborted) return result('cancelled');
        return result('failed', recovery.failed(error));
      } finally {
        activeController = null;
      }
    },
  };
}
