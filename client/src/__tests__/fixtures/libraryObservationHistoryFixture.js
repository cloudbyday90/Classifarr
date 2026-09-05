/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function libraryObservationHistoryFixture() {
  const libraryCoverage = [
    { libraryId: 1, inventoryRows: 6, supportedRows: 5, identifiedRows: 4, capturedRows: 3, freshRows: 2,
      keywordRows: 2, languageRows: 1, comparison: 'comparable', populationChanged: false, unchangedIntervals: 0,
      previousObservedAt: '2026-09-05T11:05:00Z', delta: { capturedRows: 1, freshRows: 0, keywordRows: 1, languageRows: 0 } },
    { libraryId: 2, inventoryRows: 4, supportedRows: 4, identifiedRows: 4, capturedRows: 3, freshRows: 3,
      keywordRows: 2, languageRows: 1, comparison: 'population_changed', populationChanged: true, unchangedIntervals: 0,
      previousObservedAt: '2026-09-05T11:05:00Z', delta: null },
  ]
  return { version: 'library.observation_history.v1', observedAt: '2026-09-05T12:30:00Z', retentionHours: 168,
    activityPopulation: 'all_guarded_inventory_acquisition_attempts', coveragePopulation: 'bounded_active_library_inventory_rows',
    activity: [{ bucketAt: '2026-09-05T12:00:00Z', attempted: 3, captured: 2, unavailable: 1 }],
    samples: [{ observedAt: '2026-09-05T12:05:00Z', status: 'available', libraryIds: [1, 2], excludedLibraryCount: 1,
      acquisitionConfigured: true, inventoryRows: 10, supportedRows: 9, identifiedRows: 8, capturedRows: 6,
      freshRows: 5, keywordRows: 4, languageRows: 2, selectionChanged: false, libraryCoverage },
    { observedAt: '2026-09-05T11:05:00Z', status: 'available', libraryIds: [1, 2], excludedLibraryCount: 1,
      acquisitionConfigured: true, inventoryRows: 10, supportedRows: 9, identifiedRows: 8, capturedRows: 5,
      freshRows: 5, keywordRows: 3, languageRows: 2, selectionChanged: null,
      libraryCoverage: libraryCoverage.map(row => ({ ...row, comparison: 'first_sample', delta: null,
        populationChanged: null, previousObservedAt: null,
        ...(row.libraryId === 1 ? { capturedRows: 2, keywordRows: 1 } : {}) })) }] }
}
