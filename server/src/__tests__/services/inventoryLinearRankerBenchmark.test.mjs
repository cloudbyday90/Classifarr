/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { linearFixture } from '../fixtures/inventoryLinearRankerFixture.mjs';
import { runInventoryLinearRankerBenchmark } from '../../services/inventoryLinearRankerBenchmark.mjs';
import { trainLinearRanker } from '../../services/inventoryLinearRankerMath.mjs';
import { prepareLinearRankerSource, selectLinearRankerTraining, buildLinearRankerMatrix } from '../../services/inventoryLinearRankerSource.mjs';
import { perturbLinearTraining } from '../../services/inventoryLinearRankerComparison.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';

const options = { seed: 'linear-ranker-test-2026', size: 12, folds: 2 };
const localFit = async input => trainLinearRanker(input);
test('paired synthetic benchmark uses identical admitted populations, learns both media types and emits only aggregates', async () => {
  const snapshot = linearFixture(), fit = jest.fn(localFit), onProgress = jest.fn();
  const report = await runInventoryLinearRankerBenchmark(snapshot, 4, options, { fit, onProgress });
  expect(report).toMatchObject({ status: 'complete', sampledDescriptions: 12, calls: 0, independentLabels: 0,
    accuracy: null, livePromotionAllowed: false, observedPlacementIsGroundTruth: false, provenanceComplete: false });
  expect(report.comparison.arms.every(arm => arm.selected === 12 && arm.placementAgreements === 12)).toBe(true);
  expect(report.comparison.byMedia.movie.sampled).toBe(6); expect(report.comparison.byMedia.tv.sampled).toBe(6);
  expect(report.comparison.byLibrary).toHaveLength(4); expect(fit).toHaveBeenCalledTimes(8);
  expect(onProgress).toHaveBeenCalledTimes(4);
  for (let i = 0; i < fit.mock.calls.length; i += 2) {
    expect(fit.mock.calls[i][0].matrix).toBe(fit.mock.calls[i + 1][0].matrix);
    expect(fit.mock.calls[i][0].labels).not.toBe(fit.mock.calls[i + 1][0].labels);
  }
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|movie:|tv:|synthetic-|"weights"|"matrix"/);
  const repeated = await runInventoryLinearRankerBenchmark(snapshot, 4, options, { fit: localFit });
  expect(repeated.comparison).toEqual(report.comparison); expect(repeated.snapshotComponents).toEqual(report.snapshotComponents);
});

test('query destination changes do not change fitted weights in its held-out fold', async () => {
  const snapshot = linearFixture(), calls = [];
  await runInventoryLinearRankerBenchmark(snapshot, 4, { ...options, size: 1 }, { fit: async input => {
    const model = trainLinearRanker(input); calls.push(model); return model;
  } });
  // Direct training check covers the stronger group invariant without changing sample/fold stratification.
  const held = new Set([snapshot.corpus.documents[0].hash]);
  const source = prepareLinearRankerSource(snapshot, 4);
  const before = buildLinearRankerMatrix(source, selectLinearRankerTraining(source, held).documents, 'movie');
  snapshot.corpus.documents[0].libraryIds = [2];
  const afterSource = prepareLinearRankerSource(snapshot, 4);
  expect(buildLinearRankerMatrix(afterSource, selectLinearRankerTraining(afterSource, held).documents, 'movie')).toEqual(before);
  expect(calls.length).toBeGreaterThan(0);
});

test('noise is deterministic, stratified, bounded and never mutates observed or original training labels', () => {
  const source = prepareLinearRankerSource(linearFixture(), 4), rows = selectLinearRankerTraining(source, new Set()).documents.filter(doc => doc.type === 'movie');
  const input = buildLinearRankerMatrix(source, rows, 'movie'), original = new Uint16Array(input.labels);
  const noisy = perturbLinearTraining(input, rows, options.seed);
  expect(noisy.changed).toBe(2); expect(perturbLinearTraining(input, rows, options.seed)).toEqual(noisy);
  expect(input.labels).toEqual(original); expect(noisy.labels).not.toEqual(original);
});

test('history-only/sparse/empty populations abstain explicitly and do not fit guessed classes', async () => {
  const snapshot = linearFixture(); snapshot.trainingExclusions = new Set(snapshot.corpus.documents.map(doc => doc.key));
  const fit = jest.fn();
  const report = await runInventoryLinearRankerBenchmark(snapshot, 4, options, { fit });
  expect(report).toMatchObject({ status: 'completed_with_errors', trainingComplete: false });
  expect(fit).not.toHaveBeenCalled();
  expect(report.comparison.arms.every(arm => arm.abstained === 12)).toBe(true);
  expect(report.comparison).toMatchObject({ observedOutsideTrainingClasses: 12, heldWithRetainedHistory: 12 });
  expect(report.fits.every(row => row.status === 'insufficient_classes')).toBe(true);
  snapshot.corpus.documents = []; snapshot.trainingExclusions.clear();
  const empty = await runInventoryLinearRankerBenchmark(snapshot, 4, options, { fit });
  expect(empty).toMatchObject({ sampledDescriptions: 0, sampleShortfall: 12 });
});

test('invalid modes, aborted/failed workers and cancelled post-fit results never return success', async () => {
  const snapshot = linearFixture(), fit = jest.fn();
  for (const bad of [{ ...options, folds: 0 }, { ...options, generateCases: 1 }]) {
    await expect(runInventoryLinearRankerBenchmark(snapshot, 4, bad, { fit })).rejects.toThrow('grouped_zero_generation');
  }
  expect(fit).not.toHaveBeenCalled();
  await expect(runInventoryLinearRankerBenchmark(snapshot, 4, options, { fit: async () => { throw new Error('unavailable'); } })).rejects.toThrow('unavailable');
  const controller = new AbortController();
  await expect(runInventoryLinearRankerBenchmark(snapshot, 4, options, { signal: controller.signal, fit: async input => {
    controller.abort(); return trainLinearRanker(input);
  } })).rejects.toThrow();
  await expect(runInventoryLinearRankerBenchmark(snapshot, 4, options, { signal: controller.signal, fit })).rejects.toThrow();
});

test.each([[32, 4000, 'benchmark_work_budget'], [64, 2000, 'fit_work_budget']])('bounds work before the first worker (%i classes)', async (count, dimensions, reason) => {
  const libraries = Array.from({ length: count }, (_, i) => ({ id: i + 1, media_type: 'movie' }));
  const corpus = prepareInventoryDescriptionCorpus(libraries.flatMap(library => Array.from({ length: 12 }, (_, i) => ({
    media_type: 'movie', tmdb_id: library.id * 100 + i, library_id: library.id, overview: `Synthetic ${library.id}-${i}`,
  }))));
  const snapshot = { libraries, corpus, vectors: new Map([...corpus.texts.keys()].map(hash => [hash,
    Array.from({ length: dimensions }, (_, d) => Number(d === 0))])), candidateMetadata: new Map(), trainingExclusions: new Set() };
  const fit = jest.fn();
  await expect(runInventoryLinearRankerBenchmark(snapshot, dimensions, { ...options, folds: 10 }, { fit })).rejects.toThrow(reason);
  expect(fit).not.toHaveBeenCalled();
});
