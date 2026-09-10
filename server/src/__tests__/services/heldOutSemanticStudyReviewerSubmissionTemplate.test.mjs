/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  finalizeHeldOutSemanticStudyReviewerSubmission,
  buildHeldOutSemanticStudyReviewerSubmissionTemplate,
  HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_TEMPLATE_VERSION,
} from '../../services/heldOutSemanticStudyReviewerSubmissionTemplate.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION,
} from '../../services/heldOutSemanticStudyReviewerPacket.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
  validatePolicyCandidateSemanticReviewerSubmission,
} from '../../services/policyCandidateSemanticIndependentReviewConsensus.mjs';

const fingerprint = `sha256:${'a'.repeat(64)}`;
const now = new Date('2026-09-10T12:00:00.000Z');

function packet() {
  return {
    cases: Array.from({ length: 24 }, (_, index) => ({
      candidates: [{ candidateId: 'candidate_a' }, { candidateId: 'candidate_b' }],
      fixtureId: `fixture_${String(index).padStart(16, '0')}`,
      media: { overview: 'Private media context', title: `Title ${index}` },
    })),
    fixtureDocumentFingerprint: fingerprint,
    instructions: { independence: 'Do not inspect RAG.' },
    packetId: `review_packet_${'b'.repeat(64)}`,
    studyWindow: { expiresAt: '2026-09-11T12:00:00.000Z', startsAt: '2026-09-10T11:00:00.000Z' },
    version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION,
  };
}

describe('held-out reviewer submission template', () => {
  test('creates a deliberately incomplete content-free template from a current packet', () => {
    const template = buildHeldOutSemanticStudyReviewerSubmissionTemplate({
      now,
      packet: packet(),
      random: () => Buffer.alloc(16, 1),
    });

    expect(template).toMatchObject({
      fixtureDocumentFingerprint: fingerprint,
      studyWindow: { expiresAt: '2026-09-11T12:00:00.000Z' },
      submissionId: `review_submission_${'01'.repeat(16)}`,
      version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_TEMPLATE_VERSION,
    });
    expect(template.labels).toHaveLength(24);
    expect(template.labels.every((label) => label.referenceDecisionId === null)).toBe(true);
    expect(JSON.stringify(template)).not.toContain('Private media context');
    expect(JSON.stringify(template)).not.toContain('candidate_a');
  });

  test('finalizes only complete labels bound to the original current packet', () => {
    const sourcePacket = packet();
    const template = buildHeldOutSemanticStudyReviewerSubmissionTemplate({ now, packet: sourcePacket });
    const completedTemplate = {
      ...template,
      labels: template.labels.map((label, index) => ({
        ...label,
        referenceDecisionId: index % 3 === 0 ? 'admit' : index % 3 === 1 ? 'review' : 'abstain',
      })),
    };

    const submission = finalizeHeldOutSemanticStudyReviewerSubmission({
      now,
      packet: sourcePacket,
      template: completedTemplate,
    });

    expect(submission).toMatchObject({
      fixtureDocumentFingerprint: fingerprint,
      version: POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
    });
    expect(validatePolicyCandidateSemanticReviewerSubmission(submission).ok).toBe(true);
    expect(JSON.stringify(submission)).not.toContain('Private media context');
  });

  test('fails closed for an expired packet, incomplete labels, or an altered fixture binding', () => {
    const sourcePacket = packet();
    const template = buildHeldOutSemanticStudyReviewerSubmissionTemplate({ now, packet: sourcePacket });
    expect(finalizeHeldOutSemanticStudyReviewerSubmission({ now, packet: sourcePacket, template })).toBeNull();
    expect(buildHeldOutSemanticStudyReviewerSubmissionTemplate({
      now: new Date('2026-09-12T12:00:00.000Z'),
      packet: sourcePacket,
    })).toBeNull();
    const incompletePacket = { ...sourcePacket };
    delete incompletePacket.instructions;
    expect(buildHeldOutSemanticStudyReviewerSubmissionTemplate({ now, packet: incompletePacket })).toBeNull();
    const completedTemplate = {
      ...template,
      labels: template.labels.map((label) => ({ ...label, referenceDecisionId: 'review' })),
    };
    completedTemplate.labels[0].fixtureId = 'unbound_fixture';
    expect(finalizeHeldOutSemanticStudyReviewerSubmission({
      now,
      packet: sourcePacket,
      template: completedTemplate,
    })).toBeNull();
  });
});
