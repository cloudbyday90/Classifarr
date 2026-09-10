/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  composePolicyCandidateSemanticIndependentReviewConsensus,
  POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
  validatePolicyCandidateSemanticReviewerSubmission,
} from '../../services/policyCandidateSemanticIndependentReviewConsensus.mjs';

const FIXTURE_DOCUMENT_FINGERPRINT = `sha256:${'a'.repeat(64)}`;

function submission(submissionId, labels, {
  fixtureDocumentFingerprint = FIXTURE_DOCUMENT_FINGERPRINT,
} = {}) {
  return {
    fixtureDocumentFingerprint,
    labels,
    submissionId,
    version: POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
  };
}

const BASELINE_LABELS = Object.freeze([
  Object.freeze({ fixtureId: 'fixture-a', referenceDecisionId: 'admit' }),
  Object.freeze({ fixtureId: 'fixture-b', referenceDecisionId: 'review' }),
]);

describe('policyCandidateSemanticIndependentReviewConsensus', () => {
  test('composes two unanimous redacted submissions into the established reference-set contract', () => {
    const result = composePolicyCandidateSemanticIndependentReviewConsensus({
      referenceSetId: 'independent-study-reference-set',
      reviewerOneSubmission: submission('reviewer-one-opaque', BASELINE_LABELS),
      reviewerTwoSubmission: submission('reviewer-two-opaque', BASELINE_LABELS),
    });

    expect(result.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.COMPLETE,
    );
    expect(result.summary).toEqual({
      adjudicatedFixtureCount: 0,
      disagreementFixtureCount: 0,
      fixtureCount: 2,
      unanimousFixtureCount: 2,
    });
    expect(result.referenceSetDocument).toEqual({
      fixtureDocumentFingerprint: FIXTURE_DOCUMENT_FINGERPRINT,
      labelingProtocolId: 'independent_double_blind_human.v1',
      labels: [
        {
          consensusStatusId: 'unanimous',
          fixtureId: 'fixture-a',
          referenceDecisionId: 'admit',
          reviewerCount: 2,
        },
        {
          consensusStatusId: 'unanimous',
          fixtureId: 'fixture-b',
          referenceDecisionId: 'review',
          reviewerCount: 2,
        },
      ],
      referenceSetId: 'independent-study-reference-set',
      version: 'policy.candidate_semantic_reference_set_document.v1',
    });
    expect(result.authority.automaticActions).toEqual({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    });
  });

  test('requires third-party adjudication for every disagreement without emitting a reference set', () => {
    const result = composePolicyCandidateSemanticIndependentReviewConsensus({
      referenceSetId: 'independent-study-reference-set',
      reviewerOneSubmission: submission('reviewer-one-opaque', BASELINE_LABELS),
      reviewerTwoSubmission: submission('reviewer-two-opaque', [
        { fixtureId: 'fixture-a', referenceDecisionId: 'review' },
        { fixtureId: 'fixture-b', referenceDecisionId: 'review' },
      ]),
    });

    expect(result.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.ADJUDICATION_REQUIRED,
    );
    expect(result.summary).toEqual({
      adjudicatedFixtureCount: 1,
      disagreementFixtureCount: 1,
      fixtureCount: 2,
      unanimousFixtureCount: 1,
    });
    expect(result.referenceSetDocument).toBeNull();
    expect(JSON.stringify(result)).not.toContain('fixture-a');
  });

  test('allows an adjudicator to settle only disputed fixtures and records a three-reviewer outcome', () => {
    const result = composePolicyCandidateSemanticIndependentReviewConsensus({
      adjudicationSubmission: submission('adjudicator-opaque', [
        { fixtureId: 'fixture-a', referenceDecisionId: 'abstain' },
      ]),
      referenceSetId: 'independent-study-reference-set',
      reviewerOneSubmission: submission('reviewer-one-opaque', BASELINE_LABELS),
      reviewerTwoSubmission: submission('reviewer-two-opaque', [
        { fixtureId: 'fixture-a', referenceDecisionId: 'review' },
        { fixtureId: 'fixture-b', referenceDecisionId: 'review' },
      ]),
    });

    expect(result.status.id).toBe(
      POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.COMPLETE,
    );
    expect(result.referenceSetDocument.labels).toEqual([
      {
        consensusStatusId: 'adjudicated',
        fixtureId: 'fixture-a',
        referenceDecisionId: 'abstain',
        reviewerCount: 3,
      },
      {
        consensusStatusId: 'unanimous',
        fixtureId: 'fixture-b',
        referenceDecisionId: 'review',
        reviewerCount: 2,
      },
    ]);
  });

  test('fails closed for a duplicate submission identity, mixed binding, or incomplete adjudication', () => {
    const duplicateIdentity = composePolicyCandidateSemanticIndependentReviewConsensus({
      referenceSetId: 'independent-study-reference-set',
      reviewerOneSubmission: submission('reused-submission', BASELINE_LABELS),
      reviewerTwoSubmission: submission('reused-submission', BASELINE_LABELS),
    });
    const mixedBinding = composePolicyCandidateSemanticIndependentReviewConsensus({
      referenceSetId: 'independent-study-reference-set',
      reviewerOneSubmission: submission('reviewer-one-opaque', BASELINE_LABELS),
      reviewerTwoSubmission: submission('reviewer-two-opaque', BASELINE_LABELS, {
        fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}`,
      }),
    });
    const incompleteAdjudication = composePolicyCandidateSemanticIndependentReviewConsensus({
      adjudicationSubmission: submission('adjudicator-opaque', [
        { fixtureId: 'fixture-b', referenceDecisionId: 'review' },
      ]),
      referenceSetId: 'independent-study-reference-set',
      reviewerOneSubmission: submission('reviewer-one-opaque', BASELINE_LABELS),
      reviewerTwoSubmission: submission('reviewer-two-opaque', [
        { fixtureId: 'fixture-a', referenceDecisionId: 'review' },
        { fixtureId: 'fixture-b', referenceDecisionId: 'admit' },
      ]),
    });

    for (const result of [duplicateIdentity, mixedBinding, incompleteAdjudication]) {
      expect(result.status.id).toBe(
        POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.INVALID,
      );
      expect(result.referenceSetDocument).toBeNull();
      expect(JSON.stringify(result)).not.toContain('fixture-a');
    }
  });

  test('rejects reviewer identity and raw-content fields rather than treating them as provenance', () => {
    const invalidSubmission = submission('reviewer-one-opaque', BASELINE_LABELS.map((label) => ({ ...label })));
    invalidSubmission.reviewerIdentity = 'Sensitive person name';
    invalidSubmission.labels[0] = {
      ...invalidSubmission.labels[0],
      title: 'Sensitive media title',
    };

    const validation = validatePolicyCandidateSemanticReviewerSubmission(invalidSubmission);
    expect(validation.ok).toBe(false);
    expect(JSON.stringify(validation)).not.toContain('Sensitive person name');
    expect(JSON.stringify(validation)).not.toContain('Sensitive media title');
  });
});
