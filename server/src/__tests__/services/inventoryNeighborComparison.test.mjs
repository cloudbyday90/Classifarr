/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { runInventoryNeighborComparison } from '../../services/inventoryNeighborComparison.mjs';
import { summarizeNeighborComparison } from '../../services/inventoryNeighborComparisonReport.mjs';

const options = { seed: 'neighbor-comparison-test-2026', size: 40, folds: 5 };
const representation = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
function snapshot() {
  const libraries = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, media_type: i < 2 ? 'movie' : 'tv', name: `Private library ${i}` }));
  const corpus = prepareInventoryDescriptionCorpus(libraries.flatMap(library => Array.from({ length: 70 }, (_, i) => ({
    library_id: library.id, media_type: library.media_type, tmdb_id: library.id * 100 + i,
    overview: `Private description ${library.id}:${i}` }))));
  const vectors = new Map(corpus.documents.map(doc => {
    const angle = (doc.id % 100) / 100 + (doc.libraryIds[0] % 2 ? 0 : Math.PI);
    return [doc.hash, [Math.cos(angle), Math.sin(angle)]];
  }));
  return { corpus, libraries, vectors };
}

test('pairs a balanced movie/TV cohort, preserves every library and emits no item data', async () => {
  const input = snapshot();
  const result = await runInventoryNeighborComparison(input, representation, options);
  expect(result).toMatchObject({ status: 'complete', sampledTitles: 40, evaluated: 40, sampleShortfall: 0,
    calls: 0, independentLabels: 0, accuracy: null, livePromotionAllowed: false, liveRoutingChanged: false });
  expect(result.byMedia.map(row => row.evaluated)).toEqual([20, 20]);
  expect(result.byLibrary.map(row => row.evaluated)).toEqual([10, 10, 10, 10]);
  expect(result.calibration.coverage).toHaveLength(20);
  expect(result.arms[0]).toMatchObject({ available: 40, neighborSupport: 40, supportedPlacementAgreement: 40 });
  expect(result.calibration.coverage.every(row => row.status === 'available')).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/Private|libraryId|descriptionHash|tmdb|overview|vectors/);
  expect(await runInventoryNeighborComparison(input, representation, options)).toEqual(result);
});

test('cross-fit option preserves all original arms and reports small-library coverage gains separately', async () => {
  const input = snapshot(); input.corpus.documents = input.corpus.documents.filter(doc => doc.libraryIds[0] !== 1 || doc.id < 130);
  const baseline = await runInventoryNeighborComparison(input, representation, options);
  const result = await runInventoryNeighborComparison(input, representation, options, { crossFit: true });
  expect(result).toMatchObject({ protocol: 'inventory_neighbor_comparison_v2', calls: 0, evaluated: 40,
    independentLabels: 0, accuracy: null, livePromotionAllowed: false, liveRoutingChanged: false });
  expect(result.arms).toHaveLength(7);
  expect(result.arms.slice(0, 4)).toEqual(baseline.arms);
  expect(result.sampleFingerprint).toBe(baseline.sampleFingerprint);
  expect(result.calibration).toEqual(baseline.calibration);
  expect(result.crossFitCalibration.coverage).toHaveLength(20);
  expect(result.crossFitCalibration.coverage.every(row => row.minimumCalibrationReferences >= 20 && row.status === 'available')).toBe(true);
  expect(result.paired.find(row => row.from === 'reference_calibrated' && row.to === 'cross_fit_calibrated'))
    .toMatchObject({ gainedAvailability: 20, lostAvailability: 0 });
  expect(JSON.stringify(result)).not.toMatch(/Private|libraryId|descriptionHash|tmdb|overview|vectors/);
  for (const row of result.byMedia) expect(row.arms).toHaveLength(7);
  for (const row of result.byLibrary) expect(row.arms).toHaveLength(7);
});

test('cancellation reports an incomplete run without private errors or additional work', async () => {
  const abort = new AbortController();
  const result = await runInventoryNeighborComparison(snapshot(), representation, options,
    { signal: abort.signal, onProgress: () => abort.abort(new Error('Private cancellation')) });
  expect(result).toMatchObject({ status: 'interrupted', evaluated: 1, calls: 0 });
  expect(JSON.stringify(result)).not.toContain('Private');
  await expect(runInventoryNeighborComparison(snapshot(), representation, options, { signal: abort.signal })).rejects.toThrow();
});

test('shared descriptions cannot supply support in any comparison arm', async () => {
  const input = snapshot();
  input.corpus.documents.filter(doc => doc.libraryIds[0] === 1 && doc.id % 3 === 0).forEach(doc => { doc.libraryIds.push(2); });
  const result = await runInventoryNeighborComparison(input, representation, options);
  expect(result.sharedDescriptionBlocked).toBeGreaterThan(0);
  for (const arm of result.arms) expect(arm.neighborSupport).toBeLessThanOrEqual(result.evaluated - result.sharedDescriptionBlocked);
});

test('rejects ungrouped evaluation and generation before preparation; sparse pools remain visible', async () => {
  for (const invalid of [{ ...options, folds: 0 }, { ...options, generateCases: 1 }]) {
    await expect(runInventoryNeighborComparison(null, representation, invalid)).rejects.toThrow('requires_folds_without_generation');
  }
  const input = snapshot(); input.corpus.documents = input.corpus.documents.filter(doc => doc.libraryIds[0] !== 1 || doc.id < 120);
  const result = await runInventoryNeighborComparison(input, representation, options);
  expect(result.calibration.coverage.filter(row => row.mediaType === 'movie').every(row => row.status === 'sparse')).toBe(true);
  expect(result.byMedia[0].arms[3]).toMatchObject({ available: 0, neighborSupport: 0 });
  expect(result.byMedia[1].arms[3].available).toBe(20);
});

test('paired gains exclude unavailable arms and never count placement agreement as accuracy', () => {
  const row = (before, after, agreement, available = true) => ({ proposed: true, shared: false, placementAgreement: agreement,
    arms: { full_strict: { available: true, support: false }, reference_strict: { available: true, support: before },
      reference_mean: { available: true, support: after }, reference_calibrated: { available, support: false } } });
  const summary = summarizeNeighborComparison([row(false, true, true), row(false, true, false), row(true, true, true, false)]);
  expect(summary.paired[1]).toMatchObject({ available: 3, gainedSupport: 2, gainedPlacementAgreement: 1, gainedPlacementDisagreement: 1 });
  expect(summary.paired[2]).toMatchObject({ available: 2, lostSupport: 2 });
  expect(summary.arms[3]).toMatchObject({ available: 2, unavailable: 1, neighborReview: 2 });
});
