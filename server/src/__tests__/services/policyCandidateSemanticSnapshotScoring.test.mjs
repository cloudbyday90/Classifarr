/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  scorePolicyCandidateSemanticSnapshot,
} from '../../services/policyCandidateSemanticSnapshotScoring.mjs';

function buildSnapshot({ leadingEmbedding, alternativeEmbedding }) {
  return {
    queryEmbedding: [1, 0, 0, 0],
    candidateEmbeddings: [
      { roleId: 'leading', embedding: leadingEmbedding },
      { roleId: 'alternative', embedding: alternativeEmbedding },
    ],
  };
}

describe('policyCandidateSemanticSnapshotScoring', () => {
  test('returns only allow-listed leading, alternative, or abstain signals', () => {
    expect(scorePolicyCandidateSemanticSnapshot(buildSnapshot({
      leadingEmbedding: [1, 0, 0, 0],
      alternativeEmbedding: [0, 1, 0, 0],
    }))).toBe('supports_leading_candidate');
    expect(scorePolicyCandidateSemanticSnapshot(buildSnapshot({
      leadingEmbedding: [0, 1, 0, 0],
      alternativeEmbedding: [1, 0, 0, 0],
    }))).toBe('supports_alternative_candidate');
    expect(scorePolicyCandidateSemanticSnapshot(buildSnapshot({
      leadingEmbedding: [0.9, 0.1, 0, 0],
      alternativeEmbedding: [0.88, 0.12, 0, 0],
    }))).toBe('abstain');
  });
});
