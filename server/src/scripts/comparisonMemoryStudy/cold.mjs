/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { buildMultiScaleProfile } from '../../services/inventoryMultiScaleProfile.mjs';
import { prepareUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { createComparisonStudyPhases } from './phases.mjs';
import { sampleColdBuild } from './heapSampling.mjs';

// This scope releases the repository snapshot before asynchronous construction.
async function readSource(fixture, signal) {
  const snapshot = await fixture.repository.read(fixture.identity, { requireCompleteVectors: true, signal });
  return prepareUnseenMultiScaleSource(snapshot, fixture.identity);
}

async function oneBuild(fixture, metrics, mode, cycle, signal) {
  const source = await readSource(fixture, signal);
  metrics.track('coldSource', source);
  metrics.track('coldVector', source.training.vectors.values().next().value);
  await metrics.mark(`cycle_${cycle}_build_start`);
  const measured = await sampleColdBuild(mode, async () => {
    const built = await buildMultiScaleProfile(source, { signal,
      ...createComparisonStudyPhases(metrics, `cycle_${cycle}`) });
    assert.equal(built.cacheable, true, 'cold_study_discovery_incomplete');
    metrics.track('coldHandle', built.handle);
    return { summary: built.handle.summary(), weight: built.weight };
  });
  await metrics.mark(`cycle_${cycle}_build_end`, { mode, allocationProfile: measured.profile });
  return { key: source.key, ...measured.value };
}

/** Identical synthetic corpus, three cold builds; no scheduler, cache, publication or forced GC. */
export async function measureColdBuilds({ fixture, metrics, mode, signal = AbortSignal.timeout(600_000) }) {
  if (!['natural', 'allocations', 'survivors'].includes(mode)) throw new Error('comparison_heap_mode_invalid');
  let baseline;
  for (let cycle = 0; cycle < 3; cycle++) {
    signal.throwIfAborted();
    const result = await oneBuild(fixture, metrics, mode, cycle, signal);
    baseline ??= result;
    assert.deepEqual(result, baseline, 'cold_study_source_or_summary_changed');
    await delay(2000, undefined, { signal });
    await metrics.settled(`cycle_${cycle}_idle`);
  }
  return { cycles: 3, identicalSourcesAndSummaries: true };
}
