/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { libraryObservationHistoryFixture } from './libraryObservationHistoryFixture'

export function libraryObservationSamplingFixture({ legacy = false } = {}) {
  const report = libraryObservationHistoryFixture()
  if (!legacy) report.samples = []
  report.librarySampling = { version: 'library.observation_sampling.v2', status: 'available', intervalMinutes: 5,
    libraryLimitPerVisit: 1, rowLimitPerLibrary: 20000, retainedPointLimit: 2016, activeLibraryCount: 13, lastSampleAt: '2026-09-05T12:00:00Z' }
  report.librarySamples = Array.from({ length: 13 }, (_, index) => {
    const libraryId = 13 - index
    return { libraryId, observedAt: new Date(Date.UTC(2026, 8, 5, 12) - index * 300000).toISOString(),
      status: libraryId === 1 ? 'capacity_exceeded' : 'available', acquisitionConfigured: true,
      inventoryLowerBound: libraryId === 1 ? 20001 : 2,
      inventoryRows: libraryId === 1 ? null : 2, supportedRows: libraryId === 1 ? null : 2,
      identifiedRows: libraryId === 1 ? null : 2, capturedRows: libraryId === 1 ? null : 1,
      freshRows: libraryId === 1 ? null : 1, keywordRows: libraryId === 1 ? null : 0, languageRows: libraryId === 1 ? null : 0,
      comparison: libraryId === 1 ? 'capacity_exceeded' : libraryId === 2 ? 'comparable' : 'first_sample',
      previousObservedAt: libraryId === 2 ? '2026-09-05T10:00:00Z' : null,
      elapsedMinutes: libraryId === 2 ? 65 : null, populationChanged: libraryId === 2 ? false : null,
      delta: libraryId === 2 ? { capturedRows: 0, freshRows: 0, keywordRows: 0, languageRows: 0 } : null,
      unchangedComparisons: libraryId === 2 ? 1 : 0 }
  })
  report.librarySamples.push({ ...report.librarySamples.find(point => point.libraryId === 2),
    observedAt: '2026-09-05T10:00:00Z', comparison: 'first_sample', previousObservedAt: null,
    elapsedMinutes: null, populationChanged: null, delta: null, unchangedComparisons: 0 })
  return report
}
