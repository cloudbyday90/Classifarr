/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { inspectUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { diagnoseLiveMultiScaleFailure } from '../../services/liveMultiScaleFailure.mjs';

export async function measureIncompleteCache({ fixture, metrics, requireCompleteVectors }) {
  await fixture.omitDescriptions();
  await metrics.mark('incomplete_baseline');
  const start = performance.now();
  let failure, stage = 'snapshot_read';
  try {
    const snapshot = await fixture.repository.read(fixture.identity, { requireCompleteVectors });
    await metrics.mark('incomplete_vectors_loaded', { decodedVectors: snapshot.vectors.size });
    stage = 'source_validation';
    inspectUnseenMultiScaleSource(snapshot, fixture.identity);
  } catch (error) { failure = diagnoseLiveMultiScaleFailure(stage, error); }
  assert.equal(failure?.code, 'cached_vectors_incomplete');
  await metrics.mark('incomplete_refused', { elapsedMs: Math.round(performance.now() - start), failure });
}
