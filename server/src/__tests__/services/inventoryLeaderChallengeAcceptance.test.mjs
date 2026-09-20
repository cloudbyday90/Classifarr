/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { assessLeaderChallengeAcceptance, applyLeaderChallengeAcceptance } from '../../services/inventoryLeaderChallengeAcceptance.mjs';
import { summarizeLeaderChallenges } from '../../services/inventoryLeaderChallengeReport.mjs';

function fixture() {
  const assessment = { statusId: 'challenger', policyLeaderId: 1, challengerId: 2, poolSize: 3, candidateOrder: [2, 1, 3] };
  const calibration = {
    match: { version: 'library_match_baseline_v1', snapshotId: 'a'.repeat(64), candidates: [1, 2, 3].map(libraryId => ({
      libraryId, status: 'familiar', empiricalRank: .7, referenceDescriptions: 80, calibrationDescriptions: 30 })) },
    neighbor: { version: 'library_neighbor_cross_fit_v1', snapshotId: 'b'.repeat(64), status: 'evaluated',
      candidates: [1, 2, 3].map(libraryId => ({ libraryId, status: 'available', referenceComplete: true,
        referenceDescriptions: 64, calibrationDescriptions: 32, minimumCalibrationReferences: 64, calibrated: libraryId === 2 })) },
  };
  return { assessment, calibration };
}

test('a familiar challenger needs calibrated distinction; incumbent familiarity is not an arbitrary probability contest', () => {
  const { assessment, calibration } = fixture(), before = structuredClone({ assessment, calibration });
  expect(assessLeaderChallengeAcceptance(assessment, calibration)).toEqual({ reason: 'accepted', accepted: true,
    incumbent: 'familiar', challenger: 'familiar' });
  calibration.match.candidates[0].empiricalRank = .99;
  expect(assessLeaderChallengeAcceptance(assessment, calibration).accepted).toBe(true);
  calibration.match.candidates[0].empiricalRank = .7;
  expect({ assessment, calibration }).toEqual(before);
  calibration.match.candidates.reverse(); calibration.neighbor.candidates.reverse();
  expect(assessLeaderChallengeAcceptance(assessment, calibration).accepted).toBe(true);
});

test.each(['sparse', 'degenerate', 'unknown', 'NaN', 'rank', 'contradiction', 'references', 'calibration'])('incumbent %s cannot authorize a challenge', kind => {
  const { assessment, calibration } = fixture(), value = calibration.match.candidates[0];
  if (['sparse', 'degenerate', 'unknown'].includes(kind)) value.status = kind;
  if (kind === 'NaN') value.empiricalRank = NaN;
  if (kind === 'rank') value.empiricalRank = 1.1;
  if (kind === 'contradiction') value.empiricalRank = .01;
  if (kind === 'references') value.referenceDescriptions = 19;
  if (kind === 'calibration') value.calibrationDescriptions = 1000;
  expect(assessLeaderChallengeAcceptance(assessment, calibration).reason).toBe('incumbent_unassessable');
});

test('challenger must be assessable and familiar; an unusual incumbent is assessed without being required', () => {
  const { assessment, calibration } = fixture();
  calibration.match.candidates[1].status = 'sparse';
  expect(assessLeaderChallengeAcceptance(assessment, calibration).reason).toBe('challenger_unassessable');
  Object.assign(calibration.match.candidates[1], { status: 'unusual', empiricalRank: .01 });
  expect(assessLeaderChallengeAcceptance(assessment, calibration).reason).toBe('challenger_unfamiliar');
  Object.assign(calibration.match.candidates[1], { status: 'familiar', empiricalRank: .7 });
  Object.assign(calibration.match.candidates[0], { status: 'unusual', empiricalRank: .01 });
  expect(assessLeaderChallengeAcceptance(assessment, calibration).accepted).toBe(true);
});

test.each(['none', 'wrong', 'multiple', 'sparse', 'incomplete', 'references', 'calibration', 'minimum', 'boolean'])('neighbor %s does not establish distinction', kind => {
  const { assessment, calibration } = fixture(), values = calibration.neighbor.candidates;
  if (kind === 'none') values[1].calibrated = false;
  if (kind === 'wrong') { values[1].calibrated = false; values[0].calibrated = true; }
  if (kind === 'multiple') values[0].calibrated = true;
  if (kind === 'sparse') values[0].status = 'sparse';
  if (kind === 'incomplete') values[0].referenceComplete = false;
  if (kind === 'references') values[0].referenceDescriptions = 65;
  if (kind === 'calibration') values[0].calibrationDescriptions = 19;
  if (kind === 'minimum') values[0].minimumCalibrationReferences = 19;
  if (kind === 'boolean') values[0].calibrated = 'false';
  expect(assessLeaderChallengeAcceptance(assessment, calibration).reason)
    .toBe(['none', 'wrong', 'multiple'].includes(kind) ? 'not_distinguished' : 'neighbor_unavailable');
});

test.each(['missing', 'match_version', 'neighbor_version', 'match_hash', 'neighbor_hash', 'status', 'shape', 'size', 'duplicate', 'foreign', 'null', 'pool', 'same', 'absent', 'oversized'])('rejects %s evidence', kind => {
  const { assessment, calibration } = fixture();
  if (kind === 'missing') { expect(assessLeaderChallengeAcceptance(assessment).accepted).toBe(false); return; }
  if (kind === 'match_version') calibration.match.version = 'future';
  if (kind === 'neighbor_version') calibration.neighbor.version = 'future';
  if (kind === 'match_hash') calibration.match.snapshotId = 'private';
  if (kind === 'neighbor_hash') calibration.neighbor.snapshotId = null;
  if (kind === 'status') calibration.neighbor.status = 'private';
  if (kind === 'shape') calibration.match.candidates = null;
  if (kind === 'size') calibration.neighbor.candidates.pop();
  if (kind === 'duplicate') calibration.match.candidates[0].libraryId = 2;
  if (kind === 'foreign') calibration.neighbor.candidates[0].libraryId = 999;
  if (kind === 'null') calibration.match.candidates[0] = null;
  if (kind === 'pool') assessment.candidateOrder = [2, 1, 1];
  if (kind === 'same') assessment.challengerId = 1;
  if (kind === 'absent') assessment.challengerId = 999;
  if (kind === 'oversized') assessment.candidateOrder = Array.from({ length: 65 }, (_, index) => index + 1);
  const result = assessLeaderChallengeAcceptance(assessment, calibration);
  expect(result.accepted).toBe(false); expect(JSON.stringify(result)).not.toContain('private');
});

test('withholding restores policy ordering and reports paired outcomes without identity or rank leakage', () => {
  const { assessment, calibration } = fixture(); calibration.neighbor.candidates[1].calibrated = false;
  const accepted = applyLeaderChallengeAcceptance(assessment, calibration);
  expect(accepted).toMatchObject({ statusId: 'acceptance_withheld', challengerId: null, candidateOrder: [1, 2, 3] });
  const report = summarizeLeaderChallenges([{ assessment: accepted, observed: [1] }]);
  expect(report).toMatchObject({ challenged: 0, baselinePlacementAgreements: 1, challengedPlacementAgreements: 1,
    acceptance: { reasons: { not_distinguished: 1 }, candidatePairs: { 'familiar:familiar': 1 } } });
  expect(JSON.stringify(report)).not.toMatch(/candidateOrder|libraryId|empiricalRank/);
  expect(applyLeaderChallengeAcceptance({ ...assessment, statusId: 'supports_policy', challengerId: null }))
    .toMatchObject({ statusId: 'supports_policy', acceptance: { reason: 'not_nominated' } });
});

test('calibration never lifts a policy review veto, including when it accepts the hypothetical nomination', () => {
  const { assessment, calibration } = fixture();
  const vetoed = { ...assessment, statusId: 'review_veto', challengerId: null, candidateOrder: [1, 2, 3],
    blockedContent: { statusId: 'challenger', challengerId: 2 }, reviewReason: 'weak_evidence_primary' };
  const accepted = applyLeaderChallengeAcceptance(vetoed, calibration);
  expect(accepted).toMatchObject({ statusId: 'review_veto', challengerId: null, candidateOrder: [1, 2, 3], acceptance: { accepted: true } });
  expect(summarizeLeaderChallenges([{ assessment: accepted, observed: [2] }])).toMatchObject({ challenged: 0,
    vetoDiagnostics: { hypotheticalChallenges: 1, hypotheticalGained: 1, applied: 0 } });
  const withheld = applyLeaderChallengeAcceptance(vetoed);
  expect(withheld).toMatchObject({ statusId: 'review_veto', challengerId: null, candidateOrder: [1, 2, 3],
    blockedContent: { statusId: 'acceptance_withheld', challengerId: null } });
});

test('cross-fitted familiarity needs explicit admission, exact reference counts and its own version', () => {
  const { assessment, calibration } = fixture();
  expect(assessLeaderChallengeAcceptance(assessment, calibration, { crossFit: true }).reason).toBe('calibration_unavailable');
  calibration.match.version = 'library_match_cross_fit_v1';
  for (const candidate of calibration.match.candidates) Object.assign(candidate, {
    referenceDescriptions: 23, calibrationDescriptions: 24, minimumCalibrationReferences: 23 });
  expect(assessLeaderChallengeAcceptance(assessment, calibration).reason).toBe('calibration_unavailable');
  expect(applyLeaderChallengeAcceptance(assessment, calibration, { crossFit: true }).acceptance.accepted).toBe(true);
  delete calibration.match.candidates[0].minimumCalibrationReferences;
  expect(assessLeaderChallengeAcceptance(assessment, calibration, { crossFit: true }).reason).toBe('incumbent_unassessable');
  calibration.match.candidates[0].minimumCalibrationReferences = 23;
  calibration.match.candidates[1].calibrationDescriptions = 20;
  expect(assessLeaderChallengeAcceptance(assessment, calibration, { crossFit: true }).reason).toBe('challenger_unassessable');
  expect(() => assessLeaderChallengeAcceptance(assessment, calibration, { crossFit: 'true' })).toThrow('mode_invalid');
});
