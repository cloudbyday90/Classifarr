/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  composeHeldOutSemanticStudyReviewerReferenceSet,
} from '../../services/heldOutSemanticStudyReviewerReferenceSet.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS as STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
} from '../../services/policyCandidateSemanticIndependentReviewConsensus.mjs';

const fingerprint = `sha256:${'a'.repeat(64)}`;

function fixtureId(index) {
  return `fixture_${String(index).padStart(16, '0')}`;
}

function packet() {
  return {
    cases: Array.from({ length: 24 }, (_, index) => ({
      fixtureId: fixtureId(index),
      media: { title: `Private title ${index}` },
    })),
    fixtureDocumentFingerprint: fingerprint,
    instructions: { boundary: 'Private reviewer context.' },
    packetId: `review_packet_${'b'.repeat(64)}`,
    studyWindow: {
      expiresAt: '2026-09-11T12:00:00.000Z',
      startsAt: '2026-09-10T12:00:00.000Z',
    },
    version: 'policy.held_out_semantic_study_reviewer_packet.v1',
  };
}

function labels({ firstDecision = 'admit' } = {}) {
  return Array.from({ length: 24 }, (_, index) => ({
    fixtureId: fixtureId(index),
    referenceDecisionId: index === 0 ? firstDecision : index % 2 === 0 ? 'review' : 'abstain',
  }));
}

function submission(submissionId, submissionLabels, submissionFingerprint = fingerprint) {
  return {
    fixtureDocumentFingerprint: submissionFingerprint,
    labels: submissionLabels,
    submissionId,
    version: POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
  };
}

describe('held-out semantic-study reviewer reference set', () => {
  test('completes an exact packet-bound unanimous reference set without returning private packet context', () => {
    const reviewerOneSubmission = submission('reviewer_one', labels());
    const reviewerTwoSubmission = submission('reviewer_two', labels());

    const result = composeHeldOutSemanticStudyReviewerReferenceSet({
      packet: packet(),
      reviewerOneSubmission,
      reviewerTwoSubmission,
    });

    expect(result.status.id).toBe(STATUS_IDS.COMPLETE);
    expect(result.summary).toEqual({
      adjudicatedFixtureCount: 0,
      disagreementFixtureCount: 0,
      fixtureCount: 24,
      unanimousFixtureCount: 24,
    });
    expect(result.referenceSetDocument.referenceSetId).toBe(`held_out_reference_${'a'.repeat(64)}`);
    expect(result.referenceSetDocument.labels).toHaveLength(24);
    expect(JSON.stringify(result)).not.toContain('Private title');
    expect(result.authority.automaticActions).toEqual({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    });
  });

  test('requires a third adjudication only when the two packet-bound reviewers disagree', () => {
    const reviewerOneSubmission = submission('reviewer_one', labels());
    const reviewerTwoSubmission = submission('reviewer_two', labels({ firstDecision: 'review' }));

    const pending = composeHeldOutSemanticStudyReviewerReferenceSet({
      packet: packet(),
      reviewerOneSubmission,
      reviewerTwoSubmission,
    });
    expect(pending.status.id).toBe(STATUS_IDS.ADJUDICATION_REQUIRED);
    expect(pending.referenceSetDocument).toBeNull();
    expect(JSON.stringify(pending)).not.toContain(fixtureId(0));

    const complete = composeHeldOutSemanticStudyReviewerReferenceSet({
      adjudicationSubmission: submission('adjudicator', [{
        fixtureId: fixtureId(0),
        referenceDecisionId: 'abstain',
      }]),
      packet: packet(),
      reviewerOneSubmission,
      reviewerTwoSubmission,
    });
    expect(complete.status.id).toBe(STATUS_IDS.COMPLETE);
    expect(complete.summary.adjudicatedFixtureCount).toBe(1);
    expect(complete.referenceSetDocument.labels[0]).toEqual(expect.objectContaining({
      consensusStatusId: 'adjudicated',
      referenceDecisionId: 'abstain',
      reviewerCount: 3,
    }));
  });

  test('fails closed when submissions have a mismatched fingerprint or fixture set', () => {
    const reviewerOneSubmission = submission('reviewer_one', labels());
    const wrongFingerprint = submission('reviewer_two', labels(), `sha256:${'c'.repeat(64)}`);
    const alteredLabels = labels();
    alteredLabels[0] = { ...alteredLabels[0], fixtureId: 'unbound_fixture' };
    const wrongFixtureSet = submission('reviewer_two', alteredLabels);

    for (const reviewerTwoSubmission of [wrongFingerprint, wrongFixtureSet]) {
      const result = composeHeldOutSemanticStudyReviewerReferenceSet({
        packet: packet(),
        reviewerOneSubmission,
        reviewerTwoSubmission,
      });
      expect(result.status.id).toBe(STATUS_IDS.INVALID);
      expect(result.referenceSetDocument).toBeNull();
    }
  });
});
