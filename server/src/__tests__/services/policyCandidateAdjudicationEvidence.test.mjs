/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  createPolicyCandidateAdjudicationEvidenceService,
  projectPolicyCandidateAdjudicationEvidenceForProvider,
} from '../../services/policyCandidateAdjudicationEvidence.mjs';

const contract = {
  version: 'policy.candidate_adjudication.v1',
  valid: true,
  candidates: [
    { libraryId: 1, libraryName: 'Movies', libraryNumber: 1, mediaType: 'movie', policyScore: 71 },
    { libraryId: 2, libraryName: 'Family', libraryNumber: 2, mediaType: 'movie', policyScore: 68 },
  ],
};

describe('policyCandidateAdjudicationEvidence', () => {
  test('keeps local evidence bounded and removes titles for a remote provider', async () => {
    const service = createPolicyCandidateAdjudicationEvidenceService({
      getProfileStats: async () => ({
        totalItems: 120,
        genreDistribution: [{ genre: 'Drama', percentage: 55 }],
        studioDistribution: [{ studio: 'Studio A', percentage: 30 }],
        certificationDistribution: [{ certification: 'PG-13', percentage: 40 }],
        languageDistribution: [{ language: 'English', percentage: 90 }],
      }),
    });
    const evidence = await service.build({
      contract,
      ragContext: {
        similarItems: [{ library_id: 1, title: 'Existing Movie', similarity: 0.91 }],
      },
    });

    const local = projectPolicyCandidateAdjudicationEvidenceForProvider(evidence, {
      providerType: 'ollama',
      providerHost: '192.168.50.95',
    });
    const remote = projectPolicyCandidateAdjudicationEvidenceForProvider(evidence, { providerType: 'openai' });

    expect(local.candidates[0]).toMatchObject({
      profile: { available: true, itemCountBand: '100-499', topGenres: [{ label: 'Drama', percentage: 55 }] },
      rag: { matchCount: 1, titles: ['Existing Movie'] },
    });
    expect(remote.candidates[0].profile).toEqual({ available: true, itemCountBand: '100-499' });
    expect(remote.candidates[0].rag).toEqual({ matchCount: 1, topSimilarity: 91 });
    expect(JSON.stringify(remote)).not.toContain('Existing Movie');
    expect(JSON.stringify(remote)).not.toContain('Studio A');
  });

  test('treats an Ollama type at an untrusted host as a remote provider', async () => {
    const service = createPolicyCandidateAdjudicationEvidenceService({
      getProfileStats: async () => ({
        totalItems: 120,
        genreDistribution: [{ genre: 'Drama', percentage: 55 }],
      }),
    });
    const evidence = await service.build({
      contract,
      ragContext: {
        similarItems: [{ library_id: 1, title: 'Existing Movie', similarity: 0.91 }],
      },
    });

    const remoteOllama = projectPolicyCandidateAdjudicationEvidenceForProvider(evidence, {
      providerType: 'ollama',
      providerHost: 'https://ollama.example.test',
    });

    expect(remoteOllama.candidates[0].profile).toEqual({
      available: true,
      itemCountBand: '100-499',
    });
    expect(remoteOllama.candidates[0].rag).toEqual({ matchCount: 1, topSimilarity: 91 });
    expect(JSON.stringify(remoteOllama)).not.toContain('Existing Movie');
    expect(JSON.stringify(remoteOllama)).not.toContain('Drama');
  });
});
