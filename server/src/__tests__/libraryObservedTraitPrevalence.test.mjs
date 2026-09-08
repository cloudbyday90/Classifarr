/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from '@jest/globals';
import { buildOverlapCohort } from '../services/libraryOverlapCohorts.mjs';
import {
  buildLibraryObservedTraitPrevalence,
  LIBRARY_OBSERVED_TRAIT_PREVALENCE_VERSION,
} from '../services/libraryObservedTraitPrevalence.mjs';

const item = (tmdbId, mediaType, genres) => ({ tmdb_id: tmdbId, media_type: mediaType, genres });
const library = (id, items) => ({
  id,
  cohorts: ['movie', 'tv'].map((mediaType) => buildOverlapCohort(items, mediaType)),
});

describe('library observed trait prevalence', () => {
  test('compares a local cohort with only same-type selected-library peers', () => {
    const result = buildLibraryObservedTraitPrevalence({
      libraries: [
        library(1, [item(1, 'movie', ['Action', 'Drama']), item(2, 'movie', ['Action']), item(3, 'tv', ['Reality'])]),
        library(2, [item(4, 'movie', ['Drama']), item(5, 'movie', ['Drama']), item(6, 'tv', ['Comedy'])]),
      ],
      activeLibraryCount: 2,
    });
    const genre = result.libraries[0].cohorts[0].traits.find((trait) => trait.field === 'genres');

    expect(result).toMatchObject({
      version: LIBRARY_OBSERVED_TRAIT_PREVALENCE_VERSION,
      scopeStatus: 'complete_active_library_scope',
      selectedLibraryCount: 2,
    });
    expect(genre).toMatchObject({
      status: 'complete_local_coverage',
      localObservedIdentityCount: 2,
      peerObservedIdentityCount: 2,
      peerKnownLibraryCount: 1,
      entries: [
        { value: 'Action', localCount: 2, localPercentOfObservedIdentities: 100,
          peerCount: 0, peerPercentOfObservedIdentities: 0, differencePercentPoints: 100 },
        { value: 'Drama', localCount: 1, localPercentOfObservedIdentities: 50,
          peerCount: 2, peerPercentOfObservedIdentities: 100, differencePercentPoints: -50 },
      ],
    });
  });

  test('retains uncertainty when the selected-library scope or local trait coverage is incomplete', () => {
    const result = buildLibraryObservedTraitPrevalence({
      libraries: [library(1, [item(1, 'movie', ['Action']), item(2, 'movie', [])])],
      activeLibraryCount: 2,
    });
    const genre = result.libraries[0].cohorts[0].traits.find((trait) => trait.field === 'genres');

    expect(result.scopeStatus).toBe('partial_active_library_scope');
    expect(genre).toMatchObject({
      status: 'partial_local_coverage',
      peerObservedIdentityCount: 0,
      peerKnownLibraryCount: 0,
      entries: [expect.objectContaining({
        value: 'Action',
        peerPercentOfObservedIdentities: null,
        differencePercentPoints: null,
      })],
    });
  });

  test('bounds the response, including an oversized caller entry limit', () => {
    const result = buildLibraryObservedTraitPrevalence({
      libraries: [library(1, [item(1, 'movie', ['A', 'B', 'C', 'D', 'E', 'F'])])],
      activeLibraryCount: 1,
      entryLimit: 99,
    });
    const genre = result.libraries[0].cohorts[0].traits.find((trait) => trait.field === 'genres');

    expect(result.entryLimit).toBe(5);
    expect(genre).toMatchObject({ valueCount: 6, truncated: true });
    expect(genre.entries.map((entry) => entry.value)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
