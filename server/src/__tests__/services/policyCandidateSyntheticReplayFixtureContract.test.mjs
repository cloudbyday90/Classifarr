/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_CORPUS_VERSION,
  POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS,
  validatePolicyCandidateSyntheticReplayFixtureCorpus,
} from '../../services/policyCandidateSyntheticReplayFixtureContract.mjs';

function buildCandidate(overrides = {}) {
  return {
    candidateId: 1,
    rawScore: 75,
    evidenceClass: 'identity',
    primaryViability: 'identity_evidence',
    primaryAnchorEligible: true,
    ...overrides,
  };
}

function buildFixture(overrides = {}) {
  return {
    id: 'synthetic-case-1',
    baselineCandidates: [buildCandidate()],
    proposedCandidates: [buildCandidate()],
    expected: {
      baselineActionId: 'prompt_confirm',
      baselineLeadingCandidateId: 1,
      proposedActionId: 'prompt_confirm',
      proposedLeadingCandidateId: 1,
      proposedLeadingCalibrationReasonCode: 'strong_evidence',
    },
    ...overrides,
  };
}

function buildCorpus(fixtures = Array.from({ length: 6 }, (_, index) => buildFixture({
  id: `synthetic-case-${index + 1}`,
}))) {
  return { version: POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_CORPUS_VERSION, fixtures };
}

describe('policy candidate synthetic replay fixture contract', () => {
  test('accepts a bounded opaque synthetic corpus', () => {
    expect(validatePolicyCandidateSyntheticReplayFixtureCorpus(buildCorpus())).toEqual({
      ok: true,
      fixtureCount: 6,
      issues: [],
    });
  });

  test('rejects media-shaped fields and unsafe evidence pairs', () => {
    const fixture = buildFixture();
    fixture.baselineCandidates[0].title = 'live media title';
    fixture.proposedCandidates[0].evidenceClass = 'rag_only';
    fixture.proposedCandidates[0].primaryViability = 'identity_evidence';

    const validation = validatePolicyCandidateSyntheticReplayFixtureCorpus(buildCorpus([
      fixture,
      ...buildCorpus().fixtures.slice(1),
    ]));

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.UNKNOWN_FIELD,
        path: 'corpus.fixtures[0].baselineCandidates[0].title',
      }),
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_CANDIDATE,
        path: 'corpus.fixtures[0].proposedCandidates[0]',
      }),
    ]));
  });

  test('requires expectations to refer only to their own synthetic candidates', () => {
    const fixture = buildFixture();
    fixture.expected.proposedLeadingCandidateId = 99;

    const validation = validatePolicyCandidateSyntheticReplayFixtureCorpus(buildCorpus([
      fixture,
      ...buildCorpus().fixtures.slice(1),
    ]));

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_EXPECTATION,
        path: 'corpus.fixtures[0].expected',
      }),
    ]));
  });
});
