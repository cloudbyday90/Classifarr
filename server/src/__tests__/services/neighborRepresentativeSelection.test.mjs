/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { selectRepresentativeNeighborGroups } from '../../services/neighborRepresentativeSelection.mjs';
import { calibrationHash } from '../fixtures/inventoryMatchCalibrationFixture.mjs';

function fixture(size) {
  const hashes = Array.from({ length: size }, (_, i) => calibrationHash(i));
  const vectors = new Map(hashes.map((hash, i) => [hash, [Math.cos(i / 20), Math.sin(i / 20)]]));
  return { hashes, vectors, splits: [{ libraryId: 1, calibration: hashes.slice(0, 32), references: hashes.slice(32) }] };
}

test.each([0, 20, 21, 32, 64, 65])('small libraries retain exactly the ordered %i groups without fitting', async size => {
  const { hashes, vectors, splits } = fixture(size);
  const result = await selectRepresentativeNeighborGroups(splits, vectors, 2, { consumeWork: () => { throw new Error('unexpected fit'); } });
  expect(result[0].references.map(row => row.hash)).toEqual(hashes);
  expect(result[0]).toMatchObject({ selectionStatus: 'unchanged_small', selectionPool: size });
});

test('preserves calibration queries and learns selection only from the bounded non-calibration pool', async () => {
  const { hashes, vectors, splits } = fixture(320), work = [];
  const first = await selectRepresentativeNeighborGroups(splits, vectors, 2, { consumeWork: count => work.push(count) });
  expect(first[0]).toMatchObject({ selectionStatus: 'representative', selectionPool: 256 });
  const selected = first[0].references.map(row => row.hash);
  expect(selected).toHaveLength(65); expect(new Set(selected).size).toBe(65);
  expect(selected.slice(0, 32)).toEqual(hashes.slice(0, 32));
  expect(selected.every(hash => hashes.slice(0, 256).includes(hash))).toBe(true);
  expect(selected).not.toEqual(hashes.slice(0, 65));
  expect(work).toEqual([224 * 2 * 140]);
  for (const hash of [...hashes.slice(0, 32), ...hashes.slice(256)]) vectors.set(hash, [0, 1]);
  expect((await selectRepresentativeNeighborGroups(splits, vectors, 2))[0].references.map(row => row.hash)).toEqual(selected);
});

test('cancellation and rejected work reservations prevent incomplete selection from escaping', async () => {
  const { vectors, splits } = fixture(256);
  await expect(selectRepresentativeNeighborGroups(splits, vectors, 2, { consumeWork: () => { throw new Error('budget'); } })).rejects.toThrow('budget');
  const controller = new AbortController(), pending = selectRepresentativeNeighborGroups(splits, vectors, 2, { signal: controller.signal });
  controller.abort(); await expect(pending).rejects.toThrow();
  await expect(selectRepresentativeNeighborGroups(splits, vectors, 2, { signal: controller.signal })).rejects.toThrow();
});
