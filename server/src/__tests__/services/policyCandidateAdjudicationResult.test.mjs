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

const aiAuthority = {
  version: 'ai.provider_authority.v1',
  providerId: 'ollama',
  model: 'qwen3:8b',
  effectiveMode: 'proposal',
  capabilities: { providerEnforcedStructuredOutput: false },
};

describe('policyCandidateAdjudicationResult', () => {
  test('accepts only a bounded confident proposal and discards model rationale', () => {
    const result = finalizePolicyCandidateAdjudication({
      contract,
      aiMatch: {
        library: family,
        confidence: 99,
        reason: 'Raw private reasoning',
        format: 'confident',
        ai_authority: aiAuthority,
      },
      policyResult: { confidence: 71 },
      semanticRetrievalStatusId: 'available',
      semanticOutcomeCalibrationStatusId: 'outcome_calibrated',
    });

    expect(result).toMatchObject({
      library: family,
      confidence: 71,
      needs_clarification: true,
      candidate_adjudication: {
        statusId: 'proposed',
        proposedDestination: { library_id: 2, library_name: 'Family' },
        semanticRetrievalStatusId: 'available',
        semanticOutcomeCalibrationStatusId: 'outcome_calibrated',
        semanticProposal: {
          version: 'policy.candidate_semantic_adjudication_proposal.v1',
          fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('Raw private reasoning');
    expect(JSON.stringify(result)).not.toContain('qwen3:8b');
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
