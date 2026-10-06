/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createLiveMultiScaleRefresh } from '../../services/liveMultiScaleRefresh.mjs';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { fitInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfileFit.mjs';
import { buildMultiScaleProfile } from '../../services/inventoryMultiScaleProfile.mjs';
import { createLiveInventoryModelCache } from '../../services/liveInventoryModelCache.mjs';
import { createInventoryDiscoveryAdmission } from '../../services/inventoryDiscoveryAdmission.mjs';
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';
import { createComparisonStudyTiming } from './timing.mjs';
import { createComparisonStudyPhases } from './phases.mjs';

export function createComparisonStudyRefreshers({ fixture, metrics, now = Date.now, phase = () => 'cycle_0',
  resourceAdmission = createBackgroundResourceAdmission(), onBuild = () => {} }) {
  let reads = 0, builds = 0;
  const repository = { read: async (identity, options) => {
    const snapshot = await fixture.repository.read(identity, options); reads++;
    metrics.track('snapshot', snapshot);
    metrics.track('decodedVector', snapshot.vectors.values().next().value);
    await metrics.mark(`${phase()}_read_${reads}`);
    return snapshot;
  } };
  const shared = { repository, readState: fixture.readState ?? (async () => fixture.state), now,
    getRevision: fixture.getRevision ?? (() => 0),
    createEmbedder: () => ({ ...fixture.identity, inspect: async () => fixture.identity }),
    withAdmission: createInventoryDiscoveryAdmission({ ...fixture.database,
      resourceAdmission }) };
  const cache = createLiveInventoryModelCache({ maxEntries: 1, maxWeight: 256 * 1024 ** 2, ttlMs: 600_000, now });
  const comparison = createLiveMultiScaleRefresh({ ...shared, cache,
    build: async (source, options) => {
      builds++; metrics.track('ownedSource', source);
      metrics.track('ownedVector', source.training.vectors.values().next().value);
      await metrics.mark(`${phase()}_build_start`);
      onBuild();
      const model = await buildMultiScaleProfile(source, { ...options,
        ...createComparisonStudyPhases(metrics, phase()) });
      metrics.track('comparisonHandle', model.handle);
      await metrics.mark(`${phase()}_build_end`, { estimatedCacheBytes: model.weight });
      return model;
    } });
  const representative = createInventoryRepresentativeProfileRefresh({ ...shared, fit: async (...args) => {
    await metrics.mark(`${phase()}_representative_fit`);
    return fitInventoryRepresentativeProfile(...args);
  } });
  return { comparison, representative, counts: () => ({ reads, builds }) };
}

export async function measureRefreshCycles({ fixture, metrics, elapsed = false, cycles = 5,
  resourceAdmission = createBackgroundResourceAdmission(), onBuild = () => {}, onCycle = () => {} }) {
  assert.ok([3, 5].includes(cycles), 'study_cycle_budget');
  let cycle = 0;
  const results = [], timing = createComparisonStudyTiming({ elapsed });
  const { comparison, representative, counts } = createComparisonStudyRefreshers({ fixture, metrics,
    resourceAdmission, now: timing.now, phase: () => `cycle_${cycle}`, onBuild });
  try {
    await metrics.settled('baseline');
    for (cycle = 0; cycle < cycles; cycle++) {
      await timing.beforeCycle(cycle);
      if (cycle === 2 || cycle === 4) await fixture.changeDescription(cycle);
      await metrics.mark(`cycle_${cycle}_start`, { timing: elapsed ? 'elapsed' : 'injected' });
      const rep = await representative.run();
      await metrics.mark(`cycle_${cycle}_representative`, { status: rep.status, reason: rep.reason });
      const result = await comparison.run();
      results.push({ representative: rep.status, comparison: result.status, reason: result.reason ?? null });
      await metrics.mark(`cycle_${cycle}_comparison`, { status: result.status, reason: result.reason, ...counts() });
      await onCycle();
      await delay(2000);
      await metrics.settled(`cycle_${cycle}_idle`);
    }
    comparison.stop(); representative.stop();
    await delay(2000); await metrics.settled('stopped');
    assert.equal(counts().reads > 0 && counts().builds > 0, true, 'study_did_not_exercise_refresh');
    return { cycles: results, ...counts() };
  } finally { comparison.stop(); representative.stop(); }
}
