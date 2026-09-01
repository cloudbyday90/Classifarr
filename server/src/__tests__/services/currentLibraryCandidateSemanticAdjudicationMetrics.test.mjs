/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateSemanticAdjudicationMetrics,
} from '../../services/currentLibraryCandidateSemanticAdjudicationMetrics.mjs';

describe('currentLibraryCandidateSemanticAdjudicationMetrics', () => {
  test('builds fixed, aggregate-only semantic-context outcome buckets', () => {
    const result = buildCurrentLibraryCandidateSemanticAdjudicationMetrics({
      observationCount: 12,
      row: {
        candidateAdjudicationComparisonCount: 8,
        proposalCount: 5,
        candidateAdjudicationAbstainedCount: 2,
        candidateAdjudicationResponseRejectedCount: 1,
        semanticAvailableComparisonCount: 4,
        semanticAvailableProposalCount: 3,
        semanticAvailableResolvedProposalCount: 2,
        semanticAvailableAgreedProposalCount: 2,
        semanticUnavailableComparisonCount: 3,
        semanticUnavailableProposalCount: 2,
        semanticUnavailableResolvedProposalCount: 2,
        semanticUnavailableAgreedProposalCount: 1,
        semanticNotRecordedComparisonCount: 1,
      },
    });

    expect(result).toEqual({
      comparisonCount: 8,
      proposalCount: 5,
      abstainedCount: 2,
      responseRejectedCount: 1,
      unclassifiedComparisonCount: 0,
      semanticContext: [
        {
          statusId: 'available',
          comparisonCount: 4,
          proposalCount: 3,
          resolvedProposalCount: 2,
          agreedProposalCount: 2,
          alternativeProposalCount: 0,
          pendingProposalCount: 1,
          agreementRatePercent: 100,
        },
        {
          statusId: 'unavailable',
          comparisonCount: 3,
          proposalCount: 2,
          resolvedProposalCount: 2,
          agreedProposalCount: 1,
          alternativeProposalCount: 1,
          pendingProposalCount: 0,
          agreementRatePercent: 50,
        },
        {
          statusId: 'not_recorded',
          comparisonCount: 1,
          proposalCount: 0,
          resolvedProposalCount: 0,
          agreedProposalCount: 0,
          alternativeProposalCount: 0,
          pendingProposalCount: 0,
          agreementRatePercent: 0,
        },
      ],
    });
  });

  test('bounds malformed aggregate counts without producing impossible rates', () => {
    const result = buildCurrentLibraryCandidateSemanticAdjudicationMetrics({
      observationCount: 2,
      row: {
        candidateAdjudicationComparisonCount: 99,
        proposalCount: 99,
        candidateAdjudicationAbstainedCount: 99,
        candidateAdjudicationResponseRejectedCount: 99,
        semanticAvailableComparisonCount: 99,
        semanticAvailableProposalCount: 99,
        semanticAvailableResolvedProposalCount: 99,
        semanticAvailableAgreedProposalCount: 99,
      },
    });

    expect(result.comparisonCount).toBe(2);
    expect(result.proposalCount).toBe(2);
    expect(result.abstainedCount).toBe(0);
    expect(result.responseRejectedCount).toBe(0);
    expect(result.semanticContext[0]).toMatchObject({
      comparisonCount: 2,
      proposalCount: 2,
      resolvedProposalCount: 2,
      agreedProposalCount: 2,
      agreementRatePercent: 100,
    });
    expect(result.semanticContext.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ comparisonCount: 0 }),
    ]));
  });
});
