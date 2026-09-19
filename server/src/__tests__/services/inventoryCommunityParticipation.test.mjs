/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { discoverCommunityParticipation, communityEvidenceDecision } from '../../services/inventoryCommunityParticipation.mjs';

const hash = value => value.toString(16).padStart(64, '0');
test('discovers before inspecting participation, counts shared descriptions once and preserves every library', async () => {
  const scope = new Map([[1, 'movie'], [2, 'movie'], [3, 'movie'], [4, 'tv']]);
  const groups = new Map(Array.from({ length: 10 }, (_, i) => [hash(i), { type: 'movie', hash: hash(i),
    libraries: new Set(i === 9 ? [1, 2] : [i < 4 ? 1 : i < 8 ? 2 : 3]) }]));
  const vectors = new Map([...groups.keys()].map(key => [key, [1, 0]]));
  const result = await discoverCommunityParticipation({ scope, groups }, vectors, 2);
  expect(result.libraries.map(row => row.available)).toEqual([true, true, false, false]);
  expect(result.media.get('movie')).toMatchObject({ sharedDescriptions: 1, sharedAssigned: 1 });
  expect(result.media.get('movie').fitted.groups).toHaveLength(1);
  expect(result.media.get('movie').projected.size).toBe(8);
  expect(result.libraries[0].groups[0].centroid).toEqual(result.libraries[1].groups[0].centroid);
  expect(result.media.get('tv').rows).toEqual([]);
});

test('evidence guards expose ambiguity, shared, unassigned and unsupported nearest items', () => {
  const selected = { reason: 'selected', id: 1, agreement: true }, unavailable = { reason: 'unavailable_groups' };
  const row = { hash: hash(1), vector: [1, 0], libraries: new Set([1]) };
  const media = { rows: [row], assigned: new Set([row.hash]), projected: new Set([row.hash]) };
  expect(communityEvidenceDecision(media, [1, 0], selected)).toEqual(selected);
  expect(communityEvidenceDecision(media, [1, 0], unavailable)).toEqual(unavailable);
  for (const rows of [[], [row, { ...row, hash: hash(2) }], [{ ...row, vector: [-1, 0] }]]) {
    expect(communityEvidenceDecision({ ...media, rows }, [1, 0], selected).reason).toBe('ambiguous_nearest');
  }
  expect(communityEvidenceDecision({ ...media, rows: [{ ...row, libraries: new Set([1, 2]) }] }, [1, 0], selected).reason).toBe('shared_nearest');
  expect(communityEvidenceDecision({ ...media, assigned: new Set() }, [1, 0], selected).reason).toBe('unassigned_nearest');
  expect(communityEvidenceDecision({ ...media, projected: new Set() }, [1, 0], selected).reason).toBe('unsupported_participation');
  expect(communityEvidenceDecision({ ...media, rows: [{ ...row, vector: [0.9, 0] }, row] }, [1, 0], selected)).toEqual(selected);
  const close = [1 - 1.5e-12, 1 - 0.8e-12, 1].map(value => ({ ...row, vector: [value, 0] }));
  for (const rows of [close, [...close].reverse()]) {
    expect(communityEvidenceDecision({ ...media, rows }, [1, 0], selected).reason).toBe('ambiguous_nearest');
  }
});
