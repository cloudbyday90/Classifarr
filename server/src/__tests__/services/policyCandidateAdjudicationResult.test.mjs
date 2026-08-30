/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import { finalizePolicyCandidateAdjudication } from '../../services/policyCandidateAdjudicationResult.mjs';

const movies = { id: 1, name: 'Movies' };
const family = { id: 2, name: 'Family' };
const contract = {
  valid: true,
  candidates: [
    { library: movies, libraryId: 1, policyScore: 71 },
    { library: family, libraryId: 2, policyScore: 69 },
  ],
};

describe('policyCandidateAdjudicationResult', () => {
  test('accepts only a bounded confident proposal and discards model rationale', () => {
    const result = finalizePolicyCandidateAdjudication({
      contract,
      aiMatch: { library: family, confidence: 99, reason: 'Raw private reasoning', format: 'confident' },
      policyResult: { confidence: 71 },
    });

    expect(result).toMatchObject({
      library: family,
      confidence: 71,
      needs_clarification: true,
      candidate_adjudication: {
        statusId: 'proposed',
        proposedDestination: { library_id: 2, library_name: 'Family' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('Raw private reasoning');
    expect(result.reason).toContain('operator decision');
  });

  test('rejects malformed provider output without changing the leading candidate', () => {
    const result = finalizePolicyCandidateAdjudication({
      contract,
      aiMatch: { library: { id: 999, name: 'Outside' }, format: 'contract_violation' },
      policyResult: { confidence: 71 },
    });

    expect(result.library).toBe(movies);
    expect(result.candidate_adjudication).toMatchObject({
      statusId: 'response_rejected',
      proposedDestination: null,
    });
  });
});
