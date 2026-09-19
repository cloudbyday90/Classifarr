/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { retrieveMultiScaleContext } from '../../services/inventoryMultiScaleRetrieval.mjs';

const hash = value => value.toString(16).padStart(64, '0');
test('caps context at nine, preserves raw matches and never admits an unrelated local group', async () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ hash: hash(i), id: 1, type: 'movie',
    vector: i < 3 ? [1, 0] : [0.8, 0.6] }));
  const group = (members, reps, centroid = [1, 0]) => ({ hashes: members.map(hash), representatives: reps.map(hash), centroid, support: members.length });
  const libraries = [{ id: 1, mediaType: 'movie', available: true,
    groups: [group([0, 1, 2, 6, 7, 8], [6, 7, 8]), group([9, 10, 11], [9, 10, 11], [0, 1])],
    localGroups: [group([0, 3, 4, 5], [3, 4, 5]), group([9, 10, 11], [9, 10, 11]), group([1, 6, 7], [1, 6, 7], [0, 1])] },
  { id: 2, mediaType: 'movie', available: false, groups: [], localGroups: [] }];
  const state = { items, libraries, held: new Set([hash(99)]), dimensions: 2, localMembership: new Set(), localStatus: 'available' };
  const result = await retrieveMultiScaleContext(state, { hash: hash(99), type: 'movie', vector: [1, 0] });
  expect(result.candidates[0].raw.map(row => row.hash)).toEqual([0, 1, 2].map(hash));
  expect(result.candidates[0].evidence.map(row => row.hash)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(hash));
  expect(result.candidates[0].evidence).toHaveLength(9);
  expect(result.candidates[1].evidence).toEqual([]);
  expect(result.baseline.reason).toBe('unavailable_groups');
  const empty = await retrieveMultiScaleContext({ ...state, items: [], libraries: [] }, { hash: hash(99), type: 'tv', vector: [1, 0] });
  expect(empty).toMatchObject({ candidates: [], shared: [], nearestGrouped: false, baseline: { reason: 'insufficient_candidates' } });
});
