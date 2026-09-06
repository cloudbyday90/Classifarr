/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { libraryObservationSamplingFixture } from './libraryObservationSamplingFixture'
export function incrementalLibraryCoverageFixture() {
  const report = libraryObservationSamplingFixture()
  report.librarySampling = { ...report.librarySampling, version: 'library.observation_sampling.v3', rowLimitPerVisit: 20000, maximumScanHours: 168 }
  delete report.librarySampling.rowLimitPerLibrary
  for (const point of report.librarySamples) {
    point.measurementVersion = 3
    point.scanStartedAt = point.observedAt
    point.scannedRows = point.inventoryRows
    point.restartReason = null
  }
  const partial = report.librarySamples.find(point => point.libraryId === 1)
  Object.assign(partial, { status: 'in_progress', comparison: 'in_progress', scannedRows: 20000,
    restartReason: 'inventory_changed', scanStartedAt: '2026-09-05T10:00:00Z' })
  for (const complete of report.librarySamples.filter(point => point.libraryId === 2)) {
    Object.assign(complete, { scanStartedAt: complete.comparison === 'comparable' ? '2026-09-05T10:00:00Z' : '2026-09-05T08:55:00Z',
      inventoryRows: 20001, supportedRows: 20001, identifiedRows: 20001, capturedRows: 100,
      freshRows: 100, keywordRows: 75, languageRows: 80, scannedRows: 20001 })
  }
  const invalidated = report.librarySamples.find(point => point.libraryId === 3)
  Object.assign(invalidated, { status: 'invalidated', comparison: 'invalidated', scannedRows: 0,
    restartReason: 'changed_before_write', inventoryRows: null, supportedRows: null, identifiedRows: null,
    capturedRows: null, freshRows: null, keywordRows: null, languageRows: null, delta: null })
  return report
}
