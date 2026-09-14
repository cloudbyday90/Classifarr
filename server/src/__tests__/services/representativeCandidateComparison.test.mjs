/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { compareRepresentativeCandidates } from '../../services/representativeCandidateComparison.mjs';

function profile(centroid) {
  return { selectedStart: 0, starts: Array.from({ length: 3 }, () => ({
    converged: true, groups: [{ support: 3, centroid: [...centroid] }],
  })) };
}
function fixture() { return [profile([1, 0]), profile([0, 1])]; }
const compare = (profiles, vector = [1, 0], index = 0, dimensions = 2) =>
  compareRepresentativeCandidates(profiles, vector, dimensions, index);

test('compares geometry without content labels or mutation and remaps candidate order', () => {
  const profiles = fixture();
  profiles[0].name = 'Misleading label'; profiles[1].mediaType = 'unrelated';
  const before = structuredClone(profiles);
  expect(compare(profiles)).toBe('agrees');
  expect(compare(profiles, [1, 0], 1)).toBe('disagrees');
  expect(compare([...profiles].reverse(), [1, 0], 1)).toBe('agrees');
  expect(profiles).toEqual(before);
});

test.each([null, [], [profile([1, 0])], Array(65).fill(profile([1, 0])), [null, profile([1, 0])]])(
  'rejects invalid candidate scope %#', profiles => expect(compare(profiles)).toBe('invalid_input'));
test.each([-1, 2, 0.5, null, undefined, NaN])('rejects invalid destination index %s', index => {
  expect(compareRepresentativeCandidates(fixture(), [1, 0], 2, index)).toBe('invalid_input');
});
test.each([
  profiles => { profiles[0].starts = null; },
  profiles => { profiles[0].starts.pop(); },
  profiles => { profiles[0].selectedStart = -1; },
  profiles => { profiles[0].selectedStart = 3; },
  profiles => { profiles[0].selectedStart = 0.5; },
  profiles => { profiles[0].starts[2] = null; },
  profiles => { profiles[0].starts[2].converged = 'true'; },
  profiles => { profiles[0].starts[0].groups = null; },
  profiles => { profiles[0].starts[0].groups = Array(9).fill({ support: 3, centroid: [1, 0] }); },
  profiles => { profiles[0].starts[0].groups[0] = null; },
  profiles => { profiles[0].starts[0].groups[0].support = -1; },
  profiles => { profiles[0].starts[0].groups[0].support = 3.5; },
  profiles => { profiles[0].starts[2].groups[0].centroid = [NaN, 1]; },
])('rejects malformed profiles, including later unused views %#', mutate => {
  const profiles = fixture(); mutate(profiles);
  expect(compare(profiles)).toBe('invalid_input');
});
test.each([[NaN, 1], [Infinity, 1], [0, 0], [1], null])('rejects invalid query %#', vector => {
  expect(compare(fixture(), vector)).toBe('invalid_input');
});
test('rejects a representation dimension mismatch', () => {
  expect(compare(fixture(), [1, 0], 0, 3)).toBe('invalid_input');
});
test('never discards an unfinished or sparsely supported alternative', () => {
  const profiles = fixture(); profiles[1].starts[2].converged = false;
  expect(compare(profiles)).toBe('unconverged_profiles');
  profiles[1].starts[2].converged = true;
  for (const support of [0, 1, 2]) {
    profiles[1].starts[2].groups[0].support = support;
    expect(compare(profiles)).toBe('sparse_profiles');
  }
  profiles[1].starts[2].groups = [];
  expect(compare(profiles)).toBe('sparse_profiles');
});
test('separates lack of positive similarity from a positive tied destination', () => {
  expect(compare([profile([-1, 0]), profile([0, -1])])).toBe('no_positive_match');
  expect(compare([profile([1, 0]), profile([1, 0])])).toBe('tied_destinations');
  expect(compare([profile([1, 0]), profile([1, 0.0000001])])).toBe('tied_destinations');
});
test('distinguishes initializations from nonconvergence and checks selected mixed view', () => {
  const profiles = fixture();
  profiles[0].starts[1].groups[0].centroid = [0, 1];
  profiles[1].starts[1].groups[0].centroid = [1, 0];
  expect(compare(profiles)).toBe('initialization_sensitive');
  const mixed = [profile([0.8, 0.6]), profile([0.6, 0.8])];
  mixed[0].starts[1].groups[0].centroid = [0.6, 0.8];
  mixed[1].starts[1].groups[0].centroid = [0, 1];
  mixed[0].selectedStart = 1;
  expect(compare(mixed)).toBe('tied_destinations');
});
test('validates all centroids before early diagnostic exits', () => {
  const profiles = [profile([-1, 0]), profile([0, -1])];
  profiles[1].starts[2].groups[0].centroid = [NaN, 1];
  expect(compare(profiles)).toBe('invalid_input');
  profiles[0].starts[0].converged = false;
  expect(compare(profiles)).toBe('invalid_input');
});
