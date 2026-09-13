/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { buildInventoryRepresentativeProfile, inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { fitInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfileFit.mjs';
import { fitStableRepresentativeGeometry } from '../../services/inventoryRepresentativeStability.mjs';
import { rankInventoryRepresentativeEvidence } from '../../services/inventoryRepresentativeGroups.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

test('full-inventory profiles are name/order agnostic and retain no corpus or query vectors', async () => {
  const { snapshot } = representativeProfileFixture();
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 });
  expect(model).toMatchObject({ kind: 'full_inventory_shadow', summary: { libraries: 2, trainingDescriptions: 12,
    groups: 2, sparseLibraries: 0, unconvergedStarts: 0, discardedDescriptions: 0 } });
  expect(Object.keys(model).sort()).toEqual(['kind', 'libraries', 'summary', 'version', 'weight']);
  snapshot.libraries.reverse().forEach(row => { row.name = 'Something entirely different'; });
  snapshot.corpus.documents.reverse();
  expect(await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 })).toEqual(model);
  expect(JSON.stringify(model.summary)).not.toMatch(/PRIVATE|hash|libraryId|vector/i);
  expect(() => rankInventoryRepresentativeEvidence(model, { entry: {}, candidates: [] })).toThrow('fold_mismatch');
});

test('source key ignores names and ordering but changes for every training dependency', () => {
  const { snapshot, identity } = representativeProfileFixture();
  const key = inventoryRepresentativeSourceKey(snapshot, identity, 'private-config');
  snapshot.libraries.reverse(); snapshot.corpus.documents.reverse();
  snapshot.libraries[0].name = 'Renamed';
  expect(inventoryRepresentativeSourceKey(snapshot, identity, 'private-config')).toBe(key);
  const change = mutate => {
    const copy = structuredClone(snapshot); mutate(copy);
    expect(inventoryRepresentativeSourceKey(copy, identity, 'private-config')).not.toBe(key);
  };
  change(copy => { copy.libraries.pop(); });
  change(copy => { copy.libraries[0].media_type = 'movie'; });
  change(copy => { copy.corpus.documents[0].libraryIds = [1, 2]; });
  change(copy => { copy.corpus.documents[0].key = 'movie:999'; });
  change(copy => { copy.corpus.documents.pop(); });
  change(copy => { copy.vectors.values().next().value[0] += 0.1; });
  expect(inventoryRepresentativeSourceKey(snapshot, { ...identity, digest: 'b'.repeat(64) }, 'private-config')).not.toBe(key);
  expect(inventoryRepresentativeSourceKey(snapshot, identity, 'other-config')).not.toBe(key);
});

test('shared membership and sparse libraries do not invent independent support', async () => {
  const { snapshot } = representativeProfileFixture();
  snapshot.libraries.push({ id: 3, media_type: 'movie' });
  snapshot.corpus.documents[0].libraryIds.push(3);
  snapshot.corpus.documents.push({ ...snapshot.corpus.documents[1] });
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 });
  expect(model.summary).toMatchObject({ libraries: 3, trainingDescriptions: 11, sharedDescriptions: 1, sparseLibraries: 1 });
  expect(model.libraries.get(3).starts.every(start => start.groups.length === 0)).toBe(true);
});

test('runtime omission of legacy control leaves selected and per-start fits unchanged', async () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ hash: String(i).padStart(64, '0'), vector: [1, 0] }));
  const benchmark = await fitStableRepresentativeGeometry(items);
  const runtime = await fitStableRepresentativeGeometry(items, { includeLegacy: false });
  expect(runtime.groups).toEqual(benchmark.groups);
  expect(runtime.runs).toEqual(benchmark.runs);
  expect(runtime.legacy).toBeNull();
  expect(runtime.stability.totalIterations).toBe(benchmark.stability.totalIterations - benchmark.legacy.iterations);
});

test('rejects input limits, incomplete vectors, invalid vectors and pre-cancellation', async () => {
  const { snapshot, identity } = representativeProfileFixture();
  const large = { ...snapshot, corpus: { ...snapshot.corpus, texts: { size: 8_000_001 } } };
  expect(() => inventoryRepresentativeSourceKey(large, identity, '')).toThrow('input_budget');
  await expect(buildInventoryRepresentativeProfile({ snapshot: large, dimensions: 2 })).rejects.toThrow('input_budget');
  const controller = new AbortController(); controller.abort();
  await expect(buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 }, { signal: controller.signal })).rejects.toThrow();
  snapshot.vectors.values().next().value[0] = NaN;
  expect(() => inventoryRepresentativeSourceKey(snapshot, identity, '')).toThrow('Embedding');
  snapshot.vectors.clear();
  expect(() => inventoryRepresentativeSourceKey(snapshot, identity, '')).toThrow('input_budget');
});

test('real ESM thread matches direct fit and sanitizes failed work', async () => {
  const { snapshot } = representativeProfileFixture();
  expect(await fitInventoryRepresentativeProfile(snapshot, 2)).toEqual(await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 }));
  snapshot.vectors.values().next().value[0] = NaN;
  await expect(fitInventoryRepresentativeProfile(snapshot, 2)).rejects.toThrow('inventory_representative_fit_unavailable');
  const controller = new AbortController(); controller.abort();
  await expect(fitInventoryRepresentativeProfile(snapshot, 2, { signal: controller.signal })).rejects.toThrow();
});

test('an in-flight thread can be cancelled and is terminated before returning', async () => {
  const { snapshot } = representativeProfileFixture();
  const controller = new AbortController();
  const fit = fitInventoryRepresentativeProfile(snapshot, 2, { signal: controller.signal });
  controller.abort();
  await expect(fit).rejects.toThrow('inventory_representative_fit_cancelled');
  expect(await fitInventoryRepresentativeProfile(snapshot, 2)).toMatchObject({ kind: 'full_inventory_shadow' });
});

test('worker input is bounded before cloning; unscoped documents cannot train a library', async () => {
  const { snapshot } = representativeProfileFixture();
  await expect(fitInventoryRepresentativeProfile(snapshot, 0)).rejects.toThrow('fit_input_budget');
  await expect(fitInventoryRepresentativeProfile({ ...snapshot, vectors: new Map() }, 2)).rejects.toThrow('fit_input_budget');
  snapshot.corpus.documents[0].libraryIds = [999];
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 });
  expect(model.summary.trainingDescriptions).toBe(11);
  snapshot.corpus.documents.push({ ...snapshot.corpus.documents[1] });
  const { identity } = representativeProfileFixture();
  expect(inventoryRepresentativeSourceKey(snapshot, identity, 'config')).toMatch(/^[a-f0-9]{64}$/);
});
