/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { assertRepresentativeSnapshotBudget, inspectRepresentativeCoverage, validateRepresentativeCoverage } from '../../services/inventoryRepresentativeCoverage.mjs';
import { buildInventoryRepresentativeProfile, inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { validateInventoryRepresentativeProfileCoverage } from '../../services/inventoryRepresentativeProfileValidation.mjs';
import { fitInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfileFit.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

test.each([[10, 10, 'complete'], [10, 9, 'partial'], [10, 8, 'waiting'], [9, 8, 'waiting'],
  [3, 3, 'complete'], [3, 2, 'waiting'], [2, 2, 'sparse'], [0, 0, 'sparse']])('coverage edge %i/%i is %s without rounded percentages', (eligible, available, status) => {
  const { snapshot } = representativeProfileFixture({ perLibrary: eligible });
  snapshot.corpus.documents.filter(doc => doc.libraryIds.includes(1)).slice(available).forEach(doc => snapshot.vectors.delete(doc.hash));
  expect(inspectRepresentativeCoverage(snapshot).libraries.get(1)).toEqual({ eligibleDescriptions: eligible, availableDescriptions: available, status });
});

test('distinct exclusive coverage uses the full membership graph, including missing shared descriptions', async () => {
  const { snapshot } = representativeProfileFixture({ perLibrary: 10 });
  snapshot.libraries.push({ id: 3, media_type: 'movie' });
  const first = snapshot.corpus.documents[0];
  first.libraryIds.push(3); snapshot.vectors.delete(first.hash);
  snapshot.corpus.documents.push({ ...first }, { ...snapshot.corpus.documents[1] });
  const coverage = inspectRepresentativeCoverage(snapshot);
  expect(coverage.libraries.get(1)).toEqual({ eligibleDescriptions: 9, availableDescriptions: 9, status: 'complete' });
  expect(coverage.libraries.get(3)).toEqual({ eligibleDescriptions: 0, availableDescriptions: 0, status: 'sparse' });
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 });
  expect(model.summary.sharedDescriptions).toBe(1);
  expect(model.summary.trainingDescriptions).toBe(19);
});

test('partial movie profiles coexist with complete TV profiles and real threads retain coverage', async () => {
  const { snapshot, identity } = representativeProfileFixture({ perLibrary: 10 });
  const completeKey = inventoryRepresentativeSourceKey(snapshot, identity, 'config');
  const hash = snapshot.corpus.documents[0].hash, vector = snapshot.vectors.get(hash);
  snapshot.vectors.delete(hash);
  const partialKey = inventoryRepresentativeSourceKey(snapshot, identity, 'config');
  expect(partialKey).not.toBe(completeKey);
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 });
  expect(model.summary).toMatchObject({ eligibleDescriptions: 20, availableDescriptions: 19, missingDescriptions: 1,
    readyLibraries: 2, partialLibraries: 1, waitingLibraries: 0, trainingDescriptions: 19 });
  expect(model.libraries.get(1).coverage.status).toBe('partial');
  expect(model.libraries.get(2).coverage.status).toBe('complete');
  expect(await fitInventoryRepresentativeProfile(snapshot, 2)).toEqual(model);
  expect(() => validateInventoryRepresentativeProfileCoverage(model, snapshot, 2)).not.toThrow();
  snapshot.vectors.set(hash, vector);
  expect(inventoryRepresentativeSourceKey(snapshot, identity, 'config')).toBe(completeKey);
});

test('under-covered libraries stay in scope with no geometry instead of getting fabricated low scores', async () => {
  const { snapshot } = representativeProfileFixture({ perLibrary: 10 });
  snapshot.corpus.documents.slice(0, 2).forEach(doc => snapshot.vectors.delete(doc.hash));
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 });
  expect(model.libraries.size).toBe(2);
  expect(model.libraries.get(1).coverage.status).toBe('waiting');
  expect(model.libraries.get(1).starts.every(start => start.groups.length === 0)).toBe(true);
  expect(model.libraries.get(2).starts.every(start => start.groups.length > 0)).toBe(true);
  expect(model.summary).toMatchObject({ readyLibraries: 1, waitingLibraries: 1, trainingDescriptions: 10 });
});

test.each([
  model => { model.libraries.delete(2); },
  model => { model.libraries.get(1).mediaType = 'tv'; },
  model => { model.libraries.get(1).coverage.availableDescriptions--; },
  model => { model.libraries.get(1).coverage.status = 'partial'; },
  model => { model.libraries.get(1).coverage.extra = 'PRIVATE'; },
  model => { model.libraries.get(1).starts[0].groups[0].support = 100; },
  model => { model.summary.availableDescriptions = 1; },
])('rejects forged coverage or scope in returned profiles %#', async mutate => {
  const { snapshot } = representativeProfileFixture(), model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 });
  mutate(model);
  expect(() => validateInventoryRepresentativeProfileCoverage(model, snapshot, 2)).toThrow('representative_validation_failed');
});

test('missing evidence is accepted, but corrupt present vectors and extra-scope vectors fail closed', async () => {
  const { snapshot } = representativeProfileFixture();
  snapshot.vectors.set('outside', [1, 0]);
  expect(() => assertRepresentativeSnapshotBudget(snapshot, 2)).toThrow('input_budget');
  snapshot.vectors.delete('outside');
  snapshot.vectors.set(snapshot.corpus.documents[0].hash, [NaN, 0]);
  await expect(buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 })).rejects.toThrow();
  for (const record of [null, {}, { eligibleDescriptions: 10, availableDescriptions: 11, status: 'complete' },
    { eligibleDescriptions: 10, availableDescriptions: 8, status: 'partial' }, { eligibleDescriptions: 10001, availableDescriptions: 10001, status: 'complete' }]) {
    expect(() => validateRepresentativeCoverage(record)).toThrow();
  }
});
