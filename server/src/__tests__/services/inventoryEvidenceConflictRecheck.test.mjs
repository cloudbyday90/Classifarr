/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { resolveInventoryEvidenceConflict, selectInventoryConflictResult } from '../../services/inventoryEvidenceConflictRecheck.mjs';
import { assessInventoryDescriptionSeparation } from '../../services/inventoryDescriptionSeparation.mjs';

const candidate = (libraryId, similarity, relativeFit) => ({ libraryId, eligible: 30, indexed: 30,
  learnedProfile: { version: 'contrastive_profile_v1', statusId: 'available', relativeFit, trainingDescriptions: 60 },
  items: [1, 2, 3].map(index => ({ description: `Private description ${libraryId}:${index}`, similarity, sharedAcrossCandidates: false })) });
const evidence = () => [candidate(1, .7, -.5), candidate(2, .75, .5), candidate(3, .65, -.2)];

test('content and learned metadata must support the same alternative; weaker recheck does not relax policy scoring', () => {
  const candidates = evidence();
  expect(resolveInventoryEvidenceConflict({ proposedLibraryId: 1, candidates })).toEqual({
    shouldRecheck: true, reason: 'joint_inventory_conflict', alternativeId: 2 });
  expect(assessInventoryDescriptionSeparation(candidates)).toEqual({ eligible: false, reason: 'evidence_ambiguous' });
  expect(resolveInventoryEvidenceConflict({ proposedLibraryId: 2, candidates }).shouldRecheck).toBe(false);
  candidates[0].name = 'Wrong-sounding arbitrary name';
  const result = resolveInventoryEvidenceConflict({ proposedLibraryId: 1, candidates: candidates.reverse(), observedLibraryIds: [3] });
  expect(result.alternativeId).toBe(2);
  expect(JSON.stringify(result)).not.toMatch(/Private|name|observed/);
});

test.each(['missing', 'duplicate_id', 'bad_id', 'partial_index', 'small_training', 'profile_version', 'missing_profile',
  'bad_fit', 'bad_similarity', 'duplicate_description', 'oversize_description', 'missing_items', 'too_many', 'null_candidate'])
('incomplete %s evidence cannot initiate inference', kind => {
  const candidates = evidence();
  if (kind === 'missing') candidates.pop();
  if (kind === 'missing') candidates.pop();
  if (kind === 'duplicate_id') candidates[1].libraryId = 1;
  if (kind === 'bad_id') candidates[1].libraryId = 2147483648;
  if (kind === 'partial_index') candidates[1].indexed--;
  if (kind === 'small_training') candidates[1].learnedProfile.trainingDescriptions = 19;
  if (kind === 'profile_version') candidates[1].learnedProfile.version = 'untrusted';
  if (kind === 'missing_profile') delete candidates[1].learnedProfile;
  if (kind === 'bad_fit') candidates[1].learnedProfile.relativeFit = NaN;
  if (kind === 'bad_similarity') candidates[1].items[0].similarity = Infinity;
  if (kind === 'duplicate_description') candidates[1].items[1].description = ` ${candidates[1].items[0].description.toUpperCase()} `;
  if (kind === 'oversize_description') candidates[1].items[0].description = 'x'.repeat(2001);
  if (kind === 'missing_items') candidates[1].items = [];
  if (kind === 'too_many') candidates.push(...Array(63).fill(candidates[0]));
  if (kind === 'null_candidate') candidates[1] = null;
  expect(resolveInventoryEvidenceConflict({ proposedLibraryId: 1, candidates })).toEqual({ shouldRecheck: false, reason: 'evidence_incomplete' });
});

test.each(['no_proposal', 'foreign_proposal', 'string_id', 'neutral_baseline', 'positive_baseline', 'neutral_alternative',
  'tied_description', 'tied_fit', 'split_support', 'shared', 'unknown_shared', 'weak_mean', 'weak_neighbor', 'thin_margin'])
('ambiguous %s evidence does not request another call', kind => {
  const candidates = evidence();
  let proposedLibraryId = 1;
  if (kind === 'no_proposal') proposedLibraryId = null;
  if (kind === 'foreign_proposal') proposedLibraryId = 9;
  if (kind === 'string_id') proposedLibraryId = '1';
  if (kind === 'neutral_baseline') candidates[0].learnedProfile.statusId = 'neutral';
  if (kind === 'positive_baseline') candidates[0].learnedProfile.relativeFit = .1;
  if (kind === 'neutral_alternative') candidates[1].learnedProfile.relativeFit = 0;
  if (kind === 'tied_description') candidates[0].items.forEach(item => { item.similarity = .75; });
  if (kind === 'tied_fit') candidates[2].learnedProfile.relativeFit = .5;
  if (kind === 'split_support') candidates[2].learnedProfile.relativeFit = .9;
  if (kind === 'shared') candidates[1].items[0].sharedAcrossCandidates = true;
  if (kind === 'unknown_shared') delete candidates[1].items[0].sharedAcrossCandidates;
  if (kind === 'weak_mean') candidates.forEach((entry, index) => entry.items.forEach(item => { item.similarity = index === 1 ? .64 : .5; }));
  if (kind === 'weak_neighbor') candidates[1].items[0].similarity = .59;
  if (kind === 'thin_margin') candidates[0].items.forEach(item => { item.similarity = .74; });
  expect(resolveInventoryEvidenceConflict({ proposedLibraryId, candidates }).shouldRecheck).toBe(false);
});

test('replacement requires one valid proposal agreeing with the predeclared alternative', () => {
  const baseline = { status: 'proposed', destinationId: 1 }, decision = { shouldRecheck: true, alternativeId: 2 };
  const valid = { status: 'proposed', destinationId: 2 };
  expect(selectInventoryConflictResult(baseline, valid, decision)).toBe(valid);
  for (const result of [null, { status: 'abstained' }, { status: 'failed', destinationId: 2 },
    { status: 'proposed', destinationId: 3 }, { status: 'proposed', destinationId: '2' }]) {
    expect(selectInventoryConflictResult(baseline, result, decision)).toBe(baseline);
  }
  expect(selectInventoryConflictResult(baseline, valid, { ...decision, shouldRecheck: false })).toBe(baseline);
  expect(selectInventoryConflictResult(baseline, valid, null)).toBe(baseline);
  const failed = { status: 'failed' };
  expect(selectInventoryConflictResult(failed, valid, decision)).toBe(failed);
  expect(resolveInventoryEvidenceConflict().shouldRecheck).toBe(false);
});
