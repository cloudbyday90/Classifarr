/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildHeldOutSemanticStudyReviewerPacket,
  HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION,
} from '../../services/heldOutSemanticStudyReviewerPacket.mjs';

const id = (prefix, index) => `${prefix}_${String(index).padStart(16, '0')}`;

function input() {
  const fixtureDocument = Array.from({ length: 24 }, (_, index) => ({
    id: id('fixture', index),
    name: id('fixture', index),
  }));
  return {
    bundle: { fixtureDocument },
    policies: [
      {
        library_id: 10,
        library_name: 'Documentaries',
        name: 'Documentary policy',
        policy_intent_contract: { purpose: [{ values: { include: ['documentary'] } }] },
      },
      {
        library_id: 20,
        library_name: 'Movies',
        name: 'Movie policy',
        policy_intent_contract: { purpose: [{ values: { include: ['feature'] } }] },
      },
    ],
    privateReviewCases: fixtureDocument.map((fixture, index) => ({
      contract: {
        valid: true,
        candidates: [{ libraryId: 10 }, { libraryId: 20 }],
      },
      fixtureId: fixture.id,
      metadata: {
        genres: ['Documentary'],
        media_type: 'movie',
        overview: 'A bounded review-only description.',
        title: `Private film ${index}`,
        tmdb_id: index + 1,
        year: 2026,
      },
    })),
    selected: fixtureDocument.map((fixture) => ({ fixtureId: fixture.id })),
  };
}

describe('held-out semantic study reviewer packet', () => {
  test('contains only private source and declared-policy review context, bound to a short window', () => {
    const packet = buildHeldOutSemanticStudyReviewerPacket({
      ...input(),
      now: new Date('2026-09-10T12:00:00.000Z'),
    });

    expect(packet).toMatchObject({
      version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION,
      studyWindow: {
        startsAt: '2026-09-10T12:00:00.000Z',
        expiresAt: '2026-09-11T12:00:00.000Z',
      },
    });
    expect(packet.packetId).toMatch(/^review_packet_[a-f0-9]{64}$/u);
    expect(packet.cases).toHaveLength(24);
    expect(packet.cases[0]).toEqual(expect.objectContaining({
      fixtureId: id('fixture', 0),
      media: expect.objectContaining({ title: 'Private film 0' }),
      candidates: [
        expect.objectContaining({ candidateId: 'candidate_a', declaredPurpose: ['documentary'] }),
        expect.objectContaining({ candidateId: 'candidate_b', declaredPurpose: ['feature'] }),
      ],
    }));
    const serialized = JSON.stringify(packet);
    expect(serialized).not.toMatch(/"tmdb_id"|"relevance"|"embedding"|"prompt"|"modelOutput"|"currentPlacement"/u);
    expect(serialized).not.toContain('libraryId');
  });

  test('fails closed for an unbounded window or unmapped policy candidate', () => {
    const packetInput = input();
    expect(buildHeldOutSemanticStudyReviewerPacket({
      ...packetInput,
      ttlMilliseconds: 24 * 60 * 60 * 1000 + 1,
    })).toBeNull();
    packetInput.privateReviewCases[0].contract.candidates[1].libraryId = 999;
    expect(buildHeldOutSemanticStudyReviewerPacket(packetInput)).toBeNull();
  });
});
