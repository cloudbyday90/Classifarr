/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  isHeldOutSemanticStudyPrivateCohortCaptureReady,
} from '../../services/heldOutSemanticStudyCohortCaptureReadiness.mjs';

function completeReceipt(overrides = {}) {
  return {
    version: 'policy.held_out_semantic_study_eligibility_audit.v6',
    status: { id: 'complete' },
    summary: {
      candidateCount: 28,
      candidateCountByStratum: {
        documentary: 7,
        'genre-overlap': 7,
        ordinary: 7,
        reality: 7,
      },
      eligibleCountByStratum: {
        documentary: 7,
        'genre-overlap': 7,
        ordinary: 7,
        reality: 7,
      },
      ...overrides,
    },
  };
}

test('accepts only a complete, balanced aggregate audit receipt', () => {
  expect(isHeldOutSemanticStudyPrivateCohortCaptureReady(completeReceipt())).toBe(true);
  expect(isHeldOutSemanticStudyPrivateCohortCaptureReady(completeReceipt({
    eligibleCountByStratum: {
      documentary: 7,
      'genre-overlap': 7,
      ordinary: 7,
      reality: 6,
    },
  }))).toBe(false);
  expect(isHeldOutSemanticStudyPrivateCohortCaptureReady({
    ...completeReceipt(),
    status: { id: 'candidate_source_truncated' },
  })).toBe(false);
});

test('fails closed for malformed count relationships and never returns audit content', () => {
  expect(isHeldOutSemanticStudyPrivateCohortCaptureReady(completeReceipt({
    candidateCount: 27,
  }))).toBe(false);
  expect(isHeldOutSemanticStudyPrivateCohortCaptureReady(completeReceipt({
    candidateCountByStratum: { documentary: 7 },
  }))).toBe(false);
  const result = isHeldOutSemanticStudyPrivateCohortCaptureReady(completeReceipt());
  expect(result).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/tmdb|library|policy|title/u);
});
