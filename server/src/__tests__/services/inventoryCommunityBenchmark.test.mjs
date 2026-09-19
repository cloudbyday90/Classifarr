/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { runInventoryCommunityBenchmark } from '../../services/inventoryCommunityBenchmark.mjs';

const options = { seed: 'community-groups-test-2026', size: 8, folds: 2 };
function fixture() {
  const libraries = [1, 2, 3, 4].map(id => ({ id, media_type: id < 3 ? 'movie' : 'tv', name: `PRIVATE library ${id}` }));
  const corpus = prepareInventoryDescriptionCorpus(libraries.flatMap(library => Array.from({ length: 12 }, (_, index) => ({
    tmdb_id: library.id * 100 + index, media_type: library.media_type, library_id: library.id, overview: `PRIVATE overview ${library.id} ${index}`,
  }))));
  return { libraries, corpus, vectors: new Map(corpus.documents.map(doc => [doc.hash,
    [1, 2, 3, 4].map(id => id === doc.libraryIds[0] ? 1 : 0)])) };
}
const localFit = (snapshot, dimensions, dependencies) => buildInventoryRepresentativeProfile({ snapshot, dimensions }, dependencies);
const run = (snapshot = fixture(), extra = {}, dependencies = {}) => runInventoryCommunityBenchmark(snapshot, 4,
  { ...options, ...extra }, { fit: localFit, ...dependencies });

test('evaluates content-only communities on held-out movie/TV queries with aggregate-only private output', async () => {
  const snapshot = fixture(), before = structuredClone(snapshot), seen = [], onProgress = jest.fn();
  const fit = async (training, dimensions, dependencies) => { seen.push(training); return localFit(training, dimensions, dependencies); };
  const report = await run(snapshot, {}, { fit, onProgress });
  expect(report).toMatchObject({ protocol: 'inventory_local_communities_v1', status: 'complete', calls: 0,
    livePromotionAllowed: false, independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false,
    sampledDescriptions: 8, sampleShortfall: 0, evaluation: { previousSampleOverlap: 0 } });
  expect(report.arms.map(row => row.name)).toEqual(['fixed_groups', 'community_geometry', 'community_supported']);
  for (const arm of report.arms.slice(0, 2)) {
    expect(arm).toMatchObject({ evaluated: 8, compared: 8, placementAgreements: 8, abstained: 0 });
    expect(arm.mediaTypes.map(row => row.evaluated)).toEqual([4, 4]);
    expect(arm.libraries.map(row => row.evaluated)).toEqual([2, 2, 2, 2]);
  }
  // Distinct descriptions with identical vectors are tied evidence, not extra certainty.
  expect(report.arms[2]).toMatchObject({ evaluated: 8, abstained: 8, reasons: { ambiguous_nearest: 8 } });
  expect(report.quality).toHaveLength(8); expect(report.discovery).toHaveLength(4);
  expect(report.quality.every(row => row.control.marginsMeasured === false && row.communities.marginsMeasured === false)).toBe(true);
  for (const training of seen) {
    expect(training.corpus.documents).toHaveLength(44); expect(training.vectors.size).toBe(44);
    expect(JSON.stringify(training)).not.toContain('PRIVATE');
  }
  expect(JSON.stringify([report, onProgress.mock.calls])).not.toMatch(/PRIVATE|centroid|overview|libraryIds|tmdb_id/);
  for (const doc of snapshot.corpus.documents) expect(JSON.stringify(report)).not.toContain(doc.hash);
  expect(snapshot).toEqual(before);
  snapshot.libraries.reverse(); snapshot.corpus.documents.reverse();
  const reordered = await run(snapshot);
  expect(reordered.arms).toEqual(report.arms); expect(reordered.quality).toEqual(report.quality);
  expect(reordered.discovery).toEqual(report.discovery);
});

test('retains empty alternatives, removes shared held-out copies and reports sample shortfall', async () => {
  const snapshot = fixture(), [doc] = snapshot.corpus.documents;
  snapshot.corpus.documents.push({ ...doc, key: 'movie:9999', libraryIds: [2] });
  snapshot.corpus.documents = snapshot.corpus.documents.filter(row => !row.libraryIds.includes(4));
  const hashes = new Set(snapshot.corpus.documents.map(row => row.hash));
  snapshot.corpus.texts = new Map([...snapshot.corpus.texts].filter(([hash]) => hashes.has(hash)));
  snapshot.vectors = new Map([...snapshot.vectors].filter(([hash]) => hashes.has(hash)));
  const report = await run(snapshot, { size: 50 });
  expect(report.sampleShortfall).toBeGreaterThan(0);
  expect(report.arms.every(arm => arm.reasons.unavailable_groups > 0)).toBe(true);
  expect(report.quality.filter(row => row.stratum === 4).every(row => row.communities.groups === 0)).toBe(true);
});

test('rejects missing cache, malformed vectors, bad options, cancellation and corrupted controls', async () => {
  for (const extra of [{ folds: 0 }, { generateCases: 1 }]) await expect(run(fixture(), extra)).rejects.toThrow('require_grouped');
  const snapshot = fixture(); snapshot.vectors.delete(snapshot.corpus.documents[0].hash);
  await expect(run(snapshot)).rejects.toThrow('complete_cache');
  await expect(run(fixture(), {}, { signal: AbortSignal.abort() })).rejects.toThrow();
  await expect(run(fixture(), {}, { fit: async () => ({ libraries: new Map() }) })).rejects.toThrow('scope_changed');
  const invalid = fixture(); invalid.vectors.set(invalid.corpus.documents[0].hash, [NaN, 0, 0, 0]);
  await expect(run(invalid)).rejects.toThrow();
});

test('excludes prior cohorts, allows their training context and bounds the entire run', async () => {
  const first = await run(), later = await run(fixture(), { excludePriorSizes: [8] });
  expect(later.sampleFingerprint).not.toBe(first.sampleFingerprint);
  expect(later).toMatchObject({ excludedPriorDescriptions: 8, evaluation: { previousSampleOverlap: 0, priorItemsAvailableForTraining: true } });
  const snapshot = fixture(), fit = jest.fn();
  snapshot.corpus.texts = new Map([...snapshot.corpus.texts, ...Array.from({ length: 7952 }, (_, i) => [i.toString(16).padStart(64, '0'), 'PRIVATE'])]);
  await expect(runInventoryCommunityBenchmark(snapshot, 1000, { ...options, folds: 10 }, { fit })).rejects.toThrow('work_budget');
  expect(fit).not.toHaveBeenCalled();
});
