/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_ADJUDICATION_VERSION,
  buildPolicyCandidateAdjudicationContract,
  buildPolicyCandidateAdjudicationProjection,
} from '../../services/policyCandidateAdjudicationContract.mjs';

const libraries = [
  { id: 1, name: 'Movies', media_type: 'movie', is_active: true },
  { id: 2, name: 'Family', media_type: 'movie', is_active: true },
  { id: 3, name: 'TV', media_type: 'tv', is_active: true },
  { id: 4, name: 'Retired', media_type: 'movie', is_active: false },
];

describe('policyCandidateAdjudicationContract', () => {
  test('binds a prompt-select comparison to active, matching policy candidates', () => {
    const contract = buildPolicyCandidateAdjudicationContract({
      policyResult: {
        action: 'prompt_select',
        ranked: [
          { library_id: 1, policy_id: 11, score: 71 },
          { library_id: 3, policy_id: 12, score: 70 },
          { library_id: 2, policy_id: 13, score: 69 },
          { library_id: 4, policy_id: 14, score: 68 },
        ],
      },
      libraries,
      mediaType: 'movie',
    });

    expect(contract).toMatchObject({
      version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
      valid: true,
      reasonCode: 'ready',
    });
    expect(contract.candidates.map((candidate) => candidate.libraryId)).toEqual([1, 2]);
    expect(contract.candidates.map((candidate) => candidate.libraryNumber)).toEqual([1, 2]);
  });

  test('does not make a contract when fewer than two eligible destinations remain', () => {
    const contract = buildPolicyCandidateAdjudicationContract({
      policyResult: { action: 'prompt_select', ranked: [{ library_id: 1, score: 71 }] },
      libraries,
      mediaType: 'movie',
    });

    expect(contract).toMatchObject({ valid: false, reasonCode: 'insufficient_candidates' });
  });

  test('persists only status, count, and a validated proposed destination', () => {
    const projection = buildPolicyCandidateAdjudicationProjection({
      version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
      statusId: 'proposed',
      candidateCount: 2,
      proposedDestination: { library_id: 1, library_name: 'Movies' },
      rawReasoning: 'Never persist model thinking.',
    });

    expect(projection).toEqual({
      version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
      status_id: 'proposed',
      candidate_count: 2,
      proposed_destination: { library_id: 1, library_name: 'Movies' },
    });
    expect(JSON.stringify(projection)).not.toContain('thinking');
  });

  test('retains only an allow-listed current-library semantic retrieval status', () => {
    const projection = buildPolicyCandidateAdjudicationProjection({
      version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
      statusId: 'proposed',
      candidateCount: 2,
      proposedDestination: { library_id: 1, library_name: 'Movies' },
      semanticRetrievalStatusId: 'available',
      semanticTitles: ['Do not persist this title'],
    });

    expect(projection).toMatchObject({ semantic_retrieval_status_id: 'available' });
    expect(JSON.stringify(projection)).not.toContain('Do not persist this title');
  });

  test('retains only the opaque frozen semantic-proposal cohort marker', () => {
    const projection = buildPolicyCandidateAdjudicationProjection({
      version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
      statusId: 'proposed',
      candidateCount: 2,
      proposedDestination: { library_id: 1, library_name: 'Movies' },
      semanticProposal: {
        version: 'policy.candidate_semantic_adjudication_proposal.v1',
        fingerprint: 'b'.repeat(64),
        model: 'must-not-persist',
      },
    });

    expect(projection.semantic_proposal).toEqual({
      version: 'policy.candidate_semantic_adjudication_proposal.v1',
      fingerprint: 'b'.repeat(64),
    });
    expect(JSON.stringify(projection)).not.toContain('must-not-persist');
  });
});
