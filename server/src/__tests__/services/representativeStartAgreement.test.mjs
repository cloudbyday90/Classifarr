/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { inspectRepresentativeStartAgreement } from '../../services/representativeStartAgreement.mjs';
import { inspectRepresentativeCandidates, rankRepresentativeCandidates, compareRepresentativeCandidates } from '../../services/representativeCandidateComparison.mjs';

const inspect = scores => inspectRepresentativeStartAgreement(scores, scores.map(() => 0));
const profiles = scores => scores.map(starts => ({ selectedStart: 0, starts: starts.map(score => ({
  converged: true, groups: [{ support: 3, centroid: [score, Math.sqrt(1 - score * score)] }],
})) }));

test.each([0.8, 0.5, 0.5 + 5e-13])('rejects an unchecked mixed-start reversal or tie %s', rival => {
  const scores = [[0.9, 0.5, 0.6], [rival, 0.4, 0.3]];
  expect(inspect(scores)).toEqual({ aligned: { reason: 'selected', index: 0 }, independent: { reason: 'initialization_sensitive' } });
  expect(inspectRepresentativeCandidates(profiles(scores), [1, 0], 2)).toEqual(inspect(scores));
  expect(rankRepresentativeCandidates(profiles(scores), [1, 0], 2)).toEqual({ reason: 'initialization_sensitive' });
  expect(compareRepresentativeCandidates(profiles(scores), [1, 0], 2, 0)).toBe('initialization_sensitive');
});

test('retains a positive stable winner, handles negative rivals, and never changes the selected index', () => {
  expect(inspect([[0.6, 0.7, 0.8], [0.5, 0.4, -0.3]]).independent).toEqual({ reason: 'selected', index: 0 });
  expect(inspect([[-0.1, -0.2, -0.3], [0.01, 0.1, 0.2]]).independent).toEqual({ reason: 'selected', index: 1 });
  expect(inspect([[-0.1, -0.2, -0.3], [0, -0.1, -0.2]]).independent.reason).toBe('no_positive_match');
  expect(inspect([[0.6, 0.7, 0.8], [0.6, 0.4, 0.3]]).independent.reason).toBe('tied_destinations');
  expect(inspect([[0.6, 0.3, 0.8], [0.5, 0.4, 0.3]]).independent.reason).toBe('initialization_sensitive');
});

function exhaustiveWinner(scores, indices = []) {
  if (indices.length < scores.length) {
    const winners = [0, 1, 2].map(start => exhaustiveWinner(scores, [...indices, start]));
    return winners[0] !== null && winners.every(winner => winner === winners[0]) ? winners[0] : null;
  }
  const ranked = scores.map((starts, index) => ({ index, value: starts[indices[index]] })).sort((a, b) => b.value - a.value);
  return ranked[0].value > 0 && ranked[0].value - ranked[1].value > 1e-12 ? ranked[0].index : null;
}

test('matches an exhaustive Cartesian oracle and ignores independent start numbering across 500 reproducible cases', () => {
  let state = 71;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 2 ** 32; };
  for (let trial = 0; trial < 500; trial++) {
    const scores = Array.from({ length: 2 + trial % 3 }, (_, index) => Array.from({ length: 3 }, () =>
      trial % 2 ? Math.round((random() * 2 - 1) * 10) / 10 : index === 0 ? 0.8 + random() * 0.2 : random() * 0.7));
    const selected = scores.map(() => Math.floor(random() * 3));
    const result = inspectRepresentativeStartAgreement(scores, selected).independent;
    expect(result.reason === 'selected' ? result.index : null).toBe(exhaustiveWinner(scores));
    const reordered = scores.map((starts, index) => [...starts.slice(index % 3), ...starts.slice(0, index % 3)]);
    const remapped = selected.map((start, index) => (start - index % 3 + 3) % 3);
    const permutation = inspectRepresentativeStartAgreement(reordered, remapped).independent;
    expect(permutation.reason === 'selected' ? permutation.index : null).toBe(exhaustiveWinner(scores));
  }
});

test.each([
  [null, []], [[], []], [[[1, 1, 1]], [0]], [Array(65).fill([1, 1, 1]), Array(65).fill(0)],
  [[[1, 1, 1], null], [0, 0]], [[[1, 1], [0, 0, 0]], [0, 0]],
  [[[NaN, 1, 1], [0, 0, 0]], [0, 0]], [[[1.01, 1, 1], [0, 0, 0]], [0, 0]],
  [[[-1.01, 1, 1], [0, 0, 0]], [0, 0]], [[[1, 1, 1], [0, 0, 0]], null],
  [[[1, 1, 1], [0, 0, 0]], [0]], [[[1, 1, 1], [0, 0, 0]], [0, -1]],
  [[[1, 1, 1], [0, 0, 0]], [0, 3]], [[[1, 1, 1], [0, 0, 0]], [0, 0.5]],
])('rejects unbounded or invalid scalar input %#', (scores, selected) => {
  expect(() => inspectRepresentativeStartAgreement(scores, selected)).toThrow();
});
