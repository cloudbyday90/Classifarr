/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { fitRepresentativeGeometry } from '../../services/inventoryRepresentativeGeometry.mjs';
import { fitStableRepresentativeGeometry, representativePartitionAgreement, selectRepresentativeFit } from '../../services/inventoryRepresentativeStability.mjs';
import { createInventoryRepresentativeIndex, learnInventoryRepresentativeGroups } from '../../services/inventoryRepresentativeGroups.mjs';
import { rankStableInventoryRepresentativeEvidence } from '../../services/inventoryRepresentativeStabilityRanking.mjs';
import { rankInventoryEvidence } from '../../services/inventoryEvidenceReranker.mjs';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
function items(count = 400, dimensions = 8) {
  let state = 123;
  return Array.from({ length: count }, (_, i) => {
    const vector = Array.from({ length: dimensions }, () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296 - 0.5;
    });
    const norm = Math.hypot(...vector);
    return { hash: hash(i), vector: vector.map(value => value / norm) };
  }).sort((a, b) => a.hash.localeCompare(b.hash));
}

test('partition agreement is symmetric, permutation invariant and chance adjusted', () => {
  expect(representativePartitionAgreement([], [])).toBe(1);
  expect(representativePartitionAgreement([0], [1])).toBe(1);
  expect(representativePartitionAgreement([0, 0], [2, 2])).toBe(1);
  expect(representativePartitionAgreement([0, 1], [2, 3])).toBe(1);
  expect(representativePartitionAgreement([0, 0, 1, 1], [1, 1, 0, 0])).toBe(1);
  expect(representativePartitionAgreement([0, 0, 1, 1], [0, 1, 0, 1])).toBeCloseTo(-0.5);
  expect(representativePartitionAgreement([0, 0, 1, 2], [0, 0, 1, 1])).toBeCloseTo(4 / 7);
  expect(representativePartitionAgreement([0, 0, 1, 1], [0, 0, 1, 2])).toBeCloseTo(4 / 7);
  expect(() => representativePartitionAgreement([0], [])).toThrow('partition_length');
});

test('fit selection uses convergence then training objective with deterministic ties, never labels', () => {
  expect(selectRepresentativeFit([{ converged: false, objective: 1 }, { converged: true, objective: 0.5 }])).toBe(1);
  expect(selectRepresentativeFit([{ converged: true, objective: 0.5 }, { converged: false, objective: 1 }])).toBe(0);
  expect(selectRepresentativeFit([{ converged: true, objective: 0.5 }, { converged: true, objective: 0.7 }])).toBe(1);
  expect(selectRepresentativeFit([{ converged: false, objective: 0.5 }, { converged: false, objective: 0.7 }])).toBe(1);
  expect(selectRepresentativeFit([{ converged: true, objective: 0.5 }, { converged: true, objective: 0.5 }])).toBe(0);
  for (const runs of [[], [{ converged: true, objective: NaN }], [{ objective: 0.5 }]]) {
    expect(() => selectRepresentativeFit(runs)).toThrow('fit_invalid');
  }
});

test('continues the original initialization, measures three bounded fits, and keeps v1 reproducible', async () => {
  // This seeded fixture still needs 33 fitting passes; avoid repeated 2,000-row
  // fits inside instrumented Jest when the contract under test is not throughput.
  const training = items(800, 16), legacy = await fitRepresentativeGeometry(training);
  const result = await fitStableRepresentativeGeometry(training);
  expect(result.legacy).toEqual(legacy);
  expect(result.stability.starts).toHaveLength(3);
  expect(result.stability.totalIterations).toBeLessThanOrEqual(12 + 3 * 64);
  expect(result.runs[0].iterations).toBeGreaterThan(12);
  expect(result.runs[0].converged).toBe(true);
  expect(result.runs[0].objective).toBeGreaterThanOrEqual((await fitRepresentativeGeometry(training, { diagnostics: true })).objective);
  expect(result.stability.minimumPartitionAgreement).toBeGreaterThanOrEqual(-0.5);
  expect(result.stability.minimumPartitionAgreement).toBeLessThanOrEqual(1);
  expect(result.runs.every(run => !Object.hasOwn(run, 'labels'))).toBe(true);
  expect(await fitStableRepresentativeGeometry(training)).toEqual(result);
  const limited = await fitRepresentativeGeometry(training, { maxPasses: 1, diagnostics: true });
  expect(limited).toMatchObject({ iterations: 1, converged: false });
  expect(limited.labels).toHaveLength(training.length);
});

test('validates fit limits, handles sparse input and zero means, and cancels without returning a partial model', async () => {
  const training = items(20);
  for (const maxPasses of [0, 65, NaN, 2.5]) await expect(fitRepresentativeGeometry(training, { maxPasses })).rejects.toThrow('fit_options');
  for (const firstIndex of [-1, 20, NaN, 1.5]) await expect(fitRepresentativeGeometry(training, { firstIndex })).rejects.toThrow('fit_options');
  expect((await fitStableRepresentativeGeometry([])).stability).toMatchObject({ totalIterations: 0, minimumPartitionAgreement: 1 });
  const sparse = await fitStableRepresentativeGeometry(training.slice(0, 2));
  expect(sparse).toMatchObject({ groups: [], discarded: 2, objective: 0 });
  const zeroMean = await fitStableRepresentativeGeometry([1, 1, -1, -1].map((v, i) => ({ hash: hash(i), vector: [v, 0] })));
  expect(zeroMean).toMatchObject({ groups: [], objective: 0, discarded: 4 });
  const controller = new AbortController(); controller.abort();
  await expect(fitStableRepresentativeGeometry(training, { signal: controller.signal })).rejects.toThrow();
  const later = new AbortController(); setImmediate(() => later.abort());
  await expect(fitStableRepresentativeGeometry(training, { signal: later.signal })).rejects.toThrow();
});

test('stable learning shares holdout, name/order, media and duplicate safeguards and preflights expanded work', async () => {
  const training = items(80, 4), query = training[0].hash;
  const libraries = [1, 2].map(id => ({ id, media_type: 'movie', name: `Private ${id}` }));
  const documents = training.map((item, i) => ({ key: `movie:${i}`, type: 'movie', hash: item.hash, libraryIds: [i % 2 + 1] }));
  const snapshot = { libraries, vectors: new Map(training.map(item => [item.hash, item.vector])),
    corpus: { documents, texts: new Map(training.map(item => [item.hash, 'Private'])) } };
  const learn = () => learnInventoryRepresentativeGroups(createInventoryRepresentativeIndex(snapshot, 4, 5, { stability: true }), new Set([query]));
  const before = await learn();
  documents.push({ ...documents[0], key: 'held-copy', libraryIds: [2] });
  documents.reverse(); libraries.reverse().forEach(library => { library.name = 'Changed name'; });
  snapshot.vectors.set(query, [1, 0, 0, 0]);
  const after = await learn();
  expect(after.libraries).toEqual(before.libraries); expect(after.coverage).toEqual(before.coverage);
  expect(after.startLibraries).toEqual(before.startLibraries); expect(after.legacyLibraries).toEqual(before.legacyLibraries);
  expect(after.summary.eligibleDescriptions).toBe(79);
  expect(after.summary.legacyIterationLimitLibraries).toBeGreaterThanOrEqual(0);
  expect(() => createInventoryRepresentativeIndex({ ...snapshot, corpus: { ...snapshot.corpus, documents: { length: 50000 } } },
    1024, 5, { stability: true })).toThrow('work_budget');
});

function rankingFixture() {
  const query = hash('query'), held = new Set([query]);
  const libraries = new Map([[1, [{ centroid: [1, 0] }]], [2, [{ centroid: [0, 1] }]], [3, [{ centroid: [-1, 0] }]]]);
  const coverage = new Map([1, 2, 3].map(id => [id, { stability: { starts: Array.from({ length: 3 }, () => ({ converged: id !== 3 })) } }]));
  const model = { held, vectors: new Map([[query, [1, 0]]]), scope: new Map([[1, 'movie'], [2, 'movie'], [3, 'tv']]), libraries, coverage,
    legacyLibraries: structuredClone(libraries), startLibraries: Array.from({ length: 3 }, () => structuredClone(libraries)) };
  const row = { entry: { mediaType: 'movie', descriptionHash: query, heldDescriptionHashes: held },
    candidates: [1, 2].map((id, i) => ({ id, description: 0.9 - i / 10, profileFit: i ? 2 : 1, genres: null, studio: null, rating: null })) };
  return { model, row };
}

test('stable ranking ignores unrelated media but falls back on nonconvergence, seed sensitivity and unavailable groups', () => {
  const { model, row } = rankingFixture(), baseline = rankInventoryEvidence(row.candidates);
  expect(rankStableInventoryRepresentativeEvidence(model, row)).toMatchObject({ status: 'scored' });
  model.startLibraries[2].set(1, [{ centroid: [0, 1] }]); model.startLibraries[2].set(2, [{ centroid: [1, 0] }]);
  expect(rankStableInventoryRepresentativeEvidence(model, row)).toMatchObject({ status: 'initialization_sensitive', ranking: baseline });
  model.startLibraries[2].set(1, []);
  expect(rankStableInventoryRepresentativeEvidence(model, row)).toMatchObject({ status: 'initialization_unavailable', ranking: baseline });
  model.coverage.get(1).stability.starts[0].converged = false;
  expect(rankStableInventoryRepresentativeEvidence(model, row)).toMatchObject({ status: 'unconverged_groups', ranking: baseline });
  model.coverage.delete(1);
  expect(rankStableInventoryRepresentativeEvidence(model, row).status).toBe('unconverged_groups');
  row.candidates[0].profileFit = 3;
  expect(rankStableInventoryRepresentativeEvidence(model, row).status).toBe('consensus');
  row.candidates[0].description = row.candidates[1].description;
  expect(rankStableInventoryRepresentativeEvidence(model, row).status).toBe('ambiguous');
});

test('stable ranking cannot bypass held-out scope checks and requires a full stability model', () => {
  const { model, row } = rankingFixture();
  expect(() => rankStableInventoryRepresentativeEvidence({ ...model, legacyLibraries: null }, row)).toThrow('model_required');
  expect(() => rankStableInventoryRepresentativeEvidence({ ...model, startLibraries: [] }, row)).toThrow('model_required');
  expect(() => rankStableInventoryRepresentativeEvidence(model, { ...row, candidates: row.candidates.slice(1) })).toThrow('scope_mismatch');
  expect(() => rankStableInventoryRepresentativeEvidence(model, { ...row, entry: { ...row.entry, heldDescriptionHashes: new Set() } })).toThrow('fold_mismatch');
});
