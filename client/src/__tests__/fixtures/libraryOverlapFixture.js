/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function libraryOverlapFixture() {
  return {
    version: 'library.overlap.v1', observedAt: '2026-09-05 12:00:00+00', status: 'available', inventoryRowCount: 5,
    scope: { selectedLibraryCount: 2, activeLibraryCount: 2, excludedLibraryCount: 0, libraryLimit: 12, rowLimit: 20000 },
    libraries: [
      { id: 1, name: 'Movies', inventoryRowCount: 4, unsupportedTypeRowCount: 0, omittedTraitRowCount: 0,
        cohorts: [{ mediaType: 'movie', rowCount: 4, identifiedRowCount: 3, distinctIdentityCount: 2,
          duplicateRowCount: 1, unidentifiedRowCount: 1, identityCoveragePercent: 75 }] },
      { id: 2, name: 'Family', inventoryRowCount: 1, unsupportedTypeRowCount: 0, omittedTraitRowCount: 0,
        cohorts: [{ mediaType: 'movie', rowCount: 1, identifiedRowCount: 1, distinctIdentityCount: 1,
          duplicateRowCount: 0, unidentifiedRowCount: 0, identityCoveragePercent: 100 }] },
    ],
    pairs: [{ leftLibraryId: 1, rightLibraryId: 2, mediaType: 'movie', sharedIdentityCount: 1,
      leftIdentityCount: 2, rightIdentityCount: 1, leftOverlapPercent: 50, rightOverlapPercent: 100,
      identityStatus: 'partial_coverage', traits: [
        { field: 'genres', status: 'partial_coverage', leftObservedIdentityCount: 1, rightObservedIdentityCount: 1,
          leftConflictingIdentityCount: 1, rightConflictingIdentityCount: 0, commonValueCount: 6, truncated: true,
          entries: [{ value: 'Drama', leftCount: 1, rightCount: 1, leftPercentOfIdentities: 50, rightPercentOfIdentities: 100 }] },
        { field: 'keywords', status: 'insufficient_coverage', leftObservedIdentityCount: 0, rightObservedIdentityCount: 0,
          leftConflictingIdentityCount: 0, rightConflictingIdentityCount: 0, commonValueCount: 0, truncated: false, entries: [] },
        { field: 'studio', status: 'complete_coverage', leftObservedIdentityCount: 2, rightObservedIdentityCount: 1,
          leftConflictingIdentityCount: 0, rightConflictingIdentityCount: 0, commonValueCount: 0, truncated: false, entries: [] },
      ] }],
  }
}
