/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { runInventoryCandidateStabilityBenchmark } from '../../services/inventoryCandidateStabilityBenchmark.mjs';
import { buildCandidateSupportRanges, candidateSupportSlice } from '../../services/inventoryCandidateSupportRange.mjs';

const options = { seed: 'candidate-stability-2026', size: 8, folds: 2 };
function fixture(perLibrary = 12) {
  const libraries = [1, 2, 3, 4].map(id => ({ id, media_type: id < 3 ? 'movie' : 'tv', name: `PRIVATE library ${id}` }));
  const corpus = prepareInventoryDescriptionCorpus(libraries.flatMap(library => Array.from({ length: perLibrary }, (_, index) => ({
    tmdb_id: library.id * 100 + index, media_type: library.media_type, library_id: library.id, overview: `PRIVATE description ${library.id} ${index}`,
  }))));
  return { libraries, corpus, vectors: new Map(corpus.documents.map(doc => [doc.hash,
    [1, 2, 3, 4].map(id => id === doc.libraryIds[0] ? 1 : 0)])) };
}
const localFit = (snapshot, dimensions, dependencies) => buildInventoryRepresentativeProfile({ snapshot, dimensions }, dependencies);
const run = (snapshot = fixture(), extra = {}, dependencies = {}) => runInventoryCandidateStabilityBenchmark(snapshot, 4,
  { ...options, ...extra }, { fit: localFit, ...dependencies });

test('paired hold-outs cover both media and every library with private ranges and no source mutation', async () => {
  const snapshot = fixture(), before = structuredClone(snapshot), seen = [], onProgress = jest.fn();
  const fit = async (training, dimensions, dependencies) => { seen.push(structuredClone(training)); return localFit(training, dimensions, dependencies); };
  const report = await run(snapshot, {}, { fit, onProgress });
  expect(report).toMatchObject({ protocol: 'inventory_candidate_stability_v1', status: 'complete', calls: 0,
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false, livePromotionAllowed: false,
    sampledDescriptions: 8, sampleShortfall: 0, evaluation: { supportRangeIsDiagnosticOnly: true } });
  expect(report.arms.map(row => row.name)).toEqual(['aligned', 'independent']);
  for (const arm of report.arms) {
    expect(arm).toMatchObject({ evaluated: 8, compared: 8, placementAgreements: 8, abstained: 0,
      pairedWithAligned: { bothCompared: 8, changedDestination: 0, newAbstentions: 0 } });
    expect(arm.mediaTypes.map(row => row.evaluated)).toEqual([4, 4]);
    expect(arm.libraries.map(row => row.evaluated)).toEqual([2, 2, 2, 2]);
    expect(arm.supportRanges.map(row => row.evaluated)).toEqual([8, 0, 0]);
  }
  expect(seen).toHaveLength(2);
  for (const training of seen) {
    expect(training.corpus.documents).toHaveLength(44);
    expect(training.libraries).toHaveLength(4);
    expect(training.vectors.size).toBe(44);
    expect(JSON.stringify(training)).not.toContain('PRIVATE');
  }
  expect(JSON.stringify([report, onProgress.mock.calls])).not.toMatch(/PRIVATE|centroid|overview|libraryIds|tmdb_id|pairedWithComplete/);
  for (const doc of snapshot.corpus.documents) expect(JSON.stringify(report)).not.toContain(doc.hash);
  expect(snapshot).toEqual(before);
});

test('observed training ranges detect unusual geometry without deciding or learning a destination', async () => {
  const snapshot = fixture(), model = await localFit(snapshot, 4);
  const ranges = await buildCandidateSupportRanges(model, snapshot, 4);
  const candidates = [...model.libraries].filter(([, profile]) => profile.mediaType === 'movie');
  expect(candidateSupportSlice(candidates, ranges, [1, 0, 0, 0], 4)).toBe('within_observed_groups');
  expect(candidateSupportSlice(candidates, ranges, [0, 0, 1, 0], 4)).toBe('outside_observed_groups');
  expect(candidateSupportSlice(candidates, ranges, [-1, 0, 0, 0], 4)).toBe('outside_observed_groups');
  expect(candidateSupportSlice([], ranges, [1, 0, 0, 0], 4)).toBe('unavailable');
  ranges.delete(candidates[0][0]);
  expect(candidateSupportSlice(candidates, ranges, [1, 0, 0, 0], 4)).toBe('unavailable');
  const controller = new AbortController(); controller.abort();
  await expect(buildCandidateSupportRanges(model, snapshot, 4, controller.signal)).rejects.toThrow();
});

test('control and independent arms use the identical fits and count newly exposed ambiguity', async () => {
  const fit = async (training, dimensions, dependencies) => {
    const model = await localFit(training, dimensions, dependencies);
    for (const [id, profile] of model.libraries) {
      const base = id < 3 ? 0 : 2;
      // Keep selected start zero intact so the retained training range is still validated.
      for (const start of [1, 2]) {
        const cosine = (id % 2 ? 0.5 : 0.4) + (start - 1) * 0.1;
        profile.starts[start].groups[0].centroid = [0, 0, 0, 0].map((_, dimension) =>
          dimension === base ? cosine : dimension === base + 1 ? Math.sqrt(1 - cosine * cosine) : 0);
      }
    }
    return model;
  };
  const report = await run(fixture(), {}, { fit });
  expect(report.arms[0]).toMatchObject({ compared: 8 });
  expect(report.arms[1]).toMatchObject({ evaluated: 8, abstained: 8, reasons: { initialization_sensitive: 8 },
    pairedWithAligned: { newAbstentions: 8, changedDestination: 0 } });
});

test('keeps unavailable alternatives in scope and refuses silently dropped candidates', async () => {
  const waitingFit = async (training, dimensions, dependencies) => {
    const model = await localFit(training, dimensions, dependencies);
    model.libraries.get(2).coverage.status = 'waiting';
    return model;
  };
  const report = await run(fixture(), {}, { fit: waitingFit });
  expect(report.arms[1]).toMatchObject({ compared: 4, reasons: { incomplete_profiles: 4 } });
  expect(report.arms[1].supportRanges[2].evaluated).toBe(4);
  const droppedFit = async (training, dimensions, dependencies) => {
    const model = await localFit(training, dimensions, dependencies); model.libraries.delete(2); return model;
  };
  await expect(run(fixture(), {}, { fit: droppedFit })).rejects.toThrow('scope_changed');
  const sparse = await run(fixture(2));
  expect(sparse.arms[1]).toMatchObject({ compared: 0, reasons: { sparse_profiles: 8 } });
  const solo = fixture(); solo.libraries = solo.libraries.filter(row => row.id !== 2);
  solo.corpus.documents = solo.corpus.documents.filter(doc => !doc.libraryIds.includes(2));
  expect((await run(solo)).arms[1].reasons.insufficient_candidates).toBeGreaterThan(0);
});

test('disjoint sample shortfalls are explicit and earlier items remain available for training', async () => {
  const report = await run(fixture(4), { size: 10, excludePriorSize: 8 });
  expect(report).toMatchObject({ sampledDescriptions: 8, sampleShortfall: 2, excludedPriorDescriptions: 8,
    evaluation: { priorCohortSizes: [8], previousSampleOverlap: 0, priorItemsAvailableForTraining: true } });
});

test('fails closed on missing, corrupt, oversized, ungrouped or generation-enabled input', async () => {
  const fit = jest.fn(), missing = fixture(); missing.vectors.delete(missing.corpus.documents[0].hash);
  await expect(run(missing, {}, { fit })).rejects.toThrow('complete_cache_required');
  const corrupt = fixture(); corrupt.vectors.set(corrupt.corpus.documents[0].hash, [NaN, 0, 0, 0]);
  await expect(run(corrupt, {}, { fit })).rejects.toThrow();
  for (const extra of [{ folds: 0 }, { generateCases: 1 }]) await expect(run(fixture(), extra, { fit })).rejects.toThrow('zero_generation');
  const large = fixture(); large.corpus.documents = Array(15000).fill(large.corpus.documents[0]);
  await expect(runInventoryCandidateStabilityBenchmark(large, 1000, { ...options, folds: 10 }, { fit })).rejects.toThrow('work_budget');
  expect(fit).not.toHaveBeenCalled();
});

test('stops on cancellation and fit failure, and exercises the production worker without cache publication', async () => {
  const controller = new AbortController(); controller.abort(); const fit = jest.fn();
  await expect(run(fixture(), {}, { fit, signal: controller.signal })).rejects.toThrow();
  expect(fit).not.toHaveBeenCalled();
  const during = new AbortController(), onProgress = jest.fn(() => during.abort());
  await expect(run(fixture(), {}, { signal: during.signal, onProgress })).rejects.toThrow();
  expect(onProgress).toHaveBeenCalledTimes(1);
  await expect(run(fixture(), {}, { fit: async () => { throw new Error('fit unavailable'); } })).rejects.toThrow('fit unavailable');
  expect(await runInventoryCandidateStabilityBenchmark(fixture(4), 4, options)).toMatchObject({ status: 'complete', calls: 0 });
});
