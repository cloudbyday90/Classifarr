/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { INVENTORY_DESCRIPTION_CACHE_LOCK, inspectDescriptionRepresentation,
  writeInventoryDescriptionBatch } from './inventoryDescriptionBatchWriter.mjs';

const QUIET_INTERVAL_MS = 300_000;
const MAX_NEW_DESCRIPTIONS = 64;

function eligibleConfig(state) {
  if (state?.rag_enabled !== true) return null;
  try { return JSON.stringify(resolveLocalStudyEmbeddingConfig(state)); }
  catch { return null; }
}

export function createInventoryDescriptionRefreshWorker({
  repository, cache, createEmbedder, withSessionAdvisoryLock, getRevision = () => 0, now = Date.now,
}) {
  let activeController = null;
  let stopped = false;
  let nextRunAt = 0;
  let completedRevision = -1;
  let failures = 0;
  let backoffUntil = 0;
  const result = (status, counts = {}) => ({ version: 'inventory_description_refresh.v1', mode: 'cache_only', status, ...counts });

  async function refresh(signal, revision) {
    signal.throwIfAborted();
    const expiredRowsPruned = await cache.pruneExpired();
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
    const hashes = [...corpus.texts.keys()];
    const present = await cache.findPresent(identity, hashes);
    counts.cacheHits = present.size;
    const pending = hashes.filter(hash => !present.has(hash));
    counts.remainingDescriptions = pending.length;
    for (let offset = 0; offset < Math.min(pending.length, MAX_NEW_DESCRIPTIONS); offset += 8) {
      const entries = await writeInventoryDescriptionBatch({ embedder, identity, cache, signal, admit,
        hashes: pending.slice(offset, Math.min(offset + 8, MAX_NEW_DESCRIPTIONS)), texts: corpus.texts });
      if (!entries) return result('yielded', counts);
      counts.embeddedDescriptions += entries.length;
      counts.remainingDescriptions -= entries.length;
    }
    if (!await admit()) return result('yielded', counts);
    return result(counts.remainingDescriptions ? 'warming_cache' : 'up_to_date', counts);
  }

  return {
    stop() { stopped = true; activeController?.abort(); },
    async run({ signal } = {}) {
      if (stopped || signal?.aborted) return result('cancelled');
      if (activeController) return result('already_running');
      if (now() < backoffUntil) return result('cooldown');
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
        failures = 0;
        backoffUntil = 0;
        if (['up_to_date', 'empty_corpus', 'disabled', 'unsupported_provider'].includes(report.status)) {
          completedRevision = revision;
          nextRunAt = now() + QUIET_INTERVAL_MS;
        }
        return report;
      } catch {
        if (controller.signal.aborted || signal?.aborted) return result('cancelled');
        failures = Math.min(failures + 1, 7);
        backoffUntil = now() + Math.min(3_600_000, 60_000 * 2 ** (failures - 1));
        return result('failed');
      } finally {
        activeController = null;
      }
    },
  };
}
