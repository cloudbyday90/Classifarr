/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness,
} from '../../services/currentLibraryCandidateRetrievalPolicyReviewReadiness.mjs';

describe('currentLibraryCandidateRetrievalPolicyReviewReadiness', () => {
  test('waits for a minimum applicable operator-decision cohort', () => {
    const readiness = buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
      candidateSetSelectionOutcomeCount: 16,
      changedOutsideCandidateOutcomeCount: 3,
    });

    expect(readiness).toMatchObject({
      version: 'current_library.candidate_retrieval_policy_review_readiness.v1',
      statusId: 'insufficient_data',
      applicableDecisionCount: 19,
      minimumApplicableDecisionCount: 20,
      outsideCandidateOutcomeCount: 3,
      outsideCandidateRatePercent: 15.8,
    });
  });

  test('supports the current candidate set when sufficient data has no material outside rate', () => {
    expect(buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
      candidateSetSelectionOutcomeCount: 20,
      changedOutsideCandidateOutcomeCount: 0,
    })).toMatchObject({
      statusId: 'candidate_set_supported',
      applicableDecisionCount: 20,
      outsideCandidateRatePercent: 0,
    });
  });

  test('recommends review only at the fixed count and rate thresholds', () => {
    expect(buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
      candidateSetSelectionOutcomeCount: 17,
      changedOutsideCandidateOutcomeCount: 3,
    })).toMatchObject({
      statusId: 'candidate_set_review_recommended',
      applicableDecisionCount: 20,
      outsideCandidateRatePercent: 15,
      minimumOutsideCandidateOutcomeCount: 3,
      minimumOutsideCandidateRatePercent: 15,
    });

    expect(buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
      candidateSetSelectionOutcomeCount: 18,
      changedOutsideCandidateOutcomeCount: 2,
    }).statusId).toBe('candidate_set_supported');
    expect(buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
      candidateSetSelectionOutcomeCount: 18,
      changedOutsideCandidateOutcomeCount: 3,
    }).statusId).toBe('candidate_set_supported');
  });

  test('normalizes malformed counts and keeps the aggregate sum safe', () => {
    expect(buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
      candidateSetSelectionOutcomeCount: -1,
      changedOutsideCandidateOutcomeCount: 'not a count',
    })).toMatchObject({
      statusId: 'insufficient_data',
      applicableDecisionCount: 0,
      outsideCandidateOutcomeCount: 0,
    });

    const readiness = buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
      candidateSetSelectionOutcomeCount: Number.MAX_SAFE_INTEGER,
      changedOutsideCandidateOutcomeCount: Number.MAX_SAFE_INTEGER,
    });

    expect(readiness).toMatchObject({
      statusId: 'candidate_set_supported',
      applicableDecisionCount: Number.MAX_SAFE_INTEGER,
      outsideCandidateOutcomeCount: 0,
    });
    expect(JSON.stringify(readiness)).not.toContain('libraryId');
    expect(JSON.stringify(readiness)).not.toContain('destinationName');
  });
});
