/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { inspectDescriptionRepresentation, verifyDescriptionRepresentation } from './inventoryDescriptionBatchWriter.mjs';
import { createLiveInventoryModelCache } from './liveInventoryModelCache.mjs';
import { inventoryRepresentativeSourceKey, INVENTORY_REPRESENTATIVE_PROFILE_VERSION } from './inventoryRepresentativeProfile.mjs';
import { representativeValidationError } from './representativeValidation.mjs';
import { createRepresentativeValidationDiagnostics, representativeValidationIssue } from './representativeValidationDiagnostics.mjs';
import { assertRepresentativeSnapshotBudget, inspectRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { validateInventoryRepresentativeProfileCoverage } from './inventoryRepresentativeProfileValidation.mjs';
import { isMap } from 'node:util/types';

const configKeyOf = state => {
  if (state?.rag_enabled !== true) return null;
  try { return JSON.stringify(resolveLocalStudyEmbeddingConfig(state)); } catch { return null; }
};

/** One process owns one private cache. No HTTP handler can initiate a fit. */
export function createInventoryRepresentativeProfileRefresh({ repository, readState, createEmbedder, fit,
  getRevision = () => 0, now = Date.now, observer = null, neighborhoodRecovery = null,
  diagnostics = createRepresentativeValidationDiagnostics({ now }),
  cache = createLiveInventoryModelCache({ maxEntries: 1, maxWeight: 32 * 1024 * 1024, ttlMs: 1_800_000, now }),
}) {
  let active = null, stopped = false, key = null, revision = -1, configKey = null, available = false;
  let nextRunAt = 0, backoffUntil = 0, failures = 0, verifiedAt = null;
  let lastReport = { version: INVENTORY_REPRESENTATIVE_PROFILE_VERSION, mode: 'shadow_cache', status: 'pending' };
  const invalidate = () => { available = false; verifiedAt = null; };
  const clear = () => { cache.clear(); key = null; invalidate(); };
  const report = (status, summary = {}) => {
    lastReport = { version: INVENTORY_REPRESENTATIVE_PROFILE_VERSION, mode: 'shadow_cache', status, ...summary };
    return { ...lastReport };
  };
  const invalidateHint = () => { if (getRevision() !== revision) invalidate(); };
  const current = (state, expected) => state?.busy === false && configKeyOf(state) === expected;

  async function refresh(state, signal, runRevision, expected) {
    const embedder = createEmbedder(state);
    const identity = await inspectDescriptionRepresentation(embedder, signal);
    const snapshot = await repository.read(identity);
    signal.throwIfAborted();
    if (!current(snapshot.state, expected) || getRevision() !== runRevision) { clear(); return report('invalidated'); }
    if (!snapshot.corpus.texts.size) { clear(); return report('empty_corpus'); }
    assertRepresentativeSnapshotBudget(snapshot, identity.dimensions);
    const coverage = inspectRepresentativeCoverage(snapshot);
    if (!coverage.summary.readyLibraries) { clear(); return report('waiting_for_vectors', coverage.summary); }
    const sourceKey = inventoryRepresentativeSourceKey(snapshot, identity, expected);
    if (key !== sourceKey) clear();
    const cached = cache.get(sourceKey);
    const model = cached ?? await fit(snapshot, identity.dimensions, { signal });
    signal.throwIfAborted();
    if (model?.version !== INVENTORY_REPRESENTATIVE_PROFILE_VERSION || model.kind !== 'full_inventory_shadow' ||
        !isMap(model.libraries)) {
      throw representativeValidationError('profile_header');
    }
    const summary = validateInventoryRepresentativeProfileCoverage(model, snapshot, identity.dimensions);
    let batch = null;
    try { batch = observer?.prepare({ model, snapshot, identity, configKey: expected }); }
    catch { /* Optional diagnostics cannot discard an otherwise valid profile. */ }
    let recoveryBatch = null;
    try { recoveryBatch = await neighborhoodRecovery?.prepare({ model, snapshot, identity, configKey: expected, signal }); }
    catch (error) {
      // Known malformed evidence must use the redacted diagnostic/backoff path, not look healthy.
      if (representativeValidationIssue(error) !== 'unknown_check') throw error;
      // Optional recovery service failures still leave ordinary backfill available.
    }
    const fresh = await repository.read(identity);
    signal.throwIfAborted();
    await verifyDescriptionRepresentation(embedder, identity, signal);
    if (!current(fresh.state, expected) ||
        inventoryRepresentativeSourceKey(fresh, identity, expected) !== sourceKey ||
        !current(await readState(), expected) || getRevision() !== runRevision) {
      clear(); return report('invalidated');
    }
    signal.throwIfAborted();
    if (!cache.set(sourceKey, model, model.weight)) { clear(); return report('cache_budget_exceeded'); }
    key = sourceKey; revision = runRevision; available = true; verifiedAt = now(); nextRunAt = now() + 300_000;
    diagnostics.profilesRecovered();
    try { batch?.commit(fresh); } catch { /* No partial or unverified observation is published. */ }
    try { recoveryBatch?.commit(); } catch { /* Ordinary backfill remains available. */ }
    return report(cached ? 'up_to_date' : 'published', summary);
  }

  return {
    stop() { stopped = true; active?.abort(); clear(); observer?.stop(); neighborhoodRecovery?.clear(); },
    // Future internal consumers must supply a key from their own fresh snapshot.
    read(sourceKey) { invalidateHint(); return available && sourceKey === key ? cache.get(sourceKey) : undefined; },
    getStatus() {
      invalidateHint();
      return { ...lastReport, cacheStored: Boolean(available && key && cache.get(key)),
        verifiedAgeMs: verifiedAt === null ? null : Math.max(0, now() - verifiedAt) };
    },
    async run({ signal } = {}) {
      if (stopped || signal?.aborted) return report('cancelled');
      if (active) return { ...lastReport, status: 'already_running' };
      const controller = new AbortController(); active = controller;
      const runSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000), ...(signal ? [signal] : [])]);
      try {
        const pending = observer?.hasPending() === true;
        invalidateHint();
        const state = await readState();
        runSignal.throwIfAborted();
        const expected = configKeyOf(state);
        if (expected !== configKey) { clear(); neighborhoodRecovery?.clear(); nextRunAt = 0; backoffUntil = 0; failures = 0; configKey = expected; }
        if (!expected) { clear(); observer?.clear(); return report(state?.rag_enabled === true ? 'unsupported_provider' : 'disabled'); }
        if (state.busy !== false) { invalidate(); return report('yielded'); }
        if (now() < backoffUntil) return report('cooldown');
        const runRevision = getRevision();
        if (!pending && now() < nextRunAt && revision === runRevision && available && key && cache.get(key)) return { ...lastReport, status: 'not_due' };
        const result = await refresh(state, runSignal, runRevision, expected);
        failures = 0; backoffUntil = 0;
        return result;
      } catch (error) {
        clear();
        if (controller.signal.aborted || signal?.aborted) return report('cancelled');
        if (representativeValidationIssue(error) !== 'unknown_check') diagnostics.report(representativeValidationIssue(error));
        failures = Math.min(failures + 1, 7);
        backoffUntil = now() + Math.min(3_600_000, 60_000 * 2 ** (failures - 1));
        return report('failed');
      } finally { active = null; }
    },
  };
}
