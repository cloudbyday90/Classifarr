/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { resolveCandidateLocalEvidence, combineCandidateLocalEvidence } from '../../services/inventoryCandidateLocalEvidence.mjs';

const meta = genres => ({ genres, studio: 'shared studio' });
function fixture() {
  return { complete: true, sharedMaximum: -1, candidates: [1, 2].map(id => ({ id,
    items: [0, 1, 2].map(index => ({ group: 0, similarity: (id === 1 ? 0.9 : 0.5) - index * 0.05,
      vector: [Number(index === 0), Number(index === 1), Number(index === 2)],
      metadata: meta([id === 1 ? 'observed-a' : 'observed-b']) })) })) };
}
const run = (evidence = fixture(), metadata = meta(['observed-a'])) => resolveCandidateLocalEvidence(evidence, metadata);

test('requires repeated description support and separate metadata dominance; order and names cannot grant authority', () => {
  const evidence = fixture(), before = structuredClone(evidence);
  expect(run(evidence)).toEqual({ reason: 'selected', index: 0 });
  evidence.candidates.reverse();
  evidence.candidates.forEach(row => { row.name = 'ignored name'; });
  expect(run(evidence)).toEqual({ reason: 'selected', index: 1 });
  expect(run(before, { genres: ['observed-a'] })).toEqual({ reason: 'selected', index: 0 });
  before.candidates[1].items.forEach(item => { item.metadata.studio = 'other'; });
  expect(run(before, { studio: 'shared studio' })).toEqual({ reason: 'selected', index: 0 });
});

test.each([
  ['local_incomplete_evidence', e => { e.complete = false; }],
  ['local_incomplete_evidence', e => { e.candidates[1].items.pop(); }],
  ['local_no_positive_match', e => { e.candidates.forEach(row => row.items.forEach(item => { item.similarity = -0.1; })); }],
  ['local_overlapping_examples', e => { e.candidates[1].items[0].similarity = 0.8; }],
  ['local_overlapping_examples', e => { e.sharedMaximum = 0.8; }],
  ['local_unsupported_group', e => { e.candidates[0].items[0].group = null; }],
  ['local_unsupported_group', e => { e.candidates[0].items[2].group = 1; }],
  ['local_correlated_examples', e => { e.candidates[0].items[0].similarity = 0.98; }],
  ['local_correlated_examples', e => { e.candidates[0].items[1].vector = e.candidates[0].items[0].vector; }],
  ['local_missing_metadata', e => { e.candidates[1].items[0].metadata = null; }],
  ['local_missing_metadata', e => { e.candidates[1].items[0].metadata.genres = []; }],
  ['local_missing_metadata', e => { e.candidates[1].items[0].metadata.studio = ''; }],
  ['local_metadata_not_distinct', e => { e.candidates[1].items.forEach(item => { item.metadata = meta(['observed-a']); }); }],
  ['local_metadata_not_distinct', e => { e.candidates[0].items.forEach(item => { item.metadata.studio = 'contradiction'; }); }],
])('%s retains a concrete abstention reason', (reason, mutate) => {
  const evidence = fixture(); mutate(evidence); expect(run(evidence)).toEqual({ reason });
});

test.each([null, {}, { rating: 'same audience' }])('missing purpose metadata never becomes negative evidence: %j', metadata => {
  expect(run(fixture(), metadata)).toEqual({ reason: 'local_missing_metadata' });
});

test('stable destinations and hard failures cannot be replaced by a local proposal', () => {
  const proposal = { reason: 'selected', index: 1 };
  for (const reason of ['selected', 'invalid_input', 'sparse_profiles', 'incomplete_profiles', 'unconverged_profiles', 'no_positive_match']) {
    const baseline = { reason, index: 0 };
    expect(combineCandidateLocalEvidence(baseline, proposal)).toBe(baseline);
  }
  for (const reason of ['initialization_sensitive', 'tied_destinations']) {
    expect(combineCandidateLocalEvidence({ reason }, proposal)).toBe(proposal);
    expect(combineCandidateLocalEvidence({ reason }, { reason: 'local_missing_metadata' })).toEqual({ reason: 'local_missing_metadata' });
  }
});
