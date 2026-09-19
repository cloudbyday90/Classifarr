/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { runInventoryCoverageBenchmark } from '../../services/inventoryCoverageBenchmark.mjs';
import { coverageTrainingSnapshot, createCoverageMask } from '../../services/inventoryCoverageMasks.mjs';
import { coverageBenchmarkDecision, createCoverageMetrics, recordCoverageDecision } from '../../services/inventoryCoverageMetrics.mjs';

const options = { seed: 'coverage-benchmark-test-2026', size: 8, folds: 2 };
function fixture(perLibrary = 20) {
  const libraries = [1, 2, 3, 4].map(id => ({ id, media_type: id < 3 ? 'movie' : 'tv', name: `PRIVATE library ${id}` }));
  const rows = libraries.flatMap(library => Array.from({ length: perLibrary }, (_, index) => ({
    tmdb_id: library.id * 100 + index, media_type: library.media_type, library_id: library.id,
    overview: `PRIVATE description ${library.id} ${index}`,
  })));
  const corpus = prepareInventoryDescriptionCorpus(rows);
  return { libraries, corpus, vectors: new Map(corpus.documents.map(doc => [doc.hash,
    [1, 2, 3, 4].map(id => id === doc.libraryIds[0] ? 1 : 0)])) };
}
const localFit = (snapshot, dimensions, deps) => buildInventoryRepresentativeProfile({ snapshot, dimensions }, deps);
const run = (snapshot = fixture(), extraOptions = {}, dependencies = {}) => runInventoryCoverageBenchmark(snapshot, 4,
  { ...options, ...extraOptions }, { fit: localFit, ...dependencies });

test('folds remove every held hash copy across IDs, libraries and media, without plaintext or mutation', () => {
  const snapshot = fixture(), held = snapshot.corpus.documents[0];
  snapshot.corpus.documents.push({ ...held, key: 'movie:extra', libraryIds: [2] }, { ...held, type: 'tv', key: 'tv:extra', libraryIds: [3] });
  const before = structuredClone(snapshot), training = coverageTrainingSnapshot(snapshot, new Set([held.hash]));
  expect(training.corpus.documents.some(doc => doc.hash === held.hash)).toBe(false);
  expect(training.vectors.has(held.hash)).toBe(false); expect(training.corpus.texts.has(held.hash)).toBe(false);
  expect(training.libraries).toHaveLength(4);
  expect(JSON.stringify(training)).not.toContain('PRIVATE'); expect([...training.corpus.texts.values()].every(value => value === null)).toBe(true);
  expect(snapshot).toEqual(before);
});

test('percentage masks are reproducible, retain membership, ignore labels and exclude shared descriptions', () => {
  const source = fixture(), shared = source.corpus.documents[0];
  shared.libraryIds.push(2);
  const training = coverageTrainingSnapshot(source, new Set()), before = structuredClone(training);
  for (const arm of ['random_10', 'concentrated_10', 'random_20', 'concentrated_20']) {
    const mask = createCoverageMask(training, 4, arm, options.seed);
    expect(mask.has(shared.hash)).toBe(false);
    expect(mask.size).toBe(arm.endsWith('10') ? 7 : 15);
    const renamed = { ...training, libraries: [...training.libraries].reverse().map(row => ({ ...row, name: 'misleading comedy' })),
      corpus: { ...training.corpus, documents: [...training.corpus.documents].reverse() } };
    expect([...createCoverageMask(renamed, 4, arm, options.seed)].sort()).toEqual([...mask].sort());
  }
  expect(training).toEqual(before);
  expect(() => createCoverageMask(training, 4, 'unknown', options.seed)).toThrow('arm_invalid');
});

test('concentrated masks remove neighboring vectors, and group masks remove a whole learned group', () => {
  const snapshot = fixture(10), training = coverageTrainingSnapshot(snapshot, new Set());
  const baseline = { libraries: new Map() };
  for (const library of training.libraries) {
    const hashes = training.corpus.documents.filter(doc => doc.libraryIds.includes(library.id)).map(doc => doc.hash);
    hashes.forEach((hash, index) => training.vectors.set(hash, index < 8 ? [1, 0, 0, 0] : [0, 1, 0, 0]));
    baseline.libraries.set(library.id, { selectedStart: 0, starts: [{ converged: true,
      groups: [{ centroid: [1, 0, 0, 0] }, { centroid: [0, 1, 0, 0] }] }] });
  }
  const groupMask = createCoverageMask(training, 4, 'smallest_group', options.seed, baseline);
  expect(groupMask.size).toBe(8);
  expect([...groupMask].every(hash => training.vectors.get(hash)[1] === 1)).toBe(true);
  const concentrated = createCoverageMask(training, 4, 'concentrated_20', options.seed);
  for (const library of training.libraries) {
    const removed = training.corpus.documents.filter(doc => doc.libraryIds.includes(library.id) && concentrated.has(doc.hash));
    expect(removed).toHaveLength(2);
    expect(training.vectors.get(removed[0].hash)).toEqual(training.vectors.get(removed[1].hash));
  }
  for (const profile of baseline.libraries.values()) profile.starts[0].converged = false;
  expect(createCoverageMask(training, 4, 'smallest_group', options.seed, baseline).size).toBe(0);
  expect(createCoverageMask({ ...training, corpus: { documents: [], texts: new Map() }, vectors: new Map() }, 4, 'random_10', options.seed).size).toBe(0);
});

test('actual fitting reports paired abstentions, movie/TV strata and redacted aggregate output', async () => {
  const snapshot = fixture(), before = structuredClone(snapshot), progress = jest.fn();
  const report = await run(snapshot, {}, { onProgress: progress });
  expect(report).toMatchObject({ protocol: 'inventory_coverage_robustness_v2', status: 'complete', calls: 0,
    livePromotionAllowed: false, sampledDescriptions: 8, sampleShortfall: 0 });
  expect(report.arms).toHaveLength(6);
  expect(report.arms[0]).toMatchObject({ evaluated: 8, compared: 8, placementAgreements: 8, abstained: 0 });
  for (const arm of report.arms) {
    expect(arm.compared + arm.abstained).toBe(8);
    expect(arm.placementAgreements + arm.placementDisagreements).toBe(arm.compared);
    expect(arm.mediaTypes.map(row => row.evaluated)).toEqual([4, 4]);
    expect(arm.libraries.map(row => row.evaluated)).toEqual([2, 2, 2, 2]);
    expect(arm.folds).toHaveLength(2);
    expect(arm.folds[0].libraries).toHaveLength(4);
  }
  expect(report.arms.find(arm => arm.name === 'random_20')).toMatchObject({ compared: 0, abstained: 8,
    reasons: { incomplete_profiles: 8 }, pairedWithComplete: { newAbstentions: 8 } });
  expect(progress).toHaveBeenCalledTimes(12);
  expect(JSON.stringify([report, progress.mock.calls])).not.toMatch(/PRIVATE|overview|centroid|libraryIds|tmdb_id/);
  for (const doc of snapshot.corpus.documents) expect(JSON.stringify(report)).not.toContain(doc.hash);
  expect(snapshot).toEqual(before);
});

test('fit receives only training data; every masked arm retains full memberships and excludes fold queries', async () => {
  const snapshot = fixture(), seen = [];
  const fit = async (training, dimensions, dependencies) => {
    seen.push(structuredClone(training));
    return localFit(training, dimensions, dependencies);
  };
  await run(snapshot, {}, { fit });
  expect(seen).toHaveLength(12);
  for (let fold = 0; fold < 2; fold++) {
    const base = seen[fold * 6];
    expect(base.corpus.documents).toHaveLength(76);
    for (const arm of seen.slice(fold * 6, fold * 6 + 6)) {
      expect(arm.corpus.documents).toEqual(base.corpus.documents);
      expect(arm.corpus.texts).toEqual(base.corpus.texts);
      expect(arm.libraries).toEqual(base.libraries);
      expect([...arm.vectors.keys()].every(hash => base.corpus.texts.has(hash))).toBe(true);
    }
  }
});

test('cohorts remain disjoint, shortfalls explicit, and sparse scopes abstain', async () => {
  const snapshot = fixture(4);
  const first = await run(snapshot, { size: 8 });
  const second = await run(snapshot, { size: 10, excludePriorSize: 8 });
  expect(second).toMatchObject({ sampledDescriptions: 8, sampleShortfall: 2, excludedPriorDescriptions: 8,
    evaluation: { previousSampleOverlap: 0, priorCohortSizes: [8], priorItemsAvailableForTraining: true } });
  expect(second.sampleFingerprint).not.toBe(first.sampleFingerprint);
  const sparse = await run(fixture(2));
  expect(sparse.arms[0]).toMatchObject({ compared: 0, reasons: { sparse_profiles: 8 } });
});

test('candidate decision retains unavailable alternatives and keeps placement labels out of ranking', async () => {
  const snapshot = fixture(), model = await localFit(snapshot, 4), doc = snapshot.corpus.documents[0];
  expect(coverageBenchmarkDecision(model, { ...doc, libraryIds: [2] }, [1, 0, 0, 0], 4))
    .toEqual({ reason: 'selected', id: 1, agreement: false });
  model.libraries.get(2).coverage.status = 'waiting';
  expect(coverageBenchmarkDecision(model, doc, [1, 0, 0, 0], 4)).toEqual({ reason: 'incomplete_profiles' });
  model.libraries.delete(2);
  expect(coverageBenchmarkDecision(model, doc, [1, 0, 0, 0], 4)).toEqual({ reason: 'insufficient_candidates' });
});

test('paired accounting distinguishes destination changes, gains, losses, new abstentions and recovery', () => {
  const metrics = createCoverageMetrics(), agree = { reason: 'selected', id: 1, agreement: true },
    disagree = { reason: 'selected', id: 2, agreement: false }, abstain = { reason: 'tied_destinations' };
  for (const [decision, baseline] of [[agree, disagree], [disagree, agree], [agree, agree], [abstain, agree], [agree, abstain], [abstain, abstain]]) {
    recordCoverageDecision(metrics, decision, baseline);
  }
  expect(metrics).toMatchObject({ evaluated: 6, compared: 4, placementAgreements: 3, placementDisagreements: 1, abstained: 2,
    pairedWithComplete: { bothCompared: 3, changedDestination: 2, gainedAgreement: 1, lostAgreement: 1,
      newAbstentions: 1, recoveredComparisons: 1, bothAbstained: 1 } });
});

test('rejects incomplete/corrupt baselines, work excess, generation and ungrouped runs before fitting', async () => {
  const fit = jest.fn(), missing = fixture(); missing.vectors.delete(missing.corpus.documents[0].hash);
  await expect(run(missing, {}, { fit })).rejects.toThrow('complete_cache_required');
  const corrupt = fixture(); corrupt.vectors.set(corrupt.corpus.documents[0].hash, [NaN, 0, 0, 0]);
  await expect(run(corrupt, {}, { fit })).rejects.toThrow();
  for (const extra of [{ folds: 0 }, { generateCases: 1 }]) await expect(run(fixture(), extra, { fit })).rejects.toThrow('grouped_zero_generation');
  const large = fixture(); large.corpus.documents = Array(10000).fill(large.corpus.documents[0]);
  await expect(runInventoryCoverageBenchmark(large, 1000, { ...options, folds: 10 }, { fit })).rejects.toThrow('work_budget');
  expect(fit).not.toHaveBeenCalled();
});

test('abort and fit failures stop subsequent work without an apparently complete report', async () => {
  const controller = new AbortController(); controller.abort();
  const fit = jest.fn();
  await expect(run(fixture(), {}, { fit, signal: controller.signal })).rejects.toThrow();
  expect(fit).not.toHaveBeenCalled();
  const during = new AbortController(), onProgress = jest.fn(() => during.abort());
  await expect(run(fixture(), {}, { signal: during.signal, onProgress })).rejects.toThrow();
  expect(onProgress).toHaveBeenCalledTimes(1);
  await expect(run(fixture(), {}, { fit: async () => { throw new Error('fit unavailable'); } })).rejects.toThrow('fit unavailable');
});

test('default fitting uses the bounded production worker without publishing a runtime cache', async () => {
  const report = await runInventoryCoverageBenchmark(fixture(4), 4, options);
  expect(report).toMatchObject({ status: 'complete', sampledDescriptions: 8, livePromotionAllowed: false });
});
