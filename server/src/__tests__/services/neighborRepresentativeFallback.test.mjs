/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import * as geometry from '../../services/inventoryRepresentativeGeometry.mjs';
const fit = jest.fn().mockResolvedValue({ converged: false, groups: [{ representatives: ['must-not-use'] }] });
jest.unstable_mockModule('../../services/inventoryRepresentativeGeometry.mjs', () => ({ ...geometry, fitRepresentativeGeometry: fit }));
const { selectRepresentativeNeighborGroups } = await import('../../services/neighborRepresentativeSelection.mjs');

test('unconverged geometry explicitly falls back to the exact ordered control', async () => {
  const hashes = Array.from({ length: 100 }, (_, i) => String(i)), vectors = new Map(hashes.map(hash => [hash, [1, 0]]));
  const result = await selectRepresentativeNeighborGroups([{ libraryId: 1, calibration: hashes.slice(0, 32), references: hashes.slice(32) }], vectors, 2);
  expect(result[0].selectionStatus).toBe('ordered_fallback');
  expect(result[0].references.map(row => row.hash)).toEqual(hashes.slice(0, 65));
  expect(fit.mock.calls[0][0].map(row => row.hash)).toEqual(hashes.slice(32));
});
