/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runInventoryMultiScaleBenchmark } from '../../services/inventoryMultiScaleBenchmark.mjs';
import { createMultiScaleProfileLoader } from '../../services/inventoryMultiScaleCache.mjs';
import { buildMultiScaleProfile } from '../../services/inventoryMultiScaleProfile.mjs';
import { fixture, representation, localFit } from '../fixtures/inventoryMultiScaleFixture.mjs';

const options = { seed: 'multi-scale-test-seed-2026', size: 8, folds: 2 };
const createLoader = () => createMultiScaleProfileLoader({ build: (source, dependencies) => buildMultiScaleProfile(source, { ...dependencies, fit: localFit }) });
const run = (snapshot = fixture(), extra = {}, dependencies = {}) => runInventoryMultiScaleBenchmark(snapshot, representation,
  { ...options, ...extra }, { createLoader, ...dependencies });

test('measures held-out movie/TV coverage and cache reuse with no inference or private output', async () => {
  const snapshot = fixture(), before = structuredClone(snapshot), onProgress = jest.fn();
  const report = await run(snapshot, {}, { onProgress });
  expect(report).toMatchObject({ protocol: 'inventory_multi_scale_context_v1', status: 'complete', calls: 0,
    independentLabels: 0, accuracy: null, livePromotionAllowed: false, sampledDescriptions: 8,
    context: { queries: 8, candidates: 16, lostRawExamples: 0, duplicateExamples: 0, omittedCandidates: 0 } });
  expect(report.context.mediaTypes.map(row => row.queries)).toEqual([4, 4]);
  expect(report.arms[0]).toMatchObject({ compared: 8, placementAgreements: 8, abstained: 0 });
  expect(report.caching).toHaveLength(2);
  expect(report.caching.every(row => row.cold === 'miss' && row.warm === 'hit' && row.reused)).toBe(true);
  expect(report.quality).toHaveLength(8);
  expect(JSON.stringify([report, onProgress.mock.calls])).not.toMatch(/PRIVATE|centroid|overview|libraryIds|tmdb_id/);
  for (const doc of snapshot.corpus.documents) expect(JSON.stringify(report)).not.toContain(doc.hash);
  expect(snapshot).toEqual(before);
  const later = await run(snapshot, { excludePriorSizes: [8] });
  expect(later.sampleFingerprint).not.toBe(report.sampleFingerprint);
  expect(later).toMatchObject({ excludedPriorDescriptions: 8, evaluation: { previousSampleOverlap: 0, priorItemsAvailableForTraining: true } });
});

test('reports sparse/shared alternatives, shortfall, zero-query folds and failed optional discovery', async () => {
  const snapshot = fixture(), doc = snapshot.corpus.documents[0];
  snapshot.corpus.documents.push({ ...doc, libraryIds: [2] }); snapshot.libraries.push({ id: 5, media_type: 'movie' });
  const report = await run(snapshot, { size: 100 });
  expect(report.sampleShortfall).toBe(52); expect(report.context.sparseCandidates).toBeGreaterThan(0);
  expect(report.context.sharedExamples).toBeGreaterThan(0);
  expect((await run(fixture(), { size: 1, folds: 5 })).caching).toHaveLength(1);
  const degraded = () => createMultiScaleProfileLoader({ build: (source, dependencies) => buildMultiScaleProfile(source,
    { ...dependencies, fit: localFit, discover: async () => { throw new Error('optional'); } }) });
  expect((await run(fixture(), {}, { createLoader: degraded })).caching.every(row => row.warm === 'miss' && !row.reused)).toBe(true);
});

test('rejects bad modes/budgets and cleans up on abort/build failure', async () => {
  for (const extra of [{ folds: 0 }, { generateCases: 1 }]) await expect(run(fixture(), extra)).rejects.toThrow('require');
  await expect(run(fixture(), {}, { signal: AbortSignal.abort() })).rejects.toThrow();
  const loader = { clear: jest.fn(), load: jest.fn(async () => { throw new Error('fit'); }) };
  await expect(run(fixture(), {}, { createLoader: () => loader })).rejects.toThrow('fit');
  expect(loader.clear).toHaveBeenCalledTimes(1);
  const snapshot = fixture();
  snapshot.corpus.texts = new Map([...snapshot.corpus.texts, ...Array.from({ length: 7952 }, (_, i) => [i.toString(16).padStart(64, '0'), null])]);
  await expect(runInventoryMultiScaleBenchmark(snapshot, { ...representation, dimensions: 1000 }, { ...options, folds: 10 })).rejects.toThrow('work_budget');
});
