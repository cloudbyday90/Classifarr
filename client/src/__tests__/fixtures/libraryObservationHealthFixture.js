/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function libraryObservationHealthFixture() {
  return {
    version: 'library.observation_health.v1', observedAt: '2026-09-05T12:00:00.000Z',
    status: 'available', acquisitionConfigured: true, inventoryRowCount: 8,
    scope: { selectedLibraryCount: 1, activeLibraryCount: 1, excludedLibraryCount: 0, libraryLimit: 12, rowLimit: 20000 },
    freshness: { cacheDays: 30, retryHours: 6 },
    libraries: [{ id: 1, name: 'Movies', inventoryRowCount: 8, supportedRowCount: 7, identifiedRowCount: 6,
      identityCoveragePercent: 85.7, keywordCoveragePercent: 16.7, languageCoveragePercent: 16.7,
      counts: { captured: 2, keywordsKnown: 1, languageKnown: 1, emptyKeywords: 1, unknownLanguage: 1,
        invalidObservation: 1, undatedObservation: 1, clockAnomaly: 1, attemptWithoutRefresh: 1 },
      states: { fresh: 1, never_observed: 1, due: 1, backoff: 1, missing_identity: 1,
        unsupported_type: 1, observation_withheld: 1, clock_anomaly: 1 },
      queue: { processing: 1, pending: 2, idle: 5 },
      oldestSuccessfulObservationAt: '2026-09-04T12:00:00.000Z', lastSuccessfulObservationAt: '2026-09-04T12:00:00.000Z' }],
  }
}
