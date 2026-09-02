/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
  buildPolicyCandidateSemanticAdjudicationProposalProjection,
  createPolicyCandidateSemanticAdjudicationProposalFingerprint,
} from '../../services/policyCandidateSemanticAdjudicationProposalFingerprint.mjs';

function authority(model = 'qwen3:8b') {
  return {
    version: 'ai.provider_authority.v1',
    providerId: 'ollama',
    model,
    effectiveMode: 'proposal',
    capabilities: { providerEnforcedStructuredOutput: false },
  };
}

describe('policyCandidateSemanticAdjudicationProposalFingerprint', () => {
  test('creates a stable content-free proposal cohort marker', () => {
    const first = createPolicyCandidateSemanticAdjudicationProposalFingerprint({
      authority: authority(),
      candidateCount: 2,
      semanticRetrievalStatusId: 'available',
    });
    const second = createPolicyCandidateSemanticAdjudicationProposalFingerprint({
      authority: authority(),
      candidateCount: 2,
      semanticRetrievalStatusId: 'available',
    });

    expect(first).toEqual(second);
    expect(first).toEqual(expect.objectContaining({
      version: POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(first)).not.toContain('qwen3:8b');
  });

  test('separates a model change but keeps availability observations in one cohort', () => {
    const original = createPolicyCandidateSemanticAdjudicationProposalFingerprint({
      authority: authority('qwen3:8b'),
      candidateCount: 2,
      semanticRetrievalStatusId: 'available',
    });
    const changed = createPolicyCandidateSemanticAdjudicationProposalFingerprint({
      authority: authority('gemma3:12b'),
      candidateCount: 2,
      semanticRetrievalStatusId: 'available',
    });

    const unavailable = createPolicyCandidateSemanticAdjudicationProposalFingerprint({
      authority: authority('qwen3:8b'),
      candidateCount: 2,
      semanticRetrievalStatusId: 'unavailable',
    });

    expect(changed.fingerprint).not.toBe(original.fingerprint);
    expect(unavailable.fingerprint).toBe(original.fingerprint);
    expect(createPolicyCandidateSemanticAdjudicationProposalFingerprint({
      authority: { providerId: 'ollama' },
      candidateCount: 2,
      semanticRetrievalStatusId: 'available',
    })).toBeNull();
  });

  test('persists only a known version and opaque hash', () => {
    const projection = buildPolicyCandidateSemanticAdjudicationProposalProjection({
      version: POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
      fingerprint: 'a'.repeat(64),
      model: 'must-not-persist',
    });

    expect(projection).toEqual({
      version: POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
      fingerprint: 'a'.repeat(64),
    });
    expect(buildPolicyCandidateSemanticAdjudicationProposalProjection({
      version: POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
      fingerprint: 'not-a-digest',
    })).toBeNull();
  });
});
