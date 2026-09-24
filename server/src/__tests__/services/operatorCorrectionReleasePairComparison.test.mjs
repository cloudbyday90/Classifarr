/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { BASELINE_COMMIT } from '../../scripts/pinnedReleaseSchema.mjs';
import { compareOperatorCorrectionReleasePair,
  fingerprintOperatorCorrectionPairCohort } from '../../services/operatorCorrectionReleasePairComparison.mjs';
import { runOperatorCorrectionReleasePairComparison } from '../../../../scripts/compare-operator-correction-release-pair.mjs';

const candidateCommit = 'c'.repeat(40);
const input = 'a'.repeat(64);
const rows = [
  { token: '1'.repeat(32), mediaType: 'movie', labelLibraryId: 1,
    statusId: 'destination', destinationLibraryId: 2 },
  { token: '2'.repeat(32), mediaType: 'movie', labelLibraryId: 1,
    statusId: 'destination', destinationLibraryId: 1 },
  { token: '3'.repeat(32), mediaType: 'tv', labelLibraryId: 3,
    statusId: 'safety_blocked', destinationLibraryId: null },
];
const bundle = (role, cases = rows) => {
  const privateCases = structuredClone(cases);
  return { version: 1, role, commit: role === 'baseline' ? BASELINE_COMMIT : candidateCommit,
    frozenInputFingerprint: input, cohortFingerprint: fingerprintOperatorCorrectionPairCohort(privateCases),
    cases: privateCases };
};

test('compares only paired destinations, with abstentions and safety blocks separate', () => {
  const current = structuredClone(rows);
  current[0].destinationLibraryId = 1;
  current[1].destinationLibraryId = 2;
  current[2].statusId = 'abstained';
  const report = compareOperatorCorrectionReleasePair({ baseline: bundle('baseline'),
    candidate: bundle('candidate', current), candidateCommit });
  expect(report).toMatchObject({ status: 'structurally_comparable', sampled: 3,
    releaseCodeExecutionVerified: false, policyAndTrainingProvenanceVerified: false,
    fullPipelineAccuracy: null, promotionAllowed: false });
  expect(report.media.movie).toMatchObject({ sampled: 2, pairedDestinations: 2,
    baselineMatches: 1, candidateMatches: 1, gains: 1, regressions: 1, changedDestinations: 2 });
  expect(report.media.tv).toMatchObject({ sampled: 1, pairedDestinations: 0,
    baselineSafetyBlocks: 1, candidateAbstentions: 1 });
  expect(JSON.stringify(report)).not.toMatch(/token|labelLibraryId|destinationLibraryId|111111/);
});

test.each(['wrong_tag', 'wrong_commit', 'changed_input', 'changed_label', 'missing_case',
  'duplicate_token', 'raw_title', 'invalid_disposition', 'corrupt_fingerprint'])(
  'refuses %s instead of silently pairing different observations', kind => {
    const baseline = bundle('baseline'), candidate = bundle('candidate');
    if (kind === 'wrong_tag') baseline.commit = 'b'.repeat(40);
    if (kind === 'wrong_commit') candidate.commit = 'd'.repeat(40);
    if (kind === 'changed_input') candidate.frozenInputFingerprint = 'b'.repeat(64);
    if (kind === 'changed_label') { candidate.cases[0].labelLibraryId = 2;
      candidate.cohortFingerprint = fingerprintOperatorCorrectionPairCohort(candidate.cases); }
    if (kind === 'missing_case') { candidate.cases.pop();
      candidate.cohortFingerprint = fingerprintOperatorCorrectionPairCohort(candidate.cases); }
    if (kind === 'duplicate_token') { candidate.cases[1].token = candidate.cases[0].token;
      candidate.cohortFingerprint = fingerprintOperatorCorrectionPairCohort(candidate.cases); }
    if (kind === 'raw_title') candidate.cases[0].title = 'Private item';
    if (kind === 'invalid_disposition') candidate.cases[0].statusId = 'auto_route';
    if (kind === 'corrupt_fingerprint') candidate.cohortFingerprint = 'f'.repeat(64);
    expect(() => compareOperatorCorrectionReleasePair({ baseline, candidate, candidateCommit })).toThrow();
  });

test('CLI requires both bounded inputs and checks the pinned release before reading them', async () => {
  const baseline = bundle('baseline'), candidate = bundle('candidate');
  const loadJson = jest.fn(async name => name === '.tmp/baseline.json' ? baseline : candidate);
  const verifyBaseline = jest.fn();
  const verifyCleanCheckout = jest.fn();
  const args = { argv: ['--baseline-file', '.tmp/baseline.json', '--candidate-file', '.tmp/candidate.json'],
    loadJson, verifyBaseline, verifyCleanCheckout, currentCommit: () => candidateCommit };
  await expect(runOperatorCorrectionReleasePairComparison({ ...args, argv: ['--baseline-file', '.tmp/baseline.json'] }))
    .rejects.toThrow('files_required');
  expect(loadJson).not.toHaveBeenCalled();
  verifyBaseline.mockImplementationOnce(() => { throw new Error('tag_moved'); });
  await expect(runOperatorCorrectionReleasePairComparison(args)).rejects.toThrow('tag_moved');
  expect(loadJson).not.toHaveBeenCalled();
  expect(verifyCleanCheckout).not.toHaveBeenCalled();
  expect((await runOperatorCorrectionReleasePairComparison(args)).sampled).toBe(3);
  expect(loadJson).toHaveBeenCalledTimes(2);
});
