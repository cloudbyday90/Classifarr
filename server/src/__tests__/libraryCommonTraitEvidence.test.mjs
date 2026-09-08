/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from '@jest/globals';
import { buildLibraryCommonTraitEvidence } from '../services/libraryCommonTraitEvidence.mjs';
import { buildOverlapCohort } from '../services/libraryOverlapCohorts.mjs';

const item = (tmdbId, mediaType, genres = []) => ({ tmdb_id: tmdbId, media_type: mediaType, genres });
const library = (id, items) => ({
  id,
  cohorts: ['movie', 'tv'].map((mediaType) => buildOverlapCohort(items, mediaType)),
});

describe('library common trait evidence', () => {
  test('reports bounded same-type recurring observations without exposing library identities', () => {
    const result = buildLibraryCommonTraitEvidence({
      libraries: [
        library(1, [item(1, 'movie', ['Action', 'Drama']), item(2, 'movie', ['Action'])]),
        library(2, [item(3, 'movie', ['Action']), item(4, 'tv', ['Reality'])]),
        library(3, [item(5, 'movie', ['Action', 'Comedy'])]),
      ],
      activeLibraryCount: 4,
    });
    const genres = result.groups[0].traits.find((trait) => trait.field === 'genres');

    expect(result).toMatchObject({
      version: 'library.common_trait_evidence.v1',
      scopeStatus: 'partial_active_library_scope',
      selectedLibraryCount: 3,
      policyPurposeProvenanceIncluded: false,
    });
    expect(genres).toMatchObject({
      status: 'common_trait_evidence_available',
      typedSelectedLibraryCount: 3,
      knownLibraryCount: 3,
      commonValueCount: 1,
      entries: [{ value: 'Action', observedLibraryCount: 3, matchingIdentityObservationCount: 4 }],
    });
    expect(JSON.stringify(result)).not.toContain('libraryIds');
    expect(JSON.stringify(result)).not.toContain('"policyPurpose":');
  });

  test('keeps insufficient coverage distinct from a measured absence of repeated values', () => {
    const result = buildLibraryCommonTraitEvidence({
      libraries: [
        library(1, [item(1, 'movie', ['Action'])]),
        library(2, [item(2, 'movie', ['Drama'])]),
      ],
      activeLibraryCount: 2,
    });
    const genres = result.groups[0].traits.find((trait) => trait.field === 'genres');
    const keywords = result.groups[0].traits.find((trait) => trait.field === 'keywords');

    expect(genres).toMatchObject({ status: 'common_trait_evidence_available', commonValueCount: 0, entries: [] });
    expect(keywords).toMatchObject({ status: 'insufficient_trait_coverage', commonValueCount: 0, entries: [] });
  });

  test('includes only fixed administrator provenance counts for a repeated observation', () => {
    const result = buildLibraryCommonTraitEvidence({
      libraries: [
        library(1, [item(1, 'movie', ['Action'])]),
        library(2, [item(2, 'movie', ['Action'])]),
      ],
      activeLibraryCount: 2,
      policyPurposeByLibrary: new Map([
        [1, { statusId: 'profile_only_specialized_purpose', privateRule: 'do-not-return' }],
        [2, { statusId: 'retained_declared_purpose_available', privateRule: 'do-not-return' }],
      ]),
    });
    const entry = result.groups[0].traits.find((trait) => trait.field === 'genres').entries[0];

    expect(result.policyPurposeProvenanceIncluded).toBe(true);
    expect(entry).toEqual({
      value: 'Action',
      observedLibraryCount: 2,
      matchingIdentityObservationCount: 2,
      policyPurpose: {
        noActiveValidatedPolicyLibraryCount: 0,
        profileOnlySpecializedPurposeLibraryCount: 1,
        noRetainedDeclaredPurposeLibraryCount: 0,
        retainedDeclaredPurposeLibraryCount: 1,
      },
    });
    expect(JSON.stringify(result)).not.toContain('privateRule');
  });

  test('enforces the five-entry response cap deterministically', () => {
    const values = ['F', 'E', 'D', 'C', 'B', 'A'];
    const result = buildLibraryCommonTraitEvidence({
      libraries: [library(1, [item(1, 'movie', values)]), library(2, [item(2, 'movie', values)])],
      activeLibraryCount: 2,
      entryLimit: 99,
    });
    const genres = result.groups[0].traits.find((trait) => trait.field === 'genres');

    expect(result.entryLimit).toBe(5);
    expect(genres).toMatchObject({ commonValueCount: 6, truncated: true });
    expect(genres.entries.map((entry) => entry.value)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
