/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { fitStableRepresentativeGeometry, REPRESENTATIVE_RECOVERY_WORK_COMPONENTS, REPRESENTATIVE_STABILITY_WORK_COMPONENTS } from '../../services/inventoryRepresentativeStability.mjs';
import { createInventoryRepresentativeIndex } from '../../services/inventoryRepresentativeGroups.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { representativeFitFixture } from '../helpers/representativeFitFixture.mjs';

test('recovery continues only unfinished starts and leaves benchmark controls unchanged', async () => {
  const items = representativeFitFixture();
  const baseline = await fitStableRepresentativeGeometry(items);
  const recovered = await fitStableRepresentativeGeometry(items, { recoverUnconverged: true });
  const unfinished = baseline.runs.filter(run => !run.converged).length;
  expect(unfinished).toBeGreaterThan(0); expect(unfinished).toBeLessThan(3);
  expect(recovered.stability.recovery).toMatchObject({ attemptedStarts: unfinished, recoveredStarts: unfinished, exhaustedStarts: 0 });
  expect(recovered.stability.recovery.additionalIterations).toBeGreaterThan(0);
  expect(recovered.stability.totalIterations - baseline.stability.totalIterations).toBe(recovered.stability.recovery.additionalIterations);
  expect(recovered.legacy).toEqual(baseline.legacy);
  baseline.runs.forEach((run, index) => {
    if (run.converged) expect(recovered.runs[index]).toEqual(run);
    else {
      expect(recovered.runs[index].converged).toBe(true);
      expect(recovered.runs[index].objective).toBeGreaterThanOrEqual(run.objective);
    }
  });
  expect(await fitStableRepresentativeGeometry(items)).toEqual(baseline);
  expect(baseline.stability).not.toHaveProperty('recovery');
});

test('exhausted starts remain present and explicitly unusable, with bounded recovery diagnostics', async () => {
  const result = await fitStableRepresentativeGeometry(representativeFitFixture(2, 8000, 16), { includeLegacy: false, recoverUnconverged: true });
  expect(result.runs).toHaveLength(3);
  expect(result.runs[0]).toMatchObject({ iterations: 128, converged: false });
  expect(result.stability.recovery.exhaustedStarts).toBe(result.runs.filter(run => !run.converged).length);
  expect(result.stability.recovery.exhaustedStarts).toBeGreaterThan(0);
  expect(result.stability.recovery.additionalIterations).toBeLessThanOrEqual(3 * 64);
  expect(result.stability.totalIterations).toBeLessThanOrEqual(3 * 128);
}, 60_000);

test('sparse input needs no recovery and ambiguous recovery options are rejected', async () => {
  expect((await fitStableRepresentativeGeometry([], { recoverUnconverged: true })).stability.recovery).toEqual({
    attemptedStarts: 0, recoveredStarts: 0, exhaustedStarts: 0, additionalIterations: 0,
  });
  await expect(fitStableRepresentativeGeometry([], { recoverUnconverged: 'true' })).rejects.toThrow('recovery_options');
});

test('expanded work is reserved before vectors are read and requires stability', () => {
  const snapshot = { corpus: { texts: { size: 1 }, documents: { length: 25000 } } };
  expect(25000 * 1024 * REPRESENTATIVE_STABILITY_WORK_COMPONENTS).toBeLessThan(80_000_000_000);
  expect(25000 * 1024 * REPRESENTATIVE_RECOVERY_WORK_COMPONENTS).toBeGreaterThan(80_000_000_000);
  expect(() => createInventoryRepresentativeIndex(snapshot, 1024, 1, { stability: true, recovery: true })).toThrow('work_budget');
  expect(() => createInventoryRepresentativeIndex(snapshot, 1024, 1, { recovery: true })).toThrow('work_budget');
  expect(() => createInventoryRepresentativeIndex(snapshot, 1024, 1, { stability: true, recovery: 'true' })).toThrow('work_budget');
});

test('runtime profile recovery uses content-neutral vectors for either current media adapter', async () => {
  const items = representativeFitFixture();
  const snapshot = { libraries: [{ id: 1, media_type: 'movie', name: 'PRIVATE arbitrary name' }],
    vectors: new Map(items.map(item => [item.hash, item.vector])), corpus: {
      texts: new Map(items.map(item => [item.hash, 'PRIVATE unused content'])),
      documents: items.map((item, i) => ({ key: `movie:${i + 1}`, type: 'movie', hash: item.hash, libraryIds: [1] })),
    } };
  const movie = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 4 });
  expect(movie.version).toBe('inventory_representative_profile_v3');
  expect(movie.summary.recoveredStarts).toBeGreaterThan(0);
  expect(movie.summary.unconvergedStarts).toBe(0);
  snapshot.libraries[0] = { id: 1, media_type: 'tv', name: 'Renamed without a category' };
  snapshot.corpus.documents.forEach((row, i) => { row.type = 'tv'; row.key = `tv:${i + 1}`; });
  snapshot.corpus.documents.reverse();
  const tv = await buildInventoryRepresentativeProfile({ snapshot, dimensions: 4 });
  expect(tv.summary).toEqual(movie.summary);
  expect(tv.libraries.get(1).starts).toEqual(movie.libraries.get(1).starts);
  expect(tv.libraries.get(1).stability).toEqual(movie.libraries.get(1).stability);
  expect(JSON.stringify(tv.summary)).not.toMatch(/PRIVATE|hash|libraryId|vector|http/i);
}, 30_000);
