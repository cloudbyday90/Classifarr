/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function libraryObservationHistoryFixture() {
  return { version: 'library.observation_history.v1', observedAt: '2026-09-05T12:30:00Z', retentionHours: 168,
    activityPopulation: 'all_guarded_inventory_acquisition_attempts', coveragePopulation: 'bounded_active_library_inventory_rows',
    activity: [{ bucketAt: '2026-09-05T12:00:00Z', attempted: 3, captured: 2, unavailable: 1 }],
    samples: [{ observedAt: '2026-09-05T12:05:00Z', status: 'available', libraryIds: [1, 2], excludedLibraryCount: 1,
      acquisitionConfigured: true, inventoryRows: 10, supportedRows: 9, identifiedRows: 8, capturedRows: 6,
      freshRows: 5, keywordRows: 4, languageRows: 2 }] }
}
