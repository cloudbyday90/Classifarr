/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  buildHeldOutSemanticStudyReviewerSubmissionPair,
} from '../../services/heldOutSemanticStudyReviewerSubmissionPair.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION,
} from '../../services/heldOutSemanticStudyReviewerPacket.mjs';

function currentPacket() {
  return {
    cases: Array.from({ length: 24 }, (_, index) => ({
      fixtureId: `fixture_${String(index).padStart(16, '0')}`,
      media: { overview: 'Private media context' },
    })),
    fixtureDocumentFingerprint: `sha256:${'a'.repeat(64)}`,
    instructions: { independence: 'Do not inspect RAG.' },
    packetId: `review_packet_${'b'.repeat(64)}`,
    studyWindow: { expiresAt: '2026-09-12T12:00:00.000Z', startsAt: '2026-09-11T11:00:00.000Z' },
    version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION,
  };
}

describe('held-out semantic study reviewer submission pair', () => {
  test('creates two production templates without copying private review context', () => {
    const result = buildHeldOutSemanticStudyReviewerSubmissionPair({
      now: new Date('2026-09-11T12:00:00.000Z'),
      packet: currentPacket(),
    });

    expect(result.reviewerOne.labels).toHaveLength(24);
    expect(result.reviewerTwo.labels).toHaveLength(24);
    expect(result.reviewerOne.submissionId).not.toBe(result.reviewerTwo.submissionId);
    expect(JSON.stringify(result)).not.toContain('Private media context');
  });

  test('creates two distinct templates from the same private packet and instant', () => {
    const packet = { sensitive: 'private' };
    const now = new Date('2026-09-11T12:00:00.000Z');
    const createTemplate = jest
      .fn()
      .mockReturnValueOnce({ submissionId: 'reviewer-one' })
      .mockReturnValueOnce({ submissionId: 'reviewer-two' });

    const result = buildHeldOutSemanticStudyReviewerSubmissionPair({ createTemplate, now, packet });

    expect(result).toEqual({
      reviewerOne: { submissionId: 'reviewer-one' },
      reviewerTwo: { submissionId: 'reviewer-two' },
    });
    expect(createTemplate).toHaveBeenNthCalledWith(1, { now, packet });
    expect(createTemplate).toHaveBeenNthCalledWith(2, { now, packet });
  });

  test('fails closed when either worksheet is absent or reuses an identifier', () => {
    expect(buildHeldOutSemanticStudyReviewerSubmissionPair({
      createTemplate: jest.fn(() => null),
      packet: {},
    })).toBeNull();
    expect(buildHeldOutSemanticStudyReviewerSubmissionPair({
      createTemplate: jest.fn(() => ({ submissionId: 'reused' })),
      packet: {},
    })).toBeNull();
  });
});
