/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { measureGroupQuality, summarizeGroupValues, compareNearestGroups, measureSmallGroupRetention } from '../../services/inventoryGroupQuality.mjs';

const items = Array.from({ length: 6 }, (_, i) => ({ hash: String(i), vector: i < 3 ? [1, 0] : [0, 1] }));
const groups = [0, 1].map(i => ({ centroid: i ? [0, 1] : [1, 0], support: 3,
  hashes: items.slice(i * 3, i * 3 + 3).map(row => row.hash), representatives: items.slice(i * 3, i * 3 + 3).map(row => row.hash) }));

test('reports weighted geometry, support and unassigned counts without leaking members', async () => {
  const quality = await measureGroupQuality(groups, items);
  expect(quality).toMatchObject({ groups: 2, trainingDescriptions: 6, representedDescriptions: 6, unassignedDescriptions: 0,
    support: { threeToNine: 2 }, cohesion: { mean: 1, p10: 1 }, representation: { mean: 1 }, ownGroupMargin: { mean: 1 } });
  expect(JSON.stringify(quality)).not.toMatch(/hashes|centroid|representatives/);
  expect((await measureGroupQuality([], items)).unassignedDescriptions).toBe(6);
  expect((await measureGroupQuality(groups.slice(0, 1), items)).ownGroupMargin.mean).toBeNull();
  expect(summarizeGroupValues([])).toEqual({ count: 0, mean: null, p10: null });
  expect(summarizeGroupValues([0, 1, 0.5])).toEqual({ count: 3, mean: 0.5, p10: 0 });
  await expect(measureGroupQuality(groups, items, AbortSignal.abort())).rejects.toThrow();
});

test('compares same-media groups only, preserves all absent alternatives and never resolves ties', () => {
  const libraries = groups.map((group, i) => ({ id: i + 1, mediaType: 'movie', available: true, groups: [group] }));
  expect(compareNearestGroups(libraries, 'movie', [1, 0], [1])).toEqual({ reason: 'selected', id: 1, agreement: true });
  expect(compareNearestGroups(libraries, 'movie', [1, 0], [2]).agreement).toBe(false);
  expect(compareNearestGroups(libraries, 'movie', [0.5, 0.5], [1]).reason).toBe('ambiguous_groups');
  expect(compareNearestGroups(libraries, 'movie', [-1, -1], [1]).reason).toBe('ambiguous_groups');
  expect(compareNearestGroups(libraries, 'tv', [1, 0], [1]).reason).toBe('insufficient_candidates');
  expect(compareNearestGroups(libraries.map(row => ({ ...row, available: false })), 'movie', [1, 0], [1]).reason).toBe('unavailable_groups');
  expect(compareNearestGroups(libraries.map(row => ({ ...row, groups: [] })), 'movie', [1, 0], [1]).reason).toBe('unavailable_groups');
});

test('separates retained small-group items from intact and enlarged groups', () => {
  expect(measureSmallGroupRetention(groups, groups)).toEqual({ groups: 2, descriptions: 6, retainedDescriptions: 6, intactGroups: 2, enlargedGroups: 0 });
  expect(measureSmallGroupRetention(groups, [{ hashes: items.map(row => row.hash), support: 6 }])).toMatchObject({ retainedDescriptions: 6, intactGroups: 2, enlargedGroups: 2 });
  expect(measureSmallGroupRetention(groups, [])).toMatchObject({ retainedDescriptions: 0, intactGroups: 0 });
  expect(measureSmallGroupRetention([], [])).toMatchObject({ groups: 0, descriptions: 0 });
});
