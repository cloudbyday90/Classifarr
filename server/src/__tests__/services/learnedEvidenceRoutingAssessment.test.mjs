/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { assessLearnedEvidenceRouting } from '../../services/learnedEvidenceRoutingAssessment.mjs';
import { learnedRoutingFixture } from '../fixtures/learnedEvidenceRoutingFixture.mjs';

test('fresh full-pool agreement and familiar baseline qualify without trusting generated confidence', () => {
  const input = learnedRoutingFixture(); input.aiMatch.confidence = 0;
  expect(assessLearnedEvidenceRouting(input)).toBe(true);
});

test.each([
  ['absent', () => undefined], ['unusual', b => ({ ...b, status: 'unusual' })],
  ['sparse', b => ({ ...b, status: 'sparse' })], ['degenerate', b => ({ ...b, status: 'degenerate' })],
  ['incomplete', b => ({ ...b, status: 'incomplete' })], ['wrong library', b => ({ ...b, libraryId: 1 })],
  ['wrong version', b => ({ ...b, version: 'unknown' })], ['no fingerprint', b => ({ ...b, snapshotId: '' })],
  ['tail', b => ({ ...b, empiricalRank: .05 })], ['invalid rank', b => ({ ...b, empiricalRank: NaN })],
  ['over-limit rank', b => ({ ...b, empiricalRank: 1.01 })], ['few references', b => ({ ...b, referenceDescriptions: 19 })],
  ['over-limit references', b => ({ ...b, referenceDescriptions: 257 })], ['few calibration', b => ({ ...b, calibrationDescriptions: 19 })],
  ['over-limit calibration', b => ({ ...b, calibrationDescriptions: 129 })],
])('rejects %s baseline', (_name, change) => {
  const input = learnedRoutingFixture(), selected = input.reviewEvidence.candidates[1];
  selected.matchBaseline = change(selected.matchBaseline);
  expect(assessLearnedEvidenceRouting(input)).toBe(false);
});

test.each([
  ['missing evidence', i => { i.evidence = null; }],
  ['partial shortlist evidence', i => { i.evidence.candidates.pop(); }],
  ['duplicated evidence', i => { i.evidence.candidates[1] = i.evidence.candidates[0]; }],
  ['foreign evidence', i => { i.evidence.candidates[0].libraryId = 9; }],
  ['wrong media', i => { i.evidence.candidates[0].mediaType = 'tv'; }],
  ['exact competing identity', i => { i.evidence.candidates[0].currentLibrary.directMatch = true; }],
  ['exact full-pool identity', i => { i.reviewEvidence.candidates[0].queryIdentityPresent = true; }],
  ['unknown full-pool identity', i => { delete i.reviewEvidence.candidates[0].queryIdentityPresent; }],
  ['changed description', i => { i.evidence.candidates[0].descriptionEvidence.items[0].description += '!'; }],
  ['learned disagreement', i => { i.reviewEvidence.candidates[0].learnedProfile.relativeFit = 2; }],
])('rejects %s', (_name, mutate) => {
  const input = learnedRoutingFixture(); mutate(input);
  expect(assessLearnedEvidenceRouting(input)).toBe(false);
});
