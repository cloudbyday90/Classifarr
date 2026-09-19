/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { resolveGroupTermEvidence, combineGroupTermEvidence } from '../../services/inventoryGroupTermEvidence.mjs';

const metadata = { genres: ['marine'] };
function fixture() {
  return { model: [1, 2].map(id => ({ id, type: 'movie', group: 0,
    weights: new Map((id === 1 ? ['ocean', 'voyage'] : ['forest', 'wildlife']).map(term => [term, 1 / Math.sqrt(2)])) })),
  evidence: { complete: true, sharedMaximum: -1, candidates: [1, 2].map(id => ({ id,
    items: [0, 1, 2].map(n => ({ group: 0, similarity: 0.8 - n * 0.05,
      vector: [Number(n === 0), Number(n === 1), Number(n === 2)], metadata: { genres: [id === 1 ? 'marine' : 'forest'] } })) })) } };
}
const run = ({ model, evidence } = fixture(), text = 'ocean voyage') => resolveGroupTermEvidence(model, 'movie', text, evidence, metadata);

test('distinct group terms can propose across embedding overlaps, without affecting controls', () => {
  const source = fixture(); expect(run(source)).toEqual({ reason: 'selected', index: 0 });
  source.model.push({ id: 3, type: 'tv', group: 0, weights: new Map() });
  source.evidence.candidates.reverse(); source.model.reverse();
  expect(run(source)).toEqual({ reason: 'selected', index: 1 });
  expect(run(fixture(), 'ocean ocean voyage')).toEqual(run());
  for (const reason of ['selected', 'local_missing_metadata', 'local_unsupported_group', 'sparse_profiles']) {
    const previous = { reason, index: 1 };
    expect(combineGroupTermEvidence(previous, run())).toBe(previous);
  }
  expect(combineGroupTermEvidence({ reason: 'local_overlapping_examples' }, run())).toEqual(run());
});

test.each([
  ['group_incomplete_evidence', s => { s.evidence.complete = false; }],
  ['group_incomplete_evidence', s => { s.evidence.candidates[1].items.pop(); }],
  ['group_incomplete_terms', s => { s.model.pop(); }],
  ['group_incomplete_terms', s => { s.model[1].weights.clear(); }],
  ['group_terms_not_distinct', s => { s.model[1].weights = s.model[0].weights; }],
  ['group_neighbor_mismatch', s => { s.evidence.candidates[0].items[0].group = 1; }],
  ['group_shared_or_nonpositive', s => { s.evidence.sharedMaximum = 0.8; }],
  ['group_shared_or_nonpositive', s => { s.evidence.candidates[0].items[2].similarity = 0; }],
  ['local_correlated_examples', s => { s.evidence.candidates[1].items[0].similarity = 0.99; }],
  ['local_missing_metadata', s => { s.evidence.candidates[0].items[1].metadata = null; }],
  ['local_metadata_not_distinct', s => { s.evidence.candidates[1].items.forEach(row => { row.metadata = metadata; }); }],
])('%s does not guess a destination', (reason, mutate) => {
  const source = fixture(); mutate(source); expect(run(source)).toEqual({ reason });
});

test.each(['ocean', 'unseen query', 'ocean voyage forest wildlife', 'a 42'])('insufficient/tied terms abstain: %s', text => {
  expect(run(fixture(), text)).toEqual({ reason: 'group_terms_not_distinct' });
});
