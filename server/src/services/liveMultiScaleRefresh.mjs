/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { inspectDescriptionRepresentation, verifyDescriptionRepresentation } from './inventoryDescriptionBatchWriter.mjs';
import { createLiveInventoryModelCache } from './liveInventoryModelCache.mjs';
import { inspectUnseenMultiScaleSource, ownMultiScaleSource } from './inventoryMultiScaleSource.mjs';
import { buildMultiScaleProfile } from './inventoryMultiScaleProfile.mjs';
import { bindLiveMultiScaleContext, retrieveLiveMultiScaleContext } from './liveMultiScaleContext.mjs';
import { DiscoveryDeferredError } from './inventoryDiscoveryAdmission.mjs';

const configKey = state => {
  try { return state?.rag_enabled === true ? JSON.stringify(resolveLocalStudyEmbeddingConfig(state)) : null; }
  catch { return null; }
};

/** Scheduler-owned SWR, not a request-driven fitter. Only validated unchanged entries can serve. */
export function createLiveMultiScaleRefresh({ repository, readState, createEmbedder,
  getRevision = () => 0, now = Date.now, random = Math.random, build = buildMultiScaleProfile,
  withAdmission = (callback, { signal }) => callback(signal, () => signal.throwIfAborted()),
  cache = createLiveInventoryModelCache({ maxEntries: 1, maxWeight: 256 * 1024 * 1024, ttlMs: 600_000, now }),
}) {
  let active = null, stopped = false, entry = null, nextAt = 0, failures = 0, lastTime = null;
  const clear = () => { entry = null; cache.clear(); };
  const clock = () => {
    const time = now();
    if (!Number.isFinite(time) || (lastTime !== null && time < lastTime)) { clear(); nextAt = 0; }
    lastTime = time; return time;
  };
  const due = () => {
    failures = Math.min(6, failures + 1);
    const jitter = random();
    nextAt = now() + Math.min(1_800_000, 60_000 * 2 ** (failures - 1)) *
      (1 + (Number.isFinite(jitter) ? Math.max(0, Math.min(1, jitter)) : 0) * 0.25);
  };
  return {
    stop() { stopped = true; active?.abort(); clear(); },
    async retrieve(input) {
      const time = clock(), current = entry;
      if (stopped || !Number.isFinite(time) || !current || getRevision() !== current.revision ||
          input.request?.contextConfigKey !== current.configKey || !cache.get(current.key)) return null;
      try {
        const signal = AbortSignal.any([AbortSignal.timeout(500), ...(input.signal ? [input.signal] : [])]);
        const result = await retrieveLiveMultiScaleContext(current.bound, { ...input, signal });
        signal.throwIfAborted();
        if (entry !== current || stopped || getRevision() !== current.revision || !cache.get(current.key)) return null;
        return result;
      } catch { return null; }
    },
    async run({ signal } = {}) {
      if (stopped || signal?.aborted) return { status: 'cancelled' };
      if (active) return { status: 'already_running' };
      const controller = new AbortController(); active = controller;
      const abort = AbortSignal.any([controller.signal, AbortSignal.timeout(360_000), ...(signal ? [signal] : [])]);
      try {
        const time = clock();
        if (!Number.isFinite(time)) { clear(); return { status: 'unavailable' }; }
        const state = await readState(), expected = configKey(state), revision = getRevision();
        abort.throwIfAborted();
        if (!expected) { clear(); nextAt = 0; failures = 0; return { status: 'disabled' }; }
        if (entry && (entry.configKey !== expected || entry.revision !== revision)) { clear(); nextAt = 0; }
        if (state.busy !== false) { clear(); return { status: 'yielded' }; }
        if (time < nextAt) return { status: 'not_due' };
        return await withAdmission(async (abort, checkpoint) => {
          const embedder = createEmbedder(state), identity = await inspectDescriptionRepresentation(embedder, abort);
          const snapshot = await repository.read(identity);
          abort.throwIfAborted();
          if (configKey(snapshot.state) !== expected || snapshot.state.busy !== false || getRevision() !== revision) {
            clear(); due(); return { status: 'invalidated' };
          }
          const source = inspectUnseenMultiScaleSource(snapshot, identity);
          if (entry?.key !== source.key) clear();
          const stored = cache.get(source.key), cached = stored?.cacheable ? stored : null;
          const built = cached ?? await build(ownMultiScaleSource(source), { signal: abort });
          const fresh = await repository.read(identity);
          await verifyDescriptionRepresentation(embedder, identity, abort);
          const finalState = await readState();
          abort.throwIfAborted();
          if (configKey(fresh.state) !== expected || fresh.state.busy !== false ||
              configKey(finalState) !== expected || finalState.busy !== false || getRevision() !== revision ||
              inspectUnseenMultiScaleSource(fresh, identity).key !== source.key) {
            clear(); due(); return { status: 'invalidated' };
          }
          const bound = bindLiveMultiScaleContext(fresh, identity, built.handle);
          checkpoint();
          if (!cache.set(source.key, built, built.weight + fresh.observedKeys.size * 128)) {
            clear(); due(); return { status: 'capacity' };
          }
          entry = { key: source.key, configKey: expected, revision, bound };
          if (built.cacheable) { failures = 0; nextAt = now() + 300_000; }
          else due();
          // Degraded raw/broad context may serve, but optional discovery must retry rather than be reused.
          return { status: cached ? 'revalidated' : built.cacheable ? 'ready' : 'degraded' };
        }, { signal: abort });
      } catch (error) {
        // Contention does not invalidate an already verified entry; its TTL/revision still govern serving.
        if (!(error instanceof DiscoveryDeferredError && error.reason === 'busy')) clear();
        if (controller.signal.aborted || signal?.aborted) { clear(); return { status: 'cancelled' }; }
        due(); return error instanceof DiscoveryDeferredError
          ? { status: 'deferred', reason: error.reason } : { status: 'unavailable' };
      } finally { active = null; }
    },
  };
}
