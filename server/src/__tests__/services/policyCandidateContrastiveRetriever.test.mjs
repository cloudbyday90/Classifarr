/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createPolicyCandidateContrastiveRetriever,
} from '../../services/policyCandidateContrastiveRetriever.mjs';
import {
  POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_SQL,
} from '../../services/policyCandidateContrastiveRetrieverQuery.mjs';

const contract = {
  valid: true,
  statusId: 'ready',
  mediaType: 'movie',
  tmdbId: 44,
  candidates: [
    { libraryId: 5, mediaType: 'movie' },
    { libraryId: 6, mediaType: 'movie' },
  ],
};

describe('policyCandidateContrastiveRetriever', () => {
  test('uses one parameterized exact-identity query and discards unexpected rows', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        { library_id: 6, title: 'Must not leave the database' },
        { library_id: 99, title: 'Unexpected library' },
        { library_id: 6 },
      ],
    });
    const service = createPolicyCandidateContrastiveRetriever({ query });

    const retrieval = await service.retrieve({ contract });

    expect(query).toHaveBeenCalledWith(POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_SQL, [
      [5, 6], 'movie', 44,
    ]);
    expect(retrieval).toEqual({
      version: 'policy.candidate_contrastive_retrieval.v1',
      statusId: 'available',
      matchedLibraryIds: [6],
    });
    expect(JSON.stringify(retrieval)).not.toContain('Must not leave the database');
    expect(JSON.stringify(retrieval)).not.toContain('Unexpected library');
  });

  test('does not query an invalid contract', async () => {
    const query = jest.fn();
    const service = createPolicyCandidateContrastiveRetriever({ query });

    const retrieval = await service.retrieve({
      contract: { valid: false, statusId: 'identity_unverified' },
    });

    expect(retrieval).toEqual({
      version: 'policy.candidate_contrastive_retrieval.v1',
      statusId: 'identity_unverified',
      matchedLibraryIds: [],
    });
    expect(query).not.toHaveBeenCalled();
  });

  test('fails closed when the inventory query is unavailable', async () => {
    const logger = { warn: jest.fn() };
    const service = createPolicyCandidateContrastiveRetriever({
      query: jest.fn().mockRejectedValue(new Error('database unavailable')),
      logger,
    });

    await expect(service.retrieve({ contract })).resolves.toEqual({
      version: 'policy.candidate_contrastive_retrieval.v1',
      statusId: 'unavailable',
      matchedLibraryIds: [],
    });
    expect(logger.warn).toHaveBeenCalledWith('Policy candidate contrastive retrieval unavailable', {
      error: 'database unavailable',
    });
  });
});
