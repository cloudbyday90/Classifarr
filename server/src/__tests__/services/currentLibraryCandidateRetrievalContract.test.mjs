/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateRetrievalRequest,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS,
} from '../../services/currentLibraryCandidateRetrievalContract.mjs';

const contract = {
  valid: true,
  candidates: [
    { libraryId: 7, mediaType: 'movie' },
    { libraryId: 9, mediaType: 'movie' },
    { libraryId: 11, mediaType: 'movie' },
    { libraryId: 13, mediaType: 'movie' },
  ],
};

describe('currentLibraryCandidateRetrievalContract', () => {
  test('uses only the bounded policy-owned candidates and metadata search fields', () => {
    const request = buildCurrentLibraryCandidateRetrievalRequest({
      contract,
      metadata: {
        title: ' Range of Stars ',
        tmdb_id: 101,
        year: 2026,
        genres: ['Drama'],
        overview: 'A musician searches the night sky for a missing friend.',
      },
    });

    expect(request).toMatchObject({
      statusId: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.READY,
      mediaType: 'movie',
      title: 'Range of Stars',
      searchText: 'Range of Stars Drama A musician searches the night sky for a missing friend.',
      tmdbId: 101,
      year: 2026,
      maximumItemsPerCandidate: 3,
    });
    expect(request.candidates).toEqual([
      { libraryId: 7, mediaType: 'movie' },
      { libraryId: 9, mediaType: 'movie' },
      { libraryId: 11, mediaType: 'movie' },
    ]);
  });

  test('bounds contextual search terms before the database receives them', () => {
    const request = buildCurrentLibraryCandidateRetrievalRequest({
      contract,
      metadata: {
        title: 'Range of Stars',
        overview: Array.from({ length: 80 }, (_value, index) => `term-${index}`).join(' '),
      },
    });

    expect(request.searchText.split(' ')).toHaveLength(48);
  });

  test.each([
    ['an invalid contract', { valid: false, candidates: contract.candidates }, { title: 'Range of Stars' }],
    ['one candidate', { valid: true, candidates: [{ libraryId: 7, mediaType: 'movie' }] }, { title: 'Range of Stars' }],
    ['mixed media types', { valid: true, candidates: [{ libraryId: 7, mediaType: 'movie' }, { libraryId: 9, mediaType: 'tv' }] }, { title: 'Range of Stars' }],
    ['an unsupported media type', { valid: true, candidates: [{ libraryId: 7, mediaType: 'music' }, { libraryId: 9, mediaType: 'music' }] }, { title: 'Range of Stars' }],
    ['a missing title', contract, { tmdb_id: 101 }],
  ])('does not create a request for %s', (_name, candidateContract, metadata) => {
    const request = buildCurrentLibraryCandidateRetrievalRequest({ contract: candidateContract, metadata });

    expect(request).toEqual(expect.objectContaining({
      statusId: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.NOT_APPLICABLE,
      candidates: [],
    }));
  });
});
